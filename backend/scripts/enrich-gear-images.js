/**
 * Enrichissement des images du catalogue matériel (materiel_specs)
 *
 * Met à jour imageUrl pour les entrées existantes en base.
 * Idempotent : ne met à jour que les entrées sans image (imageUrl = null).
 *
 * Usage:
 *   node scripts/enrich-gear-images.js
 *   node scripts/enrich-gear-images.js --force   # re-écrit même les existantes
 */

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const FORCE = process.argv.includes("--force");

// ─────────────────────────────────────────────────────────────────────────────
//  Mapping brand + model → imageUrl
//  Sources : Black Diamond (Shopify CDN), Mammut (static CDN), Petzl (Salesforce CDN)
// ─────────────────────────────────────────────────────────────────────────────

const BD  = "https://cdn.shopify.com/s/files/1/0880/2195/8973/files/";
const PETZL = "https://www.petzl.com/sfc/servlet.shepherd/version/download/";
const MAMMUT = "https://static.mammut.com/cdn-cgi/image/width=800,quality=85,f=auto,metadata=none/master/";

const IMAGE_MAP = [

  // ── CORDES ──────────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "9.4 Dry",
    imageUrl: BD + "323126_9773_9.4_Dry_Rope_80_m_Yellow-Blue_01.jpg?v=1753285297" },
  { brand: "Black Diamond", model: "9.9 Rope",
    imageUrl: BD + "323040_DUBL_9.9_ROPE_DUAL_BLUE_01.jpg?v=1742402229" },
  { brand: "Black Diamond", model: "7.0 Dry",
    imageUrl: BD + "323120_3011_7.4_Dry_Rope_70_m_Envy_Green_01.jpg?v=1753373367" },
  { brand: "Mammut", model: "Infinity Dry 9.5 mm",
    imageUrl: MAMMUT + "2010-04320-11284_main-png_205812.png" },
  { brand: "Mammut", model: "9.5 Crag Classic",
    imageUrl: MAMMUT + "2010-04320-11284_main-png_205812.png" },

  // ── DÉGAINES ────────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "HotForge Quickdraw 12 cm",
    imageUrl: BD + "380002_0000_HOTFORGE_HYBRID_QUICKDRAW_10CM_NO_COLOR_01.jpg?v=1742402205" },
  { brand: "Black Diamond", model: "Positron Quickdraw 12 cm",
    imageUrl: BD + "380018_0000_POSITRON_SPORT_QUICKDRAW_NO_COLOR_01.jpg?v=1742402418" },

  // ── ASSUREURS AUTO ───────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "ATC Pilot",
    imageUrl: BD + "620087_0002_ATC_PILOT_BLACK_01_df727584-860e-473e-8adc-e46f080cbb5f.jpg" },

  // ── PLAQUETTES ───────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "ATC Guide",
    imageUrl: BD + "620046_0001_ATC_GUIDE_ANTHRACITE_01.jpg" },
  { brand: "Black Diamond", model: "ATC",
    imageUrl: BD + "620075_BLUE_ATC_XP_BLUE_01.jpg" },
  { brand: "Black Diamond", model: "ATC Alpine Guide",
    imageUrl: BD + "620047_3011_ATC_ALPINE_GUIDE_ENVY_GREEN_01.jpg" },

  // ── BAUDRIERS ────────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "Momentum Homme",
    imageUrl: BD + "650005_2018_M_MOMENTUM_HARNESS_Moonstone_01.jpg?v=1742402484" },
  { brand: "Black Diamond", model: "Momentum Femme",
    imageUrl: BD + "650004_9734_W_MOMENTUM_HARNESS_Foam_Green_Alloy_01.jpg?v=1742402456" },

  // ── CHAUSSONS ────────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "Momentum Lace",
    imageUrl: BD + "570005_9731_M_MOMENTUM_LACE_CLIMBING_SHOES_Moonstone_Black_01.jpg?v=1767917947" },

  // ── MOUSQUETONS ──────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "GridLock Screwgate",
    imageUrl: BD + "210164_1003_Gridlock_Screwgate_Carabiner_Gray_01.jpg?v=1773685028" },
  { brand: "Black Diamond", model: "RockLock Screwgate",
    imageUrl: BD + "210256_0002_ROCKLOCK_SCREWGATE_CARABINER_BLACK_01.jpg?v=1742402302" },
  { brand: "Black Diamond", model: "Oval Screwgate",
    imageUrl: BD + "210208_0013_OVAL_KEYLOCK_SCREWGATE_BINER_POLISHED_01.jpg?v=1742402255" },
  { brand: "Black Diamond", model: "Positron",
    imageUrl: BD + "210157_1004_HOTWIRE_CARABINER_LIGHT_GRAY_01.jpg?v=1742402265" },

  // ── MACHARDS ─────────────────────────────────────────────────────────────────
  { brand: "Black Diamond", model: "Nylon Runner 16 mm 60 cm",
    imageUrl: BD + "380025_0000_18MM_NYLON_RUNNER_30CM_NO_COLOR_01.jpg?v=1742402549" },
  { brand: "Black Diamond", model: "Nylon Runner 16 mm 120 cm",
    imageUrl: BD + "380025_0000_18MM_NYLON_RUNNER_30CM_NO_COLOR_01.jpg?v=1742402549" },

];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db    = client.db("ZoneDeGrimpe");
  const specs = db.collection("materiel_specs");

  let updated = 0, skipped = 0, notFound = 0;

  for (const { brand, model, imageUrl } of IMAGE_MAP) {
    const filter = { brand, model };
    const doc = await specs.findOne(filter);

    if (!doc) {
      console.log(`  ⚠  introuvable   ${brand} ${model}`);
      notFound++;
      continue;
    }

    if (doc.imageUrl && !FORCE) {
      console.log(`  ⏭  déjà une image ${brand} ${model}`);
      skipped++;
      continue;
    }

    await specs.updateOne(filter, { $set: { imageUrl, updatedAt: new Date() } });
    console.log(`  ✅  mis à jour    ${brand} ${model}`);
    updated++;
  }

  console.log(`\n✔  Terminé : ${updated} mis à jour, ${skipped} ignorés (déjà une image), ${notFound} introuvables`);
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
