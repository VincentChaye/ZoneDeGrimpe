import { Router } from "express";
import { ObjectId } from "mongodb";
import { requireAuth } from "../auth.js";
import { z } from "zod";

const GEAR_CATS = ["rope", "quickdraw", "belay_auto", "belay_tube", "harness", "shoes", "carabiner", "machard", "crashpad", "quicklink"];

// ── Schemas ──────────────────────────────────────────────────────────────────

const categoryItemSchema = z.object({
  id: z.string().optional(),
  kind: z.literal("category"),
  category: z.enum(GEAR_CATS),
  quantityNeeded: z.number().int().min(1).max(999),
});

const customItemSchema = z.object({
  id: z.string().optional(),
  kind: z.literal("custom"),
  label: z.string().min(1).max(100),
  quantityNeeded: z.number().int().min(1).max(999),
});

const itemSchema = z.discriminatedUnion("kind", [categoryItemSchema, customItemSchema]);

const createOutingSchema = z.object({
  conversationId: z.string().regex(/^[a-f\d]{24}$/i),
  title: z.string().min(1).max(100).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  items: z.array(itemSchema).min(1).max(50),
});

const updateOutingSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Au moins un champ requis" });

const upsertItemsSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
});

const claimSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function canEdit(conv, outing, uid) {
  if (outing.createdBy === uid) return true;
  if (conv.type !== "group") return conv.participants.includes(uid);
  return conv.admins?.includes(uid) ?? false;
}

