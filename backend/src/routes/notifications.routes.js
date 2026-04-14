import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";

export function notificationsRouter(db) {
  const r = Router();
  const notifications = db.collection("notifications");

  // GET /api/notifications — paginated list
  r.get("/", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const skip = parseInt(req.query.skip) || 0;

      const docs = await notifications
        .find({ userId: req.auth.uid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      res.json(docs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/notifications/unread-count
  r.get("/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await notifications.countDocuments({
        userId: req.auth.uid,
        read: false,
      });
      res.json({ count });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/notifications/:id/read — mark one as read
  r.patch("/:id/read", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const result = await notifications.updateOne(
        { _id: new ObjectId(req.params.id), userId: req.auth.uid },
        { $set: { read: true } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: "not_found" });
      }
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/notifications/read-all — mark all as read
  r.patch("/read-all", requireAuth, async (req, res) => {
    try {
      await notifications.updateMany(
        { userId: req.auth.uid, read: false },
        { $set: { read: true } }
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
