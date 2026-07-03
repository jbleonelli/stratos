// @ts-check
// Docs manifest — the structure behind the in-app Docs section (DocsPage).
// Groups the user-facing repo guides into sections for the left nav. The .md
// files in docs/ stay the single source of truth (imported as `?raw` at build
// time); to add a page, drop a guide in docs/guides/ and add an entry here.
//
// Internal docs (platform-admin, user-guide cheat-sheet, agents-demo-playbook)
// are intentionally excluded — this is the customer-facing set.
//
// Titles are [en, fr] pairs resolved with sl() at render so the section needs
// no new i18n keys. Page `id` == the bare filename stem, which lets cross-doc
// links (`slas.md`, `../guides/tickets.md#foo`) resolve to a page (see
// FILENAME_TO_PAGE).

import gettingStartedSrc from '../../docs/guides/getting-started.md?raw';
import organizationSetupSrc from '../../docs/guides/organization-setup.md?raw';
import schedulesSetupSrc from '../../docs/guides/schedules-setup.md?raw';
import servicingSrc from '../../docs/guides/servicing.md?raw';
import ticketsSrc from '../../docs/guides/tickets.md?raw';
import slasSrc from '../../docs/guides/slas.md?raw';
import agentsSrc from '../../docs/guides/agents.md?raw';
import dataSourcesSrc from '../../docs/guides/data-sources.md?raw';
import contractorSrc from '../../docs/guides/contractor.md?raw';
import contractorMsSrc from '../../docs/guides/contractor-multi-service.md?raw';
import contractorSavingsSrc from '../../docs/guides/contractor-savings.md?raw';
import rolesAccessSrc from '../../docs/architecture/roles-and-access.md?raw';

export const DOC_SECTIONS = [
  {
    id: 'start',
    title: ['Getting started', 'Démarrer'],
    pages: [
      {
        id: 'getting-started',
        title: ['Getting started', 'Prise en main'],
        blurb: ['Empty workspace → first running route', 'D’un espace vide à votre première tournée'],
        src: gettingStartedSrc,
      },
    ],
  },
  {
    id: 'setup',
    title: ['Set up your workspace', 'Configurer votre espace'],
    pages: [
      {
        id: 'organization-setup',
        title: ['Organization & locations', 'Organisation & sites'],
        blurb: ['Model your portfolio — the location tree', 'Modéliser votre parc — l’arbre des sites'],
        src: organizationSetupSrc,
      },
      {
        id: 'schedules-setup',
        title: ['Schedules & routes', 'Plannings & tournées'],
        blurb: ['Zones, team, routes, today’s plan', 'Zones, équipe, tournées, plan du jour'],
        src: schedulesSetupSrc,
      },
    ],
  },
  {
    id: 'using',
    title: ['Working in Merlin', 'Au quotidien'],
    pages: [
      {
        id: 'servicing',
        title: ['Servicing', 'Prestations'],
        blurb: ['Boards, items, mark serviced, raise tickets', 'Tableaux, éléments, prestations, tickets'],
        src: servicingSrc,
      },
      {
        id: 'tickets',
        title: ['Tickets', 'Tickets'],
        blurb: ['The follow-able work-item layer', 'La couche des tâches à suivre'],
        src: ticketsSrc,
      },
      {
        id: 'slas',
        title: ['SLAs', 'SLA'],
        blurb: ['Agreements, targets, propose → accept', 'Accords, objectifs, proposer → accepter'],
        src: slasSrc,
      },
      {
        id: 'agents',
        title: ['AI agents', 'Agents IA'],
        blurb: ['Autonomy, config, act vs ask', 'Autonomie, config, agir vs demander'],
        src: agentsSrc,
      },
      {
        id: 'data-sources',
        title: ['Data sources', 'Sources de données'],
        blurb: ['What feeds Merlin’s reasoning', 'Ce qui alimente le raisonnement'],
        src: dataSourcesSrc,
      },
    ],
  },
  {
    id: 'contractors',
    title: ['For contractors', 'Pour les prestataires'],
    pages: [
      {
        id: 'contractor',
        title: ['Merlin for contractors', 'Merlin pour les prestataires'],
        blurb: ['The full contractor playbook', 'Le guide complet prestataire'],
        src: contractorSrc,
      },
      {
        id: 'contractor-multi-service',
        title: ['Multi-service contractors', 'Prestataires multi-services'],
        blurb: ['Service-line switcher, per-line agents', 'Sélecteur de ligne, agents par ligne'],
        src: contractorMsSrc,
      },
      {
        id: 'contractor-savings',
        title: ['Savings', 'Économies'],
        blurb: ['Real margin + savings opportunities', 'Marge réelle + opportunités'],
        src: contractorSavingsSrc,
      },
    ],
  },
  {
    id: 'reference',
    title: ['Roles & access', 'Rôles & accès'],
    pages: [
      {
        id: 'roles-and-access',
        title: ['Roles & access', 'Rôles & accès'],
        blurb: ['Workspace types + permission grants', 'Types d’espace + droits d’accès'],
        src: rolesAccessSrc,
      },
    ],
  },
];
