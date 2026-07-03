// Generic SERVICING board — Security / Hospitality / Maintenance. One component
// parameterised by `domain`; the data is the org-scoped demo_servicing fixture
// (servicing-data.js). Mirrors the Restroom board's shape (stat strip + perf
// strip + urgency worklist) so the whole SERVICING group reads coherently.
// Gated to real_estate orgs; orgs without a fixture get a clean empty state.

import React, { useState } from 'react';
import { Card, Pill, Sparkline } from './primitives.jsx';
import { Icon } from './icons.jsx';
import { useActiveOrg } from './org-data.js';
import {
  useServicingState,
  useServicingPerf,
  useServicingHistory,
  useServicingSlaTargets,
  setServicingSlaTarget,
  useServicingRoute,
  sortByUrgency,
  synthTrend,
  resolveServicingItem,
} from './servicing-data.js';
import { domainAccent, domainSoft, topDomainOf } from './servicing-areas.js';
import { contentFor, buildRequests } from './servicing-content.js';
import { createManualTicket } from './tickets-data.js';
import { useLanguage } from './i18n.js';
import { useSL } from './servicing-i18n.js';

// Per-domain copy. `sla` is only for the description line; the actual overdue
// threshold is the per-row sla_hours from the fixture.
const DOMAIN = {
  security: {
    eyebrow: 'Live security',
    title: 'Security board',
    icon: 'security',
    blurb: 'patrol rounds, access events, and open incidents',
    overdueLabel: 'rounds overdue',
    openLabel: 'open incidents',
    perfTitle: 'Security performance',
    servedLabel: 'zones patrolled',
    requestsLabel: 'incidents',
    trafficLabel: 'access events',
    actionWord: 'patrol',
  },
  maintenance: {
    eyebrow: 'Live maintenance',
    title: 'Maintenance board',
    icon: 'cog',
    blurb: 'asset health, runtime, and open faults',
    overdueLabel: 'PM overdue',
    openLabel: 'open faults',
    perfTitle: 'Maintenance performance',
    servedLabel: 'assets serviced',
    requestsLabel: 'faults',
    trafficLabel: 'runtime hrs',
    actionWord: 'service',
  },
  hospitality: {
    eyebrow: 'Live hospitality',
    title: 'Hospitality board',
    icon: 'hospitality',
    blurb: 'guest services, occupancy, and open requests',
    overdueLabel: 'requests aging',
    openLabel: 'open requests',
    perfTitle: 'Hospitality performance',
    servedLabel: 'points serviced',
    requestsLabel: 'requests',
    trafficLabel: 'guests',
    actionWord: 'service',
  },
  // Cleaning areas (under the Cleaning sub-group; Bathrooms is the RestroomBoard).
  cleaning_common: {
    eyebrow: 'Live cleaning',
    title: 'Common areas',
    icon: 'building',
    blurb: 'lobbies, corridors, elevators, and reception',
    overdueLabel: 'areas overdue',
    openLabel: 'open requests',
    perfTitle: 'Common-area cleaning',
    servedLabel: 'areas cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'clean',
  },
  cleaning_floors: {
    eyebrow: 'Live cleaning',
    title: 'Floors & carpets',
    icon: 'grid',
    blurb: 'mopping, vacuuming, polishing, and carpet care',
    overdueLabel: 'zones overdue',
    openLabel: 'spot requests',
    perfTitle: 'Floor cleaning',
    servedLabel: 'zones cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'clean',
  },
  cleaning_kitchens: {
    eyebrow: 'Live cleaning',
    title: 'Kitchens & pantries',
    icon: 'sparkle',
    blurb: 'breakrooms, coffee points, fridges, and dishwashing',
    overdueLabel: 'pantries overdue',
    openLabel: 'open requests',
    perfTitle: 'Kitchen cleaning',
    servedLabel: 'pantries cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'uses',
    actionWord: 'clean',
  },
  cleaning_waste: {
    eyebrow: 'Live cleaning',
    title: 'Waste & recycling',
    icon: 'ship',
    blurb: 'bins, waste rooms, and collection rounds',
    overdueLabel: 'pickups overdue',
    openLabel: 'overflow alerts',
    perfTitle: 'Waste collection',
    servedLabel: 'bins serviced',
    requestsLabel: 'alerts',
    trafficLabel: 'kg collected',
    actionWord: 'empty',
  },
  cleaning_disinfection: {
    eyebrow: 'Live cleaning',
    title: 'Disinfection',
    icon: 'shield',
    blurb: 'high-touch surfaces — handles, buttons, shared controls',
    overdueLabel: 'surfaces overdue',
    openLabel: 'flagged',
    perfTitle: 'Disinfection',
    servedLabel: 'surfaces treated',
    requestsLabel: 'flags',
    trafficLabel: 'touches',
    actionWord: 'sanitize',
  },
  cleaning_supplies: {
    eyebrow: 'Live cleaning',
    title: 'Supplies & consumables',
    icon: 'cart',
    blurb: 'soap, paper, and sanitizer levels across dispensers',
    overdueLabel: 'low / empty',
    openLabel: 'stockouts',
    perfTitle: 'Supplies',
    servedLabel: 'points restocked',
    requestsLabel: 'refills',
    trafficLabel: 'dispenses',
    actionWord: 'restock',
  },
  cleaning_windows: {
    eyebrow: 'Live cleaning',
    title: 'Windows & glass',
    icon: 'grid',
    blurb: 'interior partitions, mirrors, and façade glass',
    overdueLabel: 'panes overdue',
    openLabel: 'smudge flags',
    perfTitle: 'Window cleaning',
    servedLabel: 'panes cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'clean',
  },
  cleaning_workspaces: {
    eyebrow: 'Live cleaning',
    title: 'Workspaces & desks',
    icon: 'people',
    blurb: 'desks, meeting-room resets, and clear-desk turnover',
    overdueLabel: 'zones overdue',
    openLabel: 'reset requests',
    perfTitle: 'Workspace cleaning',
    servedLabel: 'zones reset',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'reset',
  },
  cleaning_exterior: {
    eyebrow: 'Live cleaning',
    title: 'Exterior & entrances',
    icon: 'building',
    blurb: 'entrance mats, façade, walkways, and outdoor seating',
    overdueLabel: 'areas overdue',
    openLabel: 'open requests',
    perfTitle: 'Exterior cleaning',
    servedLabel: 'areas cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'clean',
  },
  cleaning_elevators: {
    eyebrow: 'Live cleaning',
    title: 'Elevators & escalators',
    icon: 'ship',
    blurb: 'cars, landings, and handrails — high-touch vertical circulation',
    overdueLabel: 'cars overdue',
    openLabel: 'open requests',
    perfTitle: 'Elevator cleaning',
    servedLabel: 'cars cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'rides',
    actionWord: 'clean',
  },
  cleaning_vents: {
    eyebrow: 'Live cleaning',
    title: 'Air vents & filters',
    icon: 'bolt',
    blurb: 'vent cleaning and filter changes — air quality',
    overdueLabel: 'filters overdue',
    openLabel: 'flags',
    perfTitle: 'Vent & filter service',
    servedLabel: 'vents serviced',
    requestsLabel: 'flags',
    trafficLabel: 'airflow',
    actionWord: 'service',
  },
  cleaning_deep: {
    eyebrow: 'Live cleaning',
    title: 'Deep & specialty',
    icon: 'sparkle',
    blurb: 'scheduled deep cleans, post-event, and post-construction',
    overdueLabel: 'jobs overdue',
    openLabel: 'open requests',
    perfTitle: 'Deep cleaning',
    servedLabel: 'jobs done',
    requestsLabel: 'requests',
    trafficLabel: 'sq ft',
    actionWord: 'deep-clean',
  },
  cleaning_stairwells: {
    eyebrow: 'Live cleaning',
    title: 'Stairwells',
    icon: 'floor',
    blurb: 'treads, handrails, and landings',
    overdueLabel: 'stairs overdue',
    openLabel: 'open requests',
    perfTitle: 'Stairwell cleaning',
    servedLabel: 'stairs cleaned',
    requestsLabel: 'requests',
    trafficLabel: 'footfall',
    actionWord: 'clean',
  },
  cleaning_laundry: {
    eyebrow: 'Live cleaning',
    title: 'Laundry & linen',
    icon: 'droplet',
    blurb: 'towels, mats, and uniforms',
    overdueLabel: 'batches overdue',
    openLabel: 'open requests',
    perfTitle: 'Laundry',
    servedLabel: 'batches done',
    requestsLabel: 'requests',
    trafficLabel: 'items',
    actionWord: 'process',
  },
  // ── Security
  security_access: {
    eyebrow: 'Live security',
    title: 'Access control',
    icon: 'badge',
    blurb: 'doors, badge readers, and turnstiles',
    overdueLabel: 'doors flagged',
    openLabel: 'forced / held',
    perfTitle: 'Access control',
    servedLabel: 'doors checked',
    requestsLabel: 'alerts',
    trafficLabel: 'entries',
    actionWord: 'check',
  },
  security_visitors: {
    eyebrow: 'Live security',
    title: 'Visitor management',
    icon: 'people',
    blurb: 'sign-in desks, badges, and escorts',
    overdueLabel: 'desks overdue',
    openLabel: 'waiting',
    perfTitle: 'Visitor management',
    servedLabel: 'desks staffed',
    requestsLabel: 'visitors',
    trafficLabel: 'visitors',
    actionWord: 'process',
  },
  security_cctv: {
    eyebrow: 'Live security',
    title: 'Surveillance',
    icon: 'beacon',
    blurb: 'camera coverage and monitoring',
    overdueLabel: 'cameras down',
    openLabel: 'alerts',
    perfTitle: 'Surveillance',
    servedLabel: 'cameras up',
    requestsLabel: 'alerts',
    trafficLabel: 'events',
    actionWord: 'check',
  },
  security_perimeter: {
    eyebrow: 'Live security',
    title: 'Perimeter',
    icon: 'gateway',
    blurb: 'fences, gates, and loading docks',
    overdueLabel: 'points overdue',
    openLabel: 'breaches',
    perfTitle: 'Perimeter',
    servedLabel: 'points checked',
    requestsLabel: 'breaches',
    trafficLabel: 'entries',
    actionWord: 'check',
  },
  security_patrols: {
    eyebrow: 'Live security',
    title: 'Patrols & rounds',
    icon: 'shield',
    blurb: 'guard patrol routes and checkpoints',
    overdueLabel: 'rounds overdue',
    openLabel: 'incidents',
    perfTitle: 'Patrols',
    servedLabel: 'rounds done',
    requestsLabel: 'incidents',
    trafficLabel: 'checkpoints',
    actionWord: 'patrol',
  },
  security_incidents: {
    eyebrow: 'Live security',
    title: 'Incidents & alarms',
    icon: 'bolt',
    blurb: 'alarm response and incident handling',
    overdueLabel: 'cases aging',
    openLabel: 'open cases',
    perfTitle: 'Incidents',
    servedLabel: 'cases handled',
    requestsLabel: 'cases',
    trafficLabel: 'alarms',
    actionWord: 'respond',
  },
  // ── Hospitality
  hospitality_reception: {
    eyebrow: 'Live hospitality',
    title: 'Reception',
    icon: 'badge',
    blurb: 'check-in and front-desk inquiries',
    overdueLabel: 'desks overdue',
    openLabel: 'waiting',
    perfTitle: 'Reception',
    servedLabel: 'desks staffed',
    requestsLabel: 'guests',
    trafficLabel: 'guests',
    actionWord: 'serve',
  },
  hospitality_concierge: {
    eyebrow: 'Live hospitality',
    title: 'Concierge',
    icon: 'sparkle',
    blurb: 'requests, bookings, and recommendations',
    overdueLabel: 'requests aging',
    openLabel: 'open requests',
    perfTitle: 'Concierge',
    servedLabel: 'requests handled',
    requestsLabel: 'requests',
    trafficLabel: 'guests',
    actionWord: 'handle',
  },
  hospitality_fnb: {
    eyebrow: 'Live hospitality',
    title: 'Food & beverage',
    icon: 'cart',
    blurb: 'café, catering, and pantry service',
    overdueLabel: 'points overdue',
    openLabel: 'orders',
    perfTitle: 'Food & beverage',
    servedLabel: 'points serviced',
    requestsLabel: 'orders',
    trafficLabel: 'covers',
    actionWord: 'service',
  },
  hospitality_events: {
    eyebrow: 'Live hospitality',
    title: 'Meeting & events',
    icon: 'people',
    blurb: 'room booking, AV, and setup',
    overdueLabel: 'rooms overdue',
    openLabel: 'open setups',
    perfTitle: 'Events',
    servedLabel: 'rooms turned',
    requestsLabel: 'bookings',
    trafficLabel: 'attendees',
    actionWord: 'turn',
  },
  hospitality_requests: {
    eyebrow: 'Live hospitality',
    title: 'Guest requests',
    icon: 'paper',
    blurb: 'occupant and in-room requests',
    overdueLabel: 'requests aging',
    openLabel: 'open requests',
    perfTitle: 'Guest requests',
    servedLabel: 'requests closed',
    requestsLabel: 'requests',
    trafficLabel: 'guests',
    actionWord: 'resolve',
  },
  hospitality_mail: {
    eyebrow: 'Live hospitality',
    title: 'Mail & packages',
    icon: 'ship',
    blurb: 'reception and distribution',
    overdueLabel: 'parcels aging',
    openLabel: 'awaiting pickup',
    perfTitle: 'Mail & packages',
    servedLabel: 'parcels delivered',
    requestsLabel: 'parcels',
    trafficLabel: 'parcels',
    actionWord: 'deliver',
  },
  // ── Maintenance
  maintenance_hvac: {
    eyebrow: 'Live maintenance',
    title: 'HVAC',
    icon: 'bolt',
    blurb: 'heating, cooling, and ventilation',
    overdueLabel: 'units overdue',
    openLabel: 'faults',
    perfTitle: 'HVAC',
    servedLabel: 'units serviced',
    requestsLabel: 'faults',
    trafficLabel: 'runtime hrs',
    actionWord: 'service',
  },
  maintenance_electrical: {
    eyebrow: 'Live maintenance',
    title: 'Electrical',
    icon: 'bolt',
    blurb: 'lighting, power, and panels',
    overdueLabel: 'panels overdue',
    openLabel: 'faults',
    perfTitle: 'Electrical',
    servedLabel: 'panels checked',
    requestsLabel: 'faults',
    trafficLabel: 'load',
    actionWord: 'service',
  },
  maintenance_plumbing: {
    eyebrow: 'Live maintenance',
    title: 'Plumbing',
    icon: 'droplet',
    blurb: 'fixtures, leaks, and water systems',
    overdueLabel: 'fixtures overdue',
    openLabel: 'leaks',
    perfTitle: 'Plumbing',
    servedLabel: 'fixtures serviced',
    requestsLabel: 'leaks',
    trafficLabel: 'flow',
    actionWord: 'service',
  },
  maintenance_elevators: {
    eyebrow: 'Live maintenance',
    title: 'Elevators & lifts',
    icon: 'ship',
    blurb: 'cars, controllers, and safety checks',
    overdueLabel: 'lifts overdue',
    openLabel: 'faults',
    perfTitle: 'Elevators',
    servedLabel: 'lifts serviced',
    requestsLabel: 'faults',
    trafficLabel: 'trips',
    actionWord: 'service',
  },
  maintenance_envelope: {
    eyebrow: 'Live maintenance',
    title: 'Building envelope',
    icon: 'building',
    blurb: 'roof, façade, doors, and seals',
    overdueLabel: 'sections overdue',
    openLabel: 'defects',
    perfTitle: 'Envelope',
    servedLabel: 'sections checked',
    requestsLabel: 'defects',
    trafficLabel: 'area',
    actionWord: 'inspect',
  },
  maintenance_grounds: {
    eyebrow: 'Live maintenance',
    title: 'Grounds & landscaping',
    icon: 'grid',
    blurb: 'exterior, irrigation, and planting',
    overdueLabel: 'zones overdue',
    openLabel: 'jobs',
    perfTitle: 'Grounds',
    servedLabel: 'zones serviced',
    requestsLabel: 'jobs',
    trafficLabel: 'area',
    actionWord: 'service',
  },
  maintenance_pm: {
    eyebrow: 'Live maintenance',
    title: 'Preventive maintenance',
    icon: 'cog',
    blurb: 'scheduled PM tasks across assets',
    overdueLabel: 'PMs overdue',
    openLabel: 'open tasks',
    perfTitle: 'Preventive maintenance',
    servedLabel: 'tasks done',
    requestsLabel: 'tasks',
    trafficLabel: 'assets',
    actionWord: 'service',
  },
  maintenance_firesafety: {
    eyebrow: 'Live maintenance',
    title: 'Fire & life safety',
    icon: 'shield',
    blurb: 'alarms, sprinklers, and extinguishers',
    overdueLabel: 'devices overdue',
    openLabel: 'faults',
    perfTitle: 'Fire & life safety',
    servedLabel: 'devices checked',
    requestsLabel: 'faults',
    trafficLabel: 'devices',
    actionWord: 'inspect',
  },
};

