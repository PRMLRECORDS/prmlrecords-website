/* ════════════════════════════════════════════════════════════════
   PRML cache-bust + SW updater
   Loaded on every page. Registers the service worker, listens for
   SW updates, and prompts a soft-reload so visitors see new deploys
   without needing to force-refresh.
   ════════════════════════════════════════════════════════════════ */
(function () {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    // Reload once a new SW takes control
    window.location.reload();
  });

  // Listen for postMessage from the SW announcing a new version
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      // Soft toast — non-blocking
      try {
        const t = document.createElement('div');
        t.textContent = 'New version loaded';
        t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#E01010;color:#F5E6C8;padding:10px 18px;font-family:"Odibee Sans",sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;z-index:9999;box-shadow:0 6px 20px rgba(0,0,0,.3);border-radius:2px';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2200);
      } catch (e) { /* DOM not ready — silent */ }
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for an update right away
      reg.update().catch(() => {});
      // And every 60 minutes the tab stays open
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

      // If a waiting SW exists, tell it to skip waiting → activates immediately
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed and there's already a controller → tell it to take over
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(() => {});
  });
})();
