# Rapport journalier AINM — PWA terrain V8.6

Application autonome, utilisable hors ligne, pour les rapports journaliers de travaux signalisation AINM.

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
unzip -o ~/storage/downloads/rapport-journalier-ainm-pwa-v8.6-correctifs-enregistrement-signatures.zip
cd ~/projets/rapport-journalier-ainm-pwa
git add -A
git commit -m "Mise à jour V8.6 : enregistrement et signatures"
git push
```

Attendre une à deux minutes, puis fermer/réouvrir la PWA. Le cache de l’application est mis à jour automatiquement.

## Limites connues

- Le brouillon et les photos sont conservés sur le téléphone : exporter régulièrement les rapports terminés.
- Le code administrateur est un verrou local d’interface ; il ne remplace pas une authentification SNCF centralisée.
