import { Router } from "express";
import { ObjectId } from "mongodb";
import { ZodError } from "zod";
import { requireAdmin } from "../auth.js";
import { createMaterielSpecSchema, updateMaterielSpecSchema } from "../validators.js";

export function materielSpecsRouter(db) {
  const r = Router();
  const specs = db.collection("materiel_specs");
  const userMateriel = db.collection("user_materiel");

  // GET / — public, ?category=&q=&limit=&skip=
  r.get("/", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const skip  = Math.max(parseInt(req.query.skip)  || 0,  0);

      const filter = {};
      if (req.query.category) filter.category = req.query.category;
      if (req.query.q) {
        const re = new RegExp(req.query.q.slice(0, 100), "i");
        filter.$or = [{ brand: re }, { model: re }, { description: re }];
      }

      const [items, total] = await Promise.all([
        specs.find(filter).sort({ brand: 1, model: 1 }).skip(skip).limit(limit).toArray(),
        specs.countDocuments(filter),
      ]);
      return res.json({ items, total });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // GET /:id — public
  r.get("/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    try {
      const spec = await specs.findOne({ _id: new ObjectId(id) });
      if (!spec) return res.status(404).json({ error: "not_found" });
      return res.json(spec);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // POST / — admin only
  r.post("/", requireAdmin, async (req, res) => {
    try {
      const data = createMaterielSpecSchema.parse(req.body);
      const now  = new Date();
      const doc  = {
        ...data,
        createdBy: { uid: req.auth.uid },
        createdAt: now,
        updatedAt: now,
      };
      const result = await specs.insertOne(doc);
      return res.status(201).json({ _id: result.insertedId, ...doc });
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: "invalid_payload", detail: e.flatten() });
      if (e.code === 11000)      return res.status(409).json({ error: "duplicate_spec" });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /:id — admin only
  r.patch("/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    try {
      const data   = updateMaterielSpecSchema.parse(req.body);
      const result = await specs.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!result) return res.status(404).json({ error: "not_found" });
      return res.json(result);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: "invalid_payload", detail: e.flatten() });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /:id — admin only ; 409 si référencé
  r.delete("/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    try {
      const refCount = await userMateriel.countDocuments({ specId: new ObjectId(id) });
      if (refCount > 0) return res.status(409).json({ error: "spec_in_use", count: refCount });

      const result = await specs.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ deleted: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
