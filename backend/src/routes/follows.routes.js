import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";
import { createNotification } from "../notifications.js";

export function followsRouter(db) {
  const r = Router();
  const follows = db.collection("follows");
  const users = db.collection("users");
  const spots = db.collection("climbing_spot");
  const reviews = db.collection("reviews");
  const logbook = db.collection("logbook_entries");

  // Indexes
  follows.createIndex({ followerId: 1, followingId: 1 }, { unique: true }).catch(() => {});
  follows.createIndex({ followingId: 1 }).catch(() => {});

  const userProjection = { displayName: 1, username: 1, avatarUrl: 1 };

  // POST /api/follows/:userId — follow a user
  r.post("/:userId", requireAuth, async (req, res) => {
    const { userId } = req.params;
    if (userId === req.auth.uid) {
      return res.status(400).json({ error: "cannot_follow_self" });
    }

    try {
      await follows.insertOne({
        followerId: req.auth.uid,
        followingId: userId,
        createdAt: new Date(),
      });

      // Notify the followed user
      const fromUser = await users.findOne(
        { _id: new ObjectId(req.auth.uid) },
        { projection: { displayName: 1, username: 1 } }
      );
      createNotification(db, {
        userId,
        type: "new_follower",
        fromUserId: req.auth.uid,
        fromUsername: fromUser?.displayName || fromUser?.username || "Utilisateur",
        message: `${fromUser?.displayName || "Quelqu'un"} vous suit`,
      }).catch(e => console.error("notification error:", e));

      res.status(201).json({ ok: true });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: "already_following" });
      }
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/follows/:userId — unfollow
  r.delete("/:userId", requireAuth, async (req, res) => {
    try {
      await follows.deleteOne({
        followerId: req.auth.uid,
        followingId: req.params.userId,
      });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/follows/check/:userId — am I following this user?
  r.get("/check/:userId", requireAuth, async (req, res) => {
    try {
      const doc = await follows.findOne({
        followerId: req.auth.uid,
        followingId: req.params.userId,
      });
      res.json({ following: !!doc });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/follows/following — users I follow
  r.get("/following", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const skip = parseInt(req.query.skip) || 0;

      const docs = await follows
        .find({ followerId: req.auth.uid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const ids = docs.map(d => {
        try { return new ObjectId(d.followingId); } catch { return null; }
      }).filter(Boolean);

      const userDocs = ids.length
        ? await users.find({ _id: { $in: ids } }, { projection: userProjection }).toArray()
        : [];

      const userMap = new Map(userDocs.map(u => [u._id.toString(), u]));

      const items = docs.map(d => ({
        ...userMap.get(d.followingId),
        followedAt: d.createdAt,
      }));

      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/follows/followers — my followers
  r.get("/followers", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const skip = parseInt(req.query.skip) || 0;

      const docs = await follows
        .find({ followingId: req.auth.uid })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const ids = docs.map(d => {
        try { return new ObjectId(d.followerId); } catch { return null; }
      }).filter(Boolean);

      const userDocs = ids.length
        ? await users.find({ _id: { $in: ids } }, { projection: userProjection }).toArray()
        : [];

      const userMap = new Map(userDocs.map(u => [u._id.toString(), u]));

      const items = docs.map(d => ({
        ...userMap.get(d.followerId),
        followedAt: d.createdAt,
      }));

      res.json(items);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/follows/count/:userId — public follower/following counts
  r.get("/count/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const [followers, following] = await Promise.all([
        follows.countDocuments({ followingId: userId }),
        follows.countDocuments({ followerId: userId }),
      ]);
      res.json({ followers, following });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/follows/feed — activity feed from followed users
  r.get("/feed", requireAuth, async (req, res) => {
    try {
      const followDocs = await follows
        .find({ followerId: req.auth.uid })
        .project({ followingId: 1 })
        .toArray();

      const followingIds = followDocs.map(d => d.followingId);
      if (followingIds.length === 0) return res.json([]);

      // Fetch recent activity in parallel
      const [recentReviews, recentLogbook, recentSpots] = await Promise.all([
        reviews
          .find({ "createdBy.uid": { $in: followingIds } })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
        logbook
          .find({ "createdBy.uid": { $in: followingIds } })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
        spots
          .find({
            "createdBy.uid": { $in: followingIds },
            status: "approved",
          })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
      ]);

      // Build unified feed
      const feed = [
        ...recentReviews.map(r => ({
          type: "review",
          userId: r.createdBy?.uid,
          username: r.createdBy?.displayName || "Utilisateur",
          data: r,
          date: r.createdAt,
        })),
        ...recentLogbook.map(l => ({
          type: "logbook",
          userId: l.createdBy?.uid,
          username: l.createdBy?.displayName || "Utilisateur",
          data: l,
          date: l.createdAt,
        })),
        ...recentSpots.map(s => ({
          type: "spot",
          userId: s.createdBy?.uid,
          username: s.createdBy?.displayName || "Utilisateur",
          data: s,
          date: s.createdAt,
        })),
      ];

      // Sort by date desc and limit
      feed.sort((a, b) => (b.date || 0) - (a.date || 0));

      res.json(feed.slice(0, 30));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
