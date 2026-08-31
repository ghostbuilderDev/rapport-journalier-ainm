# Mise à jour V8.8 — mise en page des effectifs

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.8-mise-en-page-effectifs.zip` dans le dossier **Downloads**, ouvrir Termux puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.8-mise-en-page-effectifs.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.8 : mise en page des effectifs"
git push
```

Attendre une à deux minutes. Fermer ensuite complètement l’application AINM, puis la rouvrir : la version V8.8 force la vérification du cache PWA.
