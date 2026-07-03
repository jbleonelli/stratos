// Ecosystem dataset — First Empire Bank · 578 branches across New York State.
// Each branch has one Touch eInk Smart Display at the teller area.
//
// ECOSYSTEM_ROLLOUTS.started/eta + ECOSYSTEM_INSTALL_CALENDAR.date fields
// are rebased via demo-dates.rebase() at module load so the calendar
// always reads "this week-ish" no matter how long since the mocks were
// authored. Relative gaps inside the file are preserved.

import { rebase } from './demo-dates.js';

// Cities used for both branch distribution and on-map labels.
const NY_CITIES = [
  // NYC boroughs
  { name: 'Manhattan', lat: 40.7831, lng: -73.9712, count: 80, label: true, spread: 0.04 },
  { name: 'Brooklyn', lat: 40.6782, lng: -73.9442, count: 50, label: true, spread: 0.05 },
  { name: 'Queens', lat: 40.7282, lng: -73.7949, count: 30, label: true, spread: 0.05 },
  { name: 'Bronx', lat: 40.8448, lng: -73.8648, count: 15, spread: 0.03 },
  { name: 'Staten Island', lat: 40.5795, lng: -74.1502, count: 5, spread: 0.04 },
  // Long Island
  { name: 'Hempstead', lat: 40.7063, lng: -73.6187, count: 20, spread: 0.04 },
  { name: 'Huntington', lat: 40.8687, lng: -73.4257, count: 18, spread: 0.06 },
  { name: 'Brentwood', lat: 40.7817, lng: -73.2465, count: 12, spread: 0.06 },
  { name: 'Levittown', lat: 40.7259, lng: -73.5143, count: 10, spread: 0.04 },
  { name: 'Hicksville', lat: 40.7684, lng: -73.5251, count: 10, spread: 0.04 },
  { name: 'Freeport', lat: 40.6576, lng: -73.5832, count: 10, spread: 0.04 },
  // Westchester / Hudson Valley
  { name: 'Yonkers', lat: 40.9313, lng: -73.8987, count: 15, spread: 0.04 },
  { name: 'White Plains', lat: 41.034, lng: -73.7629, count: 12, spread: 0.04 },
  { name: 'New Rochelle', lat: 40.9115, lng: -73.7824, count: 10, spread: 0.03 },
  { name: 'Poughkeepsie', lat: 41.7004, lng: -73.9209, count: 10, spread: 0.06 },
  { name: 'Kingston', lat: 41.927, lng: -73.9974, count: 8, spread: 0.05 },
  { name: 'Newburgh', lat: 41.5034, lng: -74.0104, count: 5, spread: 0.04 },
  // Capital Region
  { name: 'Albany', lat: 42.6526, lng: -73.7562, count: 30, label: true, spread: 0.05 },
  { name: 'Schenectady', lat: 42.8142, lng: -73.9396, count: 10, spread: 0.04 },
  { name: 'Troy', lat: 42.7284, lng: -73.6918, count: 10, spread: 0.04 },
  // Central NY
  { name: 'Syracuse', lat: 43.0481, lng: -76.1474, count: 35, label: true, spread: 0.06 },
  { name: 'Utica', lat: 43.1009, lng: -75.2327, count: 10, spread: 0.06 },
  // Finger Lakes / Rochester
  { name: 'Rochester', lat: 43.1566, lng: -77.6088, count: 40, label: true, spread: 0.07 },
  { name: 'Ithaca', lat: 42.444, lng: -76.5019, count: 8, spread: 0.05 },
  { name: 'Geneva', lat: 42.8695, lng: -76.9869, count: 7, spread: 0.05 },
  // Western NY
  { name: 'Buffalo', lat: 42.8864, lng: -78.8784, count: 40, label: true, spread: 0.07 },
  { name: 'Niagara Falls', lat: 43.0962, lng: -79.0377, count: 10, spread: 0.04 },
  { name: 'Jamestown', lat: 42.097, lng: -79.2353, count: 10, spread: 0.06 },
  // Southern Tier
  { name: 'Binghamton', lat: 42.0987, lng: -75.918, count: 15, spread: 0.06 },
  { name: 'Elmira', lat: 42.0898, lng: -76.8077, count: 8, spread: 0.05 },
  { name: 'Corning', lat: 42.1428, lng: -77.0545, count: 7, spread: 0.05 },
  // North Country
  { name: 'Watertown', lat: 43.9748, lng: -75.9108, count: 10, spread: 0.05 },
  { name: 'Plattsburgh', lat: 44.6995, lng: -73.4529, count: 8, spread: 0.05 },
];

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBranches() {
  const rng = mulberry32(17);
  const ri = (min, max) => Math.floor(min + rng() * (max - min));
  const pick = (arr) => arr[ri(0, arr.length)];

  const streetNames = [
    'Main',
    'Broadway',
    'Park',
    'Madison',
    'State',
    'Washington',
    'Jefferson',
    'Lincoln',
    'Maple',
    'Oak',
    'Chestnut',
    'Elm',
    'Market',
    'Church',
    'Center',
    'Mill',
    'Pine',
    'Spring',
    'Pearl',
    'River',
    'Lake',
    'Hudson',
    'Clinton',
    'Franklin',
    'Grand',
    'High',
  ];
  const streetTypes = ['St', 'Ave', 'Blvd', 'Rd', 'Pkwy', 'Ln', 'Dr'];
  const suite = ['Suite 100', 'Ground Floor', 'Retail Level', 'Plaza Level', 'Concourse'];

  const branches = [];
  let id = 0;

  NY_CITIES.forEach((city) => {
    for (let i = 0; i < city.count; i++) {
      id++;
      // Scatter coordinates within the city's spread (lat/lng degrees).
      const lat = city.lat + (rng() - 0.5) * city.spread;
      const lng = city.lng + (rng() - 0.5) * city.spread;

      const roll = rng();
      const status = roll < 0.015 ? 'offline' : roll < 0.05 ? 'degraded' : roll < 0.09 ? 'updating' : 'online';

      const streetNum = ri(100, 8500);
      const streetName = pick(streetNames);
      const streetType = pick(streetTypes);
      const rating = +(3.8 + rng() * 1.2).toFixed(2); // 3.80 – 5.00
      const visitors7d = 180 + ri(0, 1600);

      branches.push({
        id: `FEB-${String(id).padStart(4, '0')}`,
        name: `${city.name} \u00b7 ${streetName} ${streetType}`,
        address: `${streetNum} ${streetName} ${streetType}${rng() < 0.3 ? `, ${pick(suite)}` : ''}`,
        city: city.name,
        state: 'NY',
        zip: `${10000 + ri(0, 4899)}`,
        lat,
        lng,
        status,
        display_id: `ADX-TD-${String(id + 5000).padStart(4, '0')}`,
        display_fw: status === 'updating' ? '4.13.0-rc2' : '4.12.1',
        battery: status === 'offline' ? ri(0, 8) : ri(28, 100),
        last_seen_min: status === 'offline' ? ri(60, 48 * 60) : ri(0, 45),
        rating,
        visitors_7d: visitors7d,
      });
    }
  });

  return branches;
}

