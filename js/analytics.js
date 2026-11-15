/* Central analytics loader (the only place tracking code lives).
   Config comes from data attributes written by scripts/build.mjs from content/settings.json:
   data-host (production hostname), data-chat (Zoho SalesIQ widget code).
   The Google tag itself (gtag.js + config) is written into every page <head> by scripts/build.mjs.
   This file only sends events and loads the chat widget, and only on the production hostname. */
(function () {
  'use strict';
  var s = document.currentScript;
  if (!s) return;
  var HOST = s.getAttribute('data-host'), CHAT = s.getAttribute('data-chat');
  var prod = HOST && location.hostname === HOST;
  if (!prod) return;
  var loaded = { chat: false };
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
  function onInteract() { loadChat(); }
  ['scroll', 'pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(function (e) {
    addEventListener(e, onInteract, { once: true, passive: true });
  });
  setTimeout(loadChat, 20000);

  /* ---- events (no personal data is sent) ---- */
  function send(name, params) { if (window.gtag) gtag('event', name, params || {}); }
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
