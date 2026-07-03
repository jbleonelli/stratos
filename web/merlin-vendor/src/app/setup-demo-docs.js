// @ts-check
// Mocked "already uploaded" documents for the Admin → Setup demo. Renders as
// a lived-in document library: each file shows the type Merlin classified it
// as + a one-line summary Merlin "wrote" about its contents. Demo data only
// (no real files); the live upload→analyze→confirm flow still works on top.
//
// `kind` matches SETUP_DOC_KINDS in Admin.jsx (contract | sla | roster |
// floorplan | devices | suppliers). `summary` is Merlin's plain-English read.

export const SETUP_DEMO_DOCS = [
  {
    name: 'CleanCo-master-services-agreement.pdf',
    kind: 'contract',
    summary:
      'Cleaning master agreement with CleanCo — $184k/yr, auto-renews 2027, 60-day notice, 3-line rate card + 2 SLA penalties.',
  },
  {
    name: 'CoolTech-HVAC-maintenance-contract.pdf',
    kind: 'contract',
    summary:
      'HVAC preventive-maintenance contract with CoolTech — quarterly service, 4-hour emergency response, $62k/yr.',
  },
  {
    name: 'SecureCo-guarding-agreement-2026.pdf',
    kind: 'contract',
    summary:
      'Security guarding contract with SecureCo — 24/7 lobby + patrol cover, 2 FTE, $138k/yr, monthly KPI review.',
  },
  {
    name: 'OTIS-elevator-service-contract.pdf',
    kind: 'contract',
    summary: 'Elevator service agreement with OTIS — 6 cars, monthly inspection, annual load test, 5-year term.',
  },
  {
    name: 'AquaServ-water-treatment-contract.pdf',
    kind: 'contract',
    summary:
      'Cooling-tower water-treatment contract with AquaServ — biweekly dosing, quarterly Legionella culture, $21k/yr.',
  },

  {
    name: 'Hygiene-SLA-terms.pdf',
    kind: 'sla',
    summary: 'Hygiene SLA — restroom response < 20 min, 98% target, 2% monthly-fee penalty per breach.',
  },
  {
    name: 'Comfort-temperature-SLA.pdf',
    kind: 'sla',
    summary: 'Comfort SLA — zone temperature within ±2°C of setpoint, 95% of occupied hours.',
  },
  {
    name: 'Air-quality-SLA.pdf',
    kind: 'sla',
    summary: 'Air-quality SLA — CO₂ below 900 ppm and TVOC below 800 ppb across occupied zones.',
  },
  {
    name: 'Security-response-SLA.pdf',
    kind: 'sla',
    summary: 'Security SLA — at least one escalation logged per weekday; alarm acknowledgement < 5 min.',
  },
  {
    name: 'Supplies-stock-SLA.pdf',
    kind: 'sla',
    summary: 'Supplies SLA — zero consumable stockouts; auto-reorder triggers at the per-item minimum threshold.',
  },

  {
    name: 'Meridian-HQ-staff-roster.xlsx',
    kind: 'roster',
    summary:
      'Staff roster — 12 people across cleaning, HVAC and security; 9 certifications on file, 1 expiring within 30 days.',
  },
  {
    name: 'CleanCo-crew-certifications.xlsx',
    kind: 'roster',
    summary: 'CleanCo crew certifications — 6 custodians, BICSc + COSHH current, next refresh due Q3.',
  },
  {
    name: 'Maintenance-on-call-rota.xlsx',
    kind: 'roster',
    summary: 'Maintenance on-call rota — 2-week rotation, primary + backup tech per night, weekend cover mapped.',
  },

  {
    name: 'Meridian-HQ-floor-plans.pdf',
    kind: 'floorplan',
    summary:
      'Building floor plans — 50 floors, 18 zones, ~360 rooms, 2 mechanical rooms. Flag: floor 32 appears twice (verify mezzanine).',
  },
  {
    name: 'Floor-32-East-restroom-layout.pdf',
    kind: 'floorplan',
    summary: 'Floor 32 East restroom layout — 4 stalls, 3 basins, VOC sensor + NFC tap point positions marked.',
  },
  {
    name: 'Zone-map-conference-level.pdf',
    kind: 'floorplan',
    summary:
      'Conference level zone map — 4 conf rooms (Sycamore, Alder, Fir, Juniper) + open plan, occupancy sensors per room.',
  },

  {
    name: 'Device-inventory-export.csv',
    kind: 'devices',
    summary:
      'Device inventory — 772 devices across 9 kinds (eInk displays, air-quality, occupancy, badge readers, leak pucks); 93% online.',
  },
  {
    name: 'Sensor-commissioning-sheet.xlsx',
    kind: 'devices',
    summary:
      'Sensor commissioning sheet — 142 sensors bound to zones with install date, firmware and last-seen heartbeat.',
  },

  {
    name: 'Approved-suppliers-list.xlsx',
    kind: 'suppliers',
    summary: 'Approved suppliers — 6 vendors (cleaning, HVAC, waste, water, security, lift) with contacts and trade.',
  },
  {
    name: 'Consumables-supplier-pricelist.pdf',
    kind: 'suppliers',
    summary: 'Consumables price list — soap, paper towels, sanitiser per case with bulk-order discount tiers.',
  },
];
