import { Router } from "express";
import { ObjectId } from "mongodb";
import { ZodError } from "zod";
import { requireAuth, optionalAuth } from "../auth.js";
import { createUserMaterielSchema, updateUserMaterielSchema } from "../validators.js";
import { computeEpiStatus } from "../gear.js";
import { createNotification } from "../notifications.js";

export function userMaterielRouter(db) {
  const r = Router();
  const materiel    = db.collection("user_materiel");
  const specs       = db.collection("materiel_specs");
  const users       = db.collection("users");
  const friendships = db.collection("friendships");

  /** Enrichit un item avec epiStatus calculé à la volée */
  async function enrichWithEpi(item) {
    let spec = null;
    if (item.specId) {
      spec = await specs.findOne({ _id: new ObjectId(item.specId.toString()) });
    }
    return { ...item, epiStatus: computeEpiStatus(item, spec) };
  }

  /** Déclenche les notifs EPI si le statut a changé (fire-and-forget) */
  function checkEpiNotifs(userId, items) {
    for (const item of items) {
      if (!item.epiStatus || item.epiStatus === "ok") continue;
      if (item.epiStatus === item.lastEpiNotifiedStatus) continue;
      const type = item.epiStatus === "retire" ? "gear_epi_retire" : "gear_epi_warning";
      const name = item.customName || [item.brand, item.model].filter(Boolean).join(" ") || "Équipement";
      const msg  = type === "gear_epi_retire"
        ? `${name} doit être réformé`
        : `${name} approche de sa date de réforme`;

      createNotification(db, { userId, type, data: { itemId: item._id.toString(), name }, message: msg })
        .catch(() => {});
      materiel.updateOne({ _id: item._id }, { $set: { lastEpiNotifiedStatus: item.epiStatus } })
        .catch(() => {});
    }
  }

  // ─── GET /me — inventaire du user connecté ───────────────────────────────
  r.get("/me", requireAuth, async (req, res) => {
    try {
      const userId   = req.auth.uid;
      const filter   = { userId };
      if (req.query.category) filter.category = req.query.category;

      const items    = await materiel.find(filter).sort({ createdAt: -1 }).toArray();
      const enriched = await Promise.all(items.map(enrichWithEpi));

      checkEpiNotifs(userId, enriched);

      return res.json({ items: enriched });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // ─── GET /user/:userId — profil public (visibilité contrôlée) ────────────
  r.get("/user/:userId", optionalAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const viewerId   = req.auth?.uid || null;

      if (!ObjectId.isValid(userId)) return res.status(400).json({ error: "bad_id" });

      const targetUser = await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: { "privacy.gearVisibility": 1 } }
      );
      if (!targetUser) return res.status(404).json({ error: "user_not_found" });

      const visibility = targetUser?.privacy?.gearVisibility ?? "private";

      if (visibility === "private") {
        if (viewerId !== userId) return res.status(403).json({ error: "private_gear" });
      } else if (visibility === "friends") {
        if (!viewerId || viewerId !== userId) {
          if (viewerId !== userId) {
            if (!viewerId) return res.status(403).json({ error: "friends_only_gear" });
            const friendship = await friendships.findOne({
              status: "accepted",
              $or: [
                { requesterId: viewerId, addresseeId: userId },
                { requesterId: userId, addresseeId: viewerId },
              ],
            });
            if (!friendship) return res.status(403).json({ error: "friends_only_gear" });
          }
        }
      }

      const filter = { userId };
      if (req.query.category) filter.category = req.query.category;

      const items    = await materiel.find(filter).sort({ createdAt: -1 }).toArray();
      const enriched = await Promise.all(items.map(enrichWithEpi));
      return res.json({ items: enriched });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // ─── POST / — ajouter un item ─────────────────────────────────────────────
  r.post("/", requireAuth, async (req, res) => {
    try {
      const data   = createUserMaterielSchema.parse(req.body);
      const userId = req.auth.uid;

      // Dénormalisation depuis le catalogue si specId fourni
      let specData = {};
      if (data.specId) {
        if (!ObjectId.isValid(data.specId)) return res.status(400).json({ error: "bad_spec_id" });
        const spec = await specs.findOne({ _id: new ObjectId(data.specId) });
        if (!spec) return res.status(404).json({ error: "spec_not_found" });
        specData = { category: spec.category, brand: spec.brand, model: spec.model };
      }

      const now = new Date();
      const doc = {
        userId,
        ...specData,         // category/brand/model depuis spec si dispo
        ...data,             // peut override brand/model pour custom, mais pas category si specId
        specId: data.specId ? new ObjectId(data.specId) : null,
        lastEpiNotifiedStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      // Forcer category depuis spec (non overridable)
      if (specData.category) doc.category = specData.category;

      const result  = await materiel.insertOne(doc);
      const enriched = await enrichWithEpi({ _id: result.insertedId, ...doc });
      return res.status(201).json(enriched);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: "invalid_payload", detail: e.flatten() });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // ─── PATCH /:id — modifier un item ───────────────────────────────────────
  r.patch("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    try {
      const existing = await materiel.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: "not_found" });
      if (existing.userId !== req.auth.uid) return res.status(403).json({ error: "forbidden" });

      const data   = updateUserMaterielSchema.parse(req.body);
      const result = await materiel.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      const enriched = await enrichWithEpi(result);
      return res.json(enriched);
    } catch (e) {
      if (e instanceof ZodError) return res.status(400).json({ error: "invalid_payload", detail: e.flatten() });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // ─── DELETE /:id — supprimer un item ─────────────────────────────────────
  r.delete("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    try {
      const existing = await materiel.findOne({ _id: new ObjectId(id) });
      if (!existing) return res.status(404).json({ error: "not_found" });
      if (existing.userId !== req.auth.uid) return res.status(403).json({ error: "forbidden" });

      await materiel.deleteOne({ _id: new ObjectId(id) });
      return res.json({ deleted: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
