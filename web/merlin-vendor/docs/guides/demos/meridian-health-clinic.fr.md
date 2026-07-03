# Démo · Meridian Health Clinic

**La démo d'expansion de portefeuille (édition santé).** Une clinique ambulatoire + chirurgicale de 92 000 pi² au 200 Longwood Ave, Boston (le quartier médical), exploitée par la même équipe Meridian. Même espace de travail, mêmes agents, même relation prestataire — mais les SLA deviennent **critiques pour la sécurité** et le pitch passe de « logiciel d'opérations » à « infrastructure de sécurité patient ».

> **En une phrase :** « Votre tour de bureaux achète Merlin par confort. Votre clinique achète Merlin parce que le nettoyage terminal entre procédures est un événement reportable s'il glisse. »

---

## Ce que la démo représente

- **Le même locataire Meridian Holdings** que la tour HQ + le Distribution Center. La clinique est un troisième bâtiment dans le même espace de travail.
- **3 étages** avec des fonctions différentes sur chacun :
  - **Rez · Ambulatoire** — Accueil, salle d'attente, imagerie, laboratoire, pharmacie, 3 salles d'examen, sanitaires
  - **Soins patients** — 8 chambres de salle, poste infirmier, stockage médicaments, utilité souillée/propre
  - **Chirurgical** — 4 blocs opératoires, Pré-op, PACU (salle de réveil), traitement stérile, station de désinfection
- **Agents différents, enjeux différents.** Pharmacy-Temperature surveille les frigos pharmacie + médicaments. L'agent Nettoyage suit désormais la conformité du nettoyage terminal homologué EPA, pas seulement le rangement de bureaux.
- **4 SLA spécifiques hôpital** — Rotation bloc < 25 min, nettoyage terminal 100 % des sorties, cascade de pression ≥ 2,5 Pa, hygiène des mains ≥ 80 %. Chacun porte un propriétaire opérationnel (Lead EVS, Lead Facilities, Lead contrôle des infections).

---

## Avec quel compte se connecter

Mêmes comptes Meridian que la démo HQ — un espace de travail, trois bâtiments. Mot de passe **`merlin2026`** sauf mention contraire.

