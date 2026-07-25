/* ============================================================
   PRML RECORDS - ADMIN AUTH v2
   ------------------------------------------------------------
   Replaces the old plaintext-password admin auth. Now uses:
     - SHA-256 hash (no readable password in source)
     - Idle timeout (30 minutes of no activity = sign out)
     - Absolute session cap (8 hours, then re-auth required)
     - Activity tracking (mouse/key/touch/scroll resets the timer)
     - Cross-tab session via localStorage
     - In-page password rotation (window.PRMLAdmin.rotatePassword)

   Backward compat:
     - The old global functions tryLogin() and initAdmin() still work.
     - If a page has its own <div id="login-screen">, it's hidden.
     - onAdminReady callback is still called when auth passes.

   To rotate the password for everyone:
     1. Open any admin page, run in the browser console:
          await PRMLAdmin.rotatePassword('newPasswordHere')
     2. Copy the returned hash from the result.
     3. Replace SECRET_HASH below with the new hash + redeploy.
   ============================================================ */

(function () {
  'use strict';

  // -- Configuration -------------------------------------------------------
  // SHA-256 of the starter password. Rotate via PRMLAdmin.rotatePassword()
  // then paste the new hash here for permanence across browsers/devices.
  var SECRET_HASH = 'bca91f3f328c87d506954749a0bcd0b2ef3e15c6d9b342268e63176fde33e0cd';

  var SESSION_KEY        = 'prml_admin_session';
  var HASH_OVERRIDE_KEY  = 'prml_admin_pw_hash';
  var IDLE_TIMEOUT_MIN   = 30;        // sign out after 30 min no activity
  var SESSION_TTL_MIN    = 8 * 60;    // absolute max session 8 hours
  var ACTIVITY_BUMP_MIN  = 1;         // throttle activity bumps to once/min
  var CHECK_INTERVAL_MS  = 30 * 1000; // check expiry every 30s

  // -- Helpers -------------------------------------------------------------
  function nowMin() { return Math.floor(Date.now() / 60000); }

  async function sha256Hex(s) {
    var buf = new TextEncoder().encode(s);
    var hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function currentHash() {
    try { return localStorage.getItem(HASH_OVERRIDE_KEY) || SECRET_HASH; }
    catch (e) { return SECRET_HASH; }
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.hash || s.expires_at == null || s.absolute_expires_at == null) return null;
      return s;
    } catch (e) { return null; }
  }

  function setSession(hash) {
    try {
      var now = nowMin();
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        hash: hash,
        expires_at: now + IDLE_TIMEOUT_MIN,
        absolute_expires_at: now + SESSION_TTL_MIN,
        created_at: now,
      }));
    } catch (e) {}
  }

  function bumpSession() {
    var s = getSession();
    if (!s) return;
    s.expires_at = nowMin() + IDLE_TIMEOUT_MIN;
    if (s.expires_at > s.absolute_expires_at) s.expires_at = s.absolute_expires_at;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function isValidSession() {
    var s = getSession();
    if (!s) return false;
    var now = nowMin();
    if (now >= s.expires_at) return false;
    if (now >= s.absolute_expires_at) return false;
    if (s.hash !== currentHash()) return false;
    return true;
  }

  function getRemainingMinutes() {
    var s = getSession();
    if (!s) return 0;
    var now = nowMin();
    return Math.max(0, Math.min(s.expires_at, s.absolute_expires_at) - now);
  }

  // -- Activity tracking ---------------------------------------------------
  var lastBumpMs = 0;
  var idleCheckTimer = null;

  function onActivity() {
    var now = Date.now();
    if (now - lastBumpMs < ACTIVITY_BUMP_MIN * 60000) return;
    lastBumpMs = now;
    bumpSession();
  }

  function startActivityTracking() {
    var events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(function (e) {
      document.addEventListener(e, onActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkSession();
    });
    window.addEventListener('focus', checkSession);

    if (idleCheckTimer) clearInterval(idleCheckTimer);
    idleCheckTimer = setInterval(checkSession, CHECK_INTERVAL_MS);
  }

  function checkSession() {
    if (!isValidSession()) {
      var s = getSession();
      var reason = !s ? 'You are signed out.'
        : nowMin() >= s.absolute_expires_at ? 'Maximum session length reached. Sign in again to continue.'
        : 'Signed out for inactivity. Sign in again to continue.';
      clearSession();
      showLoginOverlay(reason);
    }
  }

  // -- Overlay UI ----------------------------------------------------------
  function ensureOverlay() {
    var overlay = document.getElementById('prml-admin-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'prml-admin-overlay';
    overlay.innerHTML = [
      '<style>',
        '#prml-admin-overlay{position:fixed;inset:0;background:#2B2B2B;display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:\'Roboto Slab\',Georgia,serif}',
        '#prml-admin-overlay .pa-card{background:#F5E6C8;color:#2B2B2B;max-width:440px;width:90%;padding:40px 36px;border-top:6px solid #E01010;box-shadow:0 20px 80px rgba(0,0,0,.5)}',
        '#prml-admin-overlay .pa-brand{font-family:\'Odibee Sans\',sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#E01010;margin-bottom:22px}',
        '#prml-admin-overlay h1{font-family:\'Rubik Mono One\',Arial Black,sans-serif;font-size:26px;letter-spacing:-.5px;margin:0 0 8px;color:#2B2B2B}',
        '#prml-admin-overlay #pa-msg{font-size:13px;line-height:1.6;opacity:.75;margin-bottom:22px}',
        '#prml-admin-overlay input{display:block;width:100%;padding:13px 14px;font-family:\'SF Mono\',Menlo,Consolas,monospace;font-size:15px;border:1px solid rgba(43,43,43,.25);background:#FAF7F0;color:#2B2B2B;outline:none;margin-bottom:14px;box-sizing:border-box}',
        '#prml-admin-overlay input:focus{border-color:#E01010}',
        '#prml-admin-overlay button{width:100%;padding:14px 0;font-family:\'Odibee Sans\',sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;background:#E01010;color:#F5E6C8;border:none;cursor:pointer;transition:background .2s}',
        '#prml-admin-overlay button:hover{background:#2B2B2B}',
        '#prml-admin-overlay #pa-err{color:#E01010;font-size:12px;min-height:16px;margin-top:10px}',
        '#prml-admin-overlay .pa-foot{margin-top:18px;font-family:\'Odibee Sans\',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#2B2B2B;opacity:.45;text-align:center}',
      '</style>',
      '<div class="pa-card">',
        '<div class="pa-brand">PRML RECORDS ADMIN</div>',
        '<h1>Sign In</h1>',
        '<div id="pa-msg">Enter your admin password to continue.</div>',
        '<input type="password" id="pa-pw" placeholder="password" autocomplete="current-password">',
        '<button id="pa-submit" type="button">Unlock Admin</button>',
        '<div id="pa-err"></div>',
        '<div class="pa-foot">SHA-256 verified &middot; idle timeout 30 min &middot; absolute max 8 hr</div>',
      '</div>',
    ].join('');

    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.appendChild(overlay);
      });
    }

    // Wire submit
    var submit = async function () {
      var pwEl  = document.getElementById('pa-pw');
      var errEl = document.getElementById('pa-err');
      var pw = pwEl ? pwEl.value : '';
      if (errEl) errEl.textContent = '';
      if (!pw) { if (errEl) errEl.textContent = 'Enter your password.'; return; }
      try {
        var hash = await sha256Hex(pw);
        if (hash !== currentHash()) {
          if (errEl) errEl.textContent = 'Incorrect password.';
          if (pwEl)  pwEl.value = '';
          return;
        }
        setSession(hash);
        hideLoginOverlay();
        if (typeof window.onAdminReady === 'function') {
          try { window.onAdminReady(); } catch (e) {}
        }
      } catch (e) {
        if (errEl) errEl.textContent = 'Browser does not support SHA-256.';
      }
    };

    overlay.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'pa-submit') submit();
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.target && e.target.id === 'pa-pw' && e.key === 'Enter') submit();
    });

    return overlay;
  }

  function showLoginOverlay(message) {
    var overlay = ensureOverlay();
    overlay.style.display = 'flex';
    if (message) {
      var msg = document.getElementById('pa-msg');
      if (msg) msg.textContent = message;
    }
    setTimeout(function () {
      var pw = document.getElementById('pa-pw');
      if (pw) pw.focus();
    }, 30);

    // Hide any legacy <div id="login-screen"> the page might already render
    var legacy = document.getElementById('login-screen');
    if (legacy) legacy.style.display = 'none';
  }

  function hideLoginOverlay() {
    var overlay = document.getElementById('prml-admin-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // -- Backward-compatible globals -----------------------------------------
  window.tryLogin = async function () {
    var pwEl = document.getElementById('pw');
    if (!pwEl) return;
    var hash = await sha256Hex(pwEl.value || '');
    if (hash === currentHash()) {
      setSession(hash);
      var legacy = document.getElementById('login-screen');
      if (legacy) legacy.style.display = 'none';
      hideLoginOverlay();
      if (typeof window.onAdminReady === 'function') {
        try { window.onAdminReady(); } catch (e) {}
      }
    } else {
      var err = document.getElementById('pw-err');
      if (err) err.style.display = 'block';
      pwEl.value = '';
    }
  };

  window.initAdmin = function () {
    if (isValidSession()) {
      bumpSession();
      hideLoginOverlay();
      var legacy = document.getElementById('login-screen');
      if (legacy) legacy.style.display = 'none';
      if (typeof window.onAdminReady === 'function') {
        try { window.onAdminReady(); } catch (e) {}
      }
      return true;
    }
    showLoginOverlay();
    return false;
  };

  // -- Public API ----------------------------------------------------------
  window.PRMLAdmin = {
    isAuthed: function () { return isValidSession(); },

    signOut: function () {
      clearSession();
      showLoginOverlay('You are signed out.');
    },

    rotatePassword: async function (newPw) {
      if (!newPw || newPw.length < 10) {
        return { ok: false, error: 'Password must be at least 10 characters.' };
      }
      var newHash = await sha256Hex(newPw);
      try { localStorage.setItem(HASH_OVERRIDE_KEY, newHash); } catch (e) {}
      var s = getSession();
      if (s) {
        s.hash = newHash;
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
      }
      return {
        ok: true,
        hash: newHash,
        note: [
          'Saved to this browser. The new password works here immediately.',
          'To make permanent for every device, replace SECRET_HASH in js/admin-auth.js with the hash above, then commit + deploy.',
        ].join(' '),
      };
    },

    sessionInfo: function () {
      var s = getSession();
      if (!s) return null;
      return {
        created_at:          new Date(s.created_at * 60000).toISOString(),
        idle_expires_at:     new Date(s.expires_at * 60000).toISOString(),
        absolute_expires_at: new Date(s.absolute_expires_at * 60000).toISOString(),
        remaining_minutes:   getRemainingMinutes(),
        valid:               isValidSession(),
      };
    },

    sha256Hex: sha256Hex,
  };

  // -- Boot ----------------------------------------------------------------
  function boot() {
    startActivityTracking();

    if (isValidSession()) {
      bumpSession();
      hideLoginOverlay();
      if (typeof window.onAdminReady === 'function') {
        try { window.onAdminReady(); } catch (e) {}
      }
    } else {
      clearSession();
      showLoginOverlay();
    }
  }

  // Build overlay early so it covers the page before any inline scripts paint
  ensureOverlay();
  if (!isValidSession()) {
    showLoginOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
