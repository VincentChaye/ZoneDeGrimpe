import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";

export function bookmarksRouter(db) {
  const r = Router();
  const bookmarks = db.collection("user_bookmarks");
  const spots = db.collection("climbing_spot");

// GET /api/bookmarks — Liste des bookmarks de l'utilisateur
  r.get("/", requireAuth, async (req, res) => {
    try {
      const docs = await bookmarks
        .find({ uid: req.auth.uid })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();

      // Récupérer les spots associés
      const spotIds = docs.map(d => new ObjectId(d.spotId));
      const spotDocs = spotIds.length
        ? await spots.find({ _id: { $in: spotIds } }).toArray()
        : [];

      const spotMap = new Map(spotDocs.map(s => [s._id.toString(), s]));

      const items = docs
        .map(d => {
          const spot = spotMap.get(d.spotId);
          if (!spot) return null;
          return { ...spot, bookmarkedAt: d.createdAt };
        })
        .filter(Boolean);

      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/bookmarks/:spotId — Ajouter un bookmark
  r.post("/:spotId", requireAuth, async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      // Vérifier que le spot existe
      const spot = await spots.findOne({ _id: new ObjectId(spotId) });
      if (!spot) return res.status(404).json({ error: "spot_not_found" });

      await bookmarks.updateOne(
        { uid: req.auth.uid, spotId },
        { $setOnInsert: { uid: req.auth.uid, spotId, createdAt: new Date() } },
        { upsert: true }
      );

      res.status(201).json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/bookmarks/:spotId — Retirer un bookmark
  r.delete("/:spotId", requireAuth, async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      await bookmarks.deleteOne({ uid: req.auth.uid, spotId });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/bookmarks/check/:spotId — Vérifier si un spot est bookmarké
  r.get("/check/:spotId", requireAuth, async (req, res) => {
    const { spotId } = req.params;
    if (!ObjectId.isValid(spotId)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const doc = await bookmarks.findOne({ uid: req.auth.uid, spotId });
      res.json({ bookmarked: !!doc });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
