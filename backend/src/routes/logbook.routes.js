import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth, optionalAuth } from "../auth.js";

export function logbookRouter(db) {
  const r = Router();
  const logbook = db.collection("logbook_entries");
  const spots = db.collection("climbing_spot");
  const routes = db.collection("climbing_routes");
  const users = db.collection("users");
  const friendships = db.collection("friendships");

const VALID_STYLES = ["onsight", "flash", "redpoint", "repeat"];

  // --- GET /api/logbook --- mes entrees (requireAuth)
  // Query params optionnels : spotId, limit, skip
  r.get("/", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 30, 100);
      const skip = Math.max(parseInt(req.query.skip) || 0, 0);

      const filter = { userId: req.auth.uid };
      if (req.query.spotId) filter.spotId = req.query.spotId;

      const items = await logbook
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await logbook.countDocuments(filter);
      return res.json({ items, total });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/logbook/stats --- stats aggregees (requireAuth)
  r.get("/stats", requireAuth, async (req, res) => {
    try {
      const uid = req.auth.uid;

      const [result] = await logbook.aggregate([
        { $match: { userId: uid } },
        { $facet: {
          totals: [
            { $group: { _id: null, total: { $sum: 1 }, spots: { $addToSet: "$spotId" } } },
          ],
          gradePyramid: [
            { $match: { grade: { $exists: true, $ne: null } } },
            { $group: { _id: "$grade", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          monthly: [
            { $group: {
              _id: { year: { $year: "$date" }, month: { $month: "$date" } },
              count: { $sum: 1 },
            }},
            { $sort: { "_id.year": 1, "_id.month": 1 } },
          ],
          styles: [
            { $group: { _id: "$style", count: { $sum: 1 } } },
          ],
        }},
      ]).toArray();

      const totalsDoc = result?.totals?.[0];
      return res.json({
        total:        totalsDoc?.total ?? 0,
        uniqueSpots:  totalsDoc?.spots?.length ?? 0,
        gradePyramid: (result?.gradePyramid ?? []).map((g) => ({ grade: g._id, count: g.count })),
        monthly:      (result?.monthly ?? []).map((m) => ({ year: m._id.year, month: m._id.month, count: m.count })),
        styles:       Object.fromEntries((result?.styles ?? []).map((s) => [s._id || "unknown", s.count])),
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- POST /api/logbook --- requireAuth
  r.post("/", requireAuth, async (req, res) => {
    try {
      const { spotId, routeId, date, style, notes, rating } = req.body || {};

      if (!spotId || !ObjectId.isValid(spotId)) {
        return res.status(400).json({ error: "invalid_spot_id" });
      }
      if (!date) {
        return res.status(400).json({ error: "date_required" });
      }
      if (!style || !VALID_STYLES.includes(style)) {
        return res.status(400).json({ error: "invalid_style", allowed: VALID_STYLES });
      }
      if (notes !== undefined && (typeof notes !== "string" || notes.length > 1000)) {
        return res.status(400).json({ error: "invalid_notes" });
      }
      if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        return res.status(400).json({ error: "invalid_rating" });
      }

      // Fetch spot/route names for denormalization
      const spot = await spots.findOne({ _id: new ObjectId(spotId) });
      if (!spot) return res.status(404).json({ error: "spot_not_found" });

      let routeName = null;
      let grade = null;
      if (routeId && ObjectId.isValid(routeId)) {
        const route = await routes.findOne({ _id: new ObjectId(routeId) });
        if (route) {
          routeName = route.name;
          grade = route.grade || null;
        }
      }

      const doc = {
        userId: req.auth.uid,
        spotId,
        routeId: routeId || null,
        spotName: spot.name,
        routeName,
        grade,
        date: new Date(date),
        style,
        notes: notes || null,
        rating: rating || null,
        createdAt: new Date(),
      };

      const { insertedId } = await logbook.insertOne(doc);
      return res.status(201).json({ _id: insertedId, ...doc });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- PATCH /api/logbook/:id --- requireAuth, auteur
  r.patch("/:id", requireAuth, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad_id" });
      const entry = await logbook.findOne({ _id: new ObjectId(req.params.id) });
      if (!entry) return res.status(404).json({ error: "not_found" });
      if (entry.userId !== req.auth.uid) return res.status(403).json({ error: "forbidden" });

      const { date, style, notes, rating } = req.body || {};
      const $set = { updatedAt: new Date() };

      if (date) $set.date = new Date(date);
      if (style) {
        if (!VALID_STYLES.includes(style)) return res.status(400).json({ error: "invalid_style" });
        $set.style = style;
      }
      if (notes !== undefined) $set.notes = notes || null;
      if (rating !== undefined) $set.rating = rating || null;

      await logbook.updateOne({ _id: new ObjectId(req.params.id) }, { $set });
      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- DELETE /api/logbook/:id --- requireAuth, auteur
  r.delete("/:id", requireAuth, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "bad_id" });
      const entry = await logbook.findOne({ _id: new ObjectId(req.params.id) });
      if (!entry) return res.status(404).json({ error: "not_found" });
      if (entry.userId !== req.auth.uid) return res.status(403).json({ error: "forbidden" });

      await logbook.deleteOne({ _id: new ObjectId(req.params.id) });
      return res.json({ deleted: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/logbook/user/:userId --- profil (visibilité contrôlée)
  r.get("/user/:userId", optionalAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const viewerId = req.auth?.uid || null;

      // Vérifier la visibilité du logbook
      const targetUser = await users.findOne(
        { _id: new ObjectId(userId) },
        { projection: { "privacy.logbookVisibility": 1 } }
      );
      const visibility = targetUser?.privacy?.logbookVisibility ?? "public";

      if (visibility === "private") {
        if (viewerId !== userId) {
          return res.status(403).json({ error: "private_logbook" });
        }
      } else if (visibility === "friends") {
        if (!viewerId || viewerId === userId) {
          // non connecté ou soi-même → accès si soi-même, sinon 403
          if (viewerId !== userId) {
            return res.status(403).json({ error: "friends_only_logbook" });
          }
        } else {
          // Vérifier l'amitié
          const friendship = await friendships.findOne({
            status: "accepted",
            $or: [
              { requesterId: viewerId, addresseeId: userId },
              { requesterId: userId, addresseeId: viewerId },
            ],
          });
          if (!friendship) {
            return res.status(403).json({ error: "friends_only_logbook" });
          }
        }
      }

      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const skip = Math.max(parseInt(req.query.skip) || 0, 0);

      const items = await logbook
        .find({ userId })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .project({ notes: 0 }) // don't expose personal notes publicly
        .toArray();

      const total = await logbook.countDocuments({ userId });
      return res.json({ items, total });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
