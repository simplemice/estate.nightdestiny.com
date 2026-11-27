/* /rent/: area and property-type filters for the rental price table. Without JavaScript the full table stays visible. */
(function () {
  'use strict';
  function init() {
    var form = document.querySelector('.rp-filters');
    var table = document.querySelector('.rent-table');
    if (!form || !table) return;
    var area = form.querySelector('#rp-area'), type = form.querySelector('#rp-type');
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    function apply() {
      var a = area.value, t = type.value;
      rows.forEach(function (r) {
        r.hidden = (a && r.getAttribute('data-area') !== a) || (t && r.getAttribute('data-type') !== t);
      });
    }
    area.addEventListener('change', apply);
    type.addEventListener('change', apply);
    form.hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
