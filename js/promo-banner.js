/* ============================================================
   PRML RECORDS — PROMO BANNER (single source of truth)
   ------------------------------------------------------------
   Reads /js/promo-config.json on every page load. Renders the
   active promo at the very top of <body> (above .nav2).
   Edit promo-config.json to change/launch/pause any promo
   site-wide — never edit per-page promo HTML.

   Brand-locked themes only (Red, Charcoal, Cream, Stone).
   Skips render if config.active_promo === "off".
   Skips render if current page is in the promo's hide_on list.
   Respects starts_at / ends_at date window.
   ============================================================ */

(function () {
  'use strict';

  // Resolve config URL relative to the page
  // (works for /, /shop.html, /blog/index.html, /lp/tap-card.html)
  var depth = (window.location.pathname.replace(/\/+$/, '').split('/').length - 2);
  var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
  var configUrl = prefix + 'js/promo-config.json';

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

      // Inject CSS once
      if (!document.getElementById('prml-promo-banner-css')) {
        var css = document.createElement('style');
        css.id = 'prml-promo-banner-css';
        css.textContent =
          '.prml-promo{padding:14px 5vw;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}' +
          '.prml-promo__msg{font-family:"Odibee Sans",sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase}' +
          '.prml-promo__sub{font-family:"Roboto Slab",serif;font-size:11px;font-weight:300;opacity:.75;margin-top:4px}' +
          '.prml-promo__right{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
          '.prml-promo__counter{font-family:"Rubik Mono One",monospace;font-size:28px;letter-spacing:-1px;line-height:1}' +
          '.prml-promo__counter-sub{font-family:"Roboto Slab",serif;font-size:10px;font-weight:300;opacity:.75;text-align:right;text-transform:uppercase;letter-spacing:2px;margin-top:2px}' +
          '.prml-promo__btn{font-family:"Odibee Sans",sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;padding:11px 22px;border:none;cursor:pointer;text-decoration:none;display:inline-block;transition:background .2s,color .2s}' +
          '@media (max-width:640px){.prml-promo{padding:12px 16px}.prml-promo__msg{font-size:11px;letter-spacing:1.5px}.prml-promo__counter{font-size:22px}}';
        document.head.appendChild(css);
      }

      // Build banner
      var banner = document.createElement('div');
      banner.className = 'prml-promo';
      banner.setAttribute('role', 'region');
      banner.setAttribute('aria-label', 'Promotion: ' + (promo.label || promo.headline));
      banner.style.background = theme.bg;
      banner.style.color = theme.fg;

      var leftHTML = '<div>' +
        '<div class="prml-promo__msg">' + escapeHtml(promo.headline) + '</div>' +
        (promo.sub ? '<div class="prml-promo__sub">' + escapeHtml(promo.sub) + '</div>' : '') +
        '</div>';

      var rightHTML = '<div class="prml-promo__right">';
      if (promo.counter_value !== null && promo.counter_value !== undefined) {
        rightHTML += '<div>' +
          '<div class="prml-promo__counter">' + promo.counter_value + '</div>' +
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

      // Mount: above .nav2, or as the first body child if nav not present yet
      function mount() {
        var nav = document.querySelector('.nav2');
        if (nav && nav.parentNode === document.body) {
          document.body.insertBefore(banner, nav);
        } else {
          document.body.insertBefore(banner, document.body.firstChild);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
      } else {
        mount();
      }

      // Expose for analytics / debugging
      window.PRML_ACTIVE_PROMO = {
        key: cfg.active_promo,
        label: promo.label,
        coupon: promo.stripe_coupon_code || null,
        discount_pct: promo.discount_pct || null,
        discount_amount: promo.discount_amount || null
      };
    })
    .catch(function (err) {
      // Silent fail — promo banner is non-critical
      if (window.console && console.warn) console.warn('PRML promo banner: ', err);
    });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
