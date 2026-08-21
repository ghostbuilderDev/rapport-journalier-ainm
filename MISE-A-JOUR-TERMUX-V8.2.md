# Mise à jour V8.2 depuis Termux

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.2-passation-terrain.zip` dans `Downloads`, exécuter ces commandes dans Termux :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.2-passation-terrain.zip
cd ~/projets/rapport-journalier-ainm-pwa
rm -f output/pdf/rapport-journalier-ainm-trame-v6.pdf
rm -f output/pdf/rapport-journalier-ainm-trame-adaptative-v7.pdf
rm -f tools/generate_trame_v7_pdf.py
git add -A
git commit -m "Mise à jour V8.2 : passation et effectifs"
git push
```

Si `unzip` indique qu’il ne trouve pas le fichier, vérifier son nom avec :

```sh
ls ~/storage/downloads
```

Après `git push`, attendre une à deux minutes, puis fermer et rouvrir l’application installée. Le cache V8.2 (`rj-ainm-v8-2`) force le chargement de la nouvelle interface.
