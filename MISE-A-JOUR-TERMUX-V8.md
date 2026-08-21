# Mise à jour V8 depuis Termux

Après avoir téléchargé `rapport-journalier-ainm-pwa-v8-pdf-v5-saisie.zip` dans `Downloads` :

```sh
cd ~/projets/rapport-journalier-ainm-pwa
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8-pdf-v5-saisie.zip -d /data/data/com.termux/files/home/projets
cd ~/projets/rapport-journalier-ainm-pwa/rapport-journalier-ainm-pwa
rm -f output/pdf/rapport-journalier-ainm-trame-v6.pdf
rm -f output/pdf/rapport-journalier-ainm-trame-adaptative-v7.pdf
rm -f tools/generate_trame_v7_pdf.py
git add -A
git commit -m "Mise à jour V8 : PDF V5 et saisie terrain"
git push
```

Si le dépôt GitHub contient directement les fichiers de l’application (sans sous-dossier `rapport-journalier-ainm-pwa`), copier le contenu du sous-dossier à la racine du dépôt avant `git add -A`.

Après le `git push`, attendre une à deux minutes puis fermer et rouvrir l’application installée. Le cache de la V8 est différent (`rj-ainm-v8`) : elle charge donc la nouvelle interface.
