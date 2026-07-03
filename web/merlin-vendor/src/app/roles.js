// Role definitions + filtering helpers.

export const ROLES = {
  superadmin: {
    // id stays 'superadmin' for back-compat with profiles.role + every
    // call-site that reads roleId; only the user-visible labels move.
    // "Super Admin" implied a platform-level (Adaptiv) concept and read
    // wrong inside a customer tenant — this role is actually the
    // workspace owner with full access to agents, config, and billing.
    // JB flag 2026-05-18.
    id: 'superadmin',
    name: 'Workspace Owner',
    short: 'Owner',
    who: 'Robin Cole',
    initials: 'RC',
    title: 'Workspace Owner',
    accent: '#FF00B2',
    canDeploy: true,
    domains: ['hygiene', 'hvac', 'space', 'supply', 'energy', 'security', 'safety', 'amenity', 'uptime'],
    deviceTypes: [
      'display_touch',
      'display_eink',
      'display_sdg',
      'smart_display_classic',
      'airq',
      'occupancy',
      'camera',
      'badge',
      'leak',
      'beacon',
      'pc_counter',
      'people_counter_basic',
      'smart_logger_basic',
      'parking_spot_sensor',
      'ev_charger',
    ],
    merlinPersona:
      'You are speaking with the Workspace Owner — they own everything (locations, users, devices, billing). Be comprehensive and strategic; reference cross-tenant patterns, governance, and risk.',
    suggestions: [
      'Who has admin access right now?',
      'How many devices across the workspace?',
      'Which location costs us the most?',
      'Show last week\u2019s ops summary',
    ],
    kpis: [
      { label: 'Locations', get: () => ({ value: '4', sub: '2 ecosystems', tone: 'info' }) },
      { label: 'Active users', get: () => ({ value: '5', sub: 'across roles', tone: 'accent' }) },
      { label: 'Critical today', get: () => ({ value: '2', sub: 'workspace-wide', tone: 'risk', pulse: true }) },
    ],
  },
  facility: {
    id: 'facility',
    name: 'Facility Manager',
    short: 'Facility',
    who: 'Jamie Lin',
    initials: 'JL',
    title: 'Facility Manager',
    accent: '#FF00B2',
    canDeploy: true,
    domains: ['hygiene', 'hvac', 'space', 'supply', 'energy', 'security', 'safety', 'amenity', 'uptime'],
    deviceTypes: [
      'display_touch',
      'display_eink',
      'smart_display_classic',
      'airq',
      'occupancy',
      'people_counter_basic',
      'smart_logger_basic',
      'camera',
      'badge',
      'leak',
      'beacon',
      'parking_spot_sensor',
      'ev_charger',
    ],
    merlinPersona:
      'You are speaking with the Facility Manager — they own the whole building. Be comprehensive; surface cross-domain patterns (energy + comfort + hygiene). Reference SLAs, costs, and strategic tradeoffs.',
    suggestions: [
      'Why is Floor 32 flagging again?',
      'Prep Monday board meeting',
      'Draft SLA report',
      "Where's cart #3?",
    ],
    kpis: [
      {
        label: 'Occupancy',
        get: (b) => ({
          value: `${Math.round(b.occupancy * 100)}%`,
          sub: `peak ${Math.round(b.peakToday * 100)}%`,
          tone: 'info',
        }),
      },
      { label: 'Actions today', get: () => ({ value: '247', sub: '+18 vs avg', tone: 'accent' }) },
      { label: 'SLA at risk', get: () => ({ value: '1', sub: '18m to breach', tone: 'risk', pulse: true }) },
    ],
  },
  cleaning: {
    id: 'cleaning',
    name: 'Cleaning Services',
    short: 'Cleaning',
    who: 'Maria Chen',
    initials: 'MC',
    title: 'Lead Custodian',
    accent: '#FF00B2',
    canDeploy: false,
    domains: ['hygiene', 'supply', 'amenity'],
    deviceTypes: [
      'display_touch',
      'display_eink',
      'smart_display_classic',
      'occupancy',
      'people_counter_basic',
      'smart_logger_basic',
      'airq',
    ],
    merlinPersona:
      'You are speaking with a Cleaning Services lead. Focus on restroom status, cleaning routes, supply levels, crew dispatch, feedback flags. Be warm and operational. Use cleaning language ("route", "refill", "sweep"). Never discuss HVAC setpoints, badge access, or firmware deploys.',
    greeting: 'Good afternoon, Maria. Your crew has 6 rooms on route — Floor 32 East is the priority.',
    suggestions: [
      'Where is my crew right now?',
      'What needs cleaning next?',
      'Flag a supply shortage',
      'Why is Floor 18 flagging?',
    ],
    kpis: [
      { label: 'Rooms cleaned', get: () => ({ value: '42', sub: 'of 58 scheduled', tone: 'ok' }) },
      { label: 'On route', get: () => ({ value: '6', sub: '3 crew active', tone: 'info' }) },
      { label: 'SLA at risk', get: () => ({ value: '1', sub: '18m to breach', tone: 'risk', pulse: true }) },
    ],
  },
  maintenance: {
    id: 'maintenance',
    name: 'Building Maintenance',
    short: 'Maintenance',
    who: 'Darnell Price',
    initials: 'DP',
    title: 'HVAC / Maintenance Tech',
    accent: '#2185D0',
    canDeploy: false,
    domains: ['hvac', 'uptime', 'safety', 'energy'],
    deviceTypes: [
      'airq',
      'leak',
      'beacon',
      'display_eink',
      'display_touch',
      'smart_display_classic',
      'people_counter_basic',
      'ev_charger',
    ],
    merlinPersona:
      'You are speaking with a Building Maintenance technician. Focus on HVAC, water leaks, elevators, filters, vendor SLAs (OTIS, Trane, Johnson Controls), work orders, setpoints, runtime hours. Be technical and terse. Never discuss cleaning routes or badge access policies.',
    greeting: 'Afternoon, Darnell. AHU-7 is due for a filter swap and OTIS is booked for B3 elevator service Saturday.',
    suggestions: ['What work orders are open?', 'Show AHU-7 runtime', 'Schedule filter swap', 'Elevator B3 history'],
    kpis: [
      { label: 'Open work orders', get: () => ({ value: '7', sub: '2 overdue', tone: 'warn' }) },
      { label: 'HVAC zones ok', get: () => ({ value: '47/50', sub: '1 drift, 2 warming', tone: 'info' }) },
      { label: 'Vendor SLA', get: () => ({ value: '98%', sub: 'OTIS, Trane on track', tone: 'ok' }) },
    ],
  },
  security: {
    id: 'security',
    name: 'Building Security',
    short: 'Security',
    who: 'Ivan Kovac',
    initials: 'IK',
    title: 'Security Lead',
    accent: '#20286D',
    canDeploy: false,
    domains: ['security', 'safety'],
    deviceTypes: ['camera', 'badge', 'beacon', 'smart_logger_basic', 'parking_spot_sensor'],
    merlinPersona:
      'You are speaking with Building Security. Focus on badge events, camera feeds, after-hours access, tailgating, held-open doors, visitor flow, incident escalation. Be crisp, operational, facts-first. Never discuss cleaning schedules or HVAC setpoints.',
    greeting:
      'Evening, Ivan. Two flags to review: Loading Dock B held open 14m, and a 14m badge visit to Server Room 32.',
    suggestions: [
      'Show after-hours badge activity',
      'Any doors held open?',
      'Camera status sweep',
      'Tailgate events today',
    ],
    kpis: [
      { label: 'Active flags', get: () => ({ value: '2', sub: '1 dock, 1 after-hours', tone: 'warn', pulse: true }) },
      { label: 'Cameras online', get: () => ({ value: '338/340', sub: '2 degraded', tone: 'info' }) },
      { label: 'Badge events', get: () => ({ value: '1,284', sub: 'today · 4 flagged', tone: 'info' }) },
    ],
  },

  // ─────────── Deferred-list roles, stub level ───────────
  // Recognized end-to-end (auth + chat persona + filters) but UX
  // shells aren't fully built yet. See docs/reference/roles.md for the long
  // form on each. Full persona UX comes in later phases.

  property_manager: {
    id: 'property_manager',
    name: 'Property Manager',
    short: 'Portfolio',
    who: 'Sarah Mendelson',
    initials: 'SM',
    title: 'VP Real Estate',
    accent: '#2185D0',
    canDeploy: true,
    // Sees the same domain set as Facility but at the portfolio level —
    // multiple buildings rolled up rather than one.
    domains: ['hygiene', 'hvac', 'space', 'supply', 'energy', 'security', 'safety', 'amenity', 'uptime'],
    deviceTypes: [
      'display_touch',
      'display_eink',
      'smart_display_classic',
      'airq',
      'occupancy',
      'people_counter_basic',
      'smart_logger_basic',
      'camera',
      'badge',
      'leak',
      'beacon',
    ],
    merlinPersona:
      'You are speaking with the Property Manager — they own a portfolio of buildings, not just one. Lead with cross-building rollups (cost / square foot, comparative SLA performance, occupancy vs. lease terms). Reference contracts and KPIs that matter at the REIT / owner-operator level — opex, NOI impact, capital plan. Never get pulled into single-room operational detail unless explicitly asked.',
    suggestions: [
      'Which building is most underperforming on hygiene SLAs?',
      'Show cost per occupied sqft this quarter',
      'Compare HVAC opex across the portfolio',
      'Quarterly board summary across buildings',
    ],
    kpis: [
      { label: 'Buildings', get: () => ({ value: '12', sub: '3 with active flags', tone: 'info' }) },
      { label: 'Portfolio SLA', get: () => ({ value: '94%', sub: '↓2pp vs last quarter', tone: 'warn' }) },
      { label: 'YTD savings', get: () => ({ value: '$612k', sub: 'auto-realized', tone: 'ok' }) },
    ],
  },

  tenant: {
    id: 'tenant',
    name: 'Tenant Contact',
    short: 'Tenant',
    who: 'Akira Yamamoto',
    initials: 'AY',
    title: 'Office Manager',
    accent: '#10b981',
    canDeploy: false,
    // Tenants see the slice that affects their leased floors. No HVAC
    // setpoints or security access — that belongs to the building owner.
    domains: ['hygiene', 'amenity', 'space'],
    deviceTypes: ['display_touch', 'display_eink', 'smart_display_classic', 'occupancy', 'people_counter_basic'],
    merlinPersona:
      'You are speaking with a Tenant Contact — the HR / office manager at a company leasing floors in this building. They care about their crew’s comfort and the SLAs the building owner committed to in their lease. Surface only the parts of the building that affect their floors: hygiene SLA on their restrooms, comfort on their zones, space utilization across their meeting rooms. Never expose other tenants’ data, security camera feeds, badge logs, or HVAC setpoint changes — those belong to the building owner.',
    suggestions: [
      'How are we tracking against the hygiene SLA on our floors?',
      'Which conference rooms are my team underusing?',
      'Open a ticket about Floor 32 East restroom',
      'Last month’s amenity uptime',
    ],
    kpis: [
      { label: 'My floors SLA', get: () => ({ value: '98%', sub: 'within lease commitment', tone: 'ok' }) },
      { label: 'Occupancy', get: () => ({ value: '64%', sub: 'avg across our floors', tone: 'info' }) },
      { label: 'Open tickets', get: () => ({ value: '2', sub: '1 awaiting building owner', tone: 'warn' }) },
    ],
  },

  auditor: {
    id: 'auditor',
    name: 'Auditor',
    short: 'Auditor',
    who: 'Patricia Owusu',
    initials: 'PO',
    title: 'SOC 2 / Compliance Auditor',
    accent: '#878ea3',
    canDeploy: false,
    // Read-only across compliance domains. Time-bounded credentials
    // are a future feature; UX-side they see everything but can't act.
    domains: ['safety', 'security', 'uptime', 'hygiene'],
    deviceTypes: [
      'camera',
      'badge',
      'leak',
      'beacon',
      'smart_display_classic',
      'smart_logger_basic',
      'people_counter_basic',
    ],
    merlinPersona:
      'You are speaking with a third-party Auditor (SOC 2 / health / safety inspector). They have read-only access for a specific engagement window. Surface evidence trails: cleaning NFC logs, audit-log entries, certificate expiry, agent decision histories with reasons. Be precise and dated — every claim should reference a timestamp or a row id. Never propose actions. Never disclose individual non-compliance attributable to a named user without the org admin confirming scope.',
    suggestions: [
      'Show the cleaning audit trail for last quarter',
      'Which compliance evidence gaps are open?',
      'Export agent decisions for the audit window',
      'Certificate expiry list',
    ],
    kpis: [
      { label: 'Audit window', get: () => ({ value: '90d', sub: 'Q1 2026 engagement', tone: 'info' }) },
      { label: 'Evidence rows', get: () => ({ value: '14.2k', sub: 'across hygiene + security', tone: 'info' }) },
      { label: 'Open gaps', get: () => ({ value: '3', sub: '2 cert-expiry, 1 NFC', tone: 'warn' }) },
    ],
  },

  fm_network: {
    id: 'fm_network',
    name: 'FM Network Dispatcher',
    short: 'Dispatch',
    who: 'Marcus Vance',
    initials: 'MV',
    title: 'CBRE / JLL Dispatcher',
    accent: '#FF8C42',
    canDeploy: false,
    // FM-network managers dispatch work orders across multiple
    // buildings + multiple contractor crews. Sees the cross-customer
    // routing surface, not in-room device detail.
    domains: ['hygiene', 'hvac', 'uptime', 'space', 'safety', 'supply'],
    deviceTypes: ['smart_display_classic', 'smart_logger_basic', 'people_counter_basic'],
    merlinPersona:
      'You are speaking with an FM Network Dispatcher (CBRE, JLL, Cushman & Wakefield-style). They route work across multiple customers and contractor crews. Lead with assignment, ETA, contractor SLA performance, and cost-vs-budget per work order. Reference routing decisions and contractor utilization. Never get pulled into per-room sensor readings — that is the on-site contractor’s scope, not the dispatcher’s.',
    suggestions: [
      'Show work orders open across the network',
      'Which contractor is slowest this week?',
      'Reassign Floor 18 cleaning to a different crew',
      'Tomorrow’s dispatch plan',
    ],
    kpis: [
      { label: 'Open WOs', get: () => ({ value: '47', sub: '6 overdue', tone: 'warn' }) },
      { label: 'Contractors', get: () => ({ value: '14', sub: '3 at-capacity', tone: 'info' }) },
      { label: 'Network SLA', get: () => ({ value: '92%', sub: 'rolling 7-day', tone: 'ok' }) },
    ],
  },

  executive: {
    id: 'executive',
    name: 'Executive',
    short: 'Exec',
    who: 'Daniel Rivera',
    initials: 'DR',
    title: 'CFO',
    accent: '#20286D',
    canDeploy: false,
    // Executives mostly want the rollups other roles produce — cost
    // savings realized, capital plan, headline risk. Domains stay
    // broad so cross-domain narratives (energy + space + supply)
    // surface in the chat, but the UX is dashboard-only.
    domains: ['hygiene', 'hvac', 'space', 'supply', 'energy', 'security', 'safety', 'amenity', 'uptime'],
    deviceTypes: [],
    merlinPersona:
      'You are speaking with an Executive — CFO, COO, or building owner. They scan summaries, not operational detail. Lead with money saved, money at risk, and the headline narrative for the quarter. Use cross-domain rollups: total opex, total realized savings, top three risks, top three wins. Avoid technical detail unless they ask. Never go below building-level granularity.',
    suggestions: [
      'Show YTD cost savings across the portfolio',
      'What’s our biggest unmitigated risk this quarter?',
      'Draft this week’s exec summary',
      'How is Merlin paying for itself?',
    ],
    kpis: [
      { label: 'YTD savings', get: () => ({ value: '$612k', sub: 'auto-realized', tone: 'ok' }) },
      { label: 'Risk register', get: () => ({ value: '3', sub: '1 high · 2 medium', tone: 'warn' }) },
      { label: 'Avg payback', get: () => ({ value: '4.2mo', sub: 'across implemented insights', tone: 'ok' }) },
    ],
  },
};

