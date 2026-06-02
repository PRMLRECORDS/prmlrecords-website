/**
 * PRML RECORDS — /api/checkout
 *
 * Creates a Stripe PaymentIntent and returns the client_secret to the frontend.
 * The frontend uses this secret to mount the Payment Element without a redirect.
 *
 * Optional: pass `promo_code` to apply a Stripe coupon. The endpoint:
 *   1. Looks up the coupon by ID
 *   2. Verifies it's valid (active, not expired, redemptions remaining)
 *   3. Reduces the charged amount by the coupon discount
 *   4. Stores the coupon ID in PaymentIntent metadata so the webhook can
 *      record it on the Airtable Orders row
 *
 * Coupon redemption count is NOT incremented here. Stripe only counts a
 * coupon as redeemed when applied via a Checkout Session OR Subscription —
 * for raw PaymentIntents we manage the counter via the webhook
 * (payment_intent.succeeded → Stripe coupon update).
 *
 * Environment variables required (set in Render dashboard):
 *   STRIPE_SECRET_KEY — sk_live_... or sk_test_...
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

// Minimum order amount in cents ($1.00) — Stripe requirement
const MIN_AMOUNT_CENTS = 100;
// Safety cap: $2,000 — prevents runaway charges from bad client data
const MAX_AMOUNT_CENTS = 200000;

// ── Coupon helpers ─────────────────────────────────────────────────────────

/**
 * Look up a Stripe coupon by ID and verify it's currently usable.
 * Returns { coupon, discountCents } or { error }.
 */
async function loadAndValidateCoupon(promoCode, baseAmountCents) {
  const id = String(promoCode || '').trim().toUpperCase();
  if (!id) return { error: 'Empty promo code' };
  if (!/^[A-Z0-9_-]{2,40}$/.test(id)) return { error: 'Invalid promo code format' };

  let coupon;
  try {
    coupon = await stripe.coupons.retrieve(id);
  } catch (err) {
    if (err.code === 'resource_missing') return { error: 'Promo code not found' };
    throw err;
  }

  if (!coupon.valid) return { error: 'Promo code expired or fully redeemed' };

  if (coupon.max_redemptions != null) {
    const remaining = coupon.max_redemptions - (coupon.times_redeemed || 0);
    if (remaining <= 0) return { error: 'Promo code fully redeemed' };
  }

  if (coupon.redeem_by && coupon.redeem_by * 1000 < Date.now()) {
    return { error: 'Promo code expired' };
  }

  // Calculate discount in cents
  let discountCents = 0;
  if (coupon.amount_off != null) {
    // Fixed amount off (already in the smallest currency unit)
    discountCents = coupon.amount_off;
  } else if (coupon.percent_off != null) {
    discountCents = Math.round((baseAmountCents * coupon.percent_off) / 100);
  }

  // Floor at MIN_AMOUNT_CENTS (Stripe rejects sub-$1 charges)
  if (baseAmountCents - discountCents < MIN_AMOUNT_CENTS) {
    discountCents = baseAmountCents - MIN_AMOUNT_CENTS;
  }

  return { coupon, discountCents };
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, promo_code } = req.body;

  // ── Validate amount ──────────────────────────────────────────────────────
  if (
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount < MIN_AMOUNT_CENTS ||
    amount > MAX_AMOUNT_CENTS
  ) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  let chargeAmount = amount;
  const metadata = { source: 'prmlrecords.com' };
  let appliedCoupon = null;
  let discountCents = 0;

  // ── Apply coupon if provided ─────────────────────────────────────────────
  if (promo_code) {
    try {
      const result = await loadAndValidateCoupon(promo_code, amount);
      if (result.error) {
        return res.status(400).json({ error: result.error, code: 'promo_invalid' });
      }
      appliedCoupon = result.coupon;
      discountCents = result.discountCents;
      chargeAmount = amount - discountCents;
      metadata.promo_code = appliedCoupon.id;
      metadata.original_amount = String(amount);
      metadata.discount_cents = String(discountCents);
    } catch (err) {
      console.error('[/api/checkout] Coupon lookup error:', err.message);
      return res.status(500).json({ error: 'Failed to validate promo code' });
    }
  }

  try {
    // ── Create PaymentIntent ───────────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: chargeAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      original_amount: amount,
      charge_amount: chargeAmount,
      discount_cents: discountCents,
      promo_code: appliedCoupon ? appliedCoupon.id : null,
      promo_label: appliedCoupon ? (appliedCoupon.name || appliedCoupon.id) : null,
    });
  } catch (err) {
    console.error('[/api/checkout] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}
