import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth.js";

const createRouteSchema = z.object({
  spotId: z.string().regex(/^[a-f\d]{24}$/i, "invalid_spot_id"),
  name: z.string().min(1).max(120),
  grade: z.string().max(10).optional(),
  style: z.enum(["sport", "trad", "boulder", "multi", "other"]).optional(),
  height: z.number().positive().max(2000).optional(),
  bolts: z.number().int().min(0).max(100).optional(),
  description: z.string().max(2000).optional(),
});

const updateRouteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  grade: z.string().max(10).optional(),
  style: z.enum(["sport", "trad", "boulder", "multi", "other"]).optional(),
  height: z.number().positive().max(2000).nullable().optional(),
  bolts: z.number().int().min(0).max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Au moins un champ requis",
});

export function climbingRoutesRouter(db) {
  const r = Router();
  const routes = db.collection("climbing_routes");
  const spots = db.collection("climbing_spot");
  const users = db.collection("users");

  // Index
  routes.createIndex({ spotId: 1 }).catch(() => {});

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

  // GET /api/climbing-routes/spot/:spotId — Voies d'un spot
  r.get("/spot/:spotId", async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const docs = await routes
        .find({ spotId })
        .sort({ grade: 1, name: 1 })
        .toArray();
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

      // Vérifier que le spot existe
      const spot = await spots.findOne({ _id: new ObjectId(parsed.spotId) });
      if (!spot) return res.status(404).json({ error: "spot_not_found" });

      const displayName = await getDisplayName(req.auth.uid);
      const doc = {
        ...parsed,
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

  // PATCH /api/climbing-routes/:id — Modifier une voie (admin ou auteur)
  r.patch("/:id", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      // Vérifier auteur ou admin
      const existing = await routes.findOne({ _id: new ObjectId(req.params.id) });
      if (!existing) return res.status(404).json({ error: "not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      const isAuthor = existing.createdBy?.uid === req.auth.uid;
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: "forbidden" });
      }

      const updates = updateRouteSchema.parse(req.body);
      const displayName = await getDisplayName(req.auth.uid);

      const result = await routes.findOneAndUpdate(
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
      res.json({ ok: true, route: result });
    } catch (e) {
      if (e.name === "ZodError") {
        return res.status(400).json({ error: "invalid_payload", detail: String(e) });
      }
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

      await routes.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/climbing-routes/count/:spotId — Nombre de voies d'un spot
  r.get("/count/:spotId", async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const count = await routes.countDocuments({ spotId });
      res.json({ count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