const INCIDENT_DOMAIN_BY_ICON = {
  air: ['hygiene', 'hvac'],
  people: ['hygiene'],
  sla: ['hygiene'],
  room: ['space'],
  warn: ['safety'],
  supply: ['hygiene', 'supply'],
  hvac: ['hvac'],
  building: ['uptime'],
  shield: ['security'],
  light: ['energy'],
  bolt: ['energy'],
};

const INCIDENT_DOMAIN_OVERRIDE = {
  'i-107': ['safety', 'hvac'],
  'i-115': ['security', 'safety'],
  'i-104': ['hygiene'],
  'i-101': ['hvac'],
  'i-113': ['hvac'],
  'i-110': ['security'],
  'i-100': ['energy'],
  'i-111': ['energy'],
  'i-105': ['uptime', 'hvac'],
  'i-116': ['hygiene'],
  'i-117': ['supply', 'hygiene'],
  'i-118': ['safety', 'hygiene'],
  'i-119': ['hygiene'],
  'i-120': ['hygiene', 'supply'],
  'i-121': ['supply', 'hygiene'],
  'i-122': ['hvac'],
  'i-123': ['uptime', 'safety'],
  'i-124': ['hvac'],
  'i-125': ['safety', 'uptime'],
  'i-126': ['hvac'],
  'i-127': ['uptime', 'hvac'],
  'i-128': ['hvac'],
  'i-129': ['security'],
  'i-130': ['security'],
  'i-131': ['security'],
  'i-132': ['security'],
  'i-133': ['security'],
  'i-134': ['security'],
  'i-135': ['security'],
};

