# Rapport journalier AINM — PWA terrain

Cette première version transforme les trames fournies en un rapport utilisable sur téléphone pour les travaux signalisation. L’agent ne choisit que des libellés simples (« Pose caniveau GM / TGM », « Demi-entretoise », etc.) ; le rapport conserve ces libellés opérationnels et la valorisation est calculée séparément.

## Ce qui est intégré

- Rapport terrain avec contexte de séance, main-d’œuvre, engins, production, interceptions / consignations, anomalies, pièces jointes déclarées, moyens SNCF et visas.
- Charte AINM Infrapôle Paris Sud Est : logo intégré, palette bleu acier / cyan, icône PWA assortie et édition PDF harmonisée.
- Saisie mobile structurée des intervenants : famille (entreprise travaux, SNCF, prestataire sécurité), entreprise, fonction, effectif, heures, chef d’équipe et observation.
- Saisie mobile structurée des engins : distinction rail-route / LAM, routier / chenillard, manutention / levage et autre matériel ; identification, zone, PK et mode de mise en voie sont tracés lorsque nécessaire.
- Entreprises reprises du Briefing Opération : SNCF, ATIF, SYSTRA, ETF, LSDR, ETF SERVICE, TSO, HP ELEC, TSO Signalisation, Bouygues et TSO (LTV), avec une option « Autre ».
- Mise en page imprimable A4 proche des trames fournies.
- Annexe de valorisation interne : quantité, référence de prix, prix unitaire HT et montant indicatif HT.
- Catalogue de **1 796 lignes de prix** issu du détail estimatif AINM « version C — 27/08/2025 ».
- Règle automatique de plage horaire pour les travaux de génie civil : jour, nuit N1/N2/N3 et week-end / jour férié.
- Coefficients contractuels de la série 300 appliqués dans les prix unitaires affichés dans l’annexe interne.
- Référentiel de rapprochement enrichi entre les libellés du rapport AINM et les postes du BPU : caniveaux, artères, câbles, jonctions, intervalles de décharge et protections de câble.
- Brouillon local hors-ligne, export/import JSON, impression / enregistrement PDF depuis le navigateur et partage Android lorsque disponible.
- Fichiers PWA (manifest + service worker) : une fois le dossier déployé sur un hébergement HTTPS, l’application peut être installée sur les téléphones.

## Règle de sûreté de valorisation

L’application ne devine jamais une référence lorsqu’un même libellé du bordereau possède plusieurs articles indistinguables dans le fichier source. Dans ce cas, la production est bien ajoutée au rapport mais apparaît « À qualifier » dans l’annexe. L’encadrant règle ce point une fois dans **Actions → Paramétrer les prix du chantier**. Le choix est enregistré localement pour les prochains rapports du même appareil.

Cette règle concerne les situations où le BPU demande une information qui n’est pas portée dans la trame terrain : catégorie / diamètre extérieur d’un câble, dépose avec ou sans réemploi, pose en conduite fermée, famille 240xx ou 241xx d’un intervalle de décharge et variantes `.01/.02` de certains prix de signalisation.

## Rapprochements déjà identifiés

- **Automatiques** : création de caniveaux PM/MM ou GM/TGM, caniveaux composites, dépose de caniveaux béton, ouverture + fermeture d’artère, fouille de recherche de BJ, coupe / perçage courant, demi-entretoise, jonction jusqu’à 95 ou 240 mm².
- **Paramétrage unique par chantier** : connexions de câble jusqu’à 7 m, CIT 1400 (connexion inductive), RVL 120 (intervalle de décharge), pose et dépose de câble. Pour les câbles, le paramétrage sélectionne une **famille PB** et l’application applique ensuite automatiquement la variante jour / nuit / week-end.
- **À valider avant facturation** : finitions BJ (règle de décompte « 1 BJ = 1 jonction ») ; perçage sur métal avec caractéristiques spécifiques ; caniveaux composites en dépose.

## Déploiement terrain

1. Déposer l’intégralité du dossier sur un hébergement HTTPS (GitHub Pages, intranet ou site statique validé SNCF).
2. Ouvrir l’URL sur Android, puis utiliser « Installer l’application » dans le navigateur.
3. Paramétrer les références de prix conditionnelles une fois par chantier avec le préparateur / gestionnaire de marché.
4. Sur le terrain : renseigner le contexte, ajouter les prestations par libellé simple, contrôler les alertes, puis **Imprimer / PDF**.

> Ouvrir `index.html` directement depuis un gestionnaire de fichiers permet la saisie et l’impression, mais l’installation PWA et le mode hors-ligne complet nécessitent l’hébergement HTTPS.

## À confirmer avant la mise en production

- Choix contractuel pour CIT 1400 : VE 1 500 V (29050) ou 25 kV (29051), puis variante `.01` / `.02`.
- Choix contractuel pour RVL 120 : famille 24050 ou 24150, puis variante `.01` / `.02`.
- Signification métier des variantes `.01` / `.02` lorsque leur libellé de bordereau est identique.
- Règle de décompte des finitions BJ : une BJ équivaut-elle à une jonction, ou à plusieurs jonctions facturables ?
- Gestion des signatures, archivage SharePoint et numérotation centralisée ; ces éléments peuvent reprendre le mécanisme déjà établi pour le briefing au pied d’opération.
