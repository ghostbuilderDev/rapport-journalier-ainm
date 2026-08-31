# Mise à jour V9.2 — Rapport journalier AINM

Télécharger l’archive V9.2, puis exécuter dans Termux :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v9.2-numerotation-sharepoint.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V9.2 : numérotation et SharePoint"
git push
```

Attendre une à deux minutes, fermer complètement la PWA puis la rouvrir. La pastille de l’en-tête doit afficher **V9.2**.

Le dossier `CONFIGURATION-SHAREPOINT-RAPPORT-JOURNALIER.md` explique le seul réglage à réaliser dans le flux d’archivage : envoyer les rapports journaliers vers **RAPPORTS JOURNALIERS** plutôt que vers **BRIEFING GLOBAL**.
