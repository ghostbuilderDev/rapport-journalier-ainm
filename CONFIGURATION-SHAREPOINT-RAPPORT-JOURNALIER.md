# Dossier SharePoint — Rapport journalier AINM

La PWA envoie désormais les métadonnées suivantes à la passerelle existante :

- `documentType` : `rapport-journalier-ainm`
- `archiveFolder` : `RAPPORTS JOURNALIERS`

Dans le flux Power Automate qui reçoit les fichiers de la passerelle, créer ou conserver le dossier distinct **RAPPORTS JOURNALIERS**, puis orienter l’action de création de fichier vers ce dossier lorsque `documentType` vaut `rapport-journalier-ainm`.

Les briefings continuent d’utiliser leur dossier **BRIEFING GLOBAL**. Aucun changement n’est à faire dans l’application Briefing.
