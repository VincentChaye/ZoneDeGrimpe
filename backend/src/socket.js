// backend/src/socket.js — Socket.io logic
import { Server } from "socket.io";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";

export function initSocketIO(httpServer, db) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Same logic as Express CORS — allow all configured origins
        cb(null, true);
      },
      credentials: true,
    },
  });

  const conversations = db.collection("conversations");
  const messages = db.collection("messages");
  const users = db.collection("users");

  // Online users map: uid → Set of socket ids
  const onlineUsers = new Map();

  // --- Auth middleware ---
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload?.uid) return next(new Error("unauthorized"));
      socket.uid = payload.uid;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const uid = socket.uid;

    // Track online status
    if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
    onlineUsers.get(uid).add(socket.id);

    // Notify user's conversations that they're online
    broadcastStatus(uid, true);

    // --- Join conversation room ---
    socket.on("join", (convId) => {
      if (typeof convId === "string") {
        socket.join(`conv:${convId}`);
      }
    });

    // --- Leave conversation room ---
    socket.on("leave", (convId) => {
      if (typeof convId === "string") {
        socket.leave(`conv:${convId}`);
      }
    });

    // --- Send message ---
    socket.on("message", async ({ convId, content }, ack) => {
      if (!convId || !content || typeof content !== "string") return;
      const trimmed = content.trim().slice(0, 2000);
      if (!trimmed) return;

      let convObjId;
      try {
        convObjId = new ObjectId(convId);
      } catch {
        return;
      }

      // Verify participant
      const conv = await conversations.findOne({
        _id: convObjId,
        participants: uid,
      });
      if (!conv) return;

      // Insert message
      const msg = {
        conversationId: convObjId,
        senderUid: uid,
        content: trimmed,
        status: "sent",
        createdAt: new Date(),
      };
      const inserted = await messages.insertOne(msg);
      const fullMsg = { ...msg, _id: inserted.insertedId };

      // Update conversation lastMessage + unread for the other participants
      const unreadInc = {};
      for (const p of conv.participants) {
        if (p !== uid) unreadInc[`unread.${p}`] = 1;
      }

      await conversations.updateOne(
        { _id: convObjId },
        {
          $set: {
            lastMessage: { content: trimmed, senderUid: uid, createdAt: msg.createdAt },
            updatedAt: msg.createdAt,
          },
          $inc: unreadInc,
        }
      );

      // Broadcast to all in room
      io.to(`conv:${convId}`).emit("new_message", fullMsg);

      // Also notify offline participants via their personal room
      for (const p of conv.participants) {
        if (p !== uid) {
          io.to(`user:${p}`).emit("conversation_updated", {
            _id: convId,
            lastMessage: fullMsg,
          });
        }
      }

      if (typeof ack === "function") ack({ ok: true, _id: fullMsg._id });
    });

    // --- Typing indicator ---
    socket.on("typing", ({ convId, isTyping }) => {
      if (typeof convId !== "string") return;
      socket.to(`conv:${convId}`).emit("typing", { convId, uid, isTyping: !!isTyping });
    });

    // --- Mark conversation as read ---
    socket.on("read", async (convId) => {
      if (typeof convId !== "string") return;
      try {
        const convObjId = new ObjectId(convId);
        await conversations.updateOne(
          { _id: convObjId, participants: uid },
          { $set: { [`unread.${uid}`]: 0 } }
        );
        // Notify the other participant their messages were read
        socket.to(`conv:${convId}`).emit("message_read", { convId, uid });
      } catch { /* invalid id */ }
    });

    // Join personal room for notifications
    socket.join(`user:${uid}`);

    // --- Disconnect ---
    socket.on("disconnect", () => {
      const sockets = onlineUsers.get(uid);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(uid);
          broadcastStatus(uid, false);
        }
      }
    });

    function broadcastStatus(uid, online) {
      // Broadcast to all rooms this user is in (their conversation partners)
      io.emit("user_status", { uid, online });
    }
  });

  return io;
}