// French board copy — text fields only; icon (+ any missing field) inherits from
// DOMAIN via a merge at the call site. Keyed identically to DOMAIN.
const DOMAIN_FR = {
  security: {
    eyebrow: 'Sécurité en direct',
    title: 'Tableau de sécurité',
    blurb: 'rondes, événements d’accès et incidents ouverts',
    overdueLabel: 'rondes en retard',
    openLabel: 'incidents ouverts',
    perfTitle: 'Performance sécurité',
    servedLabel: 'zones patrouillées',
    requestsLabel: 'incidents',
    trafficLabel: 'accès',
    actionWord: 'patrouille',
  },
  maintenance: {
    eyebrow: 'Maintenance en direct',
    title: 'Tableau de maintenance',
    blurb: 'état des actifs, fonctionnement et pannes ouvertes',
    overdueLabel: 'MP en retard',
    openLabel: 'pannes ouvertes',
    perfTitle: 'Performance maintenance',
    servedLabel: 'actifs entretenus',
    requestsLabel: 'pannes',
    trafficLabel: 'h de fonct.',
    actionWord: 'entretien',
  },
  hospitality: {
    eyebrow: 'Accueil en direct',
    title: 'Tableau accueil',
    blurb: 'services aux occupants, occupation et demandes ouvertes',
    overdueLabel: 'demandes en attente',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Performance accueil',
    servedLabel: 'points servis',
    requestsLabel: 'demandes',
    trafficLabel: 'visiteurs',
    actionWord: 'service',
  },
  cleaning_common: {
    eyebrow: 'Nettoyage en direct',
    title: 'Espaces communs',
    blurb: 'halls, couloirs, ascenseurs et réception',
    overdueLabel: 'espaces en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage espaces communs',
    servedLabel: 'espaces nettoyés',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'nettoyage',
  },
  cleaning_floors: {
    eyebrow: 'Nettoyage en direct',
    title: 'Sols & moquettes',
    blurb: 'lavage, aspiration, lustrage et entretien des moquettes',
    overdueLabel: 'zones en retard',
    openLabel: 'demandes ponctuelles',
    perfTitle: 'Nettoyage des sols',
    servedLabel: 'zones nettoyées',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'nettoyage',
  },
  cleaning_kitchens: {
    eyebrow: 'Nettoyage en direct',
    title: 'Cuisines & offices',
    blurb: 'salles de pause, coins café, frigos et plonge',
    overdueLabel: 'offices en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage cuisines',
    servedLabel: 'offices nettoyés',
    requestsLabel: 'demandes',
    trafficLabel: 'utilisations',
    actionWord: 'nettoyage',
  },
  cleaning_waste: {
    eyebrow: 'Nettoyage en direct',
    title: 'Déchets & recyclage',
    blurb: 'poubelles, locaux déchets et tournées',
    overdueLabel: 'collectes en retard',
    openLabel: 'alertes de débordement',
    perfTitle: 'Collecte des déchets',
    servedLabel: 'bacs vidés',
    requestsLabel: 'alertes',
    trafficLabel: 'kg collectés',
    actionWord: 'vidage',
  },
  cleaning_disinfection: {
    eyebrow: 'Nettoyage en direct',
    title: 'Désinfection',
    blurb: 'surfaces très touchées — poignées, boutons, commandes partagées',
    overdueLabel: 'surfaces en retard',
    openLabel: 'signalées',
    perfTitle: 'Désinfection',
    servedLabel: 'surfaces traitées',
    requestsLabel: 'signalements',
    trafficLabel: 'contacts',
    actionWord: 'désinfection',
  },
  cleaning_supplies: {
    eyebrow: 'Nettoyage en direct',
    title: 'Fournitures & consommables',
    blurb: 'savon, papier et désinfectant dans les distributeurs',
    overdueLabel: 'bas / vides',
    openLabel: 'ruptures',
    perfTitle: 'Fournitures',
    servedLabel: 'points réapprovisionnés',
    requestsLabel: 'recharges',
    trafficLabel: 'distributions',
    actionWord: 'réappro',
  },
  cleaning_windows: {
    eyebrow: 'Nettoyage en direct',
    title: 'Vitres & surfaces vitrées',
    blurb: 'cloisons intérieures, miroirs et vitrages de façade',
    overdueLabel: 'vitres en retard',
    openLabel: 'traces signalées',
    perfTitle: 'Nettoyage des vitres',
    servedLabel: 'vitres nettoyées',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'nettoyage',
  },
  cleaning_workspaces: {
    eyebrow: 'Nettoyage en direct',
    title: 'Postes & bureaux',
    blurb: 'bureaux, remise en état des salles et rotation clean-desk',
    overdueLabel: 'zones en retard',
    openLabel: 'demandes de remise en état',
    perfTitle: 'Nettoyage des postes',
    servedLabel: 'zones remises en état',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'remise en état',
  },
  cleaning_exterior: {
    eyebrow: 'Nettoyage en direct',
    title: 'Extérieurs & entrées',
    blurb: 'tapis d’entrée, façade, allées et terrasses',
    overdueLabel: 'zones en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage extérieur',
    servedLabel: 'zones nettoyées',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'nettoyage',
  },
  cleaning_elevators: {
    eyebrow: 'Nettoyage en direct',
    title: 'Ascenseurs & escaliers méc.',
    blurb: 'cabines, paliers et mains courantes — circulation verticale',
    overdueLabel: 'cabines en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage ascenseurs',
    servedLabel: 'cabines nettoyées',
    requestsLabel: 'demandes',
    trafficLabel: 'trajets',
    actionWord: 'nettoyage',
  },
  cleaning_vents: {
    eyebrow: 'Nettoyage en direct',
    title: 'Bouches & filtres',
    blurb: 'nettoyage des bouches et remplacement des filtres — qualité d’air',
    overdueLabel: 'filtres en retard',
    openLabel: 'signalements',
    perfTitle: 'Bouches & filtres',
    servedLabel: 'bouches entretenues',
    requestsLabel: 'signalements',
    trafficLabel: 'débit d’air',
    actionWord: 'entretien',
  },
  cleaning_deep: {
    eyebrow: 'Nettoyage en direct',
    title: 'Nettoyage approfondi',
    blurb: 'nettoyages approfondis planifiés, post-événement et post-travaux',
    overdueLabel: 'travaux en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage approfondi',
    servedLabel: 'travaux réalisés',
    requestsLabel: 'demandes',
    trafficLabel: 'm²',
    actionWord: 'nettoyage approfondi',
  },
  cleaning_stairwells: {
    eyebrow: 'Nettoyage en direct',
    title: 'Cages d’escalier',
    blurb: 'marches, mains courantes et paliers',
    overdueLabel: 'escaliers en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Nettoyage des escaliers',
    servedLabel: 'escaliers nettoyés',
    requestsLabel: 'demandes',
    trafficLabel: 'fréquentation',
    actionWord: 'nettoyage',
  },
  cleaning_laundry: {
    eyebrow: 'Nettoyage en direct',
    title: 'Blanchisserie & linge',
    blurb: 'serviettes, tapis et uniformes',
    overdueLabel: 'lots en retard',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Blanchisserie',
    servedLabel: 'lots traités',
    requestsLabel: 'demandes',
    trafficLabel: 'articles',
    actionWord: 'traitement',
  },
  security_access: {
    eyebrow: 'Sécurité en direct',
    title: 'Contrôle d’accès',
    blurb: 'portes, lecteurs de badge et tourniquets',
    overdueLabel: 'portes signalées',
    openLabel: 'forcées / maintenues',
    perfTitle: 'Contrôle d’accès',
    servedLabel: 'portes vérifiées',
    requestsLabel: 'alertes',
    trafficLabel: 'entrées',
    actionWord: 'vérification',
  },
  security_visitors: {
    eyebrow: 'Sécurité en direct',
    title: 'Gestion des visiteurs',
    blurb: 'accueils, badges et accompagnements',
    overdueLabel: 'accueils en retard',
    openLabel: 'en attente',
    perfTitle: 'Gestion des visiteurs',
    servedLabel: 'accueils tenus',
    requestsLabel: 'visiteurs',
    trafficLabel: 'visiteurs',
    actionWord: 'traitement',
  },
  security_cctv: {
    eyebrow: 'Sécurité en direct',
    title: 'Vidéosurveillance',
    blurb: 'couverture caméras et supervision',
    overdueLabel: 'caméras hors service',
    openLabel: 'alertes',
    perfTitle: 'Vidéosurveillance',
    servedLabel: 'caméras actives',
    requestsLabel: 'alertes',
    trafficLabel: 'événements',
    actionWord: 'vérification',
  },
  security_perimeter: {
    eyebrow: 'Sécurité en direct',
    title: 'Périmètre',
    blurb: 'clôtures, portails et quais de chargement',
    overdueLabel: 'points en retard',
    openLabel: 'intrusions',
    perfTitle: 'Périmètre',
    servedLabel: 'points vérifiés',
    requestsLabel: 'intrusions',
    trafficLabel: 'entrées',
    actionWord: 'contrôle',
  },
  security_patrols: {
    eyebrow: 'Sécurité en direct',
    title: 'Rondes',
    blurb: 'itinéraires de ronde et points de contrôle',
    overdueLabel: 'rondes en retard',
    openLabel: 'incidents',
    perfTitle: 'Rondes',
    servedLabel: 'rondes effectuées',
    requestsLabel: 'incidents',
    trafficLabel: 'points de contrôle',
    actionWord: 'ronde',
  },
  security_incidents: {
    eyebrow: 'Sécurité en direct',
    title: 'Incidents & alarmes',
    blurb: 'réponse aux alarmes et gestion des incidents',
    overdueLabel: 'cas en attente',
    openLabel: 'cas ouverts',
    perfTitle: 'Incidents',
    servedLabel: 'cas traités',
    requestsLabel: 'cas',
    trafficLabel: 'alarmes',
    actionWord: 'intervention',
  },
  hospitality_reception: {
    eyebrow: 'Accueil en direct',
    title: 'Réception',
    blurb: 'enregistrement et demandes à l’accueil',
    overdueLabel: 'accueils en retard',
    openLabel: 'en attente',
    perfTitle: 'Réception',
    servedLabel: 'accueils tenus',
    requestsLabel: 'clients',
    trafficLabel: 'clients',
    actionWord: 'accueil',
  },
  hospitality_concierge: {
    eyebrow: 'Accueil en direct',
    title: 'Conciergerie',
    blurb: 'demandes, réservations et recommandations',
    overdueLabel: 'demandes en attente',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Conciergerie',
    servedLabel: 'demandes traitées',
    requestsLabel: 'demandes',
    trafficLabel: 'clients',
    actionWord: 'traitement',
  },
  hospitality_fnb: {
    eyebrow: 'Accueil en direct',
    title: 'Restauration',
    blurb: 'café, traiteur et service en office',
    overdueLabel: 'points en retard',
    openLabel: 'commandes',
    perfTitle: 'Restauration',
    servedLabel: 'points servis',
    requestsLabel: 'commandes',
    trafficLabel: 'couverts',
    actionWord: 'service',
  },
  hospitality_events: {
    eyebrow: 'Accueil en direct',
    title: 'Réunions & événements',
    blurb: 'réservation de salle, audiovisuel et installation',
    overdueLabel: 'salles en retard',
    openLabel: 'installations ouvertes',
    perfTitle: 'Événements',
    servedLabel: 'salles préparées',
    requestsLabel: 'réservations',
    trafficLabel: 'participants',
    actionWord: 'préparation',
  },
  hospitality_requests: {
    eyebrow: 'Accueil en direct',
    title: 'Demandes clients',
    blurb: 'demandes des occupants et en chambre',
    overdueLabel: 'demandes en attente',
    openLabel: 'demandes ouvertes',
    perfTitle: 'Demandes clients',
    servedLabel: 'demandes clôturées',
    requestsLabel: 'demandes',
    trafficLabel: 'clients',
    actionWord: 'traitement',
  },
  hospitality_mail: {
    eyebrow: 'Accueil en direct',
    title: 'Courrier & colis',
    blurb: 'réception et distribution',
    overdueLabel: 'colis en attente',
    openLabel: 'en attente de retrait',
    perfTitle: 'Courrier & colis',
    servedLabel: 'colis distribués',
    requestsLabel: 'colis',
    trafficLabel: 'colis',
    actionWord: 'distribution',
  },
  maintenance_hvac: {
    eyebrow: 'Maintenance en direct',
    title: 'CVC',
    blurb: 'chauffage, refroidissement et ventilation',
    overdueLabel: 'unités en retard',
    openLabel: 'pannes',
    perfTitle: 'CVC',
    servedLabel: 'unités entretenues',
    requestsLabel: 'pannes',
    trafficLabel: 'h de fonct.',
    actionWord: 'entretien',
  },
  maintenance_electrical: {
    eyebrow: 'Maintenance en direct',
    title: 'Électricité',
    blurb: 'éclairage, alimentation et tableaux',
    overdueLabel: 'tableaux en retard',
    openLabel: 'pannes',
    perfTitle: 'Électricité',
    servedLabel: 'tableaux vérifiés',
    requestsLabel: 'pannes',
    trafficLabel: 'charge',
    actionWord: 'entretien',
  },
  maintenance_plumbing: {
    eyebrow: 'Maintenance en direct',
    title: 'Plomberie',
    blurb: 'robinetterie, fuites et réseaux d’eau',
    overdueLabel: 'équipements en retard',
    openLabel: 'fuites',
    perfTitle: 'Plomberie',
    servedLabel: 'équipements entretenus',
    requestsLabel: 'fuites',
    trafficLabel: 'débit',
    actionWord: 'entretien',
  },
  maintenance_elevators: {
    eyebrow: 'Maintenance en direct',
    title: 'Ascenseurs & monte-charges',
    blurb: 'cabines, automates et contrôles de sécurité',
    overdueLabel: 'appareils en retard',
    openLabel: 'pannes',
    perfTitle: 'Ascenseurs',
    servedLabel: 'appareils entretenus',
    requestsLabel: 'pannes',
    trafficLabel: 'trajets',
    actionWord: 'entretien',
  },
  maintenance_envelope: {
    eyebrow: 'Maintenance en direct',
    title: 'Enveloppe du bâtiment',
    blurb: 'toiture, façade, portes et joints',
    overdueLabel: 'sections en retard',
    openLabel: 'défauts',
    perfTitle: 'Enveloppe',
    servedLabel: 'sections vérifiées',
    requestsLabel: 'défauts',
    trafficLabel: 'surface',
    actionWord: 'inspection',
  },
  maintenance_grounds: {
    eyebrow: 'Maintenance en direct',
    title: 'Espaces verts',
    blurb: 'extérieurs, arrosage et plantations',
    overdueLabel: 'zones en retard',
    openLabel: 'travaux',
    perfTitle: 'Espaces verts',
    servedLabel: 'zones entretenues',
    requestsLabel: 'travaux',
    trafficLabel: 'surface',
    actionWord: 'entretien',
  },
  maintenance_pm: {
    eyebrow: 'Maintenance en direct',
    title: 'Maintenance préventive',
    blurb: 'tâches de maintenance planifiées sur les actifs',
    overdueLabel: 'MP en retard',
    openLabel: 'tâches ouvertes',
    perfTitle: 'Maintenance préventive',
    servedLabel: 'tâches réalisées',
    requestsLabel: 'tâches',
    trafficLabel: 'actifs',
    actionWord: 'entretien',
  },
  maintenance_firesafety: {
    eyebrow: 'Maintenance en direct',
    title: 'Sécurité incendie',
    blurb: 'alarmes, sprinklers et extincteurs',
    overdueLabel: 'dispositifs en retard',
    openLabel: 'pannes',
    perfTitle: 'Sécurité incendie',
    servedLabel: 'dispositifs vérifiés',
    requestsLabel: 'pannes',
    trafficLabel: 'dispositifs',
    actionWord: 'inspection',
  },
};

