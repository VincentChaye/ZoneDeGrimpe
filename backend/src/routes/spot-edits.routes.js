import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth.js";

const changesSchema = z
  .object({
    name:        z.string().min(1).max(120).optional(),
    type:        z.enum(["crag", "boulder", "indoor", "shop"]).optional(),
    soustype:    z.enum(["diff", "bloc"]).nullable().optional(),
    niveau_min:  z.string().max(10).nullable().optional(),
    niveau_max:  z.string().max(10).nullable().optional(),
    orientation: z.enum(["N","NE","E","SE","S","SO","O","NO"]).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    url:         z.string().url().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "Au moins un champ est requis" });

const proposeEditSchema = z.object({
  spotId:  z.string().regex(/^[a-f0-9]{24}$/, "spotId invalide"),
  changes: changesSchema,
});

export function spotEditsRouter(db) {
  const r         = Router();
  const spotEdits = db.collection("spot_edits");
  const spots     = db.collection("climbing_spot");
  const users     = db.collection("users");

  async function getDisplayName(uid) {
    try {
      const u = await users.findOne(
        { _id: new ObjectId(uid) },
        { projection: { displayName: 1 } }
      );
      return u?.displayName || "Utilisateur";
    } catch { return "Utilisateur"; }
  }

  // ================================================================
  // POST / — Proposer une modification
  // Admin → appliqué immédiatement ; User → pending
  // ================================================================
  r.post("/", requireAuth, async (req, res) => {
    try {
      const parsed = proposeEditSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Données invalides", detail: parsed.error.flatten() });

      const { spotId, changes } = parsed.data;

      let spot;
      try { spot = await spots.findOne({ _id: new ObjectId(spotId) }); }
      catch { return res.status(400).json({ error: "ID invalide" }); }
      if (!spot) return res.status(404).json({ error: "Spot introuvable" });

      const displayName = await getDisplayName(req.auth.uid);
      const isAdmin = req.auth.roles?.includes("admin");

      if (isAdmin) {
        await spots.updateOne(
          { _id: new ObjectId(spotId) },
          { $set: { ...changes, updatedAt: new Date(), updatedBy: { uid: req.auth.uid, displayName } } }
        );
        return res.json({ status: "approved" });
      }

      // Snapshot valeurs actuelles pour le diff
      const previousValues = {};
      for (const key of Object.keys(changes)) {
        previousValues[key] = spot[key] ?? null;
      }

      const result = await spotEdits.insertOne({
        spotId:         new ObjectId(spotId),
        spotName:       spot.name,
        changes,
        previousValues,
        status:         "pending",
        proposedBy:     { uid: req.auth.uid, displayName },
        createdAt:      new Date(),
        updatedAt:      new Date(),
      });

      res.status(201).json({ status: "pending", _id: result.insertedId });
    } catch (e) {
      console.error("[spot-edits POST]", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ================================================================
  // GET /pending — Liste des modifications en attente (admin)
  // ================================================================
  r.get("/pending", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const skip  = parseInt(req.query.skip) || 0;
      const [items, total] = await Promise.all([
        spotEdits.find({ status: "pending" }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        spotEdits.countDocuments({ status: "pending" }),
      ]);
      res.json({ items, total, limit, skip });
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ================================================================
  // PATCH /:editId/approve — Approuver et appliquer
  // ================================================================
  r.patch("/:editId/approve", requireAdmin, async (req, res) => {
    try {
      let editId;
      try { editId = new ObjectId(req.params.editId); }
      catch { return res.status(400).json({ error: "ID invalide" }); }

      const edit = await spotEdits.findOne({ _id: editId, status: "pending" });
      if (!edit) return res.status(404).json({ error: "Demande introuvable ou déjà traitée" });

      const displayName = await getDisplayName(req.auth.uid);
      // Atomic check: re-verify pending status to prevent double-approve
      const editUpdate = await spotEdits.updateOne(
        { _id: editId, status: "pending" },
        { $set: { status: "approved", updatedAt: new Date(), reviewedBy: { uid: req.auth.uid, displayName } } }
      );
      if (editUpdate.modifiedCount === 0) {
        return res.status(409).json({ error: "already_processed" });
      }
      await spots.updateOne(
        { _id: edit.spotId },
        { $set: { ...edit.changes, updatedAt: new Date(), updatedBy: { uid: req.auth.uid, displayName } } }
      );
      res.json({ status: "approved" });
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ================================================================
  // PATCH /:editId/reject — Rejeter
  // ================================================================
  r.patch("/:editId/reject", requireAdmin, async (req, res) => {
    try {
      let editId;
      try { editId = new ObjectId(req.params.editId); }
      catch { return res.status(400).json({ error: "ID invalide" }); }

      const edit = await spotEdits.findOne({ _id: editId, status: "pending" });
      if (!edit) return res.status(404).json({ error: "Demande introuvable ou déjà traitée" });

      const displayName = await getDisplayName(req.auth.uid);
      await spotEdits.updateOne(
        { _id: editId },
        { $set: {
          status:         "rejected",
          rejectedReason: req.body?.reason ?? null,
          updatedAt:      new Date(),
          reviewedBy:     { uid: req.auth.uid, displayName },
        }}
      );
      res.json({ status: "rejected" });
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  return r;
}
