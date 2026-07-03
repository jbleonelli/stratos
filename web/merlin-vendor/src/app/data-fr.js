// French overlay for the demo-visible dataset.
// Keyed by entity ID — merged onto the English data at render time by
// the hooks in localized-data.js. Only fields that actually appear on
// screen are translated (titles, subs, SLA strings, statuses, summaries,
// reasoning, implementation steps). Device telemetry, firmware strings,
// IDs, floor plan coordinates, etc. stay English.

// ═══════════════════════════════════════════════════════════════════
// HQ INCIDENTS (from data.js → INCIDENTS)
// ═══════════════════════════════════════════════════════════════════
export const INCIDENTS_FR = {
  'i-104': {
    title: 'Pic de COV \u2014 Toilettes 32e \u00e9tage Est',
    sub: 'COVT 1\u202f240 ppb (\u00d73,8 r\u00e9f\u00e9rence) \u00b7 d\u00e9tect\u00e9 il y a 4\u202fmin',
    sla: 'SLA Hygi\u00e8ne \u00b7 br\u00e8che dans 18\u202fmin',
    status: 'Merlin a d\u00e9p\u00each\u00e9 l\u2019\u00e9quipe\u202f\u00b7\u202fETA 6\u202fmin',
  },
  'i-109': {
    title: 'Seuil d\u2019occupation \u2014 Toilettes femmes 18e \u00e9tage',
    sub: '14 visiteurs depuis le dernier nettoyage (seuil\u202f: 12) \u00b7 pic 12:40',
    sla: 'SLA Hygi\u00e8ne \u00b7 nettoyage requis',
    status: 'Assign\u00e9 \u00e0 Priya \u00b7 ETA 8\u202fmin',
  },
  'i-108': {
    title: 'Nettoyage programm\u00e9 en retard \u2014 Salle Aulne',
    sub: 'Dernier nettoyage 08:14 \u00b7 intervalle SLA 4\u202fh \u00b7 +22\u202fmin',
    sla: 'SLA Hygi\u00e8ne \u00b7 \u00e0 risque',
    status: 'Merlin a avanc\u00e9 la tourn\u00e9e de 15:30',
  },
  'i-103': {
    title: 'R\u00e9servation fant\u00f4me \u2014 Salle Platane',
    sub: 'R\u00e9serv\u00e9e 14:00\u201315:00 \u00b7 0 occupant \u00b7 CO\u2082 410\u202fppm',
    sla: 'Utilisation des espaces \u00b7 lib\u00e9ration dans 2\u202fmin',
    status: 'Lib\u00e9ration auto en attente de votre approbation',
  },
  'i-107': {
    title: 'Capteur de fuite d\u2019eau \u2014 Tisanerie 12e \u00e9tage',
    sub: 'Humidit\u00e9 d\u00e9tect\u00e9e sous l\u2019\u00e9vier \u00b7 vanne ferm\u00e9e automatiquement',
    sla: 'S\u00e9curit\u00e9 \u00b7 contenu',
    status: 'Ticket exploitation #F-2041 ouvert',
  },
  'i-106': {
    title: 'Poubelle \u00e0 95\u202f% \u2014 Cafeteria 24e \u00e9tage',
    sub: 'Vitesse de remplissage +40\u202f% vs mardi \u00b7 pleine pr\u00e9vu 15:20',
    sla: 'SLA Hygi\u00e8ne \u00b7 ok',
    status: 'Ajout\u00e9e au passage de 15:00',
  },
  'i-102': {
    title: 'Distributeur de savon bas \u2014 Toilettes hommes 18e',
    sub: '14\u202f% restant \u00b7 recharge moyenne en 9\u202fh',
    sla: 'SLA Consommables \u00b7 ok',
    status: 'Ajout\u00e9 \u00e0 la tourn\u00e9e de Maria 16:00',
  },
  'i-101': {
    title: 'D\u00e9rive CVC \u2014 41e \u00e9tage Sud',
    sub: 'Consigne 22\u202f\u00b0C \u00b7 actuel 24,6\u202f\u00b0C \u00b7 en hausse',
    sla: 'SLA Confort \u00b7 nominal',
    status: 'Merlin a augment\u00e9 l\u2019air neuf de 12\u202f%',
  },
  'i-105': {
    title: 'Ascenseur B3 \u2014 maintenance pr\u00e9ventive due',
    sub: '38\u202f412 cycles depuis la derni\u00e8re intervention \u00b7 seuil 40\u202f000',
    sla: 'SLA Disponibilit\u00e9 \u00b7 planifi\u00e9',
    status: 'Rendez-vous OTIS \u00b7 samedi 06:00',
  },
  'i-110': {
    title: 'Acc\u00e8s hors heures \u2014 Salle serveurs 32',
    sub: 'Badge \u00b7 K. Okafor (IT) \u00b7 14\u202fmin sur site',
    sla: 'S\u00e9curit\u00e9 \u00b7 autoris\u00e9',
    status: 'Consign\u00e9 dans la piste d\u2019audit',
  },
  'i-100': {
    title: 'D\u00e9rogation \u00e9clairage \u2014 Parking niveau 2',
    sub: 'D\u00e9rogation manuelle active depuis 11\u202fh \u00b7 0 v\u00e9hicule depuis 23:00',
    sla: 'SLA \u00c9nergie \u00b7 +18\u202f$ aujourd\u2019hui',
    status: 'D\u00e9rogation r\u00e9initialis\u00e9e',
  },
  'i-115': {
    title: 'Porte maintenue ouverte \u2014 Quai de chargement B',
    sub: 'Ouverte depuis 14\u202fmin \u00b7 d\u00e9rive 3,4\u202f\u00b0C \u00b7 alerte s\u00e9curit\u00e9',
    sla: 'SLA S\u00e9curit\u00e9 \u00b7 \u00e0 risque',
    status: 'Alerte envoy\u00e9e au gardien \u00b7 fermeture attendue',
  },
  'i-114': {
    title: 'Tr\u00e9mie \u00e0 caf\u00e9 vide \u2014 Cuisine 12e \u00e9tage',
    sub: '42 tasses depuis le remplissage \u00b7 intervalle moyen 4\u202fh\u202f20',
    sla: 'SLA Services \u00b7 ok',
    status: 'En file d\u2019attente pour recharge 15:30',
  },
  'i-113': {
    title: 'Filtre \u00e0 air \u2014 CTA-7 22e \u00e9tage',
    sub: 'Perte de charge +28\u202f% \u00b7 dur\u00e9e 2\u202f840\u202fh \u00b7 fen\u00eatre de remplacement',
    sla: 'SLA Confort \u00b7 nominal',
    status: 'Ordre de travail #W-1182 \u00e9mis',
  },
  'i-112': {
    title: 'Conflit de r\u00e9servation \u2014 Zone 4-N',
    sub: '3 bureaux doublement r\u00e9serv\u00e9s 14:00 \u00b7 Merlin en a r\u00e9assign\u00e9 2',
    sla: 'SLA Espaces \u00b7 r\u00e9solu',
    status: 'Notifications envoy\u00e9es aux utilisateurs',
  },
  'i-111': {
    title: 'R\u00e9f\u00e9rence \u00e9nerg\u00e9tique d\u00e9pass\u00e9e \u2014 Zone C',
    sub: '\u22127,2\u202f% vs pr\u00e9visions \u00b7 r\u00e9duit maintenu',
    sla: 'SLA \u00c9nergie \u00b7 \u2212142\u202f$ aujourd\u2019hui',
    status: 'Consign\u00e9 \u00b7 alimente le rapport hebdo',
  },
  'i-116': {
    title: 'Signalement utilisateur \u2014 Toilettes hommes 24e',
    sub: '3 appuis \u00ab\u202fsale\u202f\u00bb en 12\u202fmin \u00b7 dernier nettoyage 10:40',
    sla: 'SLA Hygi\u00e8ne \u00b7 \u00e0 risque',
    status: 'Avanc\u00e9 sur la tourn\u00e9e de Maria 15:00',
  },
  'i-117': {
    title: 'Essuie-tout bas \u2014 Toilettes femmes 07e',
    sub: '8\u202f% restant \u00b7 2,1 distributions/min en pic',
    sla: 'SLA Consommables \u00b7 ok',
    status: 'Ajout\u00e9 \u00e0 la tourn\u00e9e de recharge 15:30',
  },
  'i-118': {
    title: 'D\u00e9versement d\u00e9tect\u00e9 \u2014 Dalle hall E4',
    sub: 'Anomalie de r\u00e9flectance \u00b7 3 passants ont \u00e9vit\u00e9 la zone',
    sla: 'SLA S\u00e9curit\u00e9 \u00b7 contenu',
    status: 'Panneau sol mouill\u00e9 demand\u00e9 \u00b7 \u00e9quipe en route',
  },
  'i-119': {
    title: 'Caf\u00e9 renvers\u00e9 \u2014 Salle de pause 32e',
    sub: 'Signal\u00e9 via \u00e9cran \u00b7 James @ 14:02',
    sla: 'SLA Hygi\u00e8ne \u00b7 ok',
    status: 'Ajout\u00e9 au prochain passage',
  },
  'i-120': {
    title: 'D\u00e9bordement poubelle pr\u00e9vu \u2014 Tisanerie 12e',
    sub: 'Remplissage +55\u202f% vs mardi \u00b7 ETA plein 14:40',
    sla: 'SLA Hygi\u00e8ne \u00b7 ok',
    status: 'Int\u00e9gr\u00e9 au passage de 14:15',
  },
  'i-121': {
    title: 'Recharge gel hydroalcoolique \u2014 Hall',
    sub: '21\u202f% restant \u00b7 protocole saison grippe',
    sla: 'SLA Consommables \u00b7 ok',
    status: 'En file pour tourn\u00e9e de Maria 16:00',
  },
  'i-122': {
    title: 'Refroidisseur-2 en cycles courts \u2014 Local technique',
    sub: '6 d\u00e9marrages en 20\u202fmin \u00b7 pression d\u2019aspiration basse',
    sla: 'SLA Confort \u00b7 \u00e0 risque',
    status: 'Trane alert\u00e9 \u00b7 technicien ETA 2\u202fh',
  },
  'i-123': {
    title: 'Chute pression chaudi\u00e8re \u2014 Sous-sol',
    sub: '14,2 psi \u00b7 min 15,0 \u00b7 appoint d\u2019eau en cours',
    sla: 'SLA Disponibilit\u00e9 \u00b7 \u00e0 risque',
    status: 'Ordre de travail #W-1186 \u00e9mis',
  },
  'i-124': {
    title: 'Alerte variateur \u2014 Pompe P-4',
    sub: 'D\u00e9faut F45 (surcharge) \u00b7 r\u00e9armement 2\u00d7 aujourd\u2019hui',
    sla: 'SLA Confort \u00b7 nominal',
    status: 'Analyse en cours \u00b7 remplacement vendredi',
  },
  'i-125': {
    title: 'Temps fonctionnement pompe de puisard \u2014 Sous-sol',
    sub: 'Cycle de service 42\u202f% (vs 18\u202f% moy.) \u00b7 pluie pr\u00e9vue',
    sla: 'SLA S\u00e9curit\u00e9 \u00b7 nominal',
    status: 'Surveillance \u00b7 v\u00e9rifier jeudi matin',
  },
  'i-126': {
    title: 'Purge tour a\u00e9ror\u00e9frig\u00e9rante \u2014 TAR-1',
    sub: 'Conductivit\u00e9 2\u202f100\u202f\u00b5S \u00b7 consigne 1\u202f800\u202f\u00b5S',
    sla: 'SLA Eau \u00b7 ok',
    status: 'Vanne de purge ouverte automatiquement 20\u202fmin',
  },
  'i-127': {
    title: 'Ascenseur A2 \u2014 variance cycle porte',
    sub: 'Fermeture +180\u202fms vs nominal \u00b7 d\u00e9rive capteur probable',
    sla: 'SLA Disponibilit\u00e9 \u00b7 nominal',
    status: 'OTIS d\u00e9p\u00each\u00e9 samedi avec B3',
  },
  'i-128': {
    title: 'Ventilo-convecteur \u2014 28e \u00e9tage Sud',
    sub: 'D\u00e9bit d\u2019air \u221228\u202f% \u00b7 encrassement batterie probable',
    sla: 'SLA Confort \u00b7 nominal',
    status: 'Ordre de travail #W-1187 \u00e9mis',
  },
  'i-129': {
    title: 'Talonnage d\u00e9tect\u00e9 \u2014 Tourniquet 2 hall principal',
    sub: '2 entr\u00e9es sur 1 badge \u00b7 clip vid\u00e9o 03:14 sauvegard\u00e9',
    sla: 'S\u00e9curit\u00e9 \u00b7 action requise',
    status: 'Ivan notifi\u00e9 \u00b7 vid\u00e9o en cours d\u2019analyse',
  },
  'i-130': {
    title: 'Lecteur de badge hors ligne \u2014 Escalier 41e',
    sub: 'Dernier battement il y a 22\u202fmin \u00b7 porte fail-secure',
    sla: 'S\u00e9curit\u00e9 \u00b7 lecteur hors ligne',
    status: 'Lecteur de remplacement d\u00e9p\u00each\u00e9 \u00b7 ETA 30\u202fmin',
  },
  'i-131': {
    title: 'Vue cam\u00e9ra obstru\u00e9e \u2014 Parking niveau 3',
    sub: 'Cam-G3-07 variance image \u221292\u202f% \u00b7 probablement bloqu\u00e9e',
    sla: 'S\u00e9curit\u00e9 \u00b7 \u00e0 risque',
    status: 'Signal\u00e9 pour v\u00e9rification physique',
  },
  'i-132': {
    title: 'Refus de badge r\u00e9p\u00e9t\u00e9s \u2014 Salle serveurs 18',
    sub: '4 refus en 6\u202fmin \u00b7 B. Alvarez (visiteur)',
    sla: 'S\u00e9curit\u00e9 \u00b7 enqu\u00eate',
    status: 'Redirig\u00e9 vers Ivan pour confirmation vocale',
  },
  'i-133': {
    title: 'Mouvement hors heures \u2014 Salles de conf 08e',
    sub: '2 d\u00e9tections \u00b7 22:40 et 23:05 \u00b7 aucun \u00e9v\u00e9nement de badge',
    sla: 'S\u00e9curit\u00e9 \u00b7 en revue',
    status: 'Clip signal\u00e9 pour revue matinale',
  },
  'i-134': {
    title: 'D\u00e9passement dur\u00e9e visiteur \u2014 J. Park (Trane)',
    sub: 'Arriv\u00e9e 09:14 \u00b7 sortie pr\u00e9vue 12:00 \u00b7 +2\u202fh\u202f10',
    sla: 'S\u00e9curit\u00e9 \u00b7 nominal',
    status: 'H\u00f4te Darnell notifi\u00e9',
  },
  'i-135': {
    title: 'Patrouille p\u00e9rim\u00e8tre \u2014 Boucle 14 termin\u00e9e',
    sub: 'Ivan \u00b7 22\u202fmin \u00b7 tous les points scann\u00e9s',
    sla: 'S\u00e9curit\u00e9 \u00b7 dans les temps',
    status: 'Consign\u00e9 dans la piste d\u2019audit',
  },
};