function fmtHours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function StatPill({ label, value, tone }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        padding: '8px 14px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        minWidth: 92,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: tone ? `var(--${tone})` : 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

function DetailStat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, tone = 'ghost', disabled }) {
  const styles = {
    primary: { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' },
    ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-strong)' },
    done: {
      background: 'var(--ok-soft, color-mix(in oklch, var(--ok) 15%, transparent))',
      color: 'var(--ok)',
      border: '1px solid var(--ok)',
    },
  }[tone];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 7,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        ...styles,
      }}
    >
      {children}
    </button>
  );
}

function ServicingRow({ r, cfg, domain, accent, slaHours, onResolve, onRaiseTicket }) {
  const sl = useSL();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // 'resolve' | 'ticket'
  const [ticketDone, setTicketDone] = useState(false);
  const sla = slaHours ?? r.sla_hours ?? 4;
  const overdue = r.hours_since != null && r.hours_since > sla;
  const hasOpen = (r.open_count || 0) > 0;
  const tone = hasOpen ? 'risk' : overdue ? 'warn' : 'ok';
  const statusLabel = hasOpen
    ? `${r.open_count} ${cfg.openLabel}`
    : overdue
      ? `${cfg.overdueLabel} · ${fmtHours(r.hours_since)}`
      : sl('within SLA', 'dans les délais');
  const trend = synthTrend(`${domain}:${r.item}`, overdue ? 60 : 92);
  // Realistic per-item detail (location, description, request tickets) — keyed by
  // item name. Falls back gracefully for domains without a content catalog yet.
  const detail = contentFor(domain, r.item);
  const requests = open ? buildRequests(domain, r.item, { openCount: r.open_count, handled: r.sessions_24h }) : null;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'grid',
          gridTemplateColumns: '20px 160px 160px 1fr 160px 120px',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          fontSize: 13,
          cursor: 'pointer',
          background: open ? domainSoft(topDomainOf(domain)) : 'transparent',
          transition: 'background .12s',
        }}
      >
        <Icon.chevR
          size={13}
          style={{
            color: 'var(--text-soft)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .12s',
          }}
        />
        <div style={{ fontWeight: 600 }}>{r.item}</div>
        <div style={{ color: 'var(--text-soft)' }}>{detail?.location || (r.location || '').toUpperCase()}</div>
        <div>
          <Pill tone={tone}>{statusLabel}</Pill>
        </div>
        <div style={{ color: 'var(--text-soft)' }}>
          {sl(
            `last ${cfg.actionWord} ${fmtHours(r.hours_since)} ago · ${r.sessions_24h || 0}/24h`,
            `dernier ${cfg.actionWord} il y a ${fmtHours(r.hours_since)} · ${r.sessions_24h || 0}/24h`,
          )}
        </div>
        <div style={{ color: 'var(--text-soft)', textAlign: 'right' }}>
          {r.traffic_24h > 0 ? `${r.traffic_24h} ${cfg.trafficLabel}` : '—'}
        </div>
      </div>
      {open && (
        <div
          style={{
            padding: '12px 14px 16px 46px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            background: 'var(--surface-2, var(--surface))',
          }}
        >
          {detail?.desc ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-soft)', maxWidth: 760 }}>{detail.desc}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <DetailStat label={sl('SLA window', 'fenêtre SLA')} value={fmtHours(sla)} />
            <DetailStat
              label={sl(`since last ${cfg.actionWord}`, `depuis dernier ${cfg.actionWord}`)}
              value={fmtHours(r.hours_since)}
            />
            <DetailStat label={sl(`${cfg.actionWord}s / 24h`, `${cfg.actionWord} / 24h`)} value={r.sessions_24h || 0} />
            <DetailStat label={cfg.trafficLabel} value={r.traffic_24h || 0} />
            <DetailStat label={cfg.openLabel} value={r.open_count || 0} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Sparkline data={trend} w={110} h={28} stroke={accent} fill={domainSoft(topDomainOf(domain))} />
              <div
                style={{ fontSize: 10.5, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.3 }}
              >
                {sl('7-day trend', 'tendance 7 j')}
              </div>
            </div>
            {(onResolve || onRaiseTicket) && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {onResolve && (
                  <ActionBtn
                    tone="primary"
                    disabled={busy != null}
                    onClick={async () => {
                      setBusy('resolve');
                      try {
                        await onResolve(r);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Icon.check size={13} />{' '}
                    {busy === 'resolve'
                      ? sl('Marking…', 'En cours…')
                      : sl(`Mark ${cfg.actionWord}ed`, 'Marquer traité')}
                  </ActionBtn>
                )}
                {onRaiseTicket &&
                  (ticketDone ? (
                    <ActionBtn tone="done" disabled>
                      <Icon.check size={13} /> {sl('Ticket raised', 'Ticket créé')}
                    </ActionBtn>
                  ) : (
                    <ActionBtn
                      tone="ghost"
                      disabled={busy != null}
                      onClick={async () => {
                        setBusy('ticket');
                        try {
                          await onRaiseTicket(r);
                          setTicketDone(true);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      <Icon.paper size={13} />{' '}
                      {busy === 'ticket' ? sl('Raising…', 'Création…') : sl('Raise ticket', 'Créer un ticket')}
                    </ActionBtn>
                  ))}
              </div>
            )}
          </div>
          {requests && requests.tickets.length > 0 ? <RequestList requests={requests} accent={accent} sl={sl} /> : null}
        </div>
      )}
    </div>
  );
}

// Drill-down ticket list — the individual requests behind a service line
// (who asked, what, when, status, who handled it). Generated deterministically
// by servicing-content.buildRequests so it stays consistent with the row metrics.
function RequestList({ requests, accent, sl }) {
  const { tickets, moreHandled } = requests;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxWidth: 760 }}>
      <div
        style={{
          padding: '7px 12px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {sl('Requests', 'Demandes')}
      </div>
      {tickets.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 150px 1fr auto',
            gap: 10,
            alignItems: 'center',
            padding: '7px 12px',
            fontSize: 12.5,
            borderBottom: i < tickets.length - 1 || moreHandled > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: t.status === 'open' ? accent : 'var(--text-faint)',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                flexShrink: 0,
                background: t.status === 'open' ? accent : 'var(--text-faint)',
              }}
            />
            {t.status === 'open' ? sl('open', 'ouvert') : sl('done', 'traité')}
          </span>
          <span
            style={{ color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {t.requester}
          </span>
          <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.ask}
          </span>
          <span style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
            {t.ago}
            {t.handler ? ` · ${t.handler}` : ''}
          </span>
        </div>
      ))}
      {moreHandled > 0 ? (
        <div style={{ padding: '7px 12px', fontSize: 11.5, color: 'var(--text-faint)' }}>
          {sl(`+ ${moreHandled} more handled today`, `+ ${moreHandled} traitées aujourd’hui`)}
        </div>
      ) : null}
    </div>
  );
}

