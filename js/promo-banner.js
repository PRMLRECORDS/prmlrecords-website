/* ============================================================
   PRML RECORDS — PROMO BANNER + DISCOUNT URL CAPTURE
   ------------------------------------------------------------
   Reads /js/promo-config.json on every page load. Renders the
   active promo banner above .nav2.

   Two responsibilities:
   1. RENDER BANNER for the active_promo (with optional live
      counter from /api/promo-status — falls back to config value)
   2. CAPTURE `?promo=CODE` URL param on landing, store in
      localStorage('prml_promo_code'), so the checkout page can
      auto-apply the discount when the customer pays.

   Brand-locked themes only (Red, Charcoal, Cream, Stone).
   Skips render if config.active_promo === "off".
   ============================================================ */

(function () {
  'use strict';

  // ─── 1. CAPTURE promo code from URL (every page load) ────────────────────
  try {
    var params = new URLSearchParams(window.location.search);
    var promoFromUrl = params.get('promo');
    if (promoFromUrl) {
      var clean = String(promoFromUrl).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
      if (clean) {
        localStorage.setItem('prml_promo_code', clean);
        localStorage.setItem('prml_promo_captured_at', String(Date.now()));
      }
    }
  } catch (e) { /* localStorage may be blocked — ignore */ }

  // ─── 2. RESOLVE config URL relative to current page depth ────────────────
  var depth = (window.location.pathname.replace(/\/+$/, '').split('/').length - 2);
  var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
  var configUrl = prefix + 'js/promo-config.json';

  // ─── 3. FETCH config and render ──────────────────────────────────────────
  fetch(configUrl, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.active_promo || cfg.active_promo === 'off') return;
      var promo = cfg.promos[cfg.active_promo];
      if (!promo || !promo.headline) return;

      // Date window
      var now = new Date();
      if (promo.starts_at && new Date(promo.starts_at) > now) return;
      if (promo.ends_at && new Date(promo.ends_at) < now) return;

      // Page filter
      var page = window.location.pathname.replace(/^\/+/, '').replace(/^\/?$/, 'index.html');
      var hideOn = promo.hide_on || [];
      for (var i = 0; i < hideOn.length; i++) {
        if (page.indexOf(hideOn[i]) !== -1) return;
      }

      // Theme
      var theme = (cfg.themes && cfg.themes[promo.theme]) || cfg.themes['red-on-cream'];

      injectCss();
      var banner = renderBanner(promo, theme, prefix);
      mount(banner);

      // Expose for analytics / debugging / checkout
      window.PRML_ACTIVE_PROMO = {
        key: cfg.active_promo,
        label: promo.label,
        coupon: promo.stripe_coupon_code || null,
        auto_apply_url: promo.auto_apply_url || null
      };

      // Live counter — fetch async, update in place
      if (promo.live_counter && promo.stripe_coupon_code && cfg.checkout_api_base) {
        fetchLiveCounter(cfg.checkout_api_base, promo.stripe_coupon_code, banner);
      }
    })
    .catch(function (err) {
      if (window.console && console.warn) console.warn('PRML promo banner: ', err);
    });

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  function injectCss() {
    if (document.getElementById('prml-promo-banner-css')) return;
    var css = document.createElement('style');
    css.id = 'prml-promo-banner-css';
    css.textContent =
      '.prml-promo{padding:14px 5vw;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}' +
      '.prml-promo__msg{font-family:"Odibee Sans",sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase}' +
      '.prml-promo__sub{font-family:"Roboto Slab",serif;font-size:11px;font-weight:300;opacity:.75;margin-top:4px}' +
      '.prml-promo__right{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
      '.prml-promo__counter{font-family:"Rubik Mono One",monospace;font-size:28px;letter-spacing:-1px;line-height:1;transition:opacity .3s}' +
      '.prml-promo__counter.loading{opacity:.5}' +
      '.prml-promo__counter-sub{font-family:"Roboto Slab",serif;font-size:10px;font-weight:300;opacity:.75;text-align:right;text-transform:uppercase;letter-spacing:2px;margin-top:2px}' +
      '.prml-promo__btn{font-family:"Odibee Sans",sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;padding:11px 22px;border:none;cursor:pointer;text-decoration:none;display:inline-block;transition:background .2s,color .2s}' +
      '@media (max-width:640px){.prml-promo{padding:12px 16px}.prml-promo__msg{font-size:11px;letter-spacing:1.5px}.prml-promo__counter{font-size:22px}}';
    document.head.appendChild(css);
  }

  function renderBanner(promo, theme, prefix) {
    var banner = document.createElement('div');
    banner.className = 'prml-promo';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Promotion: ' + (promo.label || promo.headline));
    banner.style.background = theme.bg;
    banner.style.color = theme.fg;

    var hasCounter = promo.counter_value_fallback != null || promo.live_counter;
    var counterStart = promo.counter_value_fallback != null ? promo.counter_value_fallback : '—';

    var leftHTML = '<div>' +
      '<div class="prml-promo__msg">' + escapeHtml(promo.headline) + '</div>' +
      (promo.sub ? '<div class="prml-promo__sub">' + escapeHtml(promo.sub) + '</div>' : '') +
      '</div>';

    var rightHTML = '<div class="prml-promo__right">';
    if (hasCounter) {
      rightHTML += '<div>' +
        '<div class="prml-promo__counter ' + (promo.live_counter ? 'loading' : '') + '" data-prml-counter>' +
          escapeHtml(String(counterStart)) +
        '</div>' +
        (promo.counter_text ? '<div class="prml-promo__counter-sub">' + escapeHtml(promo.counter_text) + '</div>' : '') +
        '</div>';
    }
    if (promo.cta_text && promo.cta_href) {
      rightHTML += '<a href="' + escapeAttr(prefix + promo.cta_href) + '" class="prml-promo__btn" ' +
        'style="background:' + theme.btn_bg + ';color:' + theme.btn_fg + '" ' +
        'onmouseover="this.style.background=\'' + theme.btn_hover_bg + '\';this.style.color=\'' + theme.btn_hover_fg + '\'" ' +
        'onmouseout="this.style.background=\'' + theme.btn_bg + '\';this.style.color=\'' + theme.btn_fg + '\'">' +
        escapeHtml(promo.cta_text) +
        '</a>';
    }
    rightHTML += '</div>';

    banner.innerHTML = leftHTML + rightHTML;
    return banner;
  }

  function mount(banner) {
    function go() {
      var nav = document.querySelector('.nav2');
      if (nav && nav.parentNode === document.body) {
        document.body.insertBefore(banner, nav);
      } else {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', go);
    } else {
      go();
    }
  }

  function fetchLiveCounter(apiBase, couponCode, banner) {
    var url = apiBase.replace(/\/+$/, '') + '/api/promo-status?code=' + encodeURIComponent(couponCode);
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json().catch(function(){return null;}); })
      .then(function (data) {
        if (!data) return;
        var counterEl = banner.querySelector('[data-prml-counter]');
        if (!counterEl) return;

        if (data.valid === false || data.spots_left === 0) {
          // Promo exhausted — hide the whole banner and clear stored coupon
          banner.style.display = 'none';
          try { localStorage.removeItem('prml_promo_code'); } catch (e) {}
          return;
        }

        if (data.spots_left != null) {
          counterEl.textContent = String(data.spots_left);
          counterEl.classList.remove('loading');
        }
      })
      .catch(function (err) {
        // Live fetch failed — leave fallback value showing
        if (window.console && console.warn) console.warn('PRML promo live counter:', err);
        var counterEl = banner.querySelector('[data-prml-counter]');
        if (counterEl) counterEl.classList.remove('loading');
      });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
