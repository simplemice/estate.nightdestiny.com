/* Listing filters/sorting (client-side, no backend) + detail gallery. Requires jQuery + Magnific Popup. */
(function ($) {
  'use strict';

  /* ---- filters ---- */
  var $list = $('#listing');
  var $form = $('#filters');
  if ($list.length && $form.length) {
    var $cards = $list.children('.js-card');
    var $count = $('#result-count');
    var $none = $('#no-results');
    var noun = $list.closest('[data-listing="catalog"]').length ? ['project', 'projects'] : ['listing', 'listings'];
    var num = function (v) { return v === '' || v == null ? null : parseFloat(v); };
    var $pager = $('#pager');
    var pageSize = parseInt($list.data('pageSize'), 10) || 6;
    var page = 1;
    try { page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1); } catch (e) { /* ignore */ }

    var renderPager = function (pages) {
      if (!$pager.length) return;
      if (pages <= 1) { $pager.empty().prop('hidden', true); return; }
      var h = '<ul class="pagination justify-content-center">';
      h += '<li class="page-item' + (page === 1 ? ' disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page - 1) + '" aria-label="Previous page">&laquo;</a></li>';
      for (var i = 1; i <= pages; i++) {
        // always show first, last and neighbours; collapse the rest
        if (i === 1 || i === pages || Math.abs(i - page) <= 1) {
          h += '<li class="page-item' + (i === page ? ' active' : '') + '"><a class="page-link" href="#" data-page="' + i + '"' + (i === page ? ' aria-current="page"' : '') + '>' + i + '</a></li>';
        } else if (Math.abs(i - page) === 2) {
          h += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
        }
      }
      h += '<li class="page-item' + (page === pages ? ' disabled' : '') + '"><a class="page-link" href="#" data-page="' + (page + 1) + '" aria-label="Next page">&raquo;</a></li>';
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
      $count.text(shown ? 'Showing ' + (from + 1) + '\u2013' + Math.min(to, shown) + ' of ' + shown + ' ' + (shown === 1 ? noun[0] : noun[1]) : '0 ' + noun[1]);
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
