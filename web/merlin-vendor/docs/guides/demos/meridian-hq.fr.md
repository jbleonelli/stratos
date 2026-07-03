# Démo · Meridian HQ

**La démo phare.** Une tour de bureaux d'entreprise de 50 étages à San Francisco, gérée par un facility manager interne et entretenue par SparkleCo, un prestataire de nettoyage sous contrat. C'est l'espace de travail à ouvrir en premier — il porte l'expérience complète de Merlin : agents en direct, relations contractuelles, vraies tournées de nettoyage, vrais SLA.

> **En une phrase :** « Voici à quoi ressemble une tour de cette taille quand un co-équipier autonome surveille chaque étage, chaque service, chaque contrat. »

---

## Ce que la démo représente

- **Un locataire immobilier** (Meridian Holdings) gérant une tour premium de 50 étages au _245 Bryant St, San Francisco_. ~780 000 pi², ~416 écrans, ~3 280 capteurs.
- **Cinq départements en parallèle** — Facilities, Nettoyage, Maintenance, Sûreté, Conformité — chacun avec son plan quotidien, ses objectifs SLA, son agent Merlin.
- **Une relation contractuelle.** SparkleCo livre les services de nettoyage à travers la tour sous un contrat suivi par SLA. Le côté prestataire de la boucle est accessible via la démo SparkleCo (voir _Démo prestataire_).
- **Un écosystème d'agents en direct.** Sept agents Merlin (Nettoyage, CVC, Espace, Fournitures, Conformité, Énergie, Sûreté) cyclent de manière autonome et publient des actions traitées + des appels à action.

---

## Avec quel compte se connecter

Tous les comptes utilisent le mot de passe **`merlin2026`** sauf mention contraire.

| E-mail                  | Rôle                                      | Ce qu'il voit                                                                                                            |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `jamie@meridian.com`    | Facility Manager                          | Shell FM complet — Ma journée, Exploitation, Rapports, Insights, Innovation. La perspective « acheteur » par défaut.     |
| `maria@meridian.com`    | Lead Nettoyage                            | Plan du jour : tournées, passages aux sanitaires, courses de réapprovisionnement, drapeaux retours. Côté équipe terrain. |
| `darnell@meridian.com`  | Technicien Maintenance                    | Dérive CVC, ordres de travail, tickets fournisseurs. Côté maintenance.                                                   |
| `ivan@meridian.com`     | Sûreté                                    | Événements badge, accès hors heures, tournées de ronde. Côté sûreté.                                                     |
| `robin@adaptiv.systems` | Super-admin Adaptiv (et admin plateforme) | Voit le shell client **et** a accès au back-office `/platform`. À utiliser pour changer d'espace de travail ou usurper.  |

Pour changer de bâtiment au sein de Meridian (HQ ↔ Distribution Center East ↔ Health Clinic), utilisez le **sélecteur de bâtiment** en haut à gauche de la barre supérieure.

---

## À essayer (visite de 10 minutes)

