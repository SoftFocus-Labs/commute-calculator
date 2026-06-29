// Sliding selection block for segmented controls.
//
// Rather than hook every place that toggles `.is-active`, this watches each
// `.segmented` for class changes on its options and glides a single absolutely
// positioned `.segmented-thumb` over whichever option is active. Because it
// measures the active option's box (offsetLeft/Top/Width/Height) it adapts to
// 2- or 3-segment controls and to layout changes (panel open, unit switch,
// font load, resize) without any coordination with main.js.
(function () {
  'use strict';

  function place(group, animate) {
    var thumb = group.__thumb;
    if (!thumb) return;
    var active = group.querySelector('.segmented-option.is-active');
    if (!active) {
      thumb.style.opacity = '0';
      return;
    }
    thumb.style.opacity = '1';

    // Skip animation on the very first placement so the thumb appears under
    // the active option instead of flying in from the top-left corner.
    var prevTransition;
    if (!animate) {
      prevTransition = thumb.style.transition;
      thumb.style.transition = 'none';
    }

    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.height = active.offsetHeight + 'px';
    thumb.style.transform =
      'translate(' + active.offsetLeft + 'px,' + active.offsetTop + 'px)';

    if (!animate) {
      // Force a reflow so the no-transition position takes hold before we
      // restore the transition for subsequent moves.
      void thumb.offsetWidth;
      thumb.style.transition = prevTransition || '';
    }
  }

  function setup(group) {
    if (group.__thumb) return;

    var thumb = document.createElement('span');
    thumb.className = 'segmented-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    group.insertBefore(thumb, group.firstChild);
    group.__thumb = thumb;

    place(group, false);

    var mo = new MutationObserver(function () {
      place(group, true);
    });
    Array.prototype.forEach.call(
      group.querySelectorAll('.segmented-option'),
      function (opt) {
        mo.observe(opt, { attributes: true, attributeFilter: ['class'] });
      }
    );

    // Reposition (without animating) whenever the control's geometry changes,
    // e.g. a slide panel opening or the viewport resizing.
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        place(group, false);
      });
      ro.observe(group);
    }
  }

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.segmented'),
      setup
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('resize', function () {
    Array.prototype.forEach.call(
      document.querySelectorAll('.segmented'),
      function (group) {
        place(group, false);
      }
    );
  });
})();