// ═══════════════════════════════════════════════════════════════════
// ECOSYSTEM INCIDENTS (from ecosystem-data.js)
// ═══════════════════════════════════════════════════════════════════
export const ECOSYSTEM_INCIDENTS_FR = {
  'ib-001': {
    title: '\u00c9cran hors ligne \u2014 Manhattan \u00b7 34th St',
    sub: 'Battement LTE perdu il y a 47\u202fmin \u00b7 agence ouvre \u00e0 08:30',
    sla: 'Op\u00e9rations \u00b7 \u00e0 risque',
    status: '\u00c9cran de remplacement d\u00e9p\u00each\u00e9 \u00b7 arriv\u00e9e 08:25',
  },
  'ib-002': {
    title: 'Fuite signal\u00e9e \u2014 Syracuse \u00b7 Westcott',
    sub: 'Client a appuy\u00e9 sur le bouton \u00ab\u202fFuite\u202f\u00bb \u00e0 14:02',
    sla: 'S\u00e9curit\u00e9 \u00b7 imm\u00e9diat',
    status: '\u00c9quipe de nettoyage redirig\u00e9e \u00b7 plombier notifi\u00e9',
  },
  'ib-003': {
    title: 'Tentative d\u2019effraction \u2014 Bronx \u00b7 Fordham',
    sub: 'Pic acc\u00e9l\u00e9rom\u00e9trique 2,4\u202fg \u00e0 03:17',
    sla: 'S\u00e9curit\u00e9 \u00b7 signal\u00e9',
    status: 'R\u00e9gional notifi\u00e9 \u00b7 directeur visionne le clip',
  },
  'ib-004': {
    title: 'Sortie nettoyage en retard \u2014 Brooklyn \u00b7 Park Slope',
    sub: 'Entr\u00e9e NFC \u00e0 10:18 \u00b7 dur\u00e9e pr\u00e9vue 20\u202fmin',
    sla: 'Hygi\u00e8ne \u00b7 escalade',
    status: 'Merlin a contact\u00e9 le chef d\u2019\u00e9quipe \u00b7 v\u00e9rification du bien-\u00eatre',
  },
  'ib-005': {
    title: 'Br\u00e8che SLA nettoyage \u2014 Buffalo \u00b7 Main St',
    sub: 'Dernier NFC v\u00e9rifi\u00e9 il y a 13\u202fh \u00b7 intervalle SLA 8\u202fh',
    sla: 'SLA Hygi\u00e8ne \u00b7 enfreint',
    status: 'Tourn\u00e9e prioritaire assign\u00e9e \u00b7 agent en route',
  },
  'ib-006': {
    title: 'Pic de notes basses \u2014 Kingston \u00b7 Chestnut Dr',
    sub: '3 notes sous 2\u2605 en 20\u202fmin \u00b7 aucun tap NFC depuis 11:40',
    sla: 'Client \u00b7 attention',
    status: 'Directeur + coordinateur nettoyage contact\u00e9s',
  },
  'ib-007': {
    title: 'Agent nettoyage absent \u2014 Watertown \u00b7 Main',
    sub: 'Aucun tap NFC avant 09:00 \u00b7 premi\u00e8re \u00e9quipe manqu\u00e9e',
    sla: 'Hygi\u00e8ne \u00b7 \u00e0 risque',
    status: '\u00c9quipe de secours d\u00e9p\u00each\u00e9e depuis le r\u00e9gional',
  },
  'ib-008': {
    title: 'Essuie-tout r\u00e9serve critique \u2014 Queens \u00b7 Northern Blvd',
    sub: '4 appuis \u00ab\u202fpapier bas\u202f\u00bb en 30\u202fmin',
    sla: 'SLA Consommables \u00b7 alerte',
    status: 'Recharge mercredi avanc\u00e9e \u00e0 aujourd\u2019hui',
  },
  'ib-009': {
    title: 'Lecteur NFC intermittent \u2014 Hicksville',
    sub: 'Taps agents d\u2019entretien qui \u00e9chouent \u00b7 3 essais requis',
    sla: 'Conformit\u00e9 \u00b7 \u00e0 risque',
    status: 'Technicien terrain programm\u00e9 \u00b7 remplacement demain',
  },
  'ib-010': {
    title: 'Savon manquant \u2014 Albany \u00b7 State St',
    sub: 'Client a appuy\u00e9 sur \u00ab\u202fsavon manquant\u202f\u00bb 2\u00d7',
    sla: 'SLA Consommables \u00b7 alerte',
    status: 'Agent le plus proche d\u00e9vi\u00e9 \u00b7 recharge ETA 35\u202fmin',
  },
  'ib-011': {
    title: 'Papier toilette bas \u2014 Manhattan \u00b7 Madison',
    sub: 'Bouton \u00ab\u202fpapier bas\u202f\u00bb + motif lumi\u00e8re cabine',
    sla: 'SLA Consommables \u00b7 ok',
    status: 'Planifi\u00e9 pour tourn\u00e9e de 14:30',
  },
  'ib-012': {
    title: 'Recharge gel hydroalcoolique \u2014 Poughkeepsie',
    sub: 'Bouton \u00ab\u202fRecharge\u202f\u00bb appuy\u00e9 3\u00d7 cette semaine',
    sla: 'SLA Consommables \u00b7 ok',
    status: 'Ajout\u00e9 au r\u00e9approvisionnement de demain',
  },
  'ib-013': {
    title: 'Afflux \u00ab\u202fdemande de nettoyage\u202f\u00bb \u2014 Yonkers \u00b7 Central',
    sub: '5 appuis en 25\u202fmin \u00b7 heure de forte affluence',
    sla: 'Hygi\u00e8ne \u00b7 surveillance',
    status: 'Prochain passage avanc\u00e9',
  },
  'ib-014': {
    title: 'Mise \u00e0 jour firmware bloqu\u00e9e \u2014 Buffalo \u00b7 Elmwood',
    sub: '4.13.0-rc2 coinc\u00e9 \u00e0 47\u202f% \u00b7 LTE faible',
    sla: 'Op\u00e9rations \u00b7 surveillance',
    status: 'R\u00e9essai planifi\u00e9 \u00e0 03:00',
  },
  'ib-015': {
    title: 'Batterie faible \u2014 Plattsburgh',
    sub: '8\u202f% restant \u00b7 remplacement group\u00e9 en tourn\u00e9e terrain',
    sla: 'SLA Batterie \u00b7 ok',
    status: 'Ajout\u00e9 \u00e0 la tourn\u00e9e jeudi d\u2019Alicia',
  },
  'ib-016': {
    title: 'Signal LTE d\u00e9grad\u00e9 \u2014 Jamestown',
    sub: 'RSRP \u2212108\u202fdBm \u00b7 perte de paquets 14\u202f%',
    sla: 'Op\u00e9rations \u00b7 surveillance',
    status: 'Re-provisionnement op\u00e9rateur demand\u00e9',
  },
  'ib-017': {
    title: 'Anomalie temp\u00e9rature toilettes \u2014 Elmira',
    sub: 'Capteur embarqu\u00e9 14,8\u202f\u00b0C \u00b7 inhabituel pour ce site',
    sla: 'Exploitation \u00b7 signal\u00e9',
    status: 'Directeur va v\u00e9rifier le CVC',
  },
  'ib-018': {
    title: 'Trou dans la piste d\u2019audit \u2014 Newburgh \u00b7 Broadway',
    sub: 'Sortie NFC d\u2019un agent manquante hier',
    sla: 'Conformit\u00e9 \u00b7 revue',
    status: 'Signal\u00e9 pour r\u00e9conciliation hebdo',
  },
  'ib-019': {
    title: 'Note en baisse \u2014 Schenectady',
    sub: 'Moyenne 7\u202fj 3,6\u2605 (vs 4,1\u2605) \u00b7 cause peu claire',
    sla: 'Client \u00b7 analyse',
    status: 'Merlin lance l\u2019analyse de cause',
  },
  'ib-020': {
    title: 'Pic d\u2019appuis boutons \u2014 Brooklyn \u00b7 Bay Ridge',
    sub: '18 \u00e9v\u00e9nements en 10\u202fmin \u00b7 au-dessus du 99e percentile',
    sla: 'Op\u00e9rations \u00b7 surveillance',
    status: 'Classifi\u00e9 \u00ab\u202ffoule d\u2019\u00e9v\u00e9nement\u202f\u00bb \u00b7 aucune action',
  },
  'ib-021': {
    title: 'Satisfaction r\u00e9gionale en hausse \u2014 Ouest NY',
    sub: '+0,12\u2605 vs semaine pass\u00e9e sur 60 agences',
    sla: 'Signal de succ\u00e8s',
    status: 'Alimente le rapport hebdo',
  },
  'ib-022': {
    title: 'Nouvel \u00e9cran mis en service \u2014 Poughkeepsie',
    sub: 'Lien LTE v\u00e9rifi\u00e9 \u00b7 premier tap NFC consign\u00e9',
    sla: 'D\u00e9ploiement',
    status: 'Ajout\u00e9 au suivi de la flotte',
  },
  'ib-023': {
    title: 'Audit conformit\u00e9 termin\u00e9 \u2014 \u00c9tat de NY',
    sub: '576 sur 578 pr\u00eats \u00b7 2 \u00e0 r\u00e9concilier',
    sla: 'Conformit\u00e9 \u00b7 termin\u00e9',
    status: 'Rapport trimestriel livr\u00e9',
  },
  'ib-024': {
    title: 'Taps NFC nettoyage \u2014 \u00e9cosyst\u00e8me aujourd\u2019hui',
    sub: '1\u202f842 nettoyages v\u00e9rifi\u00e9s \u00b7 +8\u202f% vs mardi',
    sla: 'Hygi\u00e8ne',
    status: 'Consign\u00e9 dans la piste d\u2019audit',
  },
  'ib-025': {
    title: 'Merlin a r\u00e9solu une alerte effraction \u2014 Rochester \u00b7 Park',
    sub: 'Signature acc\u00e9l\u00e9rom\u00e9trique correspond au mouvement d\u2019agent connu',
    sla: 'S\u00e9curit\u00e9 \u00b7 lev\u00e9',
    status: 'Ignor\u00e9 automatiquement apr\u00e8s 12\u202fmin de revue',
  },
};

// ═══════════════════════════════════════════════════════════════════
// AGENTS (from data.js)
// ═══════════════════════════════════════════════════════════════════
export const AGENTS_FR = {
  cleaning: { name: 'Nettoyage & Hygi\u00e8ne', tag: '6 tourn\u00e9es dispatch\u00e9es aujourd\u2019hui' },
  hvac: { name: 'CVC & Confort', tag: '3 ajustements de consigne' },
  space: { name: 'Gestion des espaces', tag: '4 r\u00e9servations fant\u00f4mes lib\u00e9r\u00e9es' },
  supply: { name: 'Consommables & Stock', tag: '2 SKU r\u00e9approvisionn\u00e9s' },
  compliance: { name: 'Conformit\u00e9', tag: '41 nettoyages consign\u00e9s via NFC' },
  energy: { name: '\u00c9nergie', tag: '\u00c9talonnage de r\u00e9f\u00e9rence' },
  security: { name: 'S\u00e9curit\u00e9 & S\u00fbret\u00e9', tag: '4 contr\u00f4les hors heures' },
};

