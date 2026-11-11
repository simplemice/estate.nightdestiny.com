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
    var num = function (v) { return v === '' || v == null ? null : parseFloat(v); };

    var apply = function () {
      var q = $.trim($form.find('[name=q]').val()).toLowerCase();
      var loc = $form.find('[name=location]').val();
      var type = $form.find('[name=type]').val();
      var own = $form.find('[name=ownership]').val() || '';
      var min = num($form.find('[name=min]').val());
      var max = num($form.find('[name=max]').val());
      var beds = num($form.find('[name=beds]').val());
      var baths = num($form.find('[name=baths]').val());
      var area = num($form.find('[name=area]').val());
      var sort = $form.find('[name=sort]').val() || 'new';
      var shown = 0;

      $cards.each(function () {
        var d = $(this).data();
        var ok = (!q || String(d.search).indexOf(q) > -1) &&
          (!loc || d.location === loc) && (!type || d.type === type) && (!own || d.ownership === own) &&
          (min === null || d.price >= min) && (max === null || d.price <= max) &&
          (beds === null || d.beds >= beds) && (baths === null || d.baths >= baths) &&
          (area === null || d.area >= area);
        $(this).prop('hidden', !ok);
        if (ok) shown++;
      });

      var sorted = $cards.get().sort(function (a, b) {
        var da = $(a).data(), db = $(b).data();
        if (sort === 'low') return da.price - db.price;
        if (sort === 'high') return db.price - da.price;
        return db.date - da.date;
      });
      $list.append(sorted);
      $count.text(shown + (shown === 1 ? ' property' : ' properties'));
      $none.prop('hidden', shown !== 0 || !$cards.length);

      // keep state in URL so filtered views are shareable
      try {
        var p = new URLSearchParams();
        $form.serializeArray().forEach(function (f) { if (f.value && !(f.name === 'sort' && f.value === 'new')) p.set(f.name, f.value); });
        history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      } catch (e) { /* ignore */ }
    };

    // restore from URL
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { $form.find('[name="' + k + '"]').val(v); });
    } catch (e) { /* ignore */ }

    $form.on('input change', apply);
    $('#f-reset').on('click', function () { setTimeout(apply, 0); });
    $('#f-reset-2').on('click', function (e) { e.preventDefault(); $form[0].reset(); apply(); });
    apply();
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
      $.magnificPopup.open({ items: items, gallery: { enabled: true }, type: 'image', mainClass: 'mfp-fade' }, $main.data('index') || 0);
    });
  });

  // plan images open in lightbox
  $('.plan-link').magnificPopup({ type: 'image' });
})(jQuery);
