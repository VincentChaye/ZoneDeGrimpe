// backend/server.js
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { connectToDb } from "./src/db.js";
import { spotsRouter } from "./src/routes/spots.routes.js";
import { usersRouter } from "./src/routes/users.routes.js";
import { authRouter } from "./src/routes/auth.routes.js";
import { spotEditsRouter } from "./src/routes/spot-edits.routes.js";
import { bookmarksRouter } from "./src/routes/bookmarks.routes.js";
import { climbingRoutesRouter } from "./src/routes/climbing-routes.routes.js";
import { reviewsRouter } from "./src/routes/reviews.routes.js";
import { logbookRouter } from "./src/routes/logbook.routes.js";
import { followsRouter } from "./src/routes/follows.routes.js";
import { friendsRouter } from "./src/routes/friends.routes.js";
import { notificationsRouter } from "./src/routes/notifications.routes.js";
import { messagesRouter } from "./src/routes/messages.routes.js";
import { initWebPush } from "./src/notifications.js";
import { initSocketIO } from "./src/socket.js";



dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// --- Sécurité : désactiver X-Powered-By + headers de sécurité
app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: false, // désactivé : géré par CORS
  contentSecurityPolicy: false,     // désactivé : API pure, pas de HTML applicatif
}));

app.use(express.json({ limit: "100kb" }));

// --- CORS : env + dev defaults
const devDefaults = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:3001",
];
const envAllowed = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedList = [...new Set([...devDefaults, ...envAllowed])];

// Autoriser aussi *.onrender.com et *.github.io (https) via check souple
// + réseau local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
function isAllowedOrigin(origin) {
  if (!origin) return true; // curl/postman
  if (allowedList.includes(origin)) return true;
  try {
    const u = new URL(origin);
    // Autoriser HTTPS Render et GitHub
    if (
      u.protocol === "https:" &&
      (u.hostname === "zonedegrimpe.onrender.com" ||
        u.hostname === "vincentchaye.github.io")
    ) {
      return true;
    }
    // Autoriser HTTP depuis réseau local (IP privées)
    if (u.protocol === "http:") {
      const ip = u.hostname;
      // Réseaux privés: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
      if (
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(ip)
      ) {
        return true;
      }
    }
  } catch { }
  return false;
}

// --- CORS configuration with all methods
const corsConfig = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type", "Accept"],
  exposedHeaders: ["Content-Type", "Content-Length"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));

// --- Health endpoints
app.get("/api/health", (_, res) => res.json({ ok: true }));
app.get("/ping", (_, res) => res.json({ ok: true })); // pour Docker/ingress

// --- DB wiring
const hasUri = !!process.env.MONGODB_URI;

if (hasUri) {
  const { db } = await connectToDb(
    process.env.MONGODB_URI,
    process.env.DB_NAME || "ZoneDeGrimpe"
  );

  // Routes avec DB
  app.use("/api/spots", spotsRouter(db));
  app.use("/api/users", usersRouter(db));
  app.use("/api/auth", authRouter(db));
  app.use("/api/spot-edits", spotEditsRouter(db));
  app.use("/api/bookmarks", bookmarksRouter(db));
  app.use("/api/climbing-routes", climbingRoutesRouter(db));
  app.use("/api/reviews", reviewsRouter(db));
  app.use("/api/logbook", logbookRouter(db));
  app.use("/api/follows", followsRouter(db));
  app.use("/api/friends", friendsRouter(db));
  app.use("/api/notifications", notificationsRouter(db));
  app.use("/api/messages", messagesRouter(db));

  // Init Web Push (si VAPID configure)
  initWebPush();

  // Init Socket.io
  initSocketIO(httpServer, db);

  console.log("MongoDB mode activé");
  console.log("[email] RESEND_API_KEY:", process.env.RESEND_API_KEY ? "SET (" + process.env.RESEND_API_KEY.slice(0, 8) + "...)" : "MISSING");
  console.log("[email] EMAIL_FROM:", process.env.EMAIL_FROM || "NOT SET (fallback onboarding@resend.dev)");
} else {
  // Fallback sans DB
  app.get("/api/spots", (_, res) => res.json({ type: "FeatureCollection", features: [] }));
  app.get("/api/users", (_, res) => res.json({ items: [], total: 0 }));
  app.get("/api/auth", (_, res) => res.status(401).json({ error: "no_db" }));


  console.warn("MONGODB_URI manquante → mode sans DB (listes vides)");
}

// --- Gestionnaire d'erreur global — empêche la fuite de stack traces en prod
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  // CORS rejection
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "cors_forbidden" });
  }
  // Payload trop grand
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "payload_too_large" });
  }
  // JSON malformé
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid_json" });
  }
  console.error("[server_error]", err.message);
  res.status(status).json({ error: "server_error" });
});

// --- Listen (0.0.0.0 pour conteneur)
const port = process.env.PORT || 3000;
httpServer.listen(port, "0.0.0.0", () => console.log(`API running on :${port}`));
