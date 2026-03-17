// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectToDb } from "./src/db.js";
import { spotsRouter } from "./src/routes/spots.routes.js";
import { usersRouter } from "./src/routes/users.routes.js";
import { authRouter } from "./src/routes/auth.routes.js";
import { userMaterielRouter } from "./src/routes/userMateriel.routes.js";
import { materielSpecsRouter } from "./src/routes/materielSpecs.routes.js";
import { analyticsRouter } from "./src/routes/analytics.routes.js";
import { adviceRouter } from "./src/routes/advice.routes.js";
import { spotEditsRouter } from "./src/routes/spot-edits.routes.js";
import { bookmarksRouter } from "./src/routes/bookmarks.routes.js";
import { climbingRoutesRouter } from "./src/routes/climbing-routes.routes.js";



dotenv.config();

const app = express();
app.use(express.json({ limit: "100kb" }));

// --- CORS : env + dev defaults
const devDefaults = [
  "http://localhost:3000",
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
  app.use("/api/user_materiel", userMaterielRouter(db));
  app.use("/api/materiel_specs", materielSpecsRouter(db));
  app.use("/api/analytics", analyticsRouter(db));
  app.use("/api/advice", adviceRouter(db));
  app.use("/api/spot-edits", spotEditsRouter(db));
  app.use("/api/bookmarks", bookmarksRouter(db));
  app.use("/api/climbing-routes", climbingRoutesRouter(db));

  console.log("MongoDB mode activé");
} else {
  // Fallback sans DB
  app.get("/api/spots", (_, res) => res.json({ type: "FeatureCollection", features: [] }));
  app.get("/api/users", (_, res) => res.json({ items: [], total: 0 }));
  app.get("/api/auth", (_, res) => res.status(401).json({ error: "no_db" }));
  app.get("/api/user_materiel", (_, res) => res.json({ items: [], total: 0 }));
  app.get("/api/materiel_specs", (_, res) => res.json({ items: [], total: 0 }));
  app.get("/api/analytics", (_, res) => res.json({ items: [] }));
  app.get("/api/advice", (_, res) => res.json({ items: [] }));


  console.warn("MONGODB_URI manquante → mode sans DB (listes vides)");
}

// --- Listen (0.0.0.0 pour conteneur)
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`API running on :${port}`));
