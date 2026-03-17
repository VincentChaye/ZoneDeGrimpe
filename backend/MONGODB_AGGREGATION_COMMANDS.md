# Documentation des Commandes d'Agrégation MongoDB

Ce fichier documente toutes les commandes d'agrégation MongoDB utilisées dans le projet Zone De Grimpe.

---

## 📍 Fichier: `advice.routes.js`

### 🎯 Endpoint 1: `/advice/material` - Conseils matériel

#### **Pipeline 1: Avec coordonnées GPS (geoNear)**

```javascript
[
  {
    $geoNear: {
      near: { type: "Point", coordinates: [lng, lat] },
      distanceField: "dist_m",
      spherical: true,
      maxDistance: maxKm * 1000,
    },
  },
  { $match: { $or: [{ "properties.type": "falaise" }, { type: "falaise" }] } },
  { $project: { "properties.required_rope_m": 1, "properties.required_qd": 1 } },
]
```

**Explication des commandes:**

- **`$geoNear`**: 
  - **But**: Recherche géospatiale pour trouver les spots d'escalade les plus proches d'une position donnée
  - **`near`**: Point de référence (coordonnées longitude/latitude)
  - **`distanceField`**: Crée un champ "dist_m" contenant la distance en mètres
  - **`spherical: true`**: Utilise les calculs sphériques (Terre = sphère) pour plus de précision
  - **`maxDistance`**: Limite de recherche en mètres (ex: 30 km × 1000 = 30000 m)

- **`$match`**: 
  - **But**: Filtre les documents pour ne garder que les falaises
  - **`$or`**: Condition logique OU pour gérer différents formats de données
  - Garde uniquement les spots de type "falaise"

- **`$project`**: 
  - **But**: Sélectionne uniquement les champs nécessaires pour réduire la taille des données
  - Ne retourne que `required_rope_m` (longueur de corde requise) et `required_qd` (nombre de dégaines)

---

#### **Pipeline 2: Sans coordonnées GPS (échantillon aléatoire)**

```javascript
[
  { $match: { $or: [{ "properties.type": "falaise" }, { type: "falaise" }] } },
  { $sample: { size: sampleLimit } },
  { $project: { "properties.required_rope_m": 1, "properties.required_qd": 1 } },
]
```

**Explication des commandes:**

- **`$match`**: Même fonction que ci-dessus, filtre pour ne garder que les falaises

- **`$sample`**: 
  - **But**: Sélectionne un échantillon aléatoire de documents
  - **`size`**: Nombre de documents à sélectionner (ex: 200)
  - Utile quand on n'a pas de position GPS pour faire une analyse représentative

- **`$project`**: Même fonction que ci-dessus, sélectionne les champs nécessaires

---

### 🎯 Endpoint 2: `/advice/spots` - Suggestions de spots

```javascript
[
  {
    $geoNear: {
      near: { type: "Point", coordinates: [lng, lat] },
      distanceField: "dist_m",
      spherical: true,
      maxDistance: maxKm * 1000,
    },
  },
  { $match: match },
  {
    $project: {
      name: 1,
      location: 1,
      dist_m: 1,
      "properties.orientation": 1,
      "properties.grade_mean": 1,
      "properties.grade_mean_num": 1,
      "properties.required_rope_m": 1,
      "properties.required_qd": 1,
    },
  },
  { $limit: limit },
]
```

**Explication des commandes:**

- **`$geoNear`**: Même fonction que précédemment, trouve les spots proches

- **`$match`**: 
  - **But**: Filtre les falaises + applique les filtres optionnels
  - Exemple: orientation (SE, SW, etc.) si spécifiée par l'utilisateur

- **`$project`**: 
  - **But**: Sélectionne tous les champs nécessaires pour afficher les infos complètes du spot
  - Inclut: nom, position, distance, orientation, niveau de difficulté, matériel requis

- **`$limit`**: 
  - **But**: Limite le nombre de résultats retournés
  - Évite de surcharger l'API et le client (max 100, défaut 30)

---

## 📊 Fichier: `analytics.routes.js`

### 🎯 Endpoint 1: `/analytics/spots/textsearch` - Recherche plein texte

```javascript
[
  { $match: { $text: { $search: q } } },
  { $addFields: { score: { $meta: "textScore" } } },
  { $sort: { score: -1 } },
  {
    $project: {
      _id: 1,
      name: 1,
      "properties.type": 1,
      "properties.tags": 1,
      score: 1,
    },
  },
  { $limit: limit },
]
```

**Explication des commandes:**

- **`$match` avec `$text`**: 
  - **But**: Recherche textuelle dans les champs indexés (nom, tags)
  - **`$search`**: La requête de recherche (ex: "Fontainebleau")
  - Utilise l'index full-text pour une recherche rapide et intelligente

