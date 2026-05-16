# Trip Cost

A mobile-first commute cost calculator. Enter your vehicle's fuel economy, the distance you drove, and your local gas price — get back the trip's dollar cost, fuel used, and CO₂ emissions.

Built as a single static page: HTML, CSS, vanilla JavaScript. No frameworks, no build step, no tracking, no server. Settings and saved vehicles live entirely in your browser's `localStorage`.

## Features

- **Manual mode** — quick one-off calculation from fuel economy, distance, and gas price
- **Saved Vehicles mode** — store your vehicles (year/make/model, highway + city economy, fuel type) and just enter distance + price for repeat trips
- **Driving style** for saved vehicles — Highway, City, or Combined (EPA-style 55%/45% weighting)
- **Metric & Imperial units** — toggle between L/100km/km/$L and MPG/mi/$gal at any time; values throughout the app convert in place
- **Fuel types** — Gasoline, Diesel, and Natural Gas (CNG), each with its own CO₂ factor
- **Light & dark themes**
- **Ambient feedback** — leaves drift across the screen for efficient trips, smoke rises for less-efficient ones
- **Persistent settings** — all preferences and vehicles are stored locally in your browser

## Running it

Just open `index.html` in any modern browser — works directly from the filesystem.

For development with a local server:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

Tested in current Chrome and Safari.

## How it calculates

- **Fuel used** = economy × distance ÷ 100 (in L/100 km × km)
- **Cost** = fuel used × price per litre
- **CO₂** = fuel used × fuel-specific emission factor:
  - Gasoline: 2.31 kg CO₂/L
  - Diesel: 2.68 kg CO₂/L
  - Natural gas (CNG): 1.94 kg CO₂/L-equivalent

Imperial inputs (MPG, miles, $/gallon) are converted to metric internally before calculation, so the same factors apply regardless of which unit system you use.

CO₂ factors are determined by the carbon content of the fuel, not by emissions equipment — pre-emissions and post-emissions diesel engines emit essentially the same CO₂ per litre. Emissions equipment (DPF, SCR, EGR) targets NOx and particulates.

For saved vehicles, the "Combined" driving style uses an EPA-style weighting of 55% city economy + 45% highway economy.

## Privacy

Nothing leaves your device. There's no analytics, no API calls, no fonts loaded with tracking parameters beyond what Google Fonts itself does for Inter. Vehicle and settings data live in your browser's `localStorage` under the keys `trip-cost-settings-v1` and `trip-cost-vehicles-v1`.

## Project structure

```
.
├── index.html       # markup + inline SVG icons
├── styles.css       # full stylesheet, including light/dark theme tokens
├── js/
│   ├── settings.js     # settings storage + unit conversion helpers
│   ├── vehicles.js     # saved-vehicle storage (CRUD)
│   ├── calculator.js   # pure calculation logic
│   ├── animations.js   # count-up number animations
│   ├── effects.js      # background leaf / smoke effects
│   ├── dialog.js       # promise-based confirmation modal
│   └── main.js         # DOM wiring + UI orchestration
└── CLAUDE.md        # architecture notes for AI coding assistants
```

Each JS file attaches a single namespace to `window` (e.g., `window.TripSettings`). `main.js` consumes them all and must be loaded last.
