/* ════════════════════════════════════════════════════
   PRML Records LLC — main.js  |  prmlrecords.com
   West End Atlanta · Peace Freedom Justice Equality
   ──────────────────────────────────────────────────
   SETUP — paste your values on these 3 lines only:
════════════════════════════════════════════════════ */

const GAS_URL    = 'https://script.google.com/macros/s/AKfycbzlXsUJFb36zh58jc2-N54Cmfhgh4EC478OzKehJG56qeNcZRSzFmOAU4PBHEgVdzsLyQ/exec';        // Apps Script /exec URL
const STRIPE_PK  = 'pk_live_51IJPNBIEvKUNtDqenm2BfJJxvZKp5gcSpzilQq1AtgC9likIp8XJFsSZzjmo0z8M9IvwduJg34Op8D0jst1EmnjA00C3wRPaUv'; // pk_live_... or pk_test_...
const STRIPE_URL = 'https://buy.stripe.com/7sY28s02p6Bw7zggrg1ZS0u';    // buy.stripe.com/... (fallback)
const STRIPE_FEE = 6.00;                                      // flat $6 transaction fee

/* ════════════════════════════════════════════════════
   CART
════════════════════════════════════════════════════ */

let cart = [];
try { cart = JSON.parse(localStorage.getItem('prml_cart') || '[]'); } catch(e) { cart = []; }

function saveCart()            { try { localStorage.setItem('prml_cart', JSON.stringify(cart)); } catch(e) {} }
function addToCart(item)       { cart.push(item); saveCart(); updateCartUI(); openCart(); }
function removeFromCart(idx)   { cart.splice(idx, 1); saveCart(); updateCartUI(); }
function clearCart()           { cart = []; saveCart(); updateCartUI(); }
function getCartSubtotal()     { return cart.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0); }
function getCartTotal()        { return getCartSubtotal() + STRIPE_FEE; }
function getDepositAmount()    { return getCartTotal() * 0.5; }

function updateCartUI() {
  const count = cart.length;

  // Badge counts
  document.querySelectorAll('.cart-count').forEach(el => el.textContent = count || '');

  const itemsEl = document.querySelector('.cart-items');
  const totalEl = document.querySelector('.cart-total');
  const feeEl   = document.querySelector('.cart-fee');
  const subEl   = document.querySelector('.cart-subtotal');
  if (!itemsEl) return;

  if (count === 0) {
    itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
    if (totalEl) totalEl.textContent = '$0.00';
    if (subEl)   subEl.textContent   = '$0.00';
    if (feeEl)   feeEl.style.display = 'none';
    document.querySelectorAll('.cart-checkout, .cart-deposit').forEach(b => b.disabled = true);
    return;
  }

  itemsEl.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item__name">${item.name}</div>
        ${item.desc ? `<div class="cart-item__desc">${item.desc}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="cart-item__price">$${parseFloat(item.price).toFixed(2)}</div>
        <div class="cart-item__remove" onclick="removeFromCart(${i})">×</div>
      </div>
    </div>`).join('');

  const sub   = getCartSubtotal();
  const total = getCartTotal();

  if (subEl)   subEl.textContent   = '$' + sub.toFixed(2);
  if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  if (feeEl) {
    feeEl.style.display = 'flex';
    feeEl.innerHTML = `<span>Processing fee</span><span>$${STRIPE_FEE.toFixed(2)}</span>`;
  }

  document.querySelectorAll('.cart-checkout, .cart-deposit').forEach(b => b.disabled = false);
}

function openCart()  { document.querySelector('.cart-panel')?.classList.add('open'); }
function closeCart() { document.querySelector('.cart-panel')?.classList.remove('open'); }

/* ════════════════════════════════════════════════════
   STRIPE CHECKOUT
   Static site flow:
   1. Log order to Google Sheet (always)
   2. Try Stripe.js redirectToCheckout if pk available
   3. Fall back to Payment Link with cart summary in URL
   4. Fall back to payment modal (call/text/Zelle)
════════════════════════════════════════════════════ */