function PerfStrip({ perf, cfg, domain, accent, history }) {
  const sl = useSL();
  if (!perf) return null;
  const adh = perf.adherence_pct;
  const adhTone = adh >= 90 ? 'ok' : adh >= 70 ? 'warn' : 'risk';
  const trend = history && history.length >= 2 ? history : synthTrend(domain, adh);
  return (
    <Card>
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          color: 'var(--text-soft)',
        }}
      >
        {cfg.perfTitle} · {sl('last 7 days', '7 derniers jours')}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 14, alignItems: 'center' }}>
        <StatPill label={sl('SLA adherence', 'adhérence SLA')} value={`${adh}%`} tone={adhTone} />
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, padding: '6px 12px' }}>
          <Sparkline data={trend} w={130} h={34} stroke={accent} fill={domainSoft(topDomainOf(domain))} />
          <div style={{ fontSize: 10.5, color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {sl('adherence trend', 'tendance adhérence')}
          </div>
        </div>
        <StatPill label={sl('sessions', 'passages')} value={perf.sessions_7d} />
        <StatPill label={cfg.servedLabel} value={`${perf.serviced_7d}/${perf.items_total}`} />
        <StatPill label={cfg.requestsLabel} value={`${perf.requests_resolved_7d}/${perf.requests_7d}`} />
        <StatPill label={cfg.trafficLabel} value={perf.traffic_7d} />
      </div>
    </Card>
  );
}

