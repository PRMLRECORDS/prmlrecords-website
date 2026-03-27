/* ═══════════════════════════════════════════
   PRML RECORDS — Cookie Consent Banner
   GDPR / CCPA compliant · Lightweight
   ═══════════════════════════════════════════ */
(function(){
  if (localStorage.getItem('prml_cookies') === 'accepted') return;
  if (localStorage.getItem('prml_cookies') === 'declined') return;

  var banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
      '<p style="margin:0;font-family:\'Roboto Slab\',serif;font-size:13px;color:#F5E6C8;line-height:1.6;flex:1;min-width:200px">' +
        'We use cookies for analytics and to improve your experience. ' +
        '<a href="privacypolicy.html" style="color:#E01010;text-decoration:underline">Privacy Policy</a>' +
      '</p>' +
      '<div style="display:flex;gap:8px;flex-shrink:0">' +
        '<button id="cookie-accept" style="background:#E01010;color:#fff;border:none;padding:8px 20px;font-family:\'Odibee Sans\',sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer">Accept</button>' +
        '<button id="cookie-decline" style="background:transparent;color:#C4B49A;border:1px solid #C4B49A;padding:8px 16px;font-family:\'Odibee Sans\',sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer">Decline</button>' +
      '</div>' +
    '</div>';

  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#2B2B2B;padding:16px 24px;z-index:99999;border-top:2px solid #E01010;box-shadow:0 -4px 20px rgba(0,0,0,.4)';

  document.body.appendChild(banner);

  document.getElementById('cookie-accept').addEventListener('click', function(){
    localStorage.setItem('prml_cookies', 'accepted');
    banner.remove();
  });

  document.getElementById('cookie-decline').addEventListener('click', function(){
    localStorage.setItem('prml_cookies', 'declined');
    banner.remove();
    // Disable GA4
    window['ga-disable-G-2PNH2XTRDK'] = true;
  });
})();
