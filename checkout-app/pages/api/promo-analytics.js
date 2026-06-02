/**
 * PRML RECORDS — /api/promo-analytics
 *
 * Returns a comprehensive snapshot of every coupon's status, redemption
 * activity, and revenue impact. Used by the admin promo dashboard
 * (admin/promo-dashboard.html).
 *
 * Usage:
 *   GET /api/promo-analytics
 *     -> returns data for every coupon Stripe knows about (capped at 100)
 *
 *   GET /api/promo-analytics?codes=FIRST9_SETUP_FREE,PRML10,PRML20
 *     -> returns data only for the explicitly named coupons (recommended)
 *
 * Response shape:
 *   {
 *     generated_at: "2026-06-02T03:21:00.000Z",
 *     coupons: [
 *       {
 *         id: "FIRST9_SETUP_FREE",
 *         name: "First 9 Setup Free",
 *         valid: true,
 *         deleted: false,
 *         percent_off: null,
 *         amount_off_cents: 1599,
 *         max_redemptions: 9,
 *         stripe_times_redeemed: 0,        // Stripe-reported (Sessions/Subs only)
 *         actual_redemptions: 2,           // counted from succeeded PaymentIntents
 *         spots_left: 7,                   // null when uncapped
 *         redeem_by: 1735689600,
 *         revenue: {
 *           gross_cents: 12998,             // total payments before discount
 *           discount_cents: 3198,           // sum of discounts applied
 *           net_cents: 9800                 // what customers actually paid
 *         },
 *         recent: [
 *           { pi_id: "pi_abc...", amount_cents: 4899, created: 1717..., email: "x@y" },
 *           ...up to 5 most recent
 *         ]
 *       },
 *       ...
 *     ],
 *     totals: {
 *       all_coupons_revenue_cents: 12998,
 *       all_coupons_discount_cents: 3198,
 *       redemptions_this_period: 2
 *     }
 *   }
 *
 * Cache: 60s at the edge — analytics are not real-time critical, and we
 * want to keep Stripe API calls down.
 *
 * Authentication: protected via a simple shared-secret header. Set
 * PROMO_ADMIN_TOKEN in the Render env vars and pass it in the
 *   X-PRML-Admin-Token: <token>
 * request header. Returns 401 if missing or wrong. (The admin
 * dashboard page reads the token from sessionStorage after the user
 * pastes it once.)
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY
 *   PROMO_ADMIN_TOKEN
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

// ── Helpers ────────────────────────────────────────────────────────────────

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Count + aggregate all succeeded PaymentIntents tagged with this promo code.
 * Returns: { count, gross_cents, discount_cents, net_cents, recent[] }
 */
async function aggregatePromoActivity(promoCode) {
  const out = {
    count: 0,
    gross_cents: 0,
    discount_cents: 0,
    net_cents: 0,
    recent: [],
  };

  try {
    // Search supports up to 100 results per page; for our scale this is fine.
    const search = await stripe.paymentIntents.search({
      query: `status:'succeeded' AND metadata['promo_code']:'${promoCode}'`,
      limit: 100,
    });

    const sorted = (search.data || []).sort((a, b) => b.created - a.created);

    for (const pi of sorted) {
      out.count += 1;
      const gross = Number(pi.metadata?.original_amount || pi.amount || 0);
      const discount = Number(pi.metadata?.discount_cents || 0);
      out.gross_cents += gross;
      out.discount_cents += discount;
      out.net_cents += pi.amount || 0;
    }

    out.recent = sorted.slice(0, 5).map((pi) => ({
      pi_id: pi.id,
      amount_cents: pi.amount,
      created: pi.created,
      email: pi.receipt_email || pi.metadata?.email || null,
    }));
  } catch (err) {
    // Stripe Search not enabled? Return empty aggregates — dashboard handles.
    console.warn(`[/api/promo-analytics] Search failed for ${promoCode}:`, err.message);
  }

  return out;
}

