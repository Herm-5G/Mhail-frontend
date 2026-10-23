const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.notifyOnMessage = onDocumentCreated(
  { document: "conversations/{chatId}/messages/{msgId}", region: "us-central1" },
  async (event) => {
    const msg = event.data.data();
    const { chatId } = event.params;
    if (!msg || !msg.senderId) return;

    const convSnap = await db.doc(`conversations/${chatId}`).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data();
    const recipients = (conv.participants || []).filter(uid => uid !== msg.senderId);

    const tokens = [];
    await Promise.all(recipients.map(async (uid) => {
      try {
        const userSnap = await db.doc(`users/${uid}`).get();
        if (!userSnap.exists) return;
        const u = userSnap.data();
        if (u.mutedBy && u.mutedBy[uid]) return;
        if (u.fcmToken) tokens.push(u.fcmToken);
      } catch (_) {}
    }));

    if (!tokens.length) return;

    let body = msg.text || "New message";
    if (msg.type === "image") body = "📷 Photo";
    else if (msg.type === "audio") body = "🎙️ Voice note";
    else if (msg.type === "video") body = "🎬 Video";
    else if (msg.type === "document") body = "📄 Document";
    else if (msg.type === "sticker") body = "🖼️ Sticker";
    else if (msg.type === "contact") body = "👤 Contact";

    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: msg.senderName || "Mofie", body },
        data: { chatId, msgId: event.params.msgId, senderId: msg.senderId },
        android: { priority: "high", notification: { sound: "default", channelId: "mofie_messages" } },
        apns: { payload: { aps: { sound: "default", badge: 1, "content-available": 1 } } },
        webpush: {
          headers: { Urgency: "high" },
          notification: { title: msg.senderName || "Mofie", body, tag: chatId, renotify: true },
          fcmOptions: { link: `/Mhail-frontend/?chat=${chatId}` }
        }
      });
      logger.info(`Push sent for ${chatId}`);
    } catch (err) {
      logger.error("Push failed:", err);
    }
  }
);

exports.cleanupExpiredMessages = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collectionGroup("messages").where("expireAt", "<=", now).limit(1000).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
);

exports.cleanupExpiredStatuses = onSchedule(
  { schedule: "every 60 minutes", region: "us-central1" },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection("statuses").where("expireAt", "<=", now).limit(1000).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
);
