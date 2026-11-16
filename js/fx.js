/*
 * USD equivalent for THB prices (indicative only).
 * The page always contains the original THB price. This script only fills in
 * <small class="usd" data-thb="22840000" data-prefix="From "> elements.
 * Shared rate service: one fetch per page, cached in localStorage, never blocks rendering.
 * Providers (no API key, CORS enabled): Frankfurter (ECB reference rates), fallback open.er-api.com.
 */
(function (root) {
  'use strict';

  var CFG = {
    key: 'fx:usd-thb:v1',
    freshMs: 6 * 3600e3,      // reuse cached rate for 6h
    maxStaleMs: 72 * 3600e3,  // if provider is down, keep using last valid rate up to 72h, then show THB only
    timeoutMs: 4000,
    minRate: 5, maxRate: 200  // sanity bounds for THB per USD
  };
  var PROVIDERS = [
    { name: 'Frankfurter (ECB reference rates)', url: 'https://api.frankfurter.dev/v2/rate/USD/THB',
      parse: function (j) { return { rate: j && j.rate, asOf: j && j.date }; } },
    { name: 'ExchangeRate-API (open access)', url: 'https://open.er-api.com/v6/latest/USD',
      parse: function (j) { return { rate: j && j.result === 'success' && j.rates && j.rates.THB, asOf: j && j.time_last_update_utc }; } }
  ];

  function validRate(r) { return typeof r === 'number' && isFinite(r) && r >= CFG.minRate && r <= CFG.maxRate; }

  /* ---------- conversion (pure) ---------- */
  function toNumber(v) {
    if (typeof v === 'string') v = v.replace(/[,\s฿]/g, '');
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : null;
  }
  // USD = THB / (THB per USD). Returns null when input or rate is unusable.
  function convert(thb, rate) {
    var n = toNumber(thb);
    if (n === null || !validRate(rate)) return null;
    return n / rate;
  }
  // Display rounding only: >=100k -> nearest $1,000; 10k-100k -> $100; below -> $10 (rent).
  function formatUsd(usd) {
    if (typeof usd !== 'number' || !isFinite(usd) || usd <= 0) return '';
    var step = usd >= 100000 ? 1000 : usd >= 10000 ? 100 : 10;
    var r = Math.round(usd / step) * step;
    if (r <= 0) return '';
    return '$' + r.toLocaleString('en-US');
  }

  /* ---------- cache ---------- */
  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function readCache() {
    try {
      var s = store(); if (!s) return null;
      var c = JSON.parse(s.getItem(CFG.key) || 'null');
      if (c && validRate(c.rate) && typeof c.fetchedAt === 'number') return c;
    } catch (e) { /* ignore */ }
    return null;
  }
  function writeCache(c) { try { var s = store(); if (s) s.setItem(CFG.key, JSON.stringify(c)); } catch (e) { /* ignore */ } }

  /* ---------- fetch (single in-flight request) ---------- */
  var inflight = null;
  function fetchOne(p) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, CFG.timeoutMs) : null;
    return root.fetch(p.url, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status); // includes 429 rate limit
        return res.json();
      })
      .then(function (j) {
        var o = p.parse(j);
        if (!validRate(o.rate)) throw new Error('invalid rate');
        return { base: 'USD', target: 'THB', rate: o.rate, asOf: o.asOf || null, provider: p.name, fetchedAt: Date.now() };
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function fetchRate() {
    if (inflight) return inflight;
    var i = 0;
    function next() {
      if (i >= PROVIDERS.length) return Promise.reject(new Error('all providers failed'));
      return fetchOne(PROVIDERS[i++]).catch(next);
    }
    inflight = next().then(function (c) { writeCache(c); inflight = null; return c; },
                           function (e) { inflight = null; throw e; });
    return inflight;
  }

  // Resolves to a usable cache record ({rate,...}) or null. Never rejects.
  function getRate() {
    var c = readCache(), now = Date.now();
    if (c && now - c.fetchedAt < CFG.freshMs) return Promise.resolve(c);
    return fetchRate().catch(function () {
      return c && now - c.fetchedAt < CFG.maxStaleMs ? c : null;
    });
  }

  /* ---------- DOM ---------- */
  function bangkok(ts) {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)) + ' (Bangkok time)';
    } catch (e) { return ''; }
  }
  function render(doc, c) {
    var els = doc.querySelectorAll('[data-thb]'), shown = 0, i, el, txt;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      txt = c ? formatUsd(convert(el.getAttribute('data-thb'), c.rate)) : '';
      if (txt) { el.textContent = (el.getAttribute('data-prefix') || 'Approx. ') + txt + ' USD'; shown++; }
      else el.textContent = '';
    }
    var notes = doc.querySelectorAll('[data-usd-note]');
    for (i = 0; i < notes.length; i++) {
      var span = notes[i].querySelector('.usd-note-text');
      if (!shown || !c) { if (span) span.textContent = ''; continue; }
      if (!span) { span = doc.createElement('span'); span.className = 'usd-note-text'; notes[i].appendChild(span); }
      span.textContent = ' USD equivalent calculated using the latest available exchange rate (1 USD = ' + c.rate.toFixed(2) + ' THB, ' + c.provider + ', updated ' + bangkok(c.fetchedAt) + '). Indicative only; actual transfer rates and fees differ.';
    }
    return shown;
  }
  function init(doc) {
    doc = doc || root.document;
    if (!doc || !doc.querySelector('[data-thb]')) return Promise.resolve(0);
    var cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CFG.maxStaleMs) render(doc, cached); // instant paint from cache
    return getRate().then(function (c) { return render(doc, c); });
  }

  var API = { convert: convert, formatUsd: formatUsd, getRate: getRate, render: render, init: init, config: CFG, _providers: PROVIDERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else {
    root.NDFX = API;
    if (root.document) {
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { init(); });
      else init();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
