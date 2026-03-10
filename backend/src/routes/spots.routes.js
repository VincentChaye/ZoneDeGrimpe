import { Router } from "express";
import { ObjectId } from "mongodb";
import { createSpotSchema, updateSpotSchema } from "../validators.js";
import { requireAuth, requireAdmin } from "../auth.js";

export function spotsRouter(db) {
  const r = Router();
  const spots = db.collection("climbing_spot");
  const users = db.collection("users");

  // Projection pour la carte (champs publics)
  const MAP_PROJECTION = {
    _id: 1,
    name: 1,
    location: 1,
    type: 1,
    soustype: 1,
    niveau_min: 1,
    niveau_max: 1,
    id_voix: 1,
    orientation: 1,
    url: 1,
    info_complementaires: 1,
    description: 1,
    status: 1,
    submittedBy: 1,
    createdBy: 1,
    createdAt: 1,
    updatedBy: 1,
    updatedAt: 1,
  };

  // Filtre spots publics : approved ou sans status (spots OSM importés)
  const PUBLIC_FILTER = { status: { $nin: ["pending", "rejected"] } };

  // --- Helper : récupère displayName d'un user ---
  async function getDisplayName(uid) {
    try {
      const u = await users.findOne(
        { _id: new ObjectId(uid) },
        { projection: { displayName: 1 } }
      );
      return u?.displayName || "Utilisateur";
    } catch {
      return "Utilisateur";
    }
  }

  // ================================================================
  // POST / — Soumettre un spot (tout utilisateur connecté)
  // Admin → approved directement ; User → pending
  // ================================================================
  r.post("/", requireAuth, async (req, res) => {
    try {
      const parsed = createSpotSchema.parse(req.body);
      const isAdmin = req.auth.roles?.includes("admin");
      const displayName = await getDisplayName(req.auth.uid);

      const author = { uid: req.auth.uid, displayName };
      const now = new Date();

      const doc = {
        ...parsed,
        status: isAdmin ? "approved" : "pending",
        createdAt: now,
        createdBy: author,
        ...(isAdmin ? {} : { submittedBy: author }),
      };

      const { insertedId } = await spots.insertOne(doc);
      res.status(201).json({ ok: true, id: insertedId, status: doc.status });
    } catch (e) {
      res.status(400).json({ error: "invalid_payload", detail: String(e) });
    }
  });

  // ================================================================
  // GET /pending — Liste des spots en attente (admin uniquement)
  // ================================================================
  r.get("/pending", requireAdmin, async (req, res) => {
    try {
      const { limit = 100, skip = 0 } = req.query;
      const lim = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));
      const sk = Math.max(0, parseInt(skip, 10) || 0);

      const [docs, total] = await Promise.all([
        spots
          .find({ status: "pending" })
          .sort({ createdAt: -1 })
          .skip(sk)
          .limit(lim)
          .toArray(),
        spots.countDocuments({ status: "pending" }),
      ]);

      res.json({ items: docs, total, limit: lim, skip: sk });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // GET /my-submissions — Spots soumis par l'utilisateur connecté
  // ================================================================
  r.get("/my-submissions", requireAuth, async (req, res) => {
    try {
      const docs = await spots
        .find({
          $or: [
            { "submittedBy.uid": req.auth.uid },
            { "createdBy.uid": req.auth.uid },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

      res.json(docs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // GET /near — Spots proches (public, approved only)
  // ================================================================
  r.get("/near", async (req, res) => {
    const { lng, lat, radius = 5000, limit = 100, format = "geojson" } = req.query;
    if (lng == null || lat == null) {
      return res.status(400).json({ error: "missing_params", detail: "lng and lat are required" });
    }

    const lngNum = parseFloat(lng);
    const latNum = parseFloat(lat);
    const radNum = parseFloat(radius);
    const limNum = Math.max(1, Math.min(parseInt(limit, 10) || 100, 20000));

    try {
      const docs = await spots
        .find(
          {
            ...PUBLIC_FILTER,
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: [lngNum, latNum] },
                $maxDistance: radNum,
              },
            },
          },
          { projection: MAP_PROJECTION }
        )
        .limit(limNum)
        .toArray();

      if (format === "flat") {
        return res.json(docs.map(toFlat));
      }
      return res.json({ type: "FeatureCollection", features: docs.map(toFeature) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // GET / — Liste (bbox ou tout) — public, approved only
  // ================================================================
  r.get("/", async (req, res) => {
    try {
      const { minLng, minLat, maxLng, maxLat, limit = 1000, format = "geojson" } = req.query;
      const limNum = Math.max(1, Math.min(parseInt(limit, 10) || 1000, 20000));

      let geoFilter = {};
      if (minLng != null && minLat != null && maxLng != null && maxLat != null) {
        const [minx, miny, maxx, maxy] = [+minLng, +minLat, +maxLng, +maxLat];
        geoFilter = {
          location: {
            $geoWithin: {
              $geometry: {
                type: "Polygon",
                coordinates: [[
                  [minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy], [minx, miny],
                ]],
              },
            },
          },
        };
      }

      const query = { ...PUBLIC_FILTER, ...geoFilter };
      const docs = await spots.find(query, { projection: MAP_PROJECTION }).limit(limNum).toArray();

      if (format === "flat") return res.json(docs.map(toFlat));
      return res.json({ type: "FeatureCollection", features: docs.map(toFeature) });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // GET /:id — Détail complet (public)
  // ================================================================
  r.get("/:id", async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const doc = await spots.findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ error: "not_found" });
      res.json(doc);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // PATCH /:id/approve — Approuver un spot (admin)
  // ================================================================
  r.patch("/:id/approve", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const displayName = await getDisplayName(req.auth.uid);
      const result = await spots.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            status: "approved",
            updatedAt: new Date(),
            updatedBy: { uid: req.auth.uid, displayName },
          },
        },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true, spot: result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // PATCH /:id/reject — Rejeter un spot (admin)
  // ================================================================
  r.patch("/:id/reject", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const { reason } = req.body || {};
      const displayName = await getDisplayName(req.auth.uid);
      const result = await spots.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            status: "rejected",
            updatedAt: new Date(),
            updatedBy: { uid: req.auth.uid, displayName },
            rejectedReason: reason || null,
          },
        },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true, spot: result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // PATCH /:id — Modifier un spot (utilisateur connecté)
  // ================================================================
  r.patch("/:id", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const updates = updateSpotSchema.parse(req.body);
      const displayName = await getDisplayName(req.auth.uid);

      const result = await spots.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
            updatedBy: { uid: req.auth.uid, displayName },
          },
        },
        { returnDocument: "after" }
      );

      if (!result) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, spot: result });
    } catch (e) {
      if (e.name === "ZodError") {
        return res.status(400).json({
          error: "invalid_payload",
          detail: e.errors?.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ") || String(e),
        });
      }
      console.error("[PATCH /spots/:id]", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // DELETE /:id — Supprimer un spot (admin uniquement)
  // ================================================================
  r.delete("/:id", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const result = await spots.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ deleted: result.deletedCount === 1 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}

// ================================================================
// Helpers de sérialisation
// ================================================================
function toFlat(d) {
  return {
    _id: d._id,
    id: d._id.toString(),
    name: d.name ?? "Inconnu",
    type: d.type ?? null,
    soustype: d.soustype ?? null,
    niveau_min: d.niveau_min ?? null,
    niveau_max: d.niveau_max ?? null,
    id_voix: d.id_voix ?? [],
    location: d.location ?? null,
    url: d.url ?? null,
    info_complementaires: d.info_complementaires ?? null,
    orientation: d.orientation ?? null,
    status: d.status ?? null,
    submittedBy: d.submittedBy ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: d.createdAt ?? null,
    updatedBy: d.updatedBy ?? null,
    updatedAt: d.updatedAt ?? null,
  };
}

function toFeature(d) {
  return {
    type: "Feature",
    geometry: d.location,
    properties: {
      id: d._id,
      name: d.name ?? null,
      type: d.type ?? null,
      soustype: d.soustype ?? null,
      niveau_min: d.niveau_min ?? null,
      niveau_max: d.niveau_max ?? null,
      id_voix: d.id_voix ?? [],
      url: d.url ?? null,
      info_complementaires: d.info_complementaires ?? null,
      orientation: d.orientation ?? null,
      status: d.status ?? null,
      submittedBy: d.submittedBy ?? null,
      createdBy: d.createdBy ?? null,
      createdAt: d.createdAt ?? null,
      updatedBy: d.updatedBy ?? null,
      updatedAt: d.updatedAt ?? null,
    },
  };
}
