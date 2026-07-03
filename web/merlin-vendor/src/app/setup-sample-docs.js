// Sample documents for the Admin → Setup demo. Generates REAL downloadable
// files (PDF via pdf-lib, XLSX via xlsx) so a presenter can download one and
// drag it back into the dropzone — and exposes the rich `extracted` fields
// each maps to, so the classifier (mockAnalyze) and the doc-row preview
// share ONE source of truth. Demo data; swap for /api/extract when wiring
// real extraction.

// Each sample: filename, the kind it classifies as, an optional clarifying
// question Merlin asks, the rich extracted fields shown in the preview, and a
// builder that produces the actual file Blob.
export const SAMPLE_DOCS = [
  {
    id: 'contract',
    fileName: 'CleanCo-master-agreement.pdf',
    kind: 'contract',
    question: 'Is this the renewal that supersedes the 2024 CleanCo contract, or a new vendor?',
    extracted: {
      Vendor: 'CleanCo Facilities Services',
      Service: 'Cleaning & hygiene',
      'Annual value': '$184,000',
      Term: '2026-01-01 → 2027-12-31 · auto-renew',
      'Rate card': '3 lines (day porter, deep clean, periodics)',
      Penalties: '2 (hygiene SLA miss, missed audit)',
    },
  },
  {
    id: 'sla',
    fileName: 'Hygiene-SLA-terms.pdf',
    kind: 'sla',
    question: null,
    extracted: {
      'Hygiene response': '< 20 min',
      'Comfort temp': '±2°C of setpoint',
      'Air quality': 'CO₂ < 900 ppm',
      Supplies: '0 stockouts',
      Penalty: '2% of monthly fee per breach',
    },
  },
  {
    id: 'roster',
    fileName: 'Meridian-HQ-staff-roster.xlsx',
    kind: 'roster',
    question: null,
    extracted: {
      Headcount: '12 people',
      Trades: 'Cleaning, HVAC, Security',
      Certifications: '9 on file · 1 expiring < 30 days',
      Shifts: 'Day, Evening, Night',
    },
  },
  {
    id: 'floorplan',
    fileName: 'Floor-plans-HQ.pdf',
    kind: 'floorplan',
    question: 'Floor 32 appears twice in the plan — is the second one a mezzanine, or a labelling duplicate?',
    extracted: {
      Floors: '50',
      Zones: '18',
      Rooms: '~360 (restrooms, meeting, conf, open-plan)',
      'Mech rooms': '2',
    },
  },
];

// Look up the sample metadata (kind / question / extracted) for a filename,
// so a dropped sample file gets its rich preview. Falls back to null.
export function sampleForFileName(name) {
  const lc = String(name || '').toLowerCase();
  return SAMPLE_DOCS.find((s) => s.fileName.toLowerCase() === lc) || null;
}
