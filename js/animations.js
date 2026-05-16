// Count-up animation for result numbers.

const DEFAULT_DURATION = 900;
const UPDATE_DURATION = 600;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function countUp(element, target, { duration = DEFAULT_DURATION, decimals = 2, from = 0 } = {}) {
  if (prefersReducedMotion()) {
    element.textContent = target.toFixed(decimals);
    return;
  }

  const start = performance.now();
  const delta = target - from;

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const value = from + delta * easeOutCubic(progress);
    element.textContent = value.toFixed(decimals);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      element.textContent = target.toFixed(decimals);
    }
  }

  requestAnimationFrame(frame);
}

// Initial reveal: every count starts at zero, staggered for rhythm.
function animateAllCounts(root) {
  const nodes = root.querySelectorAll('.count');
  nodes.forEach((node, i) => {
    const target = parseFloat(node.dataset.target ?? '0');
    const decimals = parseInt(node.dataset.decimals ?? '2', 10);
    const delay = 120 + i * 80;
    setTimeout(() => countUp(node, target, { decimals }), delay);
  });
}

// Settings-change update: every count tweens from its currently-displayed
// value to the new data-target, all in sync, slightly snappier than the
// initial reveal.
function animateUpdateCounts(root) {
  const nodes = root.querySelectorAll('.count');
  nodes.forEach((node) => {
    const target = parseFloat(node.dataset.target ?? '0');
    const decimals = parseInt(node.dataset.decimals ?? '2', 10);
    const from = parseFloat(node.textContent) || 0;
    if (Math.abs(target - from) < 0.005) {
      node.textContent = target.toFixed(decimals);
      return;
    }
    countUp(node, target, { decimals, from, duration: UPDATE_DURATION });
  });
}

function hasPendingCountUpdates(root) {
  for (const node of root.querySelectorAll('.count')) {
    const target = parseFloat(node.dataset.target ?? '0');
    const current = parseFloat(node.textContent) || 0;
    if (Math.abs(target - current) > 0.005) return true;
  }
  return false;
}

window.TripAnim = { countUp, animateAllCounts, animateUpdateCounts, hasPendingCountUpdates };
