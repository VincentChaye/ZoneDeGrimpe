// src/routes/advice.routes.js
import { Router } from "express";
import { ObjectId } from "mongodb";

/* ---------- Helpers ---------- */

// N, NE, E, SE, S, SW, W, NW (option multi: "SE,SW")
function parseExpositions(input) {
  if (!input) return null;
  const valid = new Set(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);
  const arr = String(input)
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .filter(v => valid.has(v));
  return arr.length ? arr : null;
}

// Normalise un grade FR en valeur numérique approximative (3..9 a/b/c +)
function normalizeGrade(str) {
  if (str == null) return null;
  if (typeof str === "number") return str;
  const s = String(str).toLowerCase().trim();
  if (!isNaN(Number(s))) return Number(s);
  const m = s.match(/^([3-9])\s*([abc])?(\+)?$/);
  if (!m) return null;
  const base = Number(m[1]);
  const letter = m[2] || null;
  const plus = !!m[3];
  const letterMap = { a: 0.0, b: 0.3, c: 0.6 };
  let val = base + (letter ? letterMap[letter] : 0);
  if (plus) val += 0.09;
  return Number(val.toFixed(2));
}

// Résume l’inventaire utilisateur (garde la corde la plus longue, somme des dégaines)
function summarizeUserGear(gearDocs) {
  const out = {
    rope_m: 0,
    qd_count: 0,
    hasHelmet: false,
    hasAdjustableLanyard: false,
    hasLockingBiners: 0,
    categories: new Set(),
  };
  for (const g of gearDocs) {
    if (g?.lifecycle?.retiredAt) continue;
    const cat = (g.category || "").toLowerCase();
    out.categories.add(g.category);
    // Corde
    if (cat.includes("corde")) {
      const len = Number(g?.specs?.length_m ?? 0);
      if (len > out.rope_m) out.rope_m = len;
    }
    // Dégaines
    if (cat.includes("dégaine") || cat.includes("degaine")) {
      const cnt = Number(g?.specs?.count ?? g?.specs?.qty ?? 0);
      out.qd_count += isNaN(cnt) ? 0 : cnt;
    }
    // Casque
    if (cat.includes("casque")) out.hasHelmet = true;
    // Longe
    if (cat.includes("longe") || cat.includes("vache")) out.hasAdjustableLanyard = true;
    // Mousquetons à vis
    if (cat.includes("mousqueton")) {
      const locking = Number(g?.specs?.locking ?? g?.specs?.count ?? g?.specs?.qty ?? 0);
      out.hasLockingBiners += isNaN(locking) ? 0 : locking;
    }
  }
  return out;
}

