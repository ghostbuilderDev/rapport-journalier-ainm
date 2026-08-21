# Mise à jour V8.3 depuis Termux

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.3-signature-passation-distante.zip` dans `Downloads`, exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.3-signature-passation-distante.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.3 : signatures et passation distante"
git push
```

Après `git push`, attendre une à deux minutes puis fermer/réouvrir la PWA. Le cache V8.3 force le chargement de l'interface mise à jour.

## Activer la transmission à distance

Une fois le dépôt publié, déployer le relais une seule fois depuis Termux :

```sh
pkg install nodejs
cd ~/projets/rapport-journalier-ainm-pwa/server
npm install
npx wrangler login
npm run check
npm run deploy
```

La dernière commande affiche une adresse `https://…workers.dev`. La copier, puis ouvrir la PWA :

1. Aller dans **Contrôle**.
2. Toucher **Transmettre à distance**.
3. Saisir le nom du rédacteur, son rôle et la personne / partie suivante.
4. Coller l'adresse du relais dans **Adresse du serveur de passation**.
5. Toucher **Synchroniser et transmettre** puis envoyer le lien proposé.

Le destinataire ouvre ce lien dans la PWA. S'il ne s'ouvre pas directement, il ouvre l'application, touche **Ouvrir un lien reçu**, colle le lien puis touche **Recevoir le rapport**.

Avant l'utilisation de données de chantier réelles, faire valider l'hébergement du relais par le SI/RSSI SNCF. Le relais est chiffré côté téléphone mais reste un service externe tant qu'il n'est pas hébergé dans l'environnement SNCF approuvé.
