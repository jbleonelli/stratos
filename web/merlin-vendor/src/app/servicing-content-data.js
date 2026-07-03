// Servicing-board content data — the static per-domain item catalog + the shared
// requester/handler/channel pools it draws from. Extracted verbatim from
// servicing-content.js (Phase 3 god-file decomposition) so that module stays a
// small set of lookup/generator helpers instead of a 3k-line file.
//
// SERVICING_CONTENT is keyed by domain (hospitality / cleaning / security /
// maintenance); each item carries a location + description + ask phrasings. The
// generator helpers live in servicing-content.js and import this back.

export const REQUESTERS = [
  'A. Okafor',
  'K. Tanaka',
  'R. Singh',
  'M. Dubois',
  'S. Patel',
  'J. Romero',
  'L. Nakamura',
  'D. Müller',
  'P. Andersson',
  'C. Mensah',
  'E. Rossi',
  'N. Haddad',
  'T. Yamamoto',
  'B. Fernandez',
  'O. Schmidt',
  'V. Petrova',
  'H. Costa',
  'G. Laurent',
];
// DEFAULT handler + channel pools — concierge / front-of-house (member_label
// style). A domain can override either by setting `handlers` / `channels` on its
// SERVICING_CONTENT[domain] entry (e.g. cleaning crew, security officers,
// maintenance techs); buildRequests falls back to these when a domain omits them.
export const HANDLERS = ['Priya N.', 'Marcus T.', 'Sofia R.', 'Daniel K.', 'Front desk'];
export const CHANNELS = ['app', 'concierge desk', 'phone', 'email', 'Teams'];

// Cleaning crew + intake channels — anchored on the Meridian/Apex demo roster
// (Maria Chen is the mobile worker; Darnell Price / Ivan Kovac / Jamie Lin are
// real Meridian profiles; Apex Facilities is the contractor running cleaning).
const CLEANING_CREW = ['Maria C.', 'Darnell P.', 'Ivan K.', 'Jamie L.', 'Rosa M.', 'Apex crew'];
const CLEANING_CHANNELS = ['app', 'inspection', 'occupant report', 'BMS alert', 'radio'];

// Security officers + how a security item is reported + intake channels. Reporter
// is a SOURCE (control room / CCTV / patrol / alarm) more than a named person.
const SECURITY_OFFICERS = ['Reyes G.', 'Bauer T.', 'Ndiaye A.', 'Walsh K.', 'Control room', 'Apex security'];
const SECURITY_REPORTERS = ['Control room', 'CCTV analytics', 'Patrol', 'Access alarm', 'Occupant report', 'Reception'];
const SECURITY_CHANNELS = ['patrol', 'CCTV', 'alarm', 'radio', 'control room', 'app'];

// Maintenance techs (+ a generic vendor) and how a fault is reported — mostly the
// BMS, a PPM schedule, an inspection or an occupant, rather than a named person.
const MAINT_TECHS = ['Carlos M.', 'Priya R.', 'Sven O.', 'Lena F.', 'On-call tech', 'Vendor'];
const MAINT_REPORTERS = ['BMS alert', 'PPM schedule', 'Occupant report', 'Inspection', 'Vendor', 'Control room'];
const MAINT_CHANNELS = ['BMS', 'PPM', 'work order', 'app', 'phone', 'inspection'];

// (The deterministic-generation utilities seeded/pick/fmtAgo live with the
// generator helpers in servicing-content.js — they aren't used by the data.)

// ── content catalog ─────────────────────────────────────────────────────────
// floors: a building can have many floors; requests come from across them.
export const HQ_FLOORS = 50;

