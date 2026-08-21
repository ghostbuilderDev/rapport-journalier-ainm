# Rapport journalier AINM — PWA terrain

Cette première version transforme les trames fournies en un rapport utilisable sur téléphone pour les travaux signalisation. L’agent ne choisit que des libellés simples (« Pose caniveau GM / TGM », « Demi-entretoise », etc.) ; le rapport conserve ces libellés opérationnels et la valorisation est calculée séparément.

## Ce qui est intégré

- Rapport terrain avec contexte de séance, main-d’œuvre, engins, production, interceptions / consignations, anomalies, pièces jointes déclarées, moyens SNCF et visas.
- Reprise de la dernière nuit : création d’un nouveau rapport qui reprend uniquement les équipes, engins et moyens SNCF habituels ; les travaux, photos, anomalies, consignations et signatures restent vierges.
- Numéro de rapport attribué automatiquement et non modifiable : compteur séquentiel local (`000001`, `000002`, …) complété par un identifiant d’appareil. Un nouveau rapport ne peut donc pas reprendre le numéro du précédent sur le même appareil, y compris hors ligne.
- Photos terrain limitées et compressées pour le fonctionnement hors ligne : classement **Avant nuit / Après nuit**, date et heure de prise dans le rapport, légende et impression PDF.
- Visa après travaux au doigt, daté, avec nom et fonction du signataire, ajouté en complément des deux visas existants.
- Charte AINM Infrapôle Paris Sud Est : logo intégré, palette bleu acier / cyan, icône PWA assortie et édition PDF harmonisée.
- Saisie mobile structurée des intervenants : famille (entreprise travaux, SNCF, prestataire sécurité), entreprise, fonction, effectif, heures, chef d’équipe et observation.
- Saisie mobile structurée des engins : distinction rail-route / LAM, routier / chenillard, manutention / levage et autre matériel ; identification, zone, PK et mode de mise en voie sont tracés lorsque nécessaire.
- Entreprises reprises du Briefing Opération : SNCF, ATIF, SYSTRA, ETF, LSDR, ETF SERVICE, TSO, HP ELEC, TSO Signalisation, Bouygues et TSO (LTV), avec une option « Autre ».
- Nouvelle trame imprimable A4 en trois pages : synthèse de séance, prestations saisies, puis observations / suivi / signatures. Elle reprend la composition professionnelle du modèle fourni et intègre le logo AINM dans le PDF généré.
- Champ « Objectif / consigne de la séance » pour alimenter directement la première page du rapport sans ressaisie.
- Dialogues de confirmation et messages propres à l’application : aucune bulle native de navigateur du type « ghostbuilderdev.github.io indique » n’est affichée aux agents.
- Libellés SNCF corrigés dans les listes et les anciens brouillons migrés automatiquement : « KV caténaire », « KVSE » et « Agent RSO ».
- Mode terrain par défaut : les agents saisissent les faits, les quantités et les observations sans voir ni prix, ni références PB, ni montants. Le PDF et l’export terrain suivent la même règle.
- Espace administrateur, placé en fin d’application et ouvert par un code local à 6 chiffres : contrôle hebdomadaire, rapprochement production / bordereau, réglage ponctuel du CR et annexe interne imprimable.
- Catalogue de **1 796 lignes de prix** issu du détail estimatif AINM « version C — 27/08/2025 », complété et recoupé avec le décompte n°04 PCLE du 12/08/2026.
- Règle automatique de plage horaire pour les travaux de génie civil : jour, nuit N1/N2/N3 et week-end / jour férié.
- Prix de la série 300 calculés selon la formule observée dans le décompte : **PU BPU × (1 + Maj./Min.) × CR**. Les CR 1,75 et 1,90 constatés sont proposés uniquement à l’administrateur.
- Référentiel de rapprochement enrichi entre les libellés du rapport AINM et les postes du BPU : caniveaux, artères, câbles, jonctions, intervalles de décharge, CI d’équilibrage, supports à la voie, inserts, repérage, chambres, traversées, chemins de câbles et logistique.
- Les **31 postes PB2 N2** effectivement facturés dans le décompte sont audités avec leurs montants unitaires, ainsi que **18 articles Série 300** et les lignes PB1 utilisées. Ils sont tous atteignables par les libellés terrain ; le poste 36050 (clôture limitative) est également ajouté.
- Les dispositions communes PB1-1-1, PB1-1-2 et PB1-2-1 peuvent être incluses en fin de semaine, à titre indicatif et désactivées par défaut ; les lignes logistiques PB1 restent saisissables comme prestations terrain.
- Brouillon local hors-ligne, export/import JSON, impression / enregistrement PDF depuis le navigateur et partage Android lorsque disponible.
- Fichiers PWA (manifest + service worker) : une fois le dossier déployé sur un hébergement HTTPS, l’application peut être installée sur les téléphones.

