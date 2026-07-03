// Merlin Insights — AI-surfaced optimizations for Meridian HQ.
// Each insight is a recommendation Merlin generated from observed building
// data, with a dollar impact, confidence, reasoning trail, data sources, and
// a phased implementation plan.

export const INSIGHT_CATEGORIES = {
  cleaning: { id: 'cleaning', label: 'Cleaning', icon: 'people', tone: 'accent' },
  energy: { id: 'energy', label: 'Energy', icon: 'bolt', tone: 'warn' },
  supply: { id: 'supply', label: 'Supply', icon: 'supply', tone: 'info' },
  space: { id: 'space', label: 'Space', icon: 'room', tone: 'info' },
  maintenance: { id: 'maintenance', label: 'Maintenance', icon: 'hvac', tone: 'info' },
  compliance: { id: 'compliance', label: 'Compliance', icon: 'shield', tone: 'ok' },
  reliability: { id: 'reliability', label: 'Reliability', icon: 'check', tone: 'ok' },
  lighting: { id: 'lighting', label: 'Lighting', icon: 'light', tone: 'warn' },
  security: { id: 'security', label: 'Security', icon: 'shield', tone: 'info' },
  satisfaction: { id: 'satisfaction', label: 'Satisfaction', icon: 'check', tone: 'accent' },
  // ── Wellbeing-specific categories
  comfort: { id: 'comfort', label: 'Comfort', icon: 'air', tone: 'accent' },
  noise: { id: 'noise', label: 'Noise', icon: 'mic', tone: 'warn' },
  wayfinding: { id: 'wayfinding', label: 'Wayfinding', icon: 'pin', tone: 'info' },
};

// ─── Track ──────────────────────────────────────────────────────────
// Insights split into three value motions:
//  - 'financial'  — ROI / cost savings / hours back. Sold to CFO, Facility.
//  - 'wellbeing'  — occupant comfort, satisfaction, complaint reduction.
//                   Sold to HR / People Ops / Facility.
//  - 'slas'       — live SLA scorecards + remediation guidance. Sold to
//                   Facility / Operations leads measured on compliance.
// Existing seeds without a `track` field fall back to 'financial'.
//
// Note: the 'slas' track renders a different content shape (live KPI
// cards from Postgres) instead of the recommendation-list shape the
// other two tracks use. See SlasTrack in Insights.jsx.
// Labels resolve through the i18n dictionary at render time. Consumers
// look up `tr.labelKey` via `t()` rather than reading a baked-in label.
export const TRACKS = [
  // 'financial-v2' is the canonical Savings tab. Id stays 'financial-v2'
  // for backward-compat with persisted localStorage state. The legacy
  // 'financial' tab was removed 2026-05-09 — its insights still tag
  // track='financial' in the data, and FINANCIAL_LIKE_TRACKS routes the
  // v2 tab into that pool.
  { id: 'financial-v2', labelKey: 'insights.track.savings', icon: 'bolt', accent: 'var(--accent)' },
  { id: 'wellbeing', labelKey: 'insights.track.wellbeing', icon: 'sparkle', accent: '#10b981' },
  { id: 'slas', labelKey: 'insights.track.slas', icon: 'shield', accent: '#2185D0' },
];

// Tracks whose UI tab routes into the underlying 'financial' insight
// pool. With 'financial' removed from TRACKS, only the Savings tab
// (financial-v2) remains as a financial-like surface.
const FINANCIAL_LIKE_TRACKS = new Set(['financial-v2']);

