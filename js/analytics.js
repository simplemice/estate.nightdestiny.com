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
    liftWhatsApp();
  }
  /* The Zoho button is injected, fixed bottom-right, with its own CSS. Keep our WhatsApp button
     above it: measure the chat button and set --wa-lift (used by .wa-float in estate.css). */
  function liftWhatsApp() {
    var root = document.documentElement, base = 18, gap = 14;
    function chatBtn() { return document.querySelector('#zsiq_float, .zsiq_floatmain, .zsiq-float'); }
    function update() {
      var b = chatBtn(), r = b && b.getBoundingClientRect();
      if (!r || !r.width || !r.height || getComputedStyle(b).display === 'none') { root.style.removeProperty('--wa-lift'); return; }
      var top = window.innerHeight - r.top; // chat top edge measured from viewport bottom
      root.style.setProperty('--wa-lift', Math.max(0, Math.round(top + gap - base)) + 'px');
    }
    new MutationObserver(update).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    addEventListener('resize', update); addEventListener('orientationchange', update);
    var n = 0, t = setInterval(function () { update(); if (++n > 40) clearInterval(t); }, 500);
  }
  function onInteract() { loadChat(); }
  ['scroll', 'pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(function (e) {
    addEventListener(e, onInteract, { once: true, passive: true });
  });
  setTimeout(loadChat, 20000);

  /* ---- events (no personal data is sent) ---- */
  function send(name, params) { if (window.gtag) gtag('event', name, params || {}); }
  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var path = location.pathname.replace(/^\/ru(?=\/)/, '');
  var pageType = (path.split('/')[1] || 'home');

  // Which project / listing does an element belong to? Card links carry the slug; detail pages use the URL.
  function itemOf(el) {
    var m, card = el.closest && el.closest('.estate-card');
    if (card) { var h = card.querySelector('h3 a'); m = h && h.getAttribute('href').replace(/^\/ru(?=\/)/, '').match(/^\/(projects|rent|sale)\/([^/]+)\//); }
    if (!m) m = path.match(/^\/(projects|rent|sale)\/([^/]+)\//);
    return m ? { item_type: m[1] === 'projects' ? 'project' : m[1], item_slug: m[2] } : { item_type: '', item_slug: '' };
  }
  function placeOf(el) {
    var map = [['.wa-float', 'floating_button'], ['.offcanvas-menu-wrapper', 'mobile_menu'], ['.top-nav', 'header'], ['footer', 'footer'], ['.detail-side', 'detail_sidebar'], ['.estate-card', 'listing_card'], ['.unit-table', 'unit_table']];
    for (var i = 0; i < map.length; i++) if (el.closest(map[i][0])) return map[i][1];
    return 'content';
  }

  // One enquiry event for every contact click. generate_lead is the GA4 recommended event name; mark it as a key event in GA4.
  // method = whatsapp | phone | email lets you separate them in reports. De-duplicated: one event per link per second.
  var lastLead = { key: '', t: 0 };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '', method = /wa\.me/.test(href) ? 'whatsapp' : /^tel:/i.test(href) ? 'phone' : /^mailto:/i.test(href) ? 'email' : '';
    if (!method) return;
    var key = method + '|' + href + '|' + placeOf(a), now = Date.now();
    if (lastLead.key === key && now - lastLead.t < 1000) return;
    lastLead = { key: key, t: now };
    var it = itemOf(a);
    send('generate_lead', { method: method, page_type: pageType, page_path: location.pathname, language: lang, item_type: it.item_type, item_slug: it.item_slug, link_location: placeOf(a), link_text: (a.textContent || '').trim().slice(0, 60) });
  }, true);

  // Language switcher use (no personal data).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.lang-switch a');
    if (a) send('language_switch', { from_language: lang, to_language: a.getAttribute('hreflang') || '', page_path: location.pathname });
  }, true);

  // One GA4 recommended view_item per project / listing page load (page_view alone cannot be filtered by item).
  var cur = itemOf(document.body);
  if (cur.item_slug) send('view_item', { items: [{ item_id: cur.item_slug, item_category: cur.item_type }], language: lang });

  // Catalogue filters (debounced): which filters are used, never the values typed in the search box.
  var f = document.getElementById('filters'), t;
  if (f) f.addEventListener('change', function (e) {
    clearTimeout(t);
    var n = e.target && e.target.name;
    t = setTimeout(function () { send('filter_listings', { page_type: pageType, filter_name: n || '' }); }, 800);
  });
})();
