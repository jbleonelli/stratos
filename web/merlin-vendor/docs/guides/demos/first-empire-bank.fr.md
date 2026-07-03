# Démo · First Empire Bank

**La démo de réseau retail.** Un écosystème de 578 agences bancaires de détail à travers l'État de New York, modélisé sur des données FDIC réelles d'agences Chase. Une équipe FM centrale, un écran par agence, des centaines de petits sites opérationnellement similaires — un profil d'échelle complètement différent d'une tour unique.

> **En une phrase :** « Quand vous exploitez 578 agences, vous ne supervisez pas des bâtiments individuels — vous supervisez des patterns. Merlin rend les patterns visibles. »

---

## Ce que la démo représente

- **Un locataire immobilier** (First Empire Bank) exploitant 578 agences à travers l'État de NY, organisées en 6 régions (Manhattan, Bronx, Brooklyn, Queens, Staten Island, Upstate).
- **Un espace de travail de type écosystème**, pas un bâtiment unique. Le sélecteur montre les régions comme entités de premier niveau ; vous explorez une région pour voir ses agences.
- **Uniformité à l'échelle agence.** Chaque agence a 1 écran intelligent + 1 grappe de capteurs + cadences standardisées de nettoyage + réappro. Le signal intéressant n'est pas par agence — c'est _quelles agences dérivent de la moyenne_.
- **Surfaces agrégat-d'abord.** Le Ma journée fait remonter sur les 578 agences ; les cartes d'attention font surface aux quelques outliers qui méritent un regard humain.

---

## Avec quel compte se connecter

| E-mail                  | Rôle                | Ce qu'il voit                                                                                                                               |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `robin@adaptiv.systems` | Super-admin Adaptiv | Connectez-vous ici, puis utilisez le **menu d'espace de travail** (menu du compte en haut à droite) pour basculer vers _First Empire Bank_. |

> First Empire Bank est livré avec un profil d'utilisateur démo simplifié — les super-admins Adaptiv utilisent le sélecteur d'espace de travail pour entrer dans le locataire. L'ensemble complet des personas FM pour FEB est sur la feuille de route du prochain rafraîchissement démo.

Pour naviguer dans FEB, utilisez le **sélecteur région/agence** (en haut à gauche de la barre supérieure). Choisissez une région (ex. « Manhattan ») pour réduire toutes les surfaces aux agences de cette région.

---

## À essayer (visite de 8 minutes)

1. **Connectez-vous en Robin → menu espace de travail → First Empire Bank.** Vous atterrissez sur Ma journée. Notez que l'eyebrow lit _« First Empire Bank · 578 agences »_ — l'entité que Merlin surveille est le réseau, pas un bâtiment unique.
2. **Lisez les cartes d'attention.** Attendez-vous à des choses comme _« Écran hors ligne — Manhattan · 34th St »_, _« Fuite signalée — Syracuse · Westcott »_, _« Tentative d'effraction — Bronx · Fordham »_. Chaque carte nomme l'agence directement pour que la dépêche soit à un clic.
3. **Choisissez une région** dans le BuildingSwitcher. Le sélecteur indente les sous-régions avec un sous-en-tête « RÉGIONS » et une pastille « Région » (distincte de « Écosystème » pour le parent).
4. **Exploitation → Hypervisor.** Explorez : First Empire Bank → région Manhattan → agence individuelle → son écran intelligent + sa grappe de capteurs. Chaque agence apparaît comme une localisation `kind='branch'` avec lat/long, adresse, et liste d'équipements intégrée.
5. **Exploitation → Équipements.** Filtrez par région. 578 loggers intelligents (un par agence) plus les rollups régionaux.
6. **Demandez à Merlin dans le chat :** _« Quelles sont les 5 agences avec la pire performance SLA Hygiène ce mois-ci ? »_ Le chat lit l'agrégat de l'écosystème et nomme des agences spécifiques.
7. **Rapports.** Tirez un rapport régional pour voir comment les SLA de nettoyage + fournitures se posent sur les 578 agences en agrégat. La vue d'impact cumulé est la surface « que nous a fait économiser Merlin ce trimestre » de l'acheteur.

---

## Points forts à mettre en avant

- **Échelle.** 578 agences est le bon nombre pour démontrer la valeur de détection de patterns de Merlin. Une démo à 10 agences ne ferait pas surface au même besoin.
- **Écosystème ≠ Bâtiment.** Le modèle de données + l'UI traitent un rollup régional différemment d'une tour unique. Le sélecteur, Ma journée, l'onglet Rapports agrègent tous par région d'abord, puis descendent à l'agence.
- **Géographie réelle.** Les adresses + coordonnées des agences viennent de vraies données FDIC FFIEC (agences Chase NY). Le widget carte les rend au lat/long correct.
- **Sites opérationnellement similaires.** Comme chaque agence porte le même kit matériel + cadences, ce sont les _déviations_ qui importent. Le boulot de Merlin est de faire surface aux déviations + auto-gérer les routinières.
- **La vue agrégat qui n'existe pas dans les tableurs.** Essayez de demander au chat : _« Tri des agences par violations de SLA cette semaine. »_ C'est une réponse en 30 secondes dans Merlin contre un exercice Excel d'une demi-journée.

---

## Ce qui est seedé dans cette démo

- 1 locataire de type écosystème · 6 régions
- 578 agences (vraies données Chase NY via FDIC)
- 578 équipements écran intelligent (un par agence) + grappes de capteurs
- SLA agrégés de nettoyage + fournitures calculés à travers le réseau
- ECOSYSTEM_SNAPSHOT statique avec incidents typés agence

---

## État du replay de démo

**En replay depuis le 17/05/2026** (`replay_mode=true`, fenêtre de fixture de 7 jours). L'activité des agents qui apparaît dans le flux Activité, dans le panneau « Merlin a traité » de Ma journée, et dans chaque pill de décision par agent est **émise depuis une fixture capturée sur 7 jours** — 421 exécutions substantielles à travers 7 agents adaptés au domaine bancaire (nettoyage, conformité, approvisionnement, énergie, sécurité, espace, CVC), plus 171 demandes. **Aucun token Claude en direct n'est consommé pour ce locataire.** Ce que vous voyez est une activité de forme réelle à coût continu nul.

Pour les platform admins : la fixture vit dans `demo_fixtures.*` ; le cron de replay à `/api/agents/replay-tick` la réémet dans `public.agent_runs` / `public.merlin_asks` à une cadence d'1 minute. Doc opérationnelle complète à [`docs/operations/demo-replay.md`](../../operations/demo-replay.md).

---

## Quand utiliser cette démo

- **Pour acheteurs de réseaux retail** — agences bancaires, chaînes de restauration rapide, groupes dentaires, magasins d'ancrage de centres commerciaux. Tout réseau de N petits sites similaires.
- **Après Meridian HQ.** Une fois qu'un viewer comprend Merlin sur un seul bâtiment, « Merlin × 578 agences » se pose vite.
- **Pour sceptiques de la détection de patterns.** Quiconque fait encore des opérations réseau via Excel + e-mail doit voir ceci.
