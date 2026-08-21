# Rapport journalier AINM — PWA terrain V8

Application hors ligne pour les rapports journaliers de travaux signalisation AINM.

## Ce qui change dans cette version

- Le PDF actif revient au **rendu V5** : rapport tabulaire opérationnel A4, logo AINM, données terrain puis annexe financière uniquement pour l’administrateur. Les maquettes de génération V6/V7/V7.1 ne sont plus utilisées.
- L’en-tête mobile est simplifié : **AINM travaux · Rapport journalier · AINM travaux signalisation**. Les indicateurs « Production », « Estimation HT », le statut financier et les libellés de tronçon ne sont plus affichés à cet endroit.
- Plusieurs **entreprises intervenantes** et prestataires peuvent être sélectionnés pour une même séance. Les effectifs sont rattachés à chaque entreprise.
- Saisie rapide des équipes avec de grands compteurs **− / +** : conducteur travaux, chef de chantier, chef d’équipe, opérateurs, intérimaires ; prestataires de sécurité ETF Services, Sentinelles du Rail, LSDR, etc.
- Saisie rapide du personnel SNCF avec les libellés corrigés : **Adjoint S11**, **Adjoint S6**, KV caténaire, KVSE, surveillant travaux SE, surveillant voie, agent RSO et agent prestataire. Les libellés obsolètes sont migrés automatiquement.
- Les engins ont une fiche plus courte : engin, entreprise, quantité et voie/zone de travail d’abord ; identification et sécurité restent disponibles dans le complément.
- Les **interceptions et consignations** sont saisies dans un tableau unique : prévue, accordée, ARF/réelle et intervention, avec voie, zone et référence ITC/ARF/AAN.
- Chaque ligne d’interception/consignation peut recevoir une **photo ARF début** et une **photo ARF fin**. Les anomalies qualité-sécurité peuvent aussi contenir une photo.
- Les entreprises intervenantes disposent de **visas individuels** : entreprise, nom, fonction, signature au doigt et date. Ils apparaissent dans le PDF V5.
- La sauvegarde locale est automatique. La fonction **Préparer une passation** exporte le brouillon avec le même numéro de rapport, une révision et l’auteur ; le fichier est ensuite partagé par Android, messagerie, Bluetooth ou e-mail. Le destinataire l’importe depuis Actions.

## Règle de numérotation

Chaque nouveau rapport reçoit un numéro non modifiable. Le compteur avance localement et le code appareil rend le numéro complet distinct même sans réseau. Une passation conserve le même numéro et augmente seulement la révision du brouillon.

## Utilisation terrain

1. Renseigner l’opération, la date et les entreprises intervenantes.
2. Saisir les prestations réalisées ; les prix restent invisibles pour les agents terrain.
3. Utiliser les compteurs pour les effectifs et les moyens SNCF, puis compléter uniquement les particularités nécessaires.
4. Compléter les horaires ITC/consignation et joindre les photos ARF si elles existent.
5. Ajouter les photos avant/après, les anomalies et les visas des responsables.
6. Choisir **Imprimer le rapport PDF**. L’annexe de valorisation est visible seulement après ouverture de l’espace administrateur.

## Passation entre téléphones

La PWA fonctionne hors ligne : elle ne réalise donc pas une synchronisation simultanée par Internet. Pour faire compléter le même rapport par un RPTx, un Adjoint S11 ou un RSO :

1. Ouvrir **Préparer une passation**, renseigner son nom, son rôle et le destinataire.
2. Partager le fichier JSON généré.
3. Sur l’autre téléphone, ouvrir Actions puis **Importer une passation / saisie**.
4. Le destinataire complète et renvoie une nouvelle passation. L’application avertit si une révision plus ancienne risque d’écraser une saisie plus récente.

Une synchronisation multi-utilisateur en temps réel nécessiterait ensuite un stockage central SNCF (intranet, SharePoint ou API) et une authentification nominative.

## Déploiement GitHub Pages / Termux

Décompresser le contenu de cette archive dans le dépôt puis exécuter :

```sh
cd ~/projets/rapport-journalier-ainm-pwa
git add .
git commit -m "Mise à jour V8 : PDF V5 et saisie terrain"
git push
```

Attendre une à deux minutes, puis recharger l’URL GitHub Pages ou fermer/réouvrir la PWA. Le cache du service worker est passé à `rj-ainm-v8` pour récupérer cette version.

## Limites connues

- Le code administrateur est un verrou local d’interface ; il ne remplace pas une authentification SNCF centralisée.
- Les photos sont compressées et conservées dans le navigateur : exporter régulièrement les rapports terminés, surtout sur les appareils à faible capacité.
