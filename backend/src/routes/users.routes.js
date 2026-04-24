import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth, requireAdmin } from "../auth.js";
import { uploadAvatar, cloudinary } from "../upload.js";

export function usersRouter(db) {
  const r = Router();
  const users = db.collection("users");

  // Index
  users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  users.createIndex({ displayName: "text", email: "text" }).catch(() => {});

  // Constantes
  const LEVELS = ["debutant", "intermediaire", "avance"];
  const SAFE_PROJECTION = { passwordHash: 0 };

  function normalizeLevel(v) {
    if (v == null) return null;
    const s = String(v).toLowerCase().trim();
    return LEVELS.includes(s) ? s : null;
  }

  // --- GET /api/users/check-username/:username (public) ---
  r.get("/check-username/:username", async (req, res) => {
    try {
      const username = String(req.params.username).trim().toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        return res.json({ available: false, reason: "invalid_format" });
      }
      const exists = await users.findOne({ username });
      return res.json({ available: !exists });
    } catch {
      return res.status(500).json({ error: "server_error" });
    }
  });

  // Empêche /:id d'attraper /me
  r.param("id", (req, res, next, id) => {
    if (id === "me") return next("route");
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: "bad_id" });
    return next();
  });

  // --- GET /api/users/me ---
  r.get("/me", requireAuth, async (req, res) => {
    try {
      const uid = req.auth?.uid;
      if (!ObjectId.isValid(uid)) return res.status(401).json({ error: "unauthorized" });
      const user = await users.findOne({ _id: new ObjectId(uid) }, { projection: SAFE_PROJECTION });
      if (!user) return res.status(404).json({ error: "not_found" });
      if (!user.profile) user.profile = {};
      if (!user.profile.level) user.profile.level = "debutant";
      return res.json(user);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- PATCH /api/users/me ---
  r.patch("/me", requireAuth, async (req, res) => {
    try {
      const uid = new ObjectId(req.auth.uid);
      const body = req.body || {};
      const $set = {};

      if (body.username !== undefined) {
        const uname = String(body.username).trim().toLowerCase();
        if (!/^[a-z0-9_]{3,30}$/.test(uname)) {
          return res.status(400).json({ error: "username_invalid_format", detail: "3-30 chars, alphanumeric and underscores only" });
        }
        // Check uniqueness (excluding self)
        const taken = await users.findOne({ username: uname, _id: { $ne: uid } });
        if (taken) return res.status(409).json({ error: "username_taken" });
        $set.username = uname;
      }
      if (body.displayName !== undefined) {
        if (typeof body.displayName !== "string" || !body.displayName.trim()) {
          return res.status(400).json({ error: "invalid_payload", detail: "displayName must be a non-empty string" });
        }
        $set.displayName = body.displayName.trim();
      }
      // avatarUrl intentionnellement ignoré : passer par POST /api/users/me/avatar
      if (body.phone !== undefined) {
        if (body.phone !== null && typeof body.phone !== "string") {
          return res.status(400).json({ error: "invalid_payload", detail: "phone must be string or null" });
        }
        $set.phone = body.phone === "" ? null : body.phone;
      }
      if (body.level !== undefined) {
        const lvl = normalizeLevel(body.level);
        if (!lvl) return res.status(400).json({ error: "invalid_level", allowed: LEVELS });
        $set["profile.level"] = lvl;
      }
      if (body.bio !== undefined) {
        if (body.bio !== null && typeof body.bio !== "string") {
          return res.status(400).json({ error: "invalid_payload", detail: "bio must be string or null" });
        }
        const bio = body.bio === "" ? null : String(body.bio || "").trim().slice(0, 160);
        $set["profile.bio"] = bio;
      }
      if (body.isPrivate !== undefined) {
        $set["privacy.isPrivate"] = !!body.isPrivate;
      }
      if (body.logbookVisibility !== undefined) {
        const allowed = ["public", "friends", "private"];
        if (!allowed.includes(body.logbookVisibility)) {
          return res.status(400).json({ error: "invalid_logbook_visibility", allowed });
        }
        $set["privacy.logbookVisibility"] = body.logbookVisibility;
      }
      if (body.gearVisibility !== undefined) {
        const allowed = ["public", "friends", "private"];
        if (!allowed.includes(body.gearVisibility)) {
          return res.status(400).json({ error: "invalid_gear_visibility", allowed });
        }
        $set["privacy.gearVisibility"] = body.gearVisibility;
      }
      if (body.notificationPreferences !== undefined) {
        const np = body.notificationPreferences;
        if (typeof np !== "object" || Array.isArray(np)) {
          return res.status(400).json({ error: "invalid_payload", detail: "notificationPreferences must be object" });
        }
        const boolKeys = ["friendRequest", "friendAccepted", "newFollower", "spotApproved", "spotRejected", "newReview"];
        for (const k of boolKeys) {
          if (np[k] !== undefined) $set[`notificationPreferences.${k}`] = !!np[k];
        }
        if (np.quietMode !== undefined && typeof np.quietMode === "object") {
          const qm = np.quietMode;
          if (qm.enabled !== undefined) $set["notificationPreferences.quietMode.enabled"] = !!qm.enabled;
          if (qm.startHour !== undefined) {
            const h = parseInt(qm.startHour, 10);
            if (h >= 0 && h <= 23) $set["notificationPreferences.quietMode.startHour"] = h;
          }
          if (qm.endHour !== undefined) {
            const h = parseInt(qm.endHour, 10);
            if (h >= 0 && h <= 23) $set["notificationPreferences.quietMode.endHour"] = h;
          }
        }
      }

      if (!Object.keys($set).length) {
        const user0 = await users.findOne({ _id: uid }, { projection: SAFE_PROJECTION });
        if (!user0) return res.status(404).json({ error: "not_found" });
        if (!user0.profile) user0.profile = {};
        if (!user0.profile.level) user0.profile.level = "debutant";
        return res.json(user0);
      }

      $set["security.updatedAt"] = new Date();
      const result = await users.updateOne({ _id: uid }, { $set }, { bypassDocumentValidation: true });
      if (result.matchedCount === 0) return res.status(404).json({ error: "not_found" });

      const user = await users.findOne({ _id: uid }, { projection: SAFE_PROJECTION });
      if (!user.profile) user.profile = {};
      if (!user.profile.level) user.profile.level = "debutant";
      return res.json(user);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- POST /api/users/me/avatar --- Upload avatar via Cloudinary
  r.post("/me/avatar", requireAuth, (req, res, next) => {
    uploadAvatar.single("avatar")(req, res, (err) => {
      if (err) {
        console.error("[multer/cloudinary avatar error]", err.message);
        return res.status(500).json({ error: "upload_failed", detail: err.message });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    try {
      const uid = new ObjectId(req.auth.uid);
      const current = await users.findOne({ _id: uid }, { projection: { avatarPublicId: 1 } });

      // Supprimer l'ancienne si elle existe dans Cloudinary
      if (current?.avatarPublicId) {
        await cloudinary.uploader.destroy(current.avatarPublicId).catch(() => {});
      }

      await users.updateOne(
        { _id: uid },
        { $set: { avatarUrl: req.file.path, avatarPublicId: req.file.filename, "security.updatedAt": new Date() } }
      );

      const updated = await users.findOne({ _id: uid }, { projection: { passwordHash: 0 } });
      return res.json(updated);
    } catch (e) {
      console.error("[POST /users/me/avatar]", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- DELETE /api/users/me/avatar --- Supprimer avatar
  r.delete("/me/avatar", requireAuth, async (req, res) => {
    try {
      const uid = new ObjectId(req.auth.uid);
      const current = await users.findOne({ _id: uid }, { projection: { avatarPublicId: 1 } });

      if (current?.avatarPublicId) {
        await cloudinary.uploader.destroy(current.avatarPublicId).catch(() => {});
      }

      await users.updateOne(
        { _id: uid },
        { $unset: { avatarUrl: "", avatarPublicId: "" }, $set: { "security.updatedAt": new Date() } }
      );

      return res.json({ ok: true });
    } catch (e) {
      console.error("[DELETE /users/me/avatar]", e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/users/search?q=xxx (auth) — recherche par username/displayName ---
  r.get("/search", requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase();
      if (q.length < 2) return res.json([]);
      const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const results = await users
        .find(
          { $or: [{ username: rx }, { displayName: rx }] },
          { projection: { _id: 1, displayName: 1, username: 1, avatarUrl: 1 } },
        )
        .limit(10)
        .toArray();
      // Exclude self
      const filtered = results.filter((u) => String(u._id) !== req.auth.uid);
      return res.json(filtered);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/users/count (public) ---
  r.get("/count", async (_req, res) => {
    try {
      const count = await users.countDocuments();
      return res.json({ count });
    } catch {
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/users (admin uniquement) ---
  r.get("/", requireAdmin, async (req, res) => {
    try {
      const { search = "", limit = 20, skip = 0 } = req.query;
      const lim = Math.max(1, Math.min(parseInt(limit, 10) || 20, 200));
      const sk = Math.max(0, parseInt(skip, 10) || 0);
      const q = String(search || "").trim();

      let filter = {};
      let projection = SAFE_PROJECTION;
      let sort = { "security.createdAt": -1, _id: -1 };

      if (q) {
        const looksLikeEmail = q.includes("@");
        if (looksLikeEmail) {
          filter = { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } };
        } else {
          filter = { $text: { $search: q } };
          projection = { ...SAFE_PROJECTION, score: { $meta: "textScore" } };
          sort = { score: { $meta: "textScore" } };
        }
      }

      let items, total;
      try {
        [items, total] = await Promise.all([
          users.find(filter, { projection }).sort(sort).skip(sk).limit(lim).toArray(),
          users.countDocuments(filter),
        ]);
      } catch {
        const rx = q ? { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } : null;
        filter = q ? { $or: [{ displayName: rx }, { email: rx }] } : {};
        [items, total] = await Promise.all([
          users.find(filter, { projection: SAFE_PROJECTION }).sort({ "security.createdAt": -1, _id: -1 }).skip(sk).limit(lim).toArray(),
          users.countDocuments(filter),
        ]);
      }

      return res.json({ items, total, limit: lim, skip: sk });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/users/:id/public --- Profil public (sans auth)
  r.get("/:id/public", async (req, res) => {
    try {
      const uid = req.params.id;
      if (!ObjectId.isValid(uid)) return res.status(400).json({ error: "bad_id" });

      const doc = await users.findOne(
        { _id: new ObjectId(uid) },
        { projection: { username: 1, displayName: 1, avatarUrl: 1, profile: 1, roles: 1, "security.createdAt": 1 } }
      );
      if (!doc) return res.status(404).json({ error: "not_found" });

      const spots = db.collection("climbing_spot");
      const follows = db.collection("follows");
      const friendships = db.collection("friendships");

      const [spotsCount, followersCount, friendsCount] = await Promise.all([
        spots.countDocuments({
          $or: [{ "createdBy.uid": uid }, { "submittedBy.uid": uid }],
          status: { $nin: ["pending", "rejected"] },
        }),
        follows.countDocuments({ followingId: uid }),
        friendships.countDocuments({
          $or: [{ requesterId: uid }, { addresseeId: uid }],
          status: "accepted",
        }),
      ]);

      return res.json({
        _id: doc._id,
        username: doc.username || null,
        displayName: doc.displayName,
        avatarUrl: doc.avatarUrl || null,
        level: doc.profile?.level || "debutant",
        roles: doc.roles || ["user"],
        memberSince: doc.security?.createdAt || null,
        stats: {
          spotsContributed: spotsCount,
          followersCount,
          friendsCount,
        },
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- GET /api/users/:id --- (self ou admin uniquement)
  r.get("/:id", requireAuth, async (req, res) => {
    try {
      const isAdmin = req.auth.roles?.includes("admin");
      const isSelf = req.auth.uid === req.params.id;
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ error: "forbidden" });
      }
      const doc = await users.findOne({ _id: new ObjectId(req.params.id) }, { projection: SAFE_PROJECTION });
      if (!doc) return res.status(404).json({ error: "not_found" });
      return res.json(doc);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- PATCH /api/users/:id ---
  r.patch("/:id", requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles?.includes("admin");
    const isSelf = req.auth.uid === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const updateSet = sanitizePartialUpdate(req.body ?? {}, isAdmin);
      if (!Object.keys(updateSet).length) {
        return res.status(400).json({ error: "invalid_payload", detail: "empty_update" });
      }
      const result = await users.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { ...updateSet, "security.updatedAt": new Date() } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, modified: result.modifiedCount === 1 });
    } catch (e) {
      if (e?.code === 11000) return res.status(409).json({ error: "conflict", detail: "email_already_exists" });
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  // --- DELETE /api/users/:id ---
  r.delete("/:id", requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles?.includes("admin");
    const isSelf = req.auth.uid === req.params.id;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const result = await users.deleteOne({ _id: new ObjectId(req.params.id) });
      return res.json({ deleted: result.deletedCount === 1 });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}

function sanitizePartialUpdate(body = {}, isAdmin = false) {
  const set = {};
  const allowedRoles  = ["user", "admin", "moderator"];
  const allowedStatus = ["active", "banned", "pending"];

  if (body.username !== undefined) {
    const uname = String(body.username).trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(uname)) throw new Error("Invalid 'username'");
    set.username = uname;
  }
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string" || !body.displayName.trim()) throw new Error("Invalid 'displayName'");
    set.displayName = body.displayName.trim();
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid 'email'");
    set.email = email;
  }
  if (body.roles !== undefined) {
    if (!isAdmin) throw new Error("Forbidden: only admin can change roles");
    if (!Array.isArray(body.roles) || body.roles.some(r => !allowedRoles.includes(r))) throw new Error("Invalid 'roles'");
    set.roles = body.roles;
  }
  if (body.status !== undefined) {
    if (!isAdmin) throw new Error("Forbidden: only admin can change status");
    if (!allowedStatus.includes(body.status)) throw new Error("Invalid 'status'");
    set.status = body.status;
  }
  if (body.emailVerified !== undefined) {
    if (!isAdmin) throw new Error("Forbidden: only admin can change emailVerified");
    set.emailVerified = !!body.emailVerified;
  }
  // avatarUrl intentionnellement ignoré : passer par POST /api/users/me/avatar
  if (body.phone !== undefined) {
    if (body.phone !== null && typeof body.phone !== "string") throw new Error("Invalid 'phone'");
    set.phone = body.phone;
  }
  if (body.preferences !== undefined) {
    if (typeof body.preferences !== "object" || Array.isArray(body.preferences)) throw new Error("Invalid 'preferences'");
    const json = JSON.stringify(body.preferences);
    if (json.length > 5000) throw new Error("preferences too large");
    if (json.includes('"$')) throw new Error("Invalid key in preferences");
    set.preferences = body.preferences;
  }
  if (body.profile !== undefined) {
    if (typeof body.profile !== "object" || Array.isArray(body.profile)) throw new Error("Invalid 'profile'");
    const json = JSON.stringify(body.profile);
    if (json.length > 5000) throw new Error("profile too large");
    if (json.includes('"$')) throw new Error("Invalid key in profile");
    set.profile = body.profile;
  }
  return set;
}
