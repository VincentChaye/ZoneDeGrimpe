import { MongoClient, ServerApiVersion } from "mongodb";

let client, db;

export async function connectToDb(uri, dbName) {
  try {
    // Évite de reconnecter si déjà initialisé
    if (db && client) return { client, db };

    // Version API stable, timeout de sécurité
    client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      serverSelectionTimeoutMS: 10000,
    });

    await client.connect();
    db = client.db(dbName);

    // Index géospatial (2dsphere) - on utilise 'location' comme champ standard
    const collection = db.collection("climbing_spot");
    
    // Supprimer les anciens index conflictuels
    try {
      await collection.dropIndex({ geometry: "2dsphere" });
    } catch (e) {
      // Index n'existe pas, c'est OK
    }
    
    // Créer les index
    await collection.createIndex({ location: "2dsphere" });
    await collection.createIndex({ status: 1, location: "2dsphere" }).catch(() => {});
    await collection.createIndex({ "submittedBy.uid": 1 }).catch(() => {});
    await collection.createIndex({ "createdBy.uid": 1 }).catch(() => {});
    // Index unique username
    const usersCol = db.collection("users");
    await usersCol.createIndex({ username: 1 }, { unique: true, sparse: true }).catch(() => {});

    console.log(`Connecté à MongoDB (${dbName}), index 2dsphere sur 'location' OK`);

    return { client, db };
  } catch (error) {
    console.error("Erreur de connexion MongoDB :", error.message);
    throw error; // important pour que server.js gère l'erreur
  }
}
