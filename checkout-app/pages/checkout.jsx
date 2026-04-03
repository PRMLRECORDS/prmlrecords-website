/**
 * PRML RECORDS — Checkout Page
 * prmlrecords.com/checkout
 *
 * Renders order summary, shipping form, and Stripe Payment Element.
 * Cart is read from localStorage (key: "prml_cart") set by main.js on the static site.
 * On successful payment, POSTs order data to /api/orders.
 */

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

// ── Constants ────────────────────────────────────────────────────────────────

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
const GA_TAX_RATE = 0.089;      // 8.9% Georgia sales tax
const FLAT_FEE = 6.00;          // matches STRIPE_FEE in main.js

// Delivery windows by product type keyword
const DELIVERY_WINDOWS = {
  custom:  '7–10 business days',
  pack:    '10–14 business days',
  default: '3–5 business days',
};

function getDeliveryWindow(cartItems) {
  const names = cartItems.map((i) => (i.name || '').toLowerCase()).join(' ');
  if (names.includes('custom')) return DELIVERY_WINDOWS.custom;
  if (names.includes('pack') || names.includes('10-pack')) return DELIVERY_WINDOWS.pack;
  return DELIVERY_WINDOWS.default;
}

// ── Stripe loader (singleton, outside component) ─────────────────────────────
const stripePromise = loadStripe(STRIPE_PK);

// ── Stripe appearance theme matching PRML brand ──────────────────────────────
const stripeAppearance = {
  theme: 'flat',
  variables: {
    colorPrimary:       '#E01010',
    colorBackground:    '#F5F0E8',
    colorText:          '#2C2C2C',
    colorDanger:        '#E01010',
    fontFamily:         '"Roboto Slab", serif',
    borderRadius:       '0px',
    spacingUnit:        '5px',
  },
  rules: {
    '.Input': {
      border:     '1px solid rgba(44,44,44,0.2)',
      boxShadow:  'none',
      padding:    '12px',
    },
    '.Input:focus': {
      border:     '1px solid #E01010',
      boxShadow:  'none',
      outline:    'none',
    },
    '.Label': {
      fontFamily:    '"Odibee Sans", sans-serif',
      fontSize:      '10px',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      color:         '#2C2C2C',
    },
    '.Error': {
      fontFamily: '"Roboto Slab", serif',
      fontSize:   '12px',
    },
  },
};

// ── Inner form (has access to Stripe hooks) ───────────────────────────────────
function CheckoutForm({ cart, orderMeta, onSuccess }) {
  const stripe   = useStripe();
  const elements = useElements();

  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Validate required shipping fields before hitting Stripe
    const { name, email, street, city, state, zip } = orderMeta;
    if (!name || !email || !street || !city || !state || !zip) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // Confirm payment — no redirect
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMsg(error.message || 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        // POST order data to our API route
        const res = await fetch('/api/orders', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            amount:          paymentIntent.amount, // cents
            cart,
            shipping: {
              name:   orderMeta.name,
              street: orderMeta.street,
              city:   orderMeta.city,
              state:  orderMeta.state,
              zip:    orderMeta.zip,
            },
            email:    orderMeta.email,
            delivery: orderMeta.delivery,
          }),
        });

        if (!res.ok) throw new Error('Order record failed');
        const data = await res.json();
        onSuccess(data.orderId);
      } catch (err) {
        // Payment succeeded — don't block user, just log the backend error
        console.error('Order POST failed:', err);
        onSuccess(paymentIntent.id);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element */}
      <div>
        <p className="font-label text-[10px] tracking-[3px] uppercase text-charcoal mb-3">
          Payment
        </p>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {errorMsg && (
        <p className="font-body text-sm text-red border border-red/30 bg-red/5 p-3">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="
          w-full bg-charcoal text-cream font-mono text-sm tracking-widest uppercase
          py-4 px-6 transition-colors
          hover:bg-red disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        {loading ? 'Processing…' : 'Complete Order'}
      </button>

      <p className="font-body text-[11px] text-charcoal/50 text-center">
        Payments secured by Stripe. PRML RECORDS does not store card details.
      </p>
    </form>
  );
}

