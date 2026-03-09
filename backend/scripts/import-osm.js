/**
 * Import des spots d'escalade depuis OpenStreetMap (Overpass API)
 *
 * Usage:
 *   node scripts/import-osm.js                  → France entière
 *   node scripts/import-osm.js --bbox=43,1,46,7 → bbox custom (minLat,minLng,maxLat,maxLng)
 *   node scripts/import-osm.js --dry-run         → affiche sans insérer
 *
 * Les spots existants à moins de 100m sont ignorés (déduplication).
 */

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

/* ── Config ─────────────────────────────────────────────────── */
const DRY_RUN     = process.argv.includes("--dry-run");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME     = process.env.DB_NAME     || "ZoneDeGrimpe";
const DEDUP_RADIUS_M = 100; // ignore si un spot existe à moins de 100m

// BBox : France métropolitaine par défaut
const DEFAULT_BBOX = "41.3,-5.2,51.1,9.6"; // minLat,minLng,maxLat,maxLng

const bboxArg = process.argv.find(a => a.startsWith("--bbox="));
const BBOX = bboxArg ? bboxArg.split("=")[1] : DEFAULT_BBOX;

/* ── Overpass query ──────────────────────────────────────────── */
function buildOverpassQuery(bbox) {
  const [minLat, minLng, maxLat, maxLng] = bbox.split(",");
  const box = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `
[out:json][timeout:120];
(
  node["sport"="climbing"](${box});
  way["sport"="climbing"](${box});
  relation["sport"="climbing"](${box});
);
out center tags;
  `.trim();
}

async function fetchOverpass(query) {
  console.log("📡 Requête Overpass API...");
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method : "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body   : `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  console.log(`✅ ${json.elements.length} éléments OSM reçus`);
  return json.elements;
}

/* ── Mapping OSM → modèle ZoneDeGrimpe ──────────────────────── */
function mapType(tags) {
  const ct = (tags["climbing:type"] || "").toLowerCase();
  if (ct === "boulder" || ct === "bouldering") return { type: "boulder", soustype: "bloc" };
  if (ct === "indoor"  || tags.leisure === "sports_centre") return { type: "indoor", soustype: null };
  return { type: "crag", soustype: "diff" };
}

function mapOrientation(tags) {
  const raw = (tags["orientation"] || tags["climbing:orientation"] || "").toUpperCase().trim();
  const valid = new Set(["N","S","E","O","NE","SE","SO","NO","NW","SW","W"]);
  const normalize = { "W": "O", "NW": "NO", "SW": "SO" };
  return normalize[raw] ?? (valid.has(raw) ? raw : null);
}

function osmToSpot(el) {
  const tags = el.tags || {};
  const name = tags.name || tags["name:fr"] || null;
  if (!name) return null; // ignore les spots sans nom

  // Coordonnées (way/relation → center, node → directement)
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!lat || !lng) return null;

  const { type, soustype } = mapType(tags);

  return {
    name,
    location: { type: "Point", coordinates: [lng, lat] },
    type,
    soustype,
    niveau_min : tags["climbing:grade:french:min"] || null,
    niveau_max : tags["climbing:grade:french:max"] || null,
    orientation: mapOrientation(tags),
    url        : tags.website || tags.url || null,
    description: tags.description || null,
    id_voix    : [],
    info_complementaires: {
      rock: tags["climbing:rock"] || null,
    },
    source     : "osm",
    osm_id     : `${el.type}/${el.id}`,
    createdAt  : new Date(),
  };
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  console.log(`\n=== Import OSM → ZoneDeGrimpe ===`);
  console.log(`BBox       : ${BBOX}`);
  console.log(`Dry run    : ${DRY_RUN}`);
  console.log(`Dédup rayon: ${DEDUP_RADIUS_M}m\n`);

  const elements = await fetchOverpass(buildOverpassQuery(BBOX));

  // Convertir
  const candidates = elements.map(osmToSpot).filter(Boolean);
  console.log(`🗺️  ${candidates.length} spots mappés (nom + coords valides)`);

  if (!candidates.length) { console.log("Rien à insérer."); return; }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db     = client.db(DB_NAME);
  const coll   = db.collection("climbing_spot");

  let inserted = 0, skipped = 0, errors = 0;

  for (const spot of candidates) {
    try {
      // Dédup géographique : existe-t-il un spot à moins de DEDUP_RADIUS_M mètres ?
      const nearby = await coll.findOne({
        location: {
          $near: {
            $geometry  : spot.location,
            $maxDistance: DEDUP_RADIUS_M,
          },
        },
      });

      if (nearby) {
        skipped++;
        continue;
      }

      if (!DRY_RUN) {
        await coll.insertOne(spot);
      } else {
        console.log(`[DRY] Insérerait : ${spot.name} (${spot.type}) [${spot.location.coordinates}]`);
      }
      inserted++;
    } catch (err) {
      console.error(`  ❌ ${spot.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Résumé ===`);
  console.log(`Candidats  : ${candidates.length}`);
  console.log(`Insérés    : ${inserted}${DRY_RUN ? " (dry run, non réel)" : ""}`);
  console.log(`Ignorés    : ${skipped} (déjà présents à < ${DEDUP_RADIUS_M}m)`);
  console.log(`Erreurs    : ${errors}`);

  await client.close();
}

main().catch(err => { console.error("CRASH:", err); process.exit(1); });
