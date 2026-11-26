/* Listing filters/sorting (client-side, no backend) + detail gallery. Requires jQuery + Magnific Popup. */
(function ($) {
  'use strict';

  /* ---- i18n: strings come from the page (written by scripts/build.mjs from /locales/<lang>/ui.json) ---- */
  var I18N = {};
  try { I18N = JSON.parse(document.getElementById('i18n-data').textContent) || {}; } catch (e) { /* English fallbacks below */ }
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);
  var fmt = function (s, vars) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? '{' + k + '}' : vars[k]; }); };
  var pluralIdx = function (n) {
    if (LANG === 'ru') { var a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? 2 : b > 1 && b < 5 ? 1 : b === 1 ? 0 : 2; }
    return n === 1 ? 0 : 1;
  };
  var tr = function (key, fallback, vars) {
    var v = I18N[key] === undefined ? fallback : I18N[key];
    if ($.isArray(v)) v = v[Math.min(pluralIdx(vars && vars.n !== undefined ? vars.n : 0), v.length - 1)];
    return fmt(v, vars || {});
  };

  /* ---- language switcher: keep active filters / hash when jumping to the other language ---- */
  $('.lang-switch a').each(function () { if (location.search || location.hash) this.href += location.search + location.hash; });

  /* ---- filters ---- */
  var $list = $('#listing');
  var $form = $('#filters');
  if ($list.length && $form.length) {
    var $cards = $list.children('.js-card');
    var $count = $('#result-count');
    var $none = $('#no-results');
    var isCatalog = $list.closest('[data-listing="catalog"]').length > 0;
    var nounOf = function (n) { return tr(isCatalog ? 'js.noun_project' : 'js.noun_listing', isCatalog ? ['project', 'projects'] : ['listing', 'listings'], { n: n }); };
    var num = function (v) { return v === '' || v == null ? null : parseFloat(v); };
    var $pager = $('#pager');
    var pageSize = parseInt($list.data('pageSize'), 10) || 6;
    var page = 1;
    try { page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1); } catch (e) { /* ignore */ }

    var renderPager = function (pages) {
      if (!$pager.length) return;
      if (pages <= 1) { $pager.empty().prop('hidden', true); return; }
      var h = '<ul class="pagination justify-content-center">';
      h += '<li class="page-item' + (page === 1 ? ' disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page - 1) + '" aria-label="' + tr('js.prev', 'Previous page') + '">&laquo;</a></li>';
      for (var i = 1; i <= pages; i++) {
        // always show first, last and neighbours; collapse the rest
        if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
          h += '<li class="page-item' + (i === page ? ' active' : '') + '"><a class="page-link" href="#" data-page="' + i + '"' + (i === page ? ' aria-current="page"' : '') + '>' + i + '</a></li>';
        } else if (Math.abs(i - page) === 2) {
          h += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
        }
      }
      h += '<li class="page-item' + (page === pages ? ' disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page + 1) + '" aria-label="' + tr('js.next', 'Next page') + '">&raquo;</a></li>';
      $pager.html(h + '</ul>').prop('hidden', false);
    };

    var apply = function (keepPage) {
      if (keepPage !== true) page = 1;
      var q = $.trim($form.find('[name=q]').val()).toLowerCase();
      var loc = $form.find('[name=location]').val();
      var type = $form.find('[name=type]').val();
      var own = $form.find('[name=ownership]').val() || '';
      var cat = $form.find('[name=category]').val() || '';
      var status = $form.find('[name=status]').val() || '';
      var pool = $form.find('[name=pool]').val() || '';
      var min = num($form.find('[name=min]').val());
      var max = num($form.find('[name=max]').val());
      var beds = num($form.find('[name=beds]').val());
      var baths = num($form.find('[name=baths]').val());
      var area = num($form.find('[name=area]').val());
      var sort = $form.find('[name=sort]').val() || 'new';
      var shown = 0;
      var okSet = [];

      $cards.each(function () {
        var d = $(this).data();
        var ok = (!q || String(d.search).indexOf(q) > -1) &&
          (!loc || d.location === loc) && (!type || d.type === type) && (!own || ('|' + d.ownership + '|').indexOf('|' + own + '|') > -1) &&
          (!cat || d.category === cat) && (!status || d.status === status) && (!pool || d.pool === pool) &&
          (min === null || (d.price !== '' && d.price >= min)) && (max === null || (d.price !== '' && d.price <= max)) &&
          (beds === null || d.beds >= beds) && (baths === null || d.baths >= baths) &&
          (area === null || d.area >= area);
        if (ok) { shown++; okSet.push(this); }
      });

      var sorted = $cards.get().sort(function (a, b) {
        var da = $(a).data(), db = $(b).data();
        // listings without a price ("price on request") always go last for price sorts
        if (sort === 'alpha') return String(da.name || '').localeCompare(String(db.name || ''));
        var pa = da.price === '' ? null : da.price, pb = db.price === '' ? null : db.price;
        if (sort === 'low' || sort === 'high') {
          if (pa === null && pb === null) return db.date - da.date;
          if (pa === null) return 1;
          if (pb === null) return -1;
          return sort === 'low' ? pa - pb : pb - pa;
        }
        return db.date - da.date;
      });
      $list.append(sorted);
      var matched = sorted.filter(function (el) { return okSet.indexOf(el) > -1; });
      var pages = Math.max(1, Math.ceil(matched.length / pageSize));
      if (page > pages) page = pages;
      var from = (page - 1) * pageSize, to = from + pageSize;
      $cards.prop('hidden', true);
      $(matched.slice(from, to)).prop('hidden', false);
      renderPager(pages);
      $('.type-tabs a').each(function () { $(this).toggleClass('active', ($(this).data('type') || '') === (type || '')); });
      $count.text(shown ? tr('js.showing', 'Showing {from}\u2013{to} of {total} {noun}', { from: from + 1, to: Math.min(to, shown), total: shown, noun: nounOf(shown), n: shown }) : tr('js.zero', '0 {noun}', { noun: nounOf(0), n: 0 }));
      $none.prop('hidden', shown !== 0 || !$cards.length);

      // keep state in URL so filtered views are shareable
      try {
        var p = new URLSearchParams();
        $form.serializeArray().forEach(function (f) { if (f.value && !(f.name === 'sort' && f.value === 'new')) p.set(f.name, f.value); });
        if (page > 1) p.set('page', page);
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      } catch (e) { /* ignore */ }
    };

    // restore from URL
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { $form.find('[name="' + k + '"]').val(v); });
    } catch (e) { /* ignore */ }

    $('.type-tabs a').on('click', function (e) {
      e.preventDefault();
      $form.find('[name=type]').val($(this).data('type') || '');
      apply();
    });
    $form.on('input change', function () { apply(); });
    $('#f-reset').on('click', function () { setTimeout(apply, 0); });
    $('#f-reset-2').on('click', function (e) { e.preventDefault(); $form[0].reset(); apply(); });
    $pager.on('click', 'a[data-page]', function (e) {
      e.preventDefault();
      if ($(this).closest('.disabled').length) return;
      page = parseInt($(this).data('page'), 10);
      apply(true);
      var top = $('#result-count').offset().top - 80;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
    apply(true);
  }

  /* ---- gallery ---- */
  $('[data-gallery]').each(function () {
    var $g = $(this);
    var $main = $g.find('.g-main');
    var $thumbs = $g.find('.g-thumb');
    var items = $thumbs.length ? $thumbs.map(function () { return { src: $(this).data('full') }; }).get() : [{ src: $main.data('full') }];

    $thumbs.on('click', function (e) {
      e.preventDefault();
      var $t = $(this);
      $thumbs.removeClass('active');
      $t.addClass('active');
      $main.find('picture, img').first().replaceWith($t.find('picture, img').first().clone().attr('loading', 'eager'));
      $main.data('index', $thumbs.index($t)).attr('href', $t.data('full'));
    });
    $main.on('click', function (e) {
      e.preventDefault();
      if (!$.magnificPopup) return;
      $.magnificPopup.open({ items: items, gallery: { enabled: true }, type: 'image', mainClass: 'mfp-fade' }, $main.data('index') || 0);
    });
  });

  // plan images open in lightbox
  if ($.fn.magnificPopup) $('.plan-link').magnificPopup({ type: 'image' });
})(jQuery);

