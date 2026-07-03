# Démo · Prestataire (SparkleCo)

**L'autre côté de la relation FM.** Le shell prestataire de Merlin montre les mêmes données que voit le FM de Meridian, _du point de vue du prestataire_ — son portefeuille de contrats, son équipe, ses propositions, ses rapports mensuels.

> **En une phrase :** « Votre facility manager et votre prestataire regardent le même Merlin, sous des angles différents. Le contrat reste le contrat — mais les deux côtés voient enfin les mêmes chiffres. »

---

## Ce que la démo représente

- **Un locataire de type prestataire** (SparkleCo Cleaning Services) livrant des services à un ou plusieurs clients FM.
- **Un contrat actif avec Meridian HQ** — livraison de nettoyage + fournitures suivie par SLA à travers la tour de 50 étages.
- **Une vue portfolio-aware.** Lisa de SparkleCo ne voit pas la dérive CVC de Meridian ni les événements badge sécurité — seulement la tranche des données qui touche ses services contractés (nettoyage, fournitures).
- **La boucle d'intelligence prestataire :** performance SLA → propositions suggérées par IA → revue manager → rapports mensuels figés → attribution du delta SLA → recommandations de renouvellement.

---

## Avec quel compte se connecter

Mot de passe **`merlin2026`** sauf mention contraire.

| E-mail                     | Rôle                                          | Ce qu'il voit                                                                                                                                         |
| -------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lisa@sparkleco.com`       | Manager prestataire (Lead Ops chez SparkleCo) | Le shell prestataire complet — Contrats, Propositions, Rapports, Utilisation des équipes, Bâtiments servis, Commandes matériel, Insights prestataire. |
| `sarah@shineright.com`     | Admin prestataire ShineRight                  | Un second prestataire avec son propre contrat sur Meridian — utile pour montrer la concurrence multi-prestataire sur un client FM.                    |
| `erik@northstar-maint.com` | Admin NorthStar Maintenance                   | Troisième prestataire — spécialité maintenance.                                                                                                       |
| `malcolm@guardwatch.com`   | Admin GuardWatch Security                     | Quatrième prestataire — spécialité sécurité.                                                                                                          |

> **Important :** Quand Lisa se connecte, la persona de chat Merlin bascule en _mode portefeuille prestataire_ — le prompt système devient portfolio-aware, référence les contrats par nom, parle de taux de gain + utilisation des équipes + renouvellements. Même Merlin, point de vue différent.

---

## À essayer (visite de 8 minutes)

1. **Connectez-vous en Lisa.** Vous atterrissez directement sur Exploitation → Contrats. Le haut de la page montre le revenu cumulé, le run rate, le taux de gain, le temps de décision FM médian, la plus grande amélioration de pilote ce trimestre. C'est le résumé exécutif de Lisa.
2. **Cliquez dans le contrat Meridian HQ.** Voyez la performance SLA en direct par métrique (réponse hygiène nettoyage, ruptures de fournitures) plus une recommandation Merlin's-take : _« Sur la base des 90 derniers jours, vous êtes serré sur le SLA hygiène de 20 minutes — envisagez de proposer un changement de cadence de dispatch pour les étages 28-32. »_
3. **« Préparer une proposition avec Merlin »** — un clic pré-remplit une proposition avec la recommandation, des partenaires fournisseurs suggérés (depuis le marché Innovation), et le delta SLA projeté. Modifiez la proposition, sauvegardez-la en brouillon, ou envoyez-la à Meridian.
4. **Exploitation → Propositions.** Symétrique à la boîte de réception côté FM. Voyez la machine à états — brouillon, envoyé, vu, accepté/décliné/contre-proposé, accepté avec auto-amendement du contrat sur monthly_value_delta.
5. **Exploitation → Rapports.** Rapports de partage mensuel figés. Chacun est auto-narré par Merlin (le champ `contractor_note` est pré-rempli à partir des données SLA du mois + propositions acceptées). Lisa édite la narration si elle veut ; sinon le rapport est envoyable en un clic.
6. **Exploitation → Utilisation.** Charge par équipe vs capacité — surbookée / serrée / marge. Aide Lisa à décider qui proposer pour un nouveau scope.
7. **Exploitation → Matériel.** Lisa peut parcourir le catalogue d'équipements d'Adaptiv, mettre du matériel au panier, passer une vraie commande Stripe Checkout, et (une fois payé) installer les unités dans le bâtiment du client FM — totalement en self-service.
8. **Demandez à Merlin dans le chat :** _« Que devrais-je proposer à Meridian pour le renouvellement ? »_ — la persona de chat prestataire rassemble les pilotes acceptés de l'année + les deltas d'impact SLA cumulés + la fenêtre de renouvellement si end_date ≤ 60 j.

---

## Points forts à mettre en avant

- **Même Merlin, côtés opposés.** Meridian (Jamie) voit la performance de son prestataire côté FM ; SparkleCo (Lisa) voit son portefeuille côté prestataire. Les deux vues sont en direct, les deux touchent la même table de contrats — mais l'UI, le langage et les actions proposées sont accordés à chaque côté.
- **Propositions suggérées par IA ancrées dans des vraies données SLA.** Pas du contenu playbook générique — les recommandations tirent de la performance 90-jours réelle du contrat.
- **Propositions à machine d'états.** Brouillon → envoyé → vu → accepté/décliné/contre-proposé. Les deux parties voient le même état en temps réel. Les propositions acceptées avec un monthly_value_delta non nul auto-amendent le contrat.
- **Rapports mensuels figés** avec narration Merlin's-take. Le prestataire n'a pas à écrire à la main un récap chaque mois — Merlin génère le premier brouillon à partir des données.
- **Cycle de renouvellement.** Quand un end*date de contrat est dans les 60 jours, le tiroir du contrat propose *« Préparer un renouvellement avec Merlin »\_ — pré-remplit une proposition de renouvellement ancrée dans les pilotes acceptés de l'année + les deltas d'impact SLA cumulés.
- **Self-service matériel prestataire.** Lisa peut acheter + installer des équipements Adaptiv dans le bâtiment du FM — totalement de bout en bout (Stripe Checkout → webhook → fulfillment → install). Le FM n'a pas à approvisionner pour le prestataire.

---

## Ce qui est seedé dans cette démo

- 4 locataires prestataires (SparkleCo, ShineRight, NorthStar Maintenance, GuardWatch Security)
- Chacun avec un contrat actif sur Meridian HQ
- Performance SLA en direct par contrat
- Propositions + rapports mensuels pré-seedés dans divers états (brouillon / envoyé / accepté / décliné)
- Insights typés prestataire (filtrés sur catégories nettoyage + fournitures pour Lisa)
- Vue scorecard multi-prestataire côté FM (Exploitation → Prestataires)

---

## Quand utiliser cette démo

- **Quand l'audience est un prestataire ou un acheteur procurement multi-prestataire.** Le shell prestataire est le bon point de départ.
- **Après Meridian HQ**, pour montrer le côté relation. Une fois qu'un viewer a vu la vue de Jamie, basculer sur la vue de Lisa montre le même contrat sous l'angle opposé.
- **Pour procurement prestataire systèmes de santé + réseaux retail.** Le modèle tient à travers les verticaux.
