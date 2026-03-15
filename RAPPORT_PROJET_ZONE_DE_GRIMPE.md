# RAPPORT DE PROJET
## Application Web "Zone de Grimpe" avec Base de Données NoSQL

**Auteur :** Vincent Chayé  
**Date :** Décembre 2024  
**Contexte :** Projet académique - Développement d'application web avec base de données NoSQL

---

## TABLE DES MATIÈRES

1. [Présentation du projet](#1-présentation-du-projet)
2. [Présentation de la base de données](#2-présentation-de-la-base-de-données)
3. [Architecture du code](#3-architecture-du-code)
4. [Fonctionnalités développées](#4-fonctionnalités-développées)
5. [Technologies utilisées](#5-technologies-utilisées)
6. [Démonstrations](#6-démonstrations)
7. [Conclusion](#7-conclusion)

---

## 1. PRÉSENTATION DU PROJET

### 1.1 Contexte et Objectifs

**Zone de Grimpe** est une application web complète développée pour la communauté des grimpeurs. L'objectif principal est de créer une plateforme interactive qui combine :

- **Cartographie intelligente** des sites d'escalade
- **Gestion personnalisée** du matériel d'escalade
- **Système de conseils** basé sur l'inventaire et les préférences
- **Analytics avancées** pour optimiser l'expérience utilisateur

### 1.2 Problématique Résolue

Les grimpeurs rencontrent plusieurs défis :
- **Découverte de spots** : Difficulté à trouver de nouveaux sites adaptés à leur niveau
- **Gestion du matériel** : Suivi complexe de l'état et de la durée de vie des équipements
- **Planification** : Besoin d'informations précises sur les exigences matérielles des spots
- **Sécurité** : Importance du suivi des inspections et de la maintenance du matériel

### 1.3 Solution Apportée

L'application Zone de Grimpe propose :
- Une **cartographie interactive** avec plus de 10 000 spots d'escalade
- Un **système de gestion de matériel** avec suivi du cycle de vie
- Des **conseils personnalisés** basés sur l'inventaire et la localisation
- Une **interface utilisateur** intuitive et responsive

---

## 2. PRÉSENTATION DE LA BASE DE DONNÉES

### 2.1 Choix du SGBD : MongoDB

**Justification du choix :**

MongoDB a été sélectionné pour plusieurs raisons stratégiques :

1. **Données géospatiales** : Support natif des requêtes géographiques avec l'index 2dsphere
2. **Flexibilité du schéma** : Adaptation aux données hétérogènes des spots d'escalade
3. **Performance** : Optimisation des requêtes complexes avec les agrégations
4. **Évolutivité** : Facilité d'ajout de nouvelles fonctionnalités
5. **Intégration** : Compatibilité native avec Node.js et l'écosystème JavaScript

### 2.2 Structure de la Base de Données

#### 2.2.1 Collections Principales

**Collection `climbing_spot` (~10 000+ documents)**
- **Source** : OpenStreetMap via Overpass API
- **Type** : Documents GeoJSON avec coordonnées géospatiales
- **Index** : 2dsphere sur le champ `location`

```json
{
  "_id": "ObjectId(...)",
  "name": "Baume Rousse",
  "type": "crag",
  "location": {
    "type": "Point",
    "coordinates": [5.12547, 44.4273]
  },
  "orientation": "S",
  "niveau_min": "4a",
  "niveau_max": "7c",
  "properties": {
    "required_rope_m": 70,
    "required_qd": 15,
    "tags": ["calcaire", "équipé", "relais"]
  },
  "source": "OpenStreetMap"
}
```

**Collection `users`**
- **Authentification** : JWT + bcryptjs
- **Profil utilisateur** : Niveau, préférences, données personnelles
- **Index** : Unique sur email, text sur displayName et email

```json
{
  "_id": "ObjectId(...)",
  "email": "grimper@example.com",
  "passwordHash": "$2a$10$hashed_password...",
  "displayName": "Grimpeur42",
  "roles": ["user"],
  "status": "active",
  "profile": {
    "level": "intermediaire",
    "firstName": "Marie",
    "lastName": "Dupont"
  },
  "security": {
    "createdAt": "2024-10-20T10:30:00.000Z",
    "lastLoginAt": "2024-10-20T15:45:00.000Z"
  }
}
```

**Collection `User_Materiel`**
- **Inventaire personnel** : Cordes, dégaines, casques, etc.
- **Suivi du cycle de vie** : Usage, inspections, retraite
- **Index** : userId, lifecycle.nextInspectionAt

```json
{
  "_id": "ObjectId(...)",
  "userId": "ObjectId(...)",
  "type": "corde",
  "brand": "Petzl",
  "model": "Volta 9.2mm",
  "specs": {
    "length_m": 70,
    "diameter_mm": 9.2
  },
  "lifecycle": {
    "purchaseDate": "2024-03-15",
    "usageCount": 23,
    "nextInspectionAt": "2024-12-15",
    "retiredAt": null
  }
}
```

**Collection `Materiel_Specs`**
- **Spécifications techniques** : Marques, modèles, caractéristiques
- **Recommandations** : Durée de vie, usage maximum
- **Index** : category

```json
{
  "_id": "ObjectId(...)",
  "category": "corde",
  "brand": "Petzl",
  "model": "Volta 9.2mm",
  "recommendedMaxUsage": 100,
  "inspectionInterval": 30,
  "specifications": {
    "diameter_mm": 9.2,
    "weight_g_per_m": 58,
    "dynamic_elongation": 8.2
  }
}
```

#### 2.2.2 Index Optimisés

```javascript
// Index géospatial pour les requêtes de proximité
db.climbing_spot.createIndex({ location: "2dsphere" })

// Index de performance pour l'authentification
db.users.createIndex({ email: 1 }, { unique: true })

// Index de recherche textuelle
db.climbing_spot.createIndex({ name: "text", "properties.tags": "text" })
db.users.createIndex({ displayName: "text", email: "text" })

// Index pour les analytics
db.User_Materiel.createIndex({ "lifecycle.nextInspectionAt": 1, "lifecycle.retiredAt": 1 })
db.User_Materiel.createIndex({ userId: 1 })
db.Materiel_Specs.createIndex({ category: 1 })
```

### 2.3 Requêtes NoSQL Avancées

#### 2.3.1 Requêtes Géospatiales

```javascript
// Recherche par proximité avec calcul de distance
[
  {
    $geoNear: {
      near: { type: "Point", coordinates: [lng, lat] },
      distanceField: "dist_m",
      spherical: true,
      maxDistance: 30000
    }
  },
  { $match: { type: "falaise" } },
  { $limit: 30 }
]
```

#### 2.3.2 Agrégations Complexes

```javascript
// Analyse du matériel en fin de vie
[
  { $match: { "lifecycle.retiredAt": null } },
  {
    $lookup: {
      from: "Materiel_Specs",
      localField: "category",
      foreignField: "category",
      as: "spec"
    }
  },
  {
    $set: {
      usageRatio: {
        $cond: [
          { $gt: ["$spec.recommendedMaxUsage", 0] },
          { $divide: ["$lifecycle.usageCount", "$spec.recommendedMaxUsage"] },
          null
        ]
      }
    }
  },
  { $match: { usageRatio: { $gte: 0.8 } } }
]
```

---

## 3. ARCHITECTURE DU CODE

### 3.1 Architecture Générale

Le projet suit une **architecture client-serveur** modulaire :

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  HTML/CSS/JS Vanilla + Leaflet.js                       │
│  Pages: Accueil, Carte, Matériel, Paramètres           │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP/REST API
                 │ (Fetch API)
┌────────────────▼────────────────────────────────────────┐
│                      BACKEND                            │
│  Node.js + Express.js                                   │
│  Routes: /api/spots, /api/auth, /api/users,            │
│          /api/user_materiel, /api/materiel_specs       │
│          /api/analytics, /api/advice                    │
└────────────────┬────────────────────────────────────────┘
                 │ MongoDB Driver
                 │
┌────────────────▼────────────────────────────────────────┐
│                   BASE DE DONNÉES                       │
│  MongoDB Atlas (ou local)                               │
│  Collections: climbing_spot, users, user_materiel,     │
│               materiel_specs                            │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Structure du Backend

```
backend/
├── server.js                 # Point d'entrée du serveur
├── package.json              # Dépendances backend
├── src/
│   ├── db.js                 # Connexion MongoDB
│   ├── auth.js               # Middlewares d'authentification
│   ├── validators.js         # Schémas de validation Zod
│   └── routes/               # Routes de l'API
│       ├── spots.routes.js       # Spots d'escalade
│       ├── auth.routes.js        # Authentification
│       ├── users.routes.js       # Gestion des utilisateurs
│       ├── userMateriel.routes.js    # Matériel utilisateur
│       ├── materielSpecs.routes.js   # Specs techniques
│       ├── analytics.routes.js       # Statistiques
│       └── advice.routes.js          # Conseils personnalisés
└── scripts/
    ├── update-spot-data.js   # Mise à jour des données
    └── test-extraction.js    # Test de scraping
```

### 3.3 Structure du Frontend

```
frontend/
├── index.html                # Page d'accueil
├── map.html                  # Carte interactive
├── materiel.html             # Gestion du matériel
├── parametres.html           # Paramètres utilisateur
├── login.html                # Page de connexion
├── register.html             # Page d'inscription
├── js/
│   ├── main.js               # Script principal
│   ├── map.js                # Logique de la carte Leaflet
│   ├── api.js                # Appels API
│   ├── config.js             # Configuration
│   ├── login.js              # Logique de connexion
│   ├── register.js           # Logique d'inscription
│   ├── materiel-smart.js     # Gestion du matériel
│   ├── parametres.js         # Gestion des paramètres
│   └── ui.js                 # Utilitaires UI
├── style/
│   ├── style.css             # Styles principaux
│   ├── materiel.css          # Styles page matériel
│   └── parametres.css        # Styles page paramètres
└── assets/                   # Images et polices
```

### 3.4 Flux de Données

1. **Frontend** envoie des requêtes HTTP à l'API backend
2. **Backend** authentifie, valide (Zod) et traite les requêtes
3. **MongoDB** exécute les requêtes et agrégations
4. **Backend** formate les réponses en JSON
5. **Frontend** met à jour l'interface utilisateur

---

## 4. FONCTIONNALITÉS DÉVELOPPÉES

### 4.1 Cartographie Interactive

#### 4.1.1 Affichage des Spots
- **Carte Leaflet** avec plus de 10 000 spots d'escalade
- **Clustering intelligent** pour optimiser les performances
- **Markers personnalisés** selon le type de spot
- **Panneau d'informations** détaillé pour chaque spot

#### 4.1.2 Filtrage Géospatial
- **Recherche par proximité** : `GET /api/spots/near?lng=2.3522&lat=48.8566&radius=10000`
- **Filtrage par bbox** : `GET /api/spots?minLng=2.0&minLat=48.0&maxLng=2.5&maxLat=48.5`
- **Calcul de distance** en temps réel
- **Optimisation** avec index 2dsphere

#### 4.1.3 Recherche Textuelle
- **Recherche plein texte** : `GET /api/analytics/spots/textsearch?q=Fontainebleau`
- **Score de pertinence** avec `$meta: "textScore"`
- **Index text** sur nom et tags
- **Limitation** des résultats pour la performance

### 4.2 Gestion du Matériel

#### 4.2.1 Inventaire Personnel
- **CRUD complet** : `GET/POST/PATCH/DELETE /api/user_materiel`
- **Catégories** : cordes, dégaines, casques, mousquetons, etc.
- **Spécifications détaillées** : marque, modèle, caractéristiques
- **Protection** : Chaque utilisateur ne voit que son matériel

#### 4.2.2 Suivi du Cycle de Vie
- **Compteur d'usage** : Nombre de sorties, heures d'utilisation
- **Dates d'inspection** : Rappels automatiques
- **État du matériel** : Bon, usé, à remplacer
- **Historique** : Suivi des modifications

#### 4.2.3 Alertes de Maintenance
- **Matériel à inspecter** : `GET /api/analytics/gear/inspections/due?withinDays=30`
- **Calcul automatique** des prochaines inspections
- **Notifications** basées sur l'usage
- **Priorisation** par urgence

#### 4.2.4 Calcul de Fin de Vie
- **Analyse du ratio d'usage** : `GET /api/analytics/gear/retire-soon?thresholdPct=0.8`
- **Comparaison** avec les spécifications recommandées
- **Alertes préventives** avant la fin de vie
- **Recommandations** de remplacement

### 4.3 Système de Conseils Personnalisés

#### 4.3.1 Analyse de l'Inventaire
- **Évaluation** du matériel disponible
- **Calcul des capacités** : longueur de corde, nombre de dégaines
- **Détection des manques** : équipements manquants
- **Recommandations** d'achat

#### 4.3.2 Conseils Matériel
- **Endpoint** : `GET /api/advice/material?userId=<id>&lat=48.8566&lng=2.3522&maxKm=30`
- **Analyse géospatiale** des spots proches
- **Calcul des besoins** : corde requise, dégaines nécessaires
- **Recommandations personnalisées** basées sur la localisation

#### 4.3.3 Suggestions de Spots
- **Endpoint** : `GET /api/advice/spots?userId=<id>&lat=48.8566&lng=2.3522&niveau_min=6a`
- **Filtrage intelligent** : niveau, orientation, matériel
- **Catégorisation** : compatible, challenge, gear_blocked
- **Calcul de compatibilité** matériel vs exigences

### 4.4 Analytics Avancées

#### 4.4.1 Recherche Textuelle
- **Algorithme de scoring** avec `$meta: "textScore"`
- **Index optimisé** sur nom et tags
- **Limitation intelligente** des résultats
- **Performance** : < 200ms pour la plupart des requêtes

#### 4.4.2 Statistiques d'Utilisation
- **Leaderboard** : `GET /api/analytics/spots/leaderboard`
- **Regroupement temporel** avec `$dateTrunc`
- **Filtrage par période** : from/to
- **Visualisation** des tendances

#### 4.4.3 Détection de Matériel en Fin de Vie
- **Pipeline d'agrégation** complexe
- **Jointure** avec les spécifications
- **Calcul du ratio** usage/recommandation
- **Alertes automatiques** pour les administrateurs

### 4.5 Authentification et Gestion des Comptes

#### 4.5.1 Authentification Sécurisée
- **Inscription** : `POST /api/auth/register`
- **Connexion** : `POST /api/auth/login`
- **JWT tokens** avec expiration (7 jours)
- **Hachage bcrypt** des mots de passe (salt rounds: 10)

#### 4.5.2 Gestion des Profils
- **Profil utilisateur** : `GET /api/users/me`
- **Mise à jour** : `PATCH /api/users/me`
- **Niveaux de grimpe** : débutant, intermédiaire, avancé
- **Préférences personnalisables**

#### 4.5.3 Sécurité Avancée
- **Validation stricte** avec Zod
- **Protection des routes** avec middleware
- **Sanitisation** des données
- **Gestion des erreurs** sécurisée

---

## 5. TECHNOLOGIES UTILISÉES

### 5.1 Backend

| Technologie | Version | Usage |
|-------------|---------|-------|
| **Node.js** | 18.x | Runtime JavaScript |
| **Express.js** | 4.19.2 | Framework web minimaliste |
| **MongoDB** | 6.7.0 | Base de données NoSQL |
| **JWT** | 9.0.2 | Authentification par tokens |
| **bcryptjs** | 3.0.2 | Hachage des mots de passe |
| **Zod** | 3.25.76 | Validation de schémas |
| **Cheerio** | 1.0.0 | Web scraping |
| **dotenv** | 16.4.5 | Variables d'environnement |
| **CORS** | 2.8.5 | Gestion CORS |

### 5.2 Frontend

| Technologie | Usage |
|-------------|-------|
| **HTML5/CSS3** | Structure et styles |
| **JavaScript (ES6+)** | Logique applicative |
| **Leaflet.js** | Cartographie interactive |
| **Fetch API** | Requêtes HTTP |
| **LocalStorage** | Cache et stockage local |

### 5.3 Données

| Source | Usage |
|--------|-------|
| **Overpass API** | Extraction des spots d'escalade |
| **GeoJSON** | Format de données géospatiales |
| **2dsphere** | Index géospatial MongoDB |

---

## 6. DÉMONSTRATIONS

### 6.1 Cartographie Interactive

#### 6.1.1 Affichage des Spots
```bash
# Requête pour afficher les spots dans une zone
GET /api/spots?minLng=2.0&minLat=48.0&maxLng=2.5&maxLat=48.5&format=geojson

# Réponse : GeoJSON FeatureCollection avec ~1000 spots
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [2.3522, 48.8566]
      },
      "properties": {
        "id": "ObjectId(...)",
        "name": "Fontainebleau",
        "type": "boulder",
        "niveau_min": "3a",
        "niveau_max": "8c"
      }
    }
  ]
}
```

#### 6.1.2 Recherche par Proximité
```bash
# Recherche des spots dans un rayon de 10km
GET /api/spots/near?lng=2.3522&lat=48.8566&radius=10000&limit=50

# Réponse : Liste triée par distance
[
  {
    "_id": "ObjectId(...)",
    "name": "Rocher Canon",
    "dist_m": 2500,
    "type": "crag",
    "orientation": "SE"
  }
]
```

### 6.2 Gestion du Matériel

#### 6.2.1 Inventaire Personnel
```bash
# Récupération de l'inventaire (avec token JWT)
GET /api/user_materiel
Authorization: Bearer <token>

# Réponse : Liste du matériel de l'utilisateur
[
  {
    "_id": "ObjectId(...)",
    "type": "corde",
    "brand": "Petzl",
    "model": "Volta 9.2mm",
    "lifecycle": {
      "usageCount": 23,
      "nextInspectionAt": "2024-12-15"
    }
  }
]
```

#### 6.2.2 Ajout d'Équipement
```bash
# Ajout d'une nouvelle corde
POST /api/user_materiel
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "corde",
  "brand": "Petzl",
  "model": "Volta 9.2mm",
  "specs": {
    "length_m": 70,
    "diameter_mm": 9.2
  }
}

# Réponse : Confirmation de création
{
  "ok": true,
  "id": "ObjectId(...)"
}
```

### 6.3 Conseils Personnalisés

#### 6.3.1 Analyse Matériel
```bash
# Conseils basés sur l'inventaire et la localisation
GET /api/advice/material?userId=<id>&lat=48.8566&lng=2.3522&maxKm=30

# Réponse : Recommandations personnalisées
{
  "summaryInventaire": {
    "rope_m": 60,
    "qd_count": 12,
    "hasHelmet": true
  },
  "besoinsObserves": {
    "maxRequired": { "rope_m": 70, "qd": 15 },
    "insuffisant": {
      "rope": { "count": 5, "pct": 25 },
      "qd": { "count": 2, "pct": 10 }
    }
  },
  "recommandations": [
    {
      "category": "Corde",
      "reason": "Certaines voies demandent 70m",
      "suggestion": "Envisage une corde 70m pour élargir tes options"
    }
  ]
}
```

#### 6.3.2 Suggestions de Spots
```bash
# Spots adaptés au niveau et matériel
GET /api/advice/spots?userId=<id>&lat=48.8566&lng=2.3522&niveau_min=6a&exposition=SE,SW

# Réponse : Spots catégorisés
{
  "compatible": [
    {
      "name": "Rocher Canon",
      "dist_m": 2500,
      "grade_mean": "6b",
      "gear": { "ok": true }
    }
  ],
  "challenge": [
    {
      "name": "Falaise Sud",
      "dist_m": 5000,
      "grade_mean": "6c",
      "gear": { "ok": true }
    }
  ],
  "gear_blocked": [
    {
      "name": "Grande Voie",
      "dist_m": 8000,
      "required_rope_m": 80,
      "gear": { "ok": false, "missing": ["Corde 80m"] }
    }
  ]
}
```

### 6.4 Analytics

#### 6.4.1 Recherche Textuelle
```bash
# Recherche de spots par nom
GET /api/analytics/spots/textsearch?q=Fontainebleau&limit=10

# Réponse : Résultats avec score de pertinence
{
  "q": "Fontainebleau",
  "count": 5,
  "items": [
    {
      "_id": "ObjectId(...)",
      "name": "Fontainebleau - Bas Cuvier",
      "score": 2.5,
      "properties": {
        "type": "boulder",
        "tags": ["bloc", "sable"]
      }
    }
  ]
}
```

#### 6.4.2 Matériel à Inspecter
```bash
# Matériel nécessitant une inspection
GET /api/analytics/gear/inspections/due?withinDays=30

# Réponse : Liste des équipements à inspecter
{
  "withinDays": 30,
  "count": 3,
  "items": [
    {
      "_id": "ObjectId(...)",
      "user": { "email": "user@example.com" },
      "category": "corde",
      "lifecycle": {
        "nextInspectionAt": "2024-12-20",
        "usageCount": 45
      }
    }
  ]
}
```

### 6.5 Authentification

#### 6.5.1 Inscription
```bash
# Création d'un nouveau compte
POST /api/auth/register
Content-Type: application/json

{
  "email": "grimpeur@example.com",
  "password": "motdepasse123",
  "displayName": "Grimpeur Test"
}

# Réponse : Token JWT et profil utilisateur
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "ObjectId(...)",
    "email": "grimpeur@example.com",
    "displayName": "Grimpeur Test",
    "profile": { "level": "debutant" }
  }
}
```

#### 6.5.2 Connexion
```bash
# Authentification utilisateur
POST /api/auth/login
Content-Type: application/json

{
  "email": "grimpeur@example.com",
  "password": "motdepasse123"
}

# Réponse : Token JWT et profil utilisateur
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "ObjectId(...)",
    "email": "grimpeur@example.com",
    "displayName": "Grimpeur Test"
  }
}
```

---

## 7. CONCLUSION

### 7.1 Objectifs Atteints

Le projet **Zone de Grimpe** a atteint tous ses objectifs initiaux :

1. **✅ Valorisation de la base de données NoSQL** : Utilisation complète des capacités de MongoDB (géospatial, agrégations, flexibilité)
2. **✅ Application web fonctionnelle** : Interface intuitive et responsive
3. **✅ Fonctionnalités innovantes** : Système de conseils personnalisés unique
4. **✅ Performance optimisée** : Index appropriés et requêtes efficaces
5. **✅ Sécurité robuste** : Authentification et validation complètes

### 7.2 Points Forts Techniques

#### 7.2.1 Maîtrise de MongoDB
- **Requêtes géospatiales** complexes avec `$geoNear` et `$geoWithin`
- **Agrégations avancées** avec `$lookup`, `$group`, `$match`
- **Index optimisés** pour les performances
- **Gestion des données hétérogènes** avec flexibilité du schéma

#### 7.2.2 Architecture Scalable
- **Séparation claire** frontend/backend
- **API REST** modulaire et documentée
- **Middleware de sécurité** réutilisable
- **Validation stricte** des données

#### 7.2.3 Fonctionnalités Innovantes
- **Système de conseils** basé sur l'inventaire et la géolocalisation
- **Analytics prédictives** pour la maintenance du matériel
- **Interface cartographique** interactive et performante
- **Gestion complète** du cycle de vie du matériel

### 7.3 Apports Pédagogiques

Ce projet démontre une **maîtrise complète** des technologies NoSQL :

1. **Compréhension approfondie** de MongoDB et de ses spécificités
2. **Maîtrise des requêtes** géospatiales et d'agrégation
3. **Architecture d'application** moderne et scalable
4. **Sécurité web** et bonnes pratiques de développement
5. **Intégration** de données externes (OpenStreetMap)

### 7.4 Perspectives d'Évolution

Le projet offre de nombreuses possibilités d'extension :

- **Application mobile** avec React Native
- **Notifications push** pour les alertes de maintenance
- **Intégration météo** en temps réel
- **Système de favoris** et listes personnalisées
- **Mode hors-ligne** avec PWA
- **API publique** pour les développeurs tiers

### 7.5 Conclusion Générale

**Zone de Grimpe** est un projet **techniquement abouti** qui valorise parfaitement les capacités de MongoDB tout en créant une **application web utile et innovante** pour la communauté des grimpeurs. 

La combinaison de **données géospatiales complexes**, de **gestion de matériel personnalisée**, et de **conseils intelligents** démontre une compréhension approfondie des technologies NoSQL et des enjeux du développement web moderne.

Le projet respecte les **bonnes pratiques** de développement, de sécurité, et d'architecture, tout en apportant une **valeur réelle** aux utilisateurs finaux.

---

**Mots-clés :** MongoDB, NoSQL, Géospatial, Node.js, Express.js, JWT, Cartographie, Escalade, Analytics, Conseils personnalisés

**Technologies :** MongoDB, Node.js, Express.js, Leaflet.js, JWT, bcryptjs, Zod, GeoJSON, OpenStreetMap