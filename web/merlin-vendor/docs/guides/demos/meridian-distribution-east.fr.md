# Démo · Meridian Distribution Center East

**La démo d'expansion de portefeuille (édition entrepôt).** Un centre de distribution de 240 000 pi² à Allentown PA, exploité par la même équipe Meridian qui gère la tour HQ. Même espace de travail, mêmes agents, même relation prestataire — bâtiment différent, problèmes différents.

> **En une phrase :** « Votre tour de bureaux illumine Merlin. Maintenant retournez un bâtiment et voyez le même logiciel couvrir vos centres de distribution — sans rien acheter de neuf. »

---

## Ce que la démo représente

- **Le même locataire Meridian Holdings** que la tour HQ. Le centre de distribution est un second bâtiment dans le même espace de travail, pas une installation Merlin séparée.
- **Un entrepôt sur 2 niveaux** — 15 allées par étage, 2 quais de chargement, stockage frigorifique, salle de pause, bureau d'expédition, bureau du manager, sanitaires.
- **Une palette d'agents différente.** Surveillance de la chaîne du froid sur les sondes SLB de température, sécurité des quais sur les zones de chargement, plannings de balayage optimisés pour le trafic d'entrepôt — pas les étages de bureaux.
- **L'étagère Innovation par vertical.** Quand vous basculez sur ce bâtiment, le marché Innovation fait remonter au sommet les cartes de fournisseurs _pertinents pour l'entrepôt_ : Crown WIM (télémétrie chariots), Locus Robotics (picking collaboratif), Rite-Hite (sécurité des quais), Cooler Concepts (surveillance chaîne du froid).

---

## Avec quel compte se connecter

Mêmes comptes Meridian que la démo HQ — tous sous un seul espace de travail. Mot de passe **`merlin2026`** sauf mention contraire.

| E-mail                 | Rôle                   | Ce qui change pour ce bâtiment                                                                                                                                                     |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jamie@meridian.com`   | Facility Manager       | Le Ma journée montre des incidents d'entrepôt (dérive du froid, dérive de remorque, impact chariot). L'eyebrow lit « Meridian Distribution Center East · entrepôt · 240 000 pi² ». |
| `maria@meridian.com`   | Lead Nettoyage         | Tournées de balayage des allées + nettoyage des quais, pas les tournées sanitaires.                                                                                                |
| `darnell@meridian.com` | Technicien Maintenance | Équipement de quai de chargement, compresseurs de stockage frigorifique, intégrité des rayonnages.                                                                                 |
| `ivan@meridian.com`    | Sûreté                 | Événements badge sur quais, alertes quai-resté-ouvert hors heures.                                                                                                                 |

**Pour basculer en vue entrepôt**, connectez-vous en tant qu'utilisateur Meridian et choisissez _Meridian Distribution Center East_ dans le menu déroulant du bâtiment dans la barre supérieure.

---

## À essayer (visite de 7 minutes)

1. **Connectez-vous en Jamie. Basculez le BuildingSwitcher** sur _Meridian Distribution Center East_. Notez que l'eyebrow de Ma journée se met à jour : _« entrepôt · 240 000 pi² »_ — le même shell Merlin, immédiatement conscient du bâtiment.
2. **Lisez les cartes d'attention.** Critique : _Dérive du stockage frigorifique — Bay A_. Haute : _Dérive de remorque signalée — Loading Dock A_. _Événement d'impact chariot — Allée 09_. Ce sont des incidents spécifiques entrepôt, pas des incidents bureaux.
3. **Ouvrez Exploitation → Hypervisor.** Naviguez dans les 2 étages (Rez-de-chaussée · Mezzanine). 30 pièces-allées + 11 pièces spéciales (quais de chargement, stockage frigorifique, salle de pause). 30 équipements répartis — dont 2 sondes SLB en stockage frigorifique.
4. **Exploitation → Plannings.** 4 tournées optimisées pour cadence entrepôt : contrôle quotidien des quais + stockage frigorifique, sanitaires + salle de pause matin, balayage des allées Rez-de-chaussée + Mezzanine.
5. **Exploitation → Équipements.** Filtrez sur stockage frigorifique. 2 sondes SLB remontent température + humidité à l'agent Cold-Chain.
6. **Innovation.** Nouvelle étagère en haut : _« Recommandé pour Meridian Distribution Center East »_ — 10 cartes de fournisseurs spécifiques entrepôt. Cliquez sur Rite-Hite ou Cooler Concepts pour le pitch d'intégration.
7. **Demandez à Merlin dans le chat :** _« Que se passe-t-il sur les quais aujourd'hui ? »_ La réponse est ancrée dans les zones réelles des quais + les alertes récentes.

---

## Points forts à mettre en avant

- **Même espace de travail, forme différente.** Basculer le sélecteur de bâtiment est toute l'UX d'expansion — pas de seconde installation, pas de second login.
- **Agent Cold-Chain.** Premier agent vertical entrepôt. Surveille les sondes SLB de stockage frigorifique pour les relevés obsolètes ou une dérive soutenue, demande la dépêche d'un technicien quand le pattern le justifie.
- **Étagère Innovation par variant.** Le marché fait remonter les fournisseurs pertinents _parce que_ le bâtiment porte `variant='warehouse'`. La même étagère montre les fournisseurs santé quand vous basculez vers Health Clinic.
- **Eyebrow Ma journée conscient du type.** « Meridian Distribution Center East · entrepôt · 240 000 pi² » au lieu d'un générique « Meridian Distribution Center East ». Petit détail, gros gain de lisibilité pour les opérateurs de portefeuille.

---

## Ce qui est seedé dans cette démo

- 1 bâtiment (`mde`) · 2 étages · 30 pièces-allées · 11 pièces spéciales
- 16 zones · 4 tournées de nettoyage
- 30 équipements : 3 écrans e-ink sanitaires · 6 compteurs · 6 loggers (dont 2 en stockage frigorifique) · 4 capteurs de fuite · 4 caméras · 4 lecteurs de badge HID · 3 capteurs qualité de l'air
- Agent Cold-Chain actif sur la zone de stockage frigorifique
- 10 cartes de fournisseurs entrepôt dans Innovation
- 6 actions d'agent pré-seedées « Merlin s'est occupé de ceci » (réglage compresseur stockage frigorifique, réappro batteries chariots, proposition de réduction allées, journal audit HACCP, escalade quai B, libération bureau manager)

---

## État du replay de démo

**En replay depuis le 17/05/2026** — MDE est un bâtiment sous l'org Meridian, qui porte `replay_mode=true` à l'échelle de l'org. La fixture capturée (~14 500 exécutions + 5 000 demandes au total à travers HQ + MDE + MHC) est réémise par le cron de replay chaque minute. L'activité de l'agent Cold-Chain que vous voyez dans Ma journée ou le flux Activité fait partie de cette fixture. **Aucun token Claude en direct n'est consommé.**

Voir [`docs/operations/demo-replay.md`](../../operations/demo-replay.md) pour le flux opérationnel.

---

## Quand utiliser cette démo

- **Après Meridian HQ**, pour montrer l'expansion de portefeuille. Le récit est _« nous couvrons déjà vos étages de bureaux — même logiciel, pas de nouvelle installation, couvre aussi vos centres de distribution. »_
- **Pour audiences CFO/COO** — la proposition de valeur est _une plateforme à travers le portefeuille, pas une par type d'actif._