/**
 * Build the analytics row for one coupon. Tolerates missing/deleted coupons.
 */
async function buildCouponRow(code) {
  const row = {
    id: code,
    name: null,
    valid: false,
    deleted: false,
    percent_off: null,
    amount_off_cents: null,
    max_redemptions: null,
    stripe_times_redeemed: 0,
    actual_redemptions: 0,
    spots_left: null,
    redeem_by: null,
    revenue: { gross_cents: 0, discount_cents: 0, net_cents: 0 },
    recent: [],
  };

  // Try to load the coupon. Deleted (= capped) coupons return resource_missing.
  let coupon = null;
  try {
    coupon = await stripe.coupons.retrieve(code);
    row.name = coupon.name || coupon.id;
    row.valid = !!coupon.valid;
    row.percent_off = coupon.percent_off ?? null;
    row.amount_off_cents = coupon.amount_off ?? null;
    row.max_redemptions = coupon.max_redemptions ?? null;
    row.stripe_times_redeemed = coupon.times_redeemed ?? 0;
    row.redeem_by = coupon.redeem_by ?? null;
  } catch (err) {
    if (err.code === 'resource_missing') {
      row.deleted = true;
    } else {
      // Something else went wrong — propagate up
      throw err;
    }
  }

  // Aggregate actual usage from PaymentIntents — works even after coupon is deleted.
  const activity = await aggregatePromoActivity(code);
  row.actual_redemptions = activity.count;
  row.revenue = {
    gross_cents: activity.gross_cents,
    discount_cents: activity.discount_cents,
    net_cents: activity.net_cents,
  };
  row.recent = activity.recent;

  if (row.max_redemptions != null) {
    row.spots_left = Math.max(0, row.max_redemptions - row.actual_redemptions);
  }

  return row;
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth gate
  const expected = process.env.PROMO_ADMIN_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'PROMO_ADMIN_TOKEN not configured on server' });
  }
  const provided = req.headers['x-prml-admin-token'];
  if (provided !== expected) {
    return unauthorized(res);
  }

  // Which coupons to report on
  let codes = [];
  if (req.query.codes) {
    codes = String(req.query.codes)
      .split(',')
      .map((c) => c.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40))
      .filter(Boolean);
  } else {
    // No codes specified — list all coupons in Stripe (capped at 100)
    try {
      const all = await stripe.coupons.list({ limit: 100 });
      codes = (all.data || []).map((c) => c.id);
    } catch (err) {
      console.error('[/api/promo-analytics] list coupons failed:', err.message);
      return res.status(500).json({ error: 'Failed to list coupons' });
    }
  }

  if (codes.length === 0) {
    return res.status(200).json({
      generated_at: new Date().toISOString(),
      coupons: [],
      totals: { all_coupons_revenue_cents: 0, all_coupons_discount_cents: 0, redemptions_this_period: 0 },
      note: 'No coupons found. Create coupons in Stripe Dashboard first.',
    });
  }

  // Cache 60s
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    // Fan out — Stripe rate limits at ~25 req/s on test mode, more on live.
    // For typical PRML scale (<20 coupons) this is well within budget.
    const rows = await Promise.all(codes.map((c) => buildCouponRow(c)));

    const totals = rows.reduce(
      (acc, r) => {
        acc.all_coupons_revenue_cents += r.revenue.gross_cents;
        acc.all_coupons_discount_cents += r.revenue.discount_cents;
        acc.redemptions_this_period += r.actual_redemptions;
        return acc;
      },
      { all_coupons_revenue_cents: 0, all_coupons_discount_cents: 0, redemptions_this_period: 0 }
    );

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      coupons: rows,
      totals,
    });
  } catch (err) {
    console.error('[/api/promo-analytics] aggregate error:', err.message);
    return res.status(500).json({ error: 'Failed to build analytics', message: err.message });
  }
}