const SERVICE_TYPE_LABEL = {
  surface_clean: 'Surface clean',
  deep_clean: 'Deep clean',
  empty_bins: 'Waste',
  restock: 'Restock',
  inspection: 'Inspection',
  patrol: 'Patrol',
  other: 'Service',
};
const CADENCE_LABEL = {
  daily: 'every day',
  weekdays: 'weekdays',
  weekends: 'weekends',
  weekly: 'weekly',
  custom: 'custom days',
};

// "Serviced by" — shows the real Schedules route backing this board (the items
// are route_tasks under it) + live completion counts. Makes the Schedules link
// visible: the board isn't a fixture, it's a route + a completion log.
const SERVICE_TYPE_LABEL_FR = {
  surface_clean: 'Nettoyage',
  deep_clean: 'Nettoyage approfondi',
  empty_bins: 'Déchets',
  restock: 'Réappro.',
  inspection: 'Inspection',
  patrol: 'Patrouille',
  other: 'Service',
};
const CADENCE_LABEL_FR = {
  daily: 'tous les jours',
  weekdays: 'jours ouvrés',
  weekends: 'week-ends',
  weekly: 'hebdo',
  custom: 'jours définis',
};
function ServicedByPanel({ route, checksToday, lastCheck, accent }) {
  const sl = useSL();
  if (!route) return null;
  const contractor = route.contract?.contractor?.name || null;
  const eyebrow = contractor
    ? sl('Serviced by contractor', 'Assuré par le prestataire')
    : sl('Serviced by route', 'Assuré par la tournée');
  const heading = contractor || route.name;
  const stype = sl(
    SERVICE_TYPE_LABEL[route.service_type] || 'Service',
    SERVICE_TYPE_LABEL_FR[route.service_type] || 'Service',
  );
  const cad = sl(CADENCE_LABEL[route.cadence] || route.cadence, CADENCE_LABEL_FR[route.cadence] || route.cadence);
  return (
    <Card
      style={{
        marginBottom: 18,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 8,
          background: `color-mix(in oklch, ${accent} 14%, transparent)`,
        }}
      >
        <Icon.people size={16} style={{ color: accent }} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-soft)',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            fontWeight: 700,
          }}
        >
          {eyebrow}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{heading}</div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>
        {contractor ? `${route.name} · ` : ''}
        {stype} · {cad}
        {route.expected_start_time ? ` · ${sl('from', 'dès')} ${String(route.expected_start_time).slice(0, 5)}` : ''}
        {route.contract?.monthly_value
          ? ` · ${route.contract.currency || 'USD'} ${Number(route.contract.monthly_value).toLocaleString()}${sl('/mo', '/mois')}`
          : ''}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: 12.5, color: 'var(--text-soft)' }}>
        <strong style={{ color: 'var(--text)' }}>{checksToday}</strong> {sl('checks logged (24h)', 'contrôles (24 h)')}
        {lastCheck != null ? (
          <> · {sl(`last ${fmtHours(lastCheck)} ago`, `dernier il y a ${fmtHours(lastCheck)}`)}</>
        ) : (
          ''
        )}
      </div>
    </Card>
  );
}

