# Mise à jour V8.9 — accueil et version visible

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.9-accueil-version.zip` dans le dossier **Downloads**, ouvrir Termux puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.9-accueil-version.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.9 : accueil et version"
git push
```

Attendre une à deux minutes. Fermer ensuite complètement l’application AINM puis la rouvrir : la page d’accueil doit afficher **V8.9** avant l’accès au rapport.