export function adviceRouter(db) {
  const r = Router();
  const spots = db.collection("climbing_spot");
  const userGear = db.collection("User_Materiel");

  // Index safe (si déjà créés, catch no-op)
  // L'index 2dsphere est géré dans db.js pour éviter les conflits
  spots.createIndex({ name: "text", "properties.tags": "text" }).catch(() => {});
  spots.createIndex({ "properties.orientation": 1 }).catch(() => {});
  spots.createIndex({ "properties.grade_mean_num": 1 }).catch(() => {});
  userGear.createIndex({ userId: 1, "lifecycle.retiredAt": 1 }).catch(() => {});

  /* =====================================================================
   * 1) Conseils matériel basés sur l’inventaire + (optionnel) spots proches
   * GET /advice/material?userId=<id>&lat=..&lng=..&maxKm=30
   * - Sans lat/lng: on scanne un échantillon de spots (200) pour estimer besoins
   * - Avec lat/lng: on scanne les spots à proximité via $geoNear (plus pertinent)
   * Retour:
   *  - summaryInventaire (corde, dégaines, casque, longe, mousquetons)
   *  - besoins (max requis observé, % de spots où ton matos est insuffisant)
   *  - recommandations concrètes (à acheter/compléter)
   * =================================================================== */
  r.get("/material", async (req, res) => {
    try {
      const userId = (() => {
        try { return new ObjectId(String(req.query.userId)); } catch { return null; }
      })();
      if (!userId) {
        return res.status(400).json({ error: "invalid_userId" });
      }

      // Récup inventaire
      const gearDocs = await userGear.find({
        userId,
        $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }],
      }).toArray();
      const inv = summarizeUserGear(gearDocs);

      // Paramètres proximité optionnels
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);
      const maxKm = Math.max(5, parseFloat(req.query.maxKm ?? "30"));
      const sampleLimit = 200;

      // Pipeline spots: proche si coords, sinon échantillon aléatoire
      let pipeline = [];
      if (hasCoords) {
        pipeline = [
          {
            $geoNear: {
              near: { type: "Point", coordinates: [lng, lat] },
              distanceField: "dist_m",
              spherical: true,
              maxDistance: maxKm * 1000,
            },
          },
          { $match: { $or: [{ "properties.type": "falaise" }, { type: "falaise" }] } },
          { $project: { "properties.required_rope_m": 1, "properties.required_qd": 1 } },
        ];
      } else {
        pipeline = [
          { $match: { $or: [{ "properties.type": "falaise" }, { type: "falaise" }] } },
          { $sample: { size: sampleLimit } },
          { $project: { "properties.required_rope_m": 1, "properties.required_qd": 1 } },
        ];
      }

      const reqs = await spots.aggregate(pipeline, { allowDiskUse: true }).toArray();
      const DEF = { rope_m: 60, qd: 12 };

      // Stats besoins observés
      let maxReqRope = 0, maxReqQd = 0, insufficientRope = 0, insufficientQd = 0, total = 0;
      for (const s of reqs) {
        total++;
        const rRope = Number(s?.properties?.required_rope_m ?? DEF.rope_m);
        const rQd = Number(s?.properties?.required_qd ?? DEF.qd);
        if (rRope > maxReqRope) maxReqRope = rRope;
        if (rQd > maxReqQd) maxReqQd = rQd;
        if (inv.rope_m < rRope) insufficientRope++;
        if (inv.qd_count < rQd) insufficientQd++;
      }

      const percent = v => (total ? Math.round((v / total) * 100) : 0);

      // Recommandations concrètes
      const recommendations = [];
      if (inv.rope_m < 70 && maxReqRope >= 70) {
        recommendations.push({
          category: "Corde",
          reason: "Beaucoup de falaises autour exigent ≥70 m",
          suggestion: "Corde à simple 70 m (≈9.7–9.8mm) pour polyvalence falaise",
        });
      } else if (inv.rope_m < maxReqRope && maxReqRope > 0) {
        recommendations.push({
          category: "Corde",
          reason: `Certaines voies demandent ${maxReqRope} m`,
          suggestion: `Envisage une corde ${maxReqRope} m pour élargir tes options`,
        });
      }

      if (inv.qd_count < 12 && maxReqQd >= 12) {
        recommendations.push({
          category: "Dégaines",
          reason: "La plupart des voies sportives demandent 12–16 dégaines",
          suggestion: "Complète ton jeu à 12–16 dégaines",
        });
      } else if (inv.qd_count < maxReqQd && maxReqQd > 0) {
        recommendations.push({
          category: "Dégaines",
          reason: `Des secteurs exigent jusqu’à ${maxReqQd} dégaines`,
          suggestion: `Ajoute quelques dégaines pour atteindre ${maxReqQd}`,
        });
      }

      if (!inv.hasHelmet) {
        recommendations.push({
          category: "Casque",
          reason: "Sécurité pierres/écailles + relais",
          suggestion: "Casque léger type 'alpi/esc' (bon maintien et ventilation)",
        });
      }
      if (!inv.hasAdjustableLanyard) {
        recommendations.push({
          category: "Longe",
          reason: "Confort/manips aux relais",
          suggestion: "Longe réglable ou vache en sangle dynamique",
        });
      }
      if (inv.hasLockingBiners < 2) {
        recommendations.push({
          category: "Mousquetons à vis",
          reason: "Relais & sécurité moulinette",
          suggestion: "Avoir au moins 2–3 mousquetons à vis",
        });
      }

      res.json({
        scope: hasCoords ? { nearby: true, maxKm } : { nearby: false, sample: sampleLimit },
        summaryInventaire: {
          rope_m: inv.rope_m,
          qd_count: inv.qd_count,
          hasHelmet: inv.hasHelmet,
          hasAdjustableLanyard: inv.hasAdjustableLanyard,
          lockingBiners: inv.hasLockingBiners,
        },
        besoinsObserves: {
          totalSpotsAnalyses: total,
          maxRequired: { rope_m: maxReqRope || null, qd: maxReqQd || null },
          insuffisant: {
            rope: { count: insufficientRope, pct: percent(insufficientRope) },
            qd: { count: insufficientQd, pct: percent(insufficientQd) },
          },
        },
        recommandations: recommendations,
      });
    } catch (e) {
      console.error("[advice/material]", e);
      res.status(500).json({ error: "advice_material_failed" });
    }
  });

  /* =====================================================================
   * 2) Suggestions de falaises selon profil & matos existant
   * GET /advice/spots?userId=<id>&lat=..&lng=..&maxKm=40&niveau_min=6a&exposition=SE,SW&limit=30
   * Retourne trois listes:
   *  - compatible: tout ok (niveau + matos)
   *  - challenge: niveau un peu au-dessus (mais matos ok)
   *  - gear_blocked: intéressant mais bloqué par le matos (corde/dégaines)
   * =================================================================== */
  r.get("/spots", async (req, res) => {
    try {
      const userId = (() => {
        try { return new ObjectId(String(req.query.userId)); } catch { return null; }
      })();
      if (!userId) return res.status(400).json({ error: "invalid_userId" });

      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return res.status(400).json({ error: "invalid_coords" });
      }
      const maxKm = Math.max(5, parseFloat(req.query.maxKm ?? "40"));
      const limit = Math.min(100, parseInt(req.query.limit ?? "30", 10));
      const exps = parseExpositions(req.query.exposition);
      const gMin = normalizeGrade(req.query.niveau_min ?? "");

      // Inventaire
      const gearDocs = await userGear.find({
        userId,
        $or: [{ "lifecycle.retiredAt": null }, { "lifecycle.retiredAt": { $exists: false } }],
      }).toArray();
      const inv = summarizeUserGear(gearDocs);
      const DEF = { rope_m: 60, qd: 12 };

      // Base pipeline
      const match = { $and: [{ $or: [{ "properties.type": "falaise" }, { type: "falaise" }] }] };
      if (exps) match.$and.push({ "properties.orientation": { $in: exps } });

      const pipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "dist_m",
            spherical: true,
            maxDistance: maxKm * 1000,
          },
        },
        { $match: match },
        {
          $project: {
            name: 1,
            location: 1,
            dist_m: 1,
            "properties.orientation": 1,
            "properties.grade_mean": 1,
            "properties.grade_mean_num": 1,
            "properties.required_rope_m": 1,
            "properties.required_qd": 1,
          },
        },
        { $limit: limit },
      ];

      const raw = await spots.aggregate(pipeline, { allowDiskUse: true }).toArray();

      // Partition en 3 catégories
      const compatible = [];
      const challenge = [];
      const gear_blocked = [];

      for (const s of raw) {
        const ropeReq = Number(s?.properties?.required_rope_m ?? DEF.rope_m);
        const qdReq = Number(s?.properties?.required_qd ?? DEF.qd);
        const gradeNum = typeof s?.properties?.grade_mean_num === "number"
          ? s.properties.grade_mean_num
          : normalizeGrade(s?.properties?.grade_mean);

        const gearOK = (inv.rope_m || 0) >= ropeReq && (inv.qd_count || 0) >= qdReq;

        // Niveau: si non fourni, tout passe; sinon compare
        let levelFlag = "any"; // any | match | challenge
        if (gMin != null && gradeNum != null) {
          if (gradeNum >= gMin && gradeNum <= gMin + 0.5) levelFlag = "match";
          else if (gradeNum > gMin + 0.5 && gradeNum <= gMin + 0.9) levelFlag = "challenge";
          else levelFlag = "any";
        }

        const base = {
          _id: s._id,
          name: s.name,
          dist_m: s.dist_m,
          orientation: s?.properties?.orientation ?? null,
          grade_mean: s?.properties?.grade_mean ?? null,
          grade_mean_num: gradeNum ?? null,
          required_rope_m: ropeReq,
          required_qd: qdReq,
          gear: {
            ok: gearOK,
            have: { rope_m: inv.rope_m, qd_count: inv.qd_count },
          },
          location: s.location,
        };

        if (!gearOK) {
          gear_blocked.push({
            ...base,
            gear: { ...base.gear, missing: [
              ...(inv.rope_m < ropeReq ? [`Corde ${ropeReq}m`] : []),
              ...(inv.qd_count < qdReq ? [`Dégaines x${qdReq}`] : []),
            ] },
          });
          continue;
        }

        if (levelFlag === "challenge") challenge.push(base);
        else compatible.push(base);
      }

      res.json({
        params: {
          userId: String(userId),
          maxKm,
          exposition: exps,
          niveau_min: req.query.niveau_min ?? null,
          limit,
        },
        inventory: { rope_m: inv.rope_m, qd_count: inv.qd_count },
        counts: {
          compatible: compatible.length,
          challenge: challenge.length,
          gear_blocked: gear_blocked.length,
        },
        compatible,
        challenge,
        gear_blocked,
      });
    } catch (e) {
      console.error("[advice/spots]", e);
      res.status(500).json({ error: "advice_spots_failed" });
    }
  });

  return r;
}
