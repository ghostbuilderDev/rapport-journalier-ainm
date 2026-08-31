# Mise à jour V8.6 — enregistrement et signatures

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.6-correctifs-enregistrement-signatures.zip` dans le dossier **Downloads**, ouvrir Termux puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.6-correctifs-enregistrement-signatures.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.6 : enregistrement et signatures"
git push
```

Attendre une à deux minutes. Fermer ensuite complètement l’application AINM puis la rouvrir. La version V8.6 force la vérification du cache PWA.