1. **Connectez-vous en tant que Jamie.** Vous atterrissez sur Ma journée. Notez l'eyebrow « Aperçu du jour », les 1 à 3 cartes d'attention (incidents actifs au-dessus du seuil de revue du FM), et les lignes « Depuis votre dernière visite, Merlin s'est occupé de ceci » — ce sont de vraies actions d'agents des dernières heures, pas du contenu marketing.
2. **Ouvrez la barre de chat Merlin** (à droite de l'écran). Demandez : _« Quelle est la situation des COV au 32e étage ? »_ Le chat est ancré dans l'annuaire des pièces du bâtiment et l'état SLA en direct — les réponses sont spécifiques, pas vagues.
3. **Cliquez sur Exploitation → Hypervisor.** Naviguez dans l'arbre de localisation : Bâtiment → 50 étages → pièces (sanitaires, salles de réunion, salle courrier, salle serveurs) → équipements. Chaque feuille montre l'appareil réel et son dernier état remonté.
4. **Exploitation → Plannings.** 23 tournées seedées à travers la tour. Choisissez _« Passage sanitaires matinal · Low-rise (Ét 3–17) »_ — voyez les zones visitées, l'équipe assignée (Priya principal, Maria remplaçante), et les réalisations de la veille.
5. **Exploitation → Contrats.** Le contrat en cours de SparkleCo affiche les SLA actuels (réponse hygiène, ruptures de fournitures) + le coût-de-contrat en cours. Cliquez sur un contrat pour la boucle propositions + rapports mensuels.
6. **Innovation.** L'étagère du marché — matériel Adaptiv en première partie (écrans SDC pour sanitaires, compteurs PCB, loggers SLB) et fournisseurs partenaires sélectionnés, classés par problème opérationnel à résoudre.
7. **Déconnectez-vous, reconnectez-vous en Maria.** Elle atterrit sur la vue worker — « Ma journée » avec tournées sanitaires, retours, check-ins NFC. Mêmes données, shell très différent, conforme au rôle.

---

## Points forts à mettre en avant

- **Chat Merlin en direct** qui connaît les pièces, équipements, SLA et contrats actifs du bâtiment.
- **23 tournées de nettoyage sur 50 étages** seedées avec des affectations d'équipe réalistes.
- **Activité d'agent réelle :** les agents Nettoyage, CVC, Espace, Fournitures, Conformité, Énergie, Sûreté cyclent toutes les 15 minutes. Les lignes « Merlin s'est occupé de ceci » sur Ma journée + le tableau de bord ne sont pas statiques.
- **La boucle d'intelligence prestataire :** SLA → recommandations → propositions → rapports → narration → attribution du delta SLA. Accessible des deux côtés : Meridian (FM) voit la performance de son prestataire ; SparkleCo (prestataire) voit son portefeuille. Démontable de bout en bout.
- **Shells par rôle.** Le shell FM (Jamie), le shell worker (Maria, Darnell, Ivan), le shell prestataire (Lisa @ SparkleCo), le shell admin-plateforme (Robin) partagent la même couche de données mais rendent des surfaces très différentes.

---

## Ce qui est seedé dans cette démo

- 1 bâtiment (`hq`) · 50 étages · ~360 pièces (sanitaires, salles de réunion, étages spéciaux)
- 208 zones · 23 tournées
- ~3 700 équipements (écrans + capteurs)
- 7 agents Merlin (Nettoyage, CVC, Espace, Fournitures, Conformité, Énergie, Sûreté) cyclant toutes les 15 minutes
- 1 contrat prestataire (SparkleCo) — actif, suivi par SLA, avec propositions + rapports mensuels
- 4 SLA (réponse Hygiène, Confort, Qualité de l'air, Fournitures)

---

## État du replay de démo

**En replay depuis le 17/05/2026** (`replay_mode=true` sur l'org Meridian, fenêtre de fixture de 7 jours). L'org Meridian couvre HQ + MDE + MHC sous un seul locataire, donc les trois bâtiments partagent la même fixture capturée (~14 500 exécutions + 5 000 demandes à travers l'org). L'activité des agents qui apparaît dans le panneau « Merlin a traité » de Ma journée, dans le flux Activité, et dans chaque pill de décision par agent est **émise depuis la fixture capturée** par le cron de replay chaque minute. **Aucun token Claude en direct n'est consommé pour ce locataire.** Ce que vous voyez est une activité de forme réelle à coût continu nul.

Pour les platform admins : doc opérationnelle complète à [`docs/operations/demo-replay.md`](../../operations/demo-replay.md).

---

## Quand utiliser cette démo

- **À ouvrir en premier toujours** — c'est l'espace de travail Merlin avec la plus haute fidélité.
- **Pour ancrer le récit « co-équipier IA ».** La proposition de valeur d'agent autonome est la plus visible ici.
- **Récit d'expansion de portefeuille multi-bâtiment** — montrez d'abord HQ, puis basculez vers Distribution Center East ou Health Clinic via le sélecteur pour montrer l'expansion sous un même espace de travail.
