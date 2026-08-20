# Rapport journalier AINM — PWA terrain

Cette première version transforme les trames fournies en un rapport utilisable sur téléphone pour les travaux signalisation. L’agent ne choisit que des libellés simples (« Pose caniveau GM / TGM », « Demi-entretoise », etc.) ; le rapport conserve ces libellés opérationnels et la valorisation est calculée séparément.

## Ce qui est intégré

- Rapport terrain avec contexte de séance, main-d’œuvre, engins, production, interceptions / consignations, anomalies, pièces jointes déclarées, moyens SNCF et visas.
- Mise en page imprimable A4 proche des trames fournies.
- Annexe de valorisation interne : quantité, référence de prix, prix unitaire HT et montant indicatif HT.
- Catalogue de **1 796 lignes de prix** issu du détail estimatif AINM « version C — 27/08/2025 ».
- Règle automatique de plage horaire pour les travaux de génie civil : jour, nuit N1/N2/N3 et week-end / jour férié.
- Coefficients contractuels de la série 300 appliqués dans les prix unitaires affichés dans l’annexe interne.
- Brouillon local hors-ligne, export/import JSON, impression / enregistrement PDF depuis le navigateur et partage Android lorsque disponible.
- Fichiers PWA (manifest + service worker) : une fois le dossier déployé sur un hébergement HTTPS, l’application peut être installée sur les téléphones.

## Règle de sûreté de valorisation

L’application ne devine jamais une référence lorsqu’un même libellé du bordereau possède plusieurs articles indistinguables dans le fichier source. Dans ce cas, la production est bien ajoutée au rapport mais apparaît « À qualifier » dans l’annexe. L’encadrant règle ce point une fois dans **Actions → Paramétrer les prix du chantier**. Le choix est enregistré localement pour les prochains rapports du même appareil.

Cette règle concerne notamment les libellés déjà présents dans la trame mais non retrouvés de façon univoque dans le bordereau : CIT 1400, RVL 120, déroulage 95/240 mm², finitions BJ, ainsi que certaines variantes d’intervalle de décharge et de connexion inductive.

## Déploiement terrain

1. Déposer l’intégralité du dossier sur un hébergement HTTPS (GitHub Pages, intranet ou site statique validé SNCF).
2. Ouvrir l’URL sur Android, puis utiliser « Installer l’application » dans le navigateur.
3. Paramétrer les références de prix ambiguës une fois par chantier avec le préparateur / gestionnaire de marché.
4. Sur le terrain : renseigner le contexte, ajouter les prestations par libellé simple, contrôler les alertes, puis **Imprimer / PDF**.

> Ouvrir `index.html` directement depuis un gestionnaire de fichiers permet la saisie et l’impression, mais l’installation PWA et le mode hors-ligne complet nécessitent l’hébergement HTTPS.

## À confirmer avant la mise en production

- Table de correspondance contractuelle des éléments CIT 1400, RVL 120, déroulage câble et finitions BJ.
- Signification métier des variantes `.01` / `.02` lorsque leur libellé de bordereau est identique.
- Gestion des signatures, archivage SharePoint et numérotation centralisée ; ces éléments peuvent reprendre le mécanisme déjà établi pour le briefing au pied d’opération.
