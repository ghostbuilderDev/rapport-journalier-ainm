# Rapport journalier AINM — PWA terrain V9.0

Application autonome, utilisable hors ligne, pour les rapports journaliers de travaux signalisation AINM.

## Version V9.0

- Les tableaux entreprise et SNCF retrouvent une présentation compacte en deux colonnes sur téléphone : compteur, modification par crayon et croix de retrait restent sur une seule ligne propre.
- La croix rouge est toujours affichée, même lorsqu’une fonction est à **zéro**. Elle retire réellement cette fonction du tableau.
- Les rôles affichés au départ sont réduits : entreprise travaux (**Chef de chantier**, **Opérateur travaux**), prestataire sécurité (**Agent prestataire**, **Sentinelle**) et SNCF (**RPTx**, **Adjoint S11**). Les autres rôles restent disponibles dans **+ Fonction**.
- Le tableau détaillé SNCF en double est retiré : toutes les modifications se font depuis le même tableau clair.
- Le cache PWA passe à V9.0 afin de charger cette simplification dès la réouverture.

## Version V8.9

- À chaque ouverture, une page d’accueil AINM affiche immédiatement la **version exacte** de l’application, le numéro du rapport actif et la séance en cours.
- Le bouton **Ouvrir le rapport** donne accès à la saisie sans modifier ni perdre le brouillon local.
- La version reste visible en permanence dans l’en-tête après l’entrée dans l’application.
- Le cache PWA passe à V8.9 afin de charger cet écran d’accueil dès la réouverture.

## Version V8.8

- Les tableaux d’effectifs par entreprise et SNCF restent modifiables, mais leurs commandes sont désormais rangées dans une zone d’actions dédiée : le compteur, **Modifier** et la croix ne peuvent plus se chevaucher.
- Sur les téléphones étroits, chaque fonction s’affiche sur toute la largeur pour conserver des commandes grandes et lisibles.
- Le cache PWA passe à V8.8 afin de charger la correction de mise en page dès la réouverture de l’application.

## Version V8.7

- Les rubriques **Interceptions et consignations**, **Anomalies constatées** et **Rapports fournis** sont maintenant reliées à leurs collections de données réelles : l’enregistrement, l’affichage, la modification et la suppression fonctionnent de nouveau.
- Dans les visas, le clavier Android se ferme automatiquement **trois secondes après la dernière frappe** dans le nom ou la fonction, afin de dégager immédiatement la zone de signature.
- Le cache PWA passe à V8.7 afin que cette correction soit chargée dès la réouverture de l’application.

## Version V8.6

- Les formulaires **Interceptions et consignations**, **Anomalies constatées** et **Rapports fournis** utilisent désormais un enregistrement fiable par clic ou validation du clavier. Une confirmation visible indique que la ligne est bien ajoutée.
- Les signatures fonctionnent au doigt, au stylet et avec le secours tactile des Android/WebViews plus anciens.
- Le rédacteur signe désormais explicitement en tant que **surveillant de travaux** ; son visa est repris tout en bas du PDF.
- Chaque responsable d’entreprise conserve son visa dans sa propre case, avec miniature de signature et statut visible même sur téléphone.
- Le cache PWA passe à V8.6 afin de charger la mise à jour dès la réouverture de l’application.

## Version V8.5

- Les effectifs sont maintenant organisés en **tableaux éditables par entreprise**. Ajouter LSDR, ETF Services ou toute autre entreprise crée immédiatement son propre tableau.
- Dans chaque tableau, le bouton **+ Fonction** ajoute une fonction au bon endroit. Le bouton **×** retire cette fonction du tableau ; les compteurs **− / +** restent disponibles pour chaque rôle.
- Les anciennes lignes d’effectif isolées ne sont plus affichées : tout le personnel d’une entreprise est regroupé dans son tableau.
- Le nouvel emblème **Rapport journalier AINM** devient l’icône de l’application PWA et apparaît dans l’en-tête.

## Version V8.4

- La fonctionnalité de **transfert/passation à distance** et son serveur associé sont retirés. Le rapport reste stocké sur le téléphone, sans dépendance à un service externe.
- Une zone **Saisie rapide** permet d’ajouter directement une prestation, une équipe, un engin, une ligne d’ITC/consignation ou des photos.
- Le menu devient **Outils** et ne conserve que les actions utiles sur le téléphone : reprendre la dernière nuit, conserver un instantané, restaurer une sauvegarde locale et paramétrer les prix pour l’administrateur.
- Le bouton **Sauvegarder la saisie** télécharge une copie locale JSON, sans prix ni réglages administrateur. Elle peut être restaurée ultérieurement depuis le même appareil.
- Le PDF actif reste le rendu **V5** : données terrain, moyens, horaires, photos, signatures finales et annexe de valorisation uniquement dans l’espace administrateur.
- Les prix restent invisibles aux agents terrain et ne figurent pas dans le PDF standard.

## Utilisation terrain

1. Renseigner le contexte, les entreprises intervenantes et leurs responsables.
2. Utiliser la zone **Saisie rapide** pour les éléments de la séance.
3. Ajouter les photos, contrôles, anomalies et pièces utiles.
4. Faire signer les responsables des entreprises dans la dernière étape.
5. Toucher **Imprimer le rapport PDF**.
6. Toucher **Sauvegarder la saisie** avant de quitter l’application lorsque tu souhaites conserver une copie externe.

## Règle de numérotation

Chaque nouveau rapport reçoit un numéro non modifiable. Le compteur avance localement et le code appareil rend le numéro complet distinct, même sans réseau.

## Déploiement GitHub Pages / Termux

Décompresser l’archive dans le dépôt puis exécuter :

```sh
cd ~/projets
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v9.0-effectifs-simplifies.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V9.0 : effectifs simplifiés"
git push
```

Attendre une à deux minutes, puis fermer/réouvrir la PWA. Le cache de l’application est mis à jour automatiquement.

## Limites connues

- Le brouillon et les photos sont conservés sur le téléphone : exporter régulièrement les rapports terminés.
- Le code administrateur est un verrou local d’interface ; il ne remplace pas une authentification SNCF centralisée.
