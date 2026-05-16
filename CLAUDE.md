# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A mobile-optimized, single-page commute cost calculator. Users enter fuel economy, distance, and gas price (or pick a saved vehicle) and get back trip cost, fuel used, and CO₂ emissions. Static HTML/CSS/JS — no framework, no build step, no package manager.

## Running locally

Just open `index.html` in a browser. The scripts are plain `<script>` tags (deliberately not ES modules), so `file://` works in both Chrome and Safari.

For development with live reload or to test something that needs HTTP (e.g., service workers later), serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

There is no test suite, linter, or build pipeline.

## Architecture

### Module pattern

Each JS file is a small IIFE-or-similar that publishes a single namespace on `window` (e.g., `window.TripSettings`, `window.TripVehicles`). `main.js` pulls those namespaces apart in its prologue and wires everything together. **Script load order in `index.html` matters** — `main.js` must be last because it consumes every other module.

Current order: `settings.js` → `vehicles.js` → `calculator.js` → `animations.js` → `effects.js` → `dialog.js` → `main.js`.

### Canonical units rule

All persisted and in-flight trip data is stored in **metric** (L/100 km, km, $/L) regardless of what the user has selected in settings. Conversion to/from imperial happens only at the UI boundary:

- `TripSettings.toMetric()` / `economyToMetric` / `distanceToMetric` / `priceToMetric` — converting user input
- `TripSettings.economyFromMetric()` / `fuelVolumeForDisplay()` — preparing values for display
- Vehicle records store `highwayEconomyL100km` and `cityEconomyL100km` — never raw MPG

Switching units in the settings panel calls `convertAllFormValues()` to translate whatever the user has half-typed across every form (manual, saved, vehicle editor) into the new units.

### Result re-derivation

After a calculation, `main.js` stashes `lastTripMetric = { economyL100km, distanceKm, pricePerL }` plus an optional `lastTripFuelOverride`. Any subsequent settings change (units, fuel type) triggers `refreshResultTargetsFromSettings()` which calls `TripCalc.computeFromMetric()` with the new effective settings and updates `data-target` on the count elements. When the settings panel closes, `TripAnim.animateUpdateCounts()` checks whether the displayed values diverge from the targets and tweens them — that's how the results screen "live updates" without requiring the user to re-enter anything.

### Fuel-type override

CO₂ per litre is governed by fuel chemistry, so a saved vehicle has its own `fuelType` that should win over the global setting whenever results are showing a saved-vehicle trip. This is what `lastTripFuelOverride` is for. The global fuel-type segmented in settings only affects manual-mode calculations — changing it while looking at a saved-vehicle result is intentionally a no-op for the CO₂ readout. See `effectiveSettings()` and the `[data-fuel]` click handler in `main.js`.

### Animation primitives

- **`countUp(el, target, { from, decimals, duration })`** in `animations.js` — the building block. Set `from` to tween between values rather than from zero. Respects `prefers-reduced-motion`. The results screen uses two flavors: `animateAllCounts` (staggered reveal from zero on first render) and `animateUpdateCounts` (synchronized retarget, used after settings changes).
- **Slide panels** (`.slide-panel` in `styles.css`) — generic full-screen slide-in/out used by both the settings panel and the vehicle editor. Editor is at `z-index: 60`, settings at `50`, so the editor stacks above. **Do not change `.slide-panel` to `display: flex`** — there's a long-standing Chrome+Safari bug where a flex container with `overflow-y: auto` drops the inner element's `padding-bottom` from the scrollable area. The panel uses block layout with `margin: 0 auto` on `.settings-inner` for that reason (comment in the CSS).
- **Visibility transition trick** — `.slide-panel` delays `visibility: hidden` by the full duration of the slide-out so the panel stays painted while transforming off-screen. The `is-open` rule reverses the delay.
- **Confirm modal** (`.confirm-modal` in `styles.css`, `dialog.js`) — backdrop fades; card uses two distinct keyframes: `confirm-in` (translateY + opacity) for open, `confirm-out` (scale + opacity) for close. `dialog.js` exposes a Promise-based `confirmDialog({ title, message, danger })` — always prefer it over `window.confirm`.

### Background effects (`effects.js`)

After every calculation, `spawnEffect(getEffectKind(lastTripMetric.economyL100km))` drops ambient particles. Thresholds are checked against **L/100 km** (imperial inputs have already been normalized by this point):

- `≤ 7` → green leaves (blow across from left, fall diagonally)
- `≤ 13` → amber leaves (same motion)
- `> 13` → smoke plumes (rise from bottom)

Particles are positioned in "slots" (vertical bands for leaves, horizontal bands for smoke) to keep distribution even, then jittered within each slot. The effect layer is a fixed full-viewport `<div>` at `z-index: 0` that sits behind `.app` (`z-index: 1`).

### z-index stack (top to bottom)

```
70  .confirm-modal
60  .editor-panel (vehicle editor)
50  .slide-panel  (settings)
40  .settings-scrim
 1  .app
 0  #effect-layer
```

### CSS quirks worth knowing

- **`[hidden] { display: none !important }`** at the top of `styles.css` is intentional — `.card-stack`, `.empty-state`, and `#saved-content` are all flex containers, so the HTML `hidden` attribute would otherwise lose specificity ties and not actually hide the element. Keep that rule.
- **Theme switching** — colors are CSS custom properties on `:root` for light, overridden on `[data-theme='dark']`. `main.js` sets `document.documentElement.setAttribute('data-theme', settings.theme)`. Always reference colors through the `--ink`, `--surface`, `--accent`, `--warn`, etc. variables — hard-coded colors break dark mode.

### Storage

Two localStorage keys, both versioned in their name so the schema can be incremented later:

- `trip-cost-settings-v1` — `{ units, fuelType, theme, homeMode, selectedVehicleId, drivingStyle }`
- `trip-cost-vehicles-v1` — array of vehicle records

`loadSettings()` in `settings.js` includes a migration path for legacy `diesel-pre` / `diesel-post` fuel keys (collapsed to `diesel`). When adding fields, default safely in the loader so older stored data doesn't break.
