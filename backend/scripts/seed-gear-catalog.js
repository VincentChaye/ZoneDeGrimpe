/**
 * Seed du catalogue matériel (materiel_specs)
 *
 * Usage:
 *   node scripts/seed-gear-catalog.js           → insère les modèles manquants
 *   node scripts/seed-gear-catalog.js --dry-run → affiche sans insérer
 *
 * Les doublons (même brand+model) sont ignorés grâce à l'index unique.
 */

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────────────────
//  Catalogue de référence — Matériel d'escalade
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG = [

  // ═══════════════════════════════════════════════════════════════════════════
  //  CORDES
  // ═══════════════════════════════════════════════════════════════════════════

  // — Cordes à simple —
  { category: "rope", brand: "Petzl",         model: "Volta 9.2 mm",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple ultra-légère 9.2 mm avec traitement UltraSonic pour un gainage compact. Idéale falaise et grande voie. Poids : 54 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Petzl",         model: "Contact 9.8 mm",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple polyvalente 9.8 mm, excellent rapport résistance/poids. Traitement EverDry. Poids : 62 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Petzl",         model: "Arial 9.5 mm",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.5 mm pour la falaise sportive, bon compromis poids/durabilité. Poids : 58 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Beal",          model: "Virus 10 mm",             uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 10 mm très résistante à l'abrasion, parfaite pour débuter ou salle. Traitement Unicore. Poids : 65 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Beal",          model: "Stinger III 9.4 mm",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple performante 9.4 mm avec traitement Dry Cover. 5 chutes UIAA. Poids : 58 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Beal",          model: "Opéra 8.5 mm Unicore",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à double/jumelée ultra-légère 8.5 mm. Technologie Unicore anti-glissement de gaine. Poids : 48 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Beal",          model: "Booster III 9.7 mm",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple robuste 9.7 mm, traitement Dry Cover. Idéale falaise sportive. Poids : 61 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Black Diamond", model: "9.4 Dry",                 uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.4 mm avec traitement 2× Dry, polyvalente falaise et grande voie. Poids : 58 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Black Diamond", model: "9.9 Rope",                uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.9 mm, corde de travail robuste et abordable pour salle et falaise. Poids : 64 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Black Diamond", model: "7.0 Dry",                 uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde jumelée 7.0 mm, ultra-légère pour l'alpinisme et les grandes courses. Poids : 37 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Mammut",        model: "9.5 Crag Classic",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.5 mm, corde classique pour la falaise avec excellent glissement. Poids : 59 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Mammut",        model: "9.9 Gym Workhorse Classic", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.9 mm spécialement conçue pour la salle, très résistante à l'abrasion. Poids : 66 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Mammut",        model: "Infinity Dry 9.5 mm",     uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.5 mm avec traitement Dry pour l'utilisation en extérieur. Polyvalente falaise/grande voie. Poids : 58 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Mammut",        model: "8.0 Alpine Dry",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à double 8.0 mm pour l'alpinisme technique, traitement Dry. Poids : 42 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Edelrid",       model: "Boa 9.8 mm",              uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.8 mm, robuste et polyvalente avec traitement Thermo Shield. Certifiée Bluesign. Poids : 63 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Edelrid",       model: "Tommy Caldwell Pro Dry DT 9.6 mm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple haut de gamme 9.6 mm, triple certification simple/double/jumelée. Poids : 61 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Edelrid",       model: "Swift Protect Pro Dry 8.9 mm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple ultralégère 8.9 mm avec gaine renforcée aux extrémités. Poids : 52 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Tendon",        model: "Master 9.7 mm",           uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.7 mm polyvalente, bon rapport qualité/prix pour la falaise. Poids : 63 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Tendon",        model: "Ambition 10.0 mm",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 10 mm robuste, idéale pour la salle et les débuts en falaise. Poids : 66 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Millet",        model: "Rubix 9.4 mm",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 9.4 mm performante pour la falaise sportive, traitement Dry. Poids : 57 g/m.",
    imageUrl: null },
  { category: "rope", brand: "Simond",        model: "Edge 8.9 mm Dry",         uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 8.9 mm légère et abordable, traitement Dry. Poids : 52 g/m. Décathlon.",
    imageUrl: null },
  { category: "rope", brand: "Simond",        model: "Rock 10 mm",              uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde à simple 10 mm robuste et abordable pour la salle et la falaise. Poids : 66 g/m. Décathlon.",
    imageUrl: null },

  // — Cordes statiques / semi-statiques —
  { category: "rope", brand: "Petzl",         model: "Axis 11 mm",              uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde semi-statique 11 mm pour spéléo, travaux en hauteur et rappel. Type A EN 1891.",
    imageUrl: null },
  { category: "rope", brand: "Beal",          model: "Access Unicore 10.5 mm",  uiaaLifetimeYears: 10, epiTracked: true,
    description: "Corde semi-statique 10.5 mm pour via ferrata, canyoning et secours. Technologie Unicore.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  DÉGAINES
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "quickdraw", brand: "Petzl",         model: "Spirit Express 12 cm",     uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine légère et ergonomique, mousqueton Spirit à doigt fil, sangle 12 cm. 105 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/0686800000B8ItAAAV" },
  { category: "quickdraw", brand: "Petzl",         model: "Spirit Express 17 cm",     uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine Spirit avec sangle longue 17 cm pour réduire le tirage. 110 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Petzl",         model: "Ange Finesse 10 cm",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine ultra-légère avec mousqueton Ange à doigt coudé. 75 g. Pour la performance.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068w0000001OmcwAAC" },
  { category: "quickdraw", brand: "Black Diamond", model: "Positron Quickdraw 12 cm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine polyvalente avec mousquetons Positron et sangle Dynex 12 cm. 97 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Black Diamond", model: "HotForge Quickdraw 12 cm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine performante avec mousqueton HotForge forgé à chaud, doigt fil. 90 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Black Diamond", model: "FreeWire Quickdraw 12 cm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine économique et fiable pour la falaise sportive. 111 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Wild Country",  model: "Helium 3 Sport 12 cm",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine ultra-légère Hot Forged, mousqueton doigt fil. 76 g. Performance en tête.",
    imageUrl: null },
  { category: "quickdraw", brand: "DMM",            model: "Alpha Sport 12 cm",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine légère et ergonomique, excellent rapport qualité/poids. 85 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "DMM",            model: "Shadow Quickdraw 12 cm",  uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine haut de gamme ultra-légère avec mousquetons Shadow. 68 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Mammut",         model: "Crag Express 12 cm",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine robuste et polyvalente pour la falaise. 98 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Mammut",         model: "Crag Keylock Express 12 cm", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine avec système Keylock anti-accrochage. Polyvalente. 106 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Edelrid",        model: "Slash Wire Set 10 cm",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine minimaliste et ultra-légère, doigt fil. 77 g. Performance compétition.",
    imageUrl: null },
  { category: "quickdraw", brand: "Camp",           model: "Photon Express 11 cm",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine ultra-légère italienne avec mousquetons Photon. 73 g.",
    imageUrl: null },
  { category: "quickdraw", brand: "Simond",         model: "Rocky 12 cm",             uiaaLifetimeYears: 10, epiTracked: true,
    description: "Dégaine polyvalente et abordable, sangle 12 cm. Décathlon. 106 g.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ASSUREURS AUTOBLOQUANTS (Grigri & co.)
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "belay_auto", brand: "Petzl",         model: "Grigri",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur à came assistée pour corde simple ∅8.5–11 mm. Référence mondiale. 175 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000I6N6TIAV" },
  { category: "belay_auto", brand: "Petzl",         model: "Grigri+",          uiaaLifetimeYears: null, epiTracked: false,
    description: "Version évoluée du Grigri avec mode anti-panique et poignée Top. Corde ∅8.5–11 mm. 200 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000ClPsEIAV" },
  { category: "belay_auto", brand: "Petzl",         model: "Neox",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur assisté nouvelle génération à came excentrique, assurage intuitif. Corde ∅8.5–11 mm. 210 g.",
    imageUrl: null },
  { category: "belay_auto", brand: "Edelrid",       model: "Mega Jul",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur assisté léger et polyvalent, compatible corde simple et double ∅7.8–10.5 mm. 65 g.",
    imageUrl: null },
  { category: "belay_auto", brand: "Mammut",        model: "Smart 2.0",        uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur assisté compact et fiable, corde ∅8.7–10.5 mm. Système de freinage mécanique. 75 g.",
    imageUrl: null },
  { category: "belay_auto", brand: "Black Diamond", model: "ATC Pilot",        uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur assisté avec système à came, corde ∅8.5–10.5 mm. 100 g.",
    imageUrl: null },
  { category: "belay_auto", brand: "Climbing Technology", model: "Click Up+",  uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur assisté ergonomique et intuitif, mousqueton dédié inclus. Corde ∅8.5–10.5 mm. 225 g.",
    imageUrl: null },
  { category: "belay_auto", brand: "Trango",        model: "Vergo",            uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur auto-freinant, système à pression pour la moulinette. Corde ∅9–11 mm. 260 g.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  PLAQUETTES D'ASSURAGE (tube / panier)
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "belay_tube", brand: "Petzl",         model: "Reverso",          uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette d'assurage polyvalente avec mode autobloquant en relais. Simple et double ∅7.7–10.5 mm. 59 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/0681r000004zMlxAAE" },
  { category: "belay_tube", brand: "Petzl",         model: "Verso",            uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur tubulaire ultra-léger et compact, idéal pour débuter. Simple ∅8.5–10.5 mm. 58 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Black Diamond", model: "ATC Guide",        uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette tubulaire avec mode guide pour moulinette au relais. Simple et double ∅7.7–11 mm. 77 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Black Diamond", model: "ATC",              uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette tubulaire classique et fiable. Simple et double ∅7.7–11 mm. 71 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Black Diamond", model: "ATC Alpine Guide",uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette ultra-légère pour l'alpinisme avec mode guide. 55 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Edelrid",       model: "Jul²",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette d'assurage légère et polyvalente corde simple et double. 80 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Camp",          model: "Ovo",              uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette compacte et légère, design italien minimaliste. 46 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "DMM",           model: "Mantis",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Plaquette tubulaire avec mode guide, technologie Hot Forged. 55 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Mammut",        model: "Crag Light Belay", uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur tubulaire léger avec mode auto-bloquant au relais. 60 g.",
    imageUrl: null },
  { category: "belay_tube", brand: "Simond",        model: "Toucan",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Assureur tubulaire abordable pour salle et falaise. Décathlon. 72 g.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  BAUDRIERS
  // ═══════════════════════════════════════════════════════════════════════════
  // — Hommes / unisexe —
  { category: "harness", brand: "Petzl",         model: "Corax",                uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier polyvalent FrameAdapt réglable, taille 1 à 3. Idéal pour débuter. 375 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/0686800000Y6DAEAA3" },
  { category: "harness", brand: "Petzl",         model: "Adjama",               uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier sport haute performance, tours de cuisses FrameAdapt ajustables. 380 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx00000500RoIAI" },
  { category: "harness", brand: "Petzl",         model: "Sitta",                uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier ultra-léger haut de gamme, construction WireFrame™. 280 g. Performance compétition.",
    imageUrl: null },
  { category: "harness", brand: "Petzl",         model: "Sama",                 uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier sport confortable avec mousses EndoFrame. Tours de cuisses élastiques. 360 g.",
    imageUrl: null },
  { category: "harness", brand: "Black Diamond", model: "Momentum Homme",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier confortable avec trakFIT pour la salle et la falaise. Séchage rapide. 350 g.",
    imageUrl: "https://blackdiamondequipment.com/cdn/shop/files/650005_2018_M_MOMENTUM_HARNESS_Moonstone_01.jpg?v=1742402484" },
  { category: "harness", brand: "Black Diamond", model: "Solution Homme",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier sport avec mousse Kinetic Core et boucle fusible. Ultra-confortable. 330 g.",
    imageUrl: null },
  { category: "harness", brand: "Mammut",        model: "Ophir 3 Slide",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier léger avec slide-bloc pour réglage facile, toutes pratiques. 360 g.",
    imageUrl: null },
  { category: "harness", brand: "Mammut",        model: "Sender Fast Adjust",   uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier ultra-léger pour l'alpinisme, boucles Fast Adjust. 295 g.",
    imageUrl: null },
  { category: "harness", brand: "Edelrid",       model: "Jay III",              uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier polyvalent avec 3D-Vent, ventilation et confort optimaux. 370 g.",
    imageUrl: null },
  { category: "harness", brand: "Edelrid",       model: "Loopo III",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier sport minimaliste et ultra-léger en sangle. 250 g.",
    imageUrl: null },
  { category: "harness", brand: "Camp",          model: "Energy CR3",           uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier polyvalent léger avec tours de cuisses réglables. 330 g.",
    imageUrl: null },
  { category: "harness", brand: "Beal",          model: "Ghost",                uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier sport confortable et léger avec construction bi-matière. 340 g.",
    imageUrl: null },
  { category: "harness", brand: "Simond",        model: "Rock",                 uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier polyvalent et abordable pour la salle et la falaise. Décathlon. 380 g.",
    imageUrl: null },
  // — Femmes —
  { category: "harness", brand: "Petzl",         model: "Selena",               uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier femme sport avec EndoFrame, coupe adaptée à la morphologie féminine. 350 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx000005iCdhIAE" },
  { category: "harness", brand: "Petzl",         model: "Luna",                 uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier femme polyvalent, tours de cuisses FrameAdapt réglables. 360 g.",
    imageUrl: null },
  { category: "harness", brand: "Black Diamond", model: "Momentum Femme",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier femme confortable avec trakFIT et coupe féminine. 340 g.",
    imageUrl: null },
  { category: "harness", brand: "Edelrid",       model: "Jayne III",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier femme polyvalent avec 3D-Vent et coupe ergonomique. 360 g.",
    imageUrl: null },
  { category: "harness", brand: "Mammut",        model: "Ophir Speedfit Femme", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Baudrier femme avec slide-bloc, coupe spécifique féminine. 340 g.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  CHAUSSONS
  // ═══════════════════════════════════════════════════════════════════════════
  // — Débutant / confort —
  { category: "shoes", brand: "La Sportiva",   model: "Mythos",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet très confortable, tige en cuir souple. Idéal pour les grandes voies et les longs runs. Gomme Vibram XS Edge.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "Tarantulace",      uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet d'entrée de gamme, confortable et polyvalent. Parfait pour débuter. Gomme FriXion RS.",
    imageUrl: null },
  { category: "shoes", brand: "Scarpa",        model: "Origin",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet confortable pour la salle et la falaise, idéal débutant. Gomme Vision.",
    imageUrl: null },
  { category: "shoes", brand: "Simond",        model: "Rock",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet abordable pour découvrir l'escalade. Décathlon. Gomme Vibram XS Grip 2.",
    imageUrl: null },
  { category: "shoes", brand: "Evolv",         model: "Defy Lace",        uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet polyvalent et confortable, bon pour la salle. Gomme TRAX SAS.",
    imageUrl: null },
  // — Polyvalent —
  { category: "shoes", brand: "La Sportiva",   model: "Katana Lace",      uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet performant et polyvalent, excellent en falaise et bloc. Gomme Vibram XS Edge.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "TC Pro",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson grande voie par excellence, tige haute protectrice. Gomme Vibram XS Edge. Signature Tommy Caldwell.",
    imageUrl: null },
  { category: "shoes", brand: "Scarpa",        model: "Maestro Mid Eco",  uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson mid-cut confortable et performant pour la grande voie. Gomme Vibram XS Edge, construction éco-responsable.",
    imageUrl: null },
  { category: "shoes", brand: "Scarpa",        model: "Veloce",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro polyvalent pour salle et falaise, confort et performance. Gomme Vision.",
    imageUrl: null },
  { category: "shoes", brand: "Black Diamond", model: "Momentum Lace",    uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet polyvalent salle et falaise, construction Engineered Knit. Confortable et respirant.",
    imageUrl: null },
  // — Performance / agressif —
  { category: "shoes", brand: "La Sportiva",   model: "Solution Comp",    uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro agressif pour le bloc et la compétition. Gomme Vibram XS Grip 2. Ultra-précis.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "Solution",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro agressif légendaire pour le dévers et les toits. Gomme Vibram XS Edge.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "Skwama",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro sensible et technique pour le bloc, asymétrique. Gomme Vibram XS Grip 2.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "Theory",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet technique haut de gamme pour le bloc et la performance. Gomme Vibram XS Grip 2.",
    imageUrl: null },
  { category: "shoes", brand: "La Sportiva",   model: "Futura",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson no-edge innovant, adhérence naturelle. Gomme Vibram XS Grip 2. Pour le bloc technique.",
    imageUrl: null },
  { category: "shoes", brand: "Scarpa",        model: "Instinct VS",      uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro très précis pour le bloc et la falaise technique. Gomme Vibram XS Edge.",
    imageUrl: null },
  { category: "shoes", brand: "Scarpa",        model: "Drago LV",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet agressif bas volume pour les pieds fins. Gomme Vibram XS Grip 2.",
    imageUrl: null },
  { category: "shoes", brand: "Five Ten",      model: "Hiangle Pro",      uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson compétition agressif avec gomme Stealth C4, crochetage puissant.",
    imageUrl: null },
  { category: "shoes", brand: "Five Ten",      model: "Aleon",            uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet performant pour le bloc et la falaise. Gomme Stealth C4.",
    imageUrl: null },
  { category: "shoes", brand: "Evolv",         model: "Shaman 2",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro polyvalent haute performance, Love Bump pour le dévers. Gomme TRAX SAS.",
    imageUrl: null },
  { category: "shoes", brand: "Evolv",         model: "Phantom",          uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet ultra-sensible pour le bloc technique et les microprises. Gomme TRAX SAS.",
    imageUrl: null },
  { category: "shoes", brand: "Unparallel",    model: "Flagship",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson lacet haut de gamme pour la performance extrême en bloc. Gomme RH.",
    imageUrl: null },
  { category: "shoes", brand: "Boreal",        model: "Alpha",            uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro polyvalent et confortable, bon rapport qualité/prix. Gomme Zenith.",
    imageUrl: null },
  { category: "shoes", brand: "Tenaya",        model: "Iati",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Chausson velcro polyvalent, grande sensibilité et bon accrochage. Gomme Vibram XS Grip 2.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MOUSQUETONS
  // ═══════════════════════════════════════════════════════════════════════════
  // — HMS (poire) —
  { category: "carabiner", brand: "Petzl",         model: "William Screw-Lock",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS poire à vis, grande ouverture pour l'assurage. 85 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Petzl",         model: "William Ball-Lock",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS à verrouillage automatique par bille. Idéal assurage intensif. 90 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Black Diamond", model: "GridLock Screwgate",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS avec système GridLock anti-retournement. Idéal pour l'assurage. 86 g.",
    imageUrl: null },
  { category: "carabiner", brand: "DMM",            model: "Rhino Screwgate",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS large à vis, excellent pour l'assurage et le demi-cabestan. 82 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Mammut",         model: "Bionic HMS Screw Gate",  uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS fluide et léger, parfait pour l'assurage. 80 g.",
    imageUrl: null },
  // — D / D asymétrique —
  { category: "carabiner", brand: "Petzl",         model: "Attache Screw-Lock",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D à vis compact et polyvalent, forme Attache ergonomique. 80 g.",
    imageUrl: "https://www.petzl.com/sfc/servlet.shepherd/version/download/068Tx000002Hnj7IAC" },
  { category: "carabiner", brand: "Petzl",         model: "Am'D Ball-Lock",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D asymétrique à verrouillage automatique, forme Am'D. Polyvalent. 75 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Petzl",         model: "Sm'D Screw-Lock",         uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D compact à vis avec nez Keylock, pour relais et longe. 60 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Black Diamond", model: "RockLock Screwgate",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D poire à vis, grande ouverture. Polyvalent et robuste. 88 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Black Diamond", model: "Oval Screwgate",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton ovale à vis, idéal pour les poulies et les bloqueurs. 79 g.",
    imageUrl: null },
  { category: "carabiner", brand: "DMM",            model: "Phantom Screwgate",      uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D ultra-léger Hot Forged à vis. 38 g. Pour alléger le rack.",
    imageUrl: null },
  { category: "carabiner", brand: "Wild Country",   model: "Ascent Screwgate",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D asymétrique à vis, Hot Forged, nez Keylock. 63 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Camp",           model: "Core Lock",              uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton D à verrouillage automatique twist-lock, compact. 73 g.",
    imageUrl: null },
  // — Sans verrouillage (doigt fil / doigt plein) —
  { category: "carabiner", brand: "Petzl",         model: "Spirit",                  uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton doigt fil ergonomique, Keylock. Pour dégaines ou en vrac. 38 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Petzl",         model: "Djinn Axess",             uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton doigt plein solide, Keylock. Pour les dégaines et relais. 45 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Black Diamond", model: "Positron",                uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton doigt fil léger et fluide, nez Keylock. 40 g.",
    imageUrl: null },
  { category: "carabiner", brand: "DMM",            model: "Alpha Light",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton doigt fil ultra-léger, Hot Forged. 27 g.",
    imageUrl: null },
  { category: "carabiner", brand: "Simond",         model: "Rocky HMS Twist-Lock",   uiaaLifetimeYears: 10, epiTracked: true,
    description: "Mousqueton HMS auto-lock abordable, idéal pour l'assurage. Décathlon. 84 g.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MACHARDS (cordelettes & anneaux autobloquants)
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "machard", brand: "Beal",         model: "Cordelette 6 mm (5.5 m)",     uiaaLifetimeYears: 10, epiTracked: true,
    description: "Cordelette en nylon 6 mm, longueur 5.5 m. Pour nœuds autobloquants (machard, prussik). Résistance 900 kg.",
    imageUrl: null },
  { category: "machard", brand: "Beal",         model: "Cordelette 7 mm (4 m)",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Cordelette en nylon 7 mm, longueur 4 m. Pour autobloquants robustes et anneaux de rappel.",
    imageUrl: null },
  { category: "machard", brand: "Beal",         model: "Dyneema Slings 120 cm",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Anneau cousu Dyneema 120 cm, ultra-résistant et léger. Pour relais et autobloquant. 22 kN.",
    imageUrl: null },
  { category: "machard", brand: "Petzl",        model: "Anneau Cordage 60 cm",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Anneau de cordelette cousu 60 cm pour autobloquants. Certifié EN 795. 60 g.",
    imageUrl: null },
  { category: "machard", brand: "Petzl",        model: "Anneau Cordage 120 cm",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Anneau de cordelette cousu 120 cm pour relais et autobloquants longs. Certifié EN 795.",
    imageUrl: null },
  { category: "machard", brand: "Mammut",       model: "Contact Sling 8.0 60 cm",     uiaaLifetimeYears: 10, epiTracked: true,
    description: "Sangle tubulaire Nylon 8 mm, 60 cm. Polyvalente pour relais et autobloquants. 22 kN.",
    imageUrl: null },
  { category: "machard", brand: "Mammut",       model: "Contact Sling 8.0 120 cm",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Sangle tubulaire Nylon 8 mm, 120 cm. Pour relais, sangles longues et autobloquants.",
    imageUrl: null },
  { category: "machard", brand: "DMM",          model: "Dyneema Sling 11 mm 60 cm",   uiaaLifetimeYears: 10, epiTracked: true,
    description: "Anneau cousu Dyneema 11 mm, 60 cm, ultra-léger 17 g. Résistance 22 kN.",
    imageUrl: null },
  { category: "machard", brand: "DMM",          model: "Dyneema Sling 11 mm 120 cm",  uiaaLifetimeYears: 10, epiTracked: true,
    description: "Anneau cousu Dyneema 11 mm, 120 cm, ultra-léger 34 g. Pour relais rapides.",
    imageUrl: null },
  { category: "machard", brand: "Black Diamond",model: "Nylon Runner 16 mm 60 cm",    uiaaLifetimeYears: 10, epiTracked: true,
    description: "Sangle nylon 16 mm, 60 cm. Polyvalente pour relais et dégaines longues. 22 kN.",
    imageUrl: null },
  { category: "machard", brand: "Black Diamond",model: "Nylon Runner 16 mm 120 cm",   uiaaLifetimeYears: 10, epiTracked: true,
    description: "Sangle nylon 16 mm, 120 cm. Pour relais et réduction de tirage. 22 kN.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  CRASHPADS
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "crashpad", brand: "Black Diamond", model: "Impact",            uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad grand format 110×110 cm, mousse PE bizone. Fermeture taco-style avec sangles de portage confortables. 6.2 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Black Diamond", model: "Drop Zone",         uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad compact 104×89 cm, bon rapport taille/prix pour le bloc ponctuel. 4.7 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Black Diamond", model: "Mondo",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad géant 152×114 cm, surface maximale pour les blocs hauts et les rétablissements. 8.6 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Petzl",         model: "Alto",              uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad compact 110×100 cm, mousse bizone épaisse. Portage sac à dos avec bretelles réglables. 5.5 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Petzl",         model: "Cirro",             uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad grande surface 139×100 cm, mousse triple densité. Portage confortable. 6.8 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Mammut",        model: "Crashiano Pad",     uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad 120×100 cm, mousse bizone. Système de portage avec ceinture ventrale. 5.5 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Beal",          model: "Air Pad",           uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad léger 100×100 cm, mousse double densité. Portage sac à dos intégré. 4.2 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Beal",          model: "Double Air Bag",    uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad double surface 130×100 cm, mousse triple densité. Portage sac à dos. 7.3 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Ocun",          model: "Paddy Dominator",   uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad grand format 130×100 cm, mousse triple densité. Portage confortable. 6.5 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Moon Climbing", model: "Warrior Crash Pad", uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad 125×100 cm, mousse haute performance, produit au Royaume-Uni. 6.8 kg.",
    imageUrl: null },
  { category: "crashpad", brand: "Simond",        model: "Crashpad R500",     uiaaLifetimeYears: null, epiTracked: false,
    description: "Crashpad abordable 130×100 cm, mousse bizone. Décathlon. Portage sac à dos. 5.8 kg.",
    imageUrl: null },

  // ═══════════════════════════════════════════════════════════════════════════
  //  MAILLONS RAPIDES
  // ═══════════════════════════════════════════════════════════════════════════
  { category: "quicklink", brand: "Petzl",          model: "Maillon Rapide N° 7 Delta",       uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta acier, ouverture 10 mm. Pour relais semi-permanents et rappel. 25 kN. 73 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Petzl",          model: "Maillon Rapide N° 8 Demi-Rond",   uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide demi-rond acier 8 mm. Usage ancrage et connexion. 25 kN. 56 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Petzl",          model: "Maillon Rapide N° 3.5 Go",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta aluminium, ultra-léger. Pour relais allégés et alpin. 25 kN. 32 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Camp",           model: "Maillon Delta Zinc 10 mm",        uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta acier zingué, ouverture 10 mm. Robuste et économique. 25 kN. 76 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Camp",           model: "Maillon Oval Zinc 8 mm",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide ovale acier zingué 8 mm. Pour poulie et bloqueur. 25 kN. 55 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Kong",           model: "Quick Link Delta 10 mm",          uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta acier inox, ouverture 10 mm. Résistant à la corrosion. 25 kN. 82 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Kong",           model: "Quick Link Oval 8 mm",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide ovale acier inox 8 mm. Usage polyvalent et durable. 25 kN. 58 g.",
    imageUrl: null },
  { category: "quicklink", brand: "DMM",            model: "Maillon Rapide Delta",            uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta acier 10 mm, certifié CE/UIAA. Pour relais et ancrage. 25 kN. 70 g.",
    imageUrl: null },
  { category: "quicklink", brand: "Fixe",           model: "Maillon Rapide Delta 10 mm Inox", uiaaLifetimeYears: 10, epiTracked: true,
    description: "Maillon rapide delta inox 10 mm, conçu pour l'équipement de voies en extérieur. Résistant UV et corrosion. 25 kN.",
    imageUrl: null },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error("❌  MONGODB_URI absent du .env"); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db   = client.db("ZoneDeGrimpe");
  const col  = db.collection("materiel_specs");

  console.log(`\n📦  Seed catalogue matériel${DRY_RUN ? " (dry-run)" : ""}`);
  console.log(`   ${CATALOG.length} modèles à traiter…\n`);

  // Stats par catégorie
  const stats = {};
  for (const item of CATALOG) {
    stats[item.category] = (stats[item.category] || 0) + 1;
  }
  console.log("   Répartition :");
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`     ${cat.padEnd(12)} ${count}`);
  }
  console.log();

  let inserted = 0, skipped = 0, withImage = 0;
  const now = new Date();

  for (const item of CATALOG) {
    const exists = await col.findOne({ brand: item.brand, model: item.model });
    if (exists) {
      console.log(`   ⏭  [skip]     ${item.category.padEnd(12)} ${item.brand} ${item.model}`);
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      await col.insertOne({ ...item, createdBy: { uid: "seed" }, createdAt: now, updatedAt: now });
    }
    const imgFlag = item.imageUrl ? "📷" : "  ";
    console.log(`   ✅  [insert] ${imgFlag} ${item.category.padEnd(12)} ${item.brand} ${item.model}`);
    inserted++;
    if (item.imageUrl) withImage++;
  }

  console.log(`\n✔  Terminé : ${inserted} insérés (${withImage} avec photo), ${skipped} ignorés (déjà présents)\n`);
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
