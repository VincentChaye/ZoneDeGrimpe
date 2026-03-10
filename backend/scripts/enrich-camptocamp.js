import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIGURATION ---
const DRY_RUN = false;
const BATCH_SIZE = 200;
const DELAY_MS = 600;
const SEARCH_RADIUS_M = 3000;   // Rayon de recherche autour de chaque spot (mètres mercator)
const MAX_DISTANCE_KM = 2.0;    // Distance max pour valider un match

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const client = new MongoClient(process.env.MONGODB_URI);

// WGS84 → EPSG:3857
function toMercator(lng, lat) {
    const x = (lng / 180) * 20037508.34;
    const y = Math.log(Math.tan(((lat + 90) * Math.PI) / 360)) * (20037508.34 / Math.PI);
    return { x, y };
}

// EPSG:3857 → WGS84
function fromMercator(x, y) {
    const lng = (x / 20037508.34) * 180;
    const lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
    return { lat, lng };
}

// Distance en km (Haversine)
function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Mapping type camptocamp → notre format
function mapType(wtype) {
    if (wtype === "climbing_outdoor") return "crag";
    if (wtype === "climbing_indoor") return "indoor";
    if (wtype === "bouldering") return "boulder";
    return null;
}

function normalizeOrientation(o) {
    const map = { W: "O", SW: "SO", NW: "NO" };
    return map[o] || o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Recherche par bbox autour de coordonnées
async function searchByCoords(lng, lat) {
    const { x, y } = toMercator(lng, lat);
    const r = SEARCH_RADIUS_M;
    const bbox = `${x - r},${y - r},${x + r},${y + r}`;
    const url = `https://api.camptocamp.org/waypoints?bbox=${bbox}&limit=20`;

    const res = await fetch(url, { headers: { "User-Agent": "ZoneDeGrimpe/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Filtrer uniquement les spots d'escalade
    const climbingTypes = ["climbing_outdoor", "climbing_indoor", "bouldering"];
    return (data.documents || []).filter(d => climbingTypes.includes(d.waypoint_type));
}

// Trouver le doc camptocamp le plus proche
function findBestMatch(docs, spotLat, spotLng) {
    let best = null;
    let bestDist = Infinity;

    for (const doc of docs) {
        try {
            const geom = JSON.parse(doc.geometry?.geom || "null");
            if (!geom?.coordinates) continue;
            const { lat, lng } = fromMercator(geom.coordinates[0], geom.coordinates[1]);
            const dist = distanceKm(spotLat, spotLng, lat, lng);
            if (dist < bestDist) {
                bestDist = dist;
                best = { doc, dist };
            }
        } catch {}
    }

    return best && best.dist <= MAX_DISTANCE_KM ? best : null;
}

// Extraire les données utiles d'un doc camptocamp
function extractData(doc) {
    const locale = doc.locales?.find((l) => l.lang === "fr") || doc.locales?.[0];
    const data = {};

    if (doc.climbing_rating_min) data.niveau_min = doc.climbing_rating_min;
    if (doc.climbing_rating_max) data.niveau_max = doc.climbing_rating_max;
    if (doc.orientations?.length) data.orientation = normalizeOrientation(doc.orientations[0]);
    const type = mapType(doc.waypoint_type);
    if (type) data.type = type;
    if (locale?.summary) data.description = locale.summary.slice(0, 500);

    return data;
}

async function main() {
    await client.connect();
    const db = client.db(process.env.DB_NAME || "ZoneDeGrimpe");
    const col = db.collection("climbing_spot");

    console.log("🏔️  Enrichissement depuis camptocamp.org (recherche par coordonnées GPS)");
    console.log(`   DRY_RUN: ${DRY_RUN} | Rayon: ${SEARCH_RADIUS_M}m | Match max: ${MAX_DISTANCE_KM}km\n`);

    const query = {
        camptocamp_processed: { $ne: true },
        "location.coordinates": { $exists: true }
    };

    const total = await col.countDocuments(query);
    console.log(`📦 ${total} spots à traiter\n`);

    let processed = 0, matched = 0, updated = 0;

    while (true) {
        const spots = await col.find(query).limit(BATCH_SIZE).toArray();
        if (!spots.length) break;

        const bulkOps = [];

        for (const spot of spots) {
            processed++;
            const [lng, lat] = spot.location?.coordinates || [];
            if (!lat || !lng) {
                bulkOps.push({ updateOne: { filter: { _id: spot._id }, update: { $set: { camptocamp_processed: true } } } });
                continue;
            }

            process.stdout.write(`[${processed}/${total}] ${spot.name}... `);

            try {
                const docs = await searchByCoords(lng, lat);
                const match = findBestMatch(docs, lat, lng);

                if (!match) {
                    console.log("❌ non trouvé");
                    bulkOps.push({ updateOne: { filter: { _id: spot._id }, update: { $set: { camptocamp_processed: true } } } });
                    await sleep(DELAY_MS);
                    continue;
                }

                matched++;
                const newData = extractData(match.doc);
                const setFields = { camptocamp_processed: true };

                if (newData.niveau_min && (!spot.niveau_min || spot.niveau_min === "")) setFields.niveau_min = newData.niveau_min;
                if (newData.niveau_max && (!spot.niveau_max || spot.niveau_max === "")) setFields.niveau_max = newData.niveau_max;
                if (newData.orientation && (!spot.orientation || spot.orientation === "")) {
                    setFields.orientation = newData.orientation;
                    setFields["info_complementaires.orientation"] = newData.orientation;
                }
                if (newData.type && (!spot.type || spot.type === "")) setFields.type = newData.type;
                if (newData.description && (!spot.description || spot.description === "")) setFields.description = newData.description;

                const fieldsUpdated = Object.keys(setFields).filter(k => k !== "camptocamp_processed" && k !== "info_complementaires.orientation");
                if (fieldsUpdated.length) {
                    updated++;
                    console.log(`✅ ${match.dist.toFixed(1)}km → ${fieldsUpdated.join(", ")}`);
                } else {
                    console.log(`✓ déjà complet`);
                }

                bulkOps.push({ updateOne: { filter: { _id: spot._id }, update: { $set: setFields } } });

            } catch (err) {
                console.log(`⚠️  ${err.message}`);
                bulkOps.push({ updateOne: { filter: { _id: spot._id }, update: { $set: { camptocamp_processed: true } } } });
            }

            await sleep(DELAY_MS);
        }

        if (bulkOps.length && !DRY_RUN) {
            await col.bulkWrite(bulkOps);
        }
    }

    console.log(`\n📊 Résumé :`);
    console.log(`   Traités   : ${processed}`);
    console.log(`   Matchés   : ${matched} (${Math.round(matched / processed * 100)}%)`);
    console.log(`   Mis à jour: ${updated}`);

    await client.close();
}

main().catch(console.error);