function buildClaimSnapshot(conv, uid, quantity) {
  const info = conv.participantInfo?.find((p) => p.uid === uid);
  return {
    claimId: new ObjectId().toString(),
    uid,
    displayName: info?.displayName || uid,
    avatarUrl: info?.avatarUrl || null,
    quantity,
    claimedAt: new Date(),
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export function outingsRouter(db, io) {
  const router = Router();
  const outings = db.collection("outings");
  const conversations = db.collection("conversations");
  const messages = db.collection("messages");

  // Indexes
  outings.createIndex({ conversationId: 1, status: 1 }).catch(() => {});
  outings.createIndex({ conversationId: 1, createdAt: -1 }).catch(() => {});
  outings.createIndex(
    { conversationId: 1 },
    { unique: true, partialFilterExpression: { status: "active" } }
  ).catch(() => {});

  async function getConv(convIdStr, uid) {
    let convId;
    try { convId = new ObjectId(convIdStr); } catch { return null; }
    return conversations.findOne({ _id: convId, participants: uid });
  }

  async function insertSystemMessage(convId, type, actorUid, outingId) {
    const msg = {
      conversationId: convId,
      senderUid: null,
      content: "",
      systemEvent: { type, outingId: outingId.toString(), actorUid },
      status: "sent",
      createdAt: new Date(),
    };
    const result = await messages.insertOne(msg);
    msg._id = result.insertedId;
    io?.to(`conv:${convId}`).emit("new_message", msg);
  }

  // GET /api/outings?conversationId=&status=active|completed|all&limit=
  router.get("/", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const { conversationId, status = "active", limit: limitStr } = req.query;
    if (!conversationId) return res.status(400).json({ error: "conversationId_required" });

    const conv = await getConv(conversationId, uid);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });

    const query = { conversationId: conv._id };
    if (status !== "all") query.status = status;

    const limit = Math.min(parseInt(limitStr) || 20, 50);
    try {
      const list = await outings.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
      res.json(list);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/outings/:id
  router.get("/:id", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    try {
      const outing = await outings.findOne({ _id: id });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv) return res.status(403).json({ error: "forbidden" });
      res.json(outing);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/outings — create
  router.post("/", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    const parsed = createOutingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });

    const { conversationId, title, scheduledAt, location, notes, items } = parsed.data;
    const conv = await getConv(conversationId, uid);
    if (!conv) return res.status(404).json({ error: "conversation_not_found" });

    const info = conv.participantInfo?.find((p) => p.uid === uid);
    const now = new Date();

    const doc = {
      conversationId: conv._id,
      createdBy: uid,
      createdByInfo: { uid, displayName: info?.displayName || uid, avatarUrl: info?.avatarUrl || null },
      title: title || "Sortie grimpe",
      scheduledAt: scheduledAt || null,
      location: location || null,
      notes: notes || null,
      status: "active",
      completedAt: null,
      completedBy: null,
      items: items.map((item) => ({ ...item, id: item.id || new ObjectId().toString(), claims: [] })),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await outings.insertOne(doc);
      doc._id = result.insertedId;
      io?.to(`conv:${conversationId}`).emit("outing_created", { outing: doc });
      await insertSystemMessage(conv._id, "outing_created", uid, result.insertedId);
      res.status(201).json(doc);
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: "outing_already_active" });
      res.status(500).json({ error: "server_error" });
    }
  });

  // PATCH /api/outings/:id — update metadata
  router.patch("/:id", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const parsed = updateOutingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv || !canEdit(conv, outing, uid)) return res.status(403).json({ error: "forbidden" });

      const updated = await outings.findOneAndUpdate(
        { _id: id },
        { $set: { ...parsed.data, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      io?.to(`conv:${outing.conversationId}`).emit("outing_updated", { outing: updated });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // PUT /api/outings/:id/items — replace items list
  router.put("/:id/items", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    const parsed = upsertItemsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv || !canEdit(conv, outing, uid)) return res.status(403).json({ error: "forbidden" });

      const existingClaims = {};
      for (const item of outing.items) existingClaims[item.id] = item.claims;

      const newItems = parsed.data.items.map((item) => {
        const stableId = item.id || new ObjectId().toString();
        return { ...item, id: stableId, claims: existingClaims[stableId] || [] };
      });

      const updated = await outings.findOneAndUpdate(
        { _id: id },
        { $set: { items: newItems, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      io?.to(`conv:${outing.conversationId}`).emit("outing_updated", { outing: updated });
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/outings/:id/items/:itemId/claims
  router.post("/:id/items/:itemId/claims", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }
    const { itemId } = req.params;

    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "validation_error" });

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv) return res.status(403).json({ error: "forbidden" });

      const item = outing.items.find((it) => it.id === itemId);
      if (!item) return res.status(404).json({ error: "item_not_found" });
      if (item.claims.some((c) => c.uid === uid)) {
        return res.status(409).json({ error: "already_claimed" });
      }

      const claim = buildClaimSnapshot(conv, uid, parsed.data.quantity);

      const updated = await outings.findOneAndUpdate(
        { _id: id, status: "active", "items.id": itemId },
        {
          $push: { "items.$[it].claims": claim },
          $set: { updatedAt: new Date() },
        },
        { arrayFilters: [{ "it.id": itemId }], returnDocument: "after" }
      );
      if (!updated) return res.status(404).json({ error: "item_not_found" });

      io?.to(`conv:${outing.conversationId}`).emit("outing_claim_added", {
        outingId: id.toString(), itemId, claim,
      });
      res.status(201).json(claim);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/outings/:id/items/:itemId/claims/:claimId
  router.delete("/:id/items/:itemId/claims/:claimId", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }
    const { itemId, claimId } = req.params;

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv) return res.status(403).json({ error: "forbidden" });

      const item = outing.items.find((it) => it.id === itemId);
      if (!item) return res.status(404).json({ error: "item_not_found" });
      const claimObj = item.claims.find((c) => c.claimId === claimId);
      if (!claimObj) return res.status(404).json({ error: "claim_not_found" });
      if (claimObj.uid !== uid) return res.status(403).json({ error: "forbidden" });

      const updated = await outings.findOneAndUpdate(
        { _id: id, status: "active", "items.id": itemId },
        {
          $pull: { "items.$[it].claims": { claimId, uid } },
          $set: { updatedAt: new Date() },
        },
        { arrayFilters: [{ "it.id": itemId }], returnDocument: "after" }
      );
      if (!updated) return res.status(404).json({ error: "not_found" });

      io?.to(`conv:${outing.conversationId}`).emit("outing_claim_removed", {
        outingId: id.toString(), itemId, claimId,
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/outings/:id/complete
  router.post("/:id/complete", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv || !canEdit(conv, outing, uid)) return res.status(403).json({ error: "forbidden" });

      const now = new Date();
      const updated = await outings.findOneAndUpdate(
        { _id: id },
        { $set: { status: "completed", completedAt: now, completedBy: uid, updatedAt: now } },
        { returnDocument: "after" }
      );

      io?.to(`conv:${outing.conversationId}`).emit("outing_completed", { outing: updated });
      await insertSystemMessage(conv._id, "outing_completed", uid, id);
      res.json(updated);
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  // DELETE /api/outings/:id — hard-delete active only
  router.delete("/:id", requireAuth, async (req, res) => {
    const uid = req.auth.uid;
    let id;
    try { id = new ObjectId(req.params.id); } catch { return res.status(400).json({ error: "invalid_id" }); }

    try {
      const outing = await outings.findOne({ _id: id, status: "active" });
      if (!outing) return res.status(404).json({ error: "not_found_or_completed" });
      const conv = await getConv(outing.conversationId.toString(), uid);
      if (!conv || !canEdit(conv, outing, uid)) return res.status(403).json({ error: "forbidden" });

      await outings.deleteOne({ _id: id });
      io?.to(`conv:${outing.conversationId}`).emit("outing_deleted", {
        outingId: id.toString(),
        conversationId: outing.conversationId.toString(),
      });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}