// ── Main page component ───────────────────────────────────────────────────────
export default function CheckoutPage() {
  const [cart, setCart]               = useState([]);
  const [clientSecret, setClientSecret] = useState('');
  const [orderId, setOrderId]         = useState('');
  const [fetchError, setFetchError]   = useState('');

  // Shipping + contact fields
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity]   = useState('');
  const [state, setState] = useState('');
  const [zip, setZip]     = useState('');

  // ── Load cart from localStorage (set by main.js on static site) ──────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('prml_cart') || '[]');
      setCart(stored);
    } catch {
      setCart([]);
    }
  }, []);

  // ── Fetch PaymentIntent client_secret once cart is ready ─────────────────
  useEffect(() => {
    if (!cart.length) return;

    const subtotal = cart.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
    const tax      = subtotal * GA_TAX_RATE;
    const total    = subtotal + tax + FLAT_FEE;
    const amountCents = Math.round(total * 100);

    fetch('/api/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountCents }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.clientSecret) {
          setClientSecret(d.clientSecret);
        } else {
          setFetchError('Unable to initialise payment. Please refresh and try again.');
        }
      })
      .catch(() => setFetchError('Network error. Please check your connection.'));
  }, [cart]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const tax      = subtotal * GA_TAX_RATE;
  const total    = subtotal + tax + FLAT_FEE;
  const delivery = getDeliveryWindow(cart);

  // ── Success state ─────────────────────────────────────────────────────────
  if (orderId) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-charcoal flex items-center justify-center mx-auto">
            <span className="text-cream text-2xl">✓</span>
          </div>
          <h1 className="font-mono text-3xl text-charcoal tracking-tight">Order Confirmed</h1>
          <p className="font-body text-sm text-charcoal/70 leading-relaxed">
            Thank you for your order. A confirmation email is on its way.
            Estimated delivery: <strong>{delivery}</strong>.
          </p>
          <p className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/40">
            Order ref: {orderId}
          </p>
          <a
            href="https://prmlrecords.com"
            className="inline-block bg-charcoal text-cream font-mono text-xs tracking-widest uppercase py-3 px-8 hover:bg-red transition-colors"
          >
            Back to PRML RECORDS
          </a>
        </div>
      </div>
    );
  }

  // ── Empty cart guard ──────────────────────────────────────────────────────
  if (!cart.length) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="font-mono text-2xl text-charcoal">Your cart is empty.</h1>
          <a
            href="https://prmlrecords.com/products.html"
            className="inline-block bg-charcoal text-cream font-mono text-xs tracking-widest uppercase py-3 px-8 hover:bg-red transition-colors"
          >
            Shop Products
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Checkout — PRML RECORDS</title>
        <meta name="robots" content="noindex" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Odibee+Sans&family=Roboto+Slab:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen bg-cream">
        {/* ── Header ── */}
        <header className="bg-charcoal py-5 px-6">
          <a href="https://prmlrecords.com" className="font-mono text-cream text-lg tracking-tight">
            PRML RECORDS
          </a>
          <span className="font-label text-[9px] tracking-[4px] uppercase text-red ml-4">
            Checkout
          </span>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* ── LEFT: Order Summary + Shipping ── */}
          <section className="space-y-8">

            {/* Order Summary */}
            <div>
              <p className="font-label text-[10px] tracking-[4px] uppercase text-red mb-4">
                Order Summary
              </p>
              <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-start p-4">
                    <div>
                      <p className="font-body text-sm font-bold text-charcoal">{item.name}</p>
                      {item.desc && (
                        <p className="font-body text-xs text-charcoal/50 mt-0.5">{item.desc}</p>
                      )}
                      {item.qty && item.qty > 1 && (
                        <p className="font-label text-[9px] tracking-[2px] uppercase text-red mt-1">
                          Qty: {item.qty}
                        </p>
                      )}
                    </div>
                    <p className="font-mono text-sm text-charcoal whitespace-nowrap ml-4">
                      ${parseFloat(item.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 space-y-2 text-sm font-body">
                <div className="flex justify-between text-charcoal/60">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-charcoal/60">
                  <span>GA Sales Tax (8.9%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-charcoal/60">
                  <span>Shipping &amp; Handling</span>
                  <span>${FLAT_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-charcoal font-bold border-t border-charcoal/20 pt-2 mt-2">
                  <span className="font-label text-[10px] tracking-[3px] uppercase">Total</span>
                  <span className="font-mono text-base">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Estimated Delivery */}
            <div className="bg-charcoal p-4">
              <p className="font-label text-[9px] tracking-[4px] uppercase text-red mb-1">
                Estimated Delivery
              </p>
              <p className="font-mono text-cream text-sm">{delivery}</p>
              <p className="font-body text-xs text-cream/50 mt-1">
                Ships from Atlanta, GA · Custom orders require design approval
              </p>
            </div>

            {/* Shipping Address */}
            <div>
              <p className="font-label text-[10px] tracking-[4px] uppercase text-red mb-4">
                Shipping Address
              </p>
              <div className="space-y-3">
                {/* Full Name */}
                <div>
                  <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="PEACE FREEDOM"
                    className="
                      w-full border border-charcoal/20 bg-cream px-3 py-2.5
                      font-body text-sm text-charcoal placeholder:text-charcoal/30
                      focus:border-red focus:outline-none
                    "
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="
                      w-full border border-charcoal/20 bg-cream px-3 py-2.5
                      font-body text-sm text-charcoal placeholder:text-charcoal/30
                      focus:border-red focus:outline-none
                    "
                  />
                </div>

                {/* Street */}
                <div>
                  <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    required
                    autoComplete="address-line1"
                    placeholder="123 West End Ave"
                    className="
                      w-full border border-charcoal/20 bg-cream px-3 py-2.5
                      font-body text-sm text-charcoal placeholder:text-charcoal/30
                      focus:border-red focus:outline-none
                    "
                  />
                </div>

                {/* City / State / Zip — 3 columns on md+ */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      autoComplete="address-level2"
                      placeholder="Atlanta"
                      className="
                        w-full border border-charcoal/20 bg-cream px-3 py-2.5
                        font-body text-sm text-charcoal placeholder:text-charcoal/30
                        focus:border-red focus:outline-none
                      "
                    />
                  </div>
                  <div>
                    <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                      required
                      autoComplete="address-level1"
                      placeholder="GA"
                      maxLength={2}
                      className="
                        w-full border border-charcoal/20 bg-cream px-3 py-2.5
                        font-body text-sm text-charcoal placeholder:text-charcoal/30
                        focus:border-red focus:outline-none uppercase
                      "
                    />
                  </div>
                  <div>
                    <label className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/70 block mb-1">
                      ZIP *
                    </label>
                    <input
                      type="text"
                      value={zip}
                      onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      required
                      autoComplete="postal-code"
                      placeholder="30314"
                      inputMode="numeric"
                      className="
                        w-full border border-charcoal/20 bg-cream px-3 py-2.5
                        font-body text-sm text-charcoal placeholder:text-charcoal/30
                        focus:border-red focus:outline-none
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── RIGHT: Payment ── */}
          <section className="space-y-6">
            <p className="font-label text-[10px] tracking-[4px] uppercase text-red">
              Payment Details
            </p>

            {fetchError && (
              <p className="font-body text-sm text-red border border-red/30 bg-red/5 p-3">
                {fetchError}
              </p>
            )}

            {clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: stripeAppearance }}
              >
                <CheckoutForm
                  cart={cart}
                  orderMeta={{ name, email, street, city, state, zip, delivery }}
                  onSuccess={setOrderId}
                />
              </Elements>
            ) : (
              !fetchError && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-10 bg-charcoal/10" />
                  <div className="h-10 bg-charcoal/10" />
                  <div className="h-12 bg-charcoal/10" />
                </div>
              )
            )}

            {/* Trust signals */}
            <div className="border-t border-charcoal/10 pt-6 space-y-2">
              <p className="font-label text-[9px] tracking-[3px] uppercase text-charcoal/40">
                Secure Checkout
              </p>
              <p className="font-body text-xs text-charcoal/40 leading-relaxed">
                256-bit SSL · Powered by Stripe · PRML RECORDS LLC · Atlanta, GA
              </p>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
