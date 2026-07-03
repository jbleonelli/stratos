// @ts-check
// Single source of truth for the Servicing sub-groups (Cleaning / Security /
// Hospitality / Maintenance) — each is a sub-group with grouped areas that the
// ServicingOverview renders as cards and Operations.jsx drills into boards.
//
// area.domain = the demo_servicing_state domain for the generic ServicingBoard;
// null = Bathrooms (RestroomBoard, IMF-live aware). area.id is globally unique.

// Per-top-level-domain visual identity so the four sub-groups read distinctly
// (accent tints the overview header, area-card icons, board eyebrow). Hues are
// chosen to sit on both light + dark themes; soft variants derive via color-mix.
export const SERVICING_DOMAIN_META = {
  cleaning: { color: '#06b6d4', icon: 'cleaning', labelKey: 'tab.cleaning', fallback: 'Cleaning' },
  security: { color: '#6366f1', icon: 'security', labelKey: 'tab.security', fallback: 'Security' },
  hospitality: { color: '#f59e0b', icon: 'hospitality', labelKey: 'tab.hospitality', fallback: 'Hospitality' },
  maintenance: { color: '#f97316', icon: 'cog', labelKey: 'tab.maintenance', fallback: 'Maintenance' },
};
export const domainAccent = (key) => SERVICING_DOMAIN_META[key]?.color || 'var(--accent)';
export const domainSoft = (key) => `color-mix(in oklch, ${domainAccent(key)} 14%, transparent)`;
// The top-level domain a (sub-)domain key belongs to: 'cleaning_floors' → 'cleaning'.
export const topDomainOf = (key) => (key || '').split('_')[0];