- **`$addFields`**: 
  - **But**: Ajoute de nouveaux champs aux documents sans modifier les existants
  - **`{ $meta: "textScore" }`**: Score de pertinence de la recherche textuelle (0 à 1)
  - Plus le score est élevé, plus le résultat est pertinent

- **`$sort`**: 
  - **But**: Trie les résultats
  - **`score: -1`**: Ordre décroissant (meilleurs résultats en premier)

- **`$project`**: Sélectionne les champs à retourner + le score

- **`$limit`**: Limite à 50 résultats maximum pour éviter la surcharge

---

### 🎯 Endpoint 2: `/analytics/gear/inspections/due` - Matériel à inspecter

```javascript
[
  {
    $match: {
      $and: [
        { $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }] },
        { "lifecycle.nextInspectionAt": { $lte: until } },
      ],
    },
  },
  {
    $lookup: {
      from: users.collectionName,
      localField: "userId",
      foreignField: "_id",
      as: "user",
    },
  },
  { $set: { user: { $arrayElemAt: ["$user", 0] } } },
  {
    $project: {
      _id: 1,
      userId: 1,
      "user.email": 1,
      category: 1,
      specs: 1,
      "lifecycle.nextInspectionAt": 1,
      "lifecycle.lastInspectionAt": 1,
      "lifecycle.usageCount": 1,
    },
  },
  { $sort: { "lifecycle.nextInspectionAt": 1 } },
]
```

**Explication des commandes:**

- **`$match` avec `$and` / `$or`**: 
  - **But**: Filtre complexe avec plusieurs conditions
  - **`$and`**: Toutes les conditions doivent être vraies
  - **`$or`**: Au moins une condition doit être vraie
  - Trouve le matériel non retiré ET avec inspection due bientôt

- **`$lookup`**: 
  - **But**: Jointure avec une autre collection (comme un JOIN SQL)
  - **`from`**: Collection à joindre (users)
  - **`localField`**: Champ dans la collection courante (userId)
  - **`foreignField`**: Champ dans la collection cible (_id)
  - **`as`**: Nom du champ qui contiendra les résultats (array)
  - Permet de récupérer l'email de l'utilisateur propriétaire du matériel