export const BRANCHES = buildBranches();

// ════════════════════════════════════════════════════════════════════
// Ecosystem-wide datasets built from the branch fleet. Everything below
// assumes "First Empire Bank · NY" is the selected location.
// ════════════════════════════════════════════════════════════════════

// Region mapping from city → zone ID.
const REGION_BY_CITY = {
  Manhattan: 'nyc',
  Brooklyn: 'nyc',
  Queens: 'nyc',
  Bronx: 'nyc',
  'Staten Island': 'nyc',
  Hempstead: 'li',
  Huntington: 'li',
  Brentwood: 'li',
  Levittown: 'li',
  Hicksville: 'li',
  Freeport: 'li',
  Yonkers: 'hudson',
  'White Plains': 'hudson',
  'New Rochelle': 'hudson',
  Poughkeepsie: 'hudson',
  Kingston: 'hudson',
  Newburgh: 'hudson',
  Albany: 'capital',
  Schenectady: 'capital',
  Troy: 'capital',
  Syracuse: 'central',
  Utica: 'central',
  Rochester: 'finger',
  Ithaca: 'finger',
  Geneva: 'finger',
  Buffalo: 'western',
  'Niagara Falls': 'western',
  Jamestown: 'western',
  Binghamton: 'southern',
  Elmira: 'southern',
  Corning: 'southern',
  Watertown: 'north',
  Plattsburgh: 'north',
};

export const ECOSYSTEM_ZONES = [
  { id: 'all', name: 'All regions', short: 'All' },
  { id: 'nyc', name: 'NYC Metro', short: 'NYC' },
  { id: 'li', name: 'Long Island', short: 'Long Island' },
  { id: 'hudson', name: 'Hudson Valley', short: 'Hudson' },
  { id: 'capital', name: 'Capital Region', short: 'Capital' },
  { id: 'central', name: 'Central NY', short: 'Central' },
  { id: 'finger', name: 'Finger Lakes', short: 'Finger Lakes' },
  { id: 'western', name: 'Western NY', short: 'Western' },
  { id: 'southern', name: 'Southern Tier', short: 'Southern' },
  { id: 'north', name: 'North Country', short: 'North' },
];

// ───────── fleet derived from branches ─────────

const LTE_BANDS = ['B2 (1900 MHz)', 'B4 (AWS-1)', 'B12 (700 MHz)', 'B13 (700 MHz)', 'B25 (1900 MHz)'];
const LTE_CARRIERS = ['T-Mobile IoT', 'Verizon ThingSpace', 'AT&T IoT', 'Soracom Flat'];

