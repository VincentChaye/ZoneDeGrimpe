import webpush from "web-push";

let pushConfigured = false;

export function initWebPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
    console.warn("VAPID keys not set — push notifications disabled");
    return;
  }
  webpush.setVapidDetails(
    `mailto:${VAPID_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  pushConfigured = true;
}

export async function createNotification(db, { userId, type, fromUserId, fromUsername, data, message }) {
  const notifications = db.collection("notifications");
  const doc = {
    userId,
    type,
    fromUserId,
    fromUsername,
    data: data || null,
    message: message || null,
    read: false,
    createdAt: new Date(),
  };
  await notifications.insertOne(doc);

  if (!pushConfigured) return;

  const subs = db.collection("push_subscriptions");
  const subDocs = await subs.find({ userId }).toArray();

  for (const sub of subDocs) {
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({
          title: "ZoneDeGrimpe",
          body: message || type,
          url: "./notifications.html",
        })
      );
    } catch (err) {
      if (err.statusCode === 410) {
        await subs.deleteOne({ _id: sub._id });
      }
    }
  }
}
