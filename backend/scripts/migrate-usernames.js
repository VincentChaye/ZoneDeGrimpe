/**
 * Migration : genere un username unique pour les users existants
 * Usage : node scripts/migrate-usernames.js
 */
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI manquante"); process.exit(1); }

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 25);
}

async function run() {
  await client.connect();
  const db = client.db(process.env.DB_NAME || "ZoneDeGrimpe");
  const users = db.collection("users");

  // Desactiver la validation stricte pour pouvoir ajouter le champ username
  try {
    await db.command({
      collMod: "users",
      validationLevel: "off",
    });
    console.log("Validation desactivee temporairement");
  } catch (e) {
    console.warn("Impossible de desactiver la validation:", e.message);
  }

  const usersWithout = await users.find({ username: { $exists: false } }).toArray();
  console.log(`${usersWithout.length} users sans username`);

  const taken = new Set();
  // Collect existing usernames
  const existing = await users.find({ username: { $exists: true } }, { projection: { username: 1 } }).toArray();
  for (const u of existing) taken.add(u.username);

  let updated = 0;
  for (const user of usersWithout) {
    let base = slugify(user.displayName || user.email?.split("@")[0] || "user");
    if (base.length < 3) base = base + "_user";

    let candidate = base;
    let i = 1;
    while (taken.has(candidate)) {
      candidate = `${base}_${i}`;
      i++;
    }

    taken.add(candidate);
    await users.updateOne({ _id: user._id }, { $set: { username: candidate } });
    console.log(`  ${user.email || user._id} → @${candidate}`);
    updated++;
  }

  console.log(`Migration terminee : ${updated} users mis a jour`);

  // Reactiver la validation en mode moderate (accepte les docs existants)
  try {
    await db.command({
      collMod: "users",
      validationLevel: "moderate",
    });
    console.log("Validation reactivee (moderate)");
  } catch (e) {
    console.warn("Impossible de reactiver la validation:", e.message);
  }

  await client.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
