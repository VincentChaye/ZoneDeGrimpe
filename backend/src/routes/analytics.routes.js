// src/routes/analytics.routes.js
import { Router } from "express";
import { requireAdmin } from "../auth.js";

export function analyticsRouter(db) {
  const r = Router();

  const spots = db.collection("climbing_spot");
  const users = db.collection("users");
  const userGear = db.collection("User_Materiel");
  const gearSpecs = db.collection("Materiel_Specs");

  // Index utiles (no-op si déjà créés)
  spots.createIndex({ name: "text", "properties.tags": "text" }).catch(() => {});
  userGear.createIndex({ "lifecycle.nextInspectionAt": 1, "lifecycle.retiredAt": 1 }).catch(() => {});
  userGear.createIndex({ userId: 1 }).catch(() => {});
  gearSpecs.createIndex({ category: 1 }).catch(() => {});

  /* =====================================================================
   * GET /analytics/spots/textsearch
   * But : recherche plein texte (nom, tags) avec score de pertinence.
   * Entrées : q (requête), limit (≤50).
   * Sortie : items triés par pertinence (nom, type, tags, score).
   * =================================================================== */
  r.get("/spots/textsearch", requireAdmin, async (req, res) => {
    try {
      const q = String(req.query.q ?? "").trim();
      const limit = Math.min(50, parseInt(req.query.limit ?? "20", 10));
      if (!q) return res.json({ items: [] });

      const pipeline = [
        { $match: { $text: { $search: q } } },
        { $addFields: { score: { $meta: "textScore" } } },
        { $sort: { score: -1 } },
        {
          $project: {
            _id: 1,
            name: 1,
            "properties.type": 1,
            "properties.tags": 1,
            score: 1,
          },
        },
        { $limit: limit },
      ];

      const items = await spots.aggregate(pipeline).toArray();
      res.json({ q, count: items.length, items });
    } catch (e) {
      console.error("[analytics/textsearch]", e);
      res.status(500).json({ error: "textsearch_failed" });
    }
  });

  /* =====================================================================
   * GET /analytics/gear/inspections/due
   * But : matériel avec inspection à échéance bientôt.
   * Entrée : withinDays (défaut 30).
   * Règles : non retiré ET nextInspectionAt ≤ now + withinDays.
   * Sortie : items (catégorie, specs, usage, dates) + email via $lookup.
   * =================================================================== */
  r.get("/gear/inspections/due", requireAdmin, async (req, res) => {
    try {
      const withinDays = Math.max(1, parseInt(req.query.withinDays ?? "30", 10));
      const now = new Date();
      const until = new Date(now.getTime() + withinDays * 24 * 3600 * 1000);

      const pipeline = [
        {
          $match: {
            $and: [
              { $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }] },
              { "lifecycle.nextInspectionAt": { $lte: until } },
            ],
          },
        },
        {
          $lookup: {
            from: users.collectionName,
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $set: { user: { $arrayElemAt: ["$user", 0] } } },
        {
          $project: {
            _id: 1,
            userId: 1,
            "user.email": 1,
            category: 1,
            specs: 1,
            "lifecycle.nextInspectionAt": 1,
            "lifecycle.lastInspectionAt": 1,
            "lifecycle.usageCount": 1,
          },
        },
        { $sort: { "lifecycle.nextInspectionAt": 1 } },
      ];

      const items = await userGear.aggregate(pipeline).toArray();
      res.json({ withinDays, count: items.length, items });
    } catch (e) {
      console.error("[analytics/inspections]", e);
      res.status(500).json({ error: "inspections_due_failed" });
    }
  });

  /* =====================================================================
   * GET /analytics/gear/retire-soon
   * But : matériel proche de fin de vie (ratio usage/reco).
   * Entrée : thresholdPct (défaut 0.8).
   * Logique : $lookup Materiel_Specs → recommendedMaxUsage → usageRatio.
   * Sortie : liste triée par usageRatio desc, avec maxUsage & usageCount.
   * =================================================================== */
  r.get("/gear/retire-soon", requireAdmin, async (req, res) => {
    try {
      const thresholdPct = Math.min(0.99, Math.max(0.1, parseFloat(req.query.thresholdPct ?? "0.8")));

      const pipeline = [
        { $match: { $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }] } },
        {
          $lookup: {
            from: gearSpecs.collectionName,
            localField: "category",
            foreignField: "category",
            as: "spec",
          },
        },
        { $set: { spec: { $arrayElemAt: ["$spec", 0] } } },
        {
          $set: {
            maxUsage: { $ifNull: ["$spec.recommendedMaxUsage", 0] },
            usage: { $ifNull: ["$lifecycle.usageCount", 0] },
          },
        },
        {
          $set: {
            usageRatio: {
              $cond: [{ $gt: ["$maxUsage", 0] }, { $divide: ["$usage", "$maxUsage"] }, null],
            },
          },
        },
        { $match: { usageRatio: { $ne: null, $gte: thresholdPct } } },
        {
          $project: {
            _id: 1,
            userId: 1,
            category: 1,
            specs: 1,
            "lifecycle.usageCount": 1,
            maxUsage: 1,
            usageRatio: 1,
          },
        },
        { $sort: { usageRatio: -1 } },
      ];

      const items = await userGear.aggregate(pipeline).toArray();
      res.json({ thresholdPct, count: items.length, items });
    } catch (e) {
      console.error("[analytics/retire-soon]", e);
      res.status(500).json({ error: "retire_soon_failed" });
    }
  });

  /* =====================================================================
   * GET /analytics/spots/leaderboard
   * But : créations par mois.
   * Entrées : from, to (optionnelles).
   * Sortie : series [{ month, count }] triée chronologiquement.
   * =================================================================== */
  r.get("/spots/leaderboard", requireAdmin, async (req, res) => {
    try {
      const from = req.query.from ? new Date(req.query.from) : null;
      const to = req.query.to ? new Date(req.query.to) : null;

      const match = {};
      if (from) match.createdAt = { ...(match.createdAt || {}), $gte: from };
      if (to) match.createdAt = { ...(match.createdAt || {}), $lt: to };

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: { month: { $dateTrunc: { date: "$createdAt", unit: "month" } } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, month: "$_id.month", count: 1 } },
        { $sort: { month: 1 } },
      ];

      const series = await spots.aggregate(pipeline).toArray();
      res.json({ from, to, series });
    } catch (e) {
      console.error("[analytics/leaderboard]", e);
      res.status(500).json({ error: "leaderboard_failed" });
    }
  });

  return r;
}
