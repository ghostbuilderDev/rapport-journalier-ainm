# Rapport journalier AINM — PWA terrain V8.3

Application hors ligne pour les rapports journaliers de travaux signalisation AINM.

## Ce qui change dans cette version

- Le PDF actif revient au **rendu V5** : rapport tabulaire opérationnel A4, logo AINM, données terrain puis annexe financière uniquement pour l’administrateur. Les maquettes de génération V6/V7/V7.1 ne sont plus utilisées.
- L’en-tête mobile est simplifié : **AINM travaux · Rapport journalier · AINM travaux signalisation**. Les indicateurs « Production », « Estimation HT », le statut financier et les libellés de tronçon ne sont plus affichés à cet endroit.
- Les entreprises intervenantes sont choisies dans une **liste déroulante compacte**, puis ajoutées une à une à la séance. **Bouygues Energies & Services** et **TSO Signalisation** sont désormais deux choix distincts ; GEQ et CEM sont retirés.
- Saisie rapide des équipes avec de grands compteurs **− / +** pour chaque entreprise : chef de chantier, chef d’équipe, opérateurs travaux et intérimaires. Les fonctions complémentaires restent accessibles par « Autre fonction ».
- Les prestataires de sécurité disposent notamment des rôles Agent prestataire, Sentinelle, Annonceur et **Agent lorry** ; ce dernier n’est plus proposé dans les entreprises travaux.
- Saisie rapide du personnel SNCF avec les libellés corrigés : **Adjoint S11**, **Adjoint S6**, KV caténaire, KVSE, surveillant travaux SE, surveillant voie, agent RSO et agent prestataire. Les libellés obsolètes sont migrés automatiquement.
- Les engins peuvent être ajoutés très rapidement, un par un, depuis une même zone : famille, engin et entreprise. Chaque ajout crée une ligne ensuite modifiable ; le 4x4/véhicule léger est disponible.
- Les **interceptions et consignations** sont saisies dans un tableau unique : prévue, accordée, ARF/réelle et intervention, avec voie et zone. La référence ITC/ARF/AAN est supprimée de la saisie.
- Chaque ligne d’interception/consignation peut recevoir une **photo ARF début** et une **photo ARF fin**, prise à l’appareil ou choisie dans les fichiers. Les anomalies qualité-sécurité disposent du même choix.
- Les prestations, rapports fournis et fiches peuvent recevoir des **photos jointes** depuis l’appareil ou les fichiers. Elles sont annexées au PDF.
- Chaque entreprise ajoutée possède une fiche de **responsable** dès le contexte de séance : nom et fonction. Les signatures tactiles sont réalisées uniquement dans la dernière étape et sont placées en bas du PDF V5, après les tableaux et les photos.
- Les zones de signature sont renforcées pour Android : tracé tactile/stylet, capture du pointeur, protection contre le défilement, conservation après rotation d'écran, effacement et validation explicite. Un visa entreprise ne peut plus être enregistré sans signature.
- Le PDF V5 reprend aussi les matériaux, autocontrôles, faits marquants et travaux restants. L’**annexe comptable V5** reste à la fin du PDF administrateur seulement.
- Les tableaux d’effectifs entreprises et SNCF sont désormais réellement pilotables sur le terrain : grands compteurs − / +, ajout d’une fonction, modification détaillée et retrait d’une fonction ou d’une ligne.
- La sauvegarde locale est automatique. La fonction **Transmettre à distance** synchronise le même rapport chiffré avec un relais, puis envoie un lien sécurisé par messagerie. Le destinataire récupère le même numéro, les photos, les visas et la dernière révision, où qu’il se trouve.

## Règle de numérotation

Chaque nouveau rapport reçoit un numéro non modifiable. Le compteur avance localement et le code appareil rend le numéro complet distinct même sans réseau. Une passation conserve le même numéro et augmente seulement la révision du brouillon.

## Utilisation terrain

1. Renseigner l’opération, la date et les entreprises intervenantes.
2. Saisir les prestations réalisées ; les prix restent invisibles pour les agents terrain.
3. Utiliser les compteurs pour les effectifs et les moyens SNCF, puis compléter uniquement les particularités nécessaires.
4. Compléter les horaires ITC/consignation et joindre les photos ARF si elles existent.
5. Ajouter les photos avant/après, celles des prestations et les anomalies ; renseigner puis faire signer les responsables à la fin de la saisie.
6. Choisir **Imprimer le rapport PDF**. L’annexe de valorisation V5 est visible seulement après ouverture de l’espace administrateur.

## Passation distante

Le relais inclus permet de faire circuler le même rapport à plusieurs kilomètres, sans Bluetooth ni contact direct :

1. Déployer une fois le relais indiqué dans [`server/README.md`](server/README.md), puis copier son adresse HTTPS.
2. Sur le premier téléphone, ouvrir **Contrôle → Transmettre à distance**, renseigner son nom, son rôle, la partie suivante à compléter et l'adresse du relais.
3. Toucher **Synchroniser et transmettre** ; le téléphone chiffre le rapport, l'enregistre sur le relais puis propose l'envoi d'un lien par WhatsApp, SMS ou e-mail.
4. Le suivant ouvre le lien dans la PWA ou le colle dans **Ouvrir un lien reçu**. Il récupère toutes les saisies déjà faites et complète sa partie.
5. Il retransmet ensuite le même lien de capacité après synchronisation. Une révision serveur évite l'écrasement silencieux si deux personnes modifient le rapport en même temps.

Le relais ne reçoit pas les prix administrateur : la PWA enlève les réglages et les lignes de valorisation avant chiffrement. Pour un usage de production SNCF, l'hébergement et les règles de conservation doivent être validés par le SI/RSSI SNCF ; le même client peut être raccordé à un relais interne compatible.

## Déploiement GitHub Pages / Termux

Décompresser le contenu de cette archive dans le dépôt puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.3-signature-passation-distante.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.3 : signatures et passation distante"
git push
```

Attendre une à deux minutes, puis recharger l’URL GitHub Pages ou fermer/réouvrir la PWA. Le cache du service worker est passé à `rj-ainm-v8-3` pour récupérer cette version.

## Limites connues

- Le code administrateur est un verrou local d’interface ; il ne remplace pas une authentification SNCF centralisée.
- Les photos sont compressées et conservées dans le navigateur : exporter régulièrement les rapports terminés, surtout sur les appareils à faible capacité.
