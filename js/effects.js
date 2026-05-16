// Background "vibe" effects triggered after a calculation.
// Threshold is checked against fuel economy in canonical L/100km.
// Imperial inputs are already converted to metric upstream.

const LEAF_SVG = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M20 3 C9 7, 4 18, 7 30 C10 36, 18 38, 26 33 C36 26, 36 12, 20 3 Z"/>
  <path d="M20 6 Q19 18 14 30" stroke="rgba(0,0,0,0.18)" stroke-width="1" fill="none" stroke-linecap="round"/>
</svg>`;

const SMOKE_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <ellipse cx="18" cy="42" rx="14" ry="11"/>
  <ellipse cx="36" cy="34" rx="20" ry="15"/>
  <ellipse cx="50" cy="42" rx="13" ry="10"/>
  <ellipse cx="30" cy="22" rx="15" ry="12"/>
  <ellipse cx="44" cy="20" rx="10" ry="8"/>
</svg>`;

// Thresholds are in L/100km. Imperial values are normalised to metric before
// this function is called, so the same numbers apply universally.
//   <= 7 L/100km  (>= 33.6 MPG)  -> fresh green leaves
//   <= 13 L/100km (>= 18.1 MPG)  -> amber/brown autumn leaves
//   >  13 L/100km                -> plumes of smoke
function getEffectKind(economyL100km) {
  if (!Number.isFinite(economyL100km) || economyL100km <= 0) return null;
  if (economyL100km <= 7) return 'leaf-green';
  if (economyL100km <= 13) return 'leaf-amber';
  return 'smoke';
}

function spawnEffect(kind) {
  if (!kind) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.getElementById('effect-layer');
  if (!layer) return;

  // Clear any in-flight particles so re-calculations start fresh.
  layer.innerHTML = '';

  const isSmoke = kind === 'smoke';
  const svg = isSmoke ? SMOKE_SVG : LEAF_SVG;
  const count = isSmoke ? 7 : 11;

  // Slot-based placement so particles cover the viewport evenly instead of
  // randomly clumping. Smoke gets horizontal slots along the bottom edge;
  // leaves get vertical slots along the left edge.
  const slotSize = 100 / count;
  const order = [...Array(count).keys()].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = `effect-particle effect-${kind}`;
    el.innerHTML = svg;

    const slot = order[i];
    const jitter = (Math.random() - 0.5) * slotSize * 0.6;
    const slotted = slot * slotSize + slotSize / 2 + jitter;

    const size = isSmoke
      ? 100 + Math.random() * 88
      : 48 + Math.random() * 52;
    const rotStart = Math.random() * 360;
    const rotEnd = rotStart + (Math.random() - 0.5) * 540;
    const delay = Math.random() * 1500;
    const duration = (isSmoke ? 5800 : 6400) + Math.random() * 2000;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.setProperty('--rot-start', `${rotStart}deg`);
    el.style.setProperty('--rot-end', `${rotEnd}deg`);
    el.style.animationDelay = `${delay}ms`;
    el.style.animationDuration = `${duration}ms`;

    if (isSmoke) {
      // Smoke spawns along the bottom edge with a slight horizontal sway.
      const driftX = (Math.random() - 0.5) * 60;
      el.style.left = `${slotted}%`;
      el.style.setProperty('--drift-x', `${driftX}px`);
    } else {
      // Leaves spawn just off the left edge at staggered heights, then blow
      // rightward across the viewport while drifting downward.
      el.style.left = '-15%';
      el.style.top = `${Math.min(slotted * 0.85, 80)}%`;
      el.style.setProperty('--drift-x', `${115 + Math.random() * 25}vw`);
      el.style.setProperty('--drift-y', `${20 + Math.random() * 45}vh`);
    }

    layer.appendChild(el);

    setTimeout(() => el.remove(), delay + duration + 200);
  }
}

window.TripEffects = { spawnEffect, getEffectKind };