function seededRng(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ECOSYSTEM_FLEET = BRANCHES.map((b, i) => {
  const rng = seededRng(997 + i * 13);
  const ri = (min, max) => Math.floor(min + rng() * (max - min));
  const pick = (arr) => arr[ri(0, arr.length)];

  const online = b.status !== 'offline';
  const rssi = online ? -(55 + ri(0, 35)) : null;
  const daysPerPct = (36 * 30) / 100; // 3-year battery
  const batteryDays = Math.round(b.battery * daysPerPct);

  return {
    id: b.display_id,
    type: 'display_touch',
    floor: 0,
    zone: REGION_BY_CITY[b.city] || 'all',
    city: b.city,
    state: 'NY',
    zip: b.zip,
    branch_id: b.id,
    branch_name: b.name,
    location: `${b.address}, ${b.city}, NY ${b.zip}`,
    room: 'Customer restroom',
    status: b.status,
    uplink: 'LTE',
    ble_role: 'standalone',
    ble_children: 0,
    aggregator_id: null,
    lte: {
      carrier: pick(LTE_CARRIERS),
      tech: 'LTE-M (Cat-M1)',
      band: pick(LTE_BANDS),
      rsrp: rssi,
      rsrq: online ? -(6 + ri(0, 12)) : null,
      sinr: b.status === 'degraded' ? ri(-3, 6) : online ? ri(8, 22) : null,
      imei: `35${ri(1000000, 9999999)}${ri(10000, 99999)}`,
      iccid: `8901410${ri(10000000000, 99999999999)}`,
      apn: 'iot.adaptivsystems.net',
      ip: online ? `10.42.${ri(0, 256)}.${ri(1, 254)}` : null,
      cell_id: online ? `0x${ri(1048576, 16777215).toString(16).toUpperCase()}` : null,
      tac: online ? ri(1000, 9999) : null,
      data_mb_mtd: +(3 + rng() * 40).toFixed(1),
      last_connect_s: b.last_seen_min * 60,
      online,
    },
    rssi,
    battery: b.battery,
    battery_days_remaining: batteryDays,
    battery_chemistry: 'Li-SOCl\u2082 D-cell pack \u00b7 swappable',
    battery_swappable: true,
    firmware: b.display_fw,
    fw_latest: '4.13.0-rc2',
    fw_behind: b.display_fw !== '4.13.0-rc2',
    fw_updating: b.status === 'updating',
    fw_progress: b.status === 'updating' ? ri(15, 85) : null,
    uptime: +(
      b.status === 'online'
        ? 97 + rng() * 3
        : b.status === 'degraded'
          ? 85 + rng() * 10
          : b.status === 'offline'
            ? 40 + rng() * 30
            : 92 + rng() * 7
    ).toFixed(1),
    last_packet_s: b.last_seen_min * 60,
    temp_c: online ? +(20 + rng() * 4).toFixed(1) : null,
    install_date: `2024-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
    display_tech: '12" eInk 32-level grayscale \u00b7 capacitive touch overlay',
    embedded: {
      nfc: online,
      temp_c: online ? +(20 + rng() * 4).toFixed(1) : null,
      noise_db: online ? 45 + ri(0, 20) : null,
      light_lux: online ? ri(300, 700) : null,
      accel_g: online ? +(0.02 + rng() * 0.03).toFixed(2) : null,
      buttons: 10,
    },
    error:
      b.status === 'offline'
        ? { code: 'E-042', msg: 'No LTE heartbeat \u00b7 battery check required' }
        : b.status === 'degraded'
          ? pick([
              { code: 'W-017', msg: 'LTE packet loss 18% \u00b7 weak signal' },
              { code: 'W-031', msg: 'Touch response degraded' },
              { code: 'W-008', msg: 'Battery trending below 20%' },
            ])
          : null,
    _rating: b.rating,
    _visitors_7d: b.visitors_7d,
  };
});

const _ecoCounts = { total: ECOSYSTEM_FLEET.length, online: 0, degraded: 0, offline: 0, updating: 0, provisioning: 0 };
ECOSYSTEM_FLEET.forEach((d) => {
  _ecoCounts[d.status] = (_ecoCounts[d.status] || 0) + 1;
});
export const ECOSYSTEM_FLEET_COUNTS = _ecoCounts;

// ───────── satisfaction aggregated from branch ratings ─────────

const _ecoRatings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
BRANCHES.forEach((b) => {
  const visitors = Math.floor(b.visitors_7d * 0.06); // ~6% of visitors rate
  const ratio = (b.rating - 1) / 4;
  // Distribute by weighted lognormal-ish
  const fives = Math.floor(visitors * Math.max(0, ratio - 0.35) * 1.5);
  const fours = Math.floor(visitors * 0.45);
  const threes = Math.floor(visitors * 0.12);
  const twos = Math.floor(visitors * 0.05);
  const ones = visitors - fives - fours - threes - twos;
  _ecoRatings[5] += Math.max(0, fives);
  _ecoRatings[4] += Math.max(0, fours);
  _ecoRatings[3] += Math.max(0, threes);
  _ecoRatings[2] += Math.max(0, twos);
  _ecoRatings[1] += Math.max(0, ones);
});
{
  const total = Object.values(_ecoRatings).reduce((a, b) => a + b, 0);
  const avg =
    (5 * _ecoRatings[5] + 4 * _ecoRatings[4] + 3 * _ecoRatings[3] + 2 * _ecoRatings[2] + 1 * _ecoRatings[1]) / total;
  const t = [avg - 0.14, avg - 0.1, avg - 0.06, avg - 0.04, avg - 0.02, avg - 0.01, avg];
  var ECOSYSTEM_SATISFACTION_OBJ = {
    ratings: _ecoRatings,
    trend: t.map((v) => +v.toFixed(2)),
  };
}
export const ECOSYSTEM_SATISFACTION = ECOSYSTEM_SATISFACTION_OBJ;

// ───────── incidents — display-only scope ─────────
// Every incident must be something a Touch eInk display can actually detect:
// cleaning NFC taps (or absence of them), supply button presses, customer ratings,
// embedded sensors (temp/noise/light/accel), or the display's own health
// (LTE signal, battery, firmware, tamper).

export const ECOSYSTEM_INCIDENTS = [
  {
    id: 'ib-001',
    priority: 'critical',
    icon: 'warn',
    title: 'Display offline \u2014 Manhattan \u00b7 34th St',
    sub: 'LTE heartbeat lost 47m ago \u00b7 branch opens at 08:30',
    sla: 'Operations \u00b7 at risk',
    status: 'Spare display dispatched from depot \u00b7 arriving 08:25',
    action: 'approve',
  },
  {
    id: 'ib-002',
    priority: 'critical',
    icon: 'warn',
    title: 'Leak reported \u2014 Syracuse \u00b7 Westcott',
    sub: 'Customer pressed \u201cLeak\u201d button 14:02',
    sla: 'Safety \u00b7 immediate',
    status: 'Cleaning crew re-routed \u00b7 plumber notified',
    action: 'approve',
  },
  {
    id: 'ib-003',
    priority: 'critical',
    icon: 'shield',
    title: 'Tamper detected \u2014 Bronx \u00b7 Fordham',
    sub: 'Accelerometer spike 2.4g at 03:17',
    sla: 'Security \u00b7 flagged',
    status: 'Regional notified \u00b7 branch manager reviewing clip',
    action: 'approve',
  },
  {
    id: 'ib-004',
    priority: 'high',
    icon: 'people',
    title: 'Cleaner check-out overdue \u2014 Brooklyn \u00b7 Park Slope',
    sub: 'NFC check-in at 10:18 \u00b7 expected duration 20m',
    sla: 'Hygiene \u00b7 escalating',
    status: 'Merlin paged crew lead \u00b7 checking wellness',
    action: 'approve',
  },
  {
    id: 'ib-005',
    priority: 'high',
    icon: 'sla',
    title: 'Cleaning SLA breach \u2014 Buffalo \u00b7 Main St',
    sub: 'Last NFC-verified clean 13h ago \u00b7 SLA interval 8h',
    sla: 'Hygiene SLA \u00b7 breached',
    status: 'Priority route assigned \u00b7 cleaner en route',
    action: 'approve',
  },
  {
    id: 'ib-006',
    priority: 'high',
    icon: 'sla',
    title: 'Low rating surge \u2014 Kingston \u00b7 Chestnut Dr',
    sub: '3 sub-2\u2605 ratings in 20m \u00b7 no cleaning tap since 11:40',
    sla: 'Customer \u00b7 attention',
    status: 'Branch manager + cleaning coordinator paged',
    action: 'approve',
  },
  {
    id: 'ib-007',
    priority: 'high',
    icon: 'people',
    title: 'Cleaner no-show today \u2014 Watertown \u00b7 Main',
    sub: 'No NFC tap by 09:00 \u00b7 first shift missed',
    sla: 'Hygiene \u00b7 at risk',
    status: 'Backup crew dispatched from regional',
    action: 'approve',
  },
  {
    id: 'ib-008',
    priority: 'high',
    icon: 'supply',
    title: 'Paper towel reserve critical \u2014 Queens \u00b7 Northern Blvd',
    sub: '4 \u201cPaper low\u201d button presses in 30m',
    sla: 'Supply SLA \u00b7 warning',
    status: 'Pulled from Wed refill into today\u2019s route',
    action: 'approve',
  },
  {
    id: 'ib-009',
    priority: 'high',
    icon: 'warn',
    title: 'NFC reader intermittent \u2014 Hicksville',
    sub: 'Cleaner taps failing \u00b7 3 retries needed to log visit',
    sla: 'Compliance \u00b7 at risk',
    status: 'Field tech scheduled \u00b7 reader swap tomorrow',
    action: 'approve',
  },
  {
    id: 'ib-010',
    priority: 'high',
    icon: 'supply',
    title: 'Soap missing \u2014 Albany \u00b7 State St',
    sub: 'Customer pressed \u201cSoap missing\u201d button 2\u00d7',
    sla: 'Supply SLA \u00b7 warning',
    status: 'Closest cleaner added stop \u00b7 refill eta 35m',
    action: 'approve',
  },

  {
    id: 'ib-011',
    priority: 'medium',
    icon: 'supply',
    title: 'Toilet paper low \u2014 Manhattan \u00b7 Madison',
    sub: '\u201cPaper low\u201d button + stall-level light-lux pattern',
    sla: 'Supply SLA \u00b7 ok',
    status: 'Queued for 14:30 route',
    action: 'ok',
  },
  {
    id: 'ib-012',
    priority: 'medium',
    icon: 'supply',
    title: 'Hand sanitizer refill \u2014 Poughkeepsie',
    sub: '\u201cRefill\u201d button pressed 3\u00d7 this week',
    sla: 'Supply SLA \u00b7 ok',
    status: 'Added to tomorrow\u2019s restock',
    action: 'ok',
  },
  {
    id: 'ib-013',
    priority: 'medium',
    icon: 'people',
    title: '\u201cAsk for cleaning\u201d surge \u2014 Yonkers \u00b7 Central',
    sub: '5 button presses in 25m \u00b7 high-traffic hour',
    sla: 'Hygiene \u00b7 monitor',
    status: 'Pulled next sweep forward',
    action: 'ok',
  },
  {
    id: 'ib-014',
    priority: 'medium',
    icon: 'sparkle',
    title: 'Firmware update stalled \u2014 Buffalo \u00b7 Elmwood',
    sub: '4.13.0-rc2 stuck at 47% \u00b7 weak LTE',
    sla: 'Operations \u00b7 monitor',
    status: 'Re-queued for 03:00 retry',
    action: 'ok',
  },
  {
    id: 'ib-015',
    priority: 'medium',
    icon: 'bolt',
    title: 'Low battery \u2014 Plattsburgh',
    sub: '8% remaining \u00b7 swap bundled into field run',
    sla: 'Battery SLA \u00b7 ok',
    status: 'Added to Alicia\u2019s Thu route',
    action: 'ok',
  },
  {
    id: 'ib-016',
    priority: 'medium',
    icon: 'wifi',
    title: 'LTE signal degraded \u2014 Jamestown',
    sub: 'RSRP -108 dBm \u00b7 packet loss 14%',
    sla: 'Operations \u00b7 watch',
    status: 'Carrier re-provisioning requested',
    action: 'ok',
  },
  {
    id: 'ib-017',
    priority: 'medium',
    icon: 'air',
    title: 'Restroom temperature anomaly \u2014 Elmira',
    sub: 'Embedded sensor 14.8\u00b0C \u00b7 unusual for this location',
    sla: 'Facilities \u00b7 flagged',
    status: 'Branch manager will check HVAC',
    action: 'ok',
  },
  {
    id: 'ib-018',
    priority: 'medium',
    icon: 'shield',
    title: 'Audit trail gap \u2014 Newburgh \u00b7 Broadway',
    sub: '1 cleaner NFC check-out missing from yesterday',
    sla: 'Compliance \u00b7 review',
    status: 'Flagged for weekly audit reconciliation',
    action: 'ok',
  },
  {
    id: 'ib-019',
    priority: 'medium',
    icon: 'sla',
    title: 'Rating trending down \u2014 Schenectady',
    sub: '7-day avg 3.6\u2605 (was 4.1\u2605) \u00b7 pattern unclear',
    sla: 'Customer \u00b7 analyze',
    status: 'Merlin running root cause',
    action: 'ok',
  },
  {
    id: 'ib-020',
    priority: 'medium',
    icon: 'bell',
    title: 'Button press spike \u2014 Brooklyn \u00b7 Bay Ridge',
    sub: '18 events in 10m \u00b7 above 99th percentile',
    sla: 'Operations \u00b7 watch',
    status: 'Classified as event crowd \u00b7 no action',
    action: 'ok',
  },

  {
    id: 'ib-021',
    priority: 'info',
    icon: 'check',
    title: 'Regional satisfaction up \u2014 Western NY',
    sub: '+0.12\u2605 WoW across 60 branches',
    sla: 'Success signal',
    status: 'Feeds weekly report',
    action: 'ok',
  },
  {
    id: 'ib-022',
    priority: 'info',
    icon: 'check',
    title: 'New branch display commissioned \u2014 Poughkeepsie',
    sub: 'LTE link verified \u00b7 first cleaning tap logged',
    sla: 'Deployment',
    status: 'Added to fleet monitoring',
    action: 'ok',
  },
  {
    id: 'ib-023',
    priority: 'info',
    icon: 'shield',
    title: 'Compliance sweep complete \u2014 NY State',
    sub: '576 of 578 audit-ready \u00b7 2 need reconciliation',
    sla: 'Compliance \u00b7 done',
    status: 'Quarterly report delivered',
    action: 'ok',
  },
  {
    id: 'ib-024',
    priority: 'info',
    icon: 'check',
    title: 'NFC cleaning taps logged \u2014 ecosystem today',
    sub: '1,842 verified cleanings \u00b7 +8% vs Tuesday',
    sla: 'Hygiene',
    status: 'Logged to audit trail',
    action: 'ok',
  },
  {
    id: 'ib-025',
    priority: 'info',
    icon: 'sparkle',
    title: 'Merlin resolved tamper flag \u2014 Rochester \u00b7 Park',
    sub: 'Accelerometer signature matched known cleaner motion',
    sla: 'Security \u00b7 cleared',
    status: 'Auto-dismissed after 12m review',
    action: 'ok',
  },
];

// ───────── deployments — NY-wide rollouts ─────────

const ECOSYSTEM_ROLLOUTS_RAW = [
  {
    id: 'rb-001',
    name: 'NY-wide \u00b7 Touch eInk firmware v4.13.0-rc2',
    deviceType: 'display_touch',
    scope: 'All 578 branches',
    zone: 'all',
    installer: 'p-kumar',
    started: '2026-04-15',
    eta: '2026-04-30',
    pct: 0.66,
    budget: 0,
    firmware: true,
    stages: { planned: 578, ordered: 0, arrived: 0, provisioned: 578, installed: 418, live: 384 },
    floors: [
      { floor: 1, name: 'NYC Metro', planned: 180, live: 138, installed: 18, provisioned: 24, arrived: 0, ordered: 0 },
      { floor: 2, name: 'Long Island', planned: 80, live: 62, installed: 8, provisioned: 10, arrived: 0, ordered: 0 },
      { floor: 3, name: 'Hudson Valley', planned: 60, live: 42, installed: 6, provisioned: 12, arrived: 0, ordered: 0 },
      { floor: 4, name: 'Capital', planned: 50, live: 36, installed: 4, provisioned: 10, arrived: 0, ordered: 0 },
      { floor: 5, name: 'Central NY', planned: 45, live: 30, installed: 4, provisioned: 11, arrived: 0, ordered: 0 },
      { floor: 6, name: 'Finger Lakes', planned: 55, live: 38, installed: 4, provisioned: 13, arrived: 0, ordered: 0 },
      { floor: 7, name: 'Western NY', planned: 60, live: 44, installed: 4, provisioned: 12, arrived: 0, ordered: 0 },
      { floor: 8, name: 'Southern Tier', planned: 30, live: 20, installed: 2, provisioned: 8, arrived: 0, ordered: 0 },
      { floor: 9, name: 'North Country', planned: 18, live: 12, installed: 2, provisioned: 4, arrived: 0, ordered: 0 },
    ],
  },
  {
    id: 'rb-002',
    name: 'NYC Metro \u00b7 Display hardware refresh',
    deviceType: 'display_touch',
    scope: 'Manhattan / Brooklyn / Queens',
    zone: 'nyc',
    installer: 'm-torres',
    started: '2026-04-08',
    eta: '2026-05-05',
    pct: 0.42,
    budget: 31120,
    stages: { planned: 80, ordered: 80, arrived: 55, provisioned: 40, installed: 32, live: 28 },
    floors: [
      { floor: 1, name: 'Manhattan', planned: 40, live: 18, installed: 8, provisioned: 6, arrived: 4, ordered: 0 },
      { floor: 2, name: 'Brooklyn', planned: 25, live: 6, installed: 2, provisioned: 6, arrived: 7, ordered: 0 },
      { floor: 3, name: 'Queens', planned: 15, live: 4, installed: 2, provisioned: 4, arrived: 5, ordered: 0 },
    ],
  },
  {
    id: 'rb-003',
    name: 'Western NY \u00b7 Battery swap campaign',
    deviceType: 'display_touch',
    scope: 'Buffalo / Rochester / Jamestown',
    zone: 'western',
    installer: 'a-vega',
    started: '2026-04-12',
    eta: '2026-05-12',
    pct: 0.35,
    budget: 8900,
    stages: { planned: 60, ordered: 60, arrived: 30, provisioned: 22, installed: 20, live: 18 },
    floors: [
      { floor: 1, name: 'Buffalo', planned: 40, live: 12, installed: 6, provisioned: 8, arrived: 14, ordered: 0 },
      { floor: 2, name: 'Rochester', planned: 15, live: 5, installed: 2, provisioned: 3, arrived: 5, ordered: 0 },
      { floor: 3, name: 'Jamestown', planned: 5, live: 1, installed: 1, provisioned: 1, arrived: 2, ordered: 0 },
    ],
  },
  {
    id: 'rb-004',
    name: 'Compliance refresh \u00b7 NY-wide audit overlay',
    deviceType: 'display_touch',
    scope: 'All regions',
    zone: 'all',
    installer: 'p-kumar',
    started: '2026-04-18',
    eta: '2026-04-26',
    pct: 0.88,
    budget: 0,
    firmware: true,
    stages: { planned: 578, ordered: 0, arrived: 0, provisioned: 578, installed: 578, live: 508 },
    floors: [
      { floor: 1, name: 'All regions', planned: 578, live: 508, installed: 70, provisioned: 0, arrived: 0, ordered: 0 },
    ],
  },
  {
    id: 'rb-005',
    name: 'Q2 expansion \u00b7 8 new branches',
    deviceType: 'display_touch',
    scope: 'Long Island + Hudson Valley',
    zone: 'all',
    installer: 'a-vega',
    started: '2026-04-20',
    eta: '2026-05-30',
    pct: 0.25,
    budget: 3112,
    stages: { planned: 8, ordered: 8, arrived: 2, provisioned: 1, installed: 0, live: 0 },
    floors: [
      { floor: 1, name: 'Long Island', planned: 5, live: 0, installed: 0, provisioned: 1, arrived: 1, ordered: 3 },
      { floor: 2, name: 'Hudson Valley', planned: 3, live: 0, installed: 0, provisioned: 0, arrived: 1, ordered: 2 },
    ],
  },
];

// ───────── Merlin proactive tips for the Devices page ─────────

export const ECOSYSTEM_DEVICE_ALERTS = [
  {
    id: 'eb-1',
    icon: 'warn',
    tone: 'risk',
    title: 'Offline cluster',
    body: '4 displays offline in Manhattan this morning \u2014 same firmware. Likely a 4.12.0 regression; Merlin is reverting automatically.',
    cta: 'View cluster',
  },
  {
    id: 'eb-2',
    icon: 'bolt',
    tone: 'warn',
    title: 'Battery cluster',
    body: '22 displays in Western NY below 20%. Bundle a single battery-swap run across Buffalo + Rochester + Jamestown?',
    cta: 'Schedule run',
  },
  {
    id: 'eb-3',
    icon: 'people',
    tone: 'warn',
    title: 'Cleaning SLA risk',
    body: 'No NFC check-in on 12 upstate branches by 09:00 \u2014 same-shift gap suggests a dispatch failure. Page the cleaning coordinator?',
    cta: 'Escalate',
  },
];

// ───────── Provisioning queue ─────────

export const ECOSYSTEM_ROLLOUTS = ECOSYSTEM_ROLLOUTS_RAW.map((r) => ({
  ...r,
  started: rebase(r.started),
  eta: rebase(r.eta),
}));

export const ECOSYSTEM_PROVISIONING_QUEUE = [
  {
    id: 'qb-001',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6001',
    arrived: 'today',
    rollout: 'rb-002',
    floor: 1,
    location: 'Manhattan \u00b7 34th St \u2014 new install',
    paired: false,
    assigned: true,
  },
  {
    id: 'qb-002',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6002',
    arrived: 'today',
    rollout: 'rb-002',
    floor: 1,
    location: 'Brooklyn \u00b7 Park Slope \u2014 replacement',
    paired: false,
    assigned: true,
  },
  {
    id: 'qb-003',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6003',
    arrived: 'today',
    rollout: 'rb-002',
    floor: 1,
    location: null,
    paired: false,
    assigned: false,
  },
  {
    id: 'qb-004',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6004',
    arrived: '1 day ago',
    rollout: 'rb-003',
    floor: 7,
    location: 'Buffalo \u00b7 Main St \u2014 battery swap',
    paired: true,
    assigned: true,
  },
  {
    id: 'qb-005',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6005',
    arrived: '1 day ago',
    rollout: 'rb-003',
    floor: 7,
    location: 'Rochester \u00b7 Park Ave',
    paired: true,
    assigned: true,
  },
  {
    id: 'qb-006',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6006',
    arrived: '1 day ago',
    rollout: 'rb-003',
    floor: 7,
    location: 'Buffalo \u00b7 Elmwood',
    paired: false,
    assigned: true,
  },
  {
    id: 'qb-007',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6007',
    arrived: '2 days ago',
    rollout: 'rb-005',
    floor: 2,
    location: 'Huntington \u00b7 new branch \u2014 pending',
    paired: false,
    assigned: true,
  },
  {
    id: 'qb-008',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6008',
    arrived: '2 days ago',
    rollout: 'rb-005',
    floor: 3,
    location: 'Poughkeepsie \u00b7 new branch',
    paired: true,
    assigned: true,
  },
  {
    id: 'qb-009',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6009',
    arrived: '3 days ago',
    rollout: 'rb-002',
    floor: 1,
    location: 'Queens \u00b7 Northern Blvd',
    paired: true,
    assigned: true,
  },
  {
    id: 'qb-010',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6010',
    arrived: '3 days ago',
    rollout: 'rb-005',
    floor: 2,
    location: null,
    paired: false,
    assigned: false,
  },
  {
    id: 'qb-011',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6011',
    arrived: '4 days ago',
    rollout: null,
    floor: 1,
    location: null,
    paired: false,
    assigned: false,
  },
  {
    id: 'qb-012',
    deviceType: 'display_touch',
    sku: 'ADX-TD-12',
    serial: 'TD-6012',
    arrived: '4 days ago',
    rollout: null,
    floor: 1,
    location: null,
    paired: false,
    assigned: false,
  },
];

// ───────── Install calendar ─────────

const ECOSYSTEM_INSTALL_CALENDAR_RAW = [
  {
    id: 'vb-001',
    date: '2026-04-21',
    start: '08:00',
    durMin: 120,
    installer: 'p-kumar',
    floor: 1,
    title: 'Manhattan \u00b7 34th St \u00b7 emergency panel',
    rollout: 'rb-002',
    devices: 1,
    status: 'scheduled',
  },
  {
    id: 'vb-002',
    date: '2026-04-21',
    start: '11:00',
    durMin: 180,
    installer: 'm-torres',
    floor: 1,
    title: 'Brooklyn \u00b7 Park Slope \u00b7 hardware refresh',
    rollout: 'rb-002',
    devices: 3,
    status: 'scheduled',
  },
  {
    id: 'vb-003',
    date: '2026-04-22',
    start: '09:00',
    durMin: 240,
    installer: 'a-vega',
    floor: 7,
    title: 'Buffalo \u00b7 Main + Elmwood \u00b7 battery swap',
    rollout: 'rb-003',
    devices: 4,
    status: 'scheduled',
  },
  {
    id: 'vb-004',
    date: '2026-04-22',
    start: '14:00',
    durMin: 150,
    installer: 'p-kumar',
    floor: 1,
    title: 'Manhattan \u00b7 Madison \u00b7 touch recalibration',
    rollout: 'rb-002',
    devices: 1,
    status: 'scheduled',
  },
  {
    id: 'vb-005',
    date: '2026-04-23',
    start: '10:00',
    durMin: 180,
    installer: 'a-vega',
    floor: 7,
    title: 'Rochester \u00b7 Park Ave \u00b7 battery swap',
    rollout: 'rb-003',
    devices: 2,
    status: 'scheduled',
  },
  {
    id: 'vb-006',
    date: '2026-04-24',
    start: '09:30',
    durMin: 240,
    installer: 'm-torres',
    floor: 1,
    title: 'Queens \u00b7 Northern Blvd + Astoria',
    rollout: 'rb-002',
    devices: 3,
    status: 'scheduled',
  },
  {
    id: 'vb-007',
    date: '2026-04-25',
    start: '11:00',
    durMin: 120,
    installer: 'p-kumar',
    floor: 4,
    title: 'Albany \u00b7 State St \u00b7 firmware roll-forward',
    rollout: 'rb-001',
    devices: 2,
    status: 'tentative',
  },
  {
    id: 'vb-008',
    date: '2026-04-28',
    start: '09:00',
    durMin: 180,
    installer: 'a-vega',
    floor: 2,
    title: 'Huntington \u00b7 new branch commissioning',
    rollout: 'rb-005',
    devices: 1,
    status: 'tentative',
  },
  {
    id: 'vb-009',
    date: '2026-04-29',
    start: '13:00',
    durMin: 150,
    installer: 'p-kumar',
    floor: 3,
    title: 'Poughkeepsie \u00b7 new branch commissioning',
    rollout: 'rb-005',
    devices: 1,
    status: 'tentative',
  },
];

export const ECOSYSTEM_INSTALL_CALENDAR = ECOSYSTEM_INSTALL_CALENDAR_RAW.map((v) => ({
  ...v,
  date: rebase(v.date),
}));

// ───────── Merlin chat content ─────────

export const ECOSYSTEM_DEMO_THREAD = [
  {
    from: 'merlin',
    time: '14:06',
    meta: { kind: 'alert' },
    text: "I'm watching **578 branches** across NY. Three critical flags right now \u2014 **Manhattan \u00b7 34th St** display offline, **Syracuse \u00b7 Westcott** has a customer-reported leak, and **Bronx \u00b7 Fordham** triggered a tamper signature overnight.",
  },
  {
    from: 'merlin',
    time: '14:07',
    text: 'Also: **12 upstate branches** missed their 09:00 cleaning NFC check-in \u2014 looks like a shift-wide dispatch issue, not individual no-shows. Want me to escalate to the regional cleaning coordinator?',
  },
];

// Canned responses when the user types in the Merlin chat with the ecosystem
// selected. One is picked deterministically per prompt via mockClaude.
export const ECOSYSTEM_RESPONSES = [
  "Manhattan \u00b7 34th St's display has been offline **47 min**. A spare is out of the regional depot and should be installed by 09:15. Once it's online, cleaning-cycle tracking resumes and the audit trail auto-reconciles.",
  '**22 Touch eInks** in Western NY are below 20%. I can bundle a single field run \u2014 Alicia covers Buffalo + Rochester + Jamestown in one day. Net cost to swap now vs. staggered visits: **\u2212$1,800**. Approve?',
  "Kingston \u00b7 Chestnut Dr: **3 sub-2\u2605 ratings in 20 min** and no cleaning NFC tap since **11:40**. High-confidence missed sweep. I've pulled the next rotation 40 minutes forward. Escalate to the branch manager?",
  "Today's compliance sweep across **578 branches**: **576 audit-ready**, 2 have a missing NFC check-out (Newburgh \u00b7 Broadway, Bronx \u00b7 Fordham). Both happened on the same cleaner's shift \u2014 likely a reader glitch. Quarterly report is ready.",
  "Cleaning SLA at risk on **12 upstate branches** \u2014 all missed their 08:00 NFC check-in. Pattern matches a dispatch-platform outage, not individual crew issues. I've paged the regional cleaning coordinator and pulled the backup rotation forward.",
  "Leak in Syracuse \u00b7 Westcott was reported **13 minutes ago** via the display's \u201cLeak\u201d button. Nearest cleaner is 6 min out, plumber is scheduled. No prior leak history at this location \u2014 might be a fixture issue rather than pipe.",
  'Rating trend for Schenectady dropped to **3.6\u2605** over 7 days (from 4.1\u2605). Correlates with a new cleaning vendor in that region since Monday. Want me to run the same analysis across all Capital Region branches?',
  'There are **1,842 NFC-verified cleaning taps** logged across the fleet today \u2014 **+8% over Tuesday**. Full audit trail is ready for download; every tap has matching check-in/check-out pairs except the two Newburgh and Bronx gaps.',
];
