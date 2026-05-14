// backend/src/routes/messages.routes.js
import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";
import { uploadMessageMedia } from "../upload.js";
import { cleanupUserFromOutings } from "../lib/outings-helpers.js";

export function messagesRouter(db, io) {
  const router = Router();
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");
  const users = db.collection("users");

  conversations.createIndex({ participants: 1 });
  conversations.createIndex({ updatedAt: -1 });
  messages.createIndex({ conversationId: 1, createdAt: -1 });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function fetchParticipantInfo(uids) {
    const objIds = uids.map((id) => new ObjectId(id));
    const docs = await users
      .find({ _id: { $in: objIds } }, { projection: { displayName: 1, avatarUrl: 1 } })
      .toArray();
    return uids.map((id) => {
      const doc = docs.find((u) => u._id.toString() === id);
      return { uid: id, displayName: doc?.displayName ?? id, avatarUrl: doc?.avatarUrl ?? null };
    });
  }

  // ── DM Conversations ─────────────────────────────────────────────────────────

  // GET /api/messages/conversations
  router.get("/conversations", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    try {
      const convs = await conversations
        .find({ participants: uid })
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray();
      res.json(convs);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/messages/conversations — get or create DM
  router.post("/conversations", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const { participantUid } = req.body;
    if (!participantUid || typeof participantUid !== "string")
      return res.status(400).json({ error: "participantUid required" });
    if (participantUid === uid)
      return res.status(400).json({ error: "cannot_message_self" });

    let meObjId, otherObjId;
    try {
      meObjId = new ObjectId(uid);
      otherObjId = new ObjectId(participantUid);
    } catch {
      return res.status(400).json({ error: "invalid_uid" });
    }

    const [me, other] = await Promise.all([
      users.findOne({ _id: meObjId }, { projection: { displayName: 1, avatarUrl: 1 } }),
      users.findOne({ _id: otherObjId }, { projection: { displayName: 1, avatarUrl: 1 } }),
    ]);
    if (!other) return res.status(404).json({ error: "user_not_found" });

    const sorted = [uid, participantUid].sort();
    try {
      // Exclude group conversations from dedup
      let conv = await conversations.findOne({
        type: { $ne: "group" },
        participants: { $all: sorted, $size: 2 },
      });
      if (!conv) {
        const doc = {
          type: "dm",
          participants: sorted,
          participantInfo: [
            { uid, displayName: me?.displayName ?? uid, avatarUrl: me?.avatarUrl ?? null },
            { uid: participantUid, displayName: other.displayName ?? participantUid, avatarUrl: other.avatarUrl ?? null },
          ],
          lastMessage: null,
          unread: { [uid]: 0, [participantUid]: 0 },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const inserted = await conversations.insertOne(doc);
        conv = { ...doc, _id: inserted.insertedId };
      }
      res.json(conv);
    } catch (err) {
      console.error("[messages] POST /conversations error:", err);
      res.status(500).json({ error: "server_error", detail: err.message });
    }
  });

  // ── Group Conversations ───────────────────────────────────────────────────────

  // POST /api/messages/groups — create group
  router.post("/groups", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const { name, participantUids } = req.body;

    if (!name || typeof name !== "string" || !name.trim())
      return res.status(400).json({ error: "name_required" });
    if (!Array.isArray(participantUids) || participantUids.length < 1)
      return res.status(400).json({ error: "at_least_1_participant" });

    const uniqueUids = [...new Set([uid, ...participantUids.filter((id) => typeof id === "string")])];
    if (uniqueUids.length < 2)
      return res.status(400).json({ error: "at_least_2_members" });

    try {
      uniqueUids.forEach((id) => new ObjectId(id));
    } catch {
      return res.status(400).json({ error: "invalid_uid" });
    }

    try {
      const participantInfo = await fetchParticipantInfo(uniqueUids);
      if (participantInfo.length !== uniqueUids.length)
        return res.status(400).json({ error: "user_not_found" });

      const unread = {};
      for (const id of uniqueUids) unread[id] = 0;

      const doc = {
        type: "group",
        groupName: name.trim(),
        groupAvatarUrl: null,
        createdBy: uid,
        admins: [uid],
        participants: uniqueUids,
        participantInfo,
        lastMessage: null,
        unread,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const inserted = await conversations.insertOne(doc);
      const conv = { ...doc, _id: inserted.insertedId };

      for (const p of uniqueUids) {
        if (p !== uid) io?.to(`user:${p}`).emit("conversation_added", conv);
      }
      res.json(conv);
    } catch (err) {
      console.error("[messages] POST /groups error:", err);
      res.status(500).json({ error: "server_error", detail: err.message });
    }
  });

  // PATCH /api/messages/groups/:id — rename / update avatar (admin)
  router.patch("/groups/:id", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, type: "group", participants: uid });
    if (!conv) return res.status(404).json({ error: "group_not_found" });
    if (!conv.admins?.includes(uid)) return res.status(403).json({ error: "admin_only" });

    const { name, groupAvatarUrl } = req.body;
    const patch = { updatedAt: new Date() };
    if (name && typeof name === "string" && name.trim()) patch.groupName = name.trim();
    if (groupAvatarUrl !== undefined) patch.groupAvatarUrl = groupAvatarUrl;

    try {
      await conversations.updateOne({ _id: convId }, { $set: patch });
      const updated = await conversations.findOne({ _id: convId });
      io?.to(`conv:${req.params.id}`).emit("group_updated", updated);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/messages/groups/:id/members — add members (admin)
  router.post("/groups/:id/members", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, type: "group", participants: uid });
    if (!conv) return res.status(404).json({ error: "group_not_found" });
    if (!conv.admins?.includes(uid)) return res.status(403).json({ error: "admin_only" });

    const { uids } = req.body;
    if (!Array.isArray(uids) || uids.length === 0)
      return res.status(400).json({ error: "uids_required" });

    const newUids = uids.filter((id) => typeof id === "string" && !conv.participants.includes(id));
    if (newUids.length === 0) return res.json({ ok: true, added: 0 });

    try {
      newUids.forEach((id) => new ObjectId(id));
    } catch {
      return res.status(400).json({ error: "invalid_uid" });
    }

    try {
      const newInfo = await fetchParticipantInfo(newUids);
      const unreadSet = {};
      for (const id of newUids) unreadSet[`unread.${id}`] = 0;

      await conversations.updateOne(
        { _id: convId },
        {
          $push: { participants: { $each: newUids }, participantInfo: { $each: newInfo } },
          $set: { ...unreadSet, updatedAt: new Date() },
        }
      );
      const updated = await conversations.findOne({ _id: convId });
      io?.to(`conv:${req.params.id}`).emit("group_updated", updated);
      for (const id of newUids) {
        io?.to(`user:${id}`).emit("conversation_added", updated);
      }
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/messages/groups/:id/members/:memberId — remove or leave
  router.delete("/groups/:id/members/:memberId", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const targetUid = req.params.memberId;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, type: "group", participants: uid });
    if (!conv) return res.status(404).json({ error: "group_not_found" });

    const isSelf = targetUid === uid;
    const isAdmin = conv.admins?.includes(uid);
    if (!isSelf && !isAdmin) return res.status(403).json({ error: "admin_only" });
    if (!isSelf && targetUid === conv.createdBy) return res.status(400).json({ error: "cannot_remove_creator" });

    try {
      const unsetField = {};
      unsetField[`unread.${targetUid}`] = "";
      await conversations.updateOne(
        { _id: convId },
        {
          $pull: { participants: targetUid, participantInfo: { uid: targetUid }, admins: targetUid },
          $unset: unsetField,
          $set: { updatedAt: new Date() },
        }
      );
      const updated = await conversations.findOne({ _id: convId });
      io?.to(`conv:${req.params.id}`).emit("group_updated", updated);
      io?.to(`user:${targetUid}`).emit("conversation_removed", { convId: req.params.id });
      await cleanupUserFromOutings(db, io, req.params.id, targetUid);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/messages/groups/:id/admins/:memberId — promote/demote admin
  router.patch("/groups/:id/admins/:memberId", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const targetUid = req.params.memberId;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, type: "group", participants: uid });
    if (!conv) return res.status(404).json({ error: "group_not_found" });
    if (!conv.admins?.includes(uid)) return res.status(403).json({ error: "admin_only" });
    if (!conv.participants.includes(targetUid)) return res.status(400).json({ error: "not_a_member" });

    const { promote } = req.body;
    if (!promote && targetUid === conv.createdBy)
      return res.status(400).json({ error: "cannot_demote_creator" });

    try {
      const op = promote
        ? { $addToSet: { admins: targetUid }, $set: { updatedAt: new Date() } }
        : { $pull: { admins: targetUid }, $set: { updatedAt: new Date() } };
      await conversations.updateOne({ _id: convId }, op);
      const updated = await conversations.findOne({ _id: convId });
      io?.to(`conv:${req.params.id}`).emit("group_updated", updated);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/messages/groups/:id — delete group (creator only)
  router.delete("/groups/:id", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, type: "group", participants: uid });
    if (!conv) return res.status(404).json({ error: "group_not_found" });
    if (conv.createdBy !== uid) return res.status(403).json({ error: "creator_only" });

    try {
      await conversations.deleteOne({ _id: convId });
      await messages.deleteMany({ conversationId: convId });
      await db.collection("outings").deleteMany({ conversationId: convId });
      for (const p of conv.participants) {
        io?.to(`user:${p}`).emit("conversation_removed", { convId: req.params.id });
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── Messages ──────────────────────────────────────────────────────────────────

  // GET /api/messages/conversations/:id/messages
  router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const conv = await conversations.findOne({ _id: convId, participants: uid });
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });

    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const query = { conversationId: convId };
    if (req.query.before) {
      try { query._id = { $lt: new ObjectId(req.query.before) }; } catch { /* ignore */ }
    }

    try {
      const msgs = await messages.find(query).sort({ _id: -1 }).limit(limit).toArray();
      res.json(msgs.reverse());
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/messages/upload — upload media file (image or video)
  router.post("/upload", requireAuth, (req, res, next) => {
    uploadMessageMedia.single("file")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "file_too_large" });
        return res.status(400).json({ error: err.message || "upload_failed" });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const isVideo = req.file.mimetype.startsWith("video/");
    res.json({
      url: req.file.path,
      publicId: req.file.filename,
      type: isVideo ? "video" : "image",
      mimeType: req.file.mimetype,
    });
  });

  // PATCH /api/messages/conversations/:id/read
  router.patch("/conversations/:id/read", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try { convId = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    try {
      await conversations.updateOne(
        { _id: convId, participants: uid },
        { $set: { [`unread.${uid}`]: 0 } }
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}