let _stripeInstance = null;

function loadStripeJS() {
  return new Promise((resolve) => {
    if (window.Stripe) { resolve(window.Stripe); return; }
    const s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = () => resolve(window.Stripe);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

async function getStripe() {
  if (_stripeInstance) return _stripeInstance;
  if (!STRIPE_PK || STRIPE_PK.includes('PASTE_YOUR')) return null;
  const Stripe = await loadStripeJS();
  if (!Stripe) return null;
  _stripeInstance = Stripe(STRIPE_PK);
  return _stripeInstance;
}

async function stripeCheckout(depositOnly = false) {
  if (cart.length === 0) { alert('Your cart is empty.'); return; }

  const btns = document.querySelectorAll('.cart-checkout, .cart-deposit');
  btns.forEach(b => { b.disabled = true; b.textContent = 'Please wait...'; });

  const sub    = getCartSubtotal();
  const total  = getCartTotal();
  const amount = depositOnly ? getDepositAmount() : total;
  const label  = depositOnly ? '50% Deposit' : 'Full Payment';
  const items  = cart.map(i => `${i.name} — $${parseFloat(i.price).toFixed(2)}`).join('\n');
  const amountCents = Math.round(amount * 100);

  // ── Step 1: Log order to Google Sheet ──────────────
  if (GAS_URL && !GAS_URL.includes('PASTE_YOUR')) {
    fetch(GAS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:       'ORDER',
        ts:         new Date().toISOString(),
        items,
        subtotal:   sub.toFixed(2),
        stripe_fee: STRIPE_FEE.toFixed(2),
        total:      total.toFixed(2),
        amount_due: amount.toFixed(2),
        pay_type:   label,
        source:     'Website Cart'
      })
    }).catch(() => {});
  }

  // ── Step 2: Stripe Payment Link (recommended for static sites) ──
  // Stripe.js embedded checkout requires a server to create sessions.
  // Payment Links work 100% client-side with no backend needed.
  if (STRIPE_URL && !STRIPE_URL.includes('PASTE_YOUR')) {
    try {
      const url = new URL(STRIPE_URL);

      // Pass cart summary as metadata via URL params
      // Stripe will show this in your dashboard for each payment
      url.searchParams.set('client_reference_id', 'cart-' + Date.now());

      // For Payment Links with variable pricing, append the amount
      // This works if your Payment Link is set to "customer chooses price"
      // url.searchParams.set('prefilled_amount', amountCents); // uncomment if needed

      // Open Stripe checkout in the same tab for better mobile UX
      window.location.href = url.toString();
      return; // don't re-enable buttons — page is navigating away
    } catch(e) {
      // URL construction failed — fall through to modal
    }
  }

  // ── Step 3: Stripe.js direct checkout ──────────────
  // Used if you later add a backend that creates Checkout Sessions
  // Uncomment and wire up /api/create-checkout-session when ready:
  /*
  const stripe = await getStripe();
  if (stripe) {
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, label, items, depositOnly })
      });
      const { sessionId, error } = await res.json();
      if (error) throw new Error(error);
      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });
      if (redirectError) throw new Error(redirectError.message);
      return;
    } catch(e) {
      console.warn('Stripe session checkout failed:', e.message);
      // fall through to modal
    }
  }
  */

  // ── Step 4: Fallback modal — no sale lost ──────────
  btns.forEach(b => {
    b.disabled = false;
    b.textContent = b.classList.contains('cart-deposit') ? 'Pay 50% Deposit' : 'Checkout →';
  });
  showPaymentModal(items, sub, total, amount, label);
}

