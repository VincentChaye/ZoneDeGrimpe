import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const DRY_RUN = false;

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.DB_NAME || "ZoneDeGrimpe");
const col = db.collection("climbing_spot");

// Patterns qui identifient des sous-secteurs (pas des falaises/sites principaux)
const sectorFilter = {
    $or: [
        { name: { $regex: /secteur/i } },
        { name: { $regex: / - / } }
    ]
};

const total = await col.countDocuments();
const toDelete = await col.countDocuments(sectorFilter);

console.log(`📊 Spots total      : ${total}`);
console.log(`🗑️  Spots à supprimer : ${toDelete} (sous-secteurs)`);
console.log(`✅ Spots conservés  : ${total - toDelete}`);
console.log(`   DRY_RUN: ${DRY_RUN}\n`);

if (!DRY_RUN) {
    const result = await col.deleteMany(sectorFilter);
    console.log(`✅ Supprimés : ${result.deletedCount} spots`);
    console.log(`📦 Restants  : ${await col.countDocuments()} spots`);
} else {
    console.log("(DRY_RUN activé — aucune suppression)");
}

await client.close();