// ═══════════════════════════════════════════════════════════════════
// SLAS (from data.js)
// ═══════════════════════════════════════════════════════════════════
export const SLAS_FR = {
  s1: 'Hygi\u00e8ne \u2014 R\u00e9ponse < 20\u202fmin',
  s2: 'Confort \u2014 Temp \u00b12\u202f\u00b0C',
  s3: 'Qualit\u00e9 de l\u2019air \u2014 CO\u2082 < 900',
  s4: 'Consommables \u2014 0 rupture',
};

// ═══════════════════════════════════════════════════════════════════
// CONVERSATIONS (sidebar)
// ═══════════════════════════════════════════════════════════════════
export const CONVERSATIONS_FR = {
  c1: { title: 'Pourquoi les toilettes du 32e sont toujours signal\u00e9es\u202f?', when: 'il y a 2\u202fmin' },
  c2: { title: 'Pr\u00e9parer les salles du conseil de lundi', when: 'il y a 1\u202fh' },
  c3: { title: 'Revue trimestrielle du SLA Hygi\u00e8ne', when: 'Hier' },
  c4: { title: 'R\u00e9diger l\u2019agent nettoyage de la nouvelle salle de sport', when: 'Mar.' },
  c5: { title: 'Analyse pic \u00e9nergie \u2014 semaine derni\u00e8re', when: 'Lun.' },
  c6: { title: 'Accueil nouveau Maria \u2014 checklist', when: '14 mars' },
};

// ═══════════════════════════════════════════════════════════════════
// INSIGHT CATEGORIES (label only — id, icon, tone stay in English)
// ═══════════════════════════════════════════════════════════════════
export const INSIGHT_CATEGORIES_FR = {
  cleaning: 'Nettoyage',
  energy: '\u00c9nergie',
  supply: 'Consommables',
  space: 'Espaces',
  maintenance: 'Maintenance',
  compliance: 'Conformit\u00e9',
  reliability: 'Fiabilit\u00e9',
  lighting: '\u00c9clairage',
  security: 'S\u00e9curit\u00e9',
  satisfaction: 'Satisfaction',
};