function showPaymentModal(items, sub, total, amount, label) {
  const existing = document.getElementById('prml-pay-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'prml-pay-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#2B2B2B;padding:36px;max-width:480px;width:100%;border-top:4px solid #E01010;font-family:'Roboto Slab',serif;max-height:90vh;overflow-y:auto">
      <div style="font-family:'Rubik Mono One',monospace;font-size:22px;color:#E01010;margin-bottom:4px">Complete Your Order</div>
      <div style="font-size:11px;color:#F5E6C8;opacity:.4;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px">PRML Records LLC · West End Atlanta</div>

      <div style="font-size:13px;color:#F5E6C8;opacity:.65;white-space:pre-line;margin-bottom:16px;line-height:1.9;background:rgba(245,230,200,.04);padding:14px">${items}</div>

      <div style="border-top:1px solid rgba(245,230,200,.1);padding:14px 0;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#F5E6C8;opacity:.5;margin-bottom:6px">
          <span>Subtotal</span><span>$${sub.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:#F5E6C8;opacity:.5;margin-bottom:10px">
          <span>Processing fee</span><span>$${STRIPE_FEE.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:'Rubik Mono One',monospace;font-size:22px;color:#E01010">
          <span>${label}</span><span>$${amount.toFixed(2)}</span>
        </div>
      </div>

      <div style="background:rgba(224,16,16,.08);border-left:3px solid #E01010;padding:14px;font-size:13px;color:#F5E6C8;line-height:1.9;margin-bottom:20px">
        <strong style="font-family:'Odibee Sans',sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#E01010;display:block;margin-bottom:8px">How to Pay</strong>
        📞 Call / text: <strong>770-686-7726</strong><br>
        📧 Email: <strong>info@prmlrecords.com</strong><br>
        💸 We accept Cash App, Zelle, Venmo, and card over phone.
      </div>

      <div style="display:flex;gap:10px">
        <a href="tel:7706867726"
           style="flex:1;background:#E01010;color:#F5E6C8;padding:13px;text-align:center;font-family:'Odibee Sans',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;display:block">
          Call Now
        </a>
        <a href="sms:7706867726"
           style="flex:1;background:transparent;border:1px solid rgba(245,230,200,.2);color:#F5E6C8;padding:13px;text-align:center;font-family:'Odibee Sans',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;display:block">
          Text Us
        </a>
        <button onclick="document.getElementById('prml-pay-modal').remove()"
                style="background:transparent;border:1px solid rgba(245,230,200,.15);color:#F5E6C8;padding:13px 16px;font-family:'Odibee Sans',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer">
          ×
        </button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

/* ════════════════════════════════════════════════════
   STRIPE: COLLECT CUSTOMER INFO BEFORE CHECKOUT
   Pops a form to capture name/email before sending
   to Stripe — links payment to customer record in Sheet
════════════════════════════════════════════════════ */

function collectAndCheckout(depositOnly = false) {
  if (cart.length === 0) { alert('Your cart is empty.'); return; }

  const existing = document.getElementById('prml-cust-modal');
  if (existing) { existing.remove(); }

  const modal = document.createElement('div');
  modal.id = 'prml-cust-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px';

  const total  = depositOnly ? getDepositAmount() : getCartTotal();
  const label  = depositOnly ? `Pay 50% Deposit — $${total.toFixed(2)}` : `Checkout — $${total.toFixed(2)}`;

  modal.innerHTML = `
    <div style="background:#2B2B2B;padding:36px;max-width:440px;width:100%;border-top:4px solid #E01010;font-family:'Roboto Slab',serif">
      <div style="font-family:'Rubik Mono One',monospace;font-size:20px;color:#E01010;margin-bottom:4px">Almost There</div>
      <div style="font-size:11px;color:#F5E6C8;opacity:.4;letter-spacing:3px;text-transform:uppercase;margin-bottom:24px">Enter your info to continue</div>

      <div style="margin-bottom:14px">
        <label style="font-family:'Odibee Sans',sans-serif;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E01010;display:block;margin-bottom:7px">Full Name *</label>
        <input id="cust-name-inp" type="text" placeholder="Your name"
               style="background:rgba(245,230,200,.06);border:1.5px solid rgba(245,230,200,.15);color:#F5E6C8;font-family:'Roboto Slab',serif;font-size:13px;padding:11px 14px;width:100%;outline:none">
      </div>
      <div style="margin-bottom:14px">
        <label style="font-family:'Odibee Sans',sans-serif;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E01010;display:block;margin-bottom:7px">Email *</label>
        <input id="cust-email-inp" type="email" placeholder="your@email.com"
               style="background:rgba(245,230,200,.06);border:1.5px solid rgba(245,230,200,.15);color:#F5E6C8;font-family:'Roboto Slab',serif;font-size:13px;padding:11px 14px;width:100%;outline:none">
      </div>
      <div style="margin-bottom:20px">
        <label style="font-family:'Odibee Sans',sans-serif;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#E01010;display:block;margin-bottom:7px">Phone (optional)</label>
        <input id="cust-phone-inp" type="tel" placeholder="770-000-0000"
               style="background:rgba(245,230,200,.06);border:1.5px solid rgba(245,230,200,.15);color:#F5E6C8;font-family:'Roboto Slab',serif;font-size:13px;padding:11px 14px;width:100%;outline:none">
      </div>

      <div style="display:flex;gap:10px">
        <button id="cust-proceed-btn" onclick="proceedToStripe(${depositOnly})"
                style="flex:1;background:#E01010;color:#F5E6C8;padding:13px;font-family:'Odibee Sans',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;border:none;cursor:pointer">
          ${label} →
        </button>
        <button onclick="document.getElementById('prml-cust-modal').remove()"
                style="background:transparent;border:1px solid rgba(245,230,200,.2);color:#F5E6C8;padding:13px 16px;font-family:'Odibee Sans',sans-serif;font-size:11px;letter-spacing:2px;cursor:pointer">
          ×
        </button>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('cust-name-inp').focus();
}

async function proceedToStripe(depositOnly) {
  const name  = document.getElementById('cust-name-inp')?.value.trim();
  const email = document.getElementById('cust-email-inp')?.value.trim();
  const phone = document.getElementById('cust-phone-inp')?.value.trim();

  if (!name)  { document.getElementById('cust-name-inp').style.borderColor='#E01010';  return; }
  if (!email) { document.getElementById('cust-email-inp').style.borderColor='#E01010'; return; }

  const btn = document.getElementById('cust-proceed-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to payment...'; }

  const sub    = getCartSubtotal();
  const total  = getCartTotal();
  const amount = depositOnly ? getDepositAmount() : total;
  const label  = depositOnly ? '50% Deposit' : 'Full Payment';
  const items  = cart.map(i => `${i.name} — $${parseFloat(i.price).toFixed(2)}`).join('\n');

  // Log to Sheet with customer info attached
  if (GAS_URL && !GAS_URL.includes('PASTE_YOUR')) {
    fetch(GAS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:            'ORDER',
        ts:              new Date().toISOString(),
        customer_name:   name,
        customer_email:  email,
        customer_phone:  phone,
        items,
        subtotal:        sub.toFixed(2),
        stripe_fee:      STRIPE_FEE.toFixed(2),
        total:           total.toFixed(2),
        amount_due:      amount.toFixed(2),
        pay_type:        label,
        source:          'Website Cart'
      })
    }).catch(() => {});
  }

  // Close customer info modal
  document.getElementById('prml-cust-modal')?.remove();

  // Send to Stripe Payment Link
  if (STRIPE_URL && !STRIPE_URL.includes('PASTE_YOUR')) {
    try {
      const url = new URL(STRIPE_URL);
      // Prefill customer email in Stripe checkout if supported
      if (email) url.searchParams.set('prefilled_email', email);
      url.searchParams.set('client_reference_id', 'cart-' + Date.now());
      window.location.href = url.toString();
      return;
    } catch(e) {}
  }

  // Fallback: no Stripe configured
  showPaymentModal(items, sub, total, amount, label);
}

/* ════════════════════════════════════════════════════
   NAV
════════════════════════════════════════════════════ */

function goTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  closeMob();
}
function toggleMob() { document.getElementById('mob')?.classList.toggle('open'); }
function closeMob()  { document.getElementById('mob')?.classList.remove('open'); }

/* ── Nav Dropdowns ── */
(function initNavDropdowns() {
  document.addEventListener('DOMContentLoaded', function() {
    // Dropdowns: closed by default, open on hover (desktop) or tap (mobile)
    document.querySelectorAll('.nl--has-drop').forEach(function(item) {
      var drop = item.querySelector('.nl__drop');
      if (!drop) return;
      var closeTimer;

      // Desktop: hover
      item.addEventListener('mouseenter', function() {
        clearTimeout(closeTimer);
        document.querySelectorAll('.nl__drop').forEach(function(d) { if (d !== drop) d.classList.remove('open'); });
        drop.classList.add('open');
      });
      item.addEventListener('mouseleave', function() {
        closeTimer = setTimeout(function() { drop.classList.remove('open'); }, 120);
      });
      drop.addEventListener('mouseenter', function() { clearTimeout(closeTimer); });
      drop.addEventListener('mouseleave', function() { closeTimer = setTimeout(function() { drop.classList.remove('open'); }, 120); });

      // Mobile/tap: toggle on click of parent link
      item.addEventListener('click', function(e) {
        if (window.innerWidth <= 900) {
          e.preventDefault();
          var isOpen = drop.classList.contains('open');
          document.querySelectorAll('.nl__drop').forEach(function(d) { d.classList.remove('open'); });
          if (!isOpen) drop.classList.add('open');
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.nl--has-drop')) {
        document.querySelectorAll('.nl__drop').forEach(function(d) { d.classList.remove('open'); });
      }
    });
  });
})();

/* ════════════════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════════════════ */

function initReveal() {
  const ro = new IntersectionObserver(
    entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); }),
    { threshold: 0.07 }
  );
  document.querySelectorAll('.rev').forEach(el => ro.observe(el));
}

/* ════════════════════════════════════════════════════
   FAQ ACCORDION
════════════════════════════════════════════════════ */

function toggleFAQ(q) {
  const isOpen = q.classList.contains('open');
  document.querySelectorAll('.faq-q').forEach(x => {
    x.classList.remove('open');
    x.nextElementSibling?.classList.remove('open');
  });
  if (!isOpen) {
    q.classList.add('open');
    q.nextElementSibling?.classList.add('open');
  }
}
function initFAQ() {
  document.querySelectorAll('.faq-q').forEach(q => q.addEventListener('click', () => toggleFAQ(q)));
}

/* ════════════════════════════════════════════════════
   CONTACT / SUPPORT FORMS
════════════════════════════════════════════════════ */

async function submitForm(formId, btnId, okId, errId) {
  const form = document.getElementById(formId);
  const btn  = document.getElementById(btnId);
  const ok   = document.getElementById(okId);
  const err  = document.getElementById(errId);
  if (!form || !btn) return;

  btn.disabled    = true;
  btn.textContent = 'Sending...';
  if (ok)  ok.style.display  = 'none';
  if (err) err.style.display = 'none';

  const fd   = new FormData(form);
  const data = { type: 'INQUIRY', ts: new Date().toISOString() };
  fd.forEach((v, k) => data[k] = v);

  if (!GAS_URL || GAS_URL.includes('PASTE_YOUR')) {
    if (ok) { ok.textContent = '✓ Received! We reply within 24 hours. You can also call 770-686-7726.'; ok.style.display = 'block'; }
    btn.disabled = false; btn.textContent = 'Send →';
    form.reset();
    return;
  }

  try {
    await fetch(GAS_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (ok) ok.style.display = 'block';
    form.reset();
  } catch(e) {
    if (err) err.style.display = 'block';
  }
  btn.disabled = false; btn.textContent = 'Send →';
}

/* ════════════════════════════════════════════════════
   EMAIL SIGNUP
════════════════════════════════════════════════════ */

async function submitEmail(e) {
  e.preventDefault();
  const inp = document.getElementById('email-in');
  const btn = document.getElementById('email-btn');
  if (!inp || !btn) return;
  const data = { type: 'EMAIL', email: inp.value.trim(), ts: new Date().toISOString() };
  btn.textContent = '...'; btn.disabled = true;
  if (GAS_URL && !GAS_URL.includes('PASTE_YOUR')) {
    try { await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); } catch(e) {}
  }
  btn.textContent = '✓ Joined!'; inp.value = '';
  setTimeout(() => { btn.textContent = 'Join →'; btn.disabled = false; }, 3500);
}

/* ════════════════════════════════════════════════════
   DYNAMIC CONTENT — GAS FETCH HELPERS
   Blog, Services, Goals, Grants pages
════════════════════════════════════════════════════ */

const SITE_URL = 'https://prmlrecords.com';

async function gasGet(action, params = {}) {
  if (!GAS_URL || GAS_URL.includes('PASTE_YOUR')) return null;
  const qs = new URLSearchParams({ action, ...params }).toString();
  try {
    const r = await fetch(`${GAS_URL}?${qs}`);
    return await r.json();
  } catch(e) {
    console.warn('GAS fetch failed:', action, e);
    return null;
  }
}

async function loadFeaturedPosts(containerId = 'featured-posts', limit = 3) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const data = await gasGet('getPosts', { limit, published: true });
  if (!data || !data.posts?.length) {
    el.innerHTML = '<p style="opacity:.4;font-family:\'Roboto Slab\',serif;font-size:13px">No posts yet.</p>';
    return;
  }
  el.innerHTML = data.posts.map(p => `
    <a class="blog-card" href="/blog/${p.slug}.html" style="display:block;text-decoration:none">
      ${p.image ? `<div class="bc-img" style="background-image:url('${p.image}')"></div>` : '<div class="bc-img bc-img--empty"></div>'}
      <div class="bc-body">
        <div class="bc-cat">${p.category || 'Update'}</div>
        <div class="bc-title">${p.title}</div>
        <div class="bc-excerpt">${p.excerpt || ''}</div>
        <div class="bc-date">${p.date || ''}</div>
      </div>
    </a>`).join('');
}

async function loadServices(containerId, category) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const data = await gasGet('getServices', { category });
  if (!data || !data.services?.length) return;
  el.innerHTML = data.services
    .filter(s => s.active !== 'FALSE' && s.active !== false)
    .map(s => `
      <div class="card">
        <div class="card__title">${s.service}</div>
        <div class="card__desc">${s.description || ''}</div>
        <div class="card__price">${s.price ? '$' + s.price : ''}</div>
        <button class="btn btn--red btn--sm" style="margin-top:16px"
          onclick="collectAndCheckout(); addToCart({name:'${s.service.replace(/'/g,"\\'")}',price:'${s.price||0}',desc:'${(s.description||'').replace(/'/g,"\\'")}'})"
        >Add to Cart</button>
      </div>`).join('');
}

async function loadAllPosts(containerId = 'all-posts') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="opacity:.4;font-size:13px;padding:20px">Loading posts...</div>';
  const data = await gasGet('getPosts', { limit: 50, published: true });
  if (!data || !data.posts?.length) {
    el.innerHTML = '<p style="opacity:.4;font-size:14px;padding:20px 0">No posts published yet.</p>';
    return;
  }
  el.innerHTML = data.posts.map(p => `
    <article class="blog-list-item">
      <a href="/blog/${p.slug}.html" class="bli-title">${p.title}</a>
      <div class="bli-meta">${p.date || ''} ${p.category ? '· ' + p.category : ''} ${p.author ? '· ' + p.author : ''}</div>
      <p class="bli-excerpt">${p.excerpt || ''}</p>
    </article>`).join('');
}

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initFAQ();
  updateCartUI();

  // Preload Stripe.js in background so checkout is instant
  if (STRIPE_PK && !STRIPE_PK.includes('PASTE_YOUR')) {
    loadStripeJS().catch(() => {});
  }

  // Mark active nav link
  const page = location.pathname.replace(/\/$/, '').split('/').pop() || 'index.html';
  document.querySelectorAll('a.nl[href]').forEach(a => {
    const href = a.getAttribute('href').split('?')[0];
    if (href === page || (page === '' && href === 'index.html')) a.classList.add('active');
  });
});
