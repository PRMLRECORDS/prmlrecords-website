/**
 * PRML RECORDS — /api/checkout
 *
 * Creates a Stripe PaymentIntent and returns the client_secret to the frontend.
 * The frontend uses this secret to mount the Payment Element without a redirect.
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

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount } = req.body;

  // ── Validate amount ───────────────────────────────────────────────────────
  if (
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount < MIN_AMOUNT_CENTS ||
    amount > MAX_AMOUNT_CENTS
  ) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    // ── Create PaymentIntent ──────────────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount,                       // in cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,              // lets Stripe show the best methods for the buyer
      },
      metadata: {
        source: 'prmlrecords.com',  // visible in Stripe dashboard
      },
    });

    return res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[/api/checkout] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
}
