/* Rental "Request Availability" dialog (booking by request; nothing is booked or confirmed here).
 * Validates the form in the browser, builds one complete structured inquiry and hands it to WhatsApp (the only sending channel).
 * There is no server on this static site, so delivery depends on the customer pressing send in that app.
 * Configuration (language strings, contact details) comes from <script id="rental-cfg"> written by scripts/build.mjs. */
(function () {
  'use strict';
  var dlg = document.getElementById('request');
  var form = document.getElementById('rental-form');
  var cfgEl = document.getElementById('rental-cfg');
  if (!dlg || !form || !cfgEl) return;

  var cfg = {};
  try { cfg = JSON.parse(cfgEl.textContent) || {}; } catch (e) { return; }
  var LANG = (cfg.lang || 'en').slice(0, 2);
  var pluralIdx = function (n) {
    if (LANG === 'ru') { var a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? 2 : b > 1 && b < 5 ? 1 : b === 1 ? 0 : 2; }
    return n === 1 ? 0 : 1;
  };
  var tr = function (key, vars) {
    var v = cfg.i18n && cfg.i18n[key] !== undefined ? cfg.i18n[key] : key;
    if (Array.isArray(v)) v = v[Math.min(pluralIdx(vars && vars.n !== undefined ? vars.n : 0), v.length - 1)];
    return String(v).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? vars[k] : '{' + k + '}'; });
  };
  var $ = function (id) { return document.getElementById(id); };
  var f = {
    property: $('rd-property'), adults: $('rd-adults'), children: $('rd-children'), inn: $('rd-in'), out: $('rd-out'),
    locs: $('rd-locs'), locset: $('rd-locset'), other: $('rd-other'), otherWrap: $('rd-other-wrap'), budget: $('rd-budget'), cur: $('rd-cur'), per: $('rd-per'),
    notes: $('rd-notes'), name: $('rd-name'), phone: $('rd-phone'), hp: form.elements.website
  };
  var errBox = $('rd-error'), stayEl = $('rd-stay'), capHint = $('rd-cap-hint'), capWarn = $('rd-cap-warn'), done = $('rd-done');
  var state = { slug: '', type: '', typeLabel: '', maxGuests: 0, lockedUntil: 0, lastHash: '', lastAt: 0 };
  var DAY = 86400000;

  /* ---- dates (local calendar dates, no time zones involved) ---- */
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parse = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  var today = function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  var nightsBetween = function (a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY); };
  var fmtDate = function (d, locale) { try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return iso(d); } };

  var refreshDates = function () {
    var t = today();
    f.inn.min = iso(t);
    var a = parse(f.inn.value);
    f.out.min = iso(a ? new Date(a.getTime() + DAY) : new Date(t.getTime() + DAY));
    var b = parse(f.out.value);
    if (a && b && b > a) stayEl.textContent = tr('stay', { from: fmtDate(a, cfg.locale), to: fmtDate(b, cfg.locale), nights: tr('nights', { n: nightsBetween(a, b) }) });
    else stayEl.textContent = stayEl.getAttribute('data-default') || stayEl.textContent;
  };
  stayEl.setAttribute('data-default', stayEl.textContent);

  /* ---- capacity hint (recommended capacity, never a hard limit) ---- */
  var refreshCapacity = function () {
    var guests = (parseInt(f.adults.value, 10) || 0) + (parseInt(f.children.value, 10) || 0);
    if (state.maxGuests && guests > state.maxGuests) { capWarn.textContent = tr('cap_warn', { guests: guests, n: state.maxGuests }); capWarn.hidden = false; }
    else capWarn.hidden = true;
  };

  /* ---- open / close ---- */
  var slugify = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var open = function (src) {
    state.slug = src.getAttribute('data-slug') || '';
    state.type = src.getAttribute('data-type') || '';
    state.typeLabel = src.getAttribute('data-type-label') || state.type;
    state.maxGuests = parseInt(src.getAttribute('data-max-guests'), 10) || 0;
    f.property.value = src.getAttribute('data-property') || '';
    var guess = slugify(src.getAttribute('data-location'));
    boxes().forEach(function (b) { b.checked = b.value === guess && guess !== 'other' && !!(cfg.locEn && cfg.locEn[guess]); });
    toggleOther();
    clearErrors(); done.hidden = true; unlock();
    capHint.hidden = true; // capacity is shown on the card/page; the dialog only warns when exceeded
    refreshDates(); refreshCapacity();
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else { dlg.setAttribute('open', ''); }
    try { document.documentElement.classList.add('rd-open'); } catch (e) { /* ignore */ }
    try { (f.inn.value ? f.name : f.inn).focus(); } catch (e) { /* ignore */ }
  };
  var close = function () {
    if (typeof dlg.close === 'function') { if (dlg.open) dlg.close(); } else { dlg.removeAttribute('open'); }
    document.documentElement.classList.remove('rd-open');
  };
  dlg.addEventListener('close', function () { document.documentElement.classList.remove('rd-open'); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); }); // click on the backdrop
  Array.prototype.forEach.call(dlg.querySelectorAll('[data-rd-close]'), function (b) { b.addEventListener('click', close); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('[data-rental-open]') : null;
    if (!a) return;
    e.preventDefault();
    open(a);
  });

  /* ---- field behaviour ---- */
  var boxes = function () { return Array.prototype.slice.call(f.locs.querySelectorAll('input[type=checkbox]')); };
  var chosen = function () { return boxes().filter(function (b) { return b.checked; }).map(function (b) { return b.value; }); };
  var toggleOther = function () { var o = chosen().indexOf('other') > -1; f.otherWrap.hidden = !o; if (!o) f.other.value = ''; };
  f.locs.addEventListener('change', toggleOther);
  f.inn.addEventListener('change', function () { var a = parse(f.inn.value), b = parse(f.out.value); if (a && b && b <= a) f.out.value = ''; refreshDates(); });
  f.out.addEventListener('change', refreshDates);
  f.adults.addEventListener('input', refreshCapacity);
  f.children.addEventListener('input', refreshCapacity);

  /* ---- validation ---- */
  var clearErrors = function () {
    errBox.hidden = true; errBox.innerHTML = '';
    Object.keys(f).forEach(function (k) { if (f[k] && f[k].classList) { f[k].classList.remove('is-invalid'); f[k].removeAttribute('aria-invalid'); } });
  };
  var wholeNum = function (v) { return /^\d{1,3}$/.test(String(v).trim()) ? parseInt(v, 10) : NaN; };
  var validate = function () {
    var errs = [], bad = [];
    var mark = function (el, msg) { errs.push(msg); bad.push(el); };
    var adults = wholeNum(f.adults.value), kids = wholeNum(f.children.value);
    if (!(adults >= 1 && adults <= 30)) mark(f.adults, tr('err.adults'));
    if (!(kids >= 0 && kids <= 30)) mark(f.children, tr('err.children'));
    var a = parse(f.inn.value), b = parse(f.out.value);
    if (!a || a < today()) mark(f.inn, tr('err.checkin'));
    if (!b || !a || b <= a) mark(f.out, tr('err.checkout'));
    var sel = chosen();
    if (!sel.length) mark(f.locset, tr('err.location'));
    else if (sel.indexOf('other') > -1 && !f.other.value.trim()) mark(f.other, tr('err.location_other'));
    if (f.budget.value !== '' && !(isFinite(parseFloat(f.budget.value)) && parseFloat(f.budget.value) > 0)) mark(f.budget, tr('err.budget'));
    if (!f.name.value.trim()) mark(f.name, tr('err.name'));
    var phone = f.phone.value.trim();
    var digits = phone.replace(/\D/g, '');
    var phoneOk = /^[+\d][\d\s().\-]{5,}$/.test(phone) && digits.length >= 7 && digits.length <= 15;
    if (!phone) mark(f.phone, tr('err.contact'));
    else if (!phoneOk) mark(f.phone, tr('err.phone'));
    return { errs: errs, bad: bad, data: { adults: adults, kids: kids, a: a, b: b, phone: phone } };
  };
  var showErrors = function (v) {
    errBox.innerHTML = '<strong></strong><ul></ul>';
    errBox.firstChild.textContent = tr('err.fix');
    v.errs.forEach(function (m) { var li = document.createElement('li'); li.textContent = m; errBox.lastChild.appendChild(li); });
    errBox.hidden = false;
    v.bad.forEach(function (el) { el.classList.add('is-invalid'); el.setAttribute('aria-invalid', 'true'); });
    try { v.bad[0].focus(); } catch (e) { /* ignore */ }
    try { errBox.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
  };

  /* ---- message (always English: it is read by our sales team; the customer's site language is included) ---- */
  var periodEn = { night: '/ night', week: '/ week', month: '/ month', total: '(total stay)' };
  var buildMessage = function (d) {
    var nights = nightsBetween(d.a, d.b);
    var locTxt = chosen().map(function (k) { return k === 'other' ? f.other.value.trim() : (cfg.locEn[k] || k); }).join(', ');
    var budget = f.budget.value !== '' ? Number(f.budget.value).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + f.cur.value + ' ' + periodEn[f.per.value] : 'not specified';
    var typeTxt = state.type || '';
    var now = new Date();
    var lines = [
      'New rental inquiry received.', '',
      'Property: ' + f.property.value,
      'Property type: ' + (typeTxt === 'Condo' ? 'Condominium' : typeTxt || 'n/a'),
      'Adults: ' + d.adults, 'Children: ' + d.kids, '',
      'Check-in: ' + fmtDate(d.a, 'en-GB'), 'Check-out: ' + fmtDate(d.b, 'en-GB'),
      'Duration: ' + nights + (nights === 1 ? ' night' : ' nights'), '',
      'Preferred locations: ' + locTxt, '',
      'Budget: ' + budget, '',
      'Additional requirements:', f.notes.value.trim() ? f.notes.value.trim() : '(none)', '',
      'Customer:', 'Name: ' + f.name.value.trim(),
      'Phone / WhatsApp: ' + d.phone, '',
      'Submitted: ' + now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC (site language: ' + LANG + ', page: ' + location.pathname + ')', '',
      'Please contact the customer to check availability and provide suitable rental options.'
    ];
    var subject = 'New Rental Inquiry';
    return { subject: subject + ' – ' + f.property.value + ' – ' + locTxt, body: lines.join('\n') };
  };

  /* ---- send via WhatsApp with duplicate protection ---- */
  var buttons = [$('rd-send-wa')];
  var lock = function () { buttons.forEach(function (b) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }); };
  var unlock = function () { buttons.forEach(function (b) { b.disabled = false; b.removeAttribute('aria-disabled'); }); state.lockedUntil = 0; };
  var hash = function (s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

  var send = function (channel) {
    var now = Date.now();
    if (now < state.lockedUntil) { done.textContent = tr('done_again'); done.hidden = false; return; }
    clearErrors();
    if (f.hp && f.hp.value) { return; } // honeypot: bots fill the hidden field; stay silent
    var v = validate();
    if (v.errs.length) { showErrors(v); return; }
    var m = buildMessage(v.data);
    var h = hash(m.body);
    if (h === state.lastHash && now - state.lastAt < 60000) { done.textContent = tr('done_again'); done.hidden = false; return; }
    state.lastHash = h; state.lastAt = now; state.lockedUntil = now + 8000; lock();
    setTimeout(unlock, 8000);
    window.open('https://wa.me/' + cfg.wa + '?text=' + encodeURIComponent(m.subject + '\n\n' + m.body), '_blank', 'noopener');
    done.innerHTML = '<strong></strong><p></p><button type="button" class="primary-btn" data-rd-close></button>';
    done.firstChild.textContent = tr('done_title');
    done.children[1].textContent = tr('done_body', { channel: tr('done_wa') });
    done.lastChild.textContent = tr('done_close');
    done.lastChild.addEventListener('click', close);
    done.hidden = false;
    try { done.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
  };
  buttons.forEach(function (b) { b.addEventListener('click', function () { send(b.getAttribute('data-channel')); }); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send('wa'); });

  try { // detail page opened from a card without the dialog (e.g. the home page): /rent/<slug>/?request=1
    if (/(^|[?&])request=1(&|$)/.test(location.search)) { var first = document.querySelector('[data-rental-open]'); if (first) open(first); }
  } catch (e) { /* ignore */ }
})();
