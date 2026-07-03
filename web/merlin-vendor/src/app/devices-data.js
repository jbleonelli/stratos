// Mock device fleet — single site: Meridian HQ (50-floor office tower, SF)
// All devices battery-powered and BLE-only. Two display types: eInk and Touch eInk.

export const DEVICE_TYPES = {
  display_touch: {
    label: 'Touch eInk Display',
    short: 'Touch eInk',
    sku: 'ADX-TD-12',
    icon: 'display',
    desc: '12" touch eInk panel · LTE-M uplink + BLE aggregator · NFC check-in · 10 feedback buttons · 3-year battery',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  display_eink: {
    label: 'eInk Display',
    short: 'eInk',
    sku: 'ADX-ED-7',
    icon: 'display',
    desc: '7" passive eInk status panel · LTE-M uplink + BLE aggregator · 5-year battery',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  airq: {
    label: 'Air Quality',
    short: 'Air Q',
    sku: 'ADX-AQ-3',
    icon: 'air',
    desc: 'TVOC + CO\u2082 + PM 2.5 + humidity · BLE · 3-year battery',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  occupancy: {
    label: 'Occupancy Sensor',
    short: 'Occ',
    sku: 'ADX-OC-2',
    icon: 'people',
    desc: 'mmWave + PIR presence · BLE · 3-year battery',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  camera: {
    label: 'Camera',
    short: 'Cam',
    sku: 'ADX-CM-4K',
    icon: 'camera',
    desc: '4K edge-AI camera with on-device privacy blur · BLE event-only · 3-year Li-SOCl\u2082 D-cell pack',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  badge: {
    label: 'Badge Reader',
    short: 'Badge',
    sku: 'ADX-BR-1',
    icon: 'badge',
    desc: 'NFC + BLE dual-protocol reader · 3-year battery',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  leak: {
    label: 'Water Leak Sensor',
    short: 'Leak',
    sku: 'ADX-WL-1',
    icon: 'droplet',
    desc: 'Capacitive leak puck · 5-year battery · BLE',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  beacon: {
    label: 'Asset Beacon',
    short: 'Beacon',
    sku: 'ADX-AB-1',
    icon: 'beacon',
    desc: 'BLE 5.1 direction-finding beacon · 3-year coin cell',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  display_sdg: {
    label: 'Smart Display (eInk)',
    short: 'SDG',
    sku: 'ADX-SDG-7',
    icon: 'display',
    desc: '7" passive eInk restroom display · LTE-M uplink · NFC cleaning check-in · 5-year battery',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  pc_counter: {
    label: 'People Counter',
    short: 'PC',
    sku: 'ADX-PC-2',
    icon: 'people',
    desc: 'Dual mmWave + PIR entry/exit counter · LTE-M cellular · 3-year battery',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  smart_display_classic: {
    label: 'Smart Display Classic',
    short: 'SDC',
    sku: 'ADX-SDC-V1',
    icon: 'display',
    desc: '7" e-ink panel · 4 physical side buttons · embedded NFC reader · LTE backhaul · 3-year battery · manual on-site firmware update only',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  people_counter_basic: {
    label: 'People Counter Basic',
    short: 'PCB',
    sku: 'ADX-PCB-V1',
    icon: 'people',
    desc: 'PIR-only people counter · LTE backhaul · 3-year battery · interval reporting + programmable threshold trip · two variants (V1B BLE-updatable, V1L manual-only)',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  smart_logger_basic: {
    label: 'Smart Logger Basic',
    short: 'SLB',
    sku: 'ADX-SLB-V1',
    icon: 'badge',
    desc: '6-button service logger for cleaning + security crews · NFC badge reader · Begin / End service + 4 operator-configurable service buttons · LTE backhaul · 3-year battery',
    uplink: 'LTE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  parking_spot_sensor: {
    label: 'Parking Spot Sensor',
    short: 'PSS',
    sku: 'ADX-PSS-V1',
    icon: 'beacon',
    desc: 'In-ground BLE magnetometer puck \u00b7 per-spot occupancy detection \u00b7 5\u20137 year battery',
    uplink: 'BLE',
    power: 'battery',
    origin: 'adaptiv',
    manufacturer: 'Adaptiv Systems',
  },
  ev_charger: {
    label: 'EV Charger',
    short: 'EVC',
    sku: 'OCPP-1.6',
    icon: 'bolt',
    desc: '3rd-party OCPP-compatible charger \u00b7 session start/end + fault notifications \u00b7 wired AC or DC fast',
    uplink: 'OCPP/MQTT',
    power: 'wired',
    origin: 'third_party',
    manufacturer: 'Generic OCPP',
  },

  // ─── Third-party integrations (Phase H-8) ───
  // Vendor hardware Merlin reads / writes via a standard protocol.
  // Adaptiv doesn't manufacture or firmware-manage these; the device
  // detail page surfaces telemetry but updates flow through the vendor.
  bacnet_thermostat: {
    label: 'BACnet Thermostat',
    short: 'Thermostat',
    sku: 'SIE-RXC-12',
    icon: 'hvac',
    desc: 'Siemens RXC 12-zone BACnet/IP thermostat · writable setpoints · wired 24V',
    uplink: 'BACnet/IP',
    power: 'wired',
    origin: 'third_party',
    manufacturer: 'Siemens',
  },
  onvif_camera: {
    label: 'IP Camera (ONVIF)',
    short: 'IP Cam',
    sku: 'HIK-DS-2CD2',
    icon: 'camera',
    desc: 'Hikvision 4MP fixed dome · ONVIF Profile S/T · RTSP · PoE',
    uplink: 'ONVIF/RTSP',
    power: 'wired',
    origin: 'third_party',
    manufacturer: 'Hikvision',
  },
  hid_badge_reader: {
    label: 'HID Badge Reader',
    short: 'HID',
    sku: 'HID-iCLASS-SE',
    icon: 'badge',
    desc: 'HID iCLASS SE multiCLASS reader · 13.56 MHz · OSDP secure channel',
    uplink: 'OSDP',
    power: 'wired',
    origin: 'third_party',
    manufacturer: 'HID Global',
  },
};

export const ZONES = [
  { id: 'all', name: 'All floors', short: 'All' },
  { id: 'low', name: 'Floors 1–18', short: 'Low rise', floors: [1, 18] },
  { id: 'mid', name: 'Floors 19–36', short: 'Mid rise', floors: [19, 36] },
  { id: 'high', name: 'Floors 37–50', short: 'High rise', floors: [37, 50] },
  { id: 'bmech', name: 'Base · Mech', short: 'Base & mech' },
];

export const FIRMWARES = {
  display_touch: { stable: '4.12.1', rolling: '4.13.0-rc2' },
  display_eink: { stable: '2.4.0', rolling: '2.5.0-rc1' },
  airq: { stable: '2.8.4', rolling: '2.9.0' },
  occupancy: { stable: '1.6.0', rolling: null },
  camera: { stable: '7.2.3', rolling: '7.3.0-rc1' },
  badge: { stable: '3.1.8', rolling: null },
  leak: { stable: '1.2.0', rolling: null },
  beacon: { stable: '0.9.7', rolling: null },
  display_sdg: { stable: '3.8.10', rolling: '3.9.0-rc1' },
  pc_counter: { stable: '2.4.1', rolling: '2.5.0-rc2' },
};

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zoneForFloor(floor) {
  if (floor === 0) return 'bmech';
  if (floor <= 18) return 'low';
  if (floor <= 36) return 'mid';
  return 'high';
}

function buildFleet() {
  const rng = mulberry32(42);
  const r = (min, max) => min + rng() * (max - min);
  const ri = (min, max) => Math.floor(r(min, max));
  const pick = (arr) => arr[ri(0, arr.length)];

  const counts = {
    display_touch: 200,
    display_eink: 416,
    airq: 520,
    occupancy: 980,
    camera: 340,
    badge: 360,
    leak: 280,
    beacon: 680,
  };

  const roomsByType = {
    display_touch: (fl) => `Restroom ${fl < 10 ? 'W-0' + fl : 'W-' + fl}`,
    display_eink: (fl) => pick(['Conf Sycamore', 'Conf Alder', 'Lobby', 'Wayfinding', 'Huddle Oak']) + ' · Fl ' + fl,
    airq: (fl) => pick(['Conf Sycamore', 'Conf Alder', 'Conf Fir', 'Open Floor', 'Lounge']) + ' · Fl ' + fl,
    occupancy: (fl) => pick(['Phone Moss', 'Phone Fern', 'Phone Ivy', 'Conf Fir', 'Huddle Oak']) + ' · Fl ' + fl,
    camera: (fl) => (fl === 0 ? pick(['Lobby', 'Garage L2', 'Garage L3', 'Loading Dock B']) : `Stairwell N · Fl ${fl}`),
    badge: (fl) =>
      fl === 0
        ? pick(['Main Entrance', 'Dock B', 'Garage Elev'])
        : pick(['Server Rm', 'Staff Door', 'Roof Access']) + ' · Fl ' + fl,
    leak: (fl) => pick(['Pantry', 'Mech Rm', 'Riser Closet']) + ' · Fl ' + fl,
    beacon: () => pick(['Cart 3', 'Cart 7', 'Forklift 1', 'Cleaning Kit A', 'Defib Pack 2']),
  };

  const locationByFloor = (fl) => {
    if (fl === 0) return pick(['Lobby', 'Garage L2', 'Garage L3', 'Loading Dock', 'Roof']);
    if (fl <= 18) return `Floor ${fl} · ` + pick(['East', 'West', 'North', 'South']);
    if (fl <= 36) return `Floor ${fl} · ` + pick(['East', 'West', 'Core']);
    return `Floor ${fl} · ` + pick(['Executive', 'Rooftop Garden', 'Boardroom wing']);
  };

  // Every device has at least a 3-year battery life. No wiring, no recharges.
  const batteryLifeMonths = {
    display_touch: 36,
    display_eink: 60,
    airq: 36,
    occupancy: 36,
    camera: 36,
    badge: 36,
    leak: 60,
    beacon: 36,
  };

  const batteryChemistry = {
    display_touch: 'Li-SOCl\u2082 D-cell pack 17 Ah \u00b7 swappable',
    display_eink: 'LiFePO4 4000 mAh \u00b7 sealed',
    airq: '3\u00d7 AA lithium (LiFeS\u2082)',
    occupancy: 'Li-SOCl\u2082 C-cell',
    camera: 'Li-SOCl\u2082 D-cell pack \u00b7 event-only wake',
    badge: '2\u00d7 CR123A \u00b7 3V lithium',
    leak: 'CR2477 \u00b7 3V lithium',
    beacon: 'CR2032 \u00b7 coin cell',
  };

  const fleet = [];
  let n = 0;

  const rollStatus = () => {
    const roll = rng();
    if (roll < 0.04) return 'offline';
    if (roll < 0.09) return 'degraded';
    if (roll < 0.13) return 'updating';
    if (roll < 0.155) return 'provisioning';
    return 'online';
  };

  // LTE telemetry for Smart Displays (they act as LTE uplink to the internet).
  const lteCarriers = ['T-Mobile IoT', 'Verizon ThingSpace', 'AT&T IoT', 'Soracom Flat'];
  const lteBands = ['B2 (1900 MHz)', 'B4 (AWS-1)', 'B12 (700 MHz)', 'B13 (700 MHz)', 'B25 (1900 MHz)'];
  const buildLte = (status) => {
    if (status === 'offline') {
      return {
        carrier: pick(lteCarriers),
        tech: 'LTE-M (Cat-M1)',
        band: pick(lteBands),
        rsrp: null,
        rsrq: null,
        sinr: null,
        imei: `35${ri(1000000, 9999999)}${ri(10000, 99999)}`,
        iccid: `8901410${ri(10000000000, 99999999999)}`,
        apn: 'iot.adaptivsystems.net',
        ip: null,
        cell_id: null,
        tac: null,
        data_mb_mtd: +(rng() * 40).toFixed(1),
        last_connect_s: ri(3600, 48 * 3600),
        online: false,
      };
    }
    const rsrp = -(70 + ri(0, 35)); // -70 (strong) to -105 (weak)
    const rsrq = -(5 + ri(0, 15)); // -5 (good) to -20 (poor)
    const sinr = status === 'degraded' ? ri(-5, 5) : ri(5, 25);
    return {
      carrier: pick(lteCarriers),
      tech: 'LTE-M (Cat-M1)',
      band: pick(lteBands),
      rsrp,
      rsrq,
      sinr,
      imei: `35${ri(1000000, 9999999)}${ri(10000, 99999)}`,
      iccid: `8901410${ri(10000000000, 99999999999)}`,
      apn: 'iot.adaptivsystems.net',
      ip: `10.42.${ri(0, 256)}.${ri(1, 254)}`,
      cell_id: `0x${ri(1048576, 16777215).toString(16).toUpperCase()}`,
      tac: ri(1000, 9999),
      data_mb_mtd: +(2 + rng() * 45).toFixed(1),
      last_connect_s: status === 'online' ? ri(1, 30) : ri(30, 600),
      online: true,
    };
  };

  const touchIds = [];
  const touchByFloor = {};
  let placed = 0;
  while (placed < counts.display_touch) {
    for (let fl = 1; fl <= 50 && placed < counts.display_touch; fl++) {
      n++;
      placed++;
      const floor = fl;
      const zone = zoneForFloor(floor);
      const id = `ADX-TD-${String(n).padStart(4, '0')}`;
      touchIds.push(id);
      (touchByFloor[floor] = touchByFloor[floor] || []).push(id);

      const status = rollStatus();
      const fw = FIRMWARES.display_touch;
      const onRolling = fw.rolling && rng() < 0.35;
      const fwCurrent = onRolling ? fw.rolling : fw.stable;
      const uptime =
        status === 'online'
          ? 97 + rng() * 3
          : status === 'degraded'
            ? 85 + rng() * 10
            : status === 'offline'
              ? 40 + rng() * 30
              : 92 + rng() * 7;
      const batteryPct = status === 'offline' ? ri(0, 10) : ri(30, 100);
      const daysPerPct = (batteryLifeMonths.display_touch * 30) / 100;

      fleet.push({
        id,
        type: 'display_touch',
        floor,
        zone,
        location: `Floor ${floor} · ` + pick(['East', 'West', 'North', 'South']),
        room: `Restroom ${floor < 10 ? 'W-0' + floor : 'W-' + floor}`,
        status,
        uplink: 'LTE', // internet uplink is cellular
        ble_role: 'aggregator', // also BLE scanner+relay for nearby sensors
        lte: buildLte(status),
        rssi: status === 'offline' ? null : -(55 + ri(0, 30)),
        ble_children: 0,
        battery: batteryPct,
        battery_days_remaining: Math.round(batteryPct * daysPerPct),
        battery_chemistry: batteryChemistry.display_touch,
        battery_swappable: true,
        embedded: {
          nfc: status !== 'offline',
          temp_c: status === 'offline' ? null : +(20 + rng() * 6).toFixed(1),
          noise_db: status === 'offline' ? null : +(42 + rng() * 24).toFixed(0),
          light_lux: status === 'offline' ? null : ri(120, 680),
          accel_g: status === 'offline' ? null : +(0.02 + rng() * 0.04).toFixed(2),
          buttons: 10,
        },
        display_tech: '12" eInk 32-level grayscale · capacitive touch overlay',
        firmware: fwCurrent,
        fw_latest: fw.rolling || fw.stable,
        fw_behind: onRolling ? false : !!fw.rolling,
        fw_updating: status === 'updating',
        fw_progress: status === 'updating' ? ri(12, 88) : null,
        uptime: +uptime.toFixed(1),
        last_packet_s: status === 'offline' ? ri(3600, 48 * 3600) : ri(1, 60),
        install_date: `2024-${String(ri(1, 6)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
        error:
          status === 'offline'
            ? pick([
                { code: 'E-042', msg: 'No BLE heartbeat 42m \u00b7 battery check' },
                { code: 'E-101', msg: 'Battery dead \u00b7 last voltage 3.1V' },
              ])
            : status === 'degraded'
              ? pick([
                  { code: 'W-017', msg: 'BLE packet loss 18% \u00b7 RF interference' },
                  { code: 'W-031', msg: 'NFC reader intermittent' },
                  { code: 'W-008', msg: 'Battery warm 38°C' },
                ])
              : null,
      });
    }
  }

  const otherTypes = ['display_eink', 'airq', 'occupancy', 'camera', 'badge', 'leak', 'beacon'];
  otherTypes.forEach((type) => {
    const total = counts[type];
    const life = batteryLifeMonths[type];

    for (let i = 0; i < total; i++) {
      n++;
      let floor;
      if (type === 'camera') floor = pick([0, 0, 0, 1, 12, 18, 24, 32, 41]);
      else if (type === 'badge') floor = pick([0, 0, 1, 12, 18, 24, 32, 41, 50]);
      else if (type === 'leak') floor = pick([0, 12, 18, 24, 32, 41]);
      else if (type === 'beacon') floor = pick([0, 0, 1, 12, 32]);
      else floor = ri(1, 51);

      const zone = zoneForFloor(floor);
      const location = locationByFloor(floor);
      const room = roomsByType[type](floor);

      const status = rollStatus();
      const fw = FIRMWARES[type];
      const onRolling = fw.rolling && rng() < 0.35;
      const fwCurrent = onRolling ? fw.rolling : fw.stable;
      const uptime =
        status === 'online'
          ? 97 + rng() * 3
          : status === 'degraded'
            ? 85 + rng() * 10
            : status === 'offline'
              ? 40 + rng() * 30
              : 92 + rng() * 7;
      const batteryPct = status === 'offline' ? ri(0, 10) : ri(25, 100);
      const daysPerPct = (life * 30) / 100;

      let aggregator_id = null;
      let nearestFl = floor;
      for (let off = 0; off <= 50; off++) {
        if (touchByFloor[floor - off] && touchByFloor[floor - off].length) {
          nearestFl = floor - off;
          break;
        }
        if (touchByFloor[floor + off] && touchByFloor[floor + off].length) {
          nearestFl = floor + off;
          break;
        }
      }
      const candidates = touchByFloor[nearestFl] || touchIds;
      if (candidates.length) aggregator_id = candidates[ri(0, candidates.length)];

      const isDisplayEink = type === 'display_eink';
      fleet.push({
        id: `ADX-${DEVICE_TYPES[type].sku.split('-')[1]}-${String(n).padStart(4, '0')}`,
        type,
        floor,
        zone,
        location,
        room,
        status,
        uplink: isDisplayEink ? 'LTE' : 'BLE',
        ...(isDisplayEink ? { ble_role: 'aggregator', lte: buildLte(status), ble_children: 0 } : {}),
        aggregator_id: isDisplayEink ? null : aggregator_id,
        rssi: status === 'offline' ? null : -(50 + ri(0, 40)),
        battery: batteryPct,
        battery_days_remaining: Math.round(batteryPct * daysPerPct),
        battery_chemistry: batteryChemistry[type],
        battery_swappable: type !== 'camera' && type !== 'display_eink',
        firmware: fwCurrent,
        fw_latest: fw.rolling || fw.stable,
        fw_behind: onRolling ? false : !!fw.rolling,
        fw_updating: status === 'updating',
        fw_progress: status === 'updating' ? ri(12, 88) : null,
        uptime: +uptime.toFixed(1),
        last_packet_s: status === 'offline' ? ri(3600, 48 * 3600) : ri(1, 120),
        temp_c: status === 'offline' ? null : +(20 + rng() * 8).toFixed(1),
        install_date: `2024-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
        display_tech: type === 'display_eink' ? '7" eInk 16-level grayscale · no backlight' : null,
        error: (() => {
          if (status === 'offline')
            return pick([
              { code: 'E-042', msg: 'No BLE heartbeat 42m \u00b7 aggregator reachable' },
              { code: 'E-101', msg: 'Battery dead \u00b7 last voltage 3.1V' },
            ]);
          if (status === 'degraded')
            return pick([
              { code: 'W-017', msg: 'BLE packet loss 22% \u00b7 RSSI -91 dBm' },
              { code: 'W-031', msg: 'Sensor drift \u00b7 recalibration due' },
              { code: 'W-008', msg: 'Battery low · 14 days remaining' },
            ]);
          return null;
        })(),
      });
    }
  });

  const childCount = {};
  fleet.forEach((d) => {
    if (d.aggregator_id) childCount[d.aggregator_id] = (childCount[d.aggregator_id] || 0) + 1;
  });
  fleet.forEach((d) => {
    if (d.type === 'display_touch' || d.type === 'display_eink') d.ble_children = childCount[d.id] || 0;
  });

  return fleet;
}

export const FLEET = buildFleet();

export const DEPLOYMENTS = [
  {
    id: 'd-012',
    name: 'Floors 32–36 · Touch eInk panel refresh',
    type: 'display_touch',
    zone: 'mid',
    stages: { planned: 24, shipped: 24, installing: 8, live: 16 },
    eta: 'Thu Apr 25',
    owner: 'Priya K.',
    pct: 0.66,
  },
  {
    id: 'd-011',
    name: 'Floor 32 · Occupancy expansion',
    type: 'occupancy',
    zone: 'mid',
    stages: { planned: 18, shipped: 18, installing: 4, live: 14 },
    eta: 'Fri Apr 26',
    owner: 'Marcus T.',
    pct: 0.78,
  },
  {
    id: 'd-010',
    name: 'Mech rooms · Leak sensor coverage',
    type: 'leak',
    zone: 'bmech',
    stages: { planned: 12, shipped: 12, installing: 12, live: 0 },
    eta: 'Tomorrow',
    owner: 'Alicia V.',
    pct: 0.55,
  },
  {
    id: 'd-009',
    name: 'Lobby + Garage · Camera firmware v7.3.0-rc1',
    type: 'camera',
    zone: 'bmech',
    stages: { planned: 16, shipped: 16, installing: 0, live: 12 },
    eta: 'Wed Apr 24',
    owner: 'Koji O.',
    pct: 0.72,
    firmware: true,
  },
  {
    id: 'd-008',
    name: 'Tower-wide · eInk wayfinding rollout',
    type: 'display_eink',
    zone: 'all',
    stages: { planned: 48, shipped: 48, installing: 14, live: 28 },
    eta: 'Mon Apr 29',
    owner: 'Marcus T.',
    pct: 0.7,
  },
];

export const DEVICE_ALERTS = [
  {
    id: 'm-1',
    icon: 'warn',
    tone: 'risk',
    title: 'Predicted failure',
    body: 'ADX-AQ-0018 \u2014 calibration drift predicts failure in 3 days. Reorder now?',
    cta: 'Reorder clone',
  },
  {
    id: 'm-2',
    icon: 'bolt',
    tone: 'warn',
    title: 'Battery cluster',
    body: '12 water-leak sensors on Floor 24 below 20%. Bundle a swap visit?',
    cta: 'Schedule swap',
  },
  {
    id: 'm-3',
    icon: 'check',
    tone: 'ok',
    title: 'Rollout complete',
    body: 'Camera v7.2.3 \u2192 7.3.0-rc1 finished in Lobby + Garage. 0 regressions in 6h.',
    cta: 'View rollout',
  },
];
