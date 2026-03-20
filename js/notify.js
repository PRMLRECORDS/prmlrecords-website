/**
 * PRML RECORDS — Notify Me / Waitlist Module
 * Submits to Google Apps Script → Brevo-ready when key is wired
 * Usage: <div data-notify-form data-page="Affiliate Program"></div>
 */

(function(){
  'use strict';

  const GAS_URL = 'https://script.google.com/macros/s/AKfycbzlXsUJFb36zh58jc2-N54Cmfhgh4EC478OzKehJG56qeNcZRSzFmOAU4PBHEgVdzsLyQ/exec';
  // When Brevo key is ready: set window.PRML_BREVO_KEY = 'key' before this script
  const BREVO_LIST_ID = 4; // "Waitlist" list in Brevo

  function submitNotify(email, page) {
    // Track GA4 event
    if (window.gtag) {
      gtag('event', 'waitlist_signup', { page_name: page, email_domain: email.split('@')[1] });
    }

    const payload = {
      action: 'waitlist',
      email: email,
      page: page,
      ts: new Date().toISOString(),
      source: window.location.pathname
    };

    // If Brevo key is configured, use Brevo first
    if (window.PRML_BREVO_KEY) {
      return fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': window.PRML_BREVO_KEY
        },
        body: JSON.stringify({
          email: email,
          listIds: [BREVO_LIST_ID],
          attributes: { WAITLIST_PAGE: page, SIGNUP_SOURCE: window.location.pathname },
          updateEnabled: true
        })
      }).then(r => ({ ok: r.ok || r.status === 204 }))
        .catch(() => submitToGAS(payload));
    }

    return submitToGAS(payload);
  }

  function submitToGAS(payload) {
    return fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(() => ({ ok: true }));
  }

  // Auto-mount all [data-notify-form] elements
  document.querySelectorAll('[data-notify-form]').forEach(function(container) {
    var page = container.dataset.page || document.title;
    container.innerHTML =
      '<div class="notify-wrap">' +
        '<div class="notify-eyebrow">— BE FIRST TO KNOW —</div>' +
        '<p class="notify-text">This page is on its way. Drop your email and we\'ll notify you the moment it goes live.</p>' +
        '<form class="notify-form" novalidate>' +
          '<input class="notify-input" type="email" placeholder="your@email.com" required autocomplete="email">' +
          '<button class="notify-btn" type="submit">NOTIFY ME</button>' +
        '</form>' +
        '<p class="notify-success" style="display:none">&#10003; You\'re on the list. We\'ll reach out when this page goes live.</p>' +
        '<p class="notify-error" style="display:none">Something went wrong. Try again.</p>' +
        '<p class="notify-fine">No spam. One email when it\'s ready. Unsubscribe anytime.</p>' +
      '</div>';

    var form = container.querySelector('.notify-form');
    var input = container.querySelector('.notify-input');
    var btn = container.querySelector('.notify-btn');
    var success = container.querySelector('.notify-success');
    var error = container.querySelector('.notify-error');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.borderColor = '#FE0103';
        return;
      }
      btn.textContent = 'SAVING...';
      btn.disabled = true;
      input.disabled = true;

      submitNotify(email, page)
        .then(function(res) {
          form.style.display = 'none';
          success.style.display = 'block';
        })
        .catch(function() {
          btn.textContent = 'NOTIFY ME';
          btn.disabled = false;
          input.disabled = false;
          error.style.display = 'block';
        });
    });
  });
})();
