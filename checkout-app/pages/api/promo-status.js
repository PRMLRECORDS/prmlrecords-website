/**
 * PRML RECORDS — /api/promo-status
 *
 * Returns the live status of a Stripe coupon — used by the site-wide
 * promo banner (js/promo-banner.js) to show real-time "X spots left".
 *
 * Usage:
 *   GET /api/promo-status?code=FIRST9_SETUP_FREE
 *
 * Response (200):
 *   {
 *     code: "FIRST9_SETUP_FREE",
 *     valid: true,
 *     max_redemptions: 9,
 *     times_redeemed: 7,
 *     spots_left: 2,
 *     percent_off: null,
 *     amount_off: null,
 *     redeem_by: 1735689600,
 *     name: "First 9 Setup Free"
 *   }
 *
 * Response (404): coupon not found
 * Response (410): coupon exists but no longer valid (expired or fully redeemed)
 *
 * Caches 30s via CDN — small enough to feel real-time, big enough to keep
 * Stripe API calls under their rate limit even on heavy traffic.
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{2,40}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid code parameter' });
  }

  try {
    const coupon = await stripe.coupons.retrieve(code);
    const maxRedemptions = coupon.max_redemptions ?? null;

    // Stripe's coupon.times_redeemed only auto-increments for Checkout Sessions
    // and Subscriptions — NOT for raw PaymentIntents (which is what we use).
    // So we count actual succeeded PaymentIntents tagged with this promo code
    // in metadata. The webhook deletes the coupon when max is hit, so this
    // search only ever matters BEFORE that hard kill-switch fires.
    let actualRedemptions = 0;
    try {
      // Stripe Search API: indexed metadata is searchable for ~1 min after write
      const search = await stripe.paymentIntents.search({
        query: `status:'succeeded' AND metadata['promo_code']:'${code}'`,
        limit: 100,
      });
      actualRedemptions = search.data.length;
    } catch (searchErr) {
      // Search API may not be available on all Stripe accounts — fall back
      console.warn('[/api/promo-status] Search fallback:', searchErr.message);
      actualRedemptions = coupon.times_redeemed ?? 0;
    }

    const spotsLeft =
      maxRedemptions != null ? Math.max(0, maxRedemptions - actualRedemptions) : null;

    const stillValid =
      coupon.valid &&
      (maxRedemptions == null || spotsLeft > 0) &&
      (!coupon.redeem_by || coupon.redeem_by * 1000 > Date.now());

    // Cache 30s at the edge — feels live without hammering Stripe
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

    if (!stillValid) {
      return res.status(410).json({
        code,
        valid: false,
        max_redemptions: maxRedemptions,
        times_redeemed: actualRedemptions,
        spots_left: spotsLeft,
        reason: 'expired_or_redeemed',
      });
    }

    return res.status(200).json({
      code,
      valid: true,
      max_redemptions: maxRedemptions,
      times_redeemed: actualRedemptions,
      spots_left: spotsLeft,
      percent_off: coupon.percent_off ?? null,
      amount_off: coupon.amount_off ?? null,
      redeem_by: coupon.redeem_by ?? null,
      name: coupon.name || coupon.id,
    });
  } catch (err) {
    if (err.code === 'resource_missing') {
      return res.status(404).json({ code, error: 'Coupon not found' });
    }
    console.error('[/api/promo-status] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to load promo status' });
  }
}