| E-mail                 | Rôle                   | Ce qui change pour ce bâtiment                                                                                                                                                                       |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jamie@meridian.com`   | Facility Manager       | Le Ma journée montre des incidents de clinique (inversion de cascade de pression, nettoyage terminal en retard, dérive pharmacie). L'eyebrow lit « Meridian Health Clinic · clinique · 92 000 pi² ». |
| `maria@meridian.com`   | Lead Nettoyage         | Tournées EVS — rotation de lit en salle, nettoyage terminal des blocs, zone stérile fin de journée. Pas des passages bureaux.                                                                        |
| `darnell@meridian.com` | Technicien Maintenance | Conformité CVC cascade de pression, équipements de traitement stérile.                                                                                                                               |
| `ivan@meridian.com`    | Sûreté                 | Événements badge pour la zone stérile + portes contrôlées pharmacie.                                                                                                                                 |

**Pour basculer dans la clinique**, connectez-vous en utilisateur Meridian et choisissez _Meridian Health Clinic_ dans le menu du bâtiment.

---

## À essayer (visite de 7 minutes)

1. **Connectez-vous en Jamie. Basculez le BuildingSwitcher** sur _Meridian Health Clinic_. L'eyebrow de Ma journée se met à jour : _« clinique · 92 000 pi² »_.
2. **Lisez les cartes d'attention.** Critique : _Inversion de cascade de pression — Bloc 02 (soutenue 14 min)_. Haute : _Nettoyage terminal en retard — Chambre 03 (+18 min)_. Haute : _Dérive frigo pharmacie — pharmacie principale (4 °C → 6,8 °C)_. Ce sont des incidents de contrôle des infections + chaîne du froid, pas du bruit de tour de bureaux.
3. **Lignes « Merlin s'est occupé de ceci »** : Journal pharmacie USP 800 préparé pour signature, proposition de réduction nocturne de l'étage chirurgical, escalade badge de traitement stérile. Chacun aurait demandé une course humaine il y a 15 ans ; les agents s'en occupent en secondes.
4. **Exploitation → Hypervisor.** 3 étages → 32 pièces spécifiques — chambres de salle, blocs, traitement stérile, pharmacie avec frigo + congélateur + incubateurs de laboratoire. 30 équipements dont 8 SLB (2 en pharmacie, 3 en laboratoire, 1 humidité stérile, 2 humidité + pression bloc).
5. **Exploitation → Plannings.** 4 tournées EVS : ouverture pré-shift, rotation des lits, rotation nettoyage terminal des blocs (SLA-critique), zone stérile fin de journée. Diego gère les tournées chirurgicales ; Priya gère l'ouverture matinale.
6. **Exploitation → SLA.** 4 SLA spécifiques hôpital aux côtés des quatre SLA existants de Meridian. Chacun montre sa cible + son propriétaire (Lead EVS, Lead Facilities, Lead contrôle des infections).
7. **Innovation.** Nouvelle étagère en haut : _« Conçus pour les cliniques et hôpitaux »_ — 10 cartes de fournisseurs santé. Diversey (chimie EVS), Xenex (désinfection UV-C terminale), Steris (traitement stérile), Hillrom (lits connectés + appel infirmier), Camfil (filtration HEPA).
8. **Demandez à Merlin dans le chat :** _« Où en sommes-nous des nettoyages terminaux cette semaine ? »_ ou _« Le Bloc 02 est-il utilisable en l'état ? »_

---

## Points forts à mettre en avant

- **SLA critiques pour la sécurité.** Nettoyage terminal 100 % (Joint Commission), cascade de pression ≥ 2,5 Pa (contrôle des infections), hygiène des mains ≥ 80 % (seuil Joint Commission). Quand Merlin surveille ces SLA, ce n'est pas du confort — c'est de la sécurité patient.
- **Agent Pharmacy-Temperature.** Premier agent vertical santé. Surveille les sondes SLB pharmacie + médicaments avec un seuil de relevé obsolète plus strict de 15 min (vs 20 min pour la chaîne du froid ambiante). Demande des blocages de stock quand les relevés dérivent — la tolérance pharma est plus étroite que l'ambiante.
- **Ma journée conscient des blocs.** La carte d'attention _« Inversion de cascade de pression — Bloc 02 »_ bloquerait l'ordonnancement du cas suivant dans un bloc réel — Merlin a automatiquement mis en pause la rotation du Bloc 02.
- **Catalogue de fournisseurs santé.** 10 vraies entreprises mappées à des workflows cliniques spécifiques. Chaque carte explique exactement comment ses événements remontent dans le pipeline d'actions de Merlin.
- **Agents transversaux.** Le même agent Nettoyage qui gère les tournées sanitaires de HQ gère les rotations de nettoyage terminal de MHC — cadence différente, chimie différente, même moteur.

---

## Ce qui est seedé dans cette démo

- 1 bâtiment (`mhc`) · 3 étages · 32 pièces (chambres de salle, blocs, traitement stérile, pharmacie, laboratoire, salles d'examen)
- 18 zones · 4 tournées EVS
- 30 équipements : 3 écrans e-ink sanitaires · 6 compteurs · 8 loggers (frigo + congélateur pharmacie, frigo médicaments, 2 incubateurs laboratoire, humidité stérile, 2 humidité + pression bloc) · 4 capteurs de fuite · 4 caméras · 3 lecteurs de badge HID · 2 capteurs qualité de l'air
- Agent Pharmacy-Temperature actif sur les zones pharmacie + médicaments
- 10 cartes de fournisseurs santé dans Innovation
- 4 SLA spécifiques hôpital (rotation bloc, nettoyage terminal, cascade de pression, hygiène des mains)
- 6 actions d'agent pré-seedées « Merlin s'est occupé de ceci »

---

## État du replay de démo

**En replay depuis le 17/05/2026** — MHC est un bâtiment sous l'org Meridian, qui porte `replay_mode=true` à l'échelle de l'org. La fixture capturée (~14 500 exécutions + 5 000 demandes au total à travers HQ + MDE + MHC) est réémise par le cron de replay chaque minute. L'activité de l'agent Pharmacy-Temperature que vous voyez dans Ma journée ou le flux Activité fait partie de cette fixture. **Aucun token Claude en direct n'est consommé** — important étant donné que les SLA cliniques de MHC impliqueraient sinon un volume élevé de ticks d'agent.

Voir [`docs/operations/demo-replay.md`](../../operations/demo-replay.md) pour le flux opérationnel.

---

## Quand utiliser cette démo

- **Pour audiences système de santé.** Directeur Facilities, COO, leadership contrôle des infections.
- **Après Meridian HQ**, pour élever les enjeux. La même démo qui semblait pratique dans une tour de bureaux semble essentielle ici.
- **Pour acheteurs C-suite** qui se soucient des événements reportables, de la conformité Joint Commission et de la réduction des risques opérationnels.
