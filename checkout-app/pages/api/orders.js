/**
 * PRML RECORDS — /api/orders
 *
 * Receives confirmed order data from the checkout page after Stripe payment succeeds.
 * 1. Creates a record in Airtable (base: AIRTABLE_BASE_ID, table: "Orders")
 * 2. Sends a confirmation email via Brevo (formerly Sendinblue) transactional API
 * 3. Returns { success: true, orderId } or an error response
 *
 * Environment variables required (set in Render dashboard):
 *   AIRTABLE_API_KEY   — Airtable personal access token (pat...)
 *   AIRTABLE_BASE_ID   — e.g. appXXXXXXXXXXXXXX
 *   BREVO_API_KEY      — xkeysib-... (Brevo API v3 key)
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sanitise a string: strip HTML tags and trim whitespace.
 * Applied to all user-supplied strings before they enter Airtable / email.
 */
function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, 500);
}

/**
 * Build a human-readable order ID from Stripe's PaymentIntent ID.
 * Format: PRML-<last 8 chars of pi_...>  e.g. PRML-A1B2C3D4
 */
function buildOrderId(paymentIntentId) {
  const suffix = String(paymentIntentId || '').slice(-8).toUpperCase();
  return `PRML-${suffix}`;
}

/**
 * Format cart items into a plain-text summary for Airtable long-text field.
 */
function formatCartSummary(cart) {
  return cart
    .map((i) => `${sanitize(i.name)}${i.qty > 1 ? ` x${i.qty}` : ''} — $${parseFloat(i.price).toFixed(2)}`)
    .join('\n');
}

// ── Airtable ──────────────────────────────────────────────────────────────────

