# Mise à jour V8.7 — correction des menus et signature

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.7-correctif-menus-signature.zip` dans le dossier **Downloads**, ouvrir Termux puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.7-correctif-menus-signature.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.7 : correction menus et signature"
git push
```

Attendre une à deux minutes. Fermer ensuite complètement l’application AINM, puis la rouvrir : la version V8.7 force la vérification du cache PWA.
