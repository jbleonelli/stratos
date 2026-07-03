# Démo · International Monetary Fund

**La démo de campus d'entreprise moyen.** Deux bâtiments HQ à Washington DC pour un seul locataire institutionnel. Plus petit qu'un réseau retail, plus grand qu'un seul bâtiment — la forme _campus de 2 bâtiments_ qui couvre une énorme tranche de l'immobilier mid-market.

> **En une phrase :** « Deux bâtiments, une équipe d'opérations, un espace de travail Merlin. La plupart des entreprises vivent ici — pas dans des tours de 50 étages ni dans des réseaux de 500 agences. »

---

## Ce que la démo représente

- **Un locataire immobilier** (International Monetary Fund) exploitant 2 bâtiments HQ à Washington DC.
- **Un écosystème à l'échelle campus.** Plus petit que First Empire Bank (réseau de petits sites similaires) mais multi-bâtiment plutôt que tour unique comme Meridian.
- **Empreinte d'équipements mixte.** ~174 écrans + ~49 capteurs à travers les deux bâtiments — un déploiement à mi-parcours, avec travaux actifs de firmware + provisioning visibles.
- **Histoire de déploiement en cours.** La démo IMF inclut des déploiements (re-flash firmware, échanges de batterie, mise en service des compteurs) qui montrent à quoi ressemble Merlin pendant un changement matériel actif — pas seulement les opérations en régime établi.

---

## Avec quel compte se connecter

| E-mail                  | Rôle                | Ce qu'il voit                                                                                                       |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `robin@adaptiv.systems` | Super-admin Adaptiv | Connectez-vous ici, puis utilisez le **menu d'espace de travail** pour basculer vers _International Monetary Fund_. |

> Comme First Empire Bank, la démo IMF repose actuellement sur le bascule d'espace de travail par super-admin Adaptiv. Les personas FM par rôle pour IMF sont sur la feuille de route du prochain rafraîchissement démo.

---

## À essayer (visite de 6 minutes)

1. **Connectez-vous en Robin → menu espace de travail → International Monetary Fund.** L'eyebrow lit _« IMF · Washington, DC · 2 bâtiments »_.
2. **Lisez les cartes d'attention.** Incidents mixtes à mi-déploiement — _« HQ2 Ét 11 RR Hommes Est · re-flash firmware SDG00296 »_, _« HQ1 Ét 10 + Ét 11 · Échange de batteries (4 écrans) »_, _« HQ1 Ét L Entrée · Mise en service des compteurs de personnes »_. Ce sont des problèmes d'état de déploiement, pas du régime établi.
3. **Exploitation → Hypervisor.** Explorez IMF → HQ1 + HQ2 → étages → pièces. Plus petit arbre de localisation que Meridian HQ — plus facile à tenir sur un écran.
4. **Exploitation → Déploiements.** C'est ici que la démo IMF brille. Voyez le pipeline de déploiement : queue de provisioning (quels équipements sont arrivés d'Adaptiv), calendrier d'installation (quelles installations sont prévues cette semaine), et cartes de statut de déploiement.
5. **Exploitation → Rapports.** Tirez un rapport. La surface reporting d'IMF inclut le progrès de déploiement aux côtés de la performance SLA habituelle — le campus est à mi-déploiement.
6. **Demandez à Merlin dans le chat :** _« Quel est l'état du déploiement firmware SDG ? »_ ou _« Quels équipements ne sont pas encore appairés ? »_
7. **Insights.** Ouvrez l'onglet Insights. IMF a 8 insights couvrant la fiabilité (qualité de données des compteurs de personnes, vieillissement des batteries d'écran), l'espace (rééquilibrage des tournées d'équipe basé sur les données des compteurs), et la chaîne d'approvisionnement (commande de tampon ADX-SDG-7).

---

## Points forts à mettre en avant

- **Opérations + Déploiements côte à côte.** La plupart des démos se concentrent sur le régime établi. IMF montre à quoi ressemble Merlin quand vous êtes à mi-déploiement — queue de provisioning, calendrier d'installation, statut de déploiement, le flux complet.
- **Échelle mid-market.** La plupart des entreprises exploitent 2 à 10 bâtiments. IMF est la bonne forme pour démontrer le pattern campus.
- **Intelligence de déploiement.** Merlin fait surface aux problèmes de qualité d'équipement (dérive de capteur sur un compteur spécifique) et recommande des changements à l'échelle du parc (règles d'auto-drapeau + recalibration) — pas seulement « réparer cet équipement ».
- **Insights pilotés par compteurs.** Avec 14 compteurs à travers 2 bâtiments, Merlin peut montrer des patterns de trafic qui pilotent des recommandations de tournées d'équipe.

---

## Ce qui est seedé dans cette démo

- 1 locataire de type écosystème · 2 bâtiments HQ · hiérarchie étage/pièce
- ~174 écrans + ~49 capteurs à travers les deux bâtiments
- Queue de provisioning + calendrier d'installation + cartes de déploiement à mi-parcours
- 8 insights (qualité de données des compteurs, vieillissement batteries, rééquilibrage tournées piloté trafic, commande tampon SDG)
- 3 déploiements actifs (re-flash firmware, campagne d'échange batteries, mise en service compteurs)
- IMF_SNAPSHOT statique avec incidents typés déploiement

---

## État du replay de démo

**PAS encore en replay.** Contrairement à Meridian et First Empire Bank, IMF tourne actuellement encore sur le tick en direct des agents. **À savoir avant de démontrer :** au 17/05/2026, les 1 611 exécutions d'agents capturées pour IMF sont toutes `decision='skip'` avec `cost_usd=0` — c'est-à-dire heartbeat uniquement, aucune décision `ask`, aucune action autonome. Le pipeline de seed-signal ne produit pas encore d'entrée actionable pour les pièces `variant='imf'`, donc les agents n'ont rien à quoi réagir. Le panneau « Merlin a traité » de Ma journée paraîtra silencieux sur ce locataire.

Ce que cela signifie en pratique :

- **Ne commencez pas par la boucle autonome ou la boucle human-in-the-loop** sur IMF — montrez-les d'abord sur Meridian ou FEB.
- **Commencez plutôt par Déploiements, Insights, et la hiérarchie campus** — l'histoire déploiement d'IMF est ce qui brille.
- **Roadmap :** investiguer la couverture seed-signal pour `variant='imf'`, puis capturer IMF de la même manière que FEB (live pendant ~1 semaine d'activité réelle → `demo_capture_org()` → élagage des skips → bascule `replay_mode`).

D'ici là, IMF reste sur le tick en direct — le coût est actuellement négligeable car aucun agent ne prend de décision non-skip, donc rien ne touche Claude.

---

## Quand utiliser cette démo

- **Pour acheteurs entreprises mid-market** — quiconque exploite 2 à 10 bâtiments plutôt qu'une tour ou 500 agences.
- **Pour COO évaluant la douleur du déploiement matériel.** IMF démontre le chevauchement Opérations + Déploiements.
- **Comme contraste avec Meridian HQ.** Meridian montre des opérations en régime établi sur un grand bâtiment ; IMF montre un mi-déploiement sur un campus multi-bâtiment.
