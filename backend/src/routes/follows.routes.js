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
      // reviews + logbook store userId (plain string), spots store createdBy.uid
      const [recentReviews, recentLogbook, recentSpots] = await Promise.all([
        reviews
          .find({ userId: { $in: followingIds } })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
        logbook
          .find({ userId: { $in: followingIds } })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
        spots
          .find({ "createdBy.uid": { $in: followingIds }, status: "approved" })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray()
          .catch(() => []),
      ]);

      // Batch user lookup for logbook (no username stored there)
      const logbookUserIds = [...new Set(recentLogbook.map(l => l.userId).filter(Boolean))];
      const userDocs = logbookUserIds.length
        ? await users.find(
            { _id: { $in: logbookUserIds.map(id => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean) } },
            { projection: { username: 1, displayName: 1 } }
          ).toArray()
        : [];
      const userMap = new Map(userDocs.map(u => [u._id.toString(), u]));

      // Batch spot name lookup for reviews (spotName not stored on review)
      const reviewSpotIds = [...new Set(recentReviews.map(r => r.spotId).filter(Boolean))];
      const spotDocs = reviewSpotIds.length
        ? await spots.find(
            { _id: { $in: reviewSpotIds.map(id => { try { return new ObjectId(id); } catch { return null; } }).filter(Boolean) } },
            { projection: { name: 1 } }
          ).toArray()
        : [];
      const spotMap = new Map(spotDocs.map(s => [s._id.toString(), s.name]));

      // Build unified feed
      const feed = [
        ...recentReviews.map(r => ({
          type: "review",
          userId: r.userId,
          username: r.username || "Utilisateur",
          data: { spotId: r.spotId, spotName: spotMap.get(r.spotId) || null, rating: r.rating, comment: r.comment },
          createdAt: r.createdAt,
        })),
        ...recentLogbook.map(l => {
          const u = userMap.get(l.userId);
          return {
            type: "logbook",
            userId: l.userId,
            username: u?.username || u?.displayName || "Utilisateur",
            data: { spotId: l.spotId, spotName: l.spotName, routeName: l.routeName, grade: l.grade, style: l.style },
            createdAt: l.createdAt,
          };
        }),
        ...recentSpots.map(s => ({
          type: "spot",
          userId: s.createdBy?.uid,
          username: s.createdBy?.displayName || s.createdBy?.username || "Utilisateur",
          data: { spotId: s._id.toString(), spotName: s.name },
          createdAt: s.createdAt,
        })),
      ];

      // Sort by date desc and limit
      feed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      res.json(feed.slice(0, 30));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
