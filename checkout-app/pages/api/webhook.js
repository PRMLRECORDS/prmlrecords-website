/**
 * PRML RECORDS — /api/webhook
 *
 * Stripe webhook endpoint — safety net for order recording.
 * Catches payment_intent.succeeded events to ensure every paid order
 * is recorded in Airtable + owner is notified, even if the customer's
 * browser closes before the frontend POSTs to /api/orders.
 *
 * Environment variables required (set in Render dashboard):
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... (from Stripe Dashboard → Webhooks)
 *   AIRTABLE_API_KEY         — Airtable personal access token
 *   AIRTABLE_BASE_ID         — e.g. appXXXXXXXXXXXXXX
 *   BREVO_API_KEY            — xkeysib-...
 *   OWNER_NOTIFICATION_EMAIL — (optional) defaults to info@prmlrecords.com
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

// ── Helpers (shared with orders.js) ──────────────────────────────────────────

function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, 500);
}

function buildOrderId(paymentIntentId) {
  const suffix = String(paymentIntentId || '').slice(-8).toUpperCase();
  return `PRML-${suffix}`;
}

// ── Check if order already exists in Airtable ────────────────────────────────

async function orderExists(paymentIntentId) {
  const formula = encodeURIComponent(`{Payment Intent} = "${sanitize(paymentIntentId)}"`);
  const url = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders?filterByFormula=${formula}&maxRecords=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
  });

  if (!response.ok) {
    console.error(`[webhook] Airtable lookup error: ${response.status}`);
    return false; // If we can't check, proceed with creation (dedup by orderId)
  }

  const data = await response.json();
  return data.records && data.records.length > 0;
}

// ── Create Airtable record from Stripe PaymentIntent metadata ────────────────

async function createOrderFromWebhook(orderId, pi) {
  // Extract what we can from the PaymentIntent
  const amount = pi.amount || 0;
  const totalDollars = (amount / 100).toFixed(2);
  const email = pi.receipt_email || pi.metadata?.email || '';
  const customerName = pi.metadata?.customer_name || pi.shipping?.name || 'Unknown';

  const fields = {
    'Order ID':        orderId,
    'Status':          'Confirmed (webhook)',
    'Customer Name':   sanitize(customerName),
    'Email':           sanitize(email),
    'Street':          sanitize(pi.shipping?.address?.line1 || pi.metadata?.street || ''),
    'City':            sanitize(pi.shipping?.address?.city || pi.metadata?.city || ''),
    'State':           sanitize(pi.shipping?.address?.state || pi.metadata?.state || ''),
    'ZIP':             sanitize(pi.shipping?.address?.postal_code || pi.metadata?.zip || ''),
    'Items':           sanitize(pi.metadata?.items || 'See Stripe dashboard'),
    'Total ($)':       parseFloat(totalDollars),
    'Delivery Window': sanitize(pi.metadata?.delivery || 'Standard'),
    'Payment Intent':  pi.id,
    'Created':         new Date().toISOString(),
  };

  const response = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Airtable error ${response.status}: ${err}`);
  }

  return response.json();
}

// ── Send owner notification ──────────────────────────────────────────────────

async function notifyOwner(orderId, pi) {
  const amount = pi.amount || 0;
  const totalDollars = (amount / 100).toFixed(2);
  const email = pi.receipt_email || pi.metadata?.email || 'unknown';
  const customerName = pi.metadata?.customer_name || pi.shipping?.name || 'Unknown';
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL || 'info@prmlrecords.com';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'PRML ORDER ALERT', email: 'hello@prmlrecords.com' },
      to: [{ email: ownerEmail, name: 'SEAUX9' }],
      subject: `⚠️ WEBHOOK ORDER: ${orderId} — $${totalDollars} — ${sanitize(customerName)}`,
      textContent: [
        `WEBHOOK SAFETY NET — Order captured via Stripe webhook`,
        `(Customer browser may have closed before normal order flow completed)`,
        ``,
        `Order: ${orderId}`,
        `Total: $${totalDollars}`,
        `Customer: ${customerName} (${email})`,
        `Payment Intent: ${pi.id}`,
        ``,
        `Check Airtable Orders table for full details.`,
        `— PRML RECORDS Order Alert System`,
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    console.error(`[webhook] Owner notification error: ${response.status}`);
  }
}

// ── Webhook handler ──────────────────────────────────────────────────────────

// Next.js Pages Router: disable body parsing so we can verify the raw signature
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Verify Stripe signature ─────────────────────────────────────────────
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`[webhook] Signature verification failed:`, err.message);
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }

  // ── Handle payment_intent.succeeded ─────────────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const orderId = buildOrderId(pi.id);
    const promoCode = pi.metadata?.promo_code;

    console.log(`[webhook] payment_intent.succeeded: ${pi.id} ($${(pi.amount / 100).toFixed(2)})${promoCode ? ' promo=' + promoCode : ''}`);

    // ── Mark coupon as redeemed in Stripe ────────────────────────────────
    // PaymentIntents don't auto-increment coupon.times_redeemed (only Checkout
    // Sessions / Subscriptions do). We bump it ourselves so /api/promo-status
    // reflects reality and capped coupons (e.g. FIRST9_SETUP_FREE max=9) stop
    // when full.
    if (promoCode) {
      try {
        const coupon = await stripe.coupons.retrieve(promoCode);
        const newCount = (coupon.times_redeemed || 0) + 1;
        // Stripe's times_redeemed is read-only. To enforce the cap when the
        // counter hits max, we delete the coupon (it becomes invalid). Until
        // then we just log the redemption — the next /api/promo-status call
        // counts existing PaymentIntents with this metadata.
        if (coupon.max_redemptions != null && newCount >= coupon.max_redemptions) {
          await stripe.coupons.del(promoCode);
          console.log(`[webhook] Coupon ${promoCode} hit max_redemptions (${coupon.max_redemptions}) — deleted to prevent further use`);
        } else {
          console.log(`[webhook] Coupon ${promoCode} redeemed (${newCount}/${coupon.max_redemptions || '∞'})`);
        }
      } catch (err) {
        // Don't fail the order on coupon-tracking errors
        console.error(`[webhook] Coupon update failed for ${promoCode}:`, err.message);
      }
    }

    // Check if /api/orders already recorded this order
    const alreadyRecorded = await orderExists(pi.id);

    if (alreadyRecorded) {
      console.log(`[webhook] Order ${orderId} already exists in Airtable — skipping`);
      return res.status(200).json({ received: true, action: 'skipped (already recorded)' });
    }

    // Order wasn't recorded by the normal flow — save it now
    console.log(`[webhook] Order ${orderId} NOT found — creating from webhook`);

    try {
      await createOrderFromWebhook(orderId, pi);
      await notifyOwner(orderId, pi);
      console.log(`[webhook] Order ${orderId} saved and owner notified`);
    } catch (err) {
      console.error(`[webhook] Failed to process ${orderId}:`, err.message);
      return res.status(500).json({ error: 'Failed to process webhook order' });
    }

    return res.status(200).json({ received: true, action: 'created from webhook' });
  }

  // ── All other events — acknowledge but don't process ────────────────────
  return res.status(200).json({ received: true, action: 'ignored' });
}
