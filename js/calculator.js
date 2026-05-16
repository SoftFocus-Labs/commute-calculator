// Calculation logic for fuel cost, fuel used, and carbon emissions.
// Accepts raw inputs in whatever units the user has selected; converts
// internally to metric and applies the active fuel's CO2 factor.

function parseTripInputs(formData) {
  const economy = parseFloat(formData.get('economy'));
  const distance = parseFloat(formData.get('distance'));
  const price = parseFloat(formData.get('price'));

  const isValid =
    Number.isFinite(economy) && economy > 0 &&
    Number.isFinite(distance) && distance > 0 &&
    Number.isFinite(price) && price > 0;

  return { economy, distance, price, isValid };
}

function toMetricTrip(inputs, settings) {
  return window.TripSettings.toMetric(inputs, settings.units);
}

// Compute display-ready results from a trip already normalized to metric.
// Splitting this out lets us re-derive results when settings change without
// asking the user to re-enter their inputs.
function computeFromMetric(metric, settings) {
  const { getCo2Factor, fuelVolumeForDisplay } = window.TripSettings;
  const { economyL100km, distanceKm, pricePerL } = metric;

  const litresUsed = (economyL100km * distanceKm) / 100;
  const cost = litresUsed * pricePerL;
  const co2 = litresUsed * getCo2Factor(settings.fuelType);

  return {
    cost,
    fuelUsed: fuelVolumeForDisplay(litresUsed, settings.units),
    co2,
  };
}

function calculateTrip(inputs, settings) {
  return computeFromMetric(toMetricTrip(inputs, settings), settings);
}

window.TripCalc = { calculateTrip, computeFromMetric, toMetricTrip, parseTripInputs };
