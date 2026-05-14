import { ObjectId } from "mongodb";

/** Pull all claims by a user from active outings of a conversation. Emits outing_updated. */
export async function cleanupUserFromOutings(db, io, convId, targetUid) {
  const outings = db.collection("outings");
  let convObjId;
  try { convObjId = new ObjectId(convId); } catch { return; }

  const affected = await outings.find({
    conversationId: convObjId,
    status: "active",
    "items.claims.uid": targetUid,
  }).toArray();

  for (const outing of affected) {
    await outings.updateOne(
      { _id: outing._id },
      {
        $pull: { "items.$[].claims": { uid: targetUid } },
        $set: { updatedAt: new Date() },
      }
    );
    const updated = await outings.findOne({ _id: outing._id });
    io?.to(`conv:${convId}`).emit("outing_updated", { outing: updated });
  }
}
