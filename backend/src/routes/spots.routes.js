import { Router } from "express";
import { ObjectId } from "mongodb";
import rateLimit from "express-rate-limit";
import { createSpotSchema, updateSpotSchema } from "../validators.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { createNotification } from "../notifications.js";
import { getDisplayName } from "../helpers.js";
import { upload, cloudinary } from "../upload.js";

const spotSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_requests" },
});

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
    acces: 1,
    equipement: 1,
    hauteur: 1,
    photos: 1,
  };

  // Filtre spots publics : approved ou sans status (spots OSM importés)
  const PUBLIC_FILTER = { status: { $nin: ["pending", "rejected"] } };

  // ================================================================
  // POST / — Soumettre un spot (tout utilisateur connecté)
  // Admin → approved directement ; User → pending
  // ================================================================
  r.post("/", spotSubmitLimiter, requireAuth, async (req, res) => {
    try {
      const parsed = createSpotSchema.parse(req.body);
      const isAdmin = req.auth.roles?.includes("admin");
      const displayName = await getDisplayName(users, req.auth.uid);

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
      const detail = e.name === "ZodError"
        ? e.errors?.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
        : "invalid_payload";
      res.status(400).json({ error: "invalid_payload", detail });
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
        }, {
          projection: { name: 1, type: 1, status: 1, location: 1, createdAt: 1, updatedAt: 1, createdBy: 1, submittedBy: 1 },
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
  // GET /count — Nombre total de spots approuvés — public
  // ================================================================
  r.get("/count", async (req, res) => {
    try {
      const count = await spots.countDocuments(PUBLIC_FILTER);
      res.json({ count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // GET /photos/pending — Photos en attente de modération (admin)
  // ================================================================
  r.get("/photos/pending", requireAdmin, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200));
      const skip  = Math.max(0, parseInt(req.query.skip, 10) || 0);

      const pipeline = [
        { $match: { "photos.status": "pending" } },
        { $unwind: "$photos" },
        { $match: { "photos.status": "pending" } },
        { $sort: { "photos.createdAt": -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            spotId: { $toString: "$_id" },
            spotName: "$name",
            photo: "$photos",
          },
        },
      ];

      const countPipeline = [
        { $match: { "photos.status": "pending" } },
        { $unwind: "$photos" },
        { $match: { "photos.status": "pending" } },
        { $count: "total" },
      ];

      const [items, countResult] = await Promise.all([
        spots.aggregate(pipeline).toArray(),
        spots.aggregate(countPipeline).toArray(),
      ]);

      res.json({ items, total: countResult[0]?.total ?? 0, limit, skip });
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
      const { minLng, minLat, maxLng, maxLat, limit = 1000, skip = 0, format = "geojson", name = "" } = req.query;
      const limNum = Math.max(1, Math.min(parseInt(limit, 10) || 5000, 20000));
      const skipNum = Math.max(0, parseInt(skip, 10) || 0);

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

      let nameFilter = {};
      if (name) nameFilter.name = { $regex: name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

      const query = { ...PUBLIC_FILTER, ...geoFilter, ...nameFilter };
      const docs = await spots.find(query, { projection: MAP_PROJECTION }).skip(skipNum).limit(limNum).toArray();

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
      const doc = await spots.findOne({ _id: new ObjectId(req.params.id), ...PUBLIC_FILTER });
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
      const displayName = await getDisplayName(users, req.auth.uid);
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
      // Notify proposer
      const proposerId = result.submittedBy?.uid || result.createdBy?.uid;
      if (proposerId) {
        createNotification(db, {
          userId: proposerId,
          type: "spot_approved",
          fromUserId: req.auth.uid,
          fromUsername: displayName,
          data: { spotId: result._id.toString(), spotName: result.name },
          message: `Votre spot "${result.name}" a été approuvé !`,
        }).catch((e) => console.warn('[cleanup]', e.message));
      }
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
      const displayName = await getDisplayName(users, req.auth.uid);
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
      // Notify proposer
      const proposerId = result.submittedBy?.uid || result.createdBy?.uid;
      if (proposerId) {
        createNotification(db, {
          userId: proposerId,
          type: "spot_rejected",
          fromUserId: req.auth.uid,
          fromUsername: displayName,
          data: { spotId: result._id.toString(), spotName: result.name, reason: reason || null },
          message: `Votre spot "${result.name}" a été refusé.${reason ? ` Raison : ${reason}` : ""}`,
        }).catch((e) => console.warn('[cleanup]', e.message));
      }
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
      const displayName = await getDisplayName(users, req.auth.uid);

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
  // POST /:id/photos — Uploader une photo sur un spot (tout user connecté)
  // Admin → approved ; User → pending (modération)
  // ================================================================
  r.post("/:id/photos", requireAuth, (req, res, next) => {
    upload.single("photo")(req, res, (err) => {
      if (err) {
        console.error("[multer/cloudinary upload error]", err.message);
        return res.status(500).json({ error: "upload_failed", detail: err.message });
      }
      next();
    });
  }, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      if (req.file) await cloudinary.uploader.destroy(req.file.filename).catch((e) => console.warn('[cleanup]', e.message));
      return res.status(400).json({ error: "bad_id" });
    }
    if (!req.file) return res.status(400).json({ error: "no_file" });

    try {
      const spot = await spots.findOne({ _id: new ObjectId(req.params.id), ...PUBLIC_FILTER });
      if (!spot) {
        await cloudinary.uploader.destroy(req.file.filename).catch((e) => console.warn('[cleanup]', e.message));
        return res.status(404).json({ error: "not_found" });
      }

      const isAdmin = req.auth.roles?.includes("admin");
      const displayName = await getDisplayName(users, req.auth.uid);

      const photo = {
        _id: new ObjectId(),
        url: req.file.path,
        publicId: req.file.filename,
        uploadedBy: { uid: req.auth.uid, displayName },
        createdAt: new Date(),
        status: isAdmin ? "approved" : "pending",
      };

      await spots.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $push: { photos: photo } }
      );

      if (!isAdmin) {
        // Chercher les admins pour notifier (best-effort)
        const adminUsers = await users.find({ roles: "admin" }, { projection: { _id: 1 } }).limit(10).toArray();
        for (const admin of adminUsers) {
          createNotification(db, {
            userId: admin._id.toString(),
            type: "photo_pending",
            fromUserId: req.auth.uid,
            fromUsername: displayName,
            data: { spotId: spot._id.toString(), spotName: spot.name },
            message: `Nouvelle photo en attente pour "${spot.name}"`,
          }).catch((e) => console.warn('[cleanup]', e.message));
        }
      }

      res.status(201).json({ ok: true, photo });
    } catch (e) {
      console.error("[POST /spots/:id/photos]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // PATCH /:id/photos/:photoId/approve — Approuver une photo (admin)
  // ================================================================
  r.patch("/:id/photos/:photoId/approve", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(req.params.photoId)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const photoOid = new ObjectId(req.params.photoId);
      const result = await spots.findOneAndUpdate(
        { _id: new ObjectId(req.params.id), "photos._id": photoOid },
        { $set: { "photos.$[p].status": "approved" } },
        { arrayFilters: [{ "p._id": photoOid }], returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });

      // Notifier l'uploader
      const photo = result.photos?.find((p) => p._id?.toString() === req.params.photoId);
      if (photo?.uploadedBy?.uid) {
        createNotification(db, {
          userId: photo.uploadedBy.uid,
          type: "photo_approved",
          fromUserId: req.auth.uid,
          fromUsername: await getDisplayName(users, req.auth.uid),
          data: { spotId: result._id.toString(), spotName: result.name },
          message: `Votre photo pour "${result.name}" a été approuvée !`,
        }).catch((e) => console.warn('[cleanup]', e.message));
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[PATCH /spots/:id/photos/:photoId/approve]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // PATCH /:id/photos/:photoId/reject — Rejeter une photo (admin)
  // ================================================================
  r.patch("/:id/photos/:photoId/reject", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(req.params.photoId)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const { reason } = req.body || {};
      const photoOid = new ObjectId(req.params.photoId);

      const spot = await spots.findOne({ _id: new ObjectId(req.params.id) });
      if (!spot) return res.status(404).json({ error: "not_found" });

      const photo = spot.photos?.find((p) => p._id?.toString() === req.params.photoId);
      if (!photo) return res.status(404).json({ error: "photo_not_found" });

      // Cleanup Cloudinary
      if (photo.publicId) await cloudinary.uploader.destroy(photo.publicId).catch((e) => console.warn('[cleanup]', e.message));

      await spots.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $pull: { photos: { _id: photoOid } } }
      );

      if (photo.uploadedBy?.uid) {
        createNotification(db, {
          userId: photo.uploadedBy.uid,
          type: "photo_rejected",
          fromUserId: req.auth.uid,
          fromUsername: await getDisplayName(users, req.auth.uid),
          data: { spotId: spot._id.toString(), spotName: spot.name, reason: reason || null },
          message: `Votre photo pour "${spot.name}" a été refusée.${reason ? ` Raison : ${reason}` : ""}`,
        }).catch((e) => console.warn('[cleanup]', e.message));
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[PATCH /spots/:id/photos/:photoId/reject]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // ================================================================
  // DELETE /:id/photos/:photoId — Supprimer une photo (auteur ou admin)
  // ================================================================
  r.delete("/:id/photos/:photoId", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id) || !ObjectId.isValid(req.params.photoId)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const photoOid = new ObjectId(req.params.photoId);
      const spot = await spots.findOne({ _id: new ObjectId(req.params.id) });
      if (!spot) return res.status(404).json({ error: "not_found" });

      const photo = spot.photos?.find((p) => p._id?.toString() === req.params.photoId);
      if (!photo) return res.status(404).json({ error: "photo_not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      if (photo.uploadedBy?.uid !== req.auth.uid && !isAdmin) {
        return res.status(403).json({ error: "forbidden" });
      }

      if (photo.publicId) await cloudinary.uploader.destroy(photo.publicId).catch((e) => console.warn('[cleanup]', e.message));

      await spots.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $pull: { photos: { _id: photoOid } } }
      );

      res.json({ ok: true });
    } catch (e) {
      console.error("[DELETE /spots/:id/photos/:photoId]", e);
      res.status(500).json({ error: "server_error" });
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
      const doc = await spots.findOne({ _id: new ObjectId(req.params.id) });
      if (doc?.photos?.length) {
        await Promise.allSettled(
          doc.photos.filter((p) => p.publicId).map((p) => cloudinary.uploader.destroy(p.publicId))
        );
      }
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
    type: (d.type && d.type !== "Feature") ? d.type : (d.soustype ?? null),
    soustype: d.soustype ?? null,
    niveau_min: d.niveau_min ?? null,
    niveau_max: d.niveau_max ?? null,
    id_voix: d.id_voix ?? [],
    location: d.location ?? null,
    url: d.url ?? null,
    description: d.description ?? null,
    info_complementaires: d.info_complementaires ?? null,
    orientation: d.orientation ?? null,
    status: d.status ?? null,
    submittedBy: d.submittedBy ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: d.createdAt ?? null,
    updatedBy: d.updatedBy ?? null,
    updatedAt: d.updatedAt ?? null,
    acces: d.acces ?? null,
    equipement: d.equipement ?? null,
    hauteur: d.hauteur ?? null,
    photos: (d.photos ?? []).filter((p) => !p.status || p.status === "approved"),
  };
}

function toFeature(d) {
  return {
    type: "Feature",
    geometry: d.location,
    properties: {
      id: d._id,
      name: d.name ?? null,
      type: (d.type && d.type !== "Feature") ? d.type : (d.soustype ?? null),
      soustype: d.soustype ?? null,
      niveau_min: d.niveau_min ?? null,
      niveau_max: d.niveau_max ?? null,
      id_voix: d.id_voix ?? [],
      url: d.url ?? null,
      description: d.description ?? null,
      info_complementaires: d.info_complementaires ?? null,
      orientation: d.orientation ?? null,
      status: d.status ?? null,
      submittedBy: d.submittedBy ?? null,
      createdBy: d.createdBy ?? null,
      createdAt: d.createdAt ?? null,
      updatedBy: d.updatedBy ?? null,
      updatedAt: d.updatedAt ?? null,
      acces: d.acces ?? null,
      equipement: d.equipement ?? null,
      hauteur: d.hauteur ?? null,
      photos: (d.photos ?? []).filter((p) => !p.status || p.status === "approved"),
    },
  };
}
