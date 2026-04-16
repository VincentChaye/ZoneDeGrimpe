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

    // ── climbing_spot ──────────────────────────────────────────────────────
    const spots = db.collection("climbing_spot");
    // Supprimer l'ancien index conflictuel hérité (migration)
    try { await spots.dropIndex({ geometry: "2dsphere" }); } catch (_) { /* OK */ }

    await spots.createIndex({ location: "2dsphere" }).catch(() => {});
    await spots.createIndex({ status: 1, location: "2dsphere" }).catch(() => {});
    await spots.createIndex({ "submittedBy.uid": 1 }).catch(() => {});
    await spots.createIndex({ "createdBy.uid": 1 }).catch(() => {});
    await spots.createIndex({ type: 1 }).catch(() => {});              // filtres carte
    await spots.createIndex({ avgRating: -1 }).catch(() => {});        // tri par note
    await spots.createIndex({ "photos.status": 1 }).catch(() => {});   // modération photos

    // ── users ──────────────────────────────────────────────────────────────
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await users.createIndex({ username: 1 }, { unique: true, sparse: true }).catch(() => {});
    await users.createIndex({ displayName: "text", email: "text" }).catch(() => {});

    // ── reviews ────────────────────────────────────────────────────────────
    const reviews = db.collection("reviews");
    await reviews.createIndex({ spotId: 1, userId: 1 }, { unique: true }).catch(() => {});
    await reviews.createIndex({ spotId: 1, createdAt: -1 }).catch(() => {});
    await reviews.createIndex({ userId: 1, createdAt: -1 }).catch(() => {});

    // ── logbook_entries ────────────────────────────────────────────────────
    const logbook = db.collection("logbook_entries");
    await logbook.createIndex({ userId: 1, date: -1 }).catch(() => {});
    await logbook.createIndex({ userId: 1, spotId: 1 }).catch(() => {});
    await logbook.createIndex({ userId: 1, grade: 1 }).catch(() => {});  // pyramide grades

    // ── follows ────────────────────────────────────────────────────────────
    const follows = db.collection("follows");
    await follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true }).catch(() => {});
    await follows.createIndex({ followingId: 1 }).catch(() => {});

    // ── user_bookmarks ─────────────────────────────────────────────────────
    const bookmarks = db.collection("user_bookmarks");
    await bookmarks.createIndex({ uid: 1, spotId: 1 }, { unique: true }).catch(() => {});

    // ── climbing_routes ────────────────────────────────────────────────────
    const climbingRoutes = db.collection("climbing_routes");
    await climbingRoutes.createIndex({ spotId: 1 }).catch(() => {});
    await climbingRoutes.createIndex({ status: 1 }).catch(() => {});
    await climbingRoutes.createIndex({ spotId: 1, grade: 1 }).catch(() => {}); // stats par spot

    // ── notifications ──────────────────────────────────────────────────────
    const notifications = db.collection("notifications");
    await notifications.createIndex({ userId: 1, read: 1, createdAt: -1 }).catch(() => {});
    await notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }).catch(() => {});

    // ── materiel_specs ─────────────────────────────────────────────────────
    const materielSpecs = db.collection("materiel_specs");
    await materielSpecs.createIndex({ category: 1 }).catch(() => {});
    await materielSpecs.createIndex({ brand: 1, model: 1 }, { unique: true }).catch(() => {});

    // ── user_materiel ──────────────────────────────────────────────────────
    const userMaterielColl = db.collection("user_materiel");
    await userMaterielColl.createIndex({ userId: 1, category: 1 }).catch(() => {});
    await userMaterielColl.createIndex({ userId: 1, createdAt: -1 }).catch(() => {});
    await userMaterielColl.createIndex({ specId: 1 }).catch(() => {});

    console.log(`Connecté à MongoDB (${dbName}), tous les index initialisés`);

    return { client, db };
  } catch (error) {
    console.error("Erreur de connexion MongoDB :", error.message);
    throw error; // important pour que server.js gère l'erreur
  }
}