/* Home page: show 3 random featured sale cards on every page load (the HTML contains a default set for crawlers/no-JS). */
(function () {
  var row = document.getElementById('home-featured-sale'), tpl = document.getElementById('home-featured-pool');
  if (!row || !tpl || !tpl.content) return;
  var cards = Array.prototype.slice.call(tpl.content.children);
  for (var i = cards.length - 1; i > 0; i--) { var k = Math.floor(Math.random() * (i + 1)), t = cards[i]; cards[i] = cards[k]; cards[k] = t; }
  var pick = cards.slice(0, 3);
  if (pick.length < 3) return;
  while (row.firstChild) row.removeChild(row.firstChild);
  pick.forEach(function (c) { row.appendChild(c.cloneNode(true)); });
})();

/* Project video: the YouTube iframe is created only after the visitor clicks play (nothing loads from YouTube before that except the thumbnail). */
(function () {
  'use strict';
  var YT = /^[A-Za-z0-9_-]{11}$/;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.pv-play');
    if (!b) return;
    var w = b.closest('.pv'), id = w && w.getAttribute('data-yt');
    if (!id || !YT.test(id)) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0';
    f.title = w.getAttribute('data-title') || 'Video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    w.textContent = '';
    w.classList.add('pv-on');
    w.appendChild(f);
    f.focus();
  });
  // Thumbnail fallback: maxres -> hq -> plain dark box with the play button.
  function fallback(img) {
    var fb = img.getAttribute('data-fb');
    if (fb && img.src !== fb) { img.removeAttribute('data-fb'); img.src = fb; } else { img.classList.add('pv-nothumb'); }
  }
  document.addEventListener('error', function (e) { if (e.target && e.target.classList && e.target.classList.contains('pv-img')) fallback(e.target); }, true);
  Array.prototype.forEach.call(document.querySelectorAll('.pv-img'), function (img) { if (img.complete && img.naturalWidth === 0) fallback(img); });
})();
