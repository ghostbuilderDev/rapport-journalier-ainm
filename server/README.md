# Relais distant du rapport journalier AINM

Ce dossier contient le petit serveur de passation distante. Il est prévu pour Cloudflare Workers avec un Durable Object, afin qu'une seule version du rapport soit écrite à la fois.

Le téléphone chiffre le rapport avant l'envoi (AES-GCM). Le serveur reçoit un contenu chiffré, une révision et un jeton d'accès ; il ne reçoit ni les prix administrateur ni le contenu lisible du rapport. Chaque passation est automatiquement effacée du relais après 14 jours. Le brouillon local et le PDF restent sur les téléphones.

## Déployer depuis Termux

Depuis le dossier de l'application mis à jour :

```bash
pkg install nodejs
cd ~/projets/rapport-journalier-ainm-pwa/server
npm install
npx wrangler login
npm run check
npm run deploy
```

La dernière commande affiche une adresse du type `https://ainm-report-relay.<votre-sous-domaine>.workers.dev`. Copier cette adresse.

Ouvrir ensuite l'application AINM, aller dans **Contrôle**, choisir **Transmettre à distance**, coller cette adresse dans **Adresse du serveur de passation**, renseigner son nom et la partie à compléter, puis toucher **Synchroniser et transmettre**. Le lien sécurisé est alors envoyé par WhatsApp, SMS ou e-mail au prochain intervenant, quel que soit son lieu.

Le destinataire ouvre le lien dans l'application ; il récupère le même numéro de rapport et la dernière révision. Après sa saisie, il utilise à son tour **Transmettre à distance**. En cas de modification simultanée, le serveur refuse l'écrasement et l'application demande d'actualiser la dernière version.

## Avant mise en production SNCF

Ce relais est une base technique de démonstration. Faire valider l'hébergement, la conservation des données et l'usage des liens de capacité par le SI / RSSI SNCF avant de l'utiliser avec des données de chantier réelles. L'application peut être raccordée au même format d'API sur un serveur SNCF approuvé ; il suffit alors de saisir l'adresse de ce serveur dans l'application.
