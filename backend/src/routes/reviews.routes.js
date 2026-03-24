import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth, requireAdmin } from "../auth.js";

export function reviewsRouter(db) {
  const r = Router();
  const reviews = db.collection("reviews");
  const spots = db.collection("climbing_spot");
  const users = db.collection("users");

  // Indexes
  reviews.createIndex({ spotId: 1, userId: 1 }, { unique: true }).catch(() => {});
  reviews.createIndex({ spotId: 1, createdAt: -1 }).catch(() => {});
  reviews.createIndex({ userId: 1, createdAt: -1 }).catch(() => {});

  /** Recalcule avgRating + reviewCount sur le spot */
  async function recalcSpotRating(spotId) {
    const pipeline = [
      { $match: { spotId } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ];
    const [result] = await reviews.aggregate(pipeline).toArray();
    const avg = result ? Math.round(result.avg * 10) / 10 : null;
    const count = result ? result.count : 0;
    await spots.updateOne(
      { _id: new ObjectId(spotId) },
      { $set: { avgRating: avg, reviewCount: count } }
    );
  }

  // --- GET /api/reviews/spot/:spotId --- public, pagine
  r.get("/spot/:spotId", async (req, res) => {
    try {
      const { spotId } = req.params;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = Math.max(parseInt(req.query.skip) || 0, 0);

      const items = await reviews
        .find({ spotId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await reviews.countDocuments({ spotId });
      return res.json({ items, total });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/reviews/spot/:spotId/summary --- public
  r.get("/spot/:spotId/summary", async (req, res) => {
    try {
      const { spotId } = req.params;
      const pipeline = [
        { $match: { spotId } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            count: { $sum: 1 },
          },
        },
      ];
      const [result] = await reviews.aggregate(pipeline).toArray();

      // Distribution par etoile
      const distPipeline = [
        { $match: { spotId } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
      ];
      const dist = await reviews.aggregate(distPipeline).toArray();
      const distribution = {};
      for (let i = 1; i <= 5; i++) distribution[i] = 0;
      for (const d of dist) distribution[d._id] = d.count;

      return res.json({
        avgRating: result ? Math.round(result.avgRating * 10) / 10 : null,
        count: result ? result.count : 0,
        distribution,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- POST /api/reviews --- requireAuth, upsert
  r.post("/", requireAuth, async (req, res) => {
    try {
      const { spotId, rating, comment } = req.body || {};
      if (!spotId || !ObjectId.isValid(spotId)) {
        return res.status(400).json({ error: "invalid_spot_id" });
      }
      if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "invalid_rating", detail: "1-5 integer required" });
      }
      if (comment !== undefined && (typeof comment !== "string" || comment.length > 2000)) {
        return res.status(400).json({ error: "invalid_comment" });
      }

      // Verify spot exists
      const spot = await spots.findOne({ _id: new ObjectId(spotId) });
      if (!spot) return res.status(404).json({ error: "spot_not_found" });

      const uid = req.auth.uid;
      const user = await users.findOne({ _id: new ObjectId(uid) }, { projection: { username: 1, displayName: 1, avatarUrl: 1 } });

      const now = new Date();
      const result = await reviews.findOneAndUpdate(
        { spotId, userId: uid },
        {
          $set: {
            rating,
            comment: comment || "",
            username: user?.username || user?.displayName || "Anonyme",
            avatarUrl: user?.avatarUrl || null,
            updatedAt: now,
          },
          $setOnInsert: {
            spotId,
            userId: uid,
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      await recalcSpotRating(spotId);
      return res.status(201).json(result);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- PATCH /api/reviews/:id --- requireAuth, auteur ou admin
  r.patch("/:id", requireAuth, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad_id" });
      const review = await reviews.findOne({ _id: new ObjectId(req.params.id) });
      if (!review) return res.status(404).json({ error: "not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      if (review.userId !== req.auth.uid && !isAdmin) {
        return res.status(403).json({ error: "forbidden" });
      }

      const { rating, comment } = req.body || {};
      const $set = { updatedAt: new Date() };
      if (rating !== undefined) {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return res.status(400).json({ error: "invalid_rating" });
        }
        $set.rating = rating;
      }
      if (comment !== undefined) {
        if (typeof comment !== "string" || comment.length > 2000) {
          return res.status(400).json({ error: "invalid_comment" });
        }
        $set.comment = comment;
      }

      await reviews.updateOne({ _id: new ObjectId(req.params.id) }, { $set });
      await recalcSpotRating(review.spotId);
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- DELETE /api/reviews/:id --- requireAuth, auteur ou admin
  r.delete("/:id", requireAuth, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad_id" });
      const review = await reviews.findOne({ _id: new ObjectId(req.params.id) });
      if (!review) return res.status(404).json({ error: "not_found" });

      const isAdmin = req.auth.roles?.includes("admin");
      if (review.userId !== req.auth.uid && !isAdmin) {
        return res.status(403).json({ error: "forbidden" });
      }

      await reviews.deleteOne({ _id: new ObjectId(req.params.id) });
      await recalcSpotRating(review.spotId);
      return res.json({ deleted: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/reviews/user/:userId --- public
  r.get("/user/:userId", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = Math.max(parseInt(req.query.skip) || 0, 0);
      const items = await reviews
        .find({ userId: req.params.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
      const total = await reviews.countDocuments({ userId: req.params.userId });
      return res.json({ items, total });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
