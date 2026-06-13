# Manuel d'utilisation — Plateforme Mobilité
## Guide du référent

---

## Table des matières

1. [Présentation de l'interface](#1-présentation-de-linterface)
2. [Tableau de bord](#2-tableau-de-bord)
3. [Créer un contrat](#3-créer-un-contrat)
4. [Consulter un contrat en cours](#4-consulter-un-contrat-en-cours)
5. [Clôturer un contrat](#5-clôturer-un-contrat)
6. [Enregistrer les paiements](#6-enregistrer-les-paiements)
7. [Renouveler un contrat](#7-renouveler-un-contrat)
8. [Archiver un contrat](#8-archiver-un-contrat)
9. [Les statuts des contrats](#9-les-statuts-des-contrats)

---

## 1. Présentation de l'interface

La Plateforme Mobilité s'utilise depuis un navigateur web.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Plateforme Mobilité                          Bonjour, Sim   🐛     │
├──────────────┬──────────────────────────────────────────────────────┤
│  🏠 Tableau  │                                                      │
│     de bord  │              Contenu principal                       │
│  👤 Bénéfi-  │                                                      │
│     ciaires  │                                                      │
│  🚗 Véhi-    │                                                      │
│     cules    │                                                      │
│  📄 Contrats │                                                      │
│  📋 Revue    │                                                      │
│     véhicules│                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

Le menu de navigation à gauche donne accès aux cinq sections principales :

| Section | Rôle |
|---------|------|
| **Tableau de bord** | Vue d'ensemble des contrats du jour |
| **Bénéficiaires** | Gestion des dossiers bénéficiaires |
| **Véhicules** | Gestion du parc de véhicules |
| **Contrats** | Liste et gestion de tous les contrats |
| **Revue véhicules** | État global du parc |

---

## 2. Tableau de bord

Le tableau de bord est la page d'accueil. Il se découpe en quatre zones :

```
┌─────────────────────────────┬─────────────────────────────────────┐
│       Retour du jour        │      En attente de paiement         │
│  Véhicule | Bénéf. | Statut │  Véhicule | Bénéf. | Statut        │
│  (contrats finissant        │  (contrats clôturés non soldés)     │
│   aujourd'hui)              │                                     │
├─────────────────────────────┴─────────────────────────────────────┤
│                          Retard                                   │
│  Véhicule | Bénéf. | Date fin | Nb jours | Statut                │
│  (contrats dont la date de fin est dépassée)                      │
├───────────────────────────────────────────────────────────────────┤
│                     Contrats en cours                             │
│  [🔍 Rechercher...]                                  Archives ○   │
│  Véhicule | Bénéficiaire | Début ↓ | Fin | Statut                │
└───────────────────────────────────────────────────────────────────┘
```

| Zone | Contenu |
|------|---------|
| **Retour du jour** | Contrats dont la date de fin est aujourd'hui — à clôturer en priorité |
| **En attente de paiement** | Contrats clôturés dont le paiement n'est pas encore soldé |
| **Retard** | Contrats dont la date de fin est dépassée et toujours en cours |
| **Contrats en cours** | Tous les contrats actifs, recherche et filtrage disponibles |

> **Conseil :** Consultez le tableau de bord chaque matin pour identifier les retours du jour et les paiements en attente.

---

## 3. Créer un contrat

### Accès

Depuis le menu **Contrats**, cliquez sur le bouton **+** (cercle vert en haut à droite de la liste).

Le formulaire de création se déroule en **4 étapes** matérialisées par une barre de progression en haut de page :

```
  ① Cibles ──────── ② Objet du contrat ──────── ③ Caution ──────── ④ Récapitulatif
  Bénéf. et          Informations                 Informations        Résumé des
  véhicule           générales                    de caution          informations
```

---

### Étape 1 — Cibles (bénéficiaire et véhicule)

```
┌────────────────────────────────────────────────────────┐
│  Créer un contrat                                      │
│  ① Cibles  ─ ② Objet  ─ ③ Caution  ─ ④ Récapitulatif │
│                                                        │
│  Bénéficiaire                                          │
│  [ Saisir un nom...                               ✕ ] │
│                                                        │
│  Véhicule                                              │
│  [ Saisir un véhicule...                          ✕ ] │
│                                                        │
│  Kilométrage initial                                   │
│  [ 15 000                                           ]  │
│                                                        │
│                              [ Étape suivante → ]      │
└────────────────────────────────────────────────────────┘
```

Sélectionnez :

- **Bénéficiaire** : commencez à saisir le nom pour faire apparaître les suggestions.
- **Véhicule** : seuls les véhicules **disponibles** sont proposés dans la liste. Le kilométrage actuel du véhicule est automatiquement renseigné dans le champ **Kilométrage initial**.

> ⚠️ Si vous modifiez manuellement le kilométrage initial et qu'il diffère du kilométrage connu du véhicule, un avertissement rouge s'affiche. Cette modification sera **irréversible** et mettra à jour le kilométrage enregistré du véhicule.

Cliquez sur **Étape suivante**.

---

### Étape 2 — Objet du contrat

```
┌────────────────────────────────────────────────────────┐
│  Période du contrat                                    │
│  [ 16/05/2026 → 22/05/2026                        ]   │
│                                                        │
│  Prix du contrat              Remise                   │
│  [ 100                    ]   [ 0                 ]    │
│                                                        │
│  Distance maximale                                     │
│  [ 1 000                  ]                            │
│                                                        │
│  Motif                                                 │
│  [ Sélectionner...                                ]    │
│                                                        │
│  Référent                                              │
│  [ Sélectionner...                                ]    │
│                                                        │
│  [ ← Retour ]                    [ Étape suivante → ] │
└────────────────────────────────────────────────────────┘
```

| Champ | Description |
|-------|-------------|
| **Période du contrat** | Sélectionnez la date de début et de fin dans le calendrier (clic sur deux dates) |
| **Prix du contrat** | Montant en euros que devra payer le bénéficiaire |
| **Remise** | Réduction éventuelle à déduire du prix (0 par défaut) |
| **Distance maximale** | Kilométrage autorisé sur la durée du contrat |
| **Motif** | Raison du prêt : CDD, CDI, Formation, Intérim, Contrat aidé, Recherche d'emploi, Alternance |
| **Référent** | Agent Garrigues responsable du suivi du contrat |

Cliquez sur **Étape suivante**.

---

### Étape 3 — Caution

```
┌────────────────────────────────────────────────────────┐
│  Caution                                               │
│  [ 315                    ]                            │
│                                                        │
│  Mode de paiement *                                    │
│  [ Sélectionner...                                ]    │
│    → Espèces                                           │
│    → Carte bancaire                                    │
│    → Chèque                                            │
│                                                        │
│  (Si chèque) Numéro de chèque                         │
│  [ _______________        ]                            │
│                                                        │
│  [ ← Retour ]                    [ Étape suivante → ] │
└────────────────────────────────────────────────────────┘
```

| Champ | Description |
|-------|-------------|
| **Caution** | Montant de la caution versée (315 € par défaut) |
| **Mode de paiement** | Espèces, Carte bancaire ou Chèque |
| **Numéro de chèque** | Visible uniquement si le mode est "Chèque" — obligatoire dans ce cas |

Cliquez sur **Étape suivante**.

---

### Étape 4 — Récapitulatif

Un résumé complet est affiché : bénéficiaire, véhicule, dates, prix, caution, kilométrage. Vérifiez chaque information avant de valider.

Cliquez sur **Sauvegarder** pour créer le contrat.

> ✅ Le contrat est créé avec le statut **EN COURS**. Le véhicule passe automatiquement au statut "À disposition".

---

## 4. Consulter un contrat en cours

Cliquez sur un contrat dans la liste ou depuis le tableau de bord pour ouvrir sa fiche.

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← #4 - Michel SMITH  1 - Pegeot AMI rouge           Contrats  ↺  │
├──────────────────┬───────────────────────────┬──────────────────────┤
│   Michel SMITH   │        Véhicule           │   Informations  ✏️   │
│                  │                           │                      │
│ Adresse:         │ N° de flotte: 1           │ N° contrat: 4        │
│ 22 rue vauvenarge│ Type: Voiture             │ Statut: EN COURS     │
│ 83910 St-Maximin │ Marque: Pegeot            │ Créé le: 16/05/2026  │
│                  │ Modèle: AMI               │ Par: Sim G.          │
│ Email: ...       │ Année: 2012               │ Début: 16/05/2026    │
│ Tél: ...         │ Km: 15 000 km             │ Fin: 22/05/2026      │
│ Permis: DE122    │ Immatricul.: AA125VV      │ Prix: 100€           │
│                  │ Carburant: essence        │ Caution: 315€        │
├──────────────────┴───────────────────────────┤ Remise: 0€           │
│  💬 Commentaire d'équipe  |  💶 Paiements   │ Km initial: 15 000km │
│  ┌────────────────────────────────────────┐  │ distance max: 1km    │
│  │ Commentaire d'équipe...               │  ├──────────────────────┤
│  │                                        │  │     Documents        │
│  │                                        │  │ [📄 Télécharger le  │
│  │                                        │  │      contrat      ]  │
│  │                                        │  │ [€  Bilan de partic.]│
│  └────────────────────────────────────────┘  ├──────────────────────┤
│  [ Enregistrer ]                             │      Actions         │
│                                              │ [Clôturer le contrat]│
│                                              │ [Nouveau paiement   ]│
│                                              │ [Renouveler le      ]│
│                                              │   contrat            │
│                                              │ [Archiver]           │
└──────────────────────────────────────────────┴──────────────────────┘
```

### Description des zones

**Bénéficiaire** (colonne gauche)
- Coordonnées complètes : adresse, email, téléphone, numéro de permis
- Un clic sur le nom ouvre la fiche du bénéficiaire

**Véhicule** (colonne centrale)
- Numéro de flotte, marque, modèle, année, kilométrage, immatriculation, type de carburant, transmission

**Informations du contrat** (colonne droite)
- Numéro de contrat, statut, dates, référent, prix, caution, remise, kilométrage initial et maximal
- L'icône ✏️ permet de modifier les informations de base (dates, prix, référent…)

**Onglet Commentaire d'équipe**
- Zone de texte libre, visible par tous les agents, pour noter des observations ou consignes

**Onglet Paiements**
- Tableau des paiements enregistrés avec mode, date, montant
- Récapitulatif en bas : montant des paiements, montant dû, reste à payer

**Documents**
- **Télécharger le contrat** : PDF du contrat de prêt à imprimer et faire signer par le bénéficiaire
- **Télécharger le bilan de participation** : disponible uniquement après clôture du contrat

**Actions**
- **Clôturer le contrat** : enregistrer le retour du véhicule (actif uniquement si statut = EN COURS)
- **Nouveau paiement** : enregistrer un encaissement (actif uniquement si statut ≠ EN COURS)
- **Renouveler le contrat** : prolonger le prêt (actif uniquement si statut = EN COURS)
- **Archiver** : masquer de la liste courante

---

## 5. Clôturer un contrat

La clôture correspond au retour physique du véhicule par le bénéficiaire. Elle n'est possible que sur un contrat **EN COURS**.

### Procédure

1. Ouvrez la fiche du contrat.
2. Cliquez sur le bouton rouge **Clôturer le contrat** dans la zone "Actions".

Une fenêtre modale s'ouvre :

```
┌─────────────────────────────────────┐
│       Clôturer un contrat     ✕     │
│                                     │
│  Prix du contrat                    │
│  [ 100                          ]   │
│                                     │
│  Caution                            │
│  [ 315                          ]   │
│                                     │
│  Remise                             │
│  [ 0                            ]   │
│                                     │
│  Kilométrage de la voiture          │
│  [ _____                        ]   │
│                                     │
│           [ Clôturer ]              │
└─────────────────────────────────────┘
```

3. Vérifiez ou ajustez les champs :

| Champ | Description |
|-------|-------------|
| **Prix du contrat** | Peut être corrigé si nécessaire |
| **Caution** | Montant de la caution à restituer au bénéficiaire |
| **Remise** | Remise éventuelle à appliquer |
| **Kilométrage de la voiture** | **Obligatoire** — relevé au compteur lors du retour |

4. Cliquez sur **Clôturer**.

> ✅ Le contrat passe au statut **CLÔTURÉ**. Le bilan de participation (PDF) devient disponible. L'onglet **Paiements** s'active pour permettre l'enregistrement des règlements.

> ⚠️ Le bouton "Clôturer" reste grisé tant que le kilométrage final n'est pas renseigné.

---

## 6. Enregistrer les paiements

Les paiements se saisissent sur un contrat **CLÔTURÉ**. Un contrat EN COURS peut également recevoir des paiements via le bouton "Nouveau paiement" si nécessaire.

### Vue d'un contrat clôturé (onglet Paiements)

```
┌─────────────────────────────────────────────────────────┐
│  💬 Commentaire d'équipe  |  💶 Paiements               │
│                                              [+]  [↺]   │
│  Mode          Date          Montant    Action           │
│  ─────────────────────────────────────────────────      │
│  Espèces       16/05/2026    4 €        [📄]            │
│  Espèces       16/05/2026    50 €       [📄][✏️][🗑️]  │
│                                                          │
│  1-2 / 2                              [<] [1] [>]       │
│                                                          │
│  Montant paiements         54 €                         │
│  Montant dû          40 €   Reste à payer    -14 €      │
└─────────────────────────────────────────────────────────┘
```

### Procédure d'enregistrement

1. Ouvrez la fiche du contrat clôturé.
2. Cliquez sur le bouton **Nouveau paiement** dans la zone "Actions" (ou sur le **+** dans l'onglet Paiements).

Une fenêtre modale s'ouvre :

```
┌─────────────────────────────────────┐
│       Edition paiements       ✕     │
│                                     │
│  Récapitulatif:                     │
│  Montant paiements       --- €      │
│  Montant dû    100 €  Reste à payer │
│                                     │
│  Montant *                          │
│  [ 0                            ]   │
│                                     │
│  Mode de paiement *                 │
│  [ Sélectionner...              ]   │
│                                     │
│           [ 💾 Enregistrer ]        │
└─────────────────────────────────────┘
```

3. Renseignez :
   - **Montant** : somme encaissée en euros
   - **Mode de paiement** : Espèces, Carte bancaire ou Chèque

4. Cliquez sur **Enregistrer**.

Le paiement apparaît dans le tableau. Le récapitulatif **Reste à payer** est mis à jour instantanément.

### Actions sur les paiements existants

Chaque ligne de paiement dispose d'icônes d'action :
- **📄** Télécharger le reçu de paiement (PDF)
- **✏️** Modifier le paiement
- **🗑️** Supprimer le paiement

### Passage automatique au statut PAYÉ

Lorsque la somme des paiements atteint ou dépasse le **montant dû** (prix − remise), le contrat passe **automatiquement** au statut **PAYÉ** sans aucune action supplémentaire.

```
┌─────────────────────────────────────────────────────────┐
│  Informations                                           │
│  Numéro contrat: 2    Statut: PAYÉ                     │
│  ...                                                    │
│                                                         │
│  Actions                                                │
│  [Clôturer le contrat]  grisé                          │
│  [Nouveau paiement   ]  grisé                          │
│  [Renouveler         ]  grisé                          │
│  [Archiver           ]  disponible                     │
└─────────────────────────────────────────────────────────┘
```

> ℹ️ Si un paiement est supprimé et que le total repasse sous le montant dû, le contrat revient automatiquement au statut **CLÔTURÉ**.

---

## 7. Renouveler un contrat

Le renouvellement prolonge un prêt en cours en créant un **nouveau contrat** lié au contrat source. Le bénéficiaire et le véhicule sont automatiquement repris.

**Conditions :** le contrat doit être au statut **EN COURS** et ne pas avoir de renouvellement déjà actif.

### Procédure

1. Ouvrez la fiche du contrat **EN COURS**.
2. Cliquez sur **Renouveler le contrat** dans la zone "Actions".

Le formulaire de renouvellement s'ouvre en **3 étapes** :

```
  ① Objet du contrat ──────── ② Caution ──────── ③ Récapitulatif
  Dates et informations        Informations de     Résumé
  (bénéf. et véhicule          caution
   verrouillés)
```

---

### Étape 1 — Objet du contrat

```
┌──────────────────────────────────────────────────────────┐
│  Renouveler le contrat #4                                │
│  ① Objet du contrat ─ ② Caution ─ ③ Récapitulatif       │
│                                                          │
│  ┌──────────────────────────┐ ┌──────────────────────┐  │
│  │     Michel SMITH         │ │      Véhicule        │  │
│  │  (informations           │ │  (informations du    │  │
│  │   du bénéficiaire)       │ │   véhicule)          │  │
│  └──────────────────────────┘ └──────────────────────┘  │
│                                                          │
│  Kilométrage initial                                     │
│  [ 15 000                  ]  (prérempli automatiquement)│
│                                                          │
│  Période du contrat                                      │
│  [ 22/05/2026 → 22/05/2026 ]  (commence à la fin du     │
│                                contrat précédent)        │
│  Prix du contrat   Remise    Distance max    Motif       │
│  [ 100 ]           [ 0 ]     [ 1 000 ]      [  ▼ ]      │
│                                                          │
│  Référent                                                │
│  [ Sélectionner...                        ]              │
│                                                          │
│                              [ Étape suivante → ]        │
└──────────────────────────────────────────────────────────┘
```

Points importants :

- Le bénéficiaire et le véhicule sont **verrouillés** (repris du contrat source, non modifiables)
- La **date de début** est automatiquement fixée à la date de fin du contrat précédent. Si ce contrat est en retard, la date de début sera au minimum aujourd'hui (un message orange l'indique)
- Le **kilométrage initial** est prérempli avec le kilométrage actuel du véhicule

Renseignez la nouvelle période, le prix, la distance maximale, le motif et le référent, puis cliquez sur **Étape suivante**.

---

### Étape 2 — Caution

Identique à la création : renseignez la caution et le mode de paiement.

---

### Étape 3 — Récapitulatif

Vérifiez toutes les informations puis cliquez sur **Sauvegarder**.

> ✅ Le nouveau contrat est créé au statut **EN COURS**, lié au contrat source. Le contrat source conserve le statut EN COURS jusqu'à ce qu'il soit clôturé manuellement.

---

## 8. Archiver un contrat

L'archivage masque un contrat de la liste courante sans le supprimer définitivement.

- Cliquez sur **Archiver** dans la zone "Actions" d'un contrat PAYÉ ou CLÔTURÉ.
- Pour retrouver les contrats archivés : activez le commutateur **Archives** en haut à droite de la liste des contrats.

> ⚠️ Un contrat EN COURS ne peut pas être archivé (le bouton est grisé).

---

## 9. Les statuts des contrats

### Tableau de référence

| Statut | Couleur | Signification |
|--------|---------|---------------|
| **EN COURS** | 🟢 Vert | Le bénéficiaire a le véhicule. Le contrat est actif. |
| **CLÔTURÉ** | 🟠 Orange | Le véhicule est revenu. Le paiement n'est pas encore soldé. |
| **PAYÉ** | ⚪ Gris | Le paiement est intégralement soldé. Le contrat est terminé. |

### Cycle de vie complet

```
                        ┌─────────────────┐
                        │   CRÉATION      │
                        │  (formulaire    │
                        │   4 étapes)     │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    EN COURS     │◄──────── Renouvellement
                        │  (véhicule à   │          (nouveau contrat
                        │   disposition) │           créé lié)
                        └────────┬────────┘
                                 │
                          Clôturer le contrat
                          (saisir km final)
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    CLÔTURÉ      │
                        │  (véhicule      │
                        │   revenu)       │
                        └────────┬────────┘
                                 │
                      Enregistrer les paiements
                      (automatique quand soldé)
                                 │
                                 ▼
                        ┌─────────────────┐
                        │      PAYÉ       │
                        │  (contrat       │
                        │   terminé)      │
                        └────────┬────────┘
                                 │
                              Archiver
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    ARCHIVÉ      │
                        │  (masqué de     │
                        │   la liste)     │
                        └─────────────────┘
```

### Matrice des actions disponibles par statut

| Action | EN COURS | CLÔTURÉ | PAYÉ |
|--------|----------|---------|------|
| Modifier les infos | ✅ | ✅ | ✅ |
| Télécharger le contrat (PDF) | ✅ | ✅ | ✅ |
| Télécharger le bilan (PDF) | ❌ | ✅ | ✅ |
| Clôturer | ✅ | ❌ | ❌ |
| Nouveau paiement | ❌ | ✅ | ❌ |
| Renouveler | ✅ | ❌ | ❌ |
| Archiver | ❌ | ✅ | ✅ |
| Supprimer | ✅ (< 15 min) | ❌ | ❌ |

### Règles importantes à retenir

1. **Suppression** : un contrat ne peut être supprimé que dans les **15 minutes** suivant sa création.
2. **Renouvellement unique** : un seul renouvellement actif par contrat. Si un renouvellement est déjà en cours, le bouton est désactivé.
3. **Passage PAYÉ automatique** : dès que la somme des paiements ≥ prix − remise, le statut passe à PAYÉ sans action de l'utilisateur.
4. **Retour automatique à CLÔTURÉ** : si un paiement est supprimé et que le total repasse sous le montant dû, le contrat revient automatiquement à CLÔTURÉ.
5. **PDF bilan** : le bilan de participation n'est disponible qu'après clôture du contrat (kilométrage final requis).

---

*Manuel généré le 16 mai 2026 — Plateforme Mobilité v0.0.0*
