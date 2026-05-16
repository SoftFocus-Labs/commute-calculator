// Saved vehicles: CRUD over localStorage. Economy values are always stored in
// metric (L/100 km) so toggling units in settings doesn't corrupt data.

const VEHICLES_KEY = 'trip-cost-vehicles-v1';
const VALID_FUEL_TYPES = ['gasoline', 'diesel', 'natural-gas'];

function isValidVehicle(v) {
  return v && typeof v === 'object'
    && typeof v.id === 'string'
    && Number.isFinite(v.highwayEconomyL100km) && v.highwayEconomyL100km > 0
    && Number.isFinite(v.cityEconomyL100km) && v.cityEconomyL100km > 0
    && VALID_FUEL_TYPES.includes(v.fuelType);
}

function loadVehicles() {
  try {
    const raw = localStorage.getItem(VEHICLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidVehicle) : [];
  } catch {
    return [];
  }
}

function saveVehicles(list) {
  try {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function generateId() {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// EPA-style weighted blend for the "combined" driving style.
function getCombinedEconomy(vehicle) {
  return 0.55 * vehicle.cityEconomyL100km + 0.45 * vehicle.highwayEconomyL100km;
}

function getEconomyForStyle(vehicle, style) {
  if (style === 'highway') return vehicle.highwayEconomyL100km;
  if (style === 'city') return vehicle.cityEconomyL100km;
  return getCombinedEconomy(vehicle);
}

function vehicleDisplayName(v) {
  return [v.year, v.make, v.model].filter(Boolean).join(' ').trim() || 'Vehicle';
}

window.TripVehicles = {
  loadVehicles, saveVehicles, generateId,
  getCombinedEconomy, getEconomyForStyle, vehicleDisplayName,
};
