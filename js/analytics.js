/* Central analytics loader (the only place tracking code lives).
   Config comes from data attributes written by scripts/build.mjs from content/settings.json:
   data-ga (GA4 measurement ID), data-host (production hostname), data-chat (Zoho SalesIQ widget code).
   - Runs only on the production hostname: localhost, previews and file:// never send hits.
   - Loads after first interaction (or 3 s idle) so it does not block rendering; loads once. */
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s) return;
  var GA = s.getAttribute('data-ga'), HOST = s.getAttribute('data-host'), CHAT = s.getAttribute('data-chat');
  var prod = HOST && location.hostname === HOST;
  if (!prod) return;
  var loaded = { ga: false, chat: false };

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function loadGA() {
    if (loaded.ga || !/^G-[A-Z0-9]+$/.test(GA || '')) return;
    loaded.ga = true;
    var g = document.createElement('script');
    g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(g);
    gtag('js', new Date());
    gtag('config', GA);
  }
  function loadChat() {
    if (loaded.chat || !CHAT) return;
    loaded.chat = true;
    window.$zoho = window.$zoho || {};
    window.$zoho.salesiq = window.$zoho.salesiq || { ready: function () {} };
    var z = document.createElement('script');
    z.id = 'zsiqscript'; z.defer = true;
    z.src = 'https://salesiq.zohopublic.com/widget?wc=' + encodeURIComponent(CHAT);
    document.body.appendChild(z);
  }
  function onInteract() { loadGA(); loadChat(); }
  ['scroll', 'pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(function (e) {
    addEventListener(e, onInteract, { once: true, passive: true });
  });
  setTimeout(loadGA, 3000);
  setTimeout(loadChat, 20000);

  /* ---- events (no personal data is sent) ---- */
  function send(name, params) { loadGA(); if (window.gtag) gtag('event', name, params || {}); }
  var pageType = (location.pathname.split('/')[1] || 'home');

  // WhatsApp enquiry = the lead. Mark generate_lead as a key event in GA4.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (!a) return;
    send('generate_lead', { method: 'whatsapp', page_type: pageType, page_path: location.pathname, link_text: (a.textContent || '').trim().slice(0, 60) });
  }, true);

  // Catalogue filters (debounced): which filters are used, never the values typed in the search box.
  var f = document.getElementById('filters'), t;
  if (f) f.addEventListener('change', function (e) {
    clearTimeout(t);
    var n = e.target && e.target.name;
    t = setTimeout(function () { send('filter_listings', { page_type: pageType, filter_name: n || '' }); }, 800);
  });
})();
