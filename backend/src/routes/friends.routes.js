import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../auth.js";
import { createNotification } from "../notifications.js";
import { getDisplayName } from "../helpers.js";
import { ObjectId } from "mongodb";

const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: "too_many_requests" },
});

export function friendsRouter(db) {
  const r = Router();
  const friendships = db.collection("friendships");
  const users = db.collection("users");

  // Indexes
  friendships.createIndex({ requesterId: 1, addresseeId: 1 }, { unique: true }).catch((e) => console.warn('[friends] createIndex:', e.message));
  friendships.createIndex({ addresseeId: 1, status: 1 }).catch((e) => console.warn('[friends] createIndex:', e.message));
  friendships.createIndex({ requesterId: 1, status: 1 }).catch((e) => console.warn('[friends] createIndex:', e.message));

  const userProjection = { displayName: 1, username: 1, avatarUrl: 1 };

  // POST /api/friends/request/:userId — send friend request
  r.post("/request/:userId", friendRequestLimiter, requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (userId === req.auth.uid) {
      return res.status(400).json({ error: "cannot_befriend_self" });
    }

    try {
      // Check no existing friendship in either direction
      const existing = await friendships.findOne({
        $or: [
          { requesterId: req.auth.uid, addresseeId: userId },
          { requesterId: userId, addresseeId: req.auth.uid },
        ],
      });
      if (existing) {
        return res.status(409).json({ error: "friendship_exists", status: existing.status });
      }

      const now = new Date();
      await friendships.insertOne({
        requesterId: req.auth.uid,
        addresseeId: userId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });

      // Notify addressee
      const fromName = await getDisplayName(users, req.auth.uid);
      createNotification(db, {
        userId,
        type: "friend_request",
        fromUserId: req.auth.uid,
        fromUsername: fromName,
        message: `${fromName} vous a envoyé une demande d'ami`,
      }).catch(e => console.error("notification error:", e));

      res.status(201).json({ ok: true });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: "friendship_exists" });
      }
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/friends/:id/accept — accept friend request (addressee only)
  r.patch("/:id/accept", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const doc = await friendships.findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ error: "not_found" });

      if (doc.addresseeId !== req.auth.uid) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (doc.status !== "pending") {
        return res.status(400).json({ error: "not_pending" });
      }

      await friendships.updateOne(
        { _id: doc._id },
        { $set: { status: "accepted", updatedAt: new Date() } }
      );

      // Notify requester
      const fromName = await getDisplayName(users, req.auth.uid);
      createNotification(db, {
        userId: doc.requesterId,
        type: "friend_accepted",
        fromUserId: req.auth.uid,
        fromUsername: fromName,
        message: `${fromName} a accepté votre demande d'ami`,
      }).catch(e => console.error("notification error:", e));

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/friends/:id/decline — decline friend request (addressee only)
  r.patch("/:id/decline", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const doc = await friendships.findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ error: "not_found" });

      if (doc.addresseeId !== req.auth.uid) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (doc.status !== "pending") {
        return res.status(400).json({ error: "not_pending" });
      }

      await friendships.updateOne(
        { _id: doc._id },
        { $set: { status: "declined", updatedAt: new Date() } }
      );

      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/friends/:id — remove friendship (either party)
  r.delete("/:id", requireAuth, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "bad_id" });
    }

    try {
      const doc = await friendships.findOne({ _id: new ObjectId(req.params.id) });
      if (!doc) return res.status(404).json({ error: "not_found" });

      if (doc.requesterId !== req.auth.uid && doc.addresseeId !== req.auth.uid) {
        return res.status(403).json({ error: "forbidden" });
      }

      await friendships.deleteOne({ _id: doc._id });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/friends — list accepted friends
  r.get("/", requireAuth, async (req, res) => {
    try {
      const docs = await friendships
        .find({
          status: "accepted",
          $or: [
            { requesterId: req.auth.uid },
            { addresseeId: req.auth.uid },
          ],
        })
        .sort({ updatedAt: -1 })
        .toArray();

      const friendIds = docs.map(d =>
        d.requesterId === req.auth.uid ? d.addresseeId : d.requesterId
      );

      const ids = friendIds.map(id => {
        try { return new ObjectId(id); } catch { return null; }
      }).filter(Boolean);

      const userDocs = ids.length
        ? await users.find({ _id: { $in: ids } }, { projection: userProjection }).toArray()
        : [];

      const userMap = new Map(userDocs.map(u => [u._id.toString(), u]));

      const items = docs.map(d => {
        const friendId = d.requesterId === req.auth.uid ? d.addresseeId : d.requesterId;
        return {
          friendshipId: d._id,
          ...userMap.get(friendId),
          since: d.updatedAt,
        };
      });

      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/friends/requests — incoming pending requests
  r.get("/requests", requireAuth, async (req, res) => {
    try {
      const docs = await friendships
        .find({ addresseeId: req.auth.uid, status: "pending" })
        .sort({ createdAt: -1 })
        .toArray();

      const requesterIds = docs.map(d => {
        try { return new ObjectId(d.requesterId); } catch { return null; }
      }).filter(Boolean);

      const userDocs = requesterIds.length
        ? await users.find({ _id: { $in: requesterIds } }, { projection: userProjection }).toArray()
        : [];

      const userMap = new Map(userDocs.map(u => [u._id.toString(), u]));

      const items = docs.map(d => ({
        friendshipId: d._id,
        ...userMap.get(d.requesterId),
        requestedAt: d.createdAt,
      }));

      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/friends/check/:userId — friendship status with a user
  r.get("/check/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;

      const doc = await friendships.findOne({
        $or: [
          { requesterId: req.auth.uid, addresseeId: userId },
          { requesterId: userId, addresseeId: req.auth.uid },
        ],
      });

      if (!doc) return res.json({ status: "none" });

      if (doc.status === "accepted") return res.json({ status: "accepted", friendshipId: doc._id });
      if (doc.status === "pending") {
        const isSender = doc.requesterId === req.auth.uid;
        return res.json({
          status: isSender ? "pending_sent" : "pending_received",
          friendshipId: doc._id,
        });
      }

      res.json({ status: "none" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
