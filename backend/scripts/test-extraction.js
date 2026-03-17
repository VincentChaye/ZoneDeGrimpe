/**
 * Script de test pour vérifier l'extraction des données ClimbingAway
 * Utilise l'exemple fourni : École d'Escalade de Pont Julien
 */

import * as cheerio from 'cheerio';

const TEST_URL = 'https://climbingaway.fr/fr/site-escalade/pont-julien';

async function testExtraction(url) {
  try {
    console.log(`🔍 Test d'extraction sur: ${url}\n`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log('✅ Page chargée avec succès\n');
    
    const data = {
      orientation: null,
      niveau_min: null,
      niveau_max: null
    };
    
    // Méthode 1 : Chercher dans les paires dt/dd
    console.log('📋 Méthode 1: Recherche dans les définitions...');
    $('dt').each((i, elem) => {
      const text = $(elem).text().toLowerCase().trim();
      const value = $(elem).next('dd').text().trim();
      
      if (text.includes('orientation') || text.includes('exposition')) {
        console.log(`  Trouvé: ${text} = ${value}`);
        if (value && value.length < 20) {
          data.orientation = value;
        }
      }
      
      if (text.includes('niveau') || text.includes('cotation') || text.includes('difficulté')) {
        console.log(`  Trouvé: ${text} = ${value}`);
        const match = value.match(/(\d[a-c]?\+?)\s*(?:à|[-–])\s*(\d[a-c]?\+?)/i);
        if (match) {
          data.niveau_min = match[1];
          data.niveau_max = match[2];
        }
      }
    });
    
    // Méthode 2 : Chercher dans les tableaux
    console.log('\n📊 Méthode 2: Recherche dans les tableaux...');
    $('table tr').each((i, row) => {
      const cells = $(row).find('th, td');
      if (cells.length >= 2) {
        const label = $(cells[0]).text().toLowerCase().trim();
        const value = $(cells[1]).text().trim();
        
        if (label.includes('orientation') || label.includes('exposition')) {
          console.log(`  Trouvé: ${label} = ${value}`);
          if (!data.orientation && value && value.length < 20) {
            data.orientation = value;
          }
        }
        
        if (label.includes('niveau') || label.includes('cotation')) {
          console.log(`  Trouvé: ${label} = ${value}`);
          if (!data.niveau_min) {
            const match = value.match(/(\d[a-c]?\+?)\s*(?:à|[-–])\s*(\d[a-c]?\+?)/i);
            if (match) {
              data.niveau_min = match[1];
              data.niveau_max = match[2];
            }
          }
        }
      }
    });
    
    // Méthode 3 : Recherche dans le texte brut
    console.log('\n📄 Méthode 3: Recherche dans le texte...');
    const bodyText = $('body').text();
    
    if (!data.orientation) {
      const orientMatch = bodyText.match(/(?:orientation|exposition)\s*:?\s*([NSEW]{1,3})/i);
      if (orientMatch) {
        console.log(`  Trouvé orientation: ${orientMatch[1]}`);
        data.orientation = orientMatch[1].toUpperCase();
      }
    }
    
    if (!data.niveau_min) {
      const niveauMatch = bodyText.match(/niveau\s*:?\s*(\d[a-c]?\+?)\s*(?:à|[-–])\s*(\d[a-c]?\+?)/i);
      if (niveauMatch) {
        console.log(`  Trouvé niveaux: ${niveauMatch[1]} à ${niveauMatch[2]}`);
        data.niveau_min = niveauMatch[1];
        data.niveau_max = niveauMatch[2];
      }
    }
    
    // Affichage du résultat
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSULTAT DE L\'EXTRACTION:');
    console.log('='.repeat(50));
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(50));
    
    // Analyse
    console.log('\n🔬 ANALYSE:');
    if (data.orientation) {
      console.log(`  ✅ Orientation trouvée: ${data.orientation}`);
    } else {
      console.log(`  ❌ Orientation non trouvée`);
    }
    
    if (data.niveau_min && data.niveau_max) {
      console.log(`  ✅ Niveaux trouvés: ${data.niveau_min} à ${data.niveau_max}`);
    } else {
      console.log(`  ❌ Niveaux non trouvés`);
    }
    
    // Debug: afficher quelques éléments HTML pour comprendre la structure
    console.log('\n🔧 DEBUG - Structure de la page:');
    console.log(`  - Nombre de <dt>: ${$('dt').length}`);
    console.log(`  - Nombre de <table>: ${$('table').length}`);
    console.log(`  - Nombre de <dl>: ${$('dl').length}`);
    
    // Afficher les premiers dt/dd
    console.log('\n  Premiers éléments dt/dd trouvés:');
    $('dt').slice(0, 5).each((i, elem) => {
      const dt = $(elem).text().trim();
      const dd = $(elem).next('dd').text().trim();
      console.log(`    ${dt}: ${dd}`);
    });
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    throw error;
  }
}

// Exécution du test
console.log('🚀 Démarrage du test d\'extraction\n');
testExtraction(TEST_URL)
  .then(() => {
    console.log('\n✅ Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test échoué:', error);
    process.exit(1);
  });
