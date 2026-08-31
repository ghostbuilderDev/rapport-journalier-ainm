# Mise à jour V9.1 — visas et SharePoint

Après avoir téléchargé `rapport-journalier-ainm-pwa-v9.1-visas-sharepoint.zip` dans le dossier **Downloads**, ouvrir Termux puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v9.1-visas-sharepoint.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V9.1 : visas et SharePoint"
git push
```

Attendre une à deux minutes. Fermer complètement l’application AINM puis la rouvrir : l’écran d’accueil doit afficher **V9.1**.

Dans la partie finale du rapport :

- le visa **MOETx / surveillant de travaux** est unique ;
- après avoir effacé une signature, toucher **Enregistrer** pour conserver la case avec l’état **À signer** ;
- **Archiver sur SharePoint** transmet un PDF tout en conservant le brouillon et les signatures sur le téléphone.
