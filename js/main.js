(function () {
  const { computeFromMetric, toMetricTrip, parseTripInputs } = window.TripCalc;
  const { countUp, animateAllCounts, animateUpdateCounts, hasPendingCountUpdates } = window.TripAnim;
  const {
    loadSettings, saveSettings, getCo2Factor, getFuelLabel,
    distanceToMetric, priceToMetric, economyToMetric, economyFromMetric,
  } = window.TripSettings;
  const {
    loadVehicles, saveVehicles, generateId,
    getEconomyForStyle, vehicleDisplayName,
  } = window.TripVehicles;
  const { spawnEffect, getEffectKind } = window.TripEffects;

  // ---------- DOM ----------
  const form = document.getElementById('trip-form');
  const savedForm = document.getElementById('saved-form');
  const savedEmpty = document.getElementById('saved-empty');
  const savedContent = document.getElementById('saved-content');
  const vehiclePicker = document.getElementById('vehicle-picker');
  const inputScreen = document.getElementById('input-screen');
  const resultsScreen = document.getElementById('results-screen');
  const tripMeta = document.getElementById('trip-meta');
  const resetButton = document.getElementById('reset-button');

  const settingsButton = document.getElementById('settings-button');
  const settingsClose = document.getElementById('settings-close');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsScrim = document.getElementById('settings-scrim');
  const settingsVehicleList = document.getElementById('settings-vehicle-list');
  const addVehicleButton = document.getElementById('add-vehicle-button');
  const themeToggle = document.getElementById('theme-toggle');

  const vehicleEditor = document.getElementById('vehicle-editor');
  const vehicleForm = document.getElementById('vehicle-form');
  const editorTitle = document.getElementById('editor-title');
  const editorClose = document.getElementById('editor-close');
  const vehicleDeleteBtn = document.getElementById('vehicle-delete');

  // ---------- State ----------
  let settings = loadSettings();
  let vehicles = loadVehicles();
  let lastTripMetric = null;
  let lastTripFuelOverride = null;     // vehicle.fuelType when last calc was from saved mode
  let lastTripVehicleName = null;      // populated for saved-mode calcs
  let editingVehicleId = null;
  let editorSelectedFuel = 'gasoline';

  // ---------- Screen helpers ----------
  function showScreen(screen) {
    for (const s of [inputScreen, resultsScreen]) {
      const isActive = s === screen;
      s.classList.toggle('active', isActive);
      s.setAttribute('aria-hidden', String(!isActive));
    }
  }
  function isResultsActive() { return resultsScreen.classList.contains('active'); }

  // ---------- Unit labels / placeholders ----------
  const UNIT_LABELS = {
    metric:   { economy: 'L / 100 km', distance: 'kilometres', priceTitle: 'Gas price', priceHint: '$ per litre',  fuelSuffix: 'L',   fuelSub: 'Litres burned on the road' },
    imperial: { economy: 'miles per gallon', distance: 'miles', priceTitle: 'Gas price', priceHint: '$ per gallon', fuelSuffix: 'gal', fuelSub: 'Gallons burned on the road' },
  };
  const PLACEHOLDERS = {
    metric:   { economy: '8.5', distance: '42', price: '1.659' },
    imperial: { economy: '28',  distance: '26', price: '4.20'  },
  };
  const VEHICLE_PLACEHOLDERS = {
    metric:   { highway: '6.5', city: '8.2' },
    imperial: { highway: '36',  city: '29'  },
  };

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    const isDark = settings.theme === 'dark';
    document.querySelector('[data-theme-hint]').textContent = isDark ? 'On' : 'Off';
    themeToggle.setAttribute('aria-pressed', String(isDark));
  }

  function applyFuelCo2Hints({ animate = false } = {}) {
    const LITRES_PER_US_GALLON = 3.785411784;
    const FADE_MS = 300;
    const COUNT_MS = 600;
    const isImperial = settings.units === 'imperial';
    const unit = isImperial ? 'gal' : 'L';

    document.querySelectorAll('[data-fuel]').forEach((btn) => {
      const numEl = btn.querySelector('.co2-number');
      const unitEl = btn.querySelector('.co2-unit');
      if (!numEl || !unitEl) return;

      const factor = getCo2Factor(btn.dataset.fuel);
      const target = isImperial ? factor * LITRES_PER_US_GALLON : factor;
      const suffix = btn.dataset.fuel === 'natural-gas' ? '-equiv.' : '';
      const newUnitText = `${unit}${suffix}`;

      if (!animate) {
        numEl.textContent = target.toFixed(2);
        unitEl.textContent = newUnitText;
        return;
      }

      const current = parseFloat(numEl.textContent) || 0;
      if (Math.abs(target - current) > 0.005) {
        countUp(numEl, target, { from: current, decimals: 2, duration: COUNT_MS });
      } else {
        numEl.textContent = target.toFixed(2);
      }

      if (unitEl.textContent !== newUnitText) {
        unitEl.classList.add('is-fading');
        setTimeout(() => {
          unitEl.textContent = newUnitText;
          unitEl.classList.remove('is-fading');
        }, FADE_MS);
      }
    });
  }

  function applySettingsToUI(options = {}) {
    applyTheme();

    const labels = UNIT_LABELS[settings.units];
    const placeholders = PLACEHOLDERS[settings.units];

    // Manual form
    document.querySelector('[data-hint="economy"]').textContent = labels.economy;
    document.querySelector('[data-hint="distance"]').textContent = labels.distance;
    document.querySelector('[data-title="price"]').textContent = labels.priceTitle;
    document.querySelector('[data-hint="price"]').textContent = labels.priceHint;
    document.getElementById('economy').placeholder = placeholders.economy;
    document.getElementById('distance').placeholder = placeholders.distance;
    document.getElementById('price').placeholder = placeholders.price;

    // Saved form
    document.querySelector('[data-hint="distance-saved"]').textContent = labels.distance;
    document.querySelector('[data-title="price-saved"]').textContent = labels.priceTitle;
    document.querySelector('[data-hint="price-saved"]').textContent = labels.priceHint;
    document.getElementById('saved-distance').placeholder = placeholders.distance;
    document.getElementById('saved-price').placeholder = placeholders.price;

    // Vehicle editor
    document.querySelectorAll('[data-vehicle-hint]').forEach((el) => { el.textContent = labels.economy; });
    document.getElementById('vehicle-highway').placeholder = VEHICLE_PLACEHOLDERS[settings.units].highway;
    document.getElementById('vehicle-city').placeholder = VEHICLE_PLACEHOLDERS[settings.units].city;

    // Results card labels
    document.querySelector('[data-suffix="fuel"]').textContent = labels.fuelSuffix;
    document.querySelector('[data-sub="fuel"]').textContent = labels.fuelSub;

    // CO2 subtitle reflects the "effective" fuel — when results are showing
    // a saved-vehicle calc, the override pins the subtitle to the vehicle's fuel.
    const effectiveFuel = lastTripFuelOverride || settings.fuelType;
    const isImperial = settings.units === 'imperial';
    const LITRES_PER_US_GALLON = 3.785411784;
    const co2Factor = getCo2Factor(effectiveFuel) * (isImperial ? LITRES_PER_US_GALLON : 1);
    const volumeUnit = isImperial ? 'gallon' : 'litre';
    document.querySelector('[data-sub="co2"]').textContent =
      `Roughly ${co2Factor.toFixed(2)} kg per ${volumeUnit} of ${getFuelLabel(effectiveFuel)}`;

    applyFuelCo2Hints({ animate: options.animateFuelCo2 });

    // Sync radio-style controls
    document.querySelectorAll('[data-units]').forEach((btn) => {
      const active = btn.dataset.units === settings.units;
      btn.setAttribute('aria-checked', String(active));
      btn.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-fuel]').forEach((btn) => {
      const active = btn.dataset.fuel === settings.fuelType;
      btn.setAttribute('aria-checked', String(active));
      btn.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-home-mode]').forEach((btn) => {
      const active = btn.dataset.homeMode === settings.homeMode;
      btn.setAttribute('aria-checked', String(active));
      btn.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-style]').forEach((btn) => {
      const active = btn.dataset.style === settings.drivingStyle;
      btn.setAttribute('aria-checked', String(active));
      btn.classList.toggle('is-active', active);
    });

    renderSettingsVehicleList();
    renderVehiclePicker();
    applyHomePane();
  }

  // ---------- Home pane switching ----------
  function applyHomePane() {
    document.querySelectorAll('.home-pane').forEach((p) => {
      p.hidden = p.dataset.pane !== settings.homeMode;
    });
    updateSavedTabVisibility();
  }

  function updateSavedTabVisibility() {
    const hasAny = vehicles.length > 0;
    savedEmpty.hidden = hasAny;
    savedContent.hidden = !hasAny;
  }

  // ---------- Vehicle pickers ----------
  function getSelectedVehicle() {
    if (!vehicles.length) return null;
    if (settings.selectedVehicleId) {
      const found = vehicles.find((v) => v.id === settings.selectedVehicleId);
      if (found) return found;
    }
    return vehicles[0];
  }

  function vehicleTitle(v) {
    return [v.make, v.model].filter(Boolean).join(' ').trim() || 'Vehicle';
  }

  function vehicleSubtext(v) {
    return v.year ? String(v.year) : '';
  }

  function renderSettingsVehicleList() {
    if (!settingsVehicleList) return;
    settingsVehicleList.innerHTML = '';

    if (!vehicles.length) {
      const empty = document.createElement('p');
      empty.className = 'settings-footnote';
      empty.style.textAlign = 'left';
      empty.style.margin = '4px 4px 8px';
      empty.textContent = 'No vehicles saved yet.';
      settingsVehicleList.appendChild(empty);
      return;
    }

    vehicles.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'vehicle-row';

      const info = document.createElement('div');
      info.className = 'vehicle-info';
      const name = document.createElement('span');
      name.className = 'vehicle-name';
      name.textContent = vehicleTitle(v);
      const meta = document.createElement('span');
      meta.className = 'vehicle-meta';
      meta.textContent = vehicleSubtext(v);
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'vehicle-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'icon-button-sm';
      editBtn.setAttribute('aria-label', `Edit ${vehicleDisplayName(v)}`);
      editBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>`;
      editBtn.addEventListener('click', () => openEditor(v.id));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'icon-button-sm danger';
      delBtn.setAttribute('aria-label', `Delete ${vehicleDisplayName(v)}`);
      delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>`;
      delBtn.addEventListener('click', async () => {
        const ok = await window.TripDialog.confirmDialog({
          title: 'Delete this vehicle?',
          message: `${vehicleDisplayName(v)} will be removed. This can't be undone.`,
          confirmText: 'Delete',
          cancelText: 'Cancel',
          danger: true,
        });
        if (ok) deleteVehicle(v.id);
      });

      actions.append(editBtn, delBtn);
      row.append(info, actions);
      settingsVehicleList.appendChild(row);
    });
  }

  function renderVehiclePicker() {
    if (!vehiclePicker) return;
    vehiclePicker.innerHTML = '';
    if (!vehicles.length) return;

    const selectedId = getSelectedVehicle()?.id;

    vehicles.forEach((v) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-row';
      btn.setAttribute('role', 'radio');
      btn.dataset.vehicleId = v.id;

      const isActive = v.id === selectedId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-checked', String(isActive));

      btn.innerHTML = `
        <span class="option-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 17h11V8H5z" />
            <path d="M16 11h3l2 3v3h-5" />
            <circle cx="8" cy="17.5" r="1.5" />
            <circle cx="17" cy="17.5" r="1.5" />
          </svg>
        </span>
        <span class="option-text">
          <span class="option-title">${escapeHtml(vehicleTitle(v))}</span>
          <span class="option-hint">${escapeHtml(vehicleSubtext(v))}</span>
        </span>
        <span class="option-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11" /></svg>
        </span>
      `;

      btn.addEventListener('click', () => {
        if (settings.selectedVehicleId === v.id) return;
        settings = { ...settings, selectedVehicleId: v.id };
        saveSettings(settings);
        renderVehiclePicker();
      });

      vehiclePicker.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ---------- Vehicle editor ----------
  function syncEditorFuelUI() {
    document.querySelectorAll('[data-vehicle-fuel]').forEach((btn) => {
      const active = btn.dataset.vehicleFuel === editorSelectedFuel;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }

  function openEditor(vehicleId = null) {
    editingVehicleId = vehicleId;
    const v = vehicleId ? vehicles.find((x) => x.id === vehicleId) : null;

    editorTitle.textContent = v ? 'Edit vehicle' : 'New vehicle';
    vehicleDeleteBtn.hidden = !v;

    if (v) {
      vehicleForm.year.value = v.year ?? '';
      vehicleForm.make.value = v.make ?? '';
      vehicleForm.model.value = v.model ?? '';
      vehicleForm.highway.value = formatEconomyForInput(v.highwayEconomyL100km);
      vehicleForm.city.value = formatEconomyForInput(v.cityEconomyL100km);
      editorSelectedFuel = v.fuelType;
    } else {
      vehicleForm.reset();
      editorSelectedFuel = 'gasoline';
    }

    syncEditorFuelUI();

    vehicleEditor.classList.add('is-open');
    vehicleEditor.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  function closeEditor() {
    vehicleEditor.classList.remove('is-open');
    vehicleEditor.setAttribute('aria-hidden', 'true');
    editingVehicleId = null;
    // Only release scroll lock if the settings panel beneath isn't also open.
    if (!settingsPanel.classList.contains('is-open')) {
      document.body.classList.remove('no-scroll');
    }
  }

  function formatEconomyForInput(metricValue) {
    const v = economyFromMetric(metricValue, settings.units);
    return parseFloat(v.toFixed(1)).toString();
  }

  function saveVehicleFromEditor() {
    const fd = new FormData(vehicleForm);
    const year = parseInt(fd.get('year'), 10);
    const make = String(fd.get('make') || '').trim();
    const model = String(fd.get('model') || '').trim();
    const highwayRaw = parseFloat(fd.get('highway'));
    const cityRaw = parseFloat(fd.get('city'));

    if (!Number.isFinite(year) || year < 1900 || year > 2099 || !make || !model
        || !Number.isFinite(highwayRaw) || highwayRaw <= 0
        || !Number.isFinite(cityRaw) || cityRaw <= 0) {
      vehicleForm.reportValidity();
      return;
    }

    const highwayEconomyL100km = economyToMetric(highwayRaw, settings.units);
    const cityEconomyL100km = economyToMetric(cityRaw, settings.units);

    if (editingVehicleId) {
      const idx = vehicles.findIndex((v) => v.id === editingVehicleId);
      if (idx >= 0) {
        vehicles[idx] = {
          ...vehicles[idx],
          year, make, model,
          highwayEconomyL100km, cityEconomyL100km,
          fuelType: editorSelectedFuel,
        };
      }
    } else {
      const created = {
        id: generateId(),
        year, make, model,
        highwayEconomyL100km, cityEconomyL100km,
        fuelType: editorSelectedFuel,
      };
      vehicles.push(created);
      if (!settings.selectedVehicleId) {
        settings = { ...settings, selectedVehicleId: created.id };
        saveSettings(settings);
      }
    }

    saveVehicles(vehicles);
    renderSettingsVehicleList();
    renderVehiclePicker();
    updateSavedTabVisibility();
    closeEditor();
  }

  function deleteVehicle(id) {
    vehicles = vehicles.filter((v) => v.id !== id);
    saveVehicles(vehicles);
    if (settings.selectedVehicleId === id) {
      settings = { ...settings, selectedVehicleId: vehicles[0]?.id ?? null };
      saveSettings(settings);
    }
    renderSettingsVehicleList();
    renderVehiclePicker();
    updateSavedTabVisibility();
  }

  // ---------- Result targets / animation ----------
  function setResultTargets({ cost, fuelUsed, co2 }) {
    const targets = [
      { selector: '.result-cost .count', value: cost },
      { selector: '.result-fuel .count', value: fuelUsed },
      { selector: '.result-co2 .count',  value: co2 },
    ];
    for (const { selector, value } of targets) {
      const el = resultsScreen.querySelector(selector);
      if (el) el.dataset.target = String(value);
    }
  }

  function renderResultsInitial(result) {
    setResultTargets(result);
    resultsScreen.querySelectorAll('.count').forEach((el) => { el.textContent = '0.00'; });
    animateAllCounts(resultsScreen);
  }

  function formatTripDistance() {
    if (!lastTripMetric) return null;
    const isImperial = settings.units === 'imperial';
    const value = isImperial ? lastTripMetric.distanceKm / 1.609344 : lastTripMetric.distanceKm;
    const unit = isImperial ? 'mi' : 'km';
    const rounded = parseFloat(value.toFixed(1));
    return `${rounded} ${unit}`;
  }

  function formatTripPrice() {
    if (!lastTripMetric) return null;
    const isImperial = settings.units === 'imperial';
    const value = isImperial ? lastTripMetric.pricePerL * 3.785411784 : lastTripMetric.pricePerL;
    const unit = isImperial ? '/gal' : '/L';
    const decimals = isImperial ? 2 : 3;
    return `$${value.toFixed(decimals)}${unit}`;
  }

  function renderTripMeta() {
    if (!tripMeta) return;
    if (!lastTripMetric) {
      tripMeta.hidden = true;
      tripMeta.innerHTML = '';
      return;
    }
    const items = [];
    if (lastTripVehicleName) {
      items.push({ text: lastTripVehicleName, truncate: true });
    }
    const distanceLabel = formatTripDistance();
    if (distanceLabel) items.push({ text: distanceLabel });
    const priceLabel = formatTripPrice();
    if (priceLabel) items.push({ text: priceLabel });

    tripMeta.innerHTML = items
      .map(({ text, truncate }) => {
        const cls = truncate ? 'trip-meta-item trip-meta-item--truncate' : 'trip-meta-item';
        return `<span class="${cls}">${escapeHtml(text)}</span>`;
      })
      .join('');
    tripMeta.hidden = items.length === 0;
  }

  function effectiveSettings() {
    return lastTripFuelOverride
      ? { ...settings, fuelType: lastTripFuelOverride }
      : settings;
  }

  function refreshResultTargetsFromSettings() {
    if (!lastTripMetric) return;
    setResultTargets(computeFromMetric(lastTripMetric, effectiveSettings()));
    renderTripMeta();
  }

  // ---------- Form-value unit conversion ----------
  function setFieldValue(field, value, decimals) {
    if (!Number.isFinite(value) || value <= 0) return;
    field.value = parseFloat(value.toFixed(decimals)).toString();
  }

  function convertFieldsInForm(form, fromUnits, toUnits) {
    const { economy, distance, price, highway, city } = form;
    if (economy) {
      const v = parseFloat(economy.value);
      if (Number.isFinite(v) && v > 0) {
        // MPG <-> L/100km is the same reciprocal formula in both directions.
        setFieldValue(economy, 235.214583 / v, 1);
      }
    }
    if (distance) {
      const v = parseFloat(distance.value);
      if (Number.isFinite(v) && v > 0) {
        setFieldValue(distance, toUnits === 'imperial' ? v / 1.609344 : v * 1.609344, 1);
      }
    }
    if (price) {
      const v = parseFloat(price.value);
      if (Number.isFinite(v) && v > 0) {
        const decimals = toUnits === 'imperial' ? 2 : 3;
        setFieldValue(price, toUnits === 'imperial' ? v * 3.785411784 : v / 3.785411784, decimals);
      }
    }
    if (highway) {
      const v = parseFloat(highway.value);
      if (Number.isFinite(v) && v > 0) setFieldValue(highway, 235.214583 / v, 1);
    }
    if (city) {
      const v = parseFloat(city.value);
      if (Number.isFinite(v) && v > 0) setFieldValue(city, 235.214583 / v, 1);
    }
  }

  function convertAllFormValues(fromUnits, toUnits) {
    if (fromUnits === toUnits) return;
    convertFieldsInForm(form, fromUnits, toUnits);
    convertFieldsInForm(savedForm, fromUnits, toUnits);
    convertFieldsInForm(vehicleForm, fromUnits, toUnits);
  }

  // ---------- Settings panel ----------
  function openSettings() {
    settingsPanel.classList.add('is-open');
    settingsScrim.classList.add('is-open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    settingsScrim.setAttribute('aria-hidden', 'false');
    settingsButton.setAttribute('aria-expanded', 'true');
    document.body.classList.add('no-scroll');
  }

  function closeSettings() {
    settingsPanel.classList.remove('is-open');
    settingsScrim.classList.remove('is-open');
    settingsPanel.setAttribute('aria-hidden', 'true');
    settingsScrim.setAttribute('aria-hidden', 'true');
    settingsButton.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll');

    if (isResultsActive() && hasPendingCountUpdates(resultsScreen)) {
      animateUpdateCounts(resultsScreen);
    }
  }

  settingsButton.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsScrim.addEventListener('click', closeSettings);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (window.TripDialog?.isOpen()) { window.TripDialog.dismiss(); return; }
    if (vehicleEditor.classList.contains('is-open')) { closeEditor(); return; }
    if (settingsPanel.classList.contains('is-open')) { closeSettings(); }
  });

  // ---------- Editor wiring ----------
  addVehicleButton.addEventListener('click', () => openEditor(null));
  editorClose.addEventListener('click', closeEditor);
  vehicleForm.addEventListener('submit', (e) => { e.preventDefault(); saveVehicleFromEditor(); });
  vehicleDeleteBtn.addEventListener('click', async () => {
    if (!editingVehicleId) return;
    const v = vehicles.find((x) => x.id === editingVehicleId);
    if (!v) return;
    const ok = await window.TripDialog.confirmDialog({
      title: 'Delete this vehicle?',
      message: `${vehicleDisplayName(v)} will be removed. This can't be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (ok) {
      deleteVehicle(editingVehicleId);
      closeEditor();
    }
  });
  document.querySelectorAll('[data-vehicle-fuel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorSelectedFuel = btn.dataset.vehicleFuel;
      syncEditorFuelUI();
    });
  });

  // ---------- Settings option clicks ----------
  document.querySelectorAll('[data-units]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.units;
      if (settings.units === next) return;
      const prev = settings.units;
      settings = { ...settings, units: next };
      saveSettings(settings);
      convertAllFormValues(prev, next);
      applySettingsToUI({ animateFuelCo2: true });
      refreshResultTargetsFromSettings();
    });
  });

  document.querySelectorAll('[data-fuel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (settings.fuelType === btn.dataset.fuel) return;
      settings = { ...settings, fuelType: btn.dataset.fuel };
      saveSettings(settings);
      applySettingsToUI();
      // Only recompute results if the current trip wasn't pinned to a vehicle.
      if (!lastTripFuelOverride) refreshResultTargetsFromSettings();
    });
  });

  themeToggle.addEventListener('click', () => {
    settings = { ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' };
    saveSettings(settings);
    applyTheme();
  });

  // ---------- Home-screen tab toggle ----------
  document.querySelectorAll('[data-home-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (settings.homeMode === btn.dataset.homeMode) return;
      settings = { ...settings, homeMode: btn.dataset.homeMode };
      saveSettings(settings);
      applySettingsToUI();
    });
  });

  // ---------- Driving style ----------
  document.querySelectorAll('[data-style]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (settings.drivingStyle === btn.dataset.style) return;
      settings = { ...settings, drivingStyle: btn.dataset.style };
      saveSettings(settings);
      document.querySelectorAll('[data-style]').forEach((b) => {
        const active = b.dataset.style === settings.drivingStyle;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-checked', String(active));
      });
    });
  });

  // ---------- Manual form submit ----------
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const inputs = parseTripInputs(data);
    if (!inputs.isValid) { form.reportValidity(); return; }

    lastTripMetric = toMetricTrip(inputs, settings);
    lastTripFuelOverride = null;
    lastTripVehicleName = null;
    const result = computeFromMetric(lastTripMetric, settings);
    showScreen(resultsScreen);
    applySettingsToUI(); // refresh CO2 subtitle based on current fuel
    renderTripMeta();
    renderResultsInitial(result);
    spawnEffect(getEffectKind(lastTripMetric.economyL100km));
  });

  // ---------- Saved-vehicle form submit ----------
  savedForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const vehicle = getSelectedVehicle();
    if (!vehicle) return;

    const distance = parseFloat(document.getElementById('saved-distance').value);
    const price = parseFloat(document.getElementById('saved-price').value);
    if (!Number.isFinite(distance) || distance <= 0 || !Number.isFinite(price) || price <= 0) {
      savedForm.reportValidity();
      return;
    }

    const economyL100km = getEconomyForStyle(vehicle, settings.drivingStyle);
    lastTripMetric = {
      economyL100km,
      distanceKm: distanceToMetric(distance, settings.units),
      pricePerL: priceToMetric(price, settings.units),
    };
    lastTripFuelOverride = vehicle.fuelType;
    lastTripVehicleName = vehicleTitle(vehicle);
    const result = computeFromMetric(lastTripMetric, effectiveSettings());

    showScreen(resultsScreen);
    applySettingsToUI(); // CO2 subtitle now reflects vehicle's fuel
    renderTripMeta();
    renderResultsInitial(result);
    spawnEffect(getEffectKind(economyL100km));
  });

  // ---------- Reset ----------
  resetButton.addEventListener('click', () => {
    form.reset();
    savedForm.reset();
    lastTripMetric = null;
    lastTripFuelOverride = null;
    lastTripVehicleName = null;
    renderTripMeta();
    showScreen(inputScreen);
    applySettingsToUI();
    if (settings.homeMode === 'manual') {
      form.querySelector('#economy')?.focus({ preventScroll: true });
    }
  });

  applySettingsToUI();
})();