async function createAirtableRecord(orderId, payload) {
  const { cart, shipping, email, delivery, amount } = payload;
  const totalDollars = (amount / 100).toFixed(2);

  const fields = {
    'Order ID':        orderId,
    'Status':          'Confirmed',
    'Customer Name':   sanitize(shipping.name),
    'Email':           sanitize(email),
    'Street':          sanitize(shipping.street),
    'City':            sanitize(shipping.city),
    'State':           sanitize(shipping.state),
    'ZIP':             sanitize(shipping.zip),
    'Items':           formatCartSummary(cart),
    'Total ($)':       parseFloat(totalDollars),
    'Delivery Window': sanitize(delivery),
    'Payment Intent':  sanitize(payload.paymentIntentId),
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

// ── Brevo (Sendinblue) transactional email ────────────────────────────────────

async function sendConfirmationEmail(orderId, payload) {
  const { cart, shipping, email, delivery, amount } = payload;
  const totalDollars = (amount / 100).toFixed(2);

  // Build HTML item rows for the email
  const itemRows = cart
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;font-family:'Roboto Slab',serif;font-size:13px;color:#2C2C2C;border-bottom:1px solid #e0dbd0">
          ${sanitize(i.name)}${i.qty > 1 ? ` <span style="color:#888">x${i.qty}</span>` : ''}
        </td>
        <td style="padding:8px 0;font-family:'Courier New',monospace;font-size:13px;color:#2C2C2C;text-align:right;border-bottom:1px solid #e0dbd0">
          $${parseFloat(i.price).toFixed(2)}
        </td>
      </tr>`
    )
    .join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Order Confirmed — PRML RECORDS</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Roboto Slab',Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#F5F0E8">

          <!-- Header -->
          <tr>
            <td style="background:#2C2C2C;padding:24px 32px">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:18px;color:#F5F0E8;letter-spacing:2px">
                PRML RECORDS
              </p>
            </td>
          </tr>

          <!-- Red accent bar -->
          <tr><td style="height:4px;background:#E01010"></td></tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">

              <p style="margin:0 0 4px;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#E01010">
                Order Confirmed
              </p>
              <h1 style="margin:0 0 24px;font-family:'Courier New',monospace;font-size:28px;color:#2C2C2C;letter-spacing:-1px">
                Thank you, ${sanitize(shipping.name).split(' ')[0]}.
              </h1>

              <p style="font-size:13px;color:#2C2C2C;line-height:1.8;margin:0 0 24px">
                Your order has been received and is being processed.
                Estimated delivery: <strong>${sanitize(delivery)}</strong>.
              </p>

              <!-- Order summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
                <tr>
                  <td colspan="2" style="padding-bottom:8px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#888">
                    Order Summary · ${orderId}
                  </td>
                </tr>
                ${itemRows}
                <tr>
                  <td style="padding:12px 0 4px;font-size:12px;color:#888">Shipping &amp; Handling</td>
                  <td style="padding:12px 0 4px;font-size:12px;color:#888;text-align:right">$6.00</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#2C2C2C;border-top:2px solid #2C2C2C">
                    Total
                  </td>
                  <td style="padding:8px 0;font-family:'Courier New',monospace;font-size:16px;color:#2C2C2C;font-weight:bold;text-align:right;border-top:2px solid #2C2C2C">
                    $${totalDollars}
                  </td>
                </tr>
              </table>

              <!-- Ship to -->
              <div style="background:#2C2C2C;padding:20px 24px;margin-bottom:24px">
                <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#E01010">
                  Ships To
                </p>
                <p style="margin:0;font-size:13px;color:#F5F0E8;line-height:1.8">
                  ${sanitize(shipping.name)}<br>
                  ${sanitize(shipping.street)}<br>
                  ${sanitize(shipping.city)}, ${sanitize(shipping.state)} ${sanitize(shipping.zip)}
                </p>
              </div>

              <p style="font-size:12px;color:#888;line-height:1.8;margin:0 0 32px">
                Questions? Reply to this email or visit
                <a href="https://prmlrecords.com/support.html" style="color:#E01010">prmlrecords.com/support</a>.
              </p>

              <!-- CTA -->
              <a
                href="https://prmlrecords.com"
                style="display:inline-block;background:#E01010;color:#F5F0E8;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 28px"
              >
                Visit PRML RECORDS
              </a>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(44,44,44,.1)">
              <p style="margin:0;font-size:11px;color:#888;line-height:1.8">
                PRML RECORDS LLC · Atlanta, GA · West End<br>
                Peace Freedom Justice Equality
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name:  'PRML RECORDS',
        email: 'hello@prmlrecords.com',   // must be verified in Brevo
      },
      to: [{ email: sanitize(email), name: sanitize(shipping.name) }],
      subject: `Order Confirmed — ${orderId}`,
      htmlContent,
      // Plain-text fallback
      textContent: [
        `PRML RECORDS — Order Confirmed`,
        ``,
        `Order ID: ${orderId}`,
        `Total: $${totalDollars}`,
        `Estimated Delivery: ${delivery}`,
        ``,
        `Ship To:`,
        `${shipping.name}`,
        `${shipping.street}`,
        `${shipping.city}, ${shipping.state} ${shipping.zip}`,
        ``,
        `Questions? Visit prmlrecords.com/support`,
        ``,
        `PRML RECORDS LLC · Atlanta, GA · Peace Freedom Justice Equality`,
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    // Log but don't throw — a failed email shouldn't block order confirmation
    console.error(`[/api/orders] Brevo error ${response.status}:`, err);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentIntentId, amount, cart, shipping, email, delivery } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return res.status(400).json({ error: 'Missing paymentIntentId' });
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!shipping || !shipping.name || !shipping.street || !shipping.city || !shipping.state || !shipping.zip) {
    return res.status(400).json({ error: 'Incomplete shipping address' });
  }

  const orderId = buildOrderId(paymentIntentId);
  const payload = { paymentIntentId, amount, cart, shipping, email: email.toLowerCase(), delivery };

  // ── Airtable — required ───────────────────────────────────────────────────
  try {
    await createAirtableRecord(orderId, payload);
  } catch (err) {
    console.error('[/api/orders] Airtable failed:', err.message);
    // Return 500 so the frontend knows the record wasn't saved
    return res.status(500).json({ error: 'Failed to save order record' });
  }

  // ── Brevo email — best effort ─────────────────────────────────────────────
  try {
    await sendConfirmationEmail(orderId, payload);
  } catch (err) {
    // Already logged inside sendConfirmationEmail; don't fail the response
    console.error('[/api/orders] Email send error:', err.message);
  }

  return res.status(200).json({ success: true, orderId });
}