function domainsForIncident(inc) {
  return INCIDENT_DOMAIN_OVERRIDE[inc.id] || INCIDENT_DOMAIN_BY_ICON[inc.icon] || [];
}

export function filterIncidentsForRole(incidents, roleId) {
  // Roles that see the full incident feed: superadmin (everywhere),
  // facility (their building), and the read-only/portfolio roles
  // (auditor + property_manager + executive + fm_network) that need
  // the cross-domain picture.
  if (
    roleId === 'facility' ||
    roleId === 'superadmin' ||
    roleId === 'property_manager' ||
    roleId === 'executive' ||
    roleId === 'auditor' ||
    roleId === 'fm_network'
  )
    return incidents;
  const role = ROLES[roleId];
  if (!role) return incidents;
  return incidents.filter((inc) => {
    const doms = domainsForIncident(inc);
    return doms.some((d) => role.domains.includes(d));
  });
}

export function filterSlasForRole(slas, roleId) {
  // Roles that see every SLA: facility + superadmin own the whole
  // surface; property_manager / executive / auditor / fm_network all
  // need the rollup picture so they don't get domain-filtered.
  if (
    roleId === 'facility' ||
    roleId === 'superadmin' ||
    roleId === 'property_manager' ||
    roleId === 'executive' ||
    roleId === 'auditor' ||
    roleId === 'fm_network'
  )
    return slas;
  // Per-role allowlist of SLA-name regexes. An empty array means
  // "this role has no SLA scope" — they see nothing, NOT everything
  // (that was the prior bug: empty list fell through to `return slas`,
  // so security users were seeing every workspace SLA).
  const allowlist = {
    cleaning: [/^Hygiene/, /^Supplies/, /^Space/],
    maintenance: [/^Comfort/, /^Air/, /^Energy/, /^EV charger/, /^Parking availability/],
    security: [/^Security/, /^Safety/, /^Accessible-spot/],
    tenant: [/^Hygiene/, /^Comfort/, /^Air/, /^Space/],
  };
  const keep = allowlist[roleId];
  // Unknown role (not in the map) → fail open to "see everything",
  // since blocking an unrecognised role would be a worse regression
  // than the security-too-permissive bug we're fixing here.
  if (keep === undefined) return slas;
  return slas.filter((s) => keep.some((rx) => rx.test(s.name)));
}

export function filterAgentsForRole(agents, roleId) {
  // Manager + executive-tier roles see every agent so the cross-
  // domain narrative reads cleanly. Auditors do too — they need to
  // inspect every agent's decision trail. fm_network sits between:
  // cross-domain because they dispatch across customers.
  if (
    roleId === 'facility' ||
    roleId === 'superadmin' ||
    roleId === 'property_manager' ||
    roleId === 'executive' ||
    roleId === 'auditor' ||
    roleId === 'fm_network'
  )
    return agents;
  const whitelist = {
    cleaning: ['cleaning', 'supply', 'compliance'],
    maintenance: ['hvac', 'energy', 'compliance', 'parking'],
    security: ['security', 'compliance', 'parking'],
    tenant: ['cleaning', 'space', 'hvac'],
  }[roleId];
  if (!whitelist) return agents;
  return agents.filter((a) => whitelist.includes(a.id));
}