// Inline editor for the board's configured SLA window. Reads/writes
// servicing_sla_targets via set_servicing_sla_target (mig 199). FM-only.
// Note: no pencil/edit glyph exists in our icon set — use a text affordance.
function SlaTargetEditor({ domain, current, onSaved }) {
  const sl = useSL();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  React.useEffect(() => {
    setVal(current ?? '');
  }, [current]);
  if (current == null && !editing) return null;

  async function save() {
    const h = Number(val);
    if (!h || h <= 0) {
      setErr(true);
      return;
    }
    setBusy(true);
    setErr(false);
    try {
      await setServicingSlaTarget(domain, h);
      await onSaved?.();
      setEditing(false);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 9px',
    fontSize: 11.5,
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5 }}>
      <span
        style={{
          color: 'var(--text-soft)',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          fontSize: 10.5,
          fontWeight: 700,
        }}
      >
        {sl('SLA target', 'objectif SLA')}
      </span>
      {editing ? (
        <>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={val}
            autoFocus
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') {
                setEditing(false);
                setVal(current ?? '');
              }
            }}
            style={{
              width: 66,
              padding: '4px 7px',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 12.5,
              border: `1px solid ${err ? 'var(--risk)' : 'var(--border-strong)'}`,
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <span style={{ color: 'var(--text-soft)' }}>{sl('hours', 'heures')}</span>
          <button
            onClick={save}
            disabled={busy}
            style={{
              ...chip,
              background: 'var(--accent)',
              color: '#fff',
              border: '1px solid var(--accent)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? sl('Saving…', 'Enreg.…') : sl('Save', 'Enregistrer')}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setVal(current ?? '');
              setErr(false);
            }}
            style={{
              ...chip,
              background: 'transparent',
              color: 'var(--text)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {sl('Cancel', 'Annuler')}
          </button>
        </>
      ) : (
        <>
          <strong style={{ fontSize: 13 }}>{fmtHours(current)}</strong>
          <button
            onClick={() => setEditing(true)}
            style={{
              ...chip,
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
            }}
          >
            {sl('Edit', 'Modifier')}
          </button>
        </>
      )}
    </div>
  );
}