export const SERVICING_DOMAINS = {
  cleaning: {
    labelKey: 'tab.cleaning',
    fallback: 'Cleaning',
    groups: [
      { id: 'spaces', labelKey: 'clean.group.spaces', fallback: 'Spaces' },
      { id: 'surfaces', labelKey: 'clean.group.surfaces', fallback: 'Surfaces & Air' },
      { id: 'supplies', labelKey: 'clean.group.supplies', fallback: 'Supplies & Programs' },
    ],
    areas: [
      {
        id: 'bathrooms',
        labelKey: 'tab.bathrooms',
        fallback: 'Bathrooms',
        icon: 'droplet',
        group: 'spaces',
        domain: null,
      },
      {
        id: 'common',
        labelKey: 'tab.clean_common',
        fallback: 'Common Areas',
        icon: 'building',
        group: 'spaces',
        domain: 'cleaning_common',
      },
      {
        id: 'workspaces',
        labelKey: 'tab.clean_workspaces',
        fallback: 'Workspaces & Desks',
        icon: 'room',
        group: 'spaces',
        domain: 'cleaning_workspaces',
      },
      {
        id: 'kitchens',
        labelKey: 'tab.clean_kitchens',
        fallback: 'Kitchens & Pantries',
        icon: 'sparkle',
        group: 'spaces',
        domain: 'cleaning_kitchens',
      },
      {
        id: 'stairwells',
        labelKey: 'tab.clean_stairwells',
        fallback: 'Stairwells',
        icon: 'floor',
        group: 'spaces',
        domain: 'cleaning_stairwells',
      },
      {
        id: 'elevators',
        labelKey: 'tab.clean_elevators',
        fallback: 'Elevators & Escalators',
        icon: 'ship',
        group: 'spaces',
        domain: 'cleaning_elevators',
      },
      {
        id: 'exterior',
        labelKey: 'tab.clean_exterior',
        fallback: 'Exterior & Entrances',
        icon: 'building2',
        group: 'spaces',
        domain: 'cleaning_exterior',
      },
      {
        id: 'floors',
        labelKey: 'tab.clean_floors',
        fallback: 'Floors & Carpets',
        icon: 'grid',
        group: 'surfaces',
        domain: 'cleaning_floors',
      },
      {
        id: 'windows',
        labelKey: 'tab.clean_windows',
        fallback: 'Windows & Glass',
        icon: 'grid',
        group: 'surfaces',
        domain: 'cleaning_windows',
      },
      {
        id: 'disinfection',
        labelKey: 'tab.clean_disinfection',
        fallback: 'Disinfection',
        icon: 'shield',
        group: 'surfaces',
        domain: 'cleaning_disinfection',
      },
      {
        id: 'vents',
        labelKey: 'tab.clean_vents',
        fallback: 'Air Vents & Filters',
        icon: 'air',
        group: 'surfaces',
        domain: 'cleaning_vents',
      },
      {
        id: 'waste',
        labelKey: 'tab.clean_waste',
        fallback: 'Waste & Recycling',
        icon: 'ship',
        group: 'supplies',
        domain: 'cleaning_waste',
      },
      {
        id: 'supplies',
        labelKey: 'tab.clean_supplies',
        fallback: 'Supplies',
        icon: 'supply',
        group: 'supplies',
        domain: 'cleaning_supplies',
      },
      {
        id: 'laundry',
        labelKey: 'tab.clean_laundry',
        fallback: 'Laundry & Linen',
        icon: 'droplet',
        group: 'supplies',
        domain: 'cleaning_laundry',
      },
      {
        id: 'deep',
        labelKey: 'tab.clean_deep',
        fallback: 'Deep & Specialty',
        icon: 'sparkle',
        group: 'supplies',
        domain: 'cleaning_deep',
      },
    ],
  },
  security: {
    labelKey: 'tab.security',
    fallback: 'Security',
    groups: [
      { id: 'access', labelKey: 'svc.group.access', fallback: 'Access' },
      { id: 'monitoring', labelKey: 'svc.group.monitoring', fallback: 'Monitoring' },
      { id: 'response', labelKey: 'svc.group.response', fallback: 'Response' },
    ],
    areas: [
      {
        id: 'security_access',
        labelKey: 'tab.sec_access',
        fallback: 'Access Control',
        icon: 'badge',
        group: 'access',
        domain: 'security_access',
      },
      {
        id: 'security_visitors',
        labelKey: 'tab.sec_visitors',
        fallback: 'Visitor Management',
        icon: 'people',
        group: 'access',
        domain: 'security_visitors',
      },
      {
        id: 'security_cctv',
        labelKey: 'tab.sec_cctv',
        fallback: 'Surveillance / CCTV',
        icon: 'camera',
        group: 'monitoring',
        domain: 'security_cctv',
      },
      {
        id: 'security_perimeter',
        labelKey: 'tab.sec_perimeter',
        fallback: 'Perimeter',
        icon: 'map',
        group: 'monitoring',
        domain: 'security_perimeter',
      },
      {
        id: 'security_patrols',
        labelKey: 'tab.sec_patrols',
        fallback: 'Patrols & Rounds',
        icon: 'shield',
        group: 'response',
        domain: 'security_patrols',
      },
      {
        id: 'security_incidents',
        labelKey: 'tab.sec_incidents',
        fallback: 'Incidents & Alarms',
        icon: 'warn',
        group: 'response',
        domain: 'security_incidents',
      },
    ],
  },
  hospitality: {
    labelKey: 'tab.hospitality',
    fallback: 'Hospitality',
    groups: [
      { id: 'foh', labelKey: 'svc.group.foh', fallback: 'Front of House' },
      { id: 'amenities', labelKey: 'svc.group.amenities', fallback: 'Amenities' },
      { id: 'logistics', labelKey: 'svc.group.logistics', fallback: 'Logistics' },
    ],
    areas: [
      {
        id: 'hospitality_reception',
        labelKey: 'tab.hosp_reception',
        fallback: 'Reception',
        icon: 'badge',
        group: 'foh',
        domain: 'hospitality_reception',
      },
      {
        id: 'hospitality_concierge',
        labelKey: 'tab.hosp_concierge',
        fallback: 'Concierge',
        icon: 'sparkle',
        group: 'foh',
        domain: 'hospitality_concierge',
      },
      {
        id: 'hospitality_fnb',
        labelKey: 'tab.hosp_fnb',
        fallback: 'Food & Beverage',
        icon: 'cart',
        group: 'amenities',
        domain: 'hospitality_fnb',
      },
      {
        id: 'hospitality_events',
        labelKey: 'tab.hosp_events',
        fallback: 'Meeting & Events',
        icon: 'room',
        group: 'amenities',
        domain: 'hospitality_events',
      },
      {
        id: 'hospitality_requests',
        labelKey: 'tab.hosp_requests',
        fallback: 'Guest Requests',
        icon: 'paper',
        group: 'logistics',
        domain: 'hospitality_requests',
      },
      {
        id: 'hospitality_mail',
        labelKey: 'tab.hosp_mail',
        fallback: 'Mail & Packages',
        icon: 'ship',
        group: 'logistics',
        domain: 'hospitality_mail',
      },
    ],
  },
  maintenance: {
    labelKey: 'tab.maintenance',
    fallback: 'Maintenance',
    groups: [
      { id: 'systems', labelKey: 'svc.group.systems', fallback: 'Building Systems' },
      { id: 'fabric', labelKey: 'svc.group.fabric', fallback: 'Fabric' },
      { id: 'programs', labelKey: 'svc.group.programs', fallback: 'Programs' },
    ],
    areas: [
      {
        id: 'maintenance_hvac',
        labelKey: 'tab.mnt_hvac',
        fallback: 'HVAC',
        icon: 'hvac',
        group: 'systems',
        domain: 'maintenance_hvac',
      },
      {
        id: 'maintenance_electrical',
        labelKey: 'tab.mnt_electrical',
        fallback: 'Electrical',
        icon: 'light',
        group: 'systems',
        domain: 'maintenance_electrical',
      },
      {
        id: 'maintenance_plumbing',
        labelKey: 'tab.mnt_plumbing',
        fallback: 'Plumbing',
        icon: 'droplet',
        group: 'systems',
        domain: 'maintenance_plumbing',
      },
      {
        id: 'maintenance_elevators',
        labelKey: 'tab.mnt_elevators',
        fallback: 'Elevators & Lifts',
        icon: 'ship',
        group: 'systems',
        domain: 'maintenance_elevators',
      },
      {
        id: 'maintenance_envelope',
        labelKey: 'tab.mnt_envelope',
        fallback: 'Building Envelope',
        icon: 'building',
        group: 'fabric',
        domain: 'maintenance_envelope',
      },
      {
        id: 'maintenance_grounds',
        labelKey: 'tab.mnt_grounds',
        fallback: 'Grounds & Landscaping',
        icon: 'campus',
        group: 'fabric',
        domain: 'maintenance_grounds',
      },
      {
        id: 'maintenance_pm',
        labelKey: 'tab.mnt_pm',
        fallback: 'Preventive Maintenance',
        icon: 'cog',
        group: 'programs',
        domain: 'maintenance_pm',
      },
      {
        id: 'maintenance_firesafety',
        labelKey: 'tab.mnt_firesafety',
        fallback: 'Fire & Life Safety',
        icon: 'bell',
        group: 'programs',
        domain: 'maintenance_firesafety',
      },
    ],
  },
};

export const SERVICING_GROUP_DOMAINS = Object.keys(SERVICING_DOMAINS); // ['cleaning','security','hospitality','maintenance']

const ALL_AREAS = Object.values(SERVICING_DOMAINS).flatMap((d) => d.areas);
export const AREA_BY_ID = Object.fromEntries(ALL_AREAS.map((a) => [a.id, a]));
// Keyed by the demo_servicing_state `domain` (e.g. 'maintenance_pm') so callers
// holding a raw domain string (the Hypervisor heatmap rows, chat grounding) can
// resolve a proper, i18n-ready label instead of mangling the key. Areas with a
// null domain (e.g. cleaning bathrooms) are skipped.
export const AREA_BY_DOMAIN = Object.fromEntries(ALL_AREAS.filter((a) => a.domain).map((a) => [a.domain, a]));
