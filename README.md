# Duels & Chats

Module Foundry VTT (v13/v14) pour mettre en scène les duels d'intimidation entre chats : le MJ choisit le provocant et le provoqué en glissant leurs jetons depuis la scène, le module calcule les jets opposés, affiche un écran d'affrontement animé, puis applique la résolution (victoire, combat, ou choix du provoqué).

## Fonctionnalités

- Fenêtre "Duel de chats" réservée au MJ (widget flottant à côté de la liste des joueurs, ou raccourci `Ctrl+Shift+D`).
- Sélection des deux protagonistes par glisser-déposer des jetons de la scène active, dans les colonnes **Provocant** et **Provoqué** (réassignables en les faisant glisser d'une colonne à l'autre, ou vers la liste pour les libérer).
- Valeurs de **Coussinet**, **Caresse** et **Réputation** pré-remplies depuis la fiche de l'acteur lié au jeton (chemins `system.xxx` configurables dans les réglages, préréglés pour le système [cats-la-mascarade](https://gitlab.com/Vlyan/cats-la-mascarade)), mais toujours modifiables à la volée avant de lancer le duel — utile si le chemin ne correspond pas à votre fiche, ou pour un PNJ sans fiche complète.
- Case à cocher par combattant pour activer/désactiver le bonus de réputation (+1 par tranche de 5 points).
- Écran d'affrontement animé ("VS") **diffusé à tous les joueurs connectés** avant la résolution : les deux jetons glissent depuis les bords, avec un son de feulement optionnel (fichier à fournir vous-même via les réglages).
- Chaque combattant lance **son propre dé** : si un joueur (non-MJ) possède la fiche liée au jeton et qu'il est connecté, il reçoit une popup "À vous de lancer les dés !" avec un bouton pour lancer son 1d10 lui-même. Sinon (PNJ, joueur absent), le MJ lance à sa place — avec, dans tous les cas, un bouton "Lancer à sa place (MJ)" pour débloquer un jet si un joueur reste inactif.
- Résolution automatique des 4 cas de figure du duel :
  1. Le provocant réussit, pas le provoqué → victoire du provocant.
  2. Le provoqué réussit, pas le provocant → victoire du provoqué.
  3. Les deux réussissent → le duel s'engage comme un combat normal (bouton pour ajouter les deux jetons au tracker de combat).
  4. Les deux ratent → le provoqué choisit d'accepter la défaite ou d'engager le combat.
- Transfert automatique de réputation si le perdant en avait plus que le gagnant (bouton "Appliquer" qui écrit directement sur la fiche).
- Jets 1d10 intégrés à Foundry (compatibles avec Dice So Nice si installé) et message de chat récapitulatif.

## Mécanique implémentée

D'après les règles fournies :

- Le **provocant** lance `1d10 + Coussinet` et doit atteindre `5 + 2 × Caresse` du provoqué.
- Le **provoqué** lance `1d10 + Caresse` et doit atteindre `5 + 2 × Coussinet` du provocant.
- Chacun peut ajouter `+1` par tranche de 5 points de réputation à son jet (case à cocher, activée par défaut).
- Si le perdant a plus de réputation que le gagnant, ce dernier gagne autant de points de réputation que le bonus de réputation du perdant.

## Réglages

Le bouton **Réglages** (dans la fenêtre de duel) permet d'ajuster :
- Les chemins `system.xxx` utilisés pour lire/écrire Coussinet, Caresse et Réputation sur la fiche d'acteur. Par défaut : `system.attributes.pad` (Coussinet), `system.attributes.caress` (Caresse) et `system.identity.reputation` (Réputation) — ce sont les chemins réels du système [cats-la-mascarade](https://gitlab.com/Vlyan/cats-la-mascarade), à adapter si vous jouez avec un autre système ou une fiche personnalisée.
- Un **inspecteur d'acteur** intégré : choisissez un acteur dans la liste, cliquez sur "Afficher les données" pour voir son `system` complet en JSON, et repérer la clé exacte à utiliser si les chemins par défaut ne correspondent pas.
- Le fichier audio joué comme feulement au début de l'écran VS (sélecteur de fichier Foundry). Laissez vide pour un duel silencieux.

## Installation

Dans Foundry VTT, onglet **Modules complémentaires** > **Installer un module**, coller l'URL de manifeste suivante :

```
https://github.com/tomjdr4-hub/Duels-Cats/releases/latest/download/module.json
```

## Utilisation

1. Ouvrez la fenêtre de duel (widget flottant à côté de la liste des joueurs, ou `Ctrl+Shift+D`).
2. Glissez le jeton du chat provocant dans la colonne "Provocant" et celui du chat provoqué dans "Provoqué".
3. Vérifiez/ajustez les valeurs de Coussinet, Caresse et Réputation pré-remplies pour chacun.
4. Cliquez sur **Lancer le duel** : l'écran d'affrontement s'affiche chez tout le monde, puis chaque joueur propriétaire d'un des deux jetons reçoit une popup pour lancer son propre dé (sinon le MJ lance à sa place). Dès que les deux jets sont arrivés, le résultat s'affiche (avec message de chat).
5. Selon le résultat, appliquez le gain de réputation et/ou démarrez le combat dans le tracker.

## Versions

Une nouvelle version (numéro de patch incrémenté) et une release GitHub (avec `module.zip` et `module.json`) sont générées automatiquement à chaque modification poussée sur `main`.

## Statut

Version fonctionnelle : sélection par glisser-déposer, jets délégués aux joueurs (avec repli MJ), écran VS diffusé à tous avec son optionnel, résolution des 4 cas, transfert de réputation, intégration au tracker de combat, inspecteur d'acteur pour retrouver les chemins d'attributs. Chemins par défaut alignés sur le système [cats-la-mascarade](https://gitlab.com/Vlyan/cats-la-mascarade).