- **`$set`** (ou `$addFields`): 
  - **But**: Modifie ou ajoute des champs
  - **`$arrayElemAt`**: Extrait un élément d'un tableau (ici le premier élément [0])
  - Transforme `user: [...]` en `user: {...}` (objet unique au lieu d'un tableau)

- **`$project`**: Sélectionne les champs à retourner (incluant user.email)

- **`$sort`**: 
  - **But**: Trie par date d'inspection
  - **`1`**: Ordre croissant (inspections les plus urgentes en premier)

---

### 🎯 Endpoint 3: `/analytics/gear/retire-soon` - Matériel en fin de vie

```javascript
[
  { $match: { $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }] } },
  {
    $lookup: {
      from: gearSpecs.collectionName,
      localField: "category",
      foreignField: "category",
      as: "spec",
    },
  },
  { $set: { spec: { $arrayElemAt: ["$spec", 0] } } },
  {
    $set: {
      maxUsage: { $ifNull: ["$spec.recommendedMaxUsage", 0] },
      usage: { $ifNull: ["$lifecycle.usageCount", 0] },
    },
  },
  {
    $set: {
      usageRatio: {
        $cond: [{ $gt: ["$maxUsage", 0] }, { $divide: ["$usage", "$maxUsage"] }, null],
      },
    },
  },
  { $match: { usageRatio: { $ne: null, $gte: thresholdPct } } },
  {
    $project: {
      _id: 1,
      userId: 1,
      category: 1,
      specs: 1,
      "lifecycle.usageCount": 1,
      maxUsage: 1,
      usageRatio: 1,
    },
  },
  { $sort: { usageRatio: -1 } },
]
```

**Explication des commandes:**

- **`$match`**: Filtre pour ne garder que le matériel actif (non retiré)

- **`$lookup`**: 
  - Jointure avec Materiel_Specs pour obtenir le nombre d'utilisations recommandées max
  - Exemple: une corde a une durée de vie de ~100 utilisations

- **`$set`** (étape 1): 
  - Extrait les specs de la catégorie de matériel

- **`$set`** (étape 2): 
  - **`$ifNull`**: Retourne une valeur par défaut si le champ est null/absent
  - **`$ifNull: ["$spec.recommendedMaxUsage", 0]`**: Si pas de max défini, utilise 0
  - Crée les champs `maxUsage` et `usage`

- **`$set`** (étape 3) - Calcul du ratio d'utilisation: 
  - **`$cond`**: Condition ternaire (if-then-else)
  - **`$gt`**: Greater than (plus grand que) - vérifie que maxUsage > 0
  - **`$divide`**: Division - calcule usage / maxUsage
  - Si maxUsage > 0 → calcule le ratio (ex: 85/100 = 0.85 = 85%)
  - Sinon → retourne null
  - **usageRatio**: Pourcentage d'utilisation (0.8 = 80%, proche de la fin de vie)

- **`$match`**: 
  - **`$ne`**: Not equal (différent de) - exclut les ratios null
  - **`$gte`**: Greater than or equal (≥) - garde uniquement les ratios ≥ seuil (ex: 0.8)
  - Filtre pour ne garder que le matériel usé à 80%+ de sa durée de vie

- **`$project`**: Sélectionne les champs pertinents

- **`$sort`**: 
  - **`-1`**: Ordre décroissant
  - Matériel le plus usé en premier (ex: 95%, 90%, 85%...)

---

### 🎯 Endpoint 4: `/analytics/spots/leaderboard` - Statistiques créations par mois

```javascript
[
  { $match: match },
  {
    $group: {
      _id: { month: { $dateTrunc: { date: "$createdAt", unit: "month" } } },
      count: { $sum: 1 },
    },
  },
  { $project: { _id: 0, month: "$_id.month", count: 1 } },
  { $sort: { month: 1 } },
]
```

**Explication des commandes:**

- **`$match`**: 
  - Filtre optionnel par période (from/to)
  - Si `from` et `to` sont fournis, filtre les dates entre ces deux bornes

- **`$group`**: 
  - **But**: Regroupe les documents et effectue des agrégations (comme GROUP BY en SQL)
  - **`_id`**: Clé de regroupement (ici par mois)
  - **`$dateTrunc`**: Tronque une date à une unité spécifique
    - **`date: "$createdAt"`**: La date à tronquer
    - **`unit: "month"`**: Tronque au début du mois (ex: 2025-10-23 → 2025-10-01)
  - **`$sum: 1`**: Compte le nombre de documents dans chaque groupe
  - Résultat: { _id: { month: Date }, count: 42 }

- **`$project`**: 
  - **But**: Reformate la sortie pour être plus lisible
  - **`_id: 0`**: Exclut le champ _id de la sortie
  - **`month: "$_id.month"`**: Extrait le mois de _id et le met au niveau racine
  - Transforme: `{ _id: { month: Date }, count: 42 }` → `{ month: Date, count: 42 }`

- **`$sort`**: 
  - **`month: 1`**: Ordre chronologique croissant
  - Les mois les plus anciens en premier

---

## 📚 Résumé des Commandes d'Agrégation

### Commandes de Filtrage
- **`$match`**: Filtre les documents (comme WHERE en SQL)
- **`$text`**: Recherche full-text dans les index texte

### Commandes de Transformation
- **`$project`**: Sélectionne/exclut des champs (comme SELECT en SQL)
- **`$set` / `$addFields`**: Ajoute ou modifie des champs
- **`$limit`**: Limite le nombre de résultats
- **`$sort`**: Trie les résultats
- **`$sample`**: Sélectionne un échantillon aléatoire

### Commandes Géospatiales
- **`$geoNear`**: Recherche les documents les plus proches d'un point géographique

### Commandes de Regroupement
- **`$group`**: Regroupe les documents et calcule des agrégats
- **`$sum`**: Compte ou additionne des valeurs

### Commandes de Jointure
- **`$lookup`**: Jointure avec une autre collection (JOIN SQL)

### Opérateurs Conditionnels & Calculs
- **`$cond`**: If-then-else (condition ternaire)
- **`$ifNull`**: Valeur par défaut si null
- **`$gt`**: Plus grand que (>)
- **`$gte`**: Plus grand ou égal (≥)
- **`$ne`**: Différent de (≠)
- **`$divide`**: Division
- **`$dateTrunc`**: Tronque une date à une unité (jour, mois, année...)
- **`$meta`**: Accède aux métadonnées (ex: score de recherche textuelle)

### Opérateurs Logiques
- **`$and`**: ET logique (toutes conditions vraies)
- **`$or`**: OU logique (au moins une condition vraie)

### Opérateurs de Tableau
- **`$arrayElemAt`**: Extrait un élément d'un tableau par index

---

## 💡 Bonnes Pratiques

1. **Ordre des étapes**: Mettez `$match` le plus tôt possible pour réduire les données traitées
2. **Index**: Assurez-vous d'avoir des index sur les champs filtrés/triés (voir `createIndex()`)
3. **`$project` early**: Éliminez les champs inutiles tôt pour améliorer les performances
4. **`allowDiskUse`**: Utilisez `{ allowDiskUse: true }` pour les gros pipelines
5. **`$geoNear`**: Doit toujours être la première étape du pipeline
6. **Limit**: Toujours limiter les résultats pour éviter la surcharge

---

## 🔗 Ressources

- [MongoDB Aggregation Pipeline](https://docs.mongodb.com/manual/core/aggregation-pipeline/)
- [Aggregation Pipeline Stages](https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/)
- [Aggregation Pipeline Operators](https://docs.mongodb.com/manual/reference/operator/aggregation/)
