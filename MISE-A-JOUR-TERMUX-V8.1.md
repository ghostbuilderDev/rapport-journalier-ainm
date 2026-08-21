# Mise à jour V8.1 depuis Termux

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8.1-saisie-photos.zip` dans `Downloads`, exécuter ces commandes dans Termux :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.1-saisie-photos.zip
cd ~/projets/rapport-journalier-ainm-pwa
rm -f output/pdf/rapport-journalier-ainm-trame-v6.pdf
rm -f output/pdf/rapport-journalier-ainm-trame-adaptative-v7.pdf
rm -f tools/generate_trame_v7_pdf.py
git add -A
git commit -m "Mise à jour V8.1 : saisie et annexes photo"
git push
```

Si `unzip` indique qu’il ne trouve pas le fichier, vérifier son nom avec :

```sh
ls ~/storage/downloads
```

Après `git push`, attendre une à deux minutes, puis fermer et rouvrir l’application installée. Le cache V8.1 (`rj-ainm-v8-1`) force le chargement de la nouvelle interface.
