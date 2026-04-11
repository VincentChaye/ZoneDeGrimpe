// backend/src/routes/messages.routes.js
import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";

export function messagesRouter(db) {
  const router = Router();
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");
  const users = db.collection("users");

  // --- Ensure indexes ---
  conversations.createIndex({ participants: 1 });
  conversations.createIndex({ updatedAt: -1 });
  messages.createIndex({ conversationId: 1, createdAt: -1 });

  // GET /api/messages/conversations — list my conversations
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

  // POST /api/messages/conversations — get or create conversation with another user
  router.post("/conversations", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const { participantUid } = req.body;

    if (!participantUid || typeof participantUid !== "string") {
      return res.status(400).json({ error: "participantUid required" });
    }
    if (participantUid === uid) {
      return res.status(400).json({ error: "cannot_message_self" });
    }

    // Get both user infos
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

    // Sorted participants for dedup
    const sorted = [uid, participantUid].sort();

    try {
      // Try to find existing conversation first
      let conv = await conversations.findOne({
        participants: { $all: sorted, $size: 2 },
      });

      if (!conv) {
        const unread = {};
        unread[uid] = 0;
        unread[participantUid] = 0;

        const doc = {
          participants: sorted,
          participantInfo: [
            {
              uid,
              displayName: me?.displayName ?? uid,
              avatarUrl: me?.avatarUrl ?? null,
            },
            {
              uid: participantUid,
              displayName: other.displayName ?? participantUid,
              avatarUrl: other.avatarUrl ?? null,
            },
          ],
          lastMessage: null,
          unread,
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

  // GET /api/messages/conversations/:id/messages — cursor pagination
  router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try {
      convId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "invalid_id" });
    }

    // Verify participant
    const conv = await conversations.findOne({ _id: convId, participants: uid });
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });

    const limit = Math.min(parseInt(req.query.limit) || 30, 50);
    const before = req.query.before; // _id cursor

    const query = { conversationId: convId };
    if (before) {
      try {
        query._id = { $lt: new ObjectId(before) };
      } catch { /* ignore invalid cursor */ }
    }

    try {
      const msgs = await messages
        .find(query)
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();
      // Return oldest-first for UI
      res.json(msgs.reverse());
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/messages/conversations/:id/read — mark as read
  router.patch("/conversations/:id/read", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let convId;
    try {
      convId = new ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ error: "invalid_id" });
    }

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
