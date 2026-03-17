# Scripts de maintenance

## update-spot-data.js

Script pour mettre à jour automatiquement les données des spots d'escalade.

### Fonctionnalités

1. **Normalisation de l'orientation** : Déplace le champ `info_complementaires.orientation` vers `orientation` à la racine du document
2. **Extraction depuis ClimbingAway** : Scrape les pages ClimbingAway pour récupérer :
   - L'orientation (N, S, E, W, NE, SE, SW, NW, etc.)
   - Les niveaux min et max (cotations)

### Prérequis

```bash
npm install cheerio
```

### Utilisation

```bash
# Avec les variables d'environnement par défaut
npm run update-spots

# Avec des variables personnalisées
MONGODB_URI=mongodb://localhost:27017 DB_NAME=grimpe npm run update-spots
```

### Variables d'environnement

- `MONGODB_URI` : URI de connexion MongoDB (défaut: `mongodb://localhost:27017`)
- `DB_NAME` : Nom de la base de données (défaut: `grimpe`)

### Comportement

Le script :
1. Se connecte à MongoDB
2. Normalise les orientations existantes dans `info_complementaires`
3. Recherche les spots avec URL ClimbingAway qui ont des données manquantes
4. Extrait les données depuis les pages web (max 50 spots par exécution)
5. Met à jour uniquement les champs vides
6. Affiche un résumé des opérations

### Limitations

- Limité à 50 spots par exécution pour éviter de surcharger le serveur
- Pause de 1 seconde entre chaque requête
- Ne remplace pas les données existantes
- Dépend de la structure HTML de ClimbingAway (peut nécessiter des ajustements)

### Structure attendue des données

```json
{
  "_id": "...",
  "name": "Nom du spot",
  "url": "https://climbingaway.fr/fr/site-escalade/...",
  "orientation": "SE",
  "niveau_min": "6a",
  "niveau_max": "7c",
  "info_complementaires": {
    "rock": "calcaire",
    "sport": "climbing"
  }
}
```
