import { Router } from "express";
import { ObjectId } from "mongodb";
import { optionalAuth } from "../auth.js";

export function feedRouter(db) {
  const r = Router();
  const users = db.collection("users");
  const logbook = db.collection("logbook_entries");
  const spots = db.collection("climbing_spot");
  const routes = db.collection("climbing_routes");

  const userProjection = { displayName: 1, username: 1, avatarUrl: 1 };

  // GET /api/feed/global — fil public (ascensions + nouveaux spots)
  r.get("/global", optionalAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 30, 50);
      const cursor = req.query.cursor ? new Date(req.query.cursor) : null;
      const cursorFilter = cursor ? { createdAt: { $lt: cursor } } : {};

      // Users with public logbook
      const publicUserDocs = await users
        .find({
          $or: [
            { "privacy.logbookVisibility": "public" },
            { "privacy.logbookVisibility": { $exists: false } },
          ],
        })
        .project({ _id: 1 })
        .toArray();
      const publicUserIds = publicUserDocs.map((u) => u._id.toString());

      // Fetch logbook + spots in parallel
      const [logbookItems, spotItems] = await Promise.all([
        logbook
          .find({ userId: { $in: publicUserIds }, ...cursorFilter })
          .sort({ createdAt: -1 })
          .limit(limit + 10)
          .toArray(),
        spots
          .find({
            status: "approved",
            "createdBy.uid": { $in: publicUserIds },
            ...cursorFilter,
          })
          .sort({ createdAt: -1 })
          .limit(limit + 10)
          .toArray(),
      ]);

      // Collect all userIds to hydrate
      const allUserIds = [
        ...new Set([
          ...logbookItems.map((l) => l.userId),
          ...spotItems.map((s) => s.createdBy?.uid).filter(Boolean),
        ]),
      ];
      const userOids = allUserIds
        .map((id) => { try { return new ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      const userDocs = userOids.length
        ? await users.find({ _id: { $in: userOids } }, { projection: userProjection }).toArray()
        : [];
      const userMap = new Map(userDocs.map((u) => [u._id.toString(), u]));

      // Hydrate climbing routes (for imageUrl)
      const routeIds = logbookItems
        .map((l) => l.routeId)
        .filter(Boolean)
        .map((id) => { try { return new ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      const routeDocs = routeIds.length
        ? await routes.find({ _id: { $in: routeIds } }, { projection: { imageUrl: 1, name: 1 } }).toArray()
        : [];
      const routeMap = new Map(routeDocs.map((r) => [r._id.toString(), r]));

      // Hydrate spots for logbook items (for fallback photo)
      const spotIds = [
        ...new Set([
          ...logbookItems.map((l) => l.spotId),
          ...spotItems.map((s) => s._id.toString()),
        ].filter(Boolean)),
      ];
      const spotOids = spotIds
        .map((id) => { try { return new ObjectId(id); } catch { return null; } })
        .filter(Boolean);
      const spotDocs = spotOids.length
        ? await spots.find({ _id: { $in: spotOids } }, { projection: { name: 1, type: 1, photos: 1 } }).toArray()
        : [];
      const spotMap = new Map(spotDocs.map((s) => [s._id.toString(), s]));

      function firstApprovedPhoto(spot) {
        if (!spot?.photos?.length) return null;
        const approved = spot.photos.find((p) => !p.status || p.status === "approved");
        return approved?.url ?? null;
      }

      // Build unified feed items
      const feedItems = [
        ...logbookItems.map((l) => {
          const user = userMap.get(l.userId) || {};
          const route = l.routeId ? routeMap.get(l.routeId) : null;
          const spot = l.spotId ? spotMap.get(l.spotId) : null;
          const imageUrl = route?.imageUrl ?? firstApprovedPhoto(spot) ?? null;
          return {
            id: l._id.toString(),
            type: "logbook",
            userId: l.userId,
            displayName: user.displayName,
            username: user.username,
            avatarUrl: user.avatarUrl,
            createdAt: l.createdAt,
            imageUrl,
            spot: { id: l.spotId || "", name: l.spotName || spot?.name || "" , type: spot?.type },
            route: route ? { id: l.routeId, name: route.name || l.routeName } : (l.routeName ? { name: l.routeName } : null),
            grade: l.grade,
            style: l.style,
          };
        }),
        ...spotItems.map((s) => {
          const uid = s.createdBy?.uid;
          const user = uid ? (userMap.get(uid) || {}) : {};
          const imageUrl = firstApprovedPhoto(s);
          return {
            id: s._id.toString(),
            type: "spot",
            userId: uid || "",
            displayName: user.displayName || s.createdBy?.displayName,
            username: user.username || s.createdBy?.username,
            avatarUrl: user.avatarUrl,
            createdAt: s.createdAt,
            imageUrl,
            spot: { id: s._id.toString(), name: s.name, type: s.type },
          };
        }),
      ];

      feedItems.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const page = feedItems.slice(0, limit);
      const nextCursor = page.length === limit ? page[page.length - 1].createdAt : null;

      res.json({ items: page, nextCursor });
    } catch (e) {
      console.error("[feed/global]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return r;
}
