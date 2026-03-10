import { MongoClient } from 'mongodb';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- AJOUT DE LA CONFIGURATION DOTENV ---
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
// ----------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'ZoneDeGrimpe';
// Fonction pour récupérer et parser une page ClimbingAway
async function fetchClimbingAwayData(url) {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Erreur HTTP ${response.status} pour ${url}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const data = {
      orientation: null,
      niveau_min: null,
      niveau_max: null
    };
    
    // Extraction de l'orientation
    // Chercher dans différents formats possibles
    $('dt, th, .label, .field-label').each((i, elem) => {
      const text = $(elem).text().toLowerCase().trim();
      if (text.includes('orientation') || text.includes('exposition')) {
        // Récupérer la valeur suivante (dd, td, ou div suivant)
        const value = $(elem).next().text().trim();
        if (value && value.length < 20) {
          data.orientation = value;
        }
      }
    });
    
    // Extraction des niveaux
    // Format possible: "6a à 7c", "4 à 8a", etc.
    $('dt, th, .label, .field-label').each((i, elem) => {
      const text = $(elem).text().toLowerCase().trim();
      if (text.includes('niveau') || text.includes('cotation') || text.includes('difficulté')) {
        const value = $(elem).next().text().trim();
        
        // Essayer de parser le format "min à max"
        const match = value.match(/(\d[a-c]?\+?)\s*(?:à|[-–])\s*(\d[a-c]?\+?)/i);
        if (match) {
          data.niveau_min = match[1];
          data.niveau_max = match[2];
        }
      }
    });
    
    // Chercher aussi dans le contenu texte
    const bodyText = $('body').text();
    
    // Pattern pour l'orientation (N, S, E, W, NE, NW, SE, SW, etc.)
    if (!data.orientation) {
      const orientMatch = bodyText.match(/orientation\s*:?\s*([NSEW]{1,2})/i);
      if (orientMatch) {
        data.orientation = orientMatch[1].toUpperCase();
      }
    }
    
    console.log(`Données extraites:`, data);
    return data;
    
  } catch (error) {
    console.error(`Erreur lors du fetch de ${url}:`, error.message);
    return null;
  }
}

// Fonction pour normaliser l'orientation (de info_complementaires vers racine)
function normalizeOrientation(spot) {
  let orientation = spot.orientation;
  
  // Si l'orientation est dans info_complementaires, la remonter
  if (!orientation && spot.info_complementaires?.orientation) {
    orientation = spot.info_complementaires.orientation;
  }
  
  return orientation || null;
}

async function main() {
  console.log('=== Mise à jour des données des spots ===\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connecté à MongoDB');
    
    const db = client.db(DB_NAME);
    const spots = db.collection('climbing_spot');
    
    // 1. D'abord, normaliser les orientations existantes
    console.log('\n1. Normalisation des orientations...');
    const spotsToNormalize = await spots.find({
      'info_complementaires.orientation': { $exists: true, $ne: '' },
      $or: [
        { orientation: { $exists: false } },
        { orientation: '' },
        { orientation: null }
      ]
    }).toArray();
    
    console.log(`Trouvé ${spotsToNormalize.length} spots avec orientation à normaliser`);
    
    for (const spot of spotsToNormalize) {
      const orientation = spot.info_complementaires.orientation;
      await spots.updateOne(
        { _id: spot._id },
        { $set: { orientation } }
      );
      console.log(`✓ ${spot.name}: orientation normalisée -> ${orientation}`);
    }
    
    // 2. Récupérer les spots avec URL ClimbingAway mais sans données complètes
    console.log('\n2. Recherche des spots à compléter...');
    const spotsToUpdate = await spots.find({
      url: { $regex: /climbingaway\.fr/i },
      $or: [
        { niveau_min: { $in: ['', null] } },
        { niveau_max: { $in: ['', null] } },
        { orientation: { $in: ['', null] } }
      ]
    }).limit(50).toArray(); // Limiter à 50 pour ne pas surcharger
    
    console.log(`Trouvé ${spotsToUpdate.length} spots à compléter depuis ClimbingAway\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (const spot of spotsToUpdate) {
      console.log(`\nTraitement: ${spot.name}`);
      
      const data = await fetchClimbingAwayData(spot.url);
      
      if (data && (data.orientation || data.niveau_min || data.niveau_max)) {
        const updateFields = {};
        
        if (data.orientation && !spot.orientation) {
          updateFields.orientation = data.orientation;
        }
        if (data.niveau_min && !spot.niveau_min) {
          updateFields.niveau_min = data.niveau_min;
        }
        if (data.niveau_max && !spot.niveau_max) {
          updateFields.niveau_max = data.niveau_max;
        }
        
        if (Object.keys(updateFields).length > 0) {
          await spots.updateOne(
            { _id: spot._id },
            { $set: updateFields }
          );
          console.log(`✓ Mis à jour:`, updateFields);
          updated++;
        }
      } else {
        console.log(`✗ Aucune donnée extraite`);
        failed++;
      }
      
      // Pause entre les requêtes pour ne pas surcharger le serveur
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n=== Résumé ===');
    console.log(`Spots normalisés: ${spotsToNormalize.length}`);
    console.log(`Spots mis à jour: ${updated}`);
    console.log(`Échecs: ${failed}`);
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await client.close();
    console.log('\nConnexion fermée');
  }
}

// Exécution
main().catch(console.error);