## Séparation terrain / administration

L’agent terrain ne peut pas afficher l’annexe de valorisation : les références marché, les prix, les totaux, les CR et les paramètres de rattachement sont absents de son écran, de son PDF et de son export JSON. En bas du rapport, la carte « Accès administrateur » permet à l’administrateur principal de créer puis saisir un code local à 6 chiffres. L’accès est reverrouillable à tout moment.

> Ce code est un verrou d’interface local au téléphone, adapté à la PWA hors ligne ; il ne remplace pas une authentification SNCF centralisée. Pour une protection organisationnelle complète, la prochaine étape sera une connexion nominative (SSO / intranet) et un stockage centralisé.

## Règle de sûreté de valorisation

Les libellés usuels disposent maintenant d’un rattachement par défaut, invisible pour les agents terrain : CI 1 500 V, CIT 1400, RVL 120, intervalle de décharge, connexions 95/240 mm², déroulage/dépose de câbles, BJ et émission/réception CDV. La convention métier fournie est appliquée : `.01` = pose et `.02` = dépose. Le contrôle administrateur peut toujours enregistrer une **exception** de marché, sans exposer les prix aux agents.

Une ligne ne reste hors catalogue que si l’agent choisit explicitement « Autre prestation » ou si la quantité est absente. Le régime N2 est utilisé provisoirement pour le contrôle d’un ancien brouillon sans durée, mais l’administrateur est informé de le confirmer.

## Rapprochements déjà identifiés

- **Automatiques** : création de caniveaux PM/MM ou GM/TGM, caniveaux composites, dépose de caniveaux béton, ouverture + fermeture d’artère, fouille de recherche de BJ, coupe / perçage courant, demi-entretoise, jonction jusqu’à 95 ou 240 mm².
- **Automatiques par défaut, contrôlables en exception** : connexions de câble jusqu’à 7 m, CIT 1400 (connexion inductive), RVL 120 (intervalle de décharge), pose et dépose de câble. Pour les câbles, l’application applique ensuite automatiquement la variante jour / nuit / week-end.
- **À contrôler en fin de semaine** : toute prestation saisie en « Autre prestation », les options d’exception de marché et les situations où la durée effective a été laissée vide.

## Déploiement terrain

1. Déposer l’intégralité du dossier sur un hébergement HTTPS (GitHub Pages, intranet ou site statique validé SNCF).
2. Ouvrir l’URL sur Android, puis utiliser « Installer l’application » dans le navigateur.
3. À la première utilisation administrative, ouvrir le bas du rapport, choisir **Accès administrateur** puis créer le code local à 6 chiffres.
4. Sur le terrain : renseigner le contexte, utiliser les 8 prestations fréquentes ou la recherche, puis ajouter seulement les précisions utiles. Pour une nouvelle nuit, utiliser **Reprendre dernière nuit** plutôt que ressaisir les équipes et engins.
5. Ajouter les photos **Avant** et **Après**, recueillir le visa après travaux, puis **Imprimer / PDF**. Seul l’administrateur obtient l’annexe interne et les montants.

> Ouvrir `index.html` directement depuis un gestionnaire de fichiers permet la saisie et l’impression, mais l’installation PWA et le mode hors-ligne complet nécessitent l’hébergement HTTPS.

## À confirmer avant la mise en production

- Validation de production, avec le gestionnaire de marché, des exceptions VE 25 kV / famille 24150 lorsqu’elles se présentent : les valeurs par défaut sont posées pour les cas usuels 1 500 V / 24050.
- Règle de décompte des finitions BJ : une BJ équivaut-elle à une jonction, ou à plusieurs jonctions facturables ?
- Pour une unicité strictement centralisée entre plusieurs téléphones, raccorder la PWA à un serveur SNCF / SharePoint : hors connexion, le compteur est séquentiel par appareil et le code appareil rend le numéro complet distinct.
