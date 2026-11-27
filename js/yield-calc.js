/*
 * Area pages: rental yield calculator + "show all projects" toggle.
 * Formulas (all on the purchase price only):
 *   annual income      = monthly rent x 12
 *   gross yield (%)    = annual income / price x 100
 *   commission         = annual income x commission % / 100
 *   net income         = annual income - commission - other annual expenses
 *   net yield (%)      = net income / price x 100
 * USD equivalents are filled in by js/fx.js (window.NDFX) when a rate is available.
 */
(function () {
  'use strict';

  function calc(v) {
    var annual = v.rent * 12;
    var commission = annual * v.mgmt / 100;
    var net = annual - commission - v.other;
    return {
      annual: annual,
      grossYield: v.price > 0 ? annual / v.price * 100 : null,
      commission: commission,
      net: net,
      netYield: v.price > 0 ? net / v.price * 100 : null
    };
  }
  // Exposed for testing in the browser console: NDYield.calc({price, rent, mgmt, other}).
  window.NDYield = { calc: calc };

  function num(el) {
    var s = String(el.value || '').replace(/[\s,]/g, '');
    if (s === '') return 0;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function setup(root) {
    var ru = root.getAttribute('data-lang') === 'ru';
    var nf = new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { maximumFractionDigits: 0 });
    var pf = new Intl.NumberFormat(ru ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var inputs = {};
    ['price', 'rent', 'mgmt', 'other'].forEach(function (k) { inputs[k] = root.querySelector('[name="' + k + '"]'); });
    var out = function (k) { return root.querySelector('[data-yc="' + k + '"]'); };
    var usd = function (k) { return root.querySelector('[data-yc-usd="' + k + '"]'); };
    var err = out('error');
    var thb = function (n) { return (n < 0 ? '−' : '') + '฿' + nf.format(Math.abs(Math.round(n))); };
    var pct = function (n) { return n === null ? '-' : pf.format(n) + '%'; };

    function update() {
      var v = { price: num(inputs.price), rent: num(inputs.rent), mgmt: num(inputs.mgmt), other: num(inputs.other) };
      var msg = '';
      if ([v.price, v.rent, v.mgmt, v.other].some(function (x) { return isNaN(x) || x < 0; })) msg = root.getAttribute('data-err-neg');
      else if (!(v.price > 0)) msg = root.getAttribute('data-err-price');
      else if (v.mgmt > 100) msg = root.getAttribute('data-err-pct');
      Object.keys(inputs).forEach(function (k) { inputs[k].setAttribute('aria-invalid', msg && (isNaN(v[k]) || v[k] < 0 || (k === 'price' && !(v.price > 0)) || (k === 'mgmt' && v.mgmt > 100)) ? 'true' : 'false'); });
      err.hidden = !msg; err.textContent = msg || '';
      if (msg) {
        ['gross-income', 'gross-yield', 'commission', 'net-income', 'net-yield'].forEach(function (k) { out(k).textContent = '-'; });
        ['gross-income', 'commission', 'net-income'].forEach(function (k) { var u = usd(k); if (u) { u.setAttribute('data-thb', ''); u.textContent = ''; } });
        return;
      }
      var r = calc(v);
      out('gross-income').textContent = thb(r.annual);
      out('gross-yield').textContent = pct(r.grossYield);
      out('commission').textContent = thb(r.commission);
      out('net-income').textContent = thb(r.net);
      out('net-yield').textContent = pct(r.netYield);
      out('net-yield').classList.toggle('yc-neg', r.net < 0);
      [['gross-income', r.annual], ['commission', r.commission], ['net-income', r.net]].forEach(function (x) {
        var u = usd(x[0]); if (!u) return;
        u.setAttribute('data-thb', x[1] > 0 ? String(Math.round(x[1])) : ''); // fx.js only converts positive amounts
        if (!(x[1] > 0)) u.textContent = '';
      });
      if (window.NDFX && window.NDFX.getRate) {
        window.NDFX.getRate().then(function (c) { if (c) window.NDFX.render(document, c); }).catch(function () {});
      }
    }
    Object.keys(inputs).forEach(function (k) { inputs[k].addEventListener('input', update); });
    update();
  }

  function moreToggle(row) {
    var btn = row.parentNode.querySelector('.loc-more-btn');
    if (!btn || !row.querySelector('.loc-more')) return;
    row.classList.add('is-collapsed'); // collapsed only when JS runs, so every card stays visible without JS
    btn.hidden = false;
    btn.addEventListener('click', function () { row.classList.remove('is-collapsed'); btn.parentNode.removeChild(btn); });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-yield-calc]'), setup);
    Array.prototype.forEach.call(document.querySelectorAll('.loc-projects'), moreToggle);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