export const SERVICING_CONTENT = {
  hospitality_concierge: {
    requesterFloors: HQ_FLOORS,
    items: {
      'Ground transport & car service': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Town cars, ride-hail, and airport runs for staff, execs and visitors.',
        asks: [
          'Town car to SFO',
          'Ride to downtown',
          'Airport pickup — arrivals',
          'Car service for client dinner',
          'Shuttle to offsite',
        ],
      },
      'Restaurant & dining bookings': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Reservations and private-dining holds at partner restaurants.',
        asks: [
          'Dinner for 4 · Quince 8pm',
          'Lunch booking · client',
          'Private room · 12 guests',
          'Coffee meeting · 2',
          'Rooftop bar · team',
        ],
      },
      'Tours, tickets & experiences': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Event tickets, museum passes and experiences for visiting guests.',
        asks: [
          '2 tickets · SF Symphony',
          'Giants game · 4 seats',
          'Museum passes · delegation',
          'Wine tour · Sat',
          'Theater · client+1',
        ],
      },
      'Visitor & VIP assistance': {
        location: 'Lobby · Reception L1',
        desc: 'White-glove arrival, escort and hosting for VIPs and delegations.',
        asks: [
          'VIP arrival · Fl 48',
          'Delegation escort',
          'Board guest hosting',
          'Press visit setup',
          'Investor walkthrough',
        ],
        requesterKind: 'visitor',
      },
      'Lost & found': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Logging, storage and return of items left in the building.',
        asks: ['Left laptop charger', 'Lost badge', 'Found AirPods · Fl 22', 'Umbrella claim', 'Misplaced keys'],
      },
      'Building info & wayfinding': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Directions, room locations and general building questions.',
        asks: ['Where is Boardroom A?', 'Cafeteria hours', 'Nearest parking', 'Wellness room location', 'Visitor wifi'],
      },
      'Local recommendations': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Hotels, dining and neighborhood tips for out-of-town guests.',
        asks: ['Hotel near HQ', 'Dinner spot · vegan', 'Gym day-pass', 'Pharmacy nearby', 'Late-night food'],
      },
      'Courier & errand requests': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Same-day couriers, document runs and personal errands.',
        asks: [
          'Courier · contract pickup',
          'Dry-cleaning drop',
          'Notary run',
          'Gift delivery · client',
          'Document to legal',
        ],
      },
      'Wellness & amenity bookings': {
        location: 'Fl 3 · Amenities',
        desc: 'Wellness room, massage, and on-site amenity reservations.',
        asks: ['Wellness room · 30m', 'Chair massage slot', 'Mother’s room booking', 'Quiet pod · 1h', 'Bike storage'],
      },
      'Special requests': {
        location: 'Lobby · Concierge desk L1',
        desc: 'Ad-hoc asks that don’t fit a standard line — handled case by case.',
        asks: [
          'Birthday setup · Fl 30',
          'Flowers for client',
          'Last-minute catering',
          'AV help · town hall',
          'Translation service',
        ],
      },
    },
  },

  // ── Hospitality · guest-services lounges & amenity points ──────────────────
  hospitality: {
    items: {
      'Executive lounge': {
        location: 'Fl 50 · Club',
        desc: 'Premium lounge for executives, board guests and VIP hosting.',
        asks: [
          'Coffee & water refresh',
          'Guest arriving — set up',
          'Too warm — adjust',
          'Tidy & reset seating',
          'AV / screen not working',
        ],
      },
      'Sky lobby & lounge': {
        location: 'Fl 25 · Sky lobby',
        desc: 'Mid-tower transfer lounge with seating and guest waiting area.',
        asks: [
          'Tidy & reset seating',
          'Coffee station low',
          'Too cold — adjust',
          'Spill — quick clean',
          'Wayfinding help',
        ],
      },
      'Members’ club floor': {
        location: 'Fl 49',
        desc: 'Members-only club floor with concierge-served amenities.',
        asks: ['Refresh refreshments', 'Member hosting', 'Reset after event', 'Supplies low', 'Lighting too dim'],
      },
      'Wellness suite': {
        location: 'Fl 3 · Amenities',
        desc: 'Wellness rooms, relaxation and quiet recovery space.',
        asks: ['Towels / supplies low', 'Room reset', 'Too warm — adjust', 'Book quiet pod · 1h', 'Music too loud'],
      },
      'Roof terrace & garden': {
        location: 'Fl 51 · Roof',
        desc: 'Open-air terrace for guests, breaks and small receptions.',
        asks: [
          'Set up for reception',
          'Clear & reset furniture',
          'Heaters on',
          'Tidy after event',
          'Umbrellas / shade',
        ],
      },
      'Visitor lounge': {
        location: 'Lobby · L1',
        desc: 'Arrival lounge and waiting area for visitors and guests.',
        asks: [
          'Guest waiting — host paged',
          'Coffee & water refresh',
          'Tidy & reset seating',
          'Wifi for visitor',
          'Too cold — adjust',
        ],
      },
      'Quiet & focus lounge': {
        location: 'Fl 12',
        desc: 'Low-noise lounge for focused work and calls.',
        asks: ['Noise complaint', 'Book focus pod', 'Lighting too bright', 'Tidy & reset', 'Supplies low'],
      },
      'Parents’ & wellness room': {
        location: 'Fl 8',
        desc: 'Mothers’ room, first aid and personal wellness space.',
        asks: ['Restock supplies', 'Book the room', 'Clean & reset', 'Fridge too warm', 'First-aid restock'],
      },
      'Game & social lounge': {
        location: 'Fl 18',
        desc: 'Social lounge, games and informal team gathering space.',
        asks: ['Reset after event', 'Tidy & clean', 'AV / console issue', 'Refreshments low', 'Too warm — adjust'],
      },
      'Meditation & prayer room': {
        location: 'Fl 6',
        desc: 'Multi-faith quiet room for reflection and prayer.',
        asks: ['Clean & reset', 'Book the room', 'Too cold — adjust', 'Supplies low', 'Lighting too bright'],
      },
      'Library & reading room': {
        location: 'Fl 30',
        desc: 'Silent reading room and reference library.',
        asks: ['Noise complaint', 'Tidy & reshelve', 'Lighting too dim', 'Book a study pod', 'Too warm — adjust'],
      },
      'Terrace café lounge': {
        location: 'Fl 40 · Sky',
        desc: 'Casual lounge and café seating on the sky floor.',
        asks: [
          'Coffee machine down',
          'Tidy & reset seating',
          'Restock cups',
          'Too cold — adjust',
          'Spill — quick clean',
        ],
      },
    },
  },

  // ── Hospitality · reception & front desk ───────────────────────────────────
  hospitality_reception: {
    requesterKind: 'visitor',
    items: {
      'Main lobby reception': {
        location: 'Lobby · L1',
        desc: 'Greeting, badging and visitor check-in at the main entrance.',
        asks: [
          'Host not responding',
          'Badge won’t print',
          'Group check-in · 8',
          'Visitor arrived early',
          'Directions — Boardroom A',
        ],
      },
      'Executive floor reception': {
        location: 'Fl 50 · Executive',
        desc: 'Front desk for the executive and boardroom floor.',
        asks: [
          'Board guest arriving',
          'Escort to Boardroom A',
          'Host not responding',
          'VIP check-in',
          'Hold visitor — 10m',
        ],
      },
      'Sky lobby desk': {
        location: 'Fl 25 · Sky lobby',
        desc: 'Mid-tower transfer-lobby reception and wayfinding.',
        asks: ['Wayfinding — Fl 30', 'Visitor lost', 'Badge tap failing', 'Group transfer', 'Host paging'],
      },
      'Visitor check-in & badging': {
        location: 'Lobby · L1',
        desc: 'Pre-registration, badge printing and host notification.',
        asks: ['Badge won’t print', 'Pre-reg missing', 'Photo capture down', 'Temp badge needed', 'Group of 12 · 9am'],
      },
      'Vendor & delivery sign-in': {
        location: 'Lobby · L1',
        desc: 'Contractor, vendor and courier check-in and escort.',
        asks: [
          'Vendor sign-in',
          'Contractor escort',
          'Courier at desk',
          'Delivery — who to call',
          'Loading dock access',
        ],
      },
      'After-hours front desk': {
        location: 'Lobby · L1',
        desc: 'Evening and weekend reception cover.',
        asks: ['Late visitor', 'Door access help', 'Host not in', 'Security escort', 'Lost & found'],
      },
    },
  },

  // ── Hospitality · food & beverage ──────────────────────────────────────────
  hospitality_fnb: {
    items: {
      'Main cafeteria': {
        location: 'Fl 2 · Servery',
        desc: 'All-day staff cafeteria, hot line and grab-and-go.',
        asks: ['Hot line restock', 'Catering for 12 · 1pm', 'Out of cups', 'Allergen check needed', 'Spill at servery'],
      },
      'Executive dining': {
        location: 'Fl 50 · Club',
        desc: 'Private executive and board dining service.',
        asks: ['Board lunch · 8', 'Allergen check needed', 'Wine service', 'Reset after lunch', 'VIP dietary request'],
      },
      'Lobby barista bar': {
        location: 'Lobby · L1',
        desc: 'Espresso bar and coffee service in the main lobby.',
        asks: ['Coffee machine down', 'Restock oat milk', 'Out of cups', 'Queue building', 'Grinder jammed'],
      },
      'Micro-kitchen · low-rise': {
        location: 'Fl 8 · Pantry',
        desc: 'Coffee, snacks and pantry restock for low-rise floors.',
        asks: ['Restock oat milk', 'Coffee machine down', 'Snacks empty', 'Dishwasher full', 'Fridge too warm'],
      },
      'Micro-kitchen · mid-rise': {
        location: 'Fl 22 · Pantry',
        desc: 'Coffee, snacks and pantry restock for mid-rise floors.',
        asks: ['Restock oat milk', 'Coffee machine down', 'Snacks empty', 'Dishwasher full', 'Out of cups'],
      },
      'Micro-kitchen · high-rise': {
        location: 'Fl 44 · Pantry',
        desc: 'Coffee, snacks and pantry restock for high-rise floors.',
        asks: ['Restock oat milk', 'Coffee machine down', 'Snacks empty', 'Fridge too warm', 'Out of cups'],
      },
      'Meeting & catering service': {
        location: 'Fl 25 · Catering',
        desc: 'Catering drops and refreshments for meetings.',
        asks: [
          'Catering for 12 · 1pm',
          'Coffee for room 25A',
          'Clear after meeting',
          'Add lunch · 4',
          'Water & glasses',
        ],
      },
      'Boardroom service': {
        location: 'Fl 50 · Boardroom',
        desc: 'White-glove food and beverage for the boardroom.',
        asks: ['Board lunch setup', 'Coffee refresh', 'Allergen check needed', 'Clear & reset', 'Evening reception'],
      },
      'Event bar & receptions': {
        location: 'Fl 3 · Event hall',
        desc: 'Bar and reception catering for events.',
        asks: ['Bar setup · 6pm', 'Restock glasses', 'Add canapés · 40', 'Clear after event', 'Ice run'],
      },
      'Vending & snack walls': {
        location: 'Tower-wide',
        desc: 'Vending machines and self-serve snack walls.',
        asks: ['Machine out — Fl 16', 'Restock snack wall', 'Card reader down', 'Refund — Fl 9', 'Fridge too warm'],
      },
      'Coffee & tea restock': {
        location: 'Tower-wide',
        desc: 'Bean, milk and supplies restock across pantries.',
        asks: ['Beans low — Fl 22', 'Oat milk out', 'Tea selection empty', 'Sugar & stirrers', 'Filters needed'],
      },
      'Special dietary & VIP': {
        location: 'Fl 50 · Club',
        desc: 'Allergen-safe and VIP dietary requests.',
        asks: ['Gluten-free · 2', 'Vegan board lunch', 'Allergen check needed', 'Halal option', 'VIP preference'],
      },
    },
  },

  // ── Hospitality · meeting & events ─────────────────────────────────────────
  hospitality_events: {
    items: {
      'Boardroom A': {
        location: 'Fl 50 · Executive',
        desc: 'Primary board and executive meeting room with full AV.',
        asks: ['AV setup · 9am', 'Reset · 20 seats', 'Mics not working', 'Catering link-up', 'Hybrid call setup'],
      },
      'Boardroom B': {
        location: 'Fl 50 · Executive',
        desc: 'Secondary executive meeting room and breakout.',
        asks: ['Reset · 12 seats', 'AV setup', 'Extend booking 1h', 'Coffee refresh', 'Screen not working'],
      },
      'Town hall auditorium': {
        location: 'Fl 3 · Event hall',
        desc: '300-seat auditorium for all-hands and town halls.',
        asks: ['Stage & lectern', 'Mics not working', 'Reset · 300 seats', 'Webcast link', 'House lights'],
      },
      'Skyline event hall': {
        location: 'Fl 51 · Roof',
        desc: 'Top-floor event space for receptions and launches.',
        asks: ['Set up for reception', 'AV & sound', 'Catering link-up', 'Clear & reset', 'Heaters on'],
      },
      'Conference 25A': {
        location: 'Fl 25',
        desc: 'Large conference room on the sky-lobby floor.',
        asks: ['AV setup · 9am', 'Reset · 30 seats', 'Extend booking 1h', 'Catering for 12', 'Mics not working'],
      },
      'Conference 25B': {
        location: 'Fl 25',
        desc: 'Large conference room on the sky-lobby floor.',
        asks: ['AV setup', 'Reset · 24 seats', 'Hybrid call setup', 'Coffee refresh', 'Screen not working'],
      },
      'Training room': {
        location: 'Fl 12',
        desc: 'Tiered training room with breakout tables.',
        asks: ['Set up · breakout', 'AV & projector', 'Reset tables', 'Materials & pads', 'Extend booking'],
      },
      'Innovation lab': {
        location: 'Fl 18',
        desc: 'Flexible lab for workshops and design sprints.',
        asks: ['Workshop setup', 'Whiteboards & supplies', 'Reset · open layout', 'AV for demo', 'Power for tables'],
      },
      'Client briefing center': {
        location: 'Fl 49',
        desc: 'Hosted space for client and partner briefings.',
        asks: ['Client briefing · 2pm', 'AV & display', 'Catering link-up', 'Reset after briefing', 'Hosting support'],
      },
      'Multipurpose hall': {
        location: 'Fl 3',
        desc: 'Divisible hall for fairs, expos and large meetings.',
        asks: ['Split the hall', 'AV & sound', 'Reset · expo layout', 'Power & cabling', 'Clear after event'],
      },
      'Webcast studio': {
        location: 'Fl 20',
        desc: 'Studio for webcasts, recordings and hybrid events.',
        asks: ['Stream setup', 'Mics not working', 'Lighting check', 'Record & upload', 'Hybrid call setup'],
      },
      'Breakout suite': {
        location: 'Fl 30',
        desc: 'Cluster of small breakout rooms.',
        asks: ['Reset · 4 rooms', 'AV in room 3', 'Coffee refresh', 'Extend booking', 'Move dividers'],
      },
      'Investor room': {
        location: 'Fl 49',
        desc: 'Secure room for investor and due-diligence sessions.',
        asks: ['Secure setup', 'AV & display', 'Catering — discreet', 'Reset after session', 'Hosting support'],
      },
      'Roof terrace events': {
        location: 'Fl 51 · Roof',
        desc: 'Open-air terrace for receptions and offsites.',
        asks: ['Reception setup', 'Heaters & lighting', 'Bar link-up', 'Clear & reset', 'Weather backup plan'],
      },
    },
  },

  // ── Hospitality · occupant & guest requests ────────────────────────────────
  hospitality_requests: {
    items: {
      'Temperature & comfort': {
        location: 'Tower-wide',
        desc: 'Heating, cooling and comfort complaints by floor.',
        asks: ['Too cold · Fl 34', 'Too warm · Fl 12', 'Draught at desk', 'No airflow — meeting room', 'Humidity high'],
      },
      'Desk & workspace setup': {
        location: 'Tower-wide',
        desc: 'New-desk, move and workstation setup requests.',
        asks: ['New desk setup', 'Move to Fl 22', 'Monitor & dock', 'Standing desk', 'Clear old desk'],
      },
      'AV & meeting support': {
        location: 'Tower-wide',
        desc: 'On-demand AV and meeting-room tech help.',
        asks: ['AV help · room 25A', 'Screen not working', 'Cable / adapter', 'Mic feedback', 'Hybrid call setup'],
      },
      'Lighting & blinds': {
        location: 'Tower-wide',
        desc: 'Lighting levels, faulty lamps and blind control.',
        asks: ['Lamp flickering', 'Too bright · Fl 18', 'Blind stuck', 'Light out — corridor', 'Dim for presentation'],
      },
      'Furniture & moves': {
        location: 'Tower-wide',
        desc: 'Furniture moves, chairs and small relocations.',
        asks: ['Move 2 chairs', 'Extra table — room', 'Relocate cabinet', 'Swap broken chair', 'Clear meeting room'],
      },
      'Keys, lockers & access': {
        location: 'Tower-wide',
        desc: 'Locker assignment, keys and door-access help.',
        asks: ['Locker assignment', 'Lost key', 'Door won’t open', 'Access to Fl 44', 'Cabinet key'],
      },
      'Signage & nameplates': {
        location: 'Tower-wide',
        desc: 'Desk, office and wayfinding nameplate changes.',
        asks: ['New nameplate', 'Update office sign', 'Wayfinding sign', 'Remove old plate', 'Room sign wrong'],
      },
      'Plants & greenery': {
        location: 'Tower-wide',
        desc: 'Plant care, replacement and watering.',
        asks: ['Plant looks dead', 'Add greenery — Fl 30', 'Water schedule', 'Remove plant', 'Pest on plant'],
      },
      'Spills & quick clean': {
        location: 'Tower-wide',
        desc: 'Ad-hoc spill and quick-clean call-outs.',
        asks: ['Coffee spill · Fl 16', 'Glass broken', 'Quick clean — room', 'Stain on carpet', 'Wet floor'],
      },
      'Supplies & restock': {
        location: 'Tower-wide',
        desc: 'Stationery and shared-supply restock.',
        asks: ['Printer paper out', 'Stationery restock', 'Whiteboard markers', 'Toner — Fl 22', 'Notebooks & pads'],
      },
      'Wayfinding & directions': {
        location: 'Lobby · L1',
        desc: 'Help finding rooms, floors and services.',
        asks: ['Where is Boardroom A?', 'Nearest restroom', 'Cafeteria hours', 'Parking directions', 'Wellness room'],
      },
      'Noise & disturbance': {
        location: 'Tower-wide',
        desc: 'Noise complaints and disturbance reports.',
        asks: ['Loud call · Fl 12', 'Construction noise', 'Music too loud', 'Echo in room', 'Disturbance report'],
      },
      'Pest & hygiene': {
        location: 'Tower-wide',
        desc: 'Pest sightings and hygiene concerns.',
        asks: ['Pest sighting · Fl 2', 'Bad odour', 'Bin overflowing', 'Hygiene concern', 'Drain smell'],
      },
      'Ergonomic equipment': {
        location: 'Tower-wide',
        desc: 'Ergonomic chairs, stands and assessments.',
        asks: ['Ergo chair', 'Footrest & stand', 'Assessment request', 'Wrist support', 'Adjust monitor arm'],
      },
      'Guest hosting support': {
        location: 'Lobby · L1',
        desc: 'Help hosting visitors and delegations.',
        asks: [
          'Host a delegation',
          'Visitor wifi',
          'Meeting room for guest',
          'Refreshments for guests',
          'Escort needed',
        ],
      },
      'General help & other': {
        location: 'Tower-wide',
        desc: 'Anything that doesn’t fit a standard request line.',
        asks: ['Not sure who to ask', 'One-off request', 'Help with a thing', 'Escalate please', 'Follow-up needed'],
      },
    },
  },

  // ── Hospitality · mail & packages ──────────────────────────────────────────
  hospitality_mail: {
    items: {
      'Inbound parcels · low-rise': {
        location: 'Mailroom · L1',
        desc: 'Incoming parcels for low-rise floors.',
        asks: ['Parcel for Fl 8', 'Notify recipient', 'Hold at desk', 'Fragile — handle', 'Wrong floor label'],
      },
      'Inbound parcels · high-rise': {
        location: 'Mailroom · L1',
        desc: 'Incoming parcels for high-rise floors.',
        asks: ['Parcel for Fl 47', 'Notify recipient', 'Hold at desk', 'Bulky — trolley', 'Wrong floor label'],
      },
      'Outbound courier & shipping': {
        location: 'Mailroom · L1',
        desc: 'Outgoing courier, post and shipping.',
        asks: ['Courier pickup · 3pm', 'Ship to client', 'Label & weigh', 'Same-day courier', 'Track shipment'],
      },
      'Signature-required items': {
        location: 'Mailroom · L1',
        desc: 'Items needing recipient signature on handover.',
        asks: [
          'Signature needed',
          'Recipient unreachable',
          'Hold — ID required',
          'Re-attempt delivery',
          'Authorise proxy',
        ],
      },
      'Internal mail run': {
        location: 'Mailroom · L1',
        desc: 'Inter-floor and inter-office mail distribution.',
        asks: ['Run to Fl 30', 'Inter-office envelope', 'Add to next round', 'Urgent — now', 'Wrong recipient'],
      },
      'Perishable & cold storage': {
        location: 'Mailroom · L1',
        desc: 'Refrigerated deliveries and perishables.',
        asks: ['Cold item — store', 'Notify recipient', 'Fridge full', 'Flowers — water', 'Collect ASAP'],
      },
      'Oversized & freight': {
        location: 'Loading dock · B1',
        desc: 'Pallets, freight and oversized deliveries.',
        asks: ['Freight at dock', 'Pallet jack needed', 'Schedule unload', 'Goods lift booking', 'Damaged on arrival'],
      },
      'Registered & legal': {
        location: 'Mailroom · L1',
        desc: 'Registered post, legal and tracked documents.',
        asks: [
          'Registered letter',
          'Legal — to floor 49',
          'Tracked document',
          'Signature & log',
          'Confidential — seal',
        ],
      },
      'Returns & RMA': {
        location: 'Mailroom · L1',
        desc: 'Outbound returns and RMA processing.',
        asks: ['Return — print label', 'RMA pickup', 'Pack for return', 'Schedule courier', 'Track return'],
      },
      'Executive & confidential': {
        location: 'Mailroom · L1',
        desc: 'Confidential and executive deliveries.',
        asks: ['Confidential to exec', 'Hand-deliver Fl 50', 'Sealed — discreet', 'Notify EA', 'Hold for pickup'],
      },
    },
  },

  // ── Cleaning · common areas (lobbies, corridors, lift lobbies, reception) ──
  cleaning_common: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Main lobby & atrium': {
        location: 'L1 · Lobby',
        desc: 'The ground-floor lobby and atrium — the building’s busiest first impression.',
        asks: [
          'Spill near entrance',
          'Smudged glass doors',
          'Litter in atrium',
          'Wet floor — rain',
          'Polish reception stone',
        ],
      },
      'Reception & welcome desk': {
        location: 'L1 · Reception',
        desc: 'Front reception, welcome desk and the visitor seating around it.',
        asks: ['Coffee stain · sofa', 'Desk dusty', 'Smudged glass', 'Tidy magazines', 'Bin full at desk'],
      },
      'Sky lobby': {
        location: 'Fl 25 · Sky lobby',
        desc: 'Mid-tower transfer lobby — high footfall between lift banks.',
        asks: ['Litter by lifts', 'Floor scuffed', 'Glass smudges', 'Spill — coffee', 'Seating crumbs'],
      },
      'Executive reception': {
        location: 'Fl 50 · Executive',
        desc: 'The executive-floor reception and lift landing.',
        asks: ['Polish floor', 'Dust surfaces', 'Smudged glass', 'Tidy for board', 'Vacuum runner'],
      },
      'Elevator lobbies · low-rise': {
        location: 'Fl 2–17',
        desc: 'Lift landings across the low-rise stack.',
        asks: ['Scuffed lift doors', 'Litter · Fl 9', 'Smudged call buttons', 'Spill · Fl 14', 'Floor mark'],
      },
      'Elevator lobbies · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Lift landings across the mid-rise stack.',
        asks: ['Smudged doors · Fl 22', 'Litter · Fl 28', 'Wet floor', 'Polish needed', 'Button wipe-down'],
      },
      'Elevator lobbies · high-rise': {
        location: 'Fl 35–50',
        desc: 'Lift landings across the high-rise stack.',
        asks: ['Scuff · Fl 41', 'Litter · Fl 47', 'Smudged glass', 'Spill · Fl 38', 'Dust ledges'],
      },
      'Main corridors · low-rise': {
        location: 'Fl 2–17',
        desc: 'Primary circulation corridors on the low-rise floors.',
        asks: ['Carpet mark · Fl 8', 'Litter in corridor', 'Scuffed wall', 'Spot vacuum', 'Spill · Fl 12'],
      },
      'Main corridors · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Primary circulation corridors on the mid-rise floors.',
        asks: ['Stain · Fl 24', 'Litter · Fl 30', 'Scuff marks', 'Spot vacuum', 'Wet floor'],
      },
      'Main corridors · high-rise': {
        location: 'Fl 35–50',
        desc: 'Primary circulation corridors on the high-rise floors.',
        asks: ['Carpet mark · Fl 44', 'Litter · Fl 39', 'Scuffed wall', 'Spot vacuum', 'Spill · Fl 46'],
      },
      'Break-out lounges': {
        location: 'Tower-wide',
        desc: 'Informal lounges and soft-seating breakout areas.',
        asks: ['Crumbs on sofa', 'Table sticky', 'Tidy cushions', 'Spill — coffee', 'Bin overflowing'],
      },
      'Visitor & waiting areas': {
        location: 'L1 · Lobby',
        desc: 'Visitor lounge and waiting seating off the main lobby.',
        asks: ['Tidy seating', 'Coffee rings', 'Smudged glass', 'Vacuum rug', 'Bin full'],
      },
      'Atrium stairs & bridges': {
        location: 'L1–L3',
        desc: 'Feature staircase and connecting bridges through the atrium.',
        asks: ['Handrail wipe-down', 'Treads dusty', 'Smudged balustrade', 'Spill on steps', 'Glass panel marks'],
      },
      'Concierge & mail area': {
        location: 'L1 · Lobby',
        desc: 'Concierge desk and the mail/parcel pickup area.',
        asks: ['Tidy parcels area', 'Desk dusty', 'Litter at counter', 'Floor scuff', 'Bin full'],
      },
      'Parking lobby & lifts': {
        location: 'B1 · Parking',
        desc: 'Parking-level lobbies and the lift transfer to the tower.',
        asks: ['Oil spot on floor', 'Litter · B1', 'Smudged lift glass', 'Dusty stairs', 'Wet floor'],
      },
      'Wellness & amenity foyer': {
        location: 'Fl 3 · Amenities',
        desc: 'The foyer serving the wellness rooms and amenity spaces.',
        asks: ['Tidy foyer', 'Towels on floor', 'Smudged glass', 'Vacuum mat', 'Spill — water'],
      },
    },
  },

  // ── Cleaning · floors & carpets (mopping, vacuuming, polishing, carpet care) ─
  cleaning_floors: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Lobby stone & marble': {
        location: 'L1 · Lobby',
        desc: 'Polished stone and marble across the ground-floor lobby.',
        asks: ['Scuff on marble', 'Polish dull patch', 'Footprints · entrance', 'Gum on stone', 'Streaks after mop'],
      },
      'Atrium hard floors': {
        location: 'L1–L3',
        desc: 'Hard flooring through the atrium and connecting levels.',
        asks: ['Spill — coffee', 'Scuff marks', 'Mop streaks', 'Gum on floor', 'Wet floor sign'],
      },
      'Reception carpets': {
        location: 'L1 · Reception',
        desc: 'Carpeting around reception and the welcome lounge.',
        asks: ['Carpet stain', 'Vacuum missed area', 'Coffee spill', 'Flatten matting', 'Spot-clean entrance'],
      },
      'Sky lobby floors': {
        location: 'Fl 25 · Sky lobby',
        desc: 'High-traffic flooring across the sky lobby.',
        asks: ['Scuff marks', 'Spill near lifts', 'Polish dull area', 'Vacuum runner', 'Gum on floor'],
      },
      'Executive carpets': {
        location: 'Fl 49–50',
        desc: 'Premium carpeting through the executive floors.',
        asks: ['Stain in office', 'Vacuum before board', 'Coffee spill', 'Flatten ripple', 'Spot-clean'],
      },
      'Low-rise carpets · 2–9': {
        location: 'Fl 2–9',
        desc: 'Office carpeting across the lower low-rise floors.',
        asks: ['Stain · Fl 6', 'Vacuum missed', 'Coffee spill · Fl 8', 'Scuffed edge', 'Spot-clean'],
      },
      'Low-rise carpets · 10–17': {
        location: 'Fl 10–17',
        desc: 'Office carpeting across the upper low-rise floors.',
        asks: ['Stain · Fl 12', 'Vacuum missed', 'Spill · Fl 15', 'Flatten ripple', 'Spot-clean'],
      },
      'Mid-rise carpets · 18–25': {
        location: 'Fl 18–25',
        desc: 'Office carpeting across the lower mid-rise floors.',
        asks: ['Stain · Fl 20', 'Vacuum missed', 'Spill · Fl 23', 'Scuffed edge', 'Spot-clean'],
      },
      'Mid-rise carpets · 26–34': {
        location: 'Fl 26–34',
        desc: 'Office carpeting across the upper mid-rise floors.',
        asks: ['Stain · Fl 28', 'Vacuum missed', 'Spill · Fl 31', 'Flatten ripple', 'Spot-clean'],
      },
      'High-rise carpets · 35–42': {
        location: 'Fl 35–42',
        desc: 'Office carpeting across the lower high-rise floors.',
        asks: ['Stain · Fl 38', 'Vacuum missed', 'Spill · Fl 40', 'Scuffed edge', 'Spot-clean'],
      },
      'High-rise carpets · 43–50': {
        location: 'Fl 43–50',
        desc: 'Office carpeting across the upper high-rise floors.',
        asks: ['Stain · Fl 45', 'Vacuum missed', 'Spill · Fl 48', 'Flatten ripple', 'Spot-clean'],
      },
      'Cafeteria floors': {
        location: 'Fl 2 · Cafeteria',
        desc: 'Hard floors through the cafeteria and servery.',
        asks: ['Food spill', 'Greasy patch', 'Mop after lunch', 'Wet floor sign', 'Sticky floor'],
      },
      'Meeting-room carpets': {
        location: 'Tower-wide',
        desc: 'Carpeting inside meeting and conference rooms.',
        asks: ['Stain · room 25A', 'Vacuum before meeting', 'Coffee spill', 'Crumbs under table', 'Spot-clean'],
      },
      'Corridor vinyl & LVT': {
        location: 'Tower-wide',
        desc: 'Vinyl and LVT hard flooring along corridors.',
        asks: ['Scuff marks', 'Mop streaks', 'Gum on floor', 'Spill — water', 'Buff dull area'],
      },
      'Lift-lobby polishing': {
        location: 'Tower-wide',
        desc: 'Polishing the hard floors at lift landings.',
        asks: ['Dull patch', 'Scuff at doors', 'Footprints', 'Buff needed', 'Streaks'],
      },
      'Parking deck floors': {
        location: 'B1–B2',
        desc: 'Sweeping and scrubbing the parking decks.',
        asks: ['Oil spill', 'Sweep debris', 'Tyre marks', 'Scrub bay 12', 'Wet patch'],
      },
      'Entrance mats & runners': {
        location: 'L1 · Entrances',
        desc: 'Entrance matting and runners that catch the worst footfall.',
        asks: ['Mat soaked — rain', 'Vacuum runner', 'Reposition mat', 'Mud tracked in', 'Swap wet mat'],
      },
      'Roof terrace decking': {
        location: 'Fl 51 · Roof',
        desc: 'Decking and hard surfaces on the roof terrace.',
        asks: ['Sweep leaves', 'Spill after event', 'Slippery decking', 'Bird mess', 'Hose down'],
      },
    },
  },

  // ── Cleaning · workspaces & desks (desks, meeting resets, clear-desk) ───────
  cleaning_workspaces: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Executive offices · Fl 50': {
        location: 'Fl 50 · Executive',
        desc: 'Private executive offices and their meeting tables.',
        asks: ['Desk not cleared', 'Dust surfaces', 'Empty bin', 'Wipe table', 'Tidy for board'],
      },
      'Executive offices · Fl 49': {
        location: 'Fl 49',
        desc: 'Executive and senior offices on the club floor.',
        asks: ['Desk dusty', 'Empty bin', 'Wipe glass', 'Crumbs on desk', 'Tidy office'],
      },
      'Open desks · Fl 8': {
        location: 'Fl 8',
        desc: 'Open-plan desk neighborhood on Fl 8.',
        asks: ['Desk not cleared', 'Crumbs on desks', 'Monitor dusty', 'Empty bins', 'Wipe shared desk'],
      },
      'Open desks · Fl 12': {
        location: 'Fl 12',
        desc: 'Open-plan desk neighborhood on Fl 12.',
        asks: ['Desk not cleared', 'Coffee rings', 'Empty bins', 'Keyboard crumbs', 'Wipe surfaces'],
      },
      'Open desks · Fl 16': {
        location: 'Fl 16',
        desc: 'Open-plan desk neighborhood on Fl 16.',
        asks: ['Desk not cleared', 'Crumbs on desks', 'Empty bins', 'Monitor dusty', 'Wipe shared desk'],
      },
      'Open desks · Fl 20': {
        location: 'Fl 20',
        desc: 'Open-plan desk neighborhood on Fl 20.',
        asks: ['Desk not cleared', 'Coffee rings', 'Empty bins', 'Wipe surfaces', 'Crumbs on desks'],
      },
      'Open desks · Fl 24': {
        location: 'Fl 24',
        desc: 'Open-plan desk neighborhood on Fl 24.',
        asks: ['Desk not cleared', 'Empty bins', 'Monitor dusty', 'Wipe shared desk', 'Crumbs'],
      },
      'Open desks · Fl 28': {
        location: 'Fl 28',
        desc: 'Open-plan desk neighborhood on Fl 28.',
        asks: ['Desk not cleared', 'Coffee rings', 'Empty bins', 'Wipe surfaces', 'Keyboard crumbs'],
      },
      'Open desks · Fl 32': {
        location: 'Fl 32',
        desc: 'Open-plan desk neighborhood on Fl 32.',
        asks: ['Desk not cleared', 'Empty bins', 'Monitor dusty', 'Wipe shared desk', 'Crumbs on desks'],
      },
      'Open desks · Fl 36': {
        location: 'Fl 36',
        desc: 'Open-plan desk neighborhood on Fl 36.',
        asks: ['Desk not cleared', 'Coffee rings', 'Empty bins', 'Wipe surfaces', 'Crumbs'],
      },
      'Open desks · Fl 40': {
        location: 'Fl 40',
        desc: 'Open-plan desk neighborhood on Fl 40.',
        asks: ['Desk not cleared', 'Empty bins', 'Monitor dusty', 'Wipe shared desk', 'Keyboard crumbs'],
      },
      'Open desks · Fl 44': {
        location: 'Fl 44',
        desc: 'Open-plan desk neighborhood on Fl 44.',
        asks: ['Desk not cleared', 'Coffee rings', 'Empty bins', 'Wipe surfaces', 'Crumbs on desks'],
      },
      'Meeting-room resets · low-rise': {
        location: 'Fl 2–17',
        desc: 'Turning over meeting rooms between bookings across low-rise.',
        asks: ['Reset room · Fl 12', 'Wipe whiteboard', 'Chairs askew', 'Crumbs on table', 'Empty bin'],
      },
      'Meeting-room resets · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Turning over meeting rooms between bookings across mid-rise.',
        asks: ['Reset room · Fl 25A', 'Wipe whiteboard', 'Chairs askew', 'Cups left', 'Empty bin'],
      },
      'Meeting-room resets · high-rise': {
        location: 'Fl 35–50',
        desc: 'Turning over meeting rooms between bookings across high-rise.',
        asks: ['Reset room · Fl 44', 'Wipe whiteboard', 'Chairs askew', 'Crumbs on table', 'Empty bin'],
      },
      'Phone booths & focus pods': {
        location: 'Tower-wide',
        desc: 'Single-person booths and quiet focus pods.',
        asks: ['Wipe pod surfaces', 'Smudged glass', 'Litter inside', 'Headset wipe', 'Sticky desk'],
      },
      'Collaboration zones': {
        location: 'Tower-wide',
        desc: 'Open collaboration areas and standing tables.',
        asks: ['Wipe standing table', 'Crumbs', 'Marker on table', 'Empty bin', 'Tidy stools'],
      },
      'Hot-desk neighborhoods': {
        location: 'Tower-wide',
        desc: 'Shared hot-desk clusters that turn over through the day.',
        asks: ['Desk not cleared', 'Wipe shared desk', 'Keyboard crumbs', 'Monitor dusty', 'Empty bin'],
      },
      'Lab & studio benches': {
        location: 'Fl 18 · Innovation lab',
        desc: 'Workshop benches in the innovation lab and studio.',
        asks: ['Bench cluttered', 'Wipe surfaces', 'Sweep offcuts', 'Empty bin', 'Sticky residue'],
      },
      'Clear-desk overnight sweep': {
        location: 'Tower-wide',
        desc: 'The overnight clear-desk and reset pass before the next day.',
        asks: ['Desk left messy', 'Items not stored', 'Empty all bins', 'Wipe shared surfaces', 'Lights & blinds'],
      },
    },
  },

  // ── Cleaning · kitchens & pantries (breakrooms, coffee points, fridges) ─────
  cleaning_kitchens: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Main cafeteria kitchen': {
        location: 'Fl 2 · Cafeteria',
        desc: 'Back-of-house kitchen and prep for the main cafeteria.',
        asks: ['Deep-clean line', 'Grease on hood', 'Floor greasy', 'Sanitize prep', 'Bin overflowing'],
      },
      'Executive kitchen': {
        location: 'Fl 50 · Club',
        desc: 'The executive and board dining kitchen.',
        asks: ['Sanitize counters', 'Fridge clean-out', 'Dishwasher unloaded?', 'Floor mop', 'Polish steel'],
      },
      'Pantry · low-rise (Fl 8)': {
        location: 'Fl 8 · Pantry',
        desc: 'Shared pantry serving the low-rise floors.',
        asks: ['Counters sticky', 'Fridge smells', 'Sink backed up', 'Microwave dirty', 'Empty bin'],
      },
      'Pantry · mid-rise (Fl 22)': {
        location: 'Fl 22 · Pantry',
        desc: 'Shared pantry serving the mid-rise floors.',
        asks: ['Counters sticky', 'Fridge clean-out', 'Coffee spills', 'Dishwasher full', 'Empty bin'],
      },
      'Pantry · high-rise (Fl 44)': {
        location: 'Fl 44 · Pantry',
        desc: 'Shared pantry serving the high-rise floors.',
        asks: ['Counters sticky', 'Fridge smells', 'Sink backed up', 'Microwave dirty', 'Empty bin'],
      },
      'Barista bar back-of-house': {
        location: 'L1 · Lobby',
        desc: 'The prep and wash area behind the lobby barista bar.',
        asks: ['Wash group heads', 'Milk fridge clean', 'Floor sticky', 'Bin full', 'Sanitize counter'],
      },
      'Event kitchen & prep': {
        location: 'Fl 3 · Event hall',
        desc: 'Catering kitchen and prep for the event hall.',
        asks: ['Reset after event', 'Sanitize prep', 'Floor mop', 'Empty bins', 'Wash trays'],
      },
      'Vending & coffee points': {
        location: 'Tower-wide',
        desc: 'Self-serve vending and coffee points around the tower.',
        asks: ['Wipe machine · Fl 16', 'Spilled grounds', 'Sticky surface', 'Restock cups area', 'Empty bin'],
      },
    },
  },

  // ── Cleaning · waste & recycling (bins, waste rooms, collection rounds) ─────
  cleaning_waste: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Main waste room': {
        location: 'B1 · Dock',
        desc: 'The central waste room and compactor at the loading dock.',
        asks: ['Compactor full', 'Bad odour', 'Bin store untidy', 'Spill in room', 'Pest check'],
      },
      'Recycling center': {
        location: 'B1 · Dock',
        desc: 'Sorting and baling for paper, cardboard, glass and plastics.',
        asks: ['Cardboard overflow', 'Sort contamination', 'Bales blocking', 'Glass bin full', 'Pickup due'],
      },
      'Cafeteria waste & compost': {
        location: 'Fl 2 · Cafeteria',
        desc: 'Food-waste and compost streams from the cafeteria.',
        asks: ['Compost smell', 'Food-waste full', 'Liner split', 'Missed pickup', 'Sanitize caddy'],
      },
      'Confidential shredding': {
        location: 'Tower-wide',
        desc: 'Secure shredding consoles and their collection rounds.',
        asks: ['Shredding bin full', 'Console jammed', 'Schedule collection', 'Locked bin · Fl 49', 'Overflow'],
      },
      'Floor bins · low-rise': {
        location: 'Fl 2–17',
        desc: 'Desk-side and communal bins across the low-rise floors.',
        asks: ['Bin overflowing · Fl 8', 'Liner needed', 'Missed round', 'Recycling full', 'Spill from bin'],
      },
      'Floor bins · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Desk-side and communal bins across the mid-rise floors.',
        asks: ['Bin overflowing · Fl 24', 'Liner needed', 'Missed round', 'Recycling full', 'Spill from bin'],
      },
      'Floor bins · high-rise': {
        location: 'Fl 35–50',
        desc: 'Desk-side and communal bins across the high-rise floors.',
        asks: ['Bin overflowing · Fl 44', 'Liner needed', 'Missed round', 'Recycling full', 'Spill from bin'],
      },
      'Pantry waste rounds': {
        location: 'Tower-wide',
        desc: 'Collection rounds for the pantry and kitchen-point bins.',
        asks: ['Pantry bin full · Fl 22', 'Compost smell', 'Liner split', 'Missed round', 'Glass recycling'],
      },
      'E-waste & batteries': {
        location: 'B1 · Dock',
        desc: 'Collection points for electronics, batteries and toner.',
        asks: ['Battery box full', 'Toner pile-up', 'Schedule pickup', 'Sort e-waste', 'Label bins'],
      },
      'Hazardous & clinical': {
        location: 'B1 · Dock',
        desc: 'Segregated hazardous and clinical waste handling.',
        asks: ['Sharps bin full', 'Sealed pickup due', 'Spill kit check', 'Label & manifest', 'Quarantine item'],
      },
      'Lobby & exterior bins': {
        location: 'L1 · Entrances',
        desc: 'Public-facing bins at the lobby and entrances.',
        asks: ['Bin overflowing', 'Litter around bin', 'Liner needed', 'Cigarette litter', 'Wipe bin'],
      },
      'Roof terrace bins': {
        location: 'Fl 51 · Roof',
        desc: 'Waste and recycling on the roof terrace.',
        asks: ['Bins full after event', 'Litter on terrace', 'Liner needed', 'Recycling mixed', 'Wind-blown litter'],
      },
    },
  },

  // ── Cleaning · stairwells (treads, handrails, landings) ────────────────────
  cleaning_stairwells: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'North core · low-rise': {
        location: 'Fl 2–17 · North',
        desc: 'North stair core through the low-rise stack.',
        asks: ['Litter on landing', 'Handrail sticky', 'Spill on treads', 'Scuffed wall', 'Dust on ledges'],
      },
      'North core · mid-rise': {
        location: 'Fl 18–34 · North',
        desc: 'North stair core through the mid-rise stack.',
        asks: ['Litter · Fl 24', 'Handrail wipe-down', 'Spill on treads', 'Scuffed wall', 'Cobwebs'],
      },
      'North core · high-rise': {
        location: 'Fl 35–50 · North',
        desc: 'North stair core through the high-rise stack.',
        asks: ['Litter · Fl 41', 'Handrail sticky', 'Dust on ledges', 'Scuffed wall', 'Spill on treads'],
      },
      'South core · low-rise': {
        location: 'Fl 2–17 · South',
        desc: 'South stair core through the low-rise stack.',
        asks: ['Litter on landing', 'Handrail wipe-down', 'Spill on treads', 'Scuffed wall', 'Dust on ledges'],
      },
      'South core · mid-rise': {
        location: 'Fl 18–34 · South',
        desc: 'South stair core through the mid-rise stack.',
        asks: ['Litter · Fl 28', 'Handrail sticky', 'Spill on treads', 'Scuffed wall', 'Cobwebs'],
      },
      'South core · high-rise': {
        location: 'Fl 35–50 · South',
        desc: 'South stair core through the high-rise stack.',
        asks: ['Litter · Fl 46', 'Handrail wipe-down', 'Dust on ledges', 'Scuffed wall', 'Spill on treads'],
      },
      'Lobby & atrium stairs': {
        location: 'L1–L3',
        desc: 'The feature staircase through the lobby and atrium.',
        asks: ['Handrail smudged', 'Treads dusty', 'Spill on steps', 'Litter on landing', 'Polish balustrade'],
      },
      'Sky lobby stairs': {
        location: 'Fl 25',
        desc: 'Connecting stairs around the sky lobby.',
        asks: ['Litter on landing', 'Handrail sticky', 'Scuffed step', 'Dust on ledges', 'Spill'],
      },
      'Executive stair': {
        location: 'Fl 49–50',
        desc: 'The private stair linking the executive floors.',
        asks: ['Polish handrail', 'Vacuum runner', 'Dust ledges', 'Tidy for board', 'Spot-clean'],
      },
      'Parking stairs': {
        location: 'B1–B2',
        desc: 'Stair cores serving the parking levels.',
        asks: ['Litter on landing', 'Oil tracked in', 'Handrail grimy', 'Cobwebs', 'Wet step'],
      },
      'Fire-escape stairs': {
        location: 'Tower-wide',
        desc: 'Emergency-egress stairs kept clear and clean.',
        asks: ['Obstruction on stair', 'Dust build-up', 'Litter dropped', 'Cobwebs', 'Handrail wipe-down'],
      },
      'Roof access stair': {
        location: 'Fl 50–51',
        desc: 'Stair up to the roof terrace and plant.',
        asks: ['Leaves on steps', 'Handrail grimy', 'Spill after event', 'Dust on ledges', 'Slippery step'],
      },
    },
  },

  // ── Cleaning · elevators & escalators (cars, landings, handrails) ──────────
  cleaning_elevators: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Low-rise bank · Car 1': {
        location: 'Fl 1–17',
        desc: 'Low-rise passenger car serving floors 1–17.',
        asks: ['Smudged mirrors', 'Sticky floor', 'Buttons grimy', 'Litter in car', 'Handrail wipe-down'],
      },
      'Low-rise bank · Car 2': {
        location: 'Fl 1–17',
        desc: 'Low-rise passenger car serving floors 1–17.',
        asks: ['Fingerprints on doors', 'Sticky floor', 'Buttons grimy', 'Litter in car', 'Mirror spots'],
      },
      'Low-rise bank · Car 3': {
        location: 'Fl 1–17',
        desc: 'Low-rise passenger car serving floors 1–17.',
        asks: ['Smudged mirrors', 'Crumbs in car', 'Buttons grimy', 'Scuffed panel', 'Handrail wipe-down'],
      },
      'Mid-rise bank · Car 1': {
        location: 'Fl 18–34',
        desc: 'Mid-rise passenger car serving floors 18–34.',
        asks: ['Smudged mirrors', 'Sticky floor', 'Buttons grimy', 'Litter in car', 'Mirror spots'],
      },
      'Mid-rise bank · Car 2': {
        location: 'Fl 18–34',
        desc: 'Mid-rise passenger car serving floors 18–34.',
        asks: ['Fingerprints on doors', 'Crumbs in car', 'Buttons grimy', 'Scuffed panel', 'Handrail wipe-down'],
      },
      'Mid-rise bank · Car 3': {
        location: 'Fl 18–34',
        desc: 'Mid-rise passenger car serving floors 18–34.',
        asks: ['Smudged mirrors', 'Sticky floor', 'Buttons grimy', 'Litter in car', 'Mirror spots'],
      },
      'High-rise bank · Car 1': {
        location: 'Fl 35–50',
        desc: 'High-rise passenger car serving floors 35–50.',
        asks: ['Smudged mirrors', 'Sticky floor', 'Buttons grimy', 'Litter in car', 'Handrail wipe-down'],
      },
      'High-rise bank · Car 2': {
        location: 'Fl 35–50',
        desc: 'High-rise passenger car serving floors 35–50.',
        asks: ['Fingerprints on doors', 'Crumbs in car', 'Buttons grimy', 'Scuffed panel', 'Mirror spots'],
      },
      'Executive elevator': {
        location: 'Fl 1 / 49–50',
        desc: 'Dedicated express car to the executive floors.',
        asks: ['Polish mirrors', 'Vacuum car', 'Buttons wipe-down', 'Tidy for board', 'Scuff on panel'],
      },
      'Service & freight lift': {
        location: 'B2–Roof',
        desc: 'Goods and service lift used by crews and deliveries.',
        asks: ['Floor grimy', 'Debris in car', 'Walls scuffed', 'Spill from trolley', 'Buttons grimy'],
      },
      'Parking shuttle lift': {
        location: 'B2–L1',
        desc: 'Shuttle car between parking levels and the lobby.',
        asks: ['Oil on floor', 'Litter in car', 'Smudged glass', 'Buttons grimy', 'Wet floor'],
      },
      'Lobby escalators': {
        location: 'L1–L3',
        desc: 'Escalators connecting the lobby and lower levels.',
        asks: ['Handrail sticky', 'Steps gritty', 'Litter at comb', 'Smudged side glass', 'Skirting grimy'],
      },
    },
  },

  // ── Cleaning · exterior & entrances (mats, façade, walkways, seating) ──────
  cleaning_exterior: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Main entrance & forecourt': {
        location: 'L1 · Main entrance',
        desc: 'The main entrance, revolving doors and forecourt.',
        asks: ['Litter at entrance', 'Mats soaked — rain', 'Glass doors smudged', 'Gum on paving', 'Cigarette litter'],
      },
      'Lobby glazing & façade': {
        location: 'L1 · Façade',
        desc: 'Ground-floor curtain-wall glazing and façade.',
        asks: ['Façade glass smudged', 'Bird mess', 'Streaks after clean', 'Water spots', 'Poster residue'],
      },
      'Plaza & walkways': {
        location: 'Ground · Plaza',
        desc: 'The public plaza and approach walkways.',
        asks: ['Leaves on walkway', 'Litter on plaza', 'Spill / stain', 'Gum on paving', 'Drain blocked'],
      },
      'Loading dock & service yard': {
        location: 'B1 · Dock',
        desc: 'The loading dock and service yard.',
        asks: ['Debris in yard', 'Oil spill', 'Sweep dock', 'Bins overflowing', 'Pallet clutter'],
      },
      'Parking entrance & ramps': {
        location: 'B1 · Ramps',
        desc: 'Vehicle entrance, ramps and barrier area.',
        asks: ['Oil on ramp', 'Litter at barrier', 'Sweep debris', 'Tyre marks', 'Drain blocked'],
      },
      'Outdoor seating & planters': {
        location: 'Ground · Plaza',
        desc: 'Outdoor seating, tables and planters.',
        asks: ['Wipe tables', 'Litter under seats', 'Bird mess', 'Weeds in planter', 'Spill on bench'],
      },
      'Roof terrace exterior': {
        location: 'Fl 51 · Roof',
        desc: 'The roof terrace decking, furniture and rails.',
        asks: ['Sweep leaves', 'Wipe furniture', 'Bird mess', 'Drain blocked', 'Glass rail smudged'],
      },
      'Bike racks & smoking points': {
        location: 'Ground · Perimeter',
        desc: 'Bike storage and the designated smoking points.',
        asks: ['Cigarette litter', 'Empty ash bin', 'Sweep area', 'Litter at racks', 'Wipe shelter'],
      },
    },
  },

  // ── Cleaning · windows & glass (partitions, mirrors, façade glass) ─────────
  cleaning_windows: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Lobby glazing': {
        location: 'L1 · Lobby',
        desc: 'Floor-to-ceiling glazing around the main lobby.',
        asks: ['Fingerprints on glass', 'Streaks after clean', 'Smudged doors', 'Water spots', 'Poster residue'],
      },
      'Atrium glass walls': {
        location: 'L1–L3',
        desc: 'The atrium’s internal glass walls and balustrades.',
        asks: ['Smudged glass', 'Fingerprints', 'Streaks', 'Dusty frames', 'Spots on balustrade'],
      },
      'Façade · low-rise': {
        location: 'Fl 2–17 · Exterior',
        desc: 'External façade glazing across the low-rise stack.',
        asks: ['Bird mess on glass', 'Water spots', 'Streaks after clean', 'Dust film', 'Cradle access needed'],
      },
      'Façade · mid-rise': {
        location: 'Fl 18–34 · Exterior',
        desc: 'External façade glazing across the mid-rise stack.',
        asks: ['Bird mess on glass', 'Water spots', 'Streaks after clean', 'Dust film', 'Cradle access needed'],
      },
      'Façade · high-rise': {
        location: 'Fl 35–50 · Exterior',
        desc: 'External façade glazing across the high-rise stack.',
        asks: ['Bird mess on glass', 'Water spots', 'Streaks after clean', 'Dust film', 'Cradle access needed'],
      },
      'Sky lobby glazing': {
        location: 'Fl 25',
        desc: 'The sky-lobby curtain wall and internal glass.',
        asks: ['Fingerprints on glass', 'Streaks', 'Smudged doors', 'Water spots', 'Dusty frames'],
      },
      'Executive glass · Fl 49–50': {
        location: 'Fl 49–50',
        desc: 'Executive-floor glass offices and partitions.',
        asks: ['Polish glass', 'Fingerprints', 'Tidy for board', 'Streaks', 'Smudged door'],
      },
      'Meeting-room partitions': {
        location: 'Tower-wide',
        desc: 'Glass partitions and walls in meeting rooms.',
        asks: ['Marker not wiped', 'Fingerprints', 'Streaks', 'Smudged door', 'Glass writing left'],
      },
      'Office glass partitions': {
        location: 'Tower-wide',
        desc: 'Internal office glass partitions and screens.',
        asks: ['Fingerprints', 'Smudged glass', 'Streaks', 'Dusty frame', 'Sticker residue'],
      },
      'Cafeteria windows': {
        location: 'Fl 2',
        desc: 'Windows and glass around the cafeteria.',
        asks: ['Food splashes', 'Fingerprints', 'Streaks', 'Greasy film', 'Smudged door'],
      },
      'Restroom mirrors': {
        location: 'Tower-wide',
        desc: 'Mirrors and glass in the restrooms.',
        asks: ['Water spots', 'Toothpaste marks', 'Streaks', 'Smudged mirror', 'Splash marks'],
      },
      'Elevator-lobby glass': {
        location: 'Tower-wide',
        desc: 'Glass at the lift lobbies and landings.',
        asks: ['Fingerprints', 'Smudged glass', 'Streaks', 'Dusty frame', 'Scuff marks'],
      },
      'Roof terrace glazing': {
        location: 'Fl 51 · Roof',
        desc: 'Glass balustrades and screens on the roof terrace.',
        asks: ['Bird mess', 'Water spots', 'Smudged glass', 'Streaks', 'Dust film'],
      },
      'Interior signage glass': {
        location: 'Tower-wide',
        desc: 'Glazed signage, directories and display cases.',
        asks: ['Fingerprints', 'Smudged case', 'Streaks', 'Dusty surface', 'Sticker residue'],
      },
    },
  },

  // ── Cleaning · disinfection (high-touch surfaces) ──────────────────────────
  cleaning_disinfection: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Lift call buttons & panels': {
        location: 'Tower-wide',
        desc: 'Lift call buttons and in-car control panels.',
        asks: ['Flagged high-touch', 'Sanitize panel', 'Cold/flu hotspot', 'Wipe buttons', 'After-event clean'],
      },
      'Door handles & push plates': {
        location: 'Tower-wide',
        desc: 'Door handles, push plates and pulls.',
        asks: ['Flagged high-touch', 'Wipe handles', 'Cold/flu hotspot', 'Sanitize pull', 'Outbreak protocol'],
      },
      'Reception & desks': {
        location: 'L1 · Reception',
        desc: 'Reception counters and shared front-desk surfaces.',
        asks: ['Sanitize counter', 'Wipe shared pen', 'Cold/flu hotspot', 'After-visitor clean', 'Flagged'],
      },
      'Meeting-room controls & remotes': {
        location: 'Tower-wide',
        desc: 'AV remotes, touch panels and room controls.',
        asks: ['Sanitize remote', 'Wipe touch panel', 'Flagged high-touch', 'After-meeting clean', 'Cold/flu hotspot'],
      },
      'Kitchen & pantry surfaces': {
        location: 'Tower-wide',
        desc: 'Pantry counters, handles and appliance touchpoints.',
        asks: ['Sanitize counter', 'Wipe fridge handle', 'Flagged', 'Microwave panel', 'After-lunch clean'],
      },
      'Restroom touchpoints': {
        location: 'Tower-wide',
        desc: 'Taps, flush plates, dispensers and locks.',
        asks: ['Sanitize taps', 'Wipe flush plate', 'Cold/flu hotspot', 'Door lock', 'Flagged'],
      },
      'Stair handrails': {
        location: 'Tower-wide',
        desc: 'Handrails on stairs and ramps.',
        asks: ['Sanitize handrail', 'Flagged high-touch', 'Cold/flu hotspot', 'Wipe rail', 'After-event clean'],
      },
      'Turnstiles & access gates': {
        location: 'L1 · Lobby',
        desc: 'Speed gates, turnstiles and badge readers.',
        asks: ['Sanitize reader', 'Wipe gate', 'Flagged high-touch', 'Cold/flu hotspot', 'Grime build-up'],
      },
      'Shared keyboards & touchscreens': {
        location: 'Tower-wide',
        desc: 'Hot-desk keyboards and shared touchscreens.',
        asks: ['Sanitize keyboard', 'Wipe touchscreen', 'Flagged', 'Cold/flu hotspot', 'Grimy screen'],
      },
      'Coffee & vending machines': {
        location: 'Tower-wide',
        desc: 'Touchpoints on coffee and vending machines.',
        asks: ['Sanitize buttons', 'Wipe dispenser', 'Flagged high-touch', 'Sticky panel', 'After-rush clean'],
      },
      'Printer & copier panels': {
        location: 'Tower-wide',
        desc: 'Shared printer and copier control panels.',
        asks: ['Sanitize panel', 'Wipe touchscreen', 'Flagged', 'Grimy buttons', 'Cold/flu hotspot'],
      },
      'Phone booths & pods': {
        location: 'Tower-wide',
        desc: 'Surfaces and handsets in booths and focus pods.',
        asks: ['Sanitize surfaces', 'Wipe handset', 'Flagged high-touch', 'After-use clean', 'Cold/flu hotspot'],
      },
      'Cafeteria trays & counters': {
        location: 'Fl 2',
        desc: 'Tray rails, counters and self-serve touchpoints.',
        asks: ['Sanitize tray rail', 'Wipe counter', 'Flagged', 'After-service clean', 'Cold/flu hotspot'],
      },
      'Visitor & badging area': {
        location: 'L1 · Lobby',
        desc: 'Visitor kiosks, pens and badging touchpoints.',
        asks: ['Sanitize kiosk', 'Wipe shared pen', 'Flagged high-touch', 'After-visitor clean', 'Cold/flu hotspot'],
      },
    },
  },

  // ── Cleaning · air vents & filters (air quality) ───────────────────────────
  cleaning_vents: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'AHU filters · low-rise': {
        location: 'Fl 2–17 · Plant',
        desc: 'Air-handling-unit filters serving the low-rise floors.',
        asks: ['Filter overdue', 'Airflow weak', 'Dust loading high', 'Swap filter', 'Odour reported'],
      },
      'AHU filters · mid-rise': {
        location: 'Fl 18–34 · Plant',
        desc: 'Air-handling-unit filters serving the mid-rise floors.',
        asks: ['Filter overdue', 'Airflow weak', 'Dust loading high', 'Swap filter', 'Odour reported'],
      },
      'AHU filters · high-rise': {
        location: 'Fl 35–50 · Plant',
        desc: 'Air-handling-unit filters serving the high-rise floors.',
        asks: ['Filter overdue', 'Airflow weak', 'Dust loading high', 'Swap filter', 'Odour reported'],
      },
      'Lobby & atrium vents': {
        location: 'L1',
        desc: 'Supply and return vents through the lobby and atrium.',
        asks: ['Dusty diffuser', 'Odour from vent', 'Airflow weak', 'Grille discoloured', 'Whistling vent'],
      },
      'Cafeteria extract & hood': {
        location: 'Fl 2',
        desc: 'Kitchen extract hood and ducting in the cafeteria.',
        asks: ['Grease filter clog', 'Hood overdue', 'Odour lingering', 'Airflow weak', 'Degrease ducting'],
      },
      'Restroom extract fans': {
        location: 'Tower-wide',
        desc: 'Extract fans and grilles in the restrooms.',
        asks: ['Odour from vent', 'Fan noisy', 'Dusty grille', 'Airflow weak', 'Grille discoloured'],
      },
      'Meeting-room diffusers': {
        location: 'Tower-wide',
        desc: 'Supply diffusers in meeting and conference rooms.',
        asks: ['Dusty diffuser', 'Draught complaint', 'Airflow weak', 'Whistling vent', 'Grille marks'],
      },
      'Server & comms room vents': {
        location: 'Tower-wide',
        desc: 'Cooling vents and filters in server and comms rooms.',
        asks: ['Filter overdue', 'Dust loading high', 'Airflow weak', 'Swap filter', 'Hot spot reported'],
      },
      'Parking extract fans': {
        location: 'B1–B2',
        desc: 'Extract fans clearing fumes from the parking levels.',
        asks: ['Fan dirty', 'Fumes lingering', 'Airflow weak', 'Grille blocked', 'Noisy fan'],
      },
      'Kitchen grease filters': {
        location: 'Fl 2 / Fl 50',
        desc: 'Grease filters on the cafeteria and executive kitchens.',
        asks: ['Grease filter clog', 'Filter overdue', 'Odour lingering', 'Swap filter', 'Degrease hood'],
      },
      'Stairwell pressurization vents': {
        location: 'Tower-wide',
        desc: 'Pressurization vents keeping stair cores smoke-free.',
        asks: ['Dusty grille', 'Airflow check', 'Grille discoloured', 'Whistling vent', 'Obstruction'],
      },
      'Executive-floor diffusers': {
        location: 'Fl 49–50',
        desc: 'Supply diffusers across the executive floors.',
        asks: ['Dusty diffuser', 'Draught complaint', 'Airflow weak', 'Grille marks', 'Tidy for board'],
      },
      'Sky lobby vents': {
        location: 'Fl 25',
        desc: 'Supply and return vents around the sky lobby.',
        asks: ['Dusty diffuser', 'Odour from vent', 'Airflow weak', 'Grille discoloured', 'Whistling vent'],
      },
      'Return-air grilles · low-rise': {
        location: 'Fl 2–17',
        desc: 'Return-air grilles across the low-rise floors.',
        asks: ['Dusty grille', 'Airflow weak', 'Grille discoloured', 'Obstruction', 'Clean grille'],
      },
      'Return-air grilles · high-rise': {
        location: 'Fl 35–50',
        desc: 'Return-air grilles across the high-rise floors.',
        asks: ['Dusty grille', 'Airflow weak', 'Grille discoloured', 'Obstruction', 'Clean grille'],
      },
      'Roof intake louvres': {
        location: 'Fl 51 · Roof',
        desc: 'Fresh-air intake louvres and screens on the roof.',
        asks: ['Debris in louvre', 'Bird mess', 'Screen blocked', 'Clear leaves', 'Airflow check'],
      },
    },
  },

  // ── Cleaning · supplies & consumables (soap, paper, sanitizer) ─────────────
  cleaning_supplies: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Restroom soap & sanitizer': {
        location: 'Tower-wide',
        desc: 'Soap and sanitizer dispensers across the restrooms.',
        asks: ['Soap empty · Fl 16', 'Sanitizer low', 'Dispenser jammed', 'Restock round', 'Leaking dispenser'],
      },
      'Paper towels & tissue': {
        location: 'Tower-wide',
        desc: 'Paper-towel and tissue dispensers building-wide.',
        asks: ['Out of paper towels', 'Tissue low · Fl 22', 'Dispenser jammed', 'Restock round', 'Empty holder'],
      },
      'Toilet paper': {
        location: 'Tower-wide',
        desc: 'Toilet-paper stock across the restrooms.',
        asks: ['TP stockout · Fl 30', 'Low — restock', 'Holder broken', 'Restock round', 'Empty stall'],
      },
      'Hand-sanitizer stations': {
        location: 'Tower-wide',
        desc: 'Free-standing and wall sanitizer stations.',
        asks: ['Station empty', 'Refill cartridge', 'Pump faulty', 'Restock round', 'Relocate station'],
      },
      'Pantry consumables': {
        location: 'Tower-wide',
        desc: 'Cups, towels, dish soap and pantry consumables.',
        asks: ['Out of cups', 'Dish soap low', 'Towels empty', 'Restock pantry', 'Sponges needed'],
      },
      'Cafeteria napkins & cutlery': {
        location: 'Fl 2',
        desc: 'Napkin, cutlery and condiment stock in the cafeteria.',
        asks: ['Napkins empty', 'Cutlery low', 'Condiments out', 'Restock station', 'Trays low'],
      },
      'Cleaning-cart restock': {
        location: 'Tower-wide',
        desc: 'Chemicals, cloths and liners on the cleaning carts.',
        asks: ['Liners low', 'Out of cloths', 'Chemical refill', 'Restock cart', 'Spray bottle empty'],
      },
      'Low-rise supply closet': {
        location: 'Fl 8 · Store',
        desc: 'The supply and janitorial closet for the low-rise floors.',
        asks: ['Stock check', 'Reorder paper', 'Closet untidy', 'Chemicals low', 'Liners out'],
      },
      'Mid-rise supply closet': {
        location: 'Fl 22 · Store',
        desc: 'The supply and janitorial closet for the mid-rise floors.',
        asks: ['Stock check', 'Reorder soap', 'Closet untidy', 'Chemicals low', 'Liners out'],
      },
      'High-rise supply closet': {
        location: 'Fl 44 · Store',
        desc: 'The supply and janitorial closet for the high-rise floors.',
        asks: ['Stock check', 'Reorder paper', 'Closet untidy', 'Chemicals low', 'Liners out'],
      },
    },
  },

  // ── Cleaning · laundry & linen (towels, mats, uniforms) ────────────────────
  cleaning_laundry: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Wellness towels': {
        location: 'Fl 3 · Amenities',
        desc: 'Towel stock for the wellness rooms.',
        asks: ['Towels low · Fl 3', 'Soiled pickup', 'Fresh batch needed', 'Stained towel', 'Restock shelf'],
      },
      'Gym & shower towels': {
        location: 'Fl 3 · Amenities',
        desc: 'Towels for the gym and shower facilities.',
        asks: ['Towels low', 'Soiled pickup', 'Fresh batch needed', 'Damp pile', 'Restock shelf'],
      },
      'Executive dining linen': {
        location: 'Fl 50 · Club',
        desc: 'Tablecloths and napkins for executive dining.',
        asks: ['Stained tablecloth', 'Fresh linen for board', 'Soiled pickup', 'Press napkins', 'Short on sets'],
      },
      'Cafeteria linen & cloths': {
        location: 'Fl 2',
        desc: 'Cloths, aprons and service linen for the cafeteria.',
        asks: ['Cloths low', 'Aprons soiled', 'Fresh batch needed', 'Soiled pickup', 'Stained cloth'],
      },
      'Entrance & walk-off mats': {
        location: 'L1 · Entrances',
        desc: 'Rotating entrance and walk-off matting.',
        asks: ['Mats need swap', 'Soaked — rain', 'Fresh mats needed', 'Soiled pickup', 'Reposition mat'],
      },
      'Crew uniforms': {
        location: 'B1 · Crew room',
        desc: 'Laundered uniforms for the cleaning crew.',
        asks: ['Uniform turnaround', 'Soiled pickup', 'Short on sizes', 'Stained uniform', 'Fresh sets needed'],
      },
      'Event linen & covers': {
        location: 'Fl 3 · Event hall',
        desc: 'Tablecloths, skirting and chair covers for events.',
        asks: ['Fresh linen for event', 'Soiled pickup', 'Stained cover', 'Press skirting', 'Short on sets'],
      },
      'Microfiber & cleaning cloths': {
        location: 'Tower-wide',
        desc: 'Laundered microfiber and cleaning cloths for the carts.',
        asks: ['Cloths low', 'Soiled pickup', 'Fresh batch needed', 'Colour-code mix-up', 'Restock cart'],
      },
      'Roof terrace cushions & covers': {
        location: 'Fl 51 · Roof',
        desc: 'Seat cushions and furniture covers for the terrace.',
        asks: ['Cushions damp', 'Soiled pickup', 'Stained cover', 'Fresh set needed', 'Store after event'],
      },
      'Soiled-linen collection': {
        location: 'Tower-wide',
        desc: 'Collection rounds for soiled linen across the tower.',
        asks: ['Bag full · Fl 3', 'Schedule pickup', 'Missed collection', 'Odour from bag', 'Extra round needed'],
      },
    },
  },

  // ── Cleaning · deep & specialty (scheduled, post-event, post-construction) ─
  cleaning_deep: {
    handlers: CLEANING_CREW,
    channels: CLEANING_CHANNELS,
    items: {
      'Carpet shampoo · scheduled': {
        location: 'Tower-wide',
        desc: 'Scheduled deep shampoo and extraction of carpets.',
        asks: [
          'Schedule carpet shampoo',
          'Heavy soiling · Fl 12',
          'Stain treatment',
          'Dry-time plan',
          'Post-clean check',
        ],
      },
      'Hard-floor strip & seal': {
        location: 'Tower-wide',
        desc: 'Stripping and resealing hard floors.',
        asks: ['Strip & seal · Fl 12', 'Dull finish', 'Schedule overnight', 'Scuffs build-up', 'Re-coat needed'],
      },
      'Post-event deep clean': {
        location: 'Fl 3 · Event hall',
        desc: 'Full reset and deep clean after events.',
        asks: ['Post-event reset', 'Spills & stains', 'Bins & recycling', 'Floor deep clean', 'Furniture wipe-down'],
      },
      'Post-construction clean': {
        location: 'Tower-wide',
        desc: 'Builders’ clean after fit-out and construction.',
        asks: ['Builders’ clean · Fl 28', 'Dust everywhere', 'Sticker & residue', 'Final detail', 'Sign-off check'],
      },
      'Kitchen deep clean': {
        location: 'Fl 2 · Cafeteria',
        desc: 'Scheduled deep clean of the kitchen and equipment.',
        asks: ['Degrease line', 'Behind equipment', 'Hood & ducting', 'Floor scrub', 'Sanitize all'],
      },
      'Restroom deep sanitize': {
        location: 'Tower-wide',
        desc: 'Periodic deep sanitize of the restrooms.',
        asks: ['Descale fixtures', 'Grout & tiles', 'Deep sanitize', 'Odour treatment', 'Post-clean check'],
      },
      'High-level dusting': {
        location: 'Tower-wide',
        desc: 'Dusting of high ledges, fixtures and ductwork.',
        asks: ['High-level dusting', 'Cobwebs at height', 'Light fittings', 'Ductwork ledges', 'Access equipment'],
      },
      'Façade / external window clean': {
        location: 'Exterior',
        desc: 'Cradle and rope-access cleaning of the façade.',
        asks: ['Schedule cradle clean', 'Streaky façade', 'Bird mess', 'Weather window', 'Permit & access'],
      },
      'Upholstery & soft furnishings': {
        location: 'Tower-wide',
        desc: 'Deep clean of sofas, chairs and soft furnishings.',
        asks: ['Stained sofa', 'Schedule upholstery', 'Odour treatment', 'Fabric care', 'Post-clean check'],
      },
      'Executive-floor detail': {
        location: 'Fl 49–50',
        desc: 'Detailed deep clean across the executive floors.',
        asks: ['Detail before board', 'Polish & dust', 'Carpet spot-treat', 'Glass & metal', 'Sign-off check'],
      },
    },
  },

  // ── Security · zones (the patrol/coverage overview board) ──────────────────
  security: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Main lobby & entrances': {
        location: 'L1 · Lobby',
        desc: 'The main lobby, turnstiles and public entrances.',
        asks: [
          'Tailgating flagged',
          'Unsecured door',
          'Suspicious person',
          'After-hours access',
          'Alarm — investigate',
        ],
      },
      'Loading dock & service yard': {
        location: 'B1 · Dock',
        desc: 'Goods-in, the loading dock and service yard.',
        asks: ['Shutter left open', 'Unbooked delivery', 'Suspicious vehicle', 'Door propped', 'Alarm — investigate'],
      },
      'Parking · B1': {
        location: 'B1 · Parking',
        desc: 'Upper parking level and its access points.',
        asks: ['Tailgating at barrier', 'Unauthorized vehicle', 'Person loitering', 'Light out', 'Alarm — investigate'],
      },
      'Parking · B2': {
        location: 'B2 · Parking',
        desc: 'Lower parking level and plant access.',
        asks: ['Unauthorized vehicle', 'Door propped', 'Person loitering', 'Light out', 'Alarm — investigate'],
      },
      'Low-rise floors': {
        location: 'Fl 2–17',
        desc: 'Tenant floors across the low-rise stack.',
        asks: ['Unbadged on floor', 'Door held open', 'After-hours access', 'Suspicious person', 'Alarm — investigate'],
      },
      'Mid-rise floors': {
        location: 'Fl 18–34',
        desc: 'Tenant floors across the mid-rise stack.',
        asks: ['Unbadged on floor', 'Door held open', 'After-hours access', 'Suspicious person', 'Alarm — investigate'],
      },
      'High-rise floors': {
        location: 'Fl 35–50',
        desc: 'Tenant floors across the high-rise stack.',
        asks: ['Unbadged on floor', 'Door held open', 'After-hours access', 'Suspicious person', 'Alarm — investigate'],
      },
      'Executive floors': {
        location: 'Fl 49–50',
        desc: 'The executive and boardroom floors — restricted access.',
        asks: ['Access attempt', 'Escort required', 'After-hours access', 'Unbadged visitor', 'Sweep before board'],
      },
      'Sky lobby': {
        location: 'Fl 25',
        desc: 'The mid-tower sky lobby and transfer area.',
        asks: ['Tailgating flagged', 'Person loitering', 'Unattended bag', 'After-hours access', 'Alarm — investigate'],
      },
      'Roof & plant': {
        location: 'Fl 51 · Roof',
        desc: 'Roof terrace, plant rooms and access hatches.',
        asks: [
          'Roof door open',
          'Unauthorized access',
          'Contractor unescorted',
          'Hatch unsecured',
          'Alarm — investigate',
        ],
      },
      'Server & comms rooms': {
        location: 'Tower-wide',
        desc: 'Restricted server and communications rooms.',
        asks: ['Access attempt', 'Door held open', 'Unescorted contractor', 'Environment alarm', 'Sweep & verify'],
      },
      'Mailroom & deliveries': {
        location: 'L1 · Mailroom',
        desc: 'Mailroom, parcel screening and deliveries.',
        asks: ['Unscreened parcel', 'Suspicious package', 'Unbooked courier', 'Door propped', 'Alarm — investigate'],
      },
      'Amenities & wellness': {
        location: 'Fl 3',
        desc: 'Amenity, wellness and gym areas.',
        asks: ['After-hours access', 'Unbadged user', 'Property left', 'Disturbance', 'Door held open'],
      },
      'Event hall & public areas': {
        location: 'Fl 3 · Event hall',
        desc: 'Event spaces and public-facing areas during functions.',
        asks: ['Crowd build-up', 'Unbadged guest', 'Unattended bag', 'Capacity check', 'Disturbance'],
      },
      'Perimeter & forecourt': {
        location: 'Ground · Perimeter',
        desc: 'The building perimeter, forecourt and approaches.',
        asks: ['Person loitering', 'Gate left open', 'Unauthorized vehicle', 'Fence checked', 'Alarm — investigate'],
      },
      'Control room': {
        location: 'L1 · Security',
        desc: 'The security control room and monitoring desk.',
        asks: ['System fault', 'Radio check', 'Handover note', 'CCTV review', 'Log incident'],
      },
    },
  },

  // ── Security · access control (doors, badge readers, turnstiles) ───────────
  security_access: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Main entrance turnstiles': {
        location: 'L1 · Lobby',
        desc: 'Speed gates and turnstiles at the main entrance.',
        asks: ['Tailgating', 'Gate held open', 'Reader offline', 'Badge declined', 'Forced entry'],
      },
      'Lobby side doors': {
        location: 'L1',
        desc: 'Secondary lobby doors and side entrances.',
        asks: ['Door forced', 'Held open — alarm', 'Badge declined', 'Closer faulty', 'Propped open'],
      },
      'Loading dock doors': {
        location: 'B1 · Dock',
        desc: 'Roller shutters and personnel doors at the dock.',
        asks: ['Shutter left open', 'Door forced', 'Reader offline', 'Held open — alarm', 'Badge declined'],
      },
      'Parking access gates': {
        location: 'B1',
        desc: 'Vehicle and pedestrian gates to the parking levels.',
        asks: ['Tailgating', 'Barrier stuck', 'Reader offline', 'Badge declined', 'Forced entry'],
      },
      'Server room door': {
        location: 'Tower-wide',
        desc: 'Access-controlled server and comms room doors.',
        asks: ['Access attempt', 'Held open — alarm', 'Reader offline', 'Unescorted entry', 'Forced entry'],
      },
      'Executive floor access': {
        location: 'Fl 49–50',
        desc: 'Restricted access to the executive floors.',
        asks: ['Badge declined', 'Tailgating', 'Held open — alarm', 'Reader offline', 'Access attempt'],
      },
      'Stairwell fire doors': {
        location: 'Tower-wide',
        desc: 'Monitored fire and stairwell doors.',
        asks: ['Door propped', 'Held open — alarm', 'Closer faulty', 'Forced entry', 'Contact fault'],
      },
      'Roof access door': {
        location: 'Fl 51 · Roof',
        desc: 'The controlled door to the roof and plant.',
        asks: ['Door left open', 'Unauthorized access', 'Held open — alarm', 'Reader offline', 'Forced entry'],
      },
      'Mailroom door': {
        location: 'L1 · Mailroom',
        desc: 'Access door to the mailroom and screening area.',
        asks: ['Propped open', 'Badge declined', 'Reader offline', 'Held open — alarm', 'Forced entry'],
      },
      'Plant room doors': {
        location: 'Tower-wide',
        desc: 'Mechanical and plant room access doors.',
        asks: ['Unescorted entry', 'Held open — alarm', 'Reader offline', 'Door propped', 'Forced entry'],
      },
      'Sky lobby gates': {
        location: 'Fl 25',
        desc: 'Transfer gates and readers at the sky lobby.',
        asks: ['Tailgating', 'Gate held open', 'Reader offline', 'Badge declined', 'Forced entry'],
      },
      'Amenities access': {
        location: 'Fl 3',
        desc: 'Badge access to amenity and wellness areas.',
        asks: ['Badge declined', 'Held open — alarm', 'Reader offline', 'After-hours entry', 'Tailgating'],
      },
      'After-hours entrance': {
        location: 'L1',
        desc: 'The designated after-hours entry point.',
        asks: ['Badge declined', 'Tailgating', 'Held open — alarm', 'Reader offline', 'Forced entry'],
      },
      'Comms riser doors': {
        location: 'Tower-wide',
        desc: 'Floor comms-riser and IDF cupboard doors.',
        asks: ['Door propped', 'Unescorted entry', 'Held open — alarm', 'Reader offline', 'Contact fault'],
      },
    },
  },

  // ── Security · surveillance (camera coverage and monitoring) ───────────────
  security_cctv: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Main entrance · Cam 01': {
        location: 'L1 · Lobby',
        desc: 'Camera covering the main entrance and turnstiles.',
        asks: ['Camera offline', 'Motion after hours', 'Tailgating flagged', 'View obstructed', 'Lens dirty'],
      },
      'Lobby atrium · Cam 02': {
        location: 'L1 · Lobby',
        desc: 'Wide camera over the lobby and atrium.',
        asks: ['Camera offline', 'Loitering flagged', 'Unattended bag', 'View obstructed', 'Lens dirty'],
      },
      'Reception · Cam 03': {
        location: 'L1',
        desc: 'Camera over the reception and welcome desk.',
        asks: ['Camera offline', 'Motion after hours', 'View obstructed', 'Lens dirty', 'Recording gap'],
      },
      'Loading dock · Cam 04': {
        location: 'B1 · Dock',
        desc: 'Camera covering the loading dock and goods-in.',
        asks: ['Camera offline', 'Motion after hours', 'Vehicle flagged', 'View obstructed', 'Lens dirty'],
      },
      'Parking B1 · Cam 05': {
        location: 'B1',
        desc: 'Camera over the upper parking level.',
        asks: ['Camera offline', 'Motion after hours', 'Loitering flagged', 'View obstructed', 'Lens dirty'],
      },
      'Parking B2 · Cam 06': {
        location: 'B2',
        desc: 'Camera over the lower parking level.',
        asks: ['Camera offline', 'Motion after hours', 'Loitering flagged', 'View obstructed', 'Lens dirty'],
      },
      'Low-rise lifts · Cam 07': {
        location: 'Fl 2–17',
        desc: 'Camera at the low-rise lift lobbies.',
        asks: ['Camera offline', 'Motion after hours', 'View obstructed', 'Lens dirty', 'Recording gap'],
      },
      'Mid-rise lifts · Cam 08': {
        location: 'Fl 18–34',
        desc: 'Camera at the mid-rise lift lobbies.',
        asks: ['Camera offline', 'Motion after hours', 'View obstructed', 'Lens dirty', 'Recording gap'],
      },
      'High-rise lifts · Cam 09': {
        location: 'Fl 35–50',
        desc: 'Camera at the high-rise lift lobbies.',
        asks: ['Camera offline', 'Motion after hours', 'View obstructed', 'Lens dirty', 'Recording gap'],
      },
      'Sky lobby · Cam 10': {
        location: 'Fl 25',
        desc: 'Camera covering the sky lobby.',
        asks: ['Camera offline', 'Loitering flagged', 'Unattended bag', 'View obstructed', 'Lens dirty'],
      },
      'Executive floor · Cam 11': {
        location: 'Fl 50',
        desc: 'Camera on the executive-floor approach.',
        asks: ['Camera offline', 'Motion after hours', 'Access flagged', 'View obstructed', 'Lens dirty'],
      },
      'Stair core N · Cam 12': {
        location: 'Tower-wide',
        desc: 'Camera in the north stair core.',
        asks: ['Camera offline', 'Motion after hours', 'Door propped flagged', 'View obstructed', 'Recording gap'],
      },
      'Stair core S · Cam 13': {
        location: 'Tower-wide',
        desc: 'Camera in the south stair core.',
        asks: ['Camera offline', 'Motion after hours', 'Door propped flagged', 'View obstructed', 'Recording gap'],
      },
      'Roof terrace · Cam 14': {
        location: 'Fl 51 · Roof',
        desc: 'Camera covering the roof terrace.',
        asks: ['Camera offline', 'Motion after hours', 'Access flagged', 'View obstructed', 'Lens dirty'],
      },
      'Server room · Cam 15': {
        location: 'Tower-wide',
        desc: 'Camera at the server room entrance.',
        asks: ['Camera offline', 'Motion after hours', 'Access flagged', 'View obstructed', 'Recording gap'],
      },
      'Mailroom · Cam 16': {
        location: 'L1 · Mailroom',
        desc: 'Camera over the mailroom and screening.',
        asks: ['Camera offline', 'Motion after hours', 'Parcel flagged', 'View obstructed', 'Lens dirty'],
      },
      'Forecourt · Cam 17': {
        location: 'Ground',
        desc: 'Camera covering the forecourt and approach.',
        asks: ['Camera offline', 'Loitering flagged', 'Vehicle flagged', 'View obstructed', 'Lens dirty'],
      },
      'Perimeter N · Cam 18': {
        location: 'Ground',
        desc: 'Camera on the north perimeter line.',
        asks: ['Camera offline', 'Motion after hours', 'Fence flagged', 'View obstructed', 'Lens dirty'],
      },
      'Perimeter S · Cam 19': {
        location: 'Ground',
        desc: 'Camera on the south perimeter line.',
        asks: ['Camera offline', 'Motion after hours', 'Fence flagged', 'View obstructed', 'Lens dirty'],
      },
      'Bike & smoking area · Cam 20': {
        location: 'Ground',
        desc: 'Camera over the bike racks and smoking point.',
        asks: ['Camera offline', 'Loitering flagged', 'Litter / damage', 'View obstructed', 'Lens dirty'],
      },
    },
  },

  // ── Security · perimeter (fences, gates, loading docks) ────────────────────
  security_perimeter: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Main vehicle gate': {
        location: 'Ground · Gate',
        desc: 'The primary vehicle entrance gate.',
        asks: ['Gate left open', 'Tailgate at gate', 'Barrier stuck', 'Unauthorized vehicle', 'Intercom fault'],
      },
      'Service yard gate': {
        location: 'B1 · Dock',
        desc: 'Gate to the service yard and dock.',
        asks: ['Gate left open', 'Unbooked vehicle', 'Barrier stuck', 'Tailgate at gate', 'Intercom fault'],
      },
      'Parking ramp barrier': {
        location: 'B1 · Ramp',
        desc: 'The barrier at the parking ramp.',
        asks: ['Barrier stuck', 'Tailgating', 'Unauthorized vehicle', 'Reader offline', 'Damage to arm'],
      },
      'Pedestrian gate N': {
        location: 'Ground',
        desc: 'North pedestrian access gate.',
        asks: ['Gate left open', 'Tailgating', 'Lock fault', 'Person loitering', 'Damage'],
      },
      'Pedestrian gate S': {
        location: 'Ground',
        desc: 'South pedestrian access gate.',
        asks: ['Gate left open', 'Tailgating', 'Lock fault', 'Person loitering', 'Damage'],
      },
      'Loading dock shutter': {
        location: 'B1 · Dock',
        desc: 'The main loading-dock roller shutter.',
        asks: ['Shutter left open', 'Won’t close', 'Unbooked delivery', 'Forced', 'Sensor fault'],
      },
      'Perimeter fence · N': {
        location: 'Ground',
        desc: 'The north perimeter fence line.',
        asks: ['Fence damaged', 'Climb attempt', 'Gap found', 'Vegetation overgrown', 'Sensor fault'],
      },
      'Perimeter fence · S': {
        location: 'Ground',
        desc: 'The south perimeter fence line.',
        asks: ['Fence damaged', 'Climb attempt', 'Gap found', 'Vegetation overgrown', 'Sensor fault'],
      },
      'Forecourt bollards': {
        location: 'Ground',
        desc: 'Security bollards protecting the forecourt.',
        asks: ['Bollard down', 'Won’t raise', 'Vehicle too close', 'Damage', 'Control fault'],
      },
      'Roof perimeter': {
        location: 'Fl 51 · Roof',
        desc: 'The roof edge and access perimeter.',
        asks: ['Gate left open', 'Unauthorized access', 'Edge hazard', 'Hatch unsecured', 'Sensor fault'],
      },
    },
  },

  // ── Security · patrols & rounds (guard routes and checkpoints) ─────────────
  security_patrols: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Lobby & ground round': {
        location: 'L1',
        desc: 'Patrol of the lobby, ground floor and entrances.',
        asks: ['Missed checkpoint', 'Door found unlocked', 'Light out — flag', 'Obstruction found', 'All clear'],
      },
      'Low-rise round': {
        location: 'Fl 2–17',
        desc: 'Patrol round through the low-rise floors.',
        asks: ['Missed checkpoint', 'Door found unlocked', 'Light out — flag', 'Unbadged person', 'All clear'],
      },
      'Mid-rise round': {
        location: 'Fl 18–34',
        desc: 'Patrol round through the mid-rise floors.',
        asks: ['Missed checkpoint', 'Door found unlocked', 'Light out — flag', 'Unbadged person', 'All clear'],
      },
      'High-rise round': {
        location: 'Fl 35–50',
        desc: 'Patrol round through the high-rise floors.',
        asks: ['Missed checkpoint', 'Door found unlocked', 'Light out — flag', 'Unbadged person', 'All clear'],
      },
      'Executive floor round': {
        location: 'Fl 49–50',
        desc: 'Patrol of the executive and boardroom floors.',
        asks: ['Missed checkpoint', 'Door found unlocked', 'Sweep before board', 'Obstruction found', 'All clear'],
      },
      'Parking sweep · B1': {
        location: 'B1',
        desc: 'Patrol sweep of the upper parking level.',
        asks: ['Missed checkpoint', 'Person loitering', 'Light out — flag', 'Vehicle flagged', 'All clear'],
      },
      'Parking sweep · B2': {
        location: 'B2',
        desc: 'Patrol sweep of the lower parking level.',
        asks: ['Missed checkpoint', 'Person loitering', 'Light out — flag', 'Vehicle flagged', 'All clear'],
      },
      'Perimeter walk': {
        location: 'Ground',
        desc: 'External perimeter and forecourt patrol.',
        asks: ['Gate found open', 'Fence checked', 'Person loitering', 'Light out — flag', 'All clear'],
      },
      'Roof & plant round': {
        location: 'Fl 51 · Roof',
        desc: 'Patrol of the roof terrace and plant areas.',
        asks: ['Roof door open', 'Obstruction found', 'Hazard flagged', 'Light out — flag', 'All clear'],
      },
      'Stairwell sweep': {
        location: 'Tower-wide',
        desc: 'Sweep of the stair cores and fire doors.',
        asks: ['Door propped', 'Obstruction on stair', 'Light out — flag', 'Person found', 'All clear'],
      },
      'After-hours lockdown': {
        location: 'Tower-wide',
        desc: 'The after-hours lockdown and securing round.',
        asks: ['Door found unlocked', 'Lights left on', 'Person still in', 'Window open', 'All secure'],
      },
      'Opening & first-light check': {
        location: 'Tower-wide',
        desc: 'The morning opening and first-light walk.',
        asks: ['Overnight issue', 'Door fault', 'Damage found', 'Alarm to reset', 'All clear'],
      },
    },
  },

  // ── Security · incidents & alarms (alarm response, incident handling) ──────
  security_incidents: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Theft & property loss': {
        location: 'Tower-wide',
        desc: 'Reported theft and lost-property cases.',
        asks: ['Laptop reported stolen', 'Bag taken', 'Bike stolen · B1', 'Wallet missing', 'CCTV review needed'],
      },
      'Unauthorized access': {
        location: 'Tower-wide',
        desc: 'Access to restricted areas without authorization.',
        asks: ['Unbadged in secure area', 'Door forced', 'Tailgate to Fl 49', 'Contractor unescorted', 'Roof access'],
      },
      Tailgating: {
        location: 'L1 · Lobby',
        desc: 'Tailgating and turnstile-following at entry points.',
        asks: [
          'Tailgate at turnstile',
          'Followed through gate',
          'Repeat offender',
          'CCTV review needed',
          'Challenge made',
        ],
      },
      'Suspicious activity': {
        location: 'Tower-wide',
        desc: 'Suspicious-person and behaviour reports.',
        asks: ['Person acting oddly', 'Unattended bag', 'Filming the lobby', 'Loitering', 'Door-trying reported'],
      },
      'Medical & first aid': {
        location: 'Tower-wide',
        desc: 'Medical and first-aid response.',
        asks: ['First-aid call · Fl 22', 'Fall reported', 'Ambulance requested', 'Defib used', 'Welfare check'],
      },
      'Lost & found (security)': {
        location: 'L1 · Security',
        desc: 'Secure lost-and-found handling and returns.',
        asks: ['Found phone logged', 'Owner unknown', 'Claim verification', 'Item to store', 'Disposal due'],
      },
      'Alarm activation': {
        location: 'Tower-wide',
        desc: 'Intruder, fire and panic alarm responses.',
        asks: [
          'Intruder alarm · B2',
          'Panic button · desk',
          'Fire alarm — verify',
          'False alarm reset',
          'Zone isolated',
        ],
      },
      'Disturbance & conflict': {
        location: 'Tower-wide',
        desc: 'Disturbances, disputes and conflict response.',
        asks: ['Argument in lobby', 'Aggressive visitor', 'Noise complaint', 'Eviction support', 'Police called'],
      },
    },
  },

  // ── Security · visitor management (sign-in desks, badges, escorts) ─────────
  security_visitors: {
    handlers: SECURITY_OFFICERS,
    channels: SECURITY_CHANNELS,
    requesters: SECURITY_REPORTERS,
    items: {
      'Main visitor desk': {
        location: 'L1 · Lobby',
        desc: 'The main lobby visitor sign-in and badging desk.',
        asks: ['Unbadged visitor', 'No host on file', 'Visitor overstay', 'Watchlist match', 'Escort required'],
      },
      'Executive reception security': {
        location: 'Fl 50 · Executive',
        desc: 'Security cover for the executive-floor reception.',
        asks: ['Unbadged guest', 'Escort required', 'No host on file', 'Watchlist match', 'Hold visitor'],
      },
      'Contractor & vendor sign-in': {
        location: 'L1 · Lobby',
        desc: 'Sign-in, induction and permits for contractors.',
        asks: ['Permit missing', 'Induction not done', 'Unescorted contractor', 'ID check', 'Overstay'],
      },
      'Delivery & courier desk': {
        location: 'L1 · Mailroom',
        desc: 'Courier and delivery check-in and screening.',
        asks: ['Unscreened parcel', 'Courier ID check', 'No recipient', 'Suspicious package', 'Hold for pickup'],
      },
      'Event check-in': {
        location: 'Fl 3 · Event hall',
        desc: 'Guest check-in and access control for events.',
        asks: ['Guest not on list', 'Capacity check', 'Unbadged guest', 'Wristband control', 'Escort required'],
      },
      'After-hours visitor post': {
        location: 'L1 · Lobby',
        desc: 'After-hours visitor and access control.',
        asks: ['Late visitor', 'No host on file', 'ID check', 'Escort required', 'Access denied'],
      },
    },
  },

  // ── Maintenance · assets (the asset-health overview board) ─────────────────
  maintenance: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Chiller 1': {
        location: 'B2 · Plant',
        desc: 'Primary water-cooled chiller serving the tower.',
        asks: ['Fault alarm — BMS', 'PPM due', 'Running hot', 'Low refrigerant', 'Vendor callout'],
      },
      'Chiller 2': {
        location: 'B2 · Plant',
        desc: 'Secondary chiller for peak load and resilience.',
        asks: ['Fault alarm — BMS', 'PPM due', 'Vibration / noise', 'Won’t stage on', 'Vendor callout'],
      },
      'Cooling tower 1': {
        location: 'Fl 51 · Roof',
        desc: 'Roof cooling tower rejecting condenser heat.',
        asks: ['Fault alarm — BMS', 'PPM due', 'Water treatment', 'Fan vibration', 'Basin level low'],
      },
      'Cooling tower 2': {
        location: 'Fl 51 · Roof',
        desc: 'Second roof cooling tower.',
        asks: ['Fault alarm — BMS', 'PPM due', 'Water treatment', 'Fan vibration', 'Basin level low'],
      },
      'Boiler 1': {
        location: 'B2 · Plant',
        desc: 'Primary heating boiler.',
        asks: ['Lockout fault', 'PPM due', 'No heat · Fl 20', 'Pressure low', 'Vendor callout'],
      },
      'Boiler 2': {
        location: 'B2 · Plant',
        desc: 'Secondary heating boiler.',
        asks: ['Lockout fault', 'PPM due', 'Pressure low', 'Won’t fire', 'Vendor callout'],
      },
      'AHU · low-rise': {
        location: 'Fl 2–17 · Plant',
        desc: 'Air-handling unit serving the low-rise stack.',
        asks: ['Fault alarm — BMS', 'Filter due', 'Belt / bearing', 'No airflow', 'Damper stuck'],
      },
      'AHU · mid-rise': {
        location: 'Fl 18–34 · Plant',
        desc: 'Air-handling unit serving the mid-rise stack.',
        asks: ['Fault alarm — BMS', 'Filter due', 'Belt / bearing', 'No airflow', 'Damper stuck'],
      },
      'AHU · high-rise': {
        location: 'Fl 35–50 · Plant',
        desc: 'Air-handling unit serving the high-rise stack.',
        asks: ['Fault alarm — BMS', 'Filter due', 'Belt / bearing', 'No airflow', 'Damper stuck'],
      },
      'Primary switchboard': {
        location: 'B1 · Electrical',
        desc: 'Main LV switchboard and incomer.',
        asks: ['Breaker tripped', 'PPM due', 'Thermography flag', 'Load high — alarm', 'Vendor callout'],
      },
      'Standby generator': {
        location: 'B2 · Plant',
        desc: 'Diesel standby generator and ATS.',
        asks: ['Failed to start', 'PPM due', 'Fuel low', 'Load test due', 'Battery low'],
      },
      'UPS system': {
        location: 'B1 · Electrical',
        desc: 'Uninterruptible power supply and batteries.',
        asks: ['On battery — alarm', 'PPM due', 'Battery end-of-life', 'Bypass active', 'Vendor callout'],
      },
      'Domestic water pumps': {
        location: 'B2 · Plant',
        desc: 'Booster pumps for domestic water.',
        asks: ['Pump fault', 'PPM due', 'Low pressure · Fl 40', 'Cycling fast', 'Vendor callout'],
      },
      'Sprinkler pump set': {
        location: 'B2 · Plant',
        desc: 'Fire sprinkler and wet-riser pump set.',
        asks: ['Pump fault', 'Weekly test due', 'Pressure low', 'Alarm active', 'Vendor callout'],
      },
      'Passenger lift group': {
        location: 'Tower',
        desc: 'The passenger lift group across all banks.',
        asks: ['Lift out of service', 'Door fault', 'PPM due', 'Levelling off', 'Vendor — OTIS'],
      },
      'Service & freight lift': {
        location: 'B2–Roof',
        desc: 'The goods and service lift.',
        asks: ['Out of service', 'Door fault', 'PPM due', 'Overload trips', 'Vendor — OTIS'],
      },
      'BMS head-end': {
        location: 'L1 · BMS',
        desc: 'Building management system head-end and controllers.',
        asks: ['Comms loss', 'Sensor drift', 'PPM due', 'Schedule override', 'Point in alarm'],
      },
      'Fire alarm panel': {
        location: 'L1 · Security',
        desc: 'Addressable fire alarm control panel.',
        asks: ['Panel in fault', 'Device isolated', 'Weekly test due', 'False alarm', 'Vendor callout'],
      },
      'Sump & drainage pumps': {
        location: 'B2 · Plant',
        desc: 'Basement sump and drainage pumps.',
        asks: ['High-level alarm', 'Pump fault', 'PPM due', 'Float stuck', 'Vendor callout'],
      },
      'Hot-water calorifiers': {
        location: 'B2 · Plant',
        desc: 'Hot-water generation and storage.',
        asks: ['No hot water', 'PPM due', 'L8 temperature', 'Leak reported', 'Vendor callout'],
      },
      'Grease interceptor': {
        location: 'B1 · Kitchen',
        desc: 'Kitchen grease interceptor and drainage.',
        asks: ['Service due', 'Odour reported', 'Backing up', 'High-level alarm', 'Vendor callout'],
      },
      'Façade access cradle': {
        location: 'Fl 51 · Roof',
        desc: 'Building maintenance unit / façade cradle.',
        asks: ['Inspection due', 'Won’t track', 'Safety check', 'Cable wear', 'Vendor callout'],
      },
      'EV charging units': {
        location: 'B1 · Parking',
        desc: 'Electric-vehicle charging points.',
        asks: ['Charger offline', 'PPM due', 'Cable damaged', 'Payment fault', 'Vendor callout'],
      },
      'Building automation network': {
        location: 'Tower-wide',
        desc: 'The controls network linking plant and the BMS.',
        asks: ['Controller offline', 'Comms loss', 'PPM due', 'Firmware update', 'Sensor drift'],
      },
    },
  },

  // ── Maintenance · HVAC (heating, cooling, ventilation) ─────────────────────
  maintenance_hvac: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Chiller 1': {
        location: 'B2 · Plant',
        desc: 'Primary chiller — cooling for the tower.',
        asks: ['Fault alarm — BMS', 'No cooling', 'PPM due', 'Compressor trip', 'Low refrigerant'],
      },
      'Chiller 2': {
        location: 'B2 · Plant',
        desc: 'Secondary chiller for peak load.',
        asks: ['Fault alarm — BMS', 'Won’t stage on', 'PPM due', 'Vibration / noise', 'Vendor callout'],
      },
      'Cooling tower 1': {
        location: 'Fl 51 · Roof',
        desc: 'Roof cooling tower.',
        asks: ['Fault alarm — BMS', 'Water treatment', 'Fan vibration', 'PPM due', 'Basin level low'],
      },
      'Cooling tower 2': {
        location: 'Fl 51 · Roof',
        desc: 'Second roof cooling tower.',
        asks: ['Fault alarm — BMS', 'Water treatment', 'Fan vibration', 'PPM due', 'Basin level low'],
      },
      'AHU-01 · low-rise': {
        location: 'Fl 2–17 · Plant',
        desc: 'Air-handling unit for the low-rise floors.',
        asks: ['Filter due', 'Too warm · Fl 12', 'Belt / bearing', 'Damper stuck', 'Fault alarm — BMS'],
      },
      'AHU-02 · mid-rise': {
        location: 'Fl 18–34 · Plant',
        desc: 'Air-handling unit for the mid-rise floors.',
        asks: ['Filter due', 'Too warm · Fl 22', 'Belt / bearing', 'Damper stuck', 'Fault alarm — BMS'],
      },
      'AHU-03 · high-rise': {
        location: 'Fl 35–50 · Plant',
        desc: 'Air-handling unit for the high-rise floors.',
        asks: ['Filter due', 'Too cold · Fl 44', 'Belt / bearing', 'Damper stuck', 'Fault alarm — BMS'],
      },
      'Boiler 1': {
        location: 'B2 · Plant',
        desc: 'Primary heating boiler.',
        asks: ['Lockout fault', 'No heat · Fl 20', 'PPM due', 'Pressure low', 'Vendor callout'],
      },
      'Boiler 2': {
        location: 'B2 · Plant',
        desc: 'Secondary heating boiler.',
        asks: ['Lockout fault', 'Won’t fire', 'PPM due', 'Pressure low', 'Vendor callout'],
      },
      'FCUs · low-rise': {
        location: 'Fl 2–17',
        desc: 'Fan-coil units across the low-rise floors.',
        asks: ['Too warm · Fl 8', 'Noisy unit', 'Filter due', 'Valve stuck', 'No cooling'],
      },
      'FCUs · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Fan-coil units across the mid-rise floors.',
        asks: ['Too warm · Fl 26', 'Noisy unit', 'Filter due', 'Valve stuck', 'Condensate leak'],
      },
      'FCUs · high-rise': {
        location: 'Fl 35–50',
        desc: 'Fan-coil units across the high-rise floors.',
        asks: ['Too cold · Fl 40', 'Noisy unit', 'Filter due', 'Valve stuck', 'Condensate leak'],
      },
      'VAV boxes · tower': {
        location: 'Tower-wide',
        desc: 'Variable-air-volume terminal boxes.',
        asks: ['Box not modulating', 'Too warm', 'Actuator fault', 'PPM due', 'Reheat fault'],
      },
      'Server-room CRAC': {
        location: 'Tower-wide',
        desc: 'Precision cooling for server and comms rooms.',
        asks: ['High-temp alarm', 'Unit fault', 'PPM due', 'Condensate full', 'Vendor callout'],
      },
      'Kitchen make-up air': {
        location: 'Fl 2',
        desc: 'Make-up air and extract for the kitchen.',
        asks: ['Extract weak', 'Filter due', 'Fan fault', 'Odour lingering', 'Balance check'],
      },
      'Executive-floor VRF': {
        location: 'Fl 49–50',
        desc: 'VRF system serving the executive floors.',
        asks: ['Too warm — board', 'Unit fault', 'PPM due', 'Refrigerant alarm', 'Noisy unit'],
      },
      'Pumps & pipework': {
        location: 'B2 · Plant',
        desc: 'Heating/chilled-water pumps and pipework.',
        asks: ['Pump fault', 'Leak reported', 'PPM due', 'Pressure low', 'Vibration / noise'],
      },
      'BMS HVAC controls': {
        location: 'Tower-wide',
        desc: 'BMS control of the HVAC plant.',
        asks: ['Sensor drift', 'Schedule override', 'Point in alarm', 'Comms loss', 'Tuning needed'],
      },
    },
  },

  // ── Maintenance · electrical (lighting, power, panels) ─────────────────────
  maintenance_electrical: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Primary switchboard': {
        location: 'B1 · Electrical',
        desc: 'Main LV switchboard and incomer.',
        asks: ['Breaker tripped', 'Thermography flag', 'PPM due', 'Load high — alarm', 'Vendor callout'],
      },
      'Standby generator': {
        location: 'B2 · Plant',
        desc: 'Diesel standby generator and ATS.',
        asks: ['Failed to start', 'Load test due', 'Fuel low', 'Battery low', 'PPM due'],
      },
      'UPS system': {
        location: 'B1 · Electrical',
        desc: 'UPS and battery bank.',
        asks: ['On battery — alarm', 'Battery end-of-life', 'Bypass active', 'PPM due', 'Vendor callout'],
      },
      'Distribution board · low-rise': {
        location: 'Fl 2–17 · Riser',
        desc: 'Floor distribution boards across the low-rise.',
        asks: ['Breaker tripped', 'Circuit out · Fl 9', 'PPM due', 'Thermography flag', 'Label / test'],
      },
      'Distribution board · mid-rise': {
        location: 'Fl 18–34 · Riser',
        desc: 'Floor distribution boards across the mid-rise.',
        asks: ['Breaker tripped', 'Circuit out · Fl 24', 'PPM due', 'Thermography flag', 'Label / test'],
      },
      'Distribution board · high-rise': {
        location: 'Fl 35–50 · Riser',
        desc: 'Floor distribution boards across the high-rise.',
        asks: ['Breaker tripped', 'Circuit out · Fl 44', 'PPM due', 'Thermography flag', 'Label / test'],
      },
      'Lighting control system': {
        location: 'Tower-wide',
        desc: 'Addressable lighting control and scenes.',
        asks: ['Zone won’t switch', 'Scene wrong', 'Sensor fault', 'PPM due', 'Comms loss'],
      },
      'Emergency lighting': {
        location: 'Tower-wide',
        desc: 'Emergency and escape lighting.',
        asks: ['Monthly test due', 'Fitting failed', 'Battery fault', 'Annual test', 'Certificate due'],
      },
      'EV charging units': {
        location: 'B1 · Parking',
        desc: 'EV charge points and supply.',
        asks: ['Charger offline', 'Cable damaged', 'Payment fault', 'PPM due', 'Breaker tripped'],
      },
      'Power factor correction': {
        location: 'B1 · Electrical',
        desc: 'PFC capacitor bank.',
        asks: ['Stage fault', 'PPM due', 'Capacitor failed', 'Harmonics flag', 'Vendor callout'],
      },
      'Sub-metering & monitoring': {
        location: 'Tower-wide',
        desc: 'Energy sub-metering and monitoring.',
        asks: ['Meter offline', 'Reading gap', 'Comms loss', 'Calibration due', 'Data mismatch'],
      },
      'Lobby & façade lighting': {
        location: 'L1',
        desc: 'Feature lighting at the lobby and façade.',
        asks: ['Lamp out', 'Scene wrong', 'Timer off', 'Driver fault', 'PPM due'],
      },
      'Riser busbars': {
        location: 'Tower-wide',
        desc: 'Rising busbar distribution.',
        asks: ['Thermography flag', 'Tap-off fault', 'PPM due', 'Joint check', 'Load high'],
      },
      'Generator fuel & ATS': {
        location: 'B2 · Plant',
        desc: 'Generator fuel system and automatic transfer.',
        asks: ['Fuel low', 'ATS fault', 'Failed transfer', 'PPM due', 'Leak check'],
      },
    },
  },

  // ── Maintenance · plumbing (fixtures, leaks, water systems) ────────────────
  maintenance_plumbing: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Domestic water pumps': {
        location: 'B2 · Plant',
        desc: 'Booster pumps for domestic water.',
        asks: ['Pump fault', 'Low pressure · Fl 40', 'Cycling fast', 'PPM due', 'Leak reported'],
      },
      'Hot-water calorifiers': {
        location: 'B2 · Plant',
        desc: 'Hot-water generation and storage.',
        asks: ['No hot water', 'L8 temperature', 'Leak reported', 'PPM due', 'TMV fault'],
      },
      'Booster set': {
        location: 'B2 · Plant',
        desc: 'Pressure booster set for the upper floors.',
        asks: ['Low pressure', 'Pump fault', 'Cycling fast', 'PPM due', 'Vessel waterlogged'],
      },
      'Restroom fixtures · low-rise': {
        location: 'Fl 2–17',
        desc: 'WCs, basins and urinals on the low-rise floors.',
        asks: ['Leak · Fl 8', 'Blocked WC', 'Tap dripping', 'Flush fault', 'No hot water'],
      },
      'Restroom fixtures · mid-rise': {
        location: 'Fl 18–34',
        desc: 'WCs, basins and urinals on the mid-rise floors.',
        asks: ['Leak · Fl 24', 'Blocked WC', 'Tap dripping', 'Flush fault', 'No hot water'],
      },
      'Restroom fixtures · high-rise': {
        location: 'Fl 35–50',
        desc: 'WCs, basins and urinals on the high-rise floors.',
        asks: ['Leak · Fl 44', 'Blocked WC', 'Tap dripping', 'Flush fault', 'No hot water'],
      },
      'Kitchen plumbing': {
        location: 'Fl 2',
        desc: 'Cafeteria kitchen supply and drainage.',
        asks: ['Drain blocked', 'Leak under sink', 'No hot water', 'Dishwasher supply', 'Grease backup'],
      },
      'Grease interceptor': {
        location: 'B1 · Kitchen',
        desc: 'Kitchen grease interceptor.',
        asks: ['Service due', 'Backing up', 'Odour reported', 'High-level alarm', 'Vendor callout'],
      },
      'Sump & drainage pumps': {
        location: 'B2 · Plant',
        desc: 'Basement sump and drainage pumps.',
        asks: ['High-level alarm', 'Pump fault', 'Float stuck', 'PPM due', 'Backflow check'],
      },
      'Rainwater / storm drains': {
        location: 'Roof / B2',
        desc: 'Rainwater outlets and storm drainage.',
        asks: ['Outlet blocked', 'Overflow · Fl 51', 'Gully blocked', 'Leak ingress', 'Inspection due'],
      },
      'Cold-water storage tanks': {
        location: 'Fl 51 · Roof',
        desc: 'Roof cold-water storage tanks.',
        asks: ['Level low', 'L8 inspection', 'Ball-valve fault', 'Leak reported', 'Clean & chlorinate'],
      },
      'Pantry sinks & supplies': {
        location: 'Tower-wide',
        desc: 'Pantry sinks, taps and supplies.',
        asks: ['Tap dripping', 'Blocked sink', 'Leak under sink', 'No hot water', 'Filter change'],
      },
      'Sprinkler & wet riser': {
        location: 'Tower-wide',
        desc: 'Sprinkler pipework and wet risers.',
        asks: ['Leak on riser', 'Low pressure', 'Test due', 'Valve fault', 'Vendor callout'],
      },
      'Water leak detection': {
        location: 'Tower-wide',
        desc: 'Leak-detection sensors and shutoffs.',
        asks: ['Leak alarm · Fl 30', 'Sensor fault', 'Shutoff tripped', 'PPM due', 'Comms loss'],
      },
      'Backflow preventers': {
        location: 'B1 · Plant',
        desc: 'Backflow prevention devices.',
        asks: ['Annual test due', 'Device fault', 'Pressure drop', 'Leak reported', 'Vendor callout'],
      },
      'Irrigation system': {
        location: 'Ground · Grounds',
        desc: 'Landscape irrigation supply and controls.',
        asks: ['Leak in line', 'Zone won’t run', 'Controller fault', 'Pressure low', 'Winterize'],
      },
    },
  },

  // ── Maintenance · elevators & lifts (cars, controllers, safety) ────────────
  maintenance_elevators: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Low-rise lift 1': {
        location: 'Fl 1–17',
        desc: 'Low-rise passenger lift.',
        asks: ['Out of service', 'Door fault', 'Levelling off', 'PPM due', 'Vendor — OTIS'],
      },
      'Low-rise lift 2': {
        location: 'Fl 1–17',
        desc: 'Low-rise passenger lift.',
        asks: ['Out of service', 'Door fault', 'Stuck — entrapment', 'PPM due', 'Vendor — OTIS'],
      },
      'Mid-rise lift 1': {
        location: 'Fl 18–34',
        desc: 'Mid-rise passenger lift.',
        asks: ['Out of service', 'Door fault', 'Levelling off', 'PPM due', 'Vendor — OTIS'],
      },
      'Mid-rise lift 2': {
        location: 'Fl 18–34',
        desc: 'Mid-rise passenger lift.',
        asks: ['Out of service', 'Ride rough', 'Door fault', 'PPM due', 'Vendor — OTIS'],
      },
      'High-rise lift 1': {
        location: 'Fl 35–50',
        desc: 'High-rise passenger lift.',
        asks: ['Out of service', 'Door fault', 'Levelling off', 'PPM due', 'Vendor — OTIS'],
      },
      'High-rise lift 2': {
        location: 'Fl 35–50',
        desc: 'High-rise passenger lift.',
        asks: ['Out of service', 'Ride rough', 'Door fault', 'PPM due', 'Vendor — OTIS'],
      },
      'Executive elevator': {
        location: 'Fl 1 / 49–50',
        desc: 'Express car to the executive floors.',
        asks: ['Out of service', 'Door fault', 'PPM due', 'Levelling off', 'Sweep before board'],
      },
      'Service & freight lift': {
        location: 'B2–Roof',
        desc: 'Goods and service lift.',
        asks: ['Out of service', 'Overload trips', 'Door fault', 'PPM due', 'Vendor — OTIS'],
      },
    },
  },

  // ── Maintenance · building envelope (roof, façade, doors, seals) ───────────
  maintenance_envelope: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Roof membrane & flashing': {
        location: 'Fl 51 · Roof',
        desc: 'Roof waterproofing membrane and flashings.',
        asks: ['Water ingress', 'Membrane blistered', 'Flashing loose', 'Inspection due', 'Ponding water'],
      },
      'Façade · low-rise': {
        location: 'Fl 2–17 · Exterior',
        desc: 'Curtain-wall façade across the low-rise.',
        asks: ['Sealant failed', 'Panel loose', 'Water ingress', 'Inspection due', 'Gasket perished'],
      },
      'Façade · mid-rise': {
        location: 'Fl 18–34 · Exterior',
        desc: 'Curtain-wall façade across the mid-rise.',
        asks: ['Sealant failed', 'Panel loose', 'Water ingress · Fl 30', 'Inspection due', 'Gasket perished'],
      },
      'Façade · high-rise': {
        location: 'Fl 35–50 · Exterior',
        desc: 'Curtain-wall façade across the high-rise.',
        asks: ['Sealant failed', 'Panel loose', 'Water ingress', 'Inspection due', 'Gasket perished'],
      },
      'Windows & seals': {
        location: 'Tower-wide',
        desc: 'Window units, gaskets and seals.',
        asks: ['Draught reported', 'Seal failed', 'Glazing cracked', 'Won’t close', 'Condensation in unit'],
      },
      'Entrance doors & glazing': {
        location: 'L1',
        desc: 'Automatic entrance doors and glazing.',
        asks: ['Door won’t close', 'Sensor fault', 'Glazing cracked', 'Drags / sticks', 'PPM due'],
      },
      'Expansion joints': {
        location: 'Tower-wide',
        desc: 'Movement and expansion joints.',
        asks: ['Joint failed', 'Water ingress', 'Cover loose', 'Inspection due', 'Sealant gone'],
      },
      'External cladding': {
        location: 'Exterior',
        desc: 'External cladding and rainscreen.',
        asks: ['Panel loose', 'Fixing failed', 'Staining', 'Inspection due', 'Impact damage'],
      },
      'Roof drainage & gutters': {
        location: 'Fl 51 · Roof',
        desc: 'Roof gutters, outlets and drainage.',
        asks: ['Gutter blocked', 'Outlet blocked', 'Overflow', 'Leaf debris', 'Inspection due'],
      },
      'Basement waterproofing': {
        location: 'B2',
        desc: 'Basement tanking and waterproofing.',
        asks: ['Damp patch', 'Water ingress', 'Sump linked', 'Inspection due', 'Crack monitoring'],
      },
    },
  },

  // ── Maintenance · grounds & landscaping (exterior, irrigation, planting) ───
  maintenance_grounds: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Forecourt & plaza': {
        location: 'Ground · Plaza',
        desc: 'The forecourt and public plaza hardstanding.',
        asks: ['Paving damaged', 'Trip hazard', 'Weeds in joints', 'Stain / spill', 'Furniture loose'],
      },
      'Main entrance landscaping': {
        location: 'L1 · Entrance',
        desc: 'Planting and greenery at the main entrance.',
        asks: ['Tidy planting', 'Plant dying', 'Irrigation fault', 'Litter / leaves', 'Seasonal swap'],
      },
      'Planters & beds': {
        location: 'Ground',
        desc: 'Planters and garden beds around the site.',
        asks: ['Weeding due', 'Plant dying', 'Top-up mulch', 'Pest on plant', 'Irrigation fault'],
      },
      'Lawn & green areas': {
        location: 'Ground',
        desc: 'Lawns and soft landscaping.',
        asks: ['Mowing due', 'Bare patch', 'Edging due', 'Waterlogged', 'Weed treatment'],
      },
      'Trees & shrubs': {
        location: 'Ground',
        desc: 'Trees, hedges and shrubs.',
        asks: ['Pruning due', 'Branch hazard', 'Pest / disease', 'Stake loose', 'Inspection due'],
      },
      'Irrigation system': {
        location: 'Ground',
        desc: 'Landscape irrigation and controls.',
        asks: ['Irrigation fault', 'Zone won’t run', 'Leak in line', 'Controller fault', 'Winterize'],
      },
      'Car park surfaces': {
        location: 'B1–B2',
        desc: 'Parking deck surfaces and line markings.',
        asks: ['Pothole', 'Line markings faded', 'Oil staining', 'Drain blocked', 'Sign damaged'],
      },
      'External lighting': {
        location: 'Ground',
        desc: 'External and landscape lighting.',
        asks: ['Light out', 'Timer / sensor', 'Bollard damaged', 'Cable fault', 'PPM due'],
      },
      'Pathways & steps': {
        location: 'Ground',
        desc: 'External paths, steps and ramps.',
        asks: ['Trip hazard', 'Moss / slippery', 'Handrail loose', 'Paving lifted', 'Litter / leaves'],
      },
      'Roof terrace planting': {
        location: 'Fl 51 · Roof',
        desc: 'Planting and greenery on the roof terrace.',
        asks: ['Watering due', 'Plant dying', 'Wind damage', 'Irrigation fault', 'Tidy beds'],
      },
      'Drainage & gullies': {
        location: 'Ground',
        desc: 'External drainage channels and gullies.',
        asks: ['Gully blocked', 'Standing water', 'Leaf debris', 'Cover loose', 'Inspection due'],
      },
      'Bike racks & furniture': {
        location: 'Ground',
        desc: 'External bike racks, benches and bins.',
        asks: ['Rack damaged', 'Bench loose', 'Bin damaged', 'Repaint due', 'Graffiti'],
      },
    },
  },

  // ── Maintenance · preventive maintenance (scheduled PM tasks) ──────────────
  maintenance_pm: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'HVAC filter changes': {
        location: 'Tower-wide',
        desc: 'Scheduled AHU/FCU filter changes.',
        asks: ['PPM due this week', 'Overdue task', 'Stock filters', 'Reschedule visit', 'Sign off'],
      },
      'Chiller annual service': {
        location: 'B2 · Plant',
        desc: 'Annual chiller service by the vendor.',
        asks: ['Service due', 'Vendor booked', 'Reschedule visit', 'Parts on order', 'Certificate due'],
      },
      'Boiler service': {
        location: 'B2 · Plant',
        desc: 'Annual boiler service and certification.',
        asks: ['Service due', 'Vendor booked', 'Gas safety cert', 'Reschedule visit', 'Overdue task'],
      },
      'Generator load test': {
        location: 'B2 · Plant',
        desc: 'Periodic generator load and run test.',
        asks: ['Load test due', 'Fuel top-up', 'Reschedule visit', 'Overdue task', 'Sign off'],
      },
      'Fire alarm test': {
        location: 'Tower-wide',
        desc: 'Weekly and periodic fire alarm tests.',
        asks: ['Weekly test due', 'Overdue task', 'Zone to test', 'Log results', 'Certificate due'],
      },
      'Sprinkler inspection': {
        location: 'Tower-wide',
        desc: 'Sprinkler and wet-riser inspections.',
        asks: ['Inspection due', 'Vendor booked', 'Overdue task', 'Valve check', 'Certificate due'],
      },
      'Lift maintenance': {
        location: 'Tower-wide',
        desc: 'Scheduled lift maintenance visits.',
        asks: ['PPM due', 'Vendor — OTIS', 'Reschedule visit', 'Overdue task', 'LOLER due'],
      },
      'Emergency lighting test': {
        location: 'Tower-wide',
        desc: 'Monthly and annual emergency-lighting tests.',
        asks: ['Monthly test due', 'Annual test', 'Overdue task', 'Failed fitting', 'Certificate due'],
      },
      'Water hygiene / L8': {
        location: 'Tower-wide',
        desc: 'Legionella / water-hygiene monitoring.',
        asks: ['Temps due', 'Tank inspection', 'Overdue task', 'Sample results', 'Flush dead-legs'],
      },
      'Electrical thermography': {
        location: 'Tower-wide',
        desc: 'Thermographic survey of electrical assets.',
        asks: ['Survey due', 'Vendor booked', 'Hotspot flagged', 'Reschedule visit', 'Report due'],
      },
      'BMS health check': {
        location: 'Tower-wide',
        desc: 'Periodic BMS health and point check.',
        asks: ['Health check due', 'Points in alarm', 'Sensor drift', 'Overdue task', 'Report due'],
      },
      'Pump servicing': {
        location: 'B2 · Plant',
        desc: 'Scheduled servicing of pump sets.',
        asks: ['Service due', 'Seal kit needed', 'Reschedule visit', 'Overdue task', 'Vibration check'],
      },
      'Drainage flush': {
        location: 'Tower-wide',
        desc: 'Planned drainage and gully flushing.',
        asks: ['Flush due', 'Vendor booked', 'Overdue task', 'Blockage history', 'Sign off'],
      },
      'Façade inspection': {
        location: 'Exterior',
        desc: 'Periodic façade condition inspection.',
        asks: ['Inspection due', 'Access booked', 'Defect flagged', 'Report due', 'Reschedule visit'],
      },
      'Roof inspection': {
        location: 'Fl 51 · Roof',
        desc: 'Roof condition and drainage inspection.',
        asks: ['Inspection due', 'Clear debris', 'Defect flagged', 'Report due', 'Overdue task'],
      },
      'Backup battery test': {
        location: 'Tower-wide',
        desc: 'UPS and standby battery testing.',
        asks: ['Test due', 'Battery flagged', 'Reschedule visit', 'Overdue task', 'Replace due'],
      },
      'Grease trap service': {
        location: 'B1 · Kitchen',
        desc: 'Scheduled grease-trap pump-out.',
        asks: ['Service due', 'Vendor booked', 'Odour reported', 'Overdue task', 'Manifest due'],
      },
      'Lightning protection test': {
        location: 'Fl 51 · Roof',
        desc: 'Lightning protection system test.',
        asks: ['Test due', 'Vendor booked', 'Continuity flagged', 'Certificate due', 'Reschedule visit'],
      },
      'Door & hardware service': {
        location: 'Tower-wide',
        desc: 'Servicing of doors, closers and hardware.',
        asks: ['Service due', 'Closer faulty', 'Overdue task', 'Hinge / lock', 'Sign off'],
      },
      'Pest control visit': {
        location: 'Tower-wide',
        desc: 'Scheduled pest-control inspection and treatment.',
        asks: ['Visit due', 'Sighting reported', 'Bait check', 'Overdue task', 'Report due'],
      },
    },
  },

  // ── Maintenance · fire & life safety (alarms, sprinklers, extinguishers) ───
  maintenance_firesafety: {
    handlers: MAINT_TECHS,
    channels: MAINT_CHANNELS,
    requesters: MAINT_REPORTERS,
    items: {
      'Fire alarm panel': {
        location: 'L1 · Security',
        desc: 'Addressable fire alarm control panel.',
        asks: ['Panel in fault', 'Device isolated', 'Weekly test due', 'False alarm', 'Vendor callout'],
      },
      'Smoke detectors · low-rise': {
        location: 'Fl 2–17',
        desc: 'Smoke and heat detectors across the low-rise.',
        asks: ['Detector fault', 'Head dirty', 'Test due', 'Nuisance alarm', 'Isolated device'],
      },
      'Smoke detectors · mid-rise': {
        location: 'Fl 18–34',
        desc: 'Smoke and heat detectors across the mid-rise.',
        asks: ['Detector fault', 'Head dirty', 'Test due', 'Nuisance alarm', 'Isolated device'],
      },
      'Smoke detectors · high-rise': {
        location: 'Fl 35–50',
        desc: 'Smoke and heat detectors across the high-rise.',
        asks: ['Detector fault', 'Head dirty', 'Test due', 'Nuisance alarm', 'Isolated device'],
      },
      'Sprinkler system': {
        location: 'Tower-wide',
        desc: 'Sprinkler heads, pipework and valves.',
        asks: ['Head damaged', 'Valve fault', 'Test due', 'Leak on system', 'Inspection due'],
      },
      'Wet riser & hydrants': {
        location: 'Tower-wide',
        desc: 'Wet risers, landing valves and hydrants.',
        asks: ['Pressure test due', 'Valve fault', 'Leak reported', 'Access blocked', 'Inspection due'],
      },
      'Fire extinguishers': {
        location: 'Tower-wide',
        desc: 'Portable extinguishers across the building.',
        asks: ['Extinguisher expired', 'Missing unit', 'Service due', 'Seal broken', 'Wrong location'],
      },
      'Emergency lighting': {
        location: 'Tower-wide',
        desc: 'Emergency and escape lighting (fire scope).',
        asks: ['Monthly test due', 'Fitting failed', 'Battery fault', 'Annual test', 'Certificate due'],
      },
      'Fire doors': {
        location: 'Tower-wide',
        desc: 'Fire-rated doors, closers and seals.',
        asks: ['Won’t self-close', 'Held open', 'Seal damaged', 'Gap too large', 'Inspection due'],
      },
      'Smoke ventilation': {
        location: 'Tower-wide',
        desc: 'Smoke control and ventilation system.',
        asks: ['Damper fault', 'Fan fault', 'Test due', 'Control fault', 'Inspection due'],
      },
      'Sprinkler pump set': {
        location: 'B2 · Plant',
        desc: 'Sprinkler and wet-riser pump set.',
        asks: ['Pump fault', 'Weekly test due', 'Pressure low', 'Alarm active', 'Vendor callout'],
      },
      'Fire dampers': {
        location: 'Tower-wide',
        desc: 'Fire and smoke dampers in ductwork.',
        asks: ['Drop test due', 'Damper stuck', 'Actuator fault', 'Access needed', 'Inspection due'],
      },
      'Exit signage': {
        location: 'Tower-wide',
        desc: 'Illuminated exit and wayfinding signage.',
        asks: ['Sign out', 'Battery fault', 'Obstructed', 'Test due', 'Missing sign'],
      },
      'Refuge call points': {
        location: 'Tower-wide',
        desc: 'Refuge points and emergency voice comms.',
        asks: ['Point fault', 'Comms test due', 'No response', 'Battery fault', 'Inspection due'],
      },
      'Gas suppression · server room': {
        location: 'Tower-wide',
        desc: 'Gas suppression for server and comms rooms.',
        asks: ['System fault', 'Cylinder pressure', 'Test due', 'Isolated', 'Vendor callout'],
      },
      'Evacuation alarm test': {
        location: 'Tower-wide',
        desc: 'Periodic full evacuation and alarm test.',
        asks: ['Test due', 'Coordinate floors', 'Log results', 'Faulty sounder', 'Overdue task'],
      },
    },
  },
};
