/**
 * PRML RECORDS — /api/orders
 *
 * Receives confirmed order data from the checkout page after Stripe payment succeeds.
 * 1. Creates a record in Airtable (base: AIRTABLE_BASE_ID, table: "Orders")
 * 2. Sends a confirmation email via Brevo (formerly Sendinblue) transactional API
 * 3. Returns { success: true, orderId } or an error response
 *
 * Environment variables required (set in Render dashboard):
 *   AIRTABLE_API_KEY            — Airtable personal access token (pat...)
 *   AIRTABLE_BASE_ID            — e.g. appXXXXXXXXXXXXXX
 *   BREVO_API_KEY               — xkeysib-... (Brevo API v3 key)
 *   OWNER_NOTIFICATION_EMAIL    — (optional) Email for order alerts, defaults to info@prmlrecords.com
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
<body style="margin:0;padding:0;background-color:#F5E6C8;font-family:Georgia,serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5E6C8">
    <tr>
      <td align="center" style="padding:40px 16px">

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#F5E6C8">

          <!-- HEADER — Charcoal with wordmark -->
          <tr>
            <td style="background-color:#2B2B2B;padding:32px 40px 28px">
              <div style="font-family:Arial Black,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:0.08em;color:#F5E6C8;text-transform:uppercase;line-height:1">
                PRML <span style="color:#E01010">RECORDS</span>
              </div>
              <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:0.22em;color:#8C8C7A;text-transform:uppercase;margin-top:6px">
                Primal Energy. Primal Sound.
              </div>
            </td>
          </tr>

          <!-- RED ACCENT BAR -->
          <tr><td style="height:4px;background-color:#E01010"></td></tr>

          <!-- RED LABEL STRIP -->
          <tr>
            <td style="background-color:#E01010;padding:10px 40px">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.26em;color:#F5E6C8;text-transform:uppercase">
                Order Confirmed — ${orderId}
              </p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background-color:#F5E6C8;padding:40px 40px 32px">

              <h1 style="margin:0 0 24px;font-family:Arial Black,Arial,sans-serif;font-size:28px;font-weight:900;color:#2B2B2B;letter-spacing:-0.01em;line-height:1.2">
                Thank you, ${sanitize(shipping.name).split(' ')[0]}.
              </h1>

              <p style="font-family:Georgia,serif;font-size:15px;color:#2B2B2B;line-height:1.8;margin:0 0 24px;opacity:.85">
                Your order has been received and is being prepared.
                Estimated delivery: <strong>${sanitize(delivery)}</strong>.
              </p>

              <!-- ORDER SUMMARY TABLE -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
                <tr>
                  <td colspan="2" style="padding:12px 0;border-top:1px solid rgba(43,43,43,.15);border-bottom:1px solid rgba(43,43,43,.15)">
                    <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#E01010;text-transform:uppercase">Order Summary</span>
                  </td>
                </tr>
                ${itemRows}
                <tr>
                  <td style="padding:10px 0 4px;font-family:Georgia,serif;font-size:13px;color:#8C8C7A">Shipping &amp; Handling</td>
                  <td style="padding:10px 0 4px;font-family:Georgia,serif;font-size:13px;color:#8C8C7A;text-align:right">$6.00</td>
                </tr>
                <tr>
                  <td style="padding:12px 0;font-family:Arial Black,Arial,sans-serif;font-size:16px;font-weight:900;color:#2B2B2B;border-top:2px solid #2B2B2B">
                    Total
                  </td>
                  <td style="padding:12px 0;font-family:Arial Black,Arial,sans-serif;font-size:18px;font-weight:900;color:#E01010;text-align:right;border-top:2px solid #2B2B2B">
                    $${totalDollars}
                  </td>
                </tr>
              </table>

              <!-- SHIPS TO — Dark card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px">
                <tr>
                  <td style="background-color:#2B2B2B;padding:20px 24px">
                    <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;color:#E01010;text-transform:uppercase">
                      Ships To
                    </p>
                    <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:#F5E6C8;line-height:1.8">
                      ${sanitize(shipping.name)}<br>
                      ${sanitize(shipping.street)}<br>
                      ${sanitize(shipping.city)}, ${sanitize(shipping.state)} ${sanitize(shipping.zip)}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- SUPPORT NOTE -->
              <p style="font-family:Georgia,serif;font-size:13px;color:#8C8C7A;line-height:1.8;margin:0 0 28px">
                Questions about your order? Reply to this email or visit
                <a href="https://prmlrecords.com/support.html" style="color:#E01010;text-decoration:none;font-weight:bold">prmlrecords.com/support</a>.
              </p>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#E01010;padding:14px 28px">
                    <a href="https://prmlrecords.com/shop.html" style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.2em;color:#F5E6C8;text-transform:uppercase;text-decoration:none">
                      Continue Shopping
                    </a>
                  </td>
                </tr>
              </table>

              <!-- SIGN-OFF -->
              <p style="font-family:Georgia,serif;font-size:14px;color:#2B2B2B;margin:32px 0 0;font-style:italic;opacity:.7">
                With Gratitude,<br>
                PRML RECORDS
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#2B2B2B;padding:20px 40px;border-top:3px solid #E01010">
              <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:#8C8C7A;line-height:1.8">
                PRML RECORDS LLC &middot; West End, Atlanta, GA<br>
                Peace Freedom Justice Equality
              </p>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.1em;color:#555">
                <a href="https://prmlrecords.com" style="color:#E01010;text-decoration:none">prmlrecords.com</a> &middot;
                <a href="https://prmlrecords.com/privacypolicy.html" style="color:#555;text-decoration:none">Privacy Policy</a> &middot;
                <a href="https://prmlrecords.com/termsofservice.html" style="color:#555;text-decoration:none">Terms</a>
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

// ── Owner notification (SEAUX9 alert) ────────────────────────────────────────

async function sendOwnerNotification(orderId, payload) {
  const { cart, shipping, email, delivery, amount } = payload;
  const totalDollars = (amount / 100).toFixed(2);
  const itemList = cart
    .map((i) => `• ${sanitize(i.name)}${i.qty > 1 ? ` x${i.qty}` : ''} — $${parseFloat(i.price).toFixed(2)}`)
    .join('\n');

  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL || 'info@prmlrecords.com';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Order — ${orderId}</title></head>
<body style="margin:0;padding:0;background:#131313;font-family:'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#131313;padding:32px 20px">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px">

          <!-- Header -->
          <tr>
            <td style="background:#E01010;padding:16px 24px">
              <p style="margin:0;font-size:14px;color:#F5F0E8;letter-spacing:2px;font-weight:bold">
                NEW ORDER — ${orderId}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#1B1C1C;padding:24px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 16px">
                    <p style="margin:0;font-size:28px;color:#F5F0E8;font-weight:bold">$${totalDollars}</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#8C8C7A;letter-spacing:1px">
                      ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #353535">
                    <p style="margin:0 0 8px;font-size:10px;color:#E01010;letter-spacing:2px;text-transform:uppercase">CUSTOMER</p>
                    <p style="margin:0;font-size:14px;color:#F5F0E8;line-height:1.6">
                      ${sanitize(shipping.name)}<br>
                      <span style="color:#8C8C7A">${sanitize(email)}</span><br>
                      <span style="color:#8C8C7A">${sanitize(shipping.street)}, ${sanitize(shipping.city)}, ${sanitize(shipping.state)} ${sanitize(shipping.zip)}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #353535">
                    <p style="margin:0 0 8px;font-size:10px;color:#E01010;letter-spacing:2px;text-transform:uppercase">ITEMS</p>
                    <p style="margin:0;font-size:13px;color:#F5F0E8;line-height:1.8;white-space:pre-line">${itemList}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #353535">
                    <p style="margin:0 0 8px;font-size:10px;color:#E01010;letter-spacing:2px;text-transform:uppercase">DELIVERY</p>
                    <p style="margin:0;font-size:13px;color:#F5F0E8">${sanitize(delivery)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0E0E0E;padding:16px 24px">
              <p style="margin:0;font-size:11px;color:#8C8C7A">
                PRML RECORDS — Order Alert System · With Gratitude.
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
        name:  'PRML ORDER ALERT',
        email: 'hello@prmlrecords.com',
      },
      to: [{ email: ownerEmail, name: 'SEAUX9' }],
      subject: `💰 NEW ORDER: ${orderId} — $${totalDollars} — ${sanitize(shipping.name)}`,
      htmlContent,
      textContent: [
        `NEW ORDER — ${orderId}`,
        ``,
        `Total: $${totalDollars}`,
        `Customer: ${shipping.name} (${email})`,
        `Address: ${shipping.street}, ${shipping.city}, ${shipping.state} ${shipping.zip}`,
        ``,
        `Items:`,
        itemList,
        ``,
        `Delivery: ${delivery}`,
        ``,
        `— PRML RECORDS Order Alert System`,
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[/api/orders] Owner notification error ${response.status}:`, err);
  } else {
    console.log(`[/api/orders] Owner notification sent for ${orderId}`);
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

  // ── Brevo emails — best effort (customer confirmation + owner alert) ─────
  try {
    await Promise.allSettled([
      sendConfirmationEmail(orderId, payload),
      sendOwnerNotification(orderId, payload),
    ]);
  } catch (err) {
    console.error('[/api/orders] Email send error:', err.message);
  }

  return res.status(200).json({ success: true, orderId });
}