function ListTab({ active, accent, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        padding: '5px 10px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        color: active ? accent : 'var(--text-soft)',
        background: active ? `color-mix(in oklch, ${accent} 12%, transparent)` : 'transparent',
        border: `1px solid ${active ? `color-mix(in oklch, ${accent} 30%, transparent)` : 'transparent'}`,
        transition: 'background .12s, color .12s, border-color .12s',
      }}
    >
      {children}
    </button>
  );
}

export function ServicingBoard({ domain, building }) {
  const activeOrg = useActiveOrg();
  const orgId = activeOrg?.id;
  const lang = useLanguage();
  const sl = useSL();
  const base = DOMAIN[domain] || DOMAIN.security;
  const cfg = lang === 'fr' ? { ...base, ...(DOMAIN_FR[domain] || DOMAIN_FR.security) } : base;
  const DomIcon = Icon[cfg.icon] || Icon.check;
  const accent = domainAccent(topDomainOf(domain));
  // Contractors see a viewer-scoped, READ-ONLY board (their lines at the client
  // building) via the contained RPC; the item rows come from there, write actions
  // are hidden.
  const readonly = activeOrg?.kind === 'contractor';
  const { rows, loaded, reload } = useServicingState(orgId, domain, { viewer: readonly, buildingId: building?.id });
  const { perf } = useServicingPerf(orgId, domain);
  const history = useServicingHistory(orgId, domain);
  // SLA window sourced from the configured target (servicing_sla_targets, mig
  // 199); fall back to the fixture's per-row value when no target row exists.
  const { map: slaTargets, reload: reloadSlaTargets } = useServicingSlaTargets(orgId);
  const slaTarget = slaTargets[domain];
  const route = useServicingRoute(orgId, domain);
  const slaOf = (r) => slaTarget ?? r.sla_hours ?? 4;
  // FM/owner orgs can edit the SLA target inline; contractors are read-only.
  const canEditSla = activeOrg?.kind !== 'contractor';
  const [showAll, setShowAll] = useState(false);

  const handleResolve = async (r) => {
    try {
      await resolveServicingItem(domain, r.item);
    } catch {
      /* surfaced to user via no state change */
    }
    await reload();
  };
  const handleRaiseTicket = async (r) => {
    const isOverdue = r.hours_since != null && r.hours_since > slaOf(r);
    const priority = (r.open_count || 0) > 0 ? 'high' : isOverdue ? 'normal' : 'low';
    await createManualTicket({
      organizationId: orgId,
      locationId: building?.id || null,
      locationLabel: r.location || building?.name || null,
      title: sl(`${cfg.title}: ${r.item} needs attention`, `${cfg.title} : ${r.item} nécessite une intervention`),
      body: sl(
        `${r.item} at ${r.location || 'building'} — last ${cfg.actionWord} ${fmtHours(r.hours_since)} ago ` +
          `(SLA ${fmtHours(slaOf(r))})${(r.open_count || 0) > 0 ? `, ${r.open_count} ${cfg.openLabel}` : ''}. ` +
          `Raised from the ${cfg.title} board.`,
        `${r.item} à ${r.location || 'bâtiment'} — dernier ${cfg.actionWord} il y a ${fmtHours(r.hours_since)} ` +
          `(SLA ${fmtHours(slaOf(r))})${(r.open_count || 0) > 0 ? `, ${r.open_count} ${cfg.openLabel}` : ''}. ` +
          `Créé depuis le tableau ${cfg.title}.`,
      ),
      priority,
    });
  };

  const total = rows.length;
  const overdue = rows.filter((r) => r.hours_since != null && r.hours_since > slaOf(r)).length;
  const open = rows.reduce((n, r) => n + (r.open_count || 0), 0);
  const checksToday = rows.reduce((n, r) => n + (r.sessions_24h || 0), 0);
  const lastCheckH = rows.length
    ? Math.min(...rows.map((r) => (r.hours_since == null ? Infinity : r.hours_since)))
    : null;

  const pressing = sortByUrgency(
    rows.filter((r) => (r.open_count || 0) > 0 || (r.hours_since != null && r.hours_since > slaOf(r))),
  );
  // The list defaults to what's pressing; the "All items" tab shows every row,
  // still urgency-sorted so the ones that matter stay on top.
  const listed = showAll ? sortByUrgency(rows) : pressing;

  return (
    <main style={{ flex: 1, padding: 'var(--pad)', overflow: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {cfg.eyebrow}
        </div>
        <h2 style={{ margin: '4px 0 4px', fontSize: 20, fontWeight: 700 }}>{cfg.title}</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-soft)', maxWidth: 640 }}>
          {sl(
            `What’s being done in the building — ${cfg.blurb}. Ordered by urgency: open items first, then most overdue vs the service SLA.`,
            `Ce qui est fait dans le bâtiment — ${cfg.blurb}. Classé par urgence : éléments ouverts d’abord, puis les plus en retard vs le SLA.`,
          )}
        </p>
        {canEditSla && (
          <SlaTargetEditor
            domain={domain}
            current={slaTarget}
            onSaved={async () => {
              await reloadSlaTargets();
              await reload();
            }}
          />
        )}
      </div>

      {loaded && total === 0 ? (
        <Card>
          <div
            style={{
              padding: 28,
              color: 'var(--text-soft)',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <DomIcon size={16} />{' '}
            {sl('No servicing data for this building yet.', 'Aucune donnée de service pour ce bâtiment.')}
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <StatPill label={sl('items', 'éléments')} value={total} />
            <StatPill label={cfg.overdueLabel} value={overdue} tone={overdue ? 'warn' : undefined} />
            <StatPill label={cfg.openLabel} value={open} tone={open ? 'risk' : undefined} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <PerfStrip perf={perf} cfg={cfg} domain={domain} accent={accent} history={history} />
          </div>

          <ServicedByPanel
            route={route}
            checksToday={checksToday}
            lastCheck={Number.isFinite(lastCheckH) ? lastCheckH : null}
            accent={accent}
          />

          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <ListTab active={!showAll} accent={accent} onClick={() => setShowAll(false)}>
                {sl('Needs attention', 'À traiter')} {pressing.length > 0 && <Pill tone="warn">{pressing.length}</Pill>}
              </ListTab>
              <ListTab active={showAll} accent={accent} onClick={() => setShowAll(true)}>
                {sl('All items', 'Tous')} <Pill tone={showAll ? 'accent' : 'neutral'}>{total}</Pill>
              </ListTab>
            </div>
            {!loaded && (
              <div style={{ padding: 20, color: 'var(--text-soft)', fontSize: 13 }}>
                {sl('Loading servicing state…', 'Chargement…')}
              </div>
            )}
            {loaded && !showAll && pressing.length === 0 && (
              <div
                style={{
                  padding: 20,
                  color: 'var(--ok)',
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon.check size={16} />{' '}
                {sl('All within SLA — nothing pressing right now.', 'Tout est dans les délais — rien d’urgent.')}
              </div>
            )}
            {loaded &&
              listed.map((r) => (
                <ServicingRow
                  key={r.item}
                  r={r}
                  cfg={cfg}
                  domain={domain}
                  accent={accent}
                  slaHours={slaOf(r)}
                  onResolve={readonly ? null : handleResolve}
                  onRaiseTicket={readonly ? null : handleRaiseTicket}
                />
              ))}
          </Card>
        </>
      )}
    </main>
  );
}
