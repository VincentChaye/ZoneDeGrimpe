import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth, requireAdmin, optionalAuth } from "../auth.js";
import { uploadRouteImage, cloudinary } from "../upload.js";
import { getDisplayName } from "../helpers.js";

const createRouteSchema = z.object({
  spotId: z.string().regex(/^[a-f\d]{24}$/i, "invalid_spot_id"),
  name: z.string().min(1).max(120),
  grade: z.string().max(10).optional(),
  style: z.enum(["sport", "trad", "boulder", "multi", "other"]).optional(),
  height: z.number().positive().max(2000).optional(),
  bolts: z.number().int().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
});

export function climbingRoutesRouter(db) {
  const r = Router();
  const routes = db.collection("climbing_routes");
  const spots = db.collection("climbing_spot");
  const users = db.collection("users");

// GET /api/climbing-routes/pending — Voies en attente (admin)
  r.get("/pending", requireAdmin, async (req, res) => {
    try {
      const { limit = 50, skip = 0 } = req.query;
      const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
      const sk = Math.max(0, parseInt(skip, 10) || 0);

      const [items, total] = await Promise.all([
        routes.find({ status: "pending" }).sort({ createdAt: -1 }).skip(sk).limit(lim).toArray(),
        routes.countDocuments({ status: "pending" }),
      ]);

      res.json({ items, total, limit: lim, skip: sk });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/climbing-routes/spot/:spotId — Voies d'un spot
  // Public : approved uniquement ; admin voit toutes
  r.get("/spot/:spotId", optionalAuth, async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const isAdmin = req.auth?.roles?.includes("admin") ?? false;
      // Anciennes voies sans status sont considérées comme approved ($nin exclut pending et rejected)
      const filter = isAdmin ? { spotId } : { spotId, status: { $nin: ["pending", "rejected"] } };
      const docs = await routes.find(filter).sort({ grade: 1, name: 1 }).toArray();
      res.json(docs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/climbing-routes — Ajouter une voie
  r.post("/", requireAuth, async (req, res) => {
    try {
      const parsed = createRouteSchema.parse(req.body);

      const spot = await spots.findOne({ _id: new ObjectId(parsed.spotId) });
      if (!spot) return res.status(404).json({ error: "spot_not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      const displayName = await getDisplayName(users, req.auth.uid);
      const doc = {
        ...parsed,
        status: isAdmin ? "approved" : "pending",
        createdBy: { uid: req.auth.uid, displayName },
        createdAt: new Date(),
      };

      const { insertedId } = await routes.insertOne(doc);
      res.status(201).json({ ok: true, id: insertedId, route: { ...doc, _id: insertedId } });
    } catch (e) {
      if (e.name === "ZodError") {
        return res.status(400).json({ error: "invalid_payload", detail: e.errors?.map(err => err.message).join(", ") });
      }
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/climbing-routes/:id/image — Upload image d'une voie (auteur ou admin)
  r.post("/:id/image", requireAuth, uploadRouteImage.single("image"), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "no_file" });
    }
    try {
      const route = await routes.findOne({ _id: new ObjectId(req.params.id) });
      if (!route) {
        await cloudinary.uploader.destroy(req.file.filename);
        return res.status(404).json({ error: "not_found" });
      }

      const isAdmin = req.auth.roles?.includes("admin");
      const isAuthor = route.createdBy?.uid === req.auth.uid;
      if (!isAdmin && !isAuthor) {
        await cloudinary.uploader.destroy(req.file.filename);
        return res.status(403).json({ error: "forbidden" });
      }

      // Supprimer l'ancienne image si elle existe
      if (route.imagePublicId) {
        await cloudinary.uploader.destroy(route.imagePublicId).catch((e) => console.warn('[cleanup]', e.message));
      }

      const updated = await routes.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { imageUrl: req.file.path, imagePublicId: req.file.filename, updatedAt: new Date() } },
        { returnDocument: "after" }
      );

      res.json({ ok: true, imageUrl: req.file.path, route: updated });
    } catch (e) {
      console.error("[POST /climbing-routes/:id/image]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/climbing-routes/:id/approve — Approuver une voie (admin)
  r.patch("/:id/approve", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const result = await routes.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "approved", updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true, route: result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/climbing-routes/:id/reject — Rejeter une voie (admin)
  r.patch("/:id/reject", requireAdmin, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }
    try {
      const { reason } = req.body || {};
      const result = await routes.findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "rejected", rejectedReason: reason || null, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });
      res.json({ ok: true, route: result });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/climbing-routes/:id — Supprimer une voie (admin ou auteur)
  r.delete("/:id", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const doc = await routes.findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ error: "not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      const isAuthor = doc.createdBy?.uid === req.auth.uid;
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: "forbidden" });
      }

      // Supprimer l'image si elle existe
      if (doc.imagePublicId) {
        await cloudinary.uploader.destroy(doc.imagePublicId).catch((e) => console.warn('[cleanup]', e.message));
      }

      await routes.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
