import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// --- CONFIGURATION ---
const DRY_RUN = false;
const DB_BATCH_SIZE = 100;
const AI_CHUNK_SIZE = 5;        // Petit chunk pour le modèle local
const CONCURRENCY = 1;          // 1 seul thread (modèle local)
const OVERWRITE_LEVELS = false;
const OLLAMA_MODEL = "qwen2.5-coder:7b";
const OLLAMA_URL = "http://localhost:11434/api/generate";

// --- INIT ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("❌ Manque MONGODB_URI dans .env"); process.exit(1); }

const client = new MongoClient(uri);

async function askOllama(prompt) {
    const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            format: "json",
            stream: false,
            options: { temperature: 0.1 }
        })
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.response);
}

async function processAiChunk(spotsColl, spotsChunk, chunkIndex) {
    const spotsData = spotsChunk.map(s => ({
        _id: s._id.toString(),
        name: s.name,
        coords: s.location?.coordinates,
        current_min: s.niveau_min,
        current_max: s.niveau_max,
        current_type: s.type
    }));

    const prompt = `Tu es un expert en escalade. Complète les données manquantes pour ces spots d'escalade.

DONNÉES: ${JSON.stringify(spotsData)}

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, un tableau avec un objet par spot.
- Chaque objet doit avoir : _id, niveau_min, niveau_max, orientation, type, description.
- niveau_min et niveau_max : cotation française (ex: "4a", "6b+", "7c"). Ne renvoie JAMAIS null.
- orientation : UNIQUEMENT parmi N, S, E, O, NE, SE, SO, NO.
- type : UNIQUEMENT parmi "crag" (falaise), "boulder" (bloc), "indoor" (salle). Déduis depuis le nom.
- description : courte description en français (1-2 phrases).

FORMAT DE RÉPONSE (tableau JSON) :
[{"_id":"...","niveau_min":"4a","niveau_max":"7b","orientation":"S","type":"crag","description":"..."}]`;

    try {
        const aiResponse = await askOllama(prompt);
        const items = Array.isArray(aiResponse) ? aiResponse : (aiResponse.spots || aiResponse.data || []);
        if (!items.length) return 0;

        const bulkOps = [];

        for (const item of items) {
            const original = spotsChunk.find(s => s._id.toString() === item._id);
            if (!original) continue;

            const setFields = {};

            const addIfBetter = (field, newVal, force = false) => {
                if (!newVal || newVal === "") return;
                if (force || !original[field] || original[field] === "") {
                    setFields[field] = newVal;
                }
            };

            addIfBetter("description", item.description);

            // Orientation
            if ((!original.orientation || original.orientation === "") && item.orientation) {
                let o = item.orientation.toUpperCase().trim();
                const map = { "W": "O", "WEST": "O", "SW": "SO", "NW": "NO", "SOUTH": "S", "NORTH": "N", "EAST": "E" };
                if (map[o]) o = map[o];
                setFields["orientation"] = o;
                setFields["info_complementaires.orientation"] = o;
            }

            // Niveaux
            addIfBetter("niveau_min", item.niveau_min, OVERWRITE_LEVELS);
            let finalMax = item.niveau_max;
            if (!finalMax && item.niveau_min) finalMax = item.niveau_min;
            addIfBetter("niveau_max", finalMax, OVERWRITE_LEVELS);

            // Type (crag/boulder/indoor)
            const validTypes = ["crag", "boulder", "indoor"];
            if ((!original.type || original.type === "") && item.type && validTypes.includes(item.type)) {
                setFields["type"] = item.type;
            }

            if (Object.keys(setFields).length > 0) {
                console.log(`\n✅ [${original.name}]`);
                console.log(JSON.stringify(setFields, null, 2).replace(/^/gm, '   '));
            }

            const updateDoc = Object.keys(setFields).length > 0
                ? { $set: { ...setFields, ai_processed: true } }
                : { $set: { ai_processed: true } };

            bulkOps.push({ updateOne: { filter: { _id: new ObjectId(item._id) }, update: updateDoc } });
        }

        if (bulkOps.length > 0 && !DRY_RUN) {
            await spotsColl.bulkWrite(bulkOps);
        }

        return bulkOps.length;

    } catch (err) {
        console.error(`   ❌ Erreur Chunk ${chunkIndex}:`, err.message);
        return 0;
    }
}

async function runBatch() {
    try {
        await client.connect();
        const db = client.db(process.env.DB_NAME || "ZoneDeGrimpe");
        const spotsColl = db.collection("climbing_spot");

        console.log(`🚀 Enrichissement via Ollama (${OLLAMA_MODEL}) | DRY_RUN: ${DRY_RUN}`);

        while (true) {
            const query = {
                ai_processed: { $ne: true },
                name: { $ne: "" },
                $or: [
                    { description: { $in: [null, ""] } },
                    { orientation: { $in: [null, ""] } },
                    { niveau_min: { $in: [null, ""] } },
                    { niveau_max: { $in: [null, ""] } },
                    { type: { $in: [null, ""] } }
                ]
            };

            const totalRemaining = await spotsColl.countDocuments(query);
            if (totalRemaining === 0) {
                console.log("🎉 TERMINE ! La base est complète.");
                break;
            }

            console.log(`\n📦 Chargement DB... (Reste: ${totalRemaining})`);
            const spots = await spotsColl.find(query).limit(DB_BATCH_SIZE).toArray();

            const chunks = [];
            for (let i = 0; i < spots.length; i += AI_CHUNK_SIZE) {
                chunks.push(spots.slice(i, i + AI_CHUNK_SIZE));
            }

            console.log(`   🔄 ${chunks.length} paquets de ${AI_CHUNK_SIZE}...`);

            for (let i = 0; i < chunks.length; i++) {
                process.stdout.write(`   Paquet ${i + 1}/${chunks.length}... `);
                const count = await processAiChunk(spotsColl, chunks[i], i + 1);
                console.log(`(${count} mis à jour)`);
            }
        }

    } catch (e) {
        console.error("CRASH:", e);
    } finally {
        await client.close();
    }
}

runBatch();
