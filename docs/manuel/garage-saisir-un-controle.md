# Je saisis un contrôle

**Pour qui ?** Le garagiste, sur téléphone, à côté du véhicule.
**Combien de temps ?** 5 à 15 minutes. Tout se fait d'une main.

> Les captures d'écran de chaque étape seront ajoutées avec le jeu de données de démo (action D2 de la rétro de l'epic 2). Les textes alternatifs sont déjà prévus dans la liste ci-dessous.

## 1. Je commence

1. Dans l'application, j'appuie sur le bouton **+** en bas, puis sur **Nouveau contrôle**. Depuis la fiche d'un véhicule, le bouton **Nouveau contrôle** choisit déjà le véhicule.
2. Je choisis le véhicule.
3. Si j'ai déjà une fiche ouverte, l'application me le dit : **Continuer** reprend là où je m'étais arrêté, **Abandonner et créer une nouvelle** supprime la fiche en cours (une confirmation est demandée).

*Une fiche ouverte reste reprenable pendant 24 h. Au-delà, l'écran « Fiche expirée » apparaît : il faut en créer une nouvelle.*

## 2. Les 7 étapes

Un indicateur « 3 / 7 » reste affiché en haut, avec « Enregistré » ou « Non enregistré ».

| # | Étape | Ce que je fais |
|---|---|---|
| 1 | Kilométrage | Je note le compteur. |
| 2 | Niveaux | Huile, refroidissement, lave-glace : un appui = OK, deux appuis = défaut, trois appuis = non vérifié. |
| 3 | Usure | Pour chaque pièce (plaquettes, pneus…), j'appuie sur **À changer**, **À surveiller** ou **Bon**. Je retouche le bouton choisi pour effacer. Une pièce « critique » passe en rouge, sans bloquer le contrôle. |
| 4 | Éclairage | **OK** ou **Défaut** (je peux préciser le défaut). |
| 5 | Dégâts | **Aucun**, ou **À signaler** : une carte par dégât avec photos et description. |
| 6 | Essai | **Réalisé** ou **Non réalisé**, avec des observations facultatives. |
| 7 | À prévoir | J'ajoute les opérations à programmer. |

Puis le **Récapitulatif** : je relis, puis j'appuie sur **Valider la fiche**.

## 3. Si le réseau coupe

- **Chaque étape est enregistrée quand j'appuie sur Suivant.** Sans réseau, l'étape n'est pas enregistrée : un message rouge le dit, mes saisies restent à l'écran, et le bouton devient **Réessayer**.
- **Ne fermez pas l'application sans réseau** : la saisie de l'étape en cours serait perdue. Les étapes déjà franchies, elles, sont conservées : en rouvrant la fiche, je reprends à la dernière étape enregistrée.
- Hors ligne, **Valider la fiche** est grisé : il faut retrouver du réseau.

*La saisie hors ligne complète (envoi automatique au retour du réseau, même application fermée) est prévue dans une version suivante (epic 6).*

## 4. Réglage de la saisie d'usure

Dans **Compte**, le sélecteur **Saisie de l'usure** permet de choisir **Curseur** (par défaut, note de 0 à 10) ou **Boutons**. Le choix suit mon compte d'un téléphone à l'autre.

## Légende des captures prévues

1. Accueil avec le bandeau « Fiche de contrôle en cours ».
2. Modale « Une fiche est déjà en cours ».
3. Étape Usure avec deux pièces, dont une critique.
4. Message « Étape non enregistrée » avec le bouton Réessayer.
5. Récapitulatif.
