// Settings: units, fuel type, theme, plus home-screen mode and saved-vehicle
// selection state. Persisted in localStorage.

const STORAGE_KEY = 'trip-cost-settings-v1';

const DEFAULTS = {
  units: 'metric',           // 'metric' | 'imperial'
  fuelType: 'gasoline',      // 'gasoline' | 'diesel' | 'natural-gas'  (Manual-mode default)
  theme: 'light',            // 'light' | 'dark'
  homeMode: 'manual',        // 'manual' | 'saved'
  selectedVehicleId: null,
  drivingStyle: 'combined',  // 'highway' | 'city' | 'combined'
};

// CO2 per litre is governed by the fuel's carbon content. Emissions equipment
// (DPF, SCR, EGR) targets NOx and particulates, not CO2.
const CO2_FACTORS = {
  'gasoline': 2.31,
  'diesel': 2.68,
  'natural-gas': 1.94, // per litre-gasoline-equivalent
};

const FUEL_LABELS = {
  'gasoline': 'gasoline',
  'diesel': 'diesel',
  'natural-gas': 'natural gas',
};

// Conversion constants.
const KM_PER_MILE = 1.609344;
const LITRES_PER_US_GALLON = 3.785411784;
const MPG_TO_L100KM = 235.214583;

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);

    // Migrate legacy fuel keys.
    let fuelType = parsed.fuelType;
    if (fuelType === 'diesel-pre' || fuelType === 'diesel-post') fuelType = 'diesel';
    if (!CO2_FACTORS[fuelType]) fuelType = 'gasoline';

    let drivingStyle = parsed.drivingStyle;
    if (!['highway', 'city', 'combined'].includes(drivingStyle)) drivingStyle = 'combined';

    let homeMode = parsed.homeMode;
    if (!['manual', 'saved'].includes(homeMode)) homeMode = 'manual';

    return {
      units: parsed.units === 'imperial' ? 'imperial' : 'metric',
      fuelType,
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      homeMode,
      selectedVehicleId: typeof parsed.selectedVehicleId === 'string' ? parsed.selectedVehicleId : null,
      drivingStyle,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

function getCo2Factor(fuelType) {
  return CO2_FACTORS[fuelType] ?? CO2_FACTORS.gasoline;
}

function getFuelLabel(fuelType) {
  return FUEL_LABELS[fuelType] ?? FUEL_LABELS.gasoline;
}

function toMetric({ economy, distance, price }, units) {
  if (units === 'imperial') {
    return {
      economyL100km: MPG_TO_L100KM / economy,
      distanceKm: distance * KM_PER_MILE,
      pricePerL: price / LITRES_PER_US_GALLON,
    };
  }
  return {
    economyL100km: economy,
    distanceKm: distance,
    pricePerL: price,
  };
}

function fuelVolumeForDisplay(litres, units) {
  return units === 'imperial' ? litres / LITRES_PER_US_GALLON : litres;
}

// Per-field unit conversions for cases where we have a partial trip
// (e.g., entering only distance + price on the Saved Vehicles tab).
function distanceToMetric(value, units) {
  return units === 'imperial' ? value * KM_PER_MILE : value;
}
function priceToMetric(value, units) {
  return units === 'imperial' ? value / LITRES_PER_US_GALLON : value;
}
function economyToMetric(value, units) {
  return units === 'imperial' ? MPG_TO_L100KM / value : value;
}
function economyFromMetric(metricValue, units) {
  return units === 'imperial' ? MPG_TO_L100KM / metricValue : metricValue;
}

window.TripSettings = {
  DEFAULTS,
  loadSettings,
  saveSettings,
  getCo2Factor,
  getFuelLabel,
  toMetric,
  fuelVolumeForDisplay,
  distanceToMetric,
  priceToMetric,
  economyToMetric,
  economyFromMetric,
};
