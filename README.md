# ZoneDeGrimpe

Application web de cartographie des spots d'escalade en France : falaises, blocs, salles et magasins.

**[Voir le site](https://vincentchaye.github.io)** | **[API](https://zonedegrimpe.onrender.com)**

---

## Fonctionnalites

- **Carte interactive** — Leaflet avec clustering, filtres (type, cotation, orientation), recherche, itineraires
- **Spots communautaires** — Proposer, modifier, bookmarker des spots. Workflow de moderation admin
- **Voies d'escalade** — Catalogue par spot (grade, style, hauteur, nombre de points)
- **Reviews & notes** — 1 avis par utilisateur par spot, moyenne denormalisee
- **Logbook** — Carnet de grimpe personnel (onsight, flash, redpoint, repeat), stats et pyramide de cotations
- **Social** — Systeme d'amis, follows, feed d'activite
- **Notifications** — In-app + push (Web Push / VAPID)
- **Profils publics** — Stats, contributions, avatar
- **i18n** — Francais, anglais, espagnol
- **PWA** — Mode hors-ligne (cache API, tuiles, fonts)
- **Admin** — Gestion spots en attente, modifications, utilisateurs

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS |
| **State** | Zustand |
| **Carte** | react-leaflet + Leaflet + react-leaflet-cluster |
| **Animations** | Framer Motion |
| **i18n** | i18next + react-i18next |
| **Backend** | Node.js + Express (ES modules) |
| **Base de donnees** | MongoDB Atlas (index 2dsphere) |
| **Auth** | JWT + bcryptjs |
| **Validation** | Zod |
| **Push** | web-push (VAPID) |
| **Upload** | Multer + Cloudinary |
| **Deploy backend** | Render (Docker) |
| **Deploy frontend** | GitHub Pages (GitHub Actions) |
| **CI/CD** | GitHub Actions → GHCR |

---

## Demarrage rapide

### Prerequisites

- Node.js >= 18
- npm
- Acces a un cluster MongoDB Atlas (ou MongoDB local)

### Installation

```bash
git clone https://github.com/VincentChaye/ZoneDeGrimpe.git
cd ZoneDeGrimpe

# Backend
cd backend
npm install
cp .env.example .env
# Editez .env avec vos identifiants MongoDB et un JWT_SECRET

# Frontend React
cd ../frontend-react
npm install
```

### Lancement

```bash
# Terminal 1 — Backend (port 3000)
cd backend
npm start

# Terminal 2 — Frontend React (Vite dev server)
cd frontend-react
npm run dev
```

### Variables d'environnement (backend/.env)

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
DB_NAME=ZoneDeGrimpe
PORT=3000
NODE_ENV=development
JWT_SECRET=<generer avec: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
ALLOWED_ORIGIN=http://localhost:5173,http://localhost:3001
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=...
```

> Ne commitez jamais `.env`. Il est dans `.gitignore`.

---

## Structure du projet

```
ZoneDeGrimpe/
├── backend/
│   ├── server.js                  # Point d'entree Express
│   ├── dockerfile                 # Build Docker multi-stage
│   ├── src/
│   │   ├── db.js                  # Connexion MongoDB Atlas
│   │   ├── auth.js                # Middlewares requireAuth / requireAdmin
│   │   ├── validators.js          # Schemas Zod
│   │   ├── notifications.js       # Helper createNotification
│   │   └── routes/
│   │       ├── spots.routes.js        # CRUD spots + moderation
│   │       ├── spot-edits.routes.js   # Propositions de modifications
│   │       ├── auth.routes.js         # Login / register
│   │       ├── users.routes.js        # Profils, parametres
│   │       ├── climbing-routes.routes.js  # Voies d'escalade
│   │       ├── reviews.routes.js      # Avis et notes
│   │       ├── logbook.routes.js      # Carnet de grimpe
│   │       ├── bookmarks.routes.js    # Favoris
│   │       ├── follows.routes.js      # Follows + feed
│   │       ├── friends.routes.js      # Systeme d'amis
│   │       ├── notifications.routes.js # Notifs + push
│   │       ├── userMateriel.routes.js # Materiel perso
│   │       ├── materielSpecs.routes.js # Specs materiel
│   │       ├── analytics.routes.js    # Stats
│   │       └── advice.routes.js       # Conseils
│   └── scripts/
│       ├── import-osm.js         # Import spots depuis OpenStreetMap
│       ├── update-spot-data.js   # Enrichissement ClimbingAway
│       ├── enrich-safe.js        # Enrichissement Gemini AI
│       ├── enrich-camptocamp.js  # Enrichissement camptocamp.org
│       ├── cleanup-sectors.js    # Nettoyage sous-secteurs OSM
│       └── migrate-usernames.js  # Migration usernames
│
├── frontend-react/                # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/                 # Pages (Map, Login, Profile, Logbook, Feed, Admin...)
│   │   ├── components/            # Composants (map, ui, layout, auth, social, spots, admin)
│   │   ├── stores/                # Zustand (auth, theme, friends)
│   │   ├── i18n/                  # Config i18next
│   │   ├── lib/                   # Utilitaires
│   │   └── types/                 # Types TypeScript
│   └── public/
│
├── .github/workflows/
│   ├── ghcr.yml                   # Build Docker → GHCR
│   └── pages.yml                  # Deploy frontend → GitHub Pages
└── design-system/                 # Design system
```

---

## Scripts

### Backend

```bash
npm start                 # Demarre le serveur (port 3000 dev / 8080 prod)
npm run import-osm        # Import spots depuis OpenStreetMap
npm run import-osm:dry    # Dry run sans insertion
npm run update-spots      # Enrichissement depuis ClimbingAway
node scripts/enrich-safe.js       # Enrichissement Gemini AI
node scripts/enrich-camptocamp.js # Enrichissement camptocamp.org
node scripts/cleanup-sectors.js   # Supprime sous-secteurs OSM
```

Pipeline recommande : `import-osm` → `update-spots` → `enrich-safe`

### Frontend React

```bash
npm run dev       # Serveur de dev Vite
npm run build     # Build production (tsc + vite build)
npm run preview   # Preview du build
npm run lint      # ESLint
```

---

## API

Toutes les routes sont prefixees par `/api`.

| Methode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/spots` | - | Liste des spots (GeoJSON) |
| POST | `/spots` | user | Proposer un spot |
| PATCH | `/spots/:id` | user | Modifier un spot |
| GET | `/spots/pending` | admin | Spots en attente |
| PATCH | `/spots/:id/approve` | admin | Approuver |
| PATCH | `/spots/:id/reject` | admin | Rejeter |
| POST | `/auth/register` | - | Inscription |
| POST | `/auth/login` | - | Connexion |
| GET | `/climbing-routes/spot/:spotId` | - | Voies d'un spot |
| POST | `/climbing-routes` | user | Ajouter une voie |
| GET/POST/PATCH/DELETE | `/reviews/*` | user | Avis |
| GET/POST/DELETE | `/logbook/*` | user | Carnet de grimpe |
| GET/POST/DELETE | `/bookmarks/*` | user | Favoris |
| GET/POST/DELETE | `/follows/*` | user | Follows + feed |
| GET/POST/PATCH | `/friends/*` | user | Amis |
| GET/PATCH | `/notifications/*` | user | Notifications |
| GET/PATCH | `/users/*` | user | Profil et parametres |

---

## Deploiement

### Backend (Render)

Le backend est deploye automatiquement sur Render via Docker a chaque push sur `main`.

- Image Docker buildee via `backend/dockerfile` (Node 20 Alpine, multi-stage)
- Variables d'environnement configurees sur Render
- Port 8080 en production

### Frontend (GitHub Pages)

Le workflow `.github/workflows/pages.yml` build et deploie le frontend React sur GitHub Pages.

---

## Types de spots

| Type | Description |
|------|-------------|
| `crag` | Falaise |
| `boulder` | Bloc |
| `indoor` | Salle |
| `shop` | Magasin |

---

## Contribution

1. Ouvrez une issue pour discuter du changement
2. Fork + branche feature
3. PR avec description detaillee

Convention de commit : `Version X.X.X Complet - Description`

---

## Auteur

**Vincent Chaye** — Grimpeur et developpeur full-stack, Valbonne, France

- [LinkedIn](https://linkedin.com/in/vincent-chaye)
- [Email](mailto:vincent.chaye@icloud.com)

---

## Remerciements

- [OpenStreetMap](https://www.openstreetmap.org/) et l'API Overpass pour les donnees
- [Leaflet](https://leafletjs.com/) pour la cartographie
- [MongoDB Atlas](https://www.mongodb.com/atlas) pour l'hebergement BDD