// ═══════════════════════════════════════════════════════════════════
// INSIGHTS HQ (from insights-data.js → INSIGHTS_HQ)
// ═══════════════════════════════════════════════════════════════════
export const INSIGHTS_HQ_FR = {
  'in-001': {
    title: 'Dispatch nettoyage dynamique pour les \u00e9tages 28\u201332',
    summary:
      'Passer d\u2019un planning fixe \u00e0 3 passages \u00e0 un dispatch selon l\u2019affluence. \u00c9conomise 2\u202fh d\u2019\u00e9quipe par \u00e9tage par jour sans enfreindre le SLA Hygi\u00e8ne.',
    secondary_impact: '\u22122\u202fh d\u2019\u00e9quipe / \u00e9tage / jour',
    reasoning: [
      'Les cartes d\u2019occupation sur 90\u202fj montrent que les toilettes des \u00e9tages 28\u201332 ne saturent qu\u2019entre 14:00 et 15:00',
      'Planning actuel\u202f: passages \u00e0 10:00, 14:00 et 18:00 quelle que soit l\u2019affluence',
      'Recommand\u00e9\u202f: dispatch d\u00e9clench\u00e9 par NFC quand l\u2019occupation atteint 12 visiteurs',
      'Le mod\u00e8le pr\u00e9voit 2,1 nettoyages/jour (vs 3 actuellement), respectant le SLA Hygi\u00e8ne de 20\u202fmin dans 98,6\u202f% des cas',
    ],
    dataSources: [
      'Capteurs d\u2019occupation \u00b7 90\u202fj',
      'Journaux NFC',
      'R\u00e9sultats SLA 90\u202fj',
      'Notes clients',
    ],
    implementation: [
      { when: '2 semaines', what: 'D\u00e9ployer le moteur de dispatch dynamique sur les \u00e9tages 28\u201332' },
      { when: '2 semaines', what: 'Comparer SLA + notes avec le planning actuel' },
      { when: '1 mois', what: 'Extension aux \u00e9tages 1\u201327 si les m\u00e9triques se maintiennent' },
    ],
  },
  'in-002': {
    title: 'R\u00e9duit CVC le week-end \u2014 tour enti\u00e8re',
    summary:
      '78\u202f% de l\u2019occupation du week-end est sous 10\u202f%. Automatiser la d\u00e9rive de consigne \u00e0 18\u201326\u202f\u00b0C sam./dim. au lieu du 22\u202f\u00b0C fixe actuel.',
    secondary_impact: '\u221212\u202f% kWh week-end',
    reasoning: [
      'L\u2019occupation sur 3 ans de week-ends est de 7,8\u202f% en moyenne (pic 11\u202f% samedi matin)',
      'Le SLA Confort de \u00b12\u202f\u00b0C ne s\u2019applique qu\u2019aux heures ouvr\u00e9es',
      'Bande recommand\u00e9e week-end\u202f: 18\u201326\u202f\u00b0C \u00b7 retour \u00e0 22\u202f\u00b0C avant 06:30 lundi',
      'R\u00e9duction kWh mod\u00e9lis\u00e9e\u202f: \u221212\u202f% charge week-end \u2192 31\u202f400\u202f$/an au tarif actuel',
    ],
    dataSources: ['Badges 3\u202fans', 'T\u00e9l\u00e9m\u00e9trie CVC', 'Relev\u00e9s compteurs', 'SLA Confort'],
    implementation: [
      { when: '1 semaine', what: 'Programmer le planning week-end dans la GTB \u00b7 pilote par zone' },
      { when: '1 mois', what: 'Ex\u00e9cuter en Zone C seule \u00b7 comparer vs Zone B comme contr\u00f4le' },
      { when: '2 mois', what: '\u00c9tendre \u00e0 toute la tour si les \u00e9conomies kWh se confirment' },
    ],
  },
  'in-003': {
    title: 'Lib\u00e9ration automatique des r\u00e9servations fant\u00f4mes apr\u00e8s 15\u202fmin',
    summary:
      'La salle Platane est r\u00e9serv\u00e9e mais inutilis\u00e9e 60\u202f% du temps. Resserrer la fen\u00eatre d\u2019auto-lib\u00e9ration de 30 \u00e0 15\u202fmin r\u00e9cup\u00e8re 240\u202fh/an pour d\u2019autres \u00e9quipes.',
    secondary_impact: '+240\u202fh de r\u00e9union/an r\u00e9cup\u00e9r\u00e9es',
    reasoning: [
      'CO\u2082 + d\u00e9tection de mouvement montrent que 60\u202f% des r\u00e9servations Platane ne sont pas utilis\u00e9es (<2\u202fmin de pr\u00e9sence)',
      'La lib\u00e9ration automatique actuelle se d\u00e9clenche \u00e0 30\u202fmin \u2014 la r\u00e9union est d\u00e9j\u00e0 \u00e0 moiti\u00e9 pass\u00e9e',
      'Resserrer \u00e0 15\u202fmin r\u00e9cup\u00e8re ~2\u202fh/jour par salle, recompl\u00e9t\u00e9es via la file',
      'SLA utilisation\u202f: notes des organisateurs relib\u00e9r\u00e9s inchang\u00e9es historiquement',
    ],
    dataSources: [
      'API r\u00e9servations',
      'Capteurs d\u2019occupation',
      'Seuils CO\u2082',
      'Historique lib\u00e9rations',
    ],
    implementation: [
      { when: '2 jours', what: 'Mettre \u00e0 jour la r\u00e8gle dans la plateforme exploitation' },
      { when: '2 semaines', what: 'A/B sur 4 salles \u00b7 mesurer le taux fant\u00f4me' },
      { when: '1 mois', what: 'D\u00e9ployer \u00e0 toute la tour \u00b7 avertir les organisateurs 24\u202fh avant' },
    ],
  },
  'in-004': {
    title: 'Transf\u00e9rer un agent du vendredi apr\u00e8s-midi aux mardi/mercredi matins',
    summary:
      'L\u2019affluence vendredi 15:00\u201318:00 est 40\u202f% plus faible que les pics lundi/mardi. R\u00e9allouer un agent lisse le SLA sans embauche.',
    secondary_impact: '\u221218\u202f% quasi-br\u00e8ches lun./mar.',
    reasoning: [
      'Les comptes de badge montrent les vendredis apr\u00e8s-midis \u00e0 41\u202f% sous les pics lundi/mardi',
      'Les quasi-br\u00e8ches SLA historiques se concentrent lun. 09:30\u201311:00 et mar. 09:30\u201311:00',
      'Transf\u00e9rer un agent ferme 18\u202f% de ces quasi-br\u00e8ches',
      'Aucun co\u00fbt heures suppl\u00e9mentaires\u202f: r\u00e9\u00e9quilibrage dans les heures hebdo',
    ],
    dataSources: ['Badges 12\u202fmois', 'Rotations \u00e9quipes', 'Minutages NFC'],
    implementation: [
      { when: '3 jours', what: 'Publier la nouvelle rotation \u00b7 confirmer avec le chef d\u2019\u00e9quipe' },
      { when: '4 semaines', what: 'Suivre SLA + retours \u00e9quipe' },
    ],
  },
  'in-005': {
    title: 'Regrouper les consommables hygi\u00e8ne en commandes trimestrielles',
    summary:
      'Fusionner les commandes mensuelles de savon + essuie-tout en commandes trimestrielles d\u00e9bloque 12\u202f% de remise volume chez le fournisseur actuel.',
    secondary_impact: '\u22128 points de contact fournisseur/an',
    reasoning: [
      'Cadence actuelle\u202f: 12 commandes savon + 12 essuie-tout par an',
      'Le fournisseur offre \u221212\u202f% \u00e0 partir de 3\u202fmois de volume, avec placement palette gratuit',
      'Le local stockage dispose de 14\u202fm\u00b3 inutilis\u00e9s \u2014 suffisant pour 1,5 trimestre',
      'Aucun risque de p\u00e9remption (savon + papier se conservent bien au sec)',
    ],
    dataSources: [
      'Devis fournisseur',
      'Historique commandes 12\u202fmois',
      'Plan local stockage',
      'Taux de consommation',
    ],
    implementation: [
      { when: '1 semaine', what: 'Obtenir le devis trimestriel sign\u00e9 du fournisseur' },
      { when: '2 semaines', what: 'Premi\u00e8re commande bulk \u00b7 mettre \u00e0 jour les seuils Merlin' },
    ],
  },
  'in-006': {
    title: 'Cadence dynamique par zone pour les filtres CTA',
    summary:
      'Les donn\u00e9es particulaires montrent que les zones plus propres peuvent aller \u00e0 3\u202f200\u202fh entre changements de filtre, vs la cadence plate actuelle de 2\u202f000\u202fh.',
    secondary_impact: '\u221240\u202f% SKU filtres consomm\u00e9s',
    reasoning: [
      'Les courbes de perte de charge de 12 CTA montrent une forte variance (Zone A se d\u00e9grade 40\u202f% plus vite que Zone C)',
      'La cadence plate actuelle de 2\u202f000\u202fh sur-entretient 7 des 12 CTA',
      'Cadence dynamique par zone bas\u00e9e sur seuil \u0394P pr\u00e9serve la qualit\u00e9 de l\u2019air',
      'Moins de filtres + moins d\u2019interventions \u2192 6\u202f700\u202f$/an',
    ],
    dataSources: [
      'Capteurs pression CTA',
      'Co\u00fbts SKU filtres',
      'Journaux service Trane',
      'R\u00e9sultats CO\u2082',
    ],
    implementation: [
      {
        when: '2 semaines',
        what: 'Merlin \u00e9met les demandes de service d\u00e9clench\u00e9es \u00e0 \u0394P par zone',
      },
      { when: '3 mois', what: 'Comparer CO\u2082 + SLA Confort \u00e0 la r\u00e9f\u00e9rence actuelle' },
    ],
  },
  'in-007': {
    title: 'Supprimer le journal papier de nettoyage \u2014 la piste NFC couvre SOC 2',
    summary:
      'Chaque \u00e9v\u00e9nement de nettoyage est d\u00e9j\u00e0 v\u00e9rifi\u00e9 NFC avec horodatages. Le journal papier que Priya maintient peut \u00eatre retir\u00e9, \u00e9conomisant ~6\u202fh/semaine.',
    secondary_impact: '6\u202fh/semaine de travail conformit\u00e9 r\u00e9cup\u00e9r\u00e9es',
    reasoning: [
      'Le contr\u00f4le SOC 2 CC-6.2 exige un \u00ab\u202fregistre inviolable\u202f\u00bb \u2014 tap NFC + piste d\u2019audit scell\u00e9e satisfont cela',
      'Le juridique a valid\u00e9 l\u2019\u00e9quivalence lors de la revue conformit\u00e9 Q1',
      'Le journal papier duplique 100\u202f% de ce que NFC capture d\u00e9j\u00e0',
      'Priya passe actuellement ~6\u202fh/semaine \u00e0 r\u00e9concilier les deux',
    ],
    dataSources: [
      'Matrice contr\u00f4les SOC 2',
      'M\u00e9mo juridique Q1',
      'Piste d\u2019audit NFC',
      'Feuille de temps Priya',
    ],
    implementation: [
      {
        when: '1 semaine',
        what: 'Mettre \u00e0 jour le playbook conformit\u00e9 \u00b7 notifier l\u2019\u00e9quipe de Priya',
      },
      { when: 'continu', what: 'L\u2019audit hebdo s\u2019appuie d\u00e9sormais directement sur la piste NFC' },
    ],
  },
  'in-008': {
    title: '\u00c9clairage \u00e0 d\u00e9tection de mouvement pour Parking N3',
    summary:
      'Parking niveau 3 \u00e9claire 06:00\u201322:00 quelle que soit l\u2019activit\u00e9. Activation PIR r\u00e9duit la consommation \u00e9clairage de cette zone de 35\u202f%.',
    secondary_impact: '\u221235\u202f% kWh \u00e9clairage parking N3',
    reasoning: [
      '16\u202fh de fonctionnement quotidien pour une zone avec 4,2\u202fh de trafic r\u00e9el moyen',
      'PIR + temporisation 5\u202fmin couvrent les exigences s\u00e9curit\u00e9 (OSHA valid\u00e9)',
      'Co\u00fbt mat\u00e9riel amorti en 9\u202fmois au tarif actuel',
    ],
    dataSources: ['Donn\u00e9es capteurs PIR', 'Sous-compteurs kWh', 'Notes revue OSHA'],
    implementation: [
      { when: 'termin\u00e9', what: 'Aval OSHA + assurance obtenus' },
      { when: '2 semaines', what: '\u00c9lectricien installe les relais PIR sur 4 circuits' },
    ],
  },
  'in-009': {
    title: 'Regrouper les 6 prochaines interventions en 2 visites',
    summary:
      'Merlin a programm\u00e9 6 visites Trane + OTIS sur les 30 prochains jours. Les regrouper en 2 visites combin\u00e9es \u00e9conomise 4 frais de d\u00e9placement.',
    secondary_impact: '\u22124 d\u00e9placements fournisseurs',
    reasoning: [
      '6 ordres de travail actuellement planifi\u00e9s sur 4 semaines\u202f: 3 Trane + 2 OTIS + 1 Siemens',
      'Chaque fournisseur facture 200\u202f$ de d\u00e9placement quel que soit le p\u00e9rim\u00e8tre',
      'Consolider en 2 visites (sem.\u202f1, sem.\u202f4) pr\u00e9serve les fen\u00eatres d\u2019urgence',
    ],
    dataSources: ['File d\u2019ordres de travail', 'Contrats fournisseurs', 'Exigences fen\u00eatres service'],
    implementation: [
      { when: '2 jours', what: 'Coordonner avec dispatch Trane + OTIS' },
      {
        when: '1 semaine',
        what: 'Premi\u00e8re visite group\u00e9e \u00b7 premi\u00e8res \u00e9conomies r\u00e9alis\u00e9es',
      },
    ],
  },
  'in-010': {
    title: 'Consigne \u00e9t\u00e9 +1\u202f\u00b0C, juin\u2013ao\u00fbt',
    summary:
      '3 ans d\u2019enqu\u00eates confort montrent que +1\u202f\u00b0C de juin \u00e0 ao\u00fbt ne d\u00e9clenche pas de plaintes. R\u00e9duit la charge de climatisation ~8\u202f%.',
    secondary_impact: '\u22128\u202f% kWh climatisation \u00e9t\u00e9',
    reasoning: [
      '3\u202fans d\u2019enqu\u00eates confort montrent un taux de plaintes plat entre 22\u201324\u202f\u00b0C',
      'L\u2019enveloppe ASHRAE 55 couvre notre bande propos\u00e9e +1\u202f\u00b0C',
      'R\u00e9duction de 8\u202f% en climatisation \u00e9chelle selon le mod\u00e8le co\u00fbt-par-degr\u00e9 DOE',
    ],
    dataSources: ['Enqu\u00eates confort 3\u202fans', 'Tables ASHRAE 55', 'Dur\u00e9e CVC'],
    implementation: [
      { when: '1 semaine', what: 'Mettre \u00e0 jour le planning saisonnier dans la GTB' },
      { when: 'continu', what: 'Surveiller la file de plaintes confort hebdo' },
    ],
  },
  'in-011': {
    title: 'Pr\u00e9-commander 12 capteurs QA avant d\u00e9rive d\u2019\u00e9talonnage',
    summary:
      'La d\u00e9rive d\u2019\u00e9talonnage sur 12 capteurs QA pr\u00e9dit une panne dans 45\u202fj. Commander maintenant \u00e9vite l\u2019exp\u00e9dition express (+35\u202f%).',
    secondary_impact: '\u00c9vite 4\u202fj de gap appareil',
    reasoning: [
      'Les motifs de d\u00e9rive de 12 capteurs QA correspondent \u00e0 la signature de panne de 2024',
      'Livraison standard 5\u202fj ouvr\u00e9s\u202f; express 2\u202fj \u00e0 +35\u202f%',
      'Pr\u00e9-commander en standard arrive avant la fen\u00eatre de panne pr\u00e9dite',
    ],
    dataSources: ['Journaux \u00e9talonnage capteurs', 'Registre pannes 2024', 'Co\u00fbts livraison Adaptiv'],
    implementation: [
      { when: '1 jour', what: 'Ajouter 12 ADX-AQ-3 au PO-2041 exploitation' },
      { when: '1 semaine', what: 'Arriv\u00e9e des appareils \u00b7 Merlin les appaire en file fant\u00f4me' },
    ],
  },
  'in-012': {
    title: 'Promouvoir le firmware v4.13.0-rc2 en stable',
    summary:
      '576 \u00e9crans sur 578 sur le candidat depuis 72\u202fh, 0 r\u00e9gression. Passer en stable d\u00e9bloque la lecture NFC 15\u202f% plus rapide et l\u2019\u00e9talonnage temp par zone.',
    secondary_impact: 'Lecture NFC 15\u202f% plus rapide \u00b7 \u00e9talonnage temp par zone',
    reasoning: [
      '99,65\u202f% de la flotte sur la release candidate',
      '0 r\u00e9gression consign\u00e9e sur 72\u202fh, 3 correctifs cosm\u00e9tiques livr\u00e9s',
      'Charge fonctionnelle\u202f: vitesse de lecture NFC, API r\u00e9\u00e9talonnage temp par zone, sortie de veille plus rapide',
    ],
    dataSources: [
      'T\u00e9l\u00e9m\u00e9trie firmware',
      'Tableau de bord r\u00e9gressions',
      'Journal des modifications',
    ],
    implementation: [
      { when: '1 jour', what: 'Promouvoir le tag stable-4.13.0 \u00b7 notifier le change board' },
      { when: '1 semaine', what: 'D\u00e9ploiement auto des 0,35\u202f% restants au prochain battement' },
    ],
  },
  'in-013': {
    title: 'G\u00e9n\u00e9rer automatiquement le rapport hebdo de badges hors heures',
    summary:
      'Merlin dispose d\u00e9j\u00e0 de chaque tap de badge hors heures avec son contexte. Remplacer le rapport manuel qu\u2019Ivan assemble le vendredi par un PDF auto-g\u00e9n\u00e9r\u00e9.',
    secondary_impact: '4\u202fh/semaine de travail s\u00e9curit\u00e9 r\u00e9cup\u00e9r\u00e9es',
    reasoning: [
      'Le responsable s\u00e9curit\u00e9 passe ~4\u202fh chaque vendredi \u00e0 compiler le rapport badges hors heures',
      'Chaque \u00e9v\u00e9nement est d\u00e9j\u00e0 dans la piste NFC + badges avec h\u00f4te, dur\u00e9e et liens vid\u00e9o',
      'Le mod\u00e8le correspond octet-pour-octet au livrable du trimestre pass\u00e9 \u2014 juridique a pr\u00e9-valid\u00e9',
      'Livraison vendredi 08:00 \u00e0 la m\u00eame liste de parties prenantes',
    ],
    dataSources: [
      'Piste d\u2019audit badges',
      'Index clips cam\u00e9ras',
      'Mod\u00e8le rapport trimestre pass\u00e9',
      'Liste diffusion s\u00e9curit\u00e9',
    ],
    implementation: [
      { when: '3 jours', what: 'Brancher le g\u00e9n\u00e9rateur au flux badges \u00b7 1\u202fsem. dry-run' },
      { when: '2 semaines', what: 'Livraison r\u00e9elle \u00b7 Ivan revoit avant le premier envoi auto' },
    ],
  },
  'in-014': {
    title: 'Ajuster le seuil de d\u00e9tection talonnage sur Tourniquet 2',
    summary:
      'La sensibilit\u00e9 actuelle g\u00e9n\u00e8re 3\u00d7 plus de faux positifs que les tourniquets voisins. Un r\u00e9glage par tourniquet r\u00e9duit le bruit sans rater d\u2019\u00e9v\u00e9nement r\u00e9el.',
    secondary_impact: '3\u202fh/semaine de revue vid\u00e9o \u00e9conomis\u00e9es',
    reasoning: [
      'Le Tourniquet 2 d\u00e9clenche le d\u00e9tecteur de talonnage ~40\u202f% plus que les Tourniquets 1, 3 et 4',
      'Revue 90\u202fj\u202f: 87\u202f% des alertes T2 \u00e9taient faux positifs (deux personnes proches, pas un talonnage)',
      'Les tourniquets voisins utilisent un seuil d\u2019intervalle plus serr\u00e9 qui maintient le taux de vrais positifs \u00e0 99\u202f%',
      'Merlin peut appliquer la m\u00eame r\u00e9f\u00e9rence par tourniquet automatiquement, revue hebdo',
    ],
    dataSources: [
      'Journaux d\u00e9tecteur talonnage 90\u202fj',
      'R\u00e9f\u00e9rences tourniquets voisins',
      'R\u00e9sultats revue manuelle',
    ],
    implementation: [
      { when: '2 jours', what: 'Appliquer le seuil des tourniquets voisins \u00e0 T2 \u00b7 mode observation' },
      {
        when: '2 semaines',
        what: 'Comparer observation vs r\u00e9el \u00b7 basculer si le taux de vrais positifs tient',
      },
    ],
  },
  // \u2500\u2500\u2500 Wellbeing track \u2500\u2500\u2500 (occupant comfort, satisfaction, retention)
  'in-w001': {
    title: 'Restaurer la satisfaction des toilettes hommes 24e (2,0\u2605 \u2192 3,7\u2605)',
    summary:
      'Les toilettes hommes du 24e affichent une moyenne de 2,0\u2605 depuis 6 semaines. Trois causes\u202f: ruptures d\u2019essuie-tout, pics d\u2019odeur en milieu d\u2019apr\u00e8s-midi, lecteur NFC intermittent. Un correctif cibl\u00e9 augmente la note d\u2019environ 1,7\u2605.',
    secondary_impact: '\u22128 plaintes/mois pr\u00e9vues',
    reasoning: [
      'Note glissante 6\u202fsemaines\u202f: 2,0\u2605 \u00b7 plus de 30\u202fnotes/semaine',
      'Les commentaires se r\u00e9partissent en trois causes\u202f: 42\u202f% \u00ab\u202fpas d\u2019essuie-tout\u202f\u00bb, 28\u202f% \u00ab\u202fmauvaises odeurs\u202f\u00bb, 18\u202f% \u00ab\u202fne scanne pas\u202f\u00bb',
      'Des \u00e9tages comparables sont remont\u00e9s \u00e0 3,7\u2605 en 21\u202fjours apr\u00e8s le m\u00eame correctif en 3\u202f\u00e9tapes',
      'L\u2019\u00e9quipe Marque estime qu\u2019un gain d\u20191\u2605 retient ~3 collaborateurs/an \u00e0 cette densit\u00e9 d\u2019\u00e9tage',
    ],
    dataSources: [
      'Notes toilettes 90\u202fj',
      'Analyse texte des commentaires',
      'Disponibilit\u00e9 lecteur NFC',
      'Journaux capteurs COV',
    ],
    implementation: [
      { when: '3 jours', what: 'Remplacer le lecteur NFC \u00b7 passer \u00e0 deux remplissages essuie-tout par jour' },
      {
        when: '1 semaine',
        what: 'R\u00e9gler le boost de ventilation d\u00e9clench\u00e9 par COV (fen\u00eatre apr\u00e8s-midi)',
      },
      { when: '1 mois', what: 'Mesurer l\u2019\u00e9volution note + commentaires vs \u00e9tage de contr\u00f4le' },
    ],
  },
  'in-w002': {
    title: 'R\u00e9duire les fuites sonores mardi/mercredi apr\u00e8s-midi vers les zones de concentration',
    summary:
      'Les pods collaboratifs ouverts des \u00e9tages 28, 30, 32 atteignent 72\u202fdB le mar./mer. 14:00\u201316:00 et fuient vers les zones de concentration adjacentes. D\u00e9placer les r\u00e9servations 30\u202fmin plus t\u00f4t lib\u00e8re la fen\u00eatre concentration.',
    secondary_impact: '\u221218\u202fdB cr\u00eate dans les zones de concentration',
    reasoning: [
      'Les capteurs acoustiques montrent que les pics des zones de concentration co\u00efncident \u00e0 100\u202f% avec l\u2019usage des pods le mar./mer. apr\u00e8s-midi',
      'Carte de chaleur des r\u00e9servations\u202f: 71\u202f% des conflits collab d\u00e9marrent \u00e0 14:00 pile',
      'D\u00e9caler \u00e0 13:30 lib\u00e8re la fen\u00eatre concentration apr\u00e8s d\u00e9jeuner',
      'Le sondage People Ops T1 a plac\u00e9 \u00ab\u202fbruit l\u2019apr\u00e8s-midi\u202f\u00bb en t\u00eate des plaintes (44\u202fmentions)',
    ],
    dataSources: [
      'Capteurs acoustiques 60\u202fj',
      'Motifs de r\u00e9servations',
      'Sondage People Ops T1',
      'Occupation zones de concentration',
    ],
    implementation: [
      {
        when: '1 semaine',
        what: 'Mettre l\u2019heure d\u00e9faut des pods collab \u00e0 13:30 \u00b7 notifier les organisateurs',
      },
      { when: '1 mois', what: 'Comparer dB zones concentration + taux de plaintes vs r\u00e9f\u00e9rence' },
    ],
  },
  'in-w003': {
    title: 'Pr\u00e9-conditionner la salle du conseil 2\u202fh avant les r\u00e9unions matinales',
    summary:
      'Le CO\u2082 de la salle du conseil grimpe \u00e0 1\u202f050\u202fppm en 25\u202fmin apr\u00e8s un d\u00e9but \u00e0 8\u202fh. Une purge anticip\u00e9e d\u00e8s 06:00 maintient le CO\u2082 sous 700 toute la r\u00e9union et augmente les notes de confort d\u2019environ 0,6\u2605.',
    secondary_impact: 'CO\u2082 < 700\u202fppm pendant toute la r\u00e9union',
    reasoning: [
      'Le capteur CO\u2082 de la salle du conseil montre une mont\u00e9e rapide depuis une r\u00e9f\u00e9rence nuit \u00e0 600\u202fppm',
      'Sur 60\u202fjours, 38\u202f% des r\u00e9unions board avant 9\u202fh sont tagu\u00e9es \u00ab\u202fair lourd\u202f\u00bb',
      'Mod\u00e8le de pr\u00e9-conditionnement\u202f: pouss\u00e9e ventilation 06:00\u201307:55 ram\u00e8ne la r\u00e9f\u00e9rence \u00e0 480\u202fppm',
      'Co\u00fbt incr\u00e9mental kWh estim\u00e9 n\u00e9gligeable (compens\u00e9 par le r\u00e9duit en journ\u00e9e)',
    ],
    dataSources: ['Capteur CO\u2082 (salle conseil)', 'Notes confort', 'Planning GTB', 'Compteur \u00e9nergie'],
    implementation: [
      { when: '2 jours', what: 'Ajouter une \u00e9tape de pr\u00e9-purge \u00e0 06:00 au planning GTB de la salle' },
      { when: '2 semaines', what: 'Comparer la trace CO\u2082 + notes vs semaines de r\u00e9f\u00e9rence' },
    ],
  },
  'in-w004': {
    title: 'Ajouter une signal\u00e9tique d\u2019orientation pr\u00e8s des ascenseurs Est du 32e \u00e9tage',
    summary:
      'L\u2019accueil enregistre 6\u20137 demandes/mois \u00ab\u202fcomment aller \u00e0 l\u2019aile Est\u202f\u00bb. Une signal\u00e9tique permanente r\u00e9sout le motif pour un co\u00fbt unique.',
    secondary_impact: '~3\u202fh d\u2019accueil r\u00e9cup\u00e9r\u00e9es/mois',
    reasoning: [
      'Journal accueil 6\u202fmois\u202f: 39 demandes d\u2019orientation visiteurs, 87\u202f% au 32e Est',
      'Ambigu\u00eft\u00e9 du plan d\u2019\u00e9tage\u202f: l\u2019ascenseur s\u2019ouvre sur un long couloir \u00e0 3\u202fembranchements non sign\u00e9s',
      'Le m\u00eame motif a \u00e9t\u00e9 r\u00e9solu au 28e en 2024 avec un seul panneau de signal\u00e9tique',
      'Co\u00fbt unique signal\u00e9tique ~420\u202f$ \u00b7 \u00e9conomie horaire annualis\u00e9e ~36\u202fh d\u2019accueil',
    ],
    dataSources: [
      'Journal accueil 6\u202fmois',
      'Plan d\u2019\u00e9tage',
      'Cas Floor 28',
      'Carte de chaleur visiteurs',
    ],
    implementation: [
      { when: '1 semaine', what: 'Approuver le design \u00b7 commander chez le fournisseur du Floor 28' },
      { when: '3 semaines', what: 'Pose \u00b7 surveiller le journal accueil pour mesurer l\u2019\u00e9volution' },
    ],
  },
  'in-w005': {
    title: 'R\u00e9\u00e9quilibrer le confort thermique des toilettes femmes 18e',
    summary:
      'Les toilettes femmes du 18e ont tenu une note confort thermique de 1,8\u2605 en mars (\u00ab\u202ftrop froid\u202f\u00bb). Le mod\u00e8le de r\u00e9\u00e9quilibrage des registres CTA monte \u00e0 ~3,5\u2605 sans toucher aux zones adjacentes.',
    secondary_impact: '\u221214 signalements \u00ab\u202ftrop froid\u202f\u00bb/mois',
    reasoning: [
      'Notes confort thermique (60\u202fjours)\u202f: 1,8\u2605 avec 73\u202f% des commentaires tagu\u00e9s \u00ab\u202ftrop froid\u202f\u00bb',
      'Capteur de zone\u202f: 19,2\u202f\u00b0C en moyenne vs 22\u202f\u00b0C de consigne \u2014 d\u00e9s\u00e9quilibre des registres',
      'Mod\u00e8le CFD\u202f: une correction de 28\u202f% sur la position des registres restaure la consigne sans d\u00e9bordement',
      'Zone adjacente (toilettes hommes 18e) \u00e0 23\u202f\u00b0C\u202f; le r\u00e9\u00e9quilibrage les ram\u00e8ne toutes deux \u00e0 \u00b10,4\u202f\u00b0C',
    ],
    dataSources: [
      'Notes confort 60\u202fj',
      'T\u00e9l\u00e9m\u00e9trie temp\u00e9rature de zone',
      'Mod\u00e8le CFD r\u00e9\u00e9quilibrage',
      'Journaux registres CTA',
    ],
    implementation: [
      { when: '1 semaine', what: 'Le technicien Trane r\u00e9gle les registres \u00b7 visite unique' },
      { when: '3 semaines', what: 'Mesurer notes + delta temp\u00e9rature vs r\u00e9f\u00e9rence mars' },
    ],
  },
  'in-w006': {
    title: 'Ouvrir Platane en d\u00e9bord silencieux pendant le bloc concentration',
    summary:
      'La salle Platane est vide 71\u202f% des apr\u00e8s-midis en semaine. La d\u00e9verrouiller en d\u00e9bord silencieux drop-in pendant le bloc concentration commun 14:00\u201316:00 ajoute 6\u202fplaces calmes.',
    secondary_impact: '+6 places calmes/jour pendant le bloc concentration',
    reasoning: [
      'Utilisation r\u00e9servation Platane\u202f: 29\u202f% les mar.\u2013jeu. apr\u00e8s-midi',
      'La file d\u2019attente zones de concentration moyenne 5\u202fnoms pendant 14:00\u201316:00',
      'Pas de conflit avec le syst\u00e8me\u202f: le hold redevient r\u00e9servable \u00e0 16:00',
      'Le canal Slack #zone-concentration compte 14 messages/mois \u00ab\u202fdes places libres\u202f?\u202f\u00bb',
    ],
    dataSources: [
      'Utilisation r\u00e9servation Platane',
      'Occupation zones concentration',
      'Slack #zone-concentration',
      'API r\u00e9servations',
    ],
    implementation: [
      {
        when: '3 jours',
        what: 'Ajouter un hold programm\u00e9 14:00\u201316:00 \u00b7 mettre \u00e0 jour la signal\u00e9tique de la salle',
      },
      { when: '4 semaines', what: 'Comparer temps d\u2019attente + mentions Slack vs r\u00e9f\u00e9rence' },
    ],
  },
  'in-w007': {
    title: 'Pr\u00e9-purger l\u2019air du hall pendant le pic d\u2019entr\u00e9e 8\u20139\u202fh',
    summary:
      'La qualit\u00e9 de l\u2019air du hall passe en \u00ab\u202fmod\u00e9r\u00e9\u202f\u00bb (PM2,5 22\u202f\u00b5g) pendant 18\u202fmin au pic d\u2019entr\u00e9e. Un boost MERV en deux \u00e9tapes + pr\u00e9-purge de 10\u202fmin maintient \u00ab\u202fbon\u202f\u00bb toute la journ\u00e9e.',
    secondary_impact: 'PM2,5 du hall < 12\u202f\u00b5g toute la journ\u00e9e',
    reasoning: [
      'Le capteur AQ du hall enregistre une fen\u00eatre PM2,5 22\u202f\u00b5g 08:18\u201308:36 chaque jour',
      'Cause\u202f: le pi\u00e9tinement remue les particules s\u00e9diment\u00e9es + infiltration porte ouverte',
      'Pr\u00e9-purge \u00e0 partir de 07:50 (10\u202fmin) ram\u00e8ne la r\u00e9f\u00e9rence \u00e0 8\u202f\u00b5g avant le pic',
      'Aucun changement de filtre requis \u2014 utiliser le MERV 13 existant en cycle plus rapide',
    ],
    dataSources: [
      'Capteur AQ hall',
      'Comptes badges entr\u00e9e',
      'Dur\u00e9e CTA hall',
      'R\u00e9f\u00e9rences particulaires',
    ],
    implementation: [
      {
        when: '3 jours',
        what: 'Ajouter une \u00e9tape de pr\u00e9-purge au planning CTA hall \u00b7 mise \u00e0 jour GTB',
      },
      { when: '2 semaines', what: 'Comparer la trace PM2,5 + signalements confort vs r\u00e9f\u00e9rence' },
    ],
  },
  'in-w008': {
    title:
      'R\u00e9soudre l\u2019attente ascenseur r\u00e9currente \u00e0 7\u202fh + 18\u202fh aux changements d\u2019\u00e9quipe',
    summary:
      'Le capteur d\u2019attente ascenseur monte \u00e0 3,2\u202fmin aux changements d\u2019\u00e9quipe. Un ajustement du rythme + une cabine stationnaire au hall ram\u00e8ne sous 1\u202fmin et r\u00e9cup\u00e8re ~120\u202fmin/jour.',
    secondary_impact: 'Attente < 1\u202fmin aux pics',
    reasoning: [
      'Journaux dispatch ascenseur\u202f: attente moyenne 3,2\u202fmin 06:55\u201307:15 et 17:55\u201318:15',
      '14 plaintes confort sur 32 par semaine mentionnent \u00ab\u202fattente ascenseur\u202f\u00bb',
      'Mod\u00e8le de rythme OTIS\u202f: maintenir la cabine\u202f#2 au hall + d\u00e9marrer la\u202f#4 depuis le 25e ram\u00e8ne l\u2019attente \u00e0 0,8\u202fmin',
      'Aucun mat\u00e9riel neuf \u2014 simple changement de configuration firmware OTIS',
    ],
    dataSources: [
      'Journaux dispatch ascenseur',
      'Plaintes confort',
      'Mod\u00e8le rythme OTIS',
      'Courbes badges entr\u00e9e',
    ],
    implementation: [
      { when: '1 semaine', what: 'OTIS pousse la config rythme \u00b7 surveiller attente + plaintes' },
      { when: '1 mois', what: 'Comparer temps d\u2019attente + plaintes vs mois de r\u00e9f\u00e9rence' },
    ],
  },

  // ── Past insights (status='implemented') ──
  // Render under the Insights "Implemented" filter — proof points of
  // Merlin's track record. Outcome.predicted/actual/narrative stay in
  // source language; only the 6 overlay fields translate.
  'in-past-001': {
    title: 'Effacement CVC hors heures · étages 4–11',
    summary:
      'Refroidissement de base abaissé entre 19:00 et 06:00 en semaine. Pré-refroidissement sur capteurs rétablit le confort 30 min avant les premières arrivées.',
    secondary_impact: '−6 200 kWh/an déplacés',
    reasoning: [
      'Les étages 4–11 ont la plus faible occupation hors heures du bâtiment',
      'Consigne d’origine maintenue à 22 °C la nuit — inutile sur étages vides',
      'Sondage confort inchangé après 30 jours de nouveau planning',
    ],
    dataSources: ['Journaux d’occupation GTB', 'Capteurs PIR étages 4–11', 'Sondage confort YoY'],
    implementation: [
      { when: 'Jour 1', what: 'Pousser le planning · surveiller scores confort première arrivée' },
      { when: 'Semaine 4', what: 'Verrouiller si confort tient + consommation chute > 10 %' },
    ],
  },
  'in-past-002': {
    title: 'Optimisation planning d’éclairage · étage 8',
    summary:
      'La plupart des équipes étage 8 se terminent à 18:30 ; l’éclairage couloir + tisanerie tournait jusqu’à 23:00. Le nouveau planning supprime ce chevauchement.',
    secondary_impact: '−2 800 kWh/an',
    reasoning: [
      'L’occupation étage 8 chute à ~3 % après 18:30 en semaine',
      'Planning existant : éclairage à 100 % jusqu’à 23:00',
      'Nouveau planning : 30 % à partir de 19:00, extinction totale à 21:30',
    ],
    dataSources: ['Occupation étage 8', 'Journaux contrôleur éclairage', 'Badges après heures'],
    implementation: [
      { when: 'Jour 1', what: 'Pousser le nouveau planning avec surcharge manuelle disponible' },
      { when: 'Semaine 2', what: 'Confirmer zéro événement de surcharge · finaliser' },
    ],
  },
  'in-past-003': {
    title: 'Consolidation des tournées de nettoyage · étages 18–22',
    summary:
      'Bloc de 5 étages avait 3 passages quotidiens qui se chevauchaient. La fusion des passages de 14:00 et 16:00 a économisé ~6 h équipe/semaine sans baisser le KPI hygiène.',
    secondary_impact: '−6 h équipe/semaine',
    reasoning: [
      'L’analyse des journaux NFC montre que 14:00 + 16:00 dupliquaient 70 % des points de contact',
      'Performance SLA Hygiène tenait > 98 % pendant l’exécution en miroir',
      'L’équipe préférait le passage consolidé à 15:00 — moins de changements de contexte',
    ],
    dataSources: ['Piste NFC Smart Logger Basic', 'Tableau de bord SLA Hygiène', 'Sondage d’équipe'],
    implementation: [
      { when: 'Jour 1', what: 'Exécuter la route fusionnée en miroir pendant 2 semaines' },
      {
        when: 'Semaine 3',
        what: 'Supprimer le passage de 16:00 · réaffecter l’équipe libérée aux points chauds du 32e',
      },
    ],
  },
  'in-past-004': {
    title: 'Élargissement de la bande de consigne en journée (semaine)',
    summary:
      'Bande ASHRAE de 22–24 °C élargie à 21–25 °C sur les zones non périmétrales. Pas de baisse de confort, baisse matérielle du cyclage des compresseurs.',
    secondary_impact: '−8 400 kWh/an',
    reasoning: [
      'Analyse 90 jours du cyclage des compresseurs vs bande de consigne',
      'Les plaintes confort n’ont pas augmenté pendant un élargissement testé 4 semaines',
      'ASHRAE 55 toujours satisfaite avec la bande élargie compte tenu du mouvement d’air',
    ],
    dataSources: ['Journaux compresseurs GTB', 'Volume de plaintes confort', 'Humidité par zone 90 j'],
    implementation: [
      { when: 'Jour 1', what: 'Appliquer la bande élargie aux étages 2–11 uniquement · surveiller 4 semaines' },
      { when: 'Semaine 5', what: 'Étendre aux étages restants · conserver le périmètre serré' },
    ],
  },
  'in-past-005': {
    title: 'Libération auto des salles de réunion après 15 min fantômes',
    summary:
      '~14 h/semaine de salle récupérées par étage en libérant automatiquement les réservations fantômes vers le pool ouvert.',
    secondary_impact: '+12 % d’utilisation salles',
    reasoning: [
      'Le croisement PIR + réservations a montré que ~22 % des réservations étaient fantômes',
      'La libération auto après 15 min a maintenu un taux de faux positifs < 2 %',
      'Le volume de réservations en présentiel a immédiatement augmenté sur les salles libérées',
    ],
    dataSources: ['Système de réservation', 'PIR salles de réunion', 'Événements de surcharge en présentiel'],
    implementation: [
      { when: 'Jour 1', what: 'Activer aux étages 18, 22, 32 · étages de densité moyenne' },
      { when: 'Semaine 3', what: 'Déployer à tous les étages après revue des faux positifs' },
    ],
  },
  'in-past-006': {
    title: 'Réglage de la cadence de réappro papier sanitaires',
    summary:
      'Remplacement du réappro fixe deux fois par jour par un déclenchement bouton sur consommation. Réduit le sur-stock et les courses d’urgence.',
    secondary_impact: '−1,4 h/semaine de courses fournitures',
    reasoning: [
      'Le taux de boutons-drapeaux Smart Logger donne un signal de pénurie en temps réel',
      'L’ancienne cadence fixe sur-stockait les sanitaires à faible trafic d’environ 30 %',
      'Les incidents de réappro d’urgence sont tombés à zéro pendant un pilote de 30 jours',
    ],
    dataSources: ['Drapeaux Smart Logger Basic', 'Journaux tournées de réappro', 'Consommation inventaire 90 j'],
    implementation: [
      { when: 'Jour 1', what: 'Pilote sur sanitaires à fort trafic des étages 8 + 32' },
      { when: 'Semaine 4', what: 'Déployer à tous les étages · retirer la cadence fixe' },
    ],
  },
  'in-past-007': {
    title: 'Réglage du rythme de dispatch ascenseur',
    summary:
      'Configuration de rythme OTIS retravaillée pour les heures creuses. Réduit le temps d’attente du dispatch et les trajets de cabines vides.',
    secondary_impact: '−2,3 s d’attente moyenne',
    reasoning: [
      'Les schémas de trafic en heures creuses diffèrent du pic matinal — la config originale était réglée sur le pic',
      'Les trajets de cabines vides représentaient 18 % des courses en heures creuses',
      'Le manuel de réglage fourni par le constructeur correspondait au schéma du hall étage 1',
    ],
    dataSources: ['Télémétrie contrôleur ascenseur', 'Baselines PIR hall', 'Analytique temps d’attente'],
    implementation: [
      { when: 'Jour 1', what: 'OTIS pousse la nouvelle config · surveiller temps d’attente + journaux de plaintes' },
      { when: 'Semaine 4', what: 'Comparer le temps d’attente au mois de référence · verrouiller' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// INSIGHTS ECOSYSTEM (from insights-data.js → INSIGHTS_ECOSYSTEM)
// ═══════════════════════════════════════════════════════════════════
export const INSIGHTS_ECOSYSTEM_FR = {
  'ine-001': {
    title:
      'Ren\u00e9gocier les contrats de nettoyage r\u00e9gionaux selon l\u2019efficacit\u00e9 v\u00e9rifi\u00e9e NFC',
    summary:
      '3 prestataires couvrent l\u2019\u00c9tat. Les temps NFC de SparkleCo sur 180 agences sont 20\u202f% plus rapides que NY Shine pour un r\u00e9sultat \u00e9quivalent (notes + boutons). Fusionner au tarif SparkleCo dans toutes les agences du nord.',
    secondary_impact: '\u2212220 heures d\u2019\u00e9quipe/semaine',
    reasoning: [
      'Le journal NFC de 180 agences montre SparkleCo \u00e0 4\u202fmin\u202f40 par passage vs 5\u202fmin\u202f50 pour NY Shine',
      'Delta de note client entre prestataires\u202f: 0,06\u2605 (pas significatif)',
      'Taux d\u2019appuis bouton (papier bas, demande nettoyage) \u00e0 3\u202f% pr\u00e8s entre prestataires \u2014 qualit\u00e9 \u00e9quivalente',
      'Basculer Hudson Valley + Capital (132 agences) vers le tarif SparkleCo \u00e9conomise 182\u202f000\u202f$/an sans risque SLA',
    ],
    dataSources: ['Journaux NFC 180\u202fj', 'Notes clients par agence', 'Contrats fournisseurs + grilles'],
    implementation: [
      { when: '1 mois', what: '\u00c9mettre l\u2019appel d\u2019offres au nouveau tarif unifi\u00e9' },
      { when: '3 mois', what: 'Transition Hudson + Capital vers SparkleCo \u00b7 suivi SLA hebdo' },
      { when: '6 mois', what: 'Extension au North Country + Southern Tier si les m\u00e9triques tiennent' },
    ],
  },
  'ine-002': {
    title: 'Consolider les coordinateurs nettoyage r\u00e9gionaux \u00b7 9 \u2192 5',
    summary:
      'Les coordinateurs dispatchent actuellement les tourn\u00e9es manuellement. Le dispatch pilot\u00e9 par Merlin permet \u00e0 5 coordinateurs de couvrir les 578 agences avec un meilleur SLA.',
    secondary_impact: '\u22124 ETP \u00b7 r\u00e9allou\u00e9s aux op\u00e9rations terrain',
    reasoning: [
      '9 coordinateurs aujourd\u2019hui \u00b7 chacun g\u00e8re ~64 agences \u00b7 capacit\u00e9 max ~80',
      'Le dispatch auto Merlin a d\u00e9j\u00e0 trait\u00e9 78\u202f% des d\u00e9cisions de routage au Q1 (mesur\u00e9 vs remplacements manuels)',
      '5 coordinateurs \u00e0 116 agences chacun est faisable avec Merlin portant 78\u202f%+ de la charge',
      'La redistribution pr\u00e9serve la couverture d\u2019astreinte et r\u00e9duit la redondance',
    ],
    dataSources: [
      'Journaux d\u00e9cisions dispatch Q1',
      'Rotations + heures coordinateurs',
      'Suivi taux de remplacement',
    ],
    implementation: [
      { when: '2 semaines', what: 'Pilote\u202f: 1 coordinateur g\u00e8re 2 r\u00e9gions avec fallback Merlin' },
      { when: '3 mois', what: 'Attrition + r\u00e9affectation pour atteindre la structure 5 coordinateurs' },
    ],
  },
  'ine-003': {
    title: 'Cibler les 24 agences not\u00e9es sous 3,5\u2605',
    summary:
      'Les 24 agences du bas du classement partagent 3 causes racines communes. Les adresser l\u00e8verait la note moyenne \u00e9tat-wide de ~0,4\u2605.',
    secondary_impact: '+0,4\u2605 moyenne \u00c9tat-wide',
    reasoning: [
      '24 agences sous 3,5\u2605 sur les 30 derniers jours',
      '67\u202f% des signalements n\u00e9gatifs se regroupent sur 3 causes\u202f: p\u00e9nurie papier, lecteur NFC intermittent, d\u00e9rive CVC toilettes',
      'L\u2019\u00e9quipe brand estime la valeur de r\u00e9tention \u00e0 ~3\u202f600\u202f$/an par segment agence \u2192 ~88\u202f000\u202f$/an',
      'Corrections connues\u202f: fr\u00e9quence consommables + remplacement lecteur + consigne confort',
    ],
    dataSources: ['Notes agences 90\u202fj', 'Motifs appuis boutons par site', 'Mod\u00e8le r\u00e9tention brand'],
    implementation: [
      { when: '2 semaines', what: 'Rapport cause racine par agence + playbook cibl\u00e9' },
      { when: '1 mois', what: 'Visites terrain + changement cadence consommables sur les 24 sites' },
      { when: '3 mois', what: 'Mesurer delta de note vs contr\u00f4les' },
    ],
  },
  'ine-004': {
    title: 'Consommables en gros \u2014 \u00c9tat-wide \u00b7 trimestriel',
    summary:
      'Consolider la commande hebdo par agence en une commande trimestrielle \u00c9tat-wide. Remise de volume + moins de r\u00e9ceptions.',
    secondary_impact: '\u2212468 livraisons agences/an',
    reasoning: [
      '578 agences \u00d7 commande mensuelle = 6\u202f936 livraisons/an (moyenne 12/sem. \u00e9tat-wide)',
      'Le fournisseur offre \u221211\u202f% sur palettes trimestrielles consolid\u00e9es',
      'Distribution via la tourn\u00e9e logistique existante \u2014 aucun co\u00fbt coursier additionnel',
      'Les agences stockent 6\u201310 semaines de consommables en moyenne',
    ],
    dataSources: ['Devis fournisseur Q2', 'Enqu\u00eate stockage agences', 'Planning tourn\u00e9e logistique'],
    implementation: [
      { when: '2 semaines', what: 'Signer l\u2019accord palette trimestriel' },
      { when: '3 mois', what: 'Premi\u00e8re commande bulk \u00b7 Merlin met \u00e0 jour les seuils' },
    ],
  },
  'ine-005': {
    title: 'Dispatch nettoyage dynamique sur 180 agences du nord',
    summary:
      'Les agences du nord voient l\u2019occupation toilettes culminer seulement mar./mer. 11:00\u201314:00. Passer au dispatch d\u00e9clench\u00e9 par bouton r\u00e9duit 1 passage/jour sans enfreindre le SLA.',
    secondary_impact: '\u22121 passage/jour sur 180 sites',
    reasoning: [
      'Les agences du nord ont en moyenne 42 visiteurs/jour vs 220 en NYC Metro',
      'Planning actuel\u202f: 3 passages fixes quelle que soit l\u2019affluence',
      'Recommand\u00e9\u202f: dispatch dynamique d\u00e9clench\u00e9 par bouton \u00ab\u202fdemande de nettoyage\u202f\u00bb OU seuil d\u2019occupation',
      'Mod\u00e9lise 2 passages/jour vs 3, maintenant le SLA Hygi\u00e8ne \u00e0 97,8\u202f% (actuel 98,1\u202f%)',
    ],
    dataSources: [
      'Signaux d\u2019occupation 90\u202fj',
      'Journaux minutages NFC',
      'R\u00e9sultats appuis boutons',
      'Delta de notes',
    ],
    implementation: [
      { when: '2 semaines', what: 'Pilote en Finger Lakes (55 agences)' },
      { when: '2 mois', what: 'Extension Ouest NY + North Country si les m\u00e9triques tiennent' },
    ],
  },
  'ine-006': {
    title: 'Supprimer la feuille papier de nettoyage par agence',
    summary:
      'Les check-in + check-out NFC par agent par visite satisfont d\u00e9j\u00e0 l\u2019audit SLA fournisseur de la banque. Les 578 journaux papier peuvent \u00eatre retir\u00e9s.',
    secondary_impact: '54\u202fh/semaine \u00e9conomis\u00e9es sur les directeurs',
    reasoning: [
      'L\u2019audit SLA fournisseur exige un registre inviolable \u00b7 la piste NFC couvre cela (revue juridique Q1)',
      'Les directeurs passent ~6\u202fmin/jour \u00e0 r\u00e9concilier papier vs Merlin (578 \u00d7 6\u202fmin \u00d7 5\u202fj \u00d7 52\u202fsem.)',
      'Les auditeurs tirent d\u00e9j\u00e0 le rapport NFC de Merlin pour leurs sondages\u202f; le papier est d\u00e9sormais redondant',
    ],
    dataSources: ['Revue conformit\u00e9 Q1', 'Couverture piste NFC', 'Suivi temps directeurs'],
    implementation: [
      { when: '1 semaine', what: 'Mettre \u00e0 jour le playbook agence \u00b7 avertir coordinateurs' },
      { when: 'continu', what: 'L\u2019audit trimestriel tire directement de la piste NFC' },
    ],
  },
  'ine-007': {
    title: 'Tourn\u00e9e group\u00e9e de changement de batteries \u2014 Ouest NY \u00b7 22 \u00e9crans',
    summary:
      '22 \u00e9crans Touch eInk \u00e0 Buffalo + Rochester + Jamestown sous 20\u202f%. Une seule journ\u00e9e terrain est moins ch\u00e8re que les visites \u00e9chelonn\u00e9es.',
    secondary_impact: '\u221218 d\u00e9placements fournisseurs',
    reasoning: [
      '22 \u00e9crans projet\u00e9s sous 15\u202f% d\u2019ici 45\u202fj',
      'Frais de d\u00e9placement par agence\u202f: 180\u202f$ \u2192 visites \u00e9chelonn\u00e9es ~3\u202f960\u202f$',
      'Journ\u00e9e terrain unique (un installateur, 22 sites rout\u00e9s)\u202f: ~720\u202f$ main-d\u2019\u0153uvre + per-diem',
      'M\u00eame r\u00e9sultat, plus t\u00f4t\u202f: toutes batteries \u00e0 100\u202f% en 1 semaine vs 45\u202fj',
    ],
    dataSources: ['T\u00e9l\u00e9m\u00e9trie batterie', 'Grille tarifs installateur', 'Historique routage Ouest NY'],
    implementation: [
      { when: '3 jours', what: '\u00c9mettre le PO pour 22 packs \u00b7 programmer Alicia une journ\u00e9e' },
      {
        when: '2 semaines',
        what: 'Journ\u00e9e terrain \u00b7 changements effectu\u00e9s \u00b7 mise \u00e0 jour historique',
      },
    ],
  },
  'ine-008': {
    title: 'Pr\u00e9-commander 18 \u00e9crans avant pannes pr\u00e9dites',
    summary:
      '18 \u00e9crans d\u2019agences correspondent \u00e0 la signature pr\u00e9-panne de 2024 (d\u00e9rive + NFC intermittent). Commander maintenant \u00e9vite l\u2019express quand ils tombent.',
    secondary_impact: '\u00c9vite 4\u202fj de gap par site',
    reasoning: [
      '18 \u00e9crans pr\u00e9sentent le motif d\u00e9rive + perte de paquets NFC qui a pr\u00e9c\u00e9d\u00e9 les pannes 2024 (n=34, 82\u202f% de corr\u00e9lation)',
      'Livraison standard 5\u202fj, express 2\u202fj \u00e0 +35\u202f%',
      'Pr\u00e9-commander = arriv\u00e9e avant la fen\u00eatre de panne pr\u00e9dite \u2192 aucun arr\u00eat d\u2019agence',
      'Express \u00e9vit\u00e9 + br\u00e8che SLA nettoyage \u00e9vit\u00e9e pendant la panne',
    ],
    dataSources: ['Tendances t\u00e9l\u00e9m\u00e9trie', 'Analyse cohorte pannes 2024', 'Grille co\u00fbts Adaptiv'],
    implementation: [
      { when: '1 jour', what: 'Ajouter 18 ADX-TD-12 au PO Adaptiv \u00b7 livraison standard' },
      { when: '1 semaine', what: 'Arriv\u00e9e \u00b7 Merlin les appaire aux slots cibles' },
    ],
  },
  'ine-009': {
    title: 'Promouvoir le firmware v4.13.0-rc2 en stable \u00e0 l\u2019\u00e9chelle de la flotte',
    summary:
      '576 \u00e9crans sur 578 sur le candidat depuis 72\u202fh, 0 r\u00e9gression. Passer en stable d\u00e9bloque la lecture NFC 15\u202f% plus rapide + \u00e9talonnage temp par zone.',
    secondary_impact: 'Lecture NFC 15\u202f% plus rapide \u00b7 \u00e9talonnage temp par zone',
    reasoning: [
      '99,65\u202f% de la flotte sur la release candidate',
      '0 r\u00e9gression consign\u00e9e sur 72\u202fh \u00b7 3 correctifs cosm\u00e9tiques livr\u00e9s',
      'Charge fonctionnelle\u202f: vitesse NFC, API r\u00e9\u00e9talonnage temp par zone, sortie de veille plus rapide',
    ],
    dataSources: [
      'T\u00e9l\u00e9m\u00e9trie firmware',
      'Tableau de bord r\u00e9gressions',
      'Journal des modifications',
    ],
    implementation: [
      { when: '1 jour', what: 'Promouvoir le tag stable-4.13.0 \u00b7 notifier le change board' },
      { when: '1 semaine', what: 'D\u00e9ploiement auto des 0,35\u202f% restants au prochain battement' },
    ],
  },
  'ine-010': {
    title: 'G\u00e9n\u00e9rer automatiquement le rapport trimestriel de conformit\u00e9 pour les 578 agences',
    summary:
      'Chaque donn\u00e9e que la conformit\u00e9 assemble manuellement est d\u00e9j\u00e0 dans Merlin. Le digest hebdo + d\u00e9p\u00f4t trimestriel peuvent \u00eatre enti\u00e8rement automatis\u00e9s.',
    secondary_impact: '18\u202fh/semaine de travail conformit\u00e9 r\u00e9cup\u00e9r\u00e9es',
    reasoning: [
      'L\u2019\u00e9quipe conformit\u00e9 passe ~18\u202fh/semaine \u00e0 agr\u00e9ger taps NFC, versions firmware et incidents \u00e0 travers 578 agences',
      'Chaque champ requis est d\u00e9j\u00e0 dans le mod\u00e8le Merlin \u00b7 format correspond au d\u00e9p\u00f4t Q1 1:1',
      'Profil sauvegard\u00e9 peut g\u00e9n\u00e9rer lun. 06:00 hebdo + auto-soumettre au portail r\u00e9gulateur trimestriel',
    ],
    dataSources: ['D\u00e9p\u00f4t conformit\u00e9 Q1', 'Mod\u00e8le Merlin', 'Feuilles de temps conformit\u00e9'],
    implementation: [
      { when: '2 semaines', what: 'Mod\u00e8le correspond octet-pour-octet au Q1 \u00b7 dry-run' },
      { when: '1 mois', what: 'Digest hebdo en prod + soumission auto Q2' },
    ],
  },
  'ine-011': {
    title: 'G\u00e9n\u00e9rer automatiquement la v\u00e9rification d\u2019ouverture d\u2019agence',
    summary:
      'Les agences confirment manuellement les v\u00e9rifications d\u2019ouverture chaque matin. NFC + capteurs embarqu\u00e9s v\u00e9rifient d\u00e9j\u00e0 la plupart des points.',
    secondary_impact: '78\u202fh/semaine sur 578 directeurs',
    reasoning: [
      '578 agences \u00d7 8\u202fmin/jour de checklist manuelle (exceptions seulement) \u2192 ~78\u202fh/semaine',
      'Niveau lumineux, statut lecteur NFC, sant\u00e9 \u00e9cran, temp CVC \u2014 tous \u00e9chantillonn\u00e9s en continu',
      'Le directeur ne revoit que les exceptions remont\u00e9es par Merlin (~5\u202f% des ouvertures)',
      'Risque\u202f: les agences sautent le contr\u00f4le manuel \u2014 mitig\u00e9 en gardant la confirmation 2-tap',
    ],
    dataSources: [
      'Capteurs embarqu\u00e9s (temp, bruit, lumi\u00e8re)',
      'Battement NFC',
      'Flux sant\u00e9 \u00e9crans',
    ],
    implementation: [
      { when: '2 semaines', what: 'D\u00e9ployer le widget checklist sur 10 agences pilotes' },
      { when: '2 mois', what: 'Roll-out \u00c9tat-wide si le SLA exception tient' },
    ],
  },
  'ine-012': {
    title: 'R\u00e9approvisionnement d\u00e9clench\u00e9 par NFC sur 578 agences',
    summary:
      'Les appuis bouton pour essuie-tout / savon sont d\u00e9j\u00e0 captur\u00e9s. D\u00e9clencher les commandes par agence selon le taux de consommation \u00e9vite les livraisons express.',
    secondary_impact: '\u221274 livraisons express/an',
    reasoning: [
      'Chaque appui \u00ab\u202fpapier bas\u202f\u00bb / \u00ab\u202fsavon manquant\u202f\u00bb est horodat\u00e9 + localis\u00e9',
      'Processus actuel\u202f: directeur appelle quand le stock est bas \u2192 souvent trop tard, livraison express',
      'Mod\u00e8le taux de consommation par agence pr\u00e9dit la fen\u00eatre de commande 72\u202fh',
      'Surcharge livraison express\u202f: 515\u202f$/occurrence \u00d7 74/an \u00e9vit\u00e9s',
    ],
    dataSources: [
      '\u00c9v\u00e9nements boutons 180\u202fj',
      'Motifs de d\u00e9stockage',
      'Factures surcharge livraison',
    ],
    implementation: [
      { when: '1 semaine', what: 'Activer le d\u00e9clencheur auto Merlin sur seuil 7\u202fj' },
      { when: '1 mois', what: 'Mesurer la r\u00e9duction des livraisons express + rotation stock' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// INSIGHTS IMF (from imf-data.js → IMF_INSIGHTS)
// ═══════════════════════════════════════════════════════════════════
export const INSIGHTS_IMF_FR = {
  'imf-in-001': {
    title: 'Dispatch nettoyage d\u00e9clench\u00e9 par l\u2019occupation \u2014 HQ1 + HQ2',
    summary:
      'Les donn\u00e9es des compteurs montrent que 72\u202f% des toilettes ont de longues fen\u00eatres sans trafic. Passer du planning \u00e0 3 passages \u00e0 un dispatch d\u00e9clench\u00e9 par l\u2019occupation tout en pr\u00e9servant le SLA Hygi\u00e8ne de 4\u202fh.',
    secondary_impact: '\u22121 passage/jour sur 87 toilettes',
    reasoning: [
      '49 compteurs \u00e0 travers HQ1 + HQ2 montrent en moyenne 3,2 entr\u00e9es/h hors pic (09:30\u201311:00, 13:00\u201314:00)',
      'Actuel\u202f: 3 passages fixes/jour quel que soit le trafic \u2192 ~11\u202f000 passages/an sur le campus',
      'Recommand\u00e9\u202f: dispatch quand le nombre d\u2019entr\u00e9es d\u00e9passe 18 entre nettoyages OU qu\u2019un bouton \u00ab\u202fdemande nettoyage\u202f\u00bb est appuy\u00e9',
      'Mod\u00e8le maintient le SLA Hygi\u00e8ne \u00e0 98,2\u202f% (vs 98,9\u202f% aujourd\u2019hui), lib\u00e9rant ~28\u202fh d\u2019\u00e9quipe/semaine',
    ],
    dataSources: [
      'Journaux entr\u00e9es PC 60\u202fj',
      'Check-in/out NFC nettoyage',
      '\u00c9v\u00e9nements boutons',
      'R\u00e9sultats SLA Hygi\u00e8ne',
    ],
    implementation: [
      { when: '2 semaines', what: 'Pilote en HQ2 \u00e9tages 3\u20136 (24 toilettes) avec supervision' },
      { when: '1 mois', what: 'Mesurer delta SLA + notes vs la r\u00e9f\u00e9rence HQ1' },
      { when: '2 mois', what: 'Extension campus si les m\u00e9triques tiennent' },
    ],
  },
  'imf-in-002': {
    title: 'Tourn\u00e9e group\u00e9e de changement de batteries \u2014 HQ1 \u00e9tages 10\u201313 (14 \u00e9crans)',
    summary:
      '14 \u00e9crans aux \u00e9tages sup\u00e9rieurs HQ1 sous 25\u202f% de batterie. Une seule journ\u00e9e terrain est moins ch\u00e8re que des visites \u00e9chelonn\u00e9es et ferme l\u2019exposition en une semaine.',
    secondary_impact: '\u221212 d\u00e9placements fournisseurs',
    reasoning: [
      '14 \u00e9crans projet\u00e9s sous 15\u202f% dans les 30 prochains jours',
      'Frais de d\u00e9placement par \u00e9tage\u202f: 180\u202f$ \u2192 visites \u00e9chelonn\u00e9es ~2\u202f520\u202f$ sur 8 semaines',
      'Journ\u00e9e terrain unique (un technicien, 14 sites dans un b\u00e2timent)\u202f: ~480\u202f$ main-d\u2019\u0153uvre',
      'Toutes batteries \u00e0 100\u202f% en une semaine vs 30\u202fj\u202f; aucun temps d\u2019arr\u00eat',
    ],
    dataSources: [
      'T\u00e9l\u00e9m\u00e9trie batterie 90\u202fj',
      'Grille tarifs technicien terrain',
      'Carte de routage HQ1',
    ],
    implementation: [
      { when: '3 jours', what: '\u00c9mettre le PO pour 14 packs D-cell' },
      { when: '1 semaine', what: 'Journ\u00e9e terrain jeu. 08:00 \u2014 14 changements, historique mis \u00e0 jour' },
    ],
  },
  'imf-in-003': {
    title: 'Promouvoir le firmware v3.9.0-rc1 en stable \u2014 pilote HQ2',
    summary:
      '46 \u00e9crans HQ2 sur le candidat depuis 72\u202fh avec 0 r\u00e9gression. Passer en stable d\u00e9bloque la lecture NFC 20\u202f% plus rapide + \u00e9talonnage temp par zone. Un \u00e9cran (HQ2 11e Est RR Hommes) n\u00e9cessite un reflash s\u00e9par\u00e9.',
    secondary_impact: 'Lecture NFC 20\u202f% plus rapide \u00b7 \u00e9talonnage temp par zone',
    reasoning: [
      '45 sur 46 \u00e9crans HQ2 sur 3.9.0-rc1 depuis 72\u202fh \u2022 0 r\u00e9gression consign\u00e9e',
      '1 r\u00e9calcitrant (SDG00296 \u2014 HQ2 11e Est) coinc\u00e9 sur 3.8.10 selon la note terrain \u2014 intervention d\u00e9j\u00e0 programm\u00e9e',
      'Charge fonctionnelle\u202f: vitesse de scan NFC, latence tap nettoyage \u22120,3\u202fs, alimentation veille/r\u00e9veil',
      'Le change board a un mod\u00e8le d\u2019approbation \u2014 HQ1 re\u00e7oit le m\u00eame roll-out la semaine suivante si HQ2 tient',
    ],
    dataSources: [
      'T\u00e9l\u00e9m\u00e9trie firmware 72\u202fh',
      'Tableau de bord r\u00e9gressions',
      'Mod\u00e8les change board',
    ],
    implementation: [
      { when: '1 jour', what: 'Promouvoir stable-3.9.0 \u00b7 notifier le change board' },
      { when: '1 semaine', what: 'D\u00e9ploiement auto du reste HQ2 au prochain battement\u202f; programmer HQ1' },
    ],
  },
  'imf-in-004': {
    title: 'R\u00e9approvisionnement d\u00e9clench\u00e9 par NFC sur 87 toilettes',
    summary:
      'Les appuis sur \u00ab\u202fpapier bas\u202f\u00bb et \u00ab\u202fsavon manquant\u202f\u00bb sont d\u00e9j\u00e0 captur\u00e9s par toilette. Le d\u00e9clenchement auto bas\u00e9 sur le taux de consommation 7\u202fj remplace 23 livraisons express/an par des livraisons planifi\u00e9es.',
    secondary_impact: '\u221223 livraisons express/an',
    reasoning: [
      'Chaque appui bouton est horodat\u00e9 + localis\u00e9 \u00e0 travers HQ1 + HQ2 (1\u202f240 \u00e9v\u00e9nements au Q1)',
      'Processus actuel\u202f: chef d\u2019\u00e9quipe appelle quand le stock est bas \u2192 souvent trop tard, livraison express requise',
      'Surcharge livraison express\u202f: 520\u202f$/occurrence \u00d7 23/an = 12\u202fk$, plus co\u00fbt de redirection',
      'Mod\u00e8le taux de consommation pr\u00e9dit la fen\u00eatre de commande 72\u202fh avec 94\u202f% de pr\u00e9cision par toilette',
    ],
    dataSources: ['\u00c9v\u00e9nements boutons 90\u202fj', 'Historique PO inventaire', 'Factures surcharge livraison'],
    implementation: [
      { when: '1 semaine', what: 'Activer le d\u00e9clencheur auto Merlin sur taux 7\u202fj' },
      { when: '1 mois', what: 'Mesurer la r\u00e9duction des livraisons express + rotation stock' },
    ],
  },
  'imf-in-005': {
    title: 'Supprimer les feuilles papier de nettoyage dans toutes les toilettes',
    summary:
      'Chaque visite de nettoyage est d\u00e9j\u00e0 v\u00e9rifi\u00e9e NFC avec horodatages check-in/out. Le journal papier coll\u00e9 sur chaque porte peut \u00eatre retir\u00e9 \u2014 \u00e9conomisant du temps et standardisant entre les deux b\u00e2timents.',
    secondary_impact: '8\u202fh/semaine de r\u00e9conciliation conformit\u00e9',
    reasoning: [
      'L\u2019audit SLA fournisseur IMF exige un registre inviolable \u2014 la piste NFC check-in/out satisfait cela (revue juridique Q2)',
      'Le chef d\u2019\u00e9quipe passe ~8\u202fh/semaine \u00e0 r\u00e9concilier les journaux papier vs la piste Merlin',
      'Les auditeurs tirent d\u00e9j\u00e0 le rapport NFC Merlin pour leurs sondages trimestriels',
      'Retirer le papier r\u00e9duit aussi l\u2019encombrement sur les portes (demand\u00e9 par l\u2019exploitation)',
    ],
    dataSources: ['M\u00e9mo juridique Q2', 'Couverture piste NFC', 'Feuille de temps chef d\u2019\u00e9quipe'],
    implementation: [
      { when: '1 semaine', what: 'Mettre \u00e0 jour le playbook \u00b7 notifier le coordinateur fournisseur' },
      { when: 'continu', what: 'L\u2019audit hebdo tire directement de la piste NFC' },
    ],
  },
  'imf-in-006': {
    title: 'Pr\u00e9-commander 8 \u00e9crans de remplacement avant pannes pr\u00e9dites',
    summary:
      '8 \u00e9crans pr\u00e9sentent la signature pr\u00e9-panne observ\u00e9e d\u00e9but 2025 (NFC intermittent + r\u00e9veil lent). Pr\u00e9-commander maintenant \u00e9vite l\u2019express quand ils tombent.',
    secondary_impact: '\u00c9vite 3\u202fj de gap par site',
    reasoning: [
      '8 \u00e9crans correspondent au motif perte de paquets NFC + temps de r\u00e9veil qui a pr\u00e9c\u00e9d\u00e9 les pannes d\u00e9but 2025 (n=12, 78\u202f% de corr\u00e9lation)',
      'Livraison standard 5\u202fj\u202f; express 2\u202fj \u00e0 +35\u202f%',
      'Pr\u00e9-commander en standard arrive avant la fen\u00eatre de panne pr\u00e9dite \u2192 aucun arr\u00eat',
      '\u00c9vite 130\u202f$/jour d\u2019exposition SLA pendant le remplacement',
    ],
    dataSources: ['Tendances t\u00e9l\u00e9m\u00e9trie', 'Analyse cohorte pannes 2025', 'Grille tarifs Adaptiv'],
    implementation: [
      { when: '1 jour', what: 'Ajouter 8 ADX-SDG-7 au PO exploitation \u00b7 livraison standard' },
      { when: '1 semaine', what: 'Arriv\u00e9e \u00b7 Merlin les appaire aux slots cibles' },
    ],
  },
  'imf-in-007': {
    title: 'Contr\u00f4le qualit\u00e9 donn\u00e9es compteurs \u2014 auto-signaler les d\u00e9rives',
    summary:
      'Le compteur HQ2 3e Est a report\u00e9 4\u202f200 entr\u00e9es en 45\u202fmin hier (d\u00e9rive capteur). Auto-masquer les pics aberrants et d\u00e9clencher un re-\u00e9talonnage apr\u00e8s deux lectures cons\u00e9cutives invalides.',
    secondary_impact: 'Aucune mauvaise donn\u00e9e dans les rapports SLA',
    reasoning: [
      'Seuil de pic\u202f: 3\u00d7 la fen\u00eatre glissante du 99e percentile pour ce compteur',
      'Actuel\u202f: les mauvaises lectures remontent au rapport hebdo SLA \u2192 tableaux de bord bruyants',
      'Recommand\u00e9\u202f: masquer + signaler, paginer le technicien apr\u00e8s 2\u202fj cons\u00e9cutifs de d\u00e9rive',
      'Aucun mat\u00e9riel suppl\u00e9mentaire\u202f; pure r\u00e8gle Merlin',
    ],
    dataSources: [
      'T\u00e9l\u00e9m\u00e9trie entr\u00e9es PC 60\u202fj',
      'Variance rapport SLA hebdo',
      'File de tickets technicien',
    ],
    implementation: [
      { when: '3 jours', what: 'D\u00e9ployer la r\u00e8gle de seuil \u00b7 mode observation 1\u202fsem.' },
      { when: '2 semaines', what: 'Basculer en live si le taux de faux positifs < 2\u202f%' },
    ],
  },
  'imf-in-008': {
    title: 'R\u00e9\u00e9quilibrer les tourn\u00e9es selon le trafic r\u00e9el des toilettes',
    summary:
      'Les donn\u00e9es compteurs montrent que le hall HQ2 + \u00e9tages 3\u20134 portent 3,1\u00d7 le trafic des \u00e9tages sup\u00e9rieurs HQ1. Les tourn\u00e9es sont actuellement \u00e9quilibr\u00e9es par nombre d\u2019\u00e9tages, pas par fr\u00e9quentation.',
    secondary_impact: '9\u202fh d\u2019\u00e9quipe/semaine r\u00e9allou\u00e9es',
    reasoning: [
      'Donn\u00e9es PC 30\u202fj\u202f: HQ2 RDC\u20134e = 58\u202f% des entr\u00e9es campus\u202f; HQ1 10e\u201313e = 7\u202f%',
      'Les rotations actuelles allouent l\u2019\u00e9quipe par nombre d\u2019\u00e9tages (\u00e9gal entre les 2 b\u00e2timents)',
      'R\u00e9\u00e9quilibrage\u202f: +1 \u00e9quipe HQ2 hall matin, \u22120,5 \u00e9quipe HQ1 sup\u00e9rieur apr\u00e8s-midi',
      'Mod\u00e8le pr\u00e9serve le SLA Hygi\u00e8ne \u00e0 97,8\u202f% (vs 98,0\u202f% actuel), lib\u00e8re 9\u202fh/semaine',
    ],
    dataSources: [
      'Distribution entr\u00e9es PC 30\u202fj',
      'Feuille de rotation \u00e9quipe',
      'Registre SLA Hygi\u00e8ne',
    ],
    implementation: [
      { when: '1 semaine', what: 'Publier la nouvelle rotation \u00b7 confirmer avec le chef d\u2019\u00e9quipe' },
      { when: '4 semaines', what: 'Suivre SLA + retours' },
    ],
  },
};