// status: 'new' | 'in_review' | 'approved' | 'dismissed' | 'implemented'
// impact_kind: 'dollars' | 'hours' | 'operational'
// audience: role ids that should see this insight. 'facility' always sees
// everything, so we add it to every entry.
export const INSIGHTS_HQ = [
  {
    id: 'in-001',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Dynamic cleaning dispatch for Floors 28\u201332',
    summary:
      'Move from a fixed 3-pass schedule to traffic-aware dispatch. Saves 2 crew-hours per floor per day without breaching the Hygiene SLA.',
    impact_kind: 'dollars',
    impact: { amount: 18200, period: 'year' },
    secondary_impact: '\u22122 crew-hours / floor / day',
    confidence: 0.92,
    priority: 'high',
    status: 'new',
    ageDays: 4,
    reasoning: [
      '90-day occupancy heatmaps show Fl 28\u201332 restrooms peak only between 14:00 and 15:00',
      'Current schedule: 10:00 + 14:00 + 18:00 sweeps regardless of traffic',
      'Recommended: NFC-triggered dispatch when occupancy threshold hits 12 visitors',
      'Model predicts 2.1 cleaning events/day vs current 3, staying inside the 20-min Hygiene SLA 98.6% of the time',
    ],
    dataSources: ['Occupancy sensors \u00b7 90d', 'NFC check-in logs', 'SLA outcomes 90d', 'Customer ratings'],
    implementation: [
      { when: '2 weeks', what: 'Deploy dynamic dispatch engine to Fl 28\u201332' },
      { when: '2 weeks', what: 'Monitor SLA + ratings side-by-side with current schedule' },
      { when: '1 month', what: 'Roll out to Fl 1\u201327 if metrics hold' },
    ],
    risk: 'low',
  },
  {
    id: 'in-002',
    category: 'energy',
    audience: ['facility', 'maintenance'],
    title: 'Weekend HVAC setback \u2014 tower-wide',
    summary:
      '78% of weekend occupancy is below 10%. Automate setpoint drift to 18\u201326\u00b0C Sat/Sun vs current flat 22\u00b0C year-round.',
    impact_kind: 'dollars',
    impact: { amount: 31400, period: 'year' },
    secondary_impact: '\u221212% weekend kWh',
    confidence: 0.96,
    priority: 'high',
    status: 'in_review',
    ageDays: 12,
    reasoning: [
      'Occupancy across 3 years of weekends averages 7.8% (peak 11% Saturday morning)',
      'Current comfort SLA of \u00b12\u00b0C applies only during business hours',
      'Recommended weekend band: 18\u201326\u00b0C \u00b7 returns to 22\u00b0C by 06:30 Monday',
      'Modeled kWh reduction: \u221212% weekend load \u2192 $31.4k/year at current tariff',
    ],
    dataSources: ['Badge entries 3y', 'HVAC runtime telemetry', 'Energy meter readings', 'Comfort SLA'],
    implementation: [
      { when: '1 week', what: 'Program weekend schedule in BMS \u00b7 zone-by-zone pilot' },
      { when: '1 month', what: 'Run in Zone C only \u00b7 compare vs Zone B as control' },
      { when: '2 months', what: 'Extend tower-wide if kWh savings confirm' },
    ],
    risk: 'low',
  },
  {
    id: 'in-003',
    category: 'space',
    audience: ['facility'],
    title: 'Auto-release ghost conference bookings after 15 min',
    summary:
      'Conf Rm Sycamore is booked but unused 60% of the time. Tighten the auto-release window from 30 to 15 minutes to recover 240 hours/year for other teams.',
    impact_kind: 'dollars',
    impact: { amount: 7800, period: 'year' },
    secondary_impact: '+240 meeting hours/year recovered',
    confidence: 0.85,
    priority: 'medium',
    status: 'new',
    ageDays: 2,
    reasoning: [
      'CO\u2082 + motion data shows 60% of Sycamore bookings never populate (<2 min of presence)',
      'Current auto-release fires at 30 min \u2014 meeting is already half over',
      'Tightening to 15 min recovers ~2h/day across rooms, backfills via the booking queue',
      'Space-utilization SLA ok: ratings of bumped hosts historically unchanged',
    ],
    dataSources: ['Room booking API', 'Occupancy sensors', 'CO\u2082 thresholds', 'Release-event history'],
    implementation: [
      { when: '2 days', what: 'Update auto-release rule in facilities platform' },
      { when: '2 weeks', what: 'A/B across 4 conf rooms \u00b7 measure ghost rate' },
      { when: '1 month', what: 'Roll tower-wide \u00b7 notify bookers 24h in advance of rule change' },
    ],
    risk: 'low',
  },
  {
    id: 'in-004',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Shift one custodian from Friday afternoon to Mon/Tue mornings',
    summary:
      'Friday 15:00\u201318:00 traffic is 40% lower than Mon/Tue peaks. Reallocating one custodian smooths the SLA without adding headcount.',
    impact_kind: 'dollars',
    impact: { amount: 9200, period: 'year' },
    secondary_impact: '\u221218% Mon/Tue SLA near-misses',
    confidence: 0.82,
    priority: 'medium',
    status: 'new',
    ageDays: 7,
    reasoning: [
      'Entry-badge counts show Fri afternoons run 41% below Mon/Tue peaks',
      'Historical SLA near-misses cluster on Mon 09:30\u201311:00 and Tue 09:30\u201311:00',
      'Shifting one custodian closes 18% of those near-misses',
      'No overtime cost: rebalance is inside weekly hours',
    ],
    dataSources: ['Badge entries 12mo', 'Cleaning-crew rosters', 'NFC sweep timings'],
    implementation: [
      { when: '3 days', what: 'Publish updated rotation \u00b7 confirm with crew lead' },
      { when: '4 weeks', what: 'Monitor SLA + crew feedback' },
    ],
    risk: 'low',
  },
  {
    id: 'in-005',
    category: 'supply',
    audience: ['facility', 'cleaning'],
    title: 'Consolidate hygiene supplies into quarterly bulk orders',
    summary:
      'Merging monthly soap + paper towel orders into quarterly bulk unlocks a 12% volume discount with the current supplier.',
    impact_kind: 'dollars',
    impact: { amount: 4100, period: 'year' },
    secondary_impact: '\u22128 vendor touchpoints / year',
    confidence: 0.89,
    priority: 'medium',
    status: 'in_review',
    ageDays: 9,
    reasoning: [
      'Current cadence: 12 soap + 12 paper-towel orders per year',
      'Supplier offers 12% off at \u22653-month volumes, free on-site pallet placement',
      'Storage room has 14m\u00b3 unused \u2014 enough for 1.5 quarters of stock',
      'No spoilage risk (bulk soap + paper keep well in a dry room)',
    ],
    dataSources: ['Supplier quotes', 'Reorder history 12mo', 'Storage-room floor plan', 'Consumption rate'],
    implementation: [
      { when: '1 week', what: 'Get signed quarterly quote from supplier' },
      { when: '2 weeks', what: 'First bulk order lands \u00b7 update reorder triggers in Merlin' },
    ],
    risk: 'low',
  },
  {
    id: 'in-006',
    category: 'maintenance',
    audience: ['facility', 'maintenance'],
    title: 'Per-zone dynamic cadence for AHU filter swaps',
    summary:
      'Real particulate data shows cleaner zones can go 3,200h between filter swaps safely, vs the current flat 2,000h cadence.',
    impact_kind: 'dollars',
    impact: { amount: 6700, period: 'year' },
    secondary_impact: '\u221240% filter SKUs consumed',
    confidence: 0.87,
    priority: 'medium',
    status: 'new',
    ageDays: 5,
    reasoning: [
      'Pressure-drop curves from 12 AHUs show wide variance (Zone A degrades 40% faster than Zone C)',
      'Current flat 2,000h cadence over-services 7 of 12 AHUs',
      'Dynamic per-zone cadence based on \u0394P threshold preserves air quality',
      'Fewer filter replacements + fewer service calls \u2192 $6.7k/year',
    ],
    dataSources: ['AHU pressure sensors', 'Filter SKU costs', 'Trane service logs', 'CO\u2082 outcomes'],
    implementation: [
      { when: '2 weeks', what: 'Merlin emits \u0394P-triggered service requests per zone' },
      { when: '3 months', what: 'Compare CO\u2082 + comfort SLA against current baseline' },
    ],
    risk: 'medium',
  },
  {
    id: 'in-007',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Retire manual paper cleaning log \u2014 NFC trail already covers SOC 2',
    summary:
      'Every cleaning event is already NFC-verified with timestamped check-in/out. The paper log Priya maintains can be retired, saving ~6 hours/week.',
    impact_kind: 'hours',
    impact: { amount: 312, period: 'year' },
    secondary_impact: '6 hours/week of compliance labor recovered',
    confidence: 0.99,
    priority: 'medium',
    status: 'new',
    ageDays: 3,
    reasoning: [
      'SOC 2 control CC-6.2 requires "tamper-evident record" \u2014 NFC tap + sealed audit trail satisfies this',
      'Legal signed off on the equivalence in Q1 compliance review',
      'Paper log duplicates 100% of what NFC already captures',
      'Priya currently spends \u223c6 hours/week reconciling the two',
    ],
    dataSources: ['SOC 2 control matrix', 'Q1 legal memo', 'NFC audit trail', "Priya's timesheet"],
    implementation: [
      { when: '1 week', what: "Update compliance playbook \u00b7 notify Priya's team" },
      { when: 'ongoing', what: 'Weekly audit now runs directly against the NFC trail' },
    ],
    risk: 'low',
  },
  {
    id: 'in-008',
    category: 'lighting',
    audience: ['facility', 'maintenance'],
    title: 'Motion-activated lighting for Garage L3',
    summary:
      'Garage Level 3 currently runs lights 06:00\u201322:00 regardless of activity. PIR-gated activation cuts that zone\u2019s lighting draw by 35%.',
    impact_kind: 'dollars',
    impact: { amount: 1400, period: 'year' },
    secondary_impact: '\u221235% garage L3 lighting kWh',
    confidence: 0.98,
    priority: 'low',
    status: 'approved',
    ageDays: 21,
    reasoning: [
      '16 hours of daily run time for a zone averaging 4.2h of actual traffic',
      'PIR + 5-min dwell fallback covers safety requirements (OSHA reviewed)',
      'Hardware cost amortizes in 9 months at current tariff',
    ],
    dataSources: ['PIR sensor data', 'Sub-meter kWh', 'OSHA review notes'],
    implementation: [
      { when: 'done', what: 'OSHA + insurance sign-off secured' },
      { when: '2 weeks', what: 'Electrician installs PIR relays on 4 circuits' },
    ],
    risk: 'low',
  },
  {
    id: 'in-009',
    category: 'maintenance',
    audience: ['facility', 'maintenance'],
    title: 'Bundle the next 6 service calls into 2 site visits',
    summary:
      'Merlin has queued 6 upcoming Trane + OTIS visits over the next 30 days. Bundling into 2 combined visits saves 4 callout fees.',
    impact_kind: 'dollars',
    impact: { amount: 2400, period: 'year' },
    secondary_impact: '\u22124 vendor callouts',
    confidence: 0.94,
    priority: 'low',
    status: 'new',
    ageDays: 6,
    reasoning: [
      '6 work orders currently scheduled across 4 weeks: 3 Trane + 2 OTIS + 1 Siemens',
      'Each vendor charges a $200 callout fee regardless of scope',
      'Consolidating into 2 visits (Wk 1, Wk 4) preserves urgency windows',
    ],
    dataSources: ['Work order queue', 'Vendor contracts', 'Service-window requirements'],
    implementation: [
      { when: '2 days', what: 'Coordinate with Trane + OTIS dispatch' },
      { when: '1 week', what: 'First bundled visit \u00b7 first savings realized' },
    ],
    risk: 'low',
  },
  {
    id: 'in-010',
    category: 'energy',
    audience: ['facility', 'maintenance'],
    title: 'Summer setpoint +1\u00b0C, Jun\u2013Aug',
    summary:
      'Three years of comfort surveys show +1\u00b0C from June to August doesn\u2019t trigger comfort complaints. Cuts summer cooling load ~8%.',
    impact_kind: 'dollars',
    impact: { amount: 4800, period: 'year' },
    secondary_impact: '\u22128% summer cooling kWh',
    confidence: 0.91,
    priority: 'medium',
    status: 'new',
    ageDays: 14,
    reasoning: [
      '3y of comfort feedback shows complaint rate flat at setpoints between 22\u201324\u00b0C',
      'ASHRAE 55 comfort envelope covers our proposed +1\u00b0C band',
      '8% cooling reduction scales with DOE cost-per-degree model',
    ],
    dataSources: ['Comfort surveys 3y', 'ASHRAE 55 tables', 'HVAC runtime'],
    implementation: [
      { when: '1 week', what: 'Update seasonal schedule in BMS' },
      { when: 'ongoing', what: 'Monitor comfort-complaint queue weekly' },
    ],
    risk: 'low',
  },
  {
    id: 'in-011',
    category: 'reliability',
    audience: ['facility', 'maintenance'],
    title: 'Pre-order 12 AQ sensors before they drift out of calibration',
    summary:
      'Calibration drift on 12 AQ sensors predicts failure within 45 days. Ordering now avoids emergency-expedited shipping (+35%).',
    impact_kind: 'dollars',
    impact: { amount: 3600, period: 'year' },
    secondary_impact: 'Avoid 4d device gap',
    confidence: 0.84,
    priority: 'low',
    status: 'new',
    ageDays: 1,
    reasoning: [
      'Drift patterns in 12 AQ sensors match the failure signature from 2024',
      'Standard shipping is 5 business days; expedited is 2 at +35% cost',
      'Pre-ordering via standard arrives before the predicted failure window',
    ],
    dataSources: ['Sensor calibration logs', '2024 failure records', 'Adaptiv shipping costs'],
    implementation: [
      { when: '1 day', what: 'Add 12 ADX-AQ-3 to Facilities PO-2041' },
      { when: '1 week', what: 'Devices arrive \u00b7 Merlin pairs them in the shadow queue' },
    ],
    risk: 'low',
  },
  {
    id: 'in-012',
    category: 'compliance',
    audience: ['facility', 'maintenance', 'security'],
    title: 'Promote firmware v4.13.0-rc2 to stable',
    summary:
      '576 of 578 displays on the candidate for 72h, 0 regressions. Stable-promotion unlocks 15% faster NFC read and per-zone temp calibration.',
    impact_kind: 'operational',
    impact: { amount: 0, period: null },
    secondary_impact: '15% faster NFC reads \u00b7 zone temp calibration',
    confidence: 0.97,
    priority: 'medium',
    status: 'in_review',
    ageDays: 3,
    reasoning: [
      '99.65% of fleet running the release candidate',
      '0 regressions logged across 72h, 3 cosmetic fixes shipped',
      'Feature payload: NFC read speed, per-zone temp recalibration API, faster wake-from-sleep',
    ],
    dataSources: ['Firmware telemetry', 'Regression dashboard', 'Release changelog'],
    implementation: [
      { when: '1 day', what: 'Promote tag stable-4.13.0 \u00b7 notify change board' },
      { when: '1 week', what: 'Auto-roll remaining 0.35% of fleet on next heartbeat' },
    ],
    risk: 'low',
  },
  {
    id: 'in-013',
    category: 'security',
    audience: ['facility', 'security'],
    title: 'Auto-generate the weekly after-hours badge report',
    summary:
      'Merlin already has every after-hours badge tap with full context. Replace the manual Friday report Ivan assembles by hand with an auto-generated PDF.',
    impact_kind: 'hours',
    impact: { amount: 208, period: 'year' },
    secondary_impact: '4 hours/week of security labor recovered',
    confidence: 0.95,
    priority: 'medium',
    status: 'new',
    ageDays: 5,
    reasoning: [
      'Security lead currently spends ~4 hours every Friday compiling the after-hours badge report',
      'Every event is already in the NFC + badge audit trail with host, duration, and video clip links',
      'Template matches last quarter\u2019s deliverable byte-for-byte \u2014 legal pre-reviewed',
      'Delivers on Fri 08:00 to the same stakeholder list',
    ],
    dataSources: ['Badge audit trail', 'Camera clips index', 'Last-quarter report template', 'Security mailing list'],
    implementation: [
      { when: '3 days', what: 'Wire report generator to badge-event stream \u00b7 dry-run one week' },
      { when: '2 weeks', what: 'Live delivery \u00b7 Ivan reviews before the first auto-send' },
    ],
    risk: 'low',
  },
  // ─── Wellbeing track ─── (occupant comfort, satisfaction, retention)
  {
    id: 'in-w001',
    track: 'wellbeing',
    category: 'satisfaction',
    audience: ['facility', 'cleaning'],
    title: 'Recover Floor 24 Men\u2019s restroom satisfaction (2.0\u2605 \u2192 3.7\u2605)',
    summary:
      'Floor 24 Men\u2019s has held a 2.0\u2605 average for 6 weeks. Three root causes: paper-towel stockouts, mid-afternoon odor spikes, and an intermittent NFC reader. Targeted fix lifts the rating ~1.7\u2605.',
    impact_kind: 'wellbeing',
    impact: { amount: 1.7, period: null, unit: '\u2605' },
    secondary_impact: '\u22128 complaints / month projected',
    confidence: 0.84,
    priority: 'high',
    status: 'new',
    ageDays: 5,
    reasoning: [
      '6-week rolling rating: 2.0\u2605 \u00b7 30+ ratings/week',
      'Comments cluster on three causes: 42% \u201cno paper towels\u201d, 28% \u201csmells\u201d, 18% \u201cdoesn\u2019t scan\u201d',
      'Comparable floors recovered to 3.7\u2605 within 21 days after the same 3-step fix',
      'Brand team estimates 1\u2605 lift retains ~3 staff/yr at this floor density',
    ],
    dataSources: ['Restroom ratings 90d', 'Comment text analysis', 'NFC reader uptime', 'VOC sensor logs'],
    implementation: [
      { when: '3 days', what: 'Swap NFC reader \u00b7 increase paper-towel cadence to twice daily' },
      { when: '1 week', what: 'Tune VOC-triggered ventilation boost (afternoon window)' },
      { when: '1 month', what: 'Measure rating + comment shift vs control floor' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w002',
    track: 'wellbeing',
    category: 'noise',
    audience: ['facility'],
    title: 'Reduce Tuesday/Wednesday afternoon noise leak into focus zones',
    summary:
      'Open collab pods on Floors 28, 30, 32 spike to 72 dB on Tue/Wed 14:00\u201316:00, leaking into adjacent focus zones. Shift collab bookings 30 min earlier and the spike clears the focus-zone window.',
    impact_kind: 'wellbeing',
    impact: { amount: 22, period: 'mo', unit: 'complaints' },
    secondary_impact: '\u221218 dB peak in focus zones',
    confidence: 0.78,
    priority: 'medium',
    status: 'new',
    ageDays: 8,
    reasoning: [
      'Acoustic sensors show focus-zone peaks coincide with collab-pod use 100% of the time on Tue/Wed afternoons',
      'Booking heatmap: 71% of conflicting collab bookings start at 14:00 sharp',
      'Shifting to 13:30 stagger frees the focus-zone window after lunch',
      'Q1 People Ops survey flagged \u201cafternoon noise\u201d as top complaint (44 mentions)',
    ],
    dataSources: ['Acoustic sensors 60d', 'Room booking patterns', 'People Ops survey Q1', 'Focus-zone occupancy'],
    implementation: [
      { when: '1 week', what: 'Update default collab-pod start time to 13:30 \u00b7 notify hosts' },
      { when: '1 month', what: 'Compare focus-zone dB + complaint rate to baseline' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w003',
    track: 'wellbeing',
    category: 'comfort',
    audience: ['facility', 'maintenance'],
    title: 'Pre-condition Boardroom 2 hrs before morning meetings',
    summary:
      'Boardroom CO\u2082 climbs to 1,050 ppm within 25 min of an 8am start. Pre-purging from 06:00 holds CO\u2082 below 700 for the full meeting and lifts comfort ratings ~0.6\u2605.',
    impact_kind: 'wellbeing',
    impact: { amount: 0.6, period: null, unit: '\u2605' },
    secondary_impact: 'CO\u2082 < 700 ppm for full meeting',
    confidence: 0.91,
    priority: 'medium',
    status: 'new',
    ageDays: 3,
    reasoning: [
      'CO\u2082 sensor in Boardroom shows fast climb starting from a 600 ppm overnight baseline',
      '60-day comfort ratings tagged \u201cstuffy\u201d on 38% of pre-9am board meetings',
      'Pre-conditioning model: 06:00\u201307:55 ventilation push drops baseline to 480 ppm',
      'Estimated incremental kWh negligible (offset by daytime setback)',
    ],
    dataSources: ['CO\u2082 sensor (Boardroom)', 'Comfort ratings', 'BMS schedule', 'Energy meter'],
    implementation: [
      { when: '2 days', what: 'Add 06:00 pre-purge step to Boardroom BMS schedule' },
      { when: '2 weeks', what: 'Compare CO\u2082 trace + ratings vs baseline weeks' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w004',
    track: 'wellbeing',
    category: 'wayfinding',
    audience: ['facility'],
    title: 'Add wayfinding signage near Floor 32 East elevator bank',
    summary:
      'Reception logs 6\u20137 visitor support requests / month for \u201chow do I get to East wing.\u201d Permanent signage solves the pattern at one-time cost.',
    impact_kind: 'wellbeing',
    impact: { amount: 6.5, period: 'mo', unit: 'requests' },
    secondary_impact: '~3 reception hours / month back',
    confidence: 0.95,
    priority: 'low',
    status: 'new',
    ageDays: 11,
    reasoning: [
      '6-month reception log: 39 visitor wayfinding requests, 87% on Floor 32 East',
      'Floor plan ambiguity: elevator opens to a long corridor with 3 unlabeled splits',
      'Same pattern was solved on Floor 28 in 2024 with a single wayfinding panel',
      'One-time signage cost ~$420; annualized hour savings ~36 reception hours',
    ],
    dataSources: ['Reception log 6mo', 'Floor plan', 'Floor 28 case study', 'Visitor flow heatmap'],
    implementation: [
      { when: '1 week', what: 'Approve signage design \u00b7 order panel from same vendor as Fl 28' },
      { when: '3 weeks', what: 'Install \u00b7 monitor request log for delta' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w005',
    track: 'wellbeing',
    category: 'comfort',
    audience: ['facility', 'maintenance'],
    title: 'Rebalance Floor 18 Women\u2019s thermal comfort',
    summary:
      'Floor 18 Women\u2019s held a 1.8\u2605 thermal comfort rating in March (\u201ctoo cold\u201d). Modeled AHU damper rebalance lifts to ~3.5\u2605 without touching adjacent zones.',
    impact_kind: 'wellbeing',
    impact: { amount: 1.7, period: null, unit: '\u2605' },
    secondary_impact: '\u221214 \u201ctoo cold\u201d flags / month',
    confidence: 0.86,
    priority: 'medium',
    status: 'in_review',
    ageDays: 16,
    reasoning: [
      'Thermal comfort ratings (60-day): 1.8\u2605 with 73% of comments tagged \u201ctoo cold\u201d',
      'Zone temp sensor reads 19.2\u00b0C average vs 22\u00b0C setpoint \u2014 damper imbalance',
      'CFD model shows 28% damper-position correction restores setpoint without overflow',
      'Adjacent zone (Floor 18 Men\u2019s) sits at 23\u00b0C; rebalance brings both within \u00b10.4\u00b0C',
    ],
    dataSources: ['Comfort ratings 60d', 'Zone temp telemetry', 'CFD rebalance model', 'AHU damper logs'],
    implementation: [
      { when: '1 week', what: 'Trane field tech adjusts damper \u00b7 single visit' },
      { when: '3 weeks', what: 'Measure rating + temp delta vs March baseline' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w006',
    track: 'wellbeing',
    category: 'space',
    audience: ['facility'],
    title: 'Open Sycamore as silent-overflow during focus block',
    summary:
      'Sycamore is empty 71% of weekday afternoons. Unlocking it as drop-in silent overflow during the company-wide 14:00\u201316:00 focus block adds 6 quiet seats.',
    impact_kind: 'wellbeing',
    impact: { amount: 5, period: 'mo', unit: 'requests' },
    secondary_impact: '+6 quiet seats / day during focus block',
    confidence: 0.82,
    priority: 'low',
    status: 'new',
    ageDays: 4,
    reasoning: [
      'Sycamore booking utilization: 29% on Tue\u2013Thu afternoons',
      'Focus-zone wait queue averages 5 names during the 14:00\u201316:00 block',
      'No conflict with booking system: hold reverts to bookable at 16:00',
      '#focus-zone Slack channel has 14 \u201cany free seats?\u201d posts/month',
    ],
    dataSources: ['Sycamore booking utilization', 'Focus-zone occupancy', 'Slack #focus-zone', 'Booking API'],
    implementation: [
      { when: '3 days', what: 'Add scheduled hold 14:00\u201316:00 \u00b7 update room signage' },
      { when: '4 weeks', what: 'Compare focus-zone wait time + Slack mentions to baseline' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w007',
    track: 'wellbeing',
    category: 'comfort',
    audience: ['facility', 'maintenance'],
    title: 'Pre-purge lobby air during 8\u20139am peak entry',
    summary:
      'Lobby AQ dips to \u201cmoderate\u201d (PM2.5 22\u00b5g) for 18 min during peak entry. Two-stage MERV uplift + 10-min pre-purge keeps lobby at \u201cgood\u201d throughout.',
    impact_kind: 'wellbeing',
    impact: { amount: 0.4, period: null, unit: '\u2605' },
    secondary_impact: 'Lobby PM2.5 < 12 \u00b5g all day',
    confidence: 0.88,
    priority: 'medium',
    status: 'new',
    ageDays: 2,
    reasoning: [
      'AQ sensor in Lobby logs PM2.5 22\u00b5g window 08:18\u201308:36 daily',
      'Cause: foot-traffic kicks settled particulates + open-door infiltration',
      'Pre-purge from 07:50 (10 min) drops baseline to 8\u00b5g before peak',
      'No filter change required \u2014 use existing MERV 13 cycled at higher speed',
    ],
    dataSources: ['Lobby AQ sensor', 'Entry-badge counts', 'AHU lobby runtime', 'Particulate baselines'],
    implementation: [
      { when: '3 days', what: 'Add pre-purge step to lobby AHU schedule \u00b7 BMS update' },
      { when: '2 weeks', what: 'Compare PM2.5 trace + comfort flags vs baseline' },
    ],
    risk: 'low',
  },
  {
    id: 'in-w008',
    track: 'wellbeing',
    category: 'satisfaction',
    audience: ['facility'],
    title: 'Resolve recurring elevator wait at 7am + 6pm shift change',
    summary:
      'Elevator-wait sensor pegs 3.2 min at shift change. Pacing tweak + a stationary car at the lobby cuts to <1 min, recovering ~120 staff-minutes/day.',
    impact_kind: 'wellbeing',
    impact: { amount: 11, period: 'mo', unit: 'complaints' },
    secondary_impact: 'Wait < 1 min at peaks',
    confidence: 0.79,
    priority: 'medium',
    status: 'new',
    ageDays: 9,
    reasoning: [
      'Elevator dispatch logs: 3.2-min average wait 06:55\u201307:15 and 17:55\u201318:15',
      '14 of 32 weekly comfort complaints reference \u201celevator wait\u201d',
      'OTIS pacing model: holding car #2 in lobby + starting car #4 from Fl 25 cuts wait to 0.8 min',
      'No new hardware \u2014 OTIS firmware setting change only',
    ],
    dataSources: ['Elevator dispatch logs', 'Comfort complaints', 'OTIS pacing model', 'Badge entry curves'],
    implementation: [
      { when: '1 week', what: 'OTIS pushes pacing config \u00b7 monitor wait + complaint logs' },
      { when: '1 month', what: 'Compare wait time + complaints vs baseline month' },
    ],
    risk: 'low',
  },
  {
    id: 'in-014',
    track: 'financial',
    category: 'security',
    audience: ['facility', 'security'],
    title: 'Tune tailgate detection threshold on Turnstile 2',
    summary:
      'Current sensitivity fires 3\u00d7 more false positives than adjacent turnstiles. Per-turnstile tuning cuts noise without missing real events.',
    impact_kind: 'hours',
    impact: { amount: 156, period: 'year' },
    secondary_impact: '3 hours/week of footage review saved',
    confidence: 0.88,
    priority: 'medium',
    status: 'new',
    ageDays: 9,
    reasoning: [
      'Turnstile 2 fires the tailgate detector ~40% more than Turnstiles 1, 3, and 4',
      '90-day review: 87% of T2 flags were false positives (two people close together, not a tailgate)',
      'Adjacent turnstiles use a tighter gap threshold that holds true-positive rate at 99%',
      'Merlin can apply the same per-turnstile baseline automatically, reviewable weekly',
    ],
    dataSources: ['Tailgate detector logs 90d', 'Adjacent turnstile baselines', 'Manual review outcomes'],
    implementation: [
      { when: '2 days', what: 'Apply adjacent-turnstile threshold to T2 \u00b7 shadow mode' },
      { when: '2 weeks', what: 'Compare shadow vs. live \u00b7 flip to live if true-positive rate holds' },
    ],
    risk: 'medium',
  },

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500 Past actions (status='implemented') \u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Seven implemented recommendations that drove the $47,400 YTD figure
  // shown on the Insights hero. Each carries an `implementedAt` ISO
  // date and a realized $ amount. The "Past actions" sub-tab on
  // Financials v2 reads these directly; Financial v1 surfaces them
  // through the existing "Implemented" status filter.
  {
    id: 'in-past-001',
    track: 'financial',
    category: 'hvac',
    audience: ['facility', 'hvac'],
    title: 'After-hours HVAC setback across Floors 4\u201311',
    summary:
      'Lowered baseline cooling between 19:00 and 06:00 on weekdays. Sensor-driven pre-cool restored comfort 30 minutes before first arrival.',
    impact_kind: 'dollars',
    impact: { amount: 9200, period: 'year' },
    secondary_impact: '~6,200 kWh/yr displaced',
    confidence: 0.96,
    priority: 'high',
    status: 'implemented',
    proposedAt: '2026-01-05',
    approvedAt: '2026-01-09',
    approvedBy: { name: 'Ayesha Rahman', role: 'Facilities Manager' },
    implementedAt: '2026-01-14',
    outcome: {
      predicted: '$9,200/yr',
      actual: '$9,570/yr (annualized after 90 days)',
      narrative:
        'Tracking +4% above the original projection. Comfort survey held flat \u2014 first-arrival ratings unchanged versus the prior quarter. Pre-cool window of 30 min landed correctly on every weekday.',
    },
    reasoning: [
      'Floors 4\u201311 hold the lowest after-hours occupancy in the building',
      'Original setpoint held 22\u00b0C overnight \u2014 unnecessary given empty floors',
      'Comfort survey unchanged after 30 days of new schedule',
    ],
    dataSources: ['BMS occupancy logs', 'Floor 4\u201311 PIR pucks', 'Comfort survey YoY'],
    implementation: [
      { when: 'Day 1', what: 'Push schedule \u00b7 monitor first-arrival comfort scores' },
      { when: 'Week 4', what: 'Lock in if comfort holds + power draw falls > 10%' },
    ],
    risk: 'low',
  },
  {
    id: 'in-past-002',
    track: 'financial',
    category: 'lighting',
    audience: ['facility'],
    title: 'Lighting schedule trim \u2014 Floor 8',
    summary:
      'Floor 8 mostly shifts ended by 18:30; corridor + pantry lighting was running until 23:00. New schedule cuts overlap.',
    impact_kind: 'dollars',
    impact: { amount: 4100, period: 'year' },
    secondary_impact: '\u22122,800 kWh/yr',
    confidence: 0.91,
    priority: 'medium',
    status: 'implemented',
    proposedAt: '2026-01-22',
    approvedAt: '2026-01-29',
    approvedBy: { name: 'Ayesha Rahman', role: 'Facilities Manager' },
    implementedAt: '2026-02-03',
    outcome: {
      predicted: '$4,100/yr',
      actual: '$4,100/yr (on plan)',
      narrative:
        'Zero manual override events in the first 60 days. Late-shift ratings unchanged. New schedule rolled to Floors 7 and 9 next quarter on the same plan.',
    },
    reasoning: [
      'Floor 8 occupancy drops to ~3% after 18:30 weekdays',
      'Existing schedule held lights at 100% until 23:00',
      'New schedule dims to 30% from 19:00, full off at 21:30',
    ],
    dataSources: ['Floor 8 occupancy', 'Lighting controller logs', 'After-hours badge swipes'],
    implementation: [
      { when: 'Day 1', what: 'Push new schedule with manual override available' },
      { when: 'Week 2', what: 'Confirm zero override events \u00b7 finalize' },
    ],
    risk: 'low',
  },
  {
    id: 'in-past-003',
    track: 'financial',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Cleaning route consolidation \u2014 Floors 18\u201322',
    summary:
      'Five-floor block had three overlapping passes per day. Merging the 14:00 and 16:00 passes saved ~6 crew-hours/week without lifting hygiene KPI.',
    impact_kind: 'dollars',
    impact: { amount: 7800, period: 'year' },
    secondary_impact: '\u22126 crew-hours/week',
    confidence: 0.93,
    priority: 'high',
    status: 'implemented',
    proposedAt: '2026-02-04',
    approvedAt: '2026-02-12',
    approvedBy: { name: 'Maria Chen', role: 'Lead Custodian' },
    implementedAt: '2026-02-19',
    outcome: {
      predicted: '−6 crew-hours/week',
      actual: '−7 crew-hours/week',
      narrative:
        'Beat the projection by ~17% — crew adapted to the consolidated 15:00 sweep faster than expected. Hygiene SLA held at 98.4% (target 98%). Freed crew redirected to Fl 32 hot spots, which closed 4 prior breach windows.',
    },
    reasoning: [
      'NFC log analysis showed 14:00 + 16:00 sweeps duplicated 70% of touchpoints',
      'Hygiene SLA performance held > 98% during shadow run',
      'Crew preferred the consolidated 15:00 sweep \u2014 less context-switching',
    ],
    dataSources: ['Smart Logger Basic NFC trail', 'Hygiene SLA scorecard', 'Crew shift survey'],
    implementation: [
      { when: 'Day 1', what: 'Shadow-mode the merged route for 2 weeks' },
      { when: 'Week 3', what: 'Cut the 16:00 pass \u00b7 redirect freed crew to Fl 32 hot spots' },
    ],
    risk: 'low',
  },
  {
    id: 'in-past-004',
    track: 'financial',
    category: 'hvac',
    audience: ['facility', 'hvac'],
    title: 'Setpoint widening on weekday daytime',
    summary:
      'Tightened ASHRAE band 22\u201324\u00b0C to 21\u201325\u00b0C across non-perimeter zones. No comfort drop, materially less compressor cycling.',
    impact_kind: 'dollars',
    impact: { amount: 11500, period: 'year' },
    secondary_impact: '\u22128,400 kWh/yr',
    confidence: 0.94,
    priority: 'high',
    status: 'implemented',
    proposedAt: '2026-02-15',
    approvedAt: '2026-02-26',
    approvedBy: { name: 'Ayesha Rahman', role: 'Facilities Manager' },
    implementedAt: '2026-03-08',
    outcome: {
      predicted: '$11,500/yr',
      actual: '$12,300/yr (annualized after 60 days)',
      narrative:
        'Outperformed by ~7% — compressor cycling fell more than the model expected on perimeter zones with western exposure. Comfort complaint volume flat YoY for the same window.',
    },
    reasoning: [
      '90-day analysis of compressor cycling vs. setpoint band',
      'Comfort complaints did not rise during a 4-week shadow widening',
      'ASHRAE 55 still satisfied at the wider band given air movement',
    ],
    dataSources: ['BMS compressor logs', 'Comfort complaint volume', 'Zone humidity 90d'],
    implementation: [
      { when: 'Day 1', what: 'Apply wider band on Fl 2\u201311 only \u00b7 monitor 4 weeks' },
      { when: 'Week 5', what: 'Roll to remaining floors \u00b7 keep perimeter tight' },
    ],
    risk: 'low',
  },
  {
    id: 'in-past-005',
    track: 'financial',
    category: 'space',
    audience: ['facility'],
    title: 'Conference-room auto-release after 15 min ghost',
    summary:
      'Recovered ~14 hours/week of conference-room time per floor by auto-releasing ghost bookings to the open pool.',
    impact_kind: 'dollars',
    impact: { amount: 5400, period: 'year' },
    secondary_impact: '+12% conf-room utilization',
    confidence: 0.89,
    priority: 'medium',
    status: 'implemented',
    proposedAt: '2026-03-08',
    approvedAt: '2026-03-15',
    approvedBy: { name: 'Robin Cole', role: 'Super Admin' },
    implementedAt: '2026-03-22',
    outcome: {
      predicted: '+12% conf-room utilization',
      actual: '+14% conf-room utilization',
      narrative:
        'False-positive rate landed at 1.2% — well under the 2% target. Walk-up bookings on freed rooms doubled in week 2. Two power users reported the auto-release feels "right" rather than punitive.',
    },
    reasoning: [
      'PIR + booking cross-check showed ~22% of bookings were ghosts',
      'Auto-release after 15 min held false-positive rate < 2%',
      'Walk-up booking volume rose immediately on freed rooms',
    ],
    dataSources: ['Booking system', 'Conference-room PIR', 'Walk-up override events'],
    implementation: [
      { when: 'Day 1', what: 'Enable on Fl 18, 22, 32 \u00b7 mid-density floors' },
      { when: 'Week 3', what: 'Roll to all floors after false-positive review' },
    ],
    risk: 'medium',
  },
  {
    id: 'in-past-006',
    track: 'financial',
    category: 'supply',
    audience: ['facility', 'cleaning'],
    title: 'Restroom paper restock cadence retune',
    summary:
      'Replaced fixed twice-a-day restock with consumption-driven button-flag triggering. Reduced overstock and emergency runs.',
    impact_kind: 'dollars',
    impact: { amount: 3200, period: 'year' },
    secondary_impact: '\u22121.4 hrs/week of supply runs',
    confidence: 0.87,
    priority: 'medium',
    status: 'implemented',
    proposedAt: '2026-03-19',
    approvedAt: '2026-03-27',
    approvedBy: { name: 'Maria Chen', role: 'Lead Custodian' },
    implementedAt: '2026-04-04',
    outcome: {
      predicted: '−1.4 hrs/week of supply runs',
      actual: '−1.6 hrs/week of supply runs',
      narrative:
        'Zero emergency restock incidents since cutover. Inventory holding cost dropped ~28% on the pilot floors. Crew prefers the new flow — fewer wasted trips to fully-stocked rooms.',
    },
    reasoning: [
      'Smart Logger button-flag rate gives a real-time low-supply signal',
      'Old fixed cadence overstocked low-traffic restrooms by ~30%',
      'Emergency restock incidents fell to zero in a 30-day pilot',
    ],
    dataSources: ['Smart Logger Basic flags', 'Restock route logs', 'Inventory consumption 90d'],
    implementation: [
      { when: 'Day 1', what: 'Pilot on Fl 8 + Fl 32 high-traffic restrooms' },
      { when: 'Week 4', what: 'Roll to all floors \u00b7 retire fixed cadence' },
    ],
    risk: 'low',
  },
  {
    id: 'in-past-007',
    track: 'financial',
    category: 'space',
    audience: ['facility'],
    title: 'Elevator dispatch pacing \u2014 destination dispatch tuning',
    summary: 'OTIS pacing config retuned for shoulder hours. Cut dispatch wait times and reduced empty-cab travel.',
    impact_kind: 'dollars',
    impact: { amount: 6200, period: 'year' },
    secondary_impact: '\u22122.3 sec average wait',
    confidence: 0.92,
    priority: 'medium',
    status: 'implemented',
    proposedAt: '2026-04-04',
    approvedAt: '2026-04-13',
    approvedBy: { name: 'Ayesha Rahman', role: 'Facilities Manager' },
    implementedAt: '2026-04-21',
    outcome: {
      predicted: '−2.3 sec average wait',
      actual: '−2.1 sec average wait',
      narrative:
        'Slightly under projection on the wait-time metric but complaint volume fell 18% (vs. 12% predicted) — the empty-cab travel improvement turned out to matter more to occupants than raw wait reduction.',
    },
    reasoning: [
      'Shoulder-hour traffic patterns differ from morning peak \u2014 original config was peak-tuned',
      'Empty-cab travel was 18% of total trips during shoulder hours',
      'Vendor-supplied tuning playbook matched the Floor 1 lobby pattern',
    ],
    dataSources: ['Elevator controller telemetry', 'Lobby PIR baselines', 'Wait-time analytics'],
    implementation: [
      { when: 'Day 1', what: 'OTIS pushes new config \u00b7 monitor wait + complaint logs' },
      { when: 'Week 4', what: 'Compare wait time vs. baseline month \u00b7 lock in' },
    ],
    risk: 'low',
  },
];

// ════════════════════════════════════════════════════════════════════
// First Empire Bank · 578-branch ecosystem insights
// Every entry comes from what a Touch eInk display at a branch can
// actually observe: NFC cleaning check-ins, supply button presses,
// customer 5-star ratings, embedded sensors, and display health.
// ════════════════════════════════════════════════════════════════════

export const INSIGHTS_ECOSYSTEM = [
  {
    id: 'ine-001',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Renegotiate regional cleaning contracts based on NFC-verified efficiency',
    summary:
      '3 vendors cover the state. SparkleCo\u2019s NFC times across 180 branches are 20% faster than NY Shine for the same cleaning outcome (rating + button flags). Merge at SparkleCo\u2019s rate across all upstate branches.',
    impact_kind: 'dollars',
    impact: { amount: 182000, period: 'year' },
    secondary_impact: '\u2212220 crew-hours/week',
    confidence: 0.88,
    priority: 'high',
    status: 'new',
    ageDays: 6,
    reasoning: [
      '180-branch NFC log shows SparkleCo averages 4m 40s per sweep vs NY Shine\u2019s 5m 50s',
      'Customer rating delta between vendors: 0.06\u2605 (not statistically meaningful)',
      'Button-flag rate (paper low, ask for cleaning) within 3% across vendors \u2014 outcome quality matches',
      'Switching Hudson Valley + Capital Region (132 branches) to SparkleCo rate saves $182k/yr without SLA risk',
    ],
    dataSources: ['NFC check-in/out logs 180d', 'Customer ratings by branch', 'Vendor contracts + rate cards'],
    implementation: [
      { when: '1 month', what: 'Issue RFP renewal under new unified rate' },
      { when: '3 months', what: 'Transition Hudson + Capital to SparkleCo \u00b7 monitor SLA weekly' },
      { when: '6 months', what: 'Extend to North Country + Southern Tier if metrics hold' },
    ],
    risk: 'medium',
  },
  {
    id: 'ine-002',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Consolidate regional cleaning coordinators · 9 \u2192 5',
    summary:
      'Regional coordinators currently dispatch routes manually. Merlin-driven dispatch means 5 coordinators can cover the same 578 branches with better SLA attainment.',
    impact_kind: 'dollars',
    impact: { amount: 210000, period: 'year' },
    secondary_impact: '\u22124 FTE \u00b7 reallocate to field ops',
    confidence: 0.79,
    priority: 'high',
    status: 'new',
    ageDays: 11,
    reasoning: [
      '9 coordinators today · each manages ~64 branches · peak capacity ~80',
      'Merlin auto-dispatch already handled 78% of routing decisions in Q1 (measured vs manual overrides)',
      '5 coordinators at 116 branches each is feasible with Merlin carrying 78%+ of the load',
      'Redistribution preserves on-call coverage and reduces role redundancy',
    ],
    dataSources: ['Dispatch decision logs Q1', 'Coordinator rosters + hours', 'Override rate tracking'],
    implementation: [
      { when: '2 weeks', what: 'Pilot 1 coordinator managing 2 regions with Merlin fallback' },
      { when: '3 months', what: 'Attrition + reassignment to reach 5-coordinator structure' },
    ],
    risk: 'high',
  },
  {
    id: 'ine-003',
    category: 'satisfaction',
    audience: ['facility', 'cleaning'],
    title: 'Target the 24 branches rated below 3.5\u2605',
    summary:
      'Bottom-24 branches share 3 common root causes across button-flag patterns. Addressing those would lift branch-average ratings ~0.4\u2605 statewide.',
    impact_kind: 'dollars',
    impact: { amount: 88000, period: 'year' },
    secondary_impact: '+0.4\u2605 statewide average',
    confidence: 0.81,
    priority: 'high',
    status: 'new',
    ageDays: 3,
    reasoning: [
      '24 branches below 3.5\u2605 over the past 30 days',
      '67% of negative flags cluster on 3 causes: paper-towel shortages, NFC reader intermittents, HVAC drift in restrooms',
      'Brand team estimates retention value at ~$3,600/yr per branch segment \u2192 ~$88k/yr',
      'Fixes are known: supply frequency + reader swap + comfort setpoint',
    ],
    dataSources: ['Branch ratings 90d', 'Button press patterns by location', 'Brand retention model'],
    implementation: [
      { when: '2 weeks', what: 'Per-branch root cause report + targeted fix playbook' },
      { when: '1 month', what: 'Field visits + supply cadence change at the 24 sites' },
      { when: '3 months', what: 'Measure rating delta vs controls' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-004',
    category: 'supply',
    audience: ['facility', 'cleaning'],
    title: 'State-wide bulk consumables · quarterly',
    summary:
      'Consolidate per-branch weekly PO into one quarterly state-wide order. Volume discount + fewer inbound receipts.',
    impact_kind: 'dollars',
    impact: { amount: 24000, period: 'year' },
    secondary_impact: '\u2212468 branch deliveries/year',
    confidence: 0.92,
    priority: 'medium',
    status: 'in_review',
    ageDays: 8,
    reasoning: [
      '578 branches \u00d7 monthly order = 6,936 deliveries/year (average 12/wk statewide)',
      'Supplier offers 11% off at quarterly state-wide pallet consolidation',
      'Distribution via existing cash-logistics run \u2014 no extra courier cost',
      'Branches have storage for 6\u201310 weeks of consumables on average',
    ],
    dataSources: ['Supplier quote Q2', 'Branch storage survey', 'Cash-logistics route schedule'],
    implementation: [
      { when: '2 weeks', what: 'Sign quarterly pallet agreement' },
      { when: '3 months', what: 'First bulk order lands \u00b7 Merlin updates reorder triggers' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-005',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'Dynamic cleaning dispatch across 180 upstate branches',
    summary:
      'Upstate branches show restroom occupancy peaks Tue/Wed 11:00\u201314:00 only. Moving to button-press-triggered dispatch cuts 1 sweep/day without breaching SLA.',
    impact_kind: 'dollars',
    impact: { amount: 62000, period: 'year' },
    secondary_impact: '\u22121 sweep/day at 180 sites',
    confidence: 0.86,
    priority: 'medium',
    status: 'new',
    ageDays: 5,
    reasoning: [
      'Upstate branches average 42 visitors/day vs NYC Metro\u2019s 220',
      'Current schedule: 3 fixed sweeps regardless of traffic',
      'Recommended: dynamic dispatch once the \u201cask for cleaning\u201d button fires OR occupancy threshold hits',
      'Models 2 sweeps/day vs 3, holding Hygiene SLA at 97.8% (currently 98.1%)',
    ],
    dataSources: ['Occupancy signals 90d', 'NFC timing logs', 'Button-flag outcomes', 'Rating delta'],
    implementation: [
      { when: '2 weeks', what: 'Pilot in Finger Lakes (55 branches)' },
      { when: '2 months', what: 'Extend to Western NY + North Country if metrics hold' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-006',
    category: 'compliance',
    audience: ['facility', 'cleaning', 'security'],
    title: 'Retire the per-branch paper cleaning sign-in sheet',
    summary:
      'NFC check-in + check-out per cleaner per visit already satisfies the bank\u2019s vendor SLA audit requirement. 578 paper logs can be retired.',
    impact_kind: 'hours',
    impact: { amount: 2808, period: 'year' },
    secondary_impact: '54 hours/week across branch managers',
    confidence: 0.98,
    priority: 'medium',
    status: 'new',
    ageDays: 7,
    reasoning: [
      'Vendor SLA audit requires tamper-evident record \u00b7 NFC trail covers this per Q1 legal review',
      'Branch managers spend ~6 minutes/day reconciling paper logs vs Merlin trail (578 \u00d7 6min \u00d7 5d \u00d7 52w)',
      'Auditors already pull the Merlin NFC report for sample checks; paper is now redundant',
    ],
    dataSources: ['Q1 compliance review', 'NFC trail coverage', 'Branch manager time tracking'],
    implementation: [
      { when: '1 week', what: 'Update branch playbook \u00b7 notify vendor coordinators' },
      { when: 'ongoing', what: 'Quarterly audit pulls directly from the NFC trail' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-007',
    category: 'reliability',
    audience: ['facility', 'maintenance'],
    title: 'Bundle battery-swap run across Western NY · 22 displays',
    summary:
      '22 Touch eInk displays in Buffalo + Rochester + Jamestown trending below 20%. Single field day cheaper than staggered per-branch visits.',
    impact_kind: 'dollars',
    impact: { amount: 3200, period: 'year' },
    secondary_impact: '\u221218 vendor callouts',
    confidence: 0.93,
    priority: 'medium',
    status: 'new',
    ageDays: 2,
    reasoning: [
      '22 displays projected to cross 15% within 45 days',
      'Per-branch callout fee: $180 \u2192 staggered visits cost ~$3,960',
      'Single field day (one installer, 22 sites, routed): ~$720 labor + per-diem',
      'Same outcome, earlier: all batteries at 100% within one week vs 45-day tail',
    ],
    dataSources: ['Battery telemetry', 'Installer rate card', 'Western NY routing history'],
    implementation: [
      { when: '3 days', what: 'Issue PO for 22 battery packs \u00b7 schedule Alicia for one day' },
      { when: '2 weeks', what: 'Field day \u00b7 swap complete \u00b7 update lifecycle history' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-008',
    category: 'reliability',
    audience: ['facility', 'maintenance'],
    title: 'Pre-order 18 display units before predicted failures',
    summary:
      '18 branch displays match the pre-failure signature from 2024 (calibration drift + NFC intermittency). Ordering now avoids emergency-expedited shipping when they fail.',
    impact_kind: 'dollars',
    impact: { amount: 8400, period: 'year' },
    secondary_impact: 'Avoid 4-day gap per site',
    confidence: 0.82,
    priority: 'medium',
    status: 'new',
    ageDays: 4,
    reasoning: [
      '18 displays show the calibration drift + NFC packet-loss pattern that preceded 2024 failures (n=34, 82% correlation)',
      'Standard ship is 5 days; expedited is 2 at +35% cost',
      'Pre-ordering = standard ship arrives before predicted failure window \u2192 no branch downtime',
      'Avoided emergency shipping + avoided cleaning SLA gap during outage',
    ],
    dataSources: ['Device telemetry trends', '2024 failure cohort analysis', 'Adaptiv shipping cost table'],
    implementation: [
      { when: '1 day', what: 'Add 18 ADX-TD-12 to Adaptiv PO \u00b7 standard ship' },
      { when: '1 week', what: 'Devices land \u00b7 Merlin pre-pairs them to the target slots' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-009',
    category: 'compliance',
    audience: ['facility', 'maintenance', 'security'],
    title: 'Promote firmware v4.13.0-rc2 to stable fleet-wide',
    summary:
      '576 of 578 displays on the candidate for 72h with 0 regressions. Stable promotion unlocks 15% faster NFC read + per-zone temp calibration.',
    impact_kind: 'operational',
    impact: { amount: 0, period: null },
    secondary_impact: '15% faster NFC reads \u00b7 zone temp calibration',
    confidence: 0.97,
    priority: 'medium',
    status: 'in_review',
    ageDays: 3,
    reasoning: [
      '99.65% of fleet running the release candidate',
      '0 regressions logged across 72h \u00b7 3 cosmetic fixes already shipped',
      'Feature payload: NFC read speed, per-zone temp recalibration API, faster wake-from-sleep',
    ],
    dataSources: ['Firmware telemetry', 'Regression dashboard', 'Release changelog'],
    implementation: [
      { when: '1 day', what: 'Promote tag stable-4.13.0 \u00b7 notify change board' },
      { when: '1 week', what: 'Auto-roll remaining 0.35% on next heartbeat' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-010',
    category: 'compliance',
    audience: ['facility', 'security'],
    title: 'Auto-generate quarterly compliance report for all 578 branches',
    summary:
      'Every data point the compliance team pulls manually is already in Merlin. Weekly digest + quarterly filing can be fully automated.',
    impact_kind: 'hours',
    impact: { amount: 936, period: 'year' },
    secondary_impact: '18 hours/week of compliance labor recovered',
    confidence: 0.96,
    priority: 'medium',
    status: 'new',
    ageDays: 10,
    reasoning: [
      'Compliance team spends ~18 hours/week aggregating NFC taps, firmware versions, and incident logs across 578 branches',
      'Every required field is already in the Merlin data model; format matches Q1 filing 1:1',
      'Saved profile can render on Mon 06:00 weekly + auto-submit to regulator portal quarterly',
    ],
    dataSources: ['Q1 compliance filing', 'Merlin data model', 'Compliance team timesheets'],
    implementation: [
      { when: '2 weeks', what: 'Template matches Q1 filing byte-for-byte \u00b7 shadow run' },
      { when: '1 month', what: 'Live weekly digest + Q2 auto-submission' },
    ],
    risk: 'low',
  },
  {
    id: 'ine-011',
    category: 'compliance',
    audience: ['facility', 'security'],
    title: 'Auto-generate branch opening checklist verification',
    summary:
      'Branches manually confirm opening checks every morning. NFC + embedded sensors already verify most items; automating saves branch-manager time and increases reliability.',
    impact_kind: 'hours',
    impact: { amount: 4056, period: 'year' },
    secondary_impact: '78 hours/week across 578 branch managers',
    confidence: 0.87,
    priority: 'medium',
    status: 'new',
    ageDays: 12,
    reasoning: [
      '578 branches \u00d7 8 min/day of manual checklist (exceptions only) \u2192 ~78 hrs/week',
      'Light level, NFC reader status, display health, HVAC temp \u2014 all continuously sampled',
      'Branch manager reviews only exceptions Merlin surfaces (\u223c5% of opens)',
      'Risk: branches skip manual check \u2014 mitigated by keeping the 2-tap confirm',
    ],
    dataSources: ['Embedded sensors (temp, noise, light)', 'NFC heartbeat', 'Display health stream'],
    implementation: [
      { when: '2 weeks', what: 'Deploy checklist widget to 10 pilot branches \u00b7 measure exception rate' },
      { when: '2 months', what: 'Roll statewide if exception SLA holds' },
    ],
    risk: 'medium',
  },
  {
    id: 'ine-012',
    category: 'cleaning',
    audience: ['facility', 'cleaning'],
    title: 'NFC-triggered supply reorder across 578 branches',
    summary:
      'Button presses for paper towels / soap are already captured. Auto-triggering reorders per branch based on rolling burn rate saves emergency deliveries.',
    impact_kind: 'dollars',
    impact: { amount: 38000, period: 'year' },
    secondary_impact: '\u221274 emergency deliveries/year',
    confidence: 0.9,
    priority: 'medium',
    status: 'new',
    ageDays: 6,
    reasoning: [
      'Every \u201cPaper low\u201d / \u201cSoap missing\u201d button press is timestamped + locationed',
      'Current process: branch manager calls in when inventory is low \u2192 often too late, emergency delivery required',
      'Burn-rate model per branch predicts the 72-hour reorder window',
      'Emergency delivery surcharge is $515/occurrence \u00d7 74/year avoided',
    ],
    dataSources: ['Button press events 180d', 'Inventory draw-down patterns', 'Delivery surcharge invoices'],
    implementation: [
      { when: '1 week', what: 'Enable Merlin auto-trigger on trailing 7-day burn-rate threshold' },
      { when: '1 month', what: 'Measure emergency delivery reduction + inventory turn rate' },
    ],
    risk: 'low',
  },
];

export const INSIGHTS_ECOSYSTEM_SAVED_YTD = 184000;
export const INSIGHTS_ECOSYSTEM_IMPLEMENTED = 4;

export function filterInsightsForRole(list, roleId) {
  if (!roleId || roleId === 'facility' || roleId === 'superadmin') return list;
  return list.filter((i) => Array.isArray(i.audience) && i.audience.includes(roleId));
}

// Default any insight without an explicit track to 'financial'.
export function trackOf(insight) {
  return insight.track || 'financial';
}

// Past actions = implemented financial insights with an `implementedAt`
// date. Sorted newest-first so the Past-actions sub-tab on Financials
// v2 reads as a reverse chronology of wins.
export function pastActionsOf(list) {
  return list
    .filter((i) => i.status === 'implemented' && i.implementedAt)
    .filter((i) => trackOf(i) === 'financial')
    .slice()
    .sort((a, b) => (b.implementedAt || '').localeCompare(a.implementedAt || ''));
}

// Realized $ rolling up the past-actions list. Returns the sum of
// every implemented action's `impact.amount` (annualized $). Hours-
// or operational-impact actions don't count toward the dollar total.
export function realizedDollars(actions) {
  return actions.reduce((sum, a) => {
    if (a.impact_kind !== 'dollars') return sum;
    return sum + (a.impact?.amount || 0);
  }, 0);
}

export function filterInsightsByTrack(list, trackId) {
  if (!trackId) return list;
  // Financials v2 is a clone tab — it draws from the same pool as
  // 'financial' so we can build new UI on top of the v1 data set.
  const effective = FINANCIAL_LIKE_TRACKS.has(trackId) ? 'financial' : trackId;
  return list.filter((i) => trackOf(i) === effective);
}

// Rolled-up stats derived once from the insights list above.
// Includes financial $/hr aggregates AND wellbeing aggregates (sum by unit).
export function computeInsightStats(list) {
  const active = list.filter((i) => i.status !== 'dismissed');
  const dollars = active.filter((i) => i.impact_kind === 'dollars').reduce((s, i) => s + (i.impact.amount || 0), 0);
  const hours = active.filter((i) => i.impact_kind === 'hours').reduce((s, i) => s + (i.impact.amount || 0), 0);

  // Wellbeing aggregates by unit. We track sum AND count per unit because
  // some units (★ ratings) average instead of sum — a lift of +1.7★ at one
  // restroom plus +0.6★ at another is not a 2.3★ lift; it's an average.
  const wellbeingByUnit = {};
  const wellbeingCountByUnit = {};
  for (const i of active) {
    if (i.impact_kind !== 'wellbeing') continue;
    const u = i.impact.unit || 'units';
    wellbeingByUnit[u] = (wellbeingByUnit[u] || 0) + (i.impact.amount || 0);
    wellbeingCountByUnit[u] = (wellbeingCountByUnit[u] || 0) + 1;
  }

  const by = (s) => list.filter((i) => i.status === s).length;
  return {
    potentialDollars: dollars,
    potentialHours: hours,
    wellbeingByUnit,
    wellbeingCountByUnit,
    counts: {
      total: list.length,
      new: by('new'),
      in_review: by('in_review'),
      approved: by('approved'),
      implemented: by('implemented'),
      dismissed: by('dismissed'),
    },
  };
}
