// backend/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../email.js";

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20, // max 20 tentatives par IP
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "too_many_requests", detail: "Try again later" },
});

export function authRouter(db) {
	const r = Router();
	r.use(authLimiter);
	const users = db.collection("users");

	const PUBLIC_PROJECTION = {
		passwordHash: 0,
		security: 0,
	};

	function sign(uid, roles = ["user"]) {
		if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
		return jwt.sign({ uid, roles }, process.env.JWT_SECRET, { expiresIn: "7d" });
	}

// --- REGISTER (conforme au validator users) ---
r.post("/register", async (req, res) => {
  try {
    let { email, password, displayName, username } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "missing_fields", detail: "email_and_password_required" });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "invalid_password", detail: "password_must_be_8_to_128_chars" });
    }

    // Username validation
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "missing_fields", detail: "username_required" });
    }
    username = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: "username_invalid_format", detail: "3-30 chars, alphanumeric and underscores only" });
    }
    // Check username uniqueness
    const existingUsername = await users.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: "username_taken" });
    }

    email = String(email).trim().toLowerCase();
    const baseDisplay = (displayName || email.split("@")[0]).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }

    const existing = await users.findOne({ email });

    // MIGRATION : l’utilisateur existe mais SANS passwordHash → initialiser mdp
    if (existing && !existing.passwordHash) {
      const passwordHash = await bcrypt.hash(password, 10);
      await users.updateOne(
        { _id: existing._id },
        {
          $set: {
            passwordHash,
            displayName: existing.displayName || baseDisplay,
            // champs optionnels autorisés (éviter d'ajouter autre chose !)
            avatarUrl: typeof existing.avatarUrl === "string" || existing.avatarUrl === null ? existing.avatarUrl : null,
            phone: typeof existing.phone === "string" || existing.phone === null ? existing.phone : null,
            roles: Array.isArray(existing.roles) ? existing.roles : ["user"],
            status: ["active", "banned", "pending"].includes(existing.status) ? existing.status : "active",
            emailVerified: !!existing.emailVerified,
            preferences: existing.preferences && typeof existing.preferences === "object" ? existing.preferences : {},
            profile: existing.profile && typeof existing.profile === "object" ? existing.profile : {},
            // ✅ dates dans security (EXIGÉ)
            "security.updatedAt": new Date(),
            "security.lastLoginAt": null
          },
          $setOnInsert: {
            // si jamais il manquait security.createdAt (peu probable à l'update)
            "security.createdAt": new Date()
          }
        }
      );
      const token = sign(existing._id.toString(), existing.roles || ["user"]);
      const user = await users.findOne({ _id: existing._id }, { projection: PUBLIC_PROJECTION });
      return res.status(200).json({ token, user });
    }

    if (existing) {
      return res.status(409).json({ error: "email_taken" });
    }

    // INSERT conforme au validator
    const passwordHash = await bcrypt.hash(password, 10);
    const doc = {
      email,
      passwordHash,                    // required: string
      username,                        // required: unique public pseudo
      displayName: baseDisplay,        // required: string (min 1)
      avatarUrl: null,                 // autorisé: string|null
      phone: null,                     // autorisé: string|null
      roles: ["user"],                 // autorisé: array user|admin|moderator
      status: "active",                // autorisé: active|banned|pending
      emailVerified: false,            // autorisé: bool
      preferences: {},                 // autorisé: object
      profile: {},                     // autorisé: object
      // security est REQUIRED avec createdAt (date). updatedAt/lastLoginAt optionnels.
      security: {
        createdAt: new Date(),
        updatedAt: null,
        lastLoginAt: null
      }
      // NE PAS ajouter d’autres champs (additionalProperties: false)
      // NE PAS mettre createdAt/updatedAt au niveau racine
      // NE PAS mettre "name" (non listé -> rejeté)
    };

    const { insertedId } = await users.insertOne(doc);
    const token = sign(insertedId.toString(), ["user"]);
    const user = await users.findOne({ _id: insertedId }, { projection: PUBLIC_PROJECTION });
    return res.status(201).json({ token, user });

  } catch (e) {
    if (e?.code === 11000) {
      const key = e?.keyPattern?.username ? "username_taken" : "email_taken";
      return res.status(409).json({ error: key });
    }
    console.error("REGISTER_ERROR:", { code: e?.code, msg: e?.message, stack: e?.stack });
    return res.status(500).json({ error: "server_error" });
  }
});

// --- FORGOT PASSWORD ---
r.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "missing_fields" });

    const user = await users.findOne({ email: String(email).trim().toLowerCase() });

    // Always return 200 to avoid user enumeration
    if (!user) return res.json({ success: true });

    // Generate token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await users.updateOne(
      { _id: user._id },
      { $set: { "passwordReset.tokenHash": tokenHash, "passwordReset.expiresAt": expiresAt } },
    );

    const frontendUrl = process.env.FRONTEND_URL || "https://vincentchaye.github.io/ZoneDeGrimpe";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl, "fr");
    } catch (mailErr) {
      console.error("[email] send failed:", mailErr?.message);
      // Don't fail the request if email fails — but log it
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("FORGOT_PASSWORD_ERROR:", e?.stack || e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- RESET PASSWORD ---
r.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: "missing_fields" });
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: "invalid_password", detail: "password_must_be_8_to_128_chars" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await users.findOne({
      "passwordReset.tokenHash": tokenHash,
      "passwordReset.expiresAt": { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ error: "invalid_or_expired_token" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash, "security.updatedAt": new Date() },
        $unset: { passwordReset: "" },
      },
    );

    return res.json({ success: true });
  } catch (e) {
    console.error("RESET_PASSWORD_ERROR:", e?.stack || e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- CHANGE PASSWORD ---
r.patch("/change-password", async (req, res) => {
  try {
    // Verify JWT manually (no requireAuth middleware on this router)
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "missing_fields" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: "invalid_password", detail: "password_must_be_8_to_128_chars" });
    }

    const user = await users.findOne({ _id: new ObjectId(payload.uid) });
    if (!user || !user.passwordHash) return res.status(401).json({ error: "unauthorized" });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "wrong_password" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: newHash, "security.updatedAt": new Date() } },
    );
    return res.json({ success: true });
  } catch (e) {
    console.error("CHANGE_PASSWORD_ERROR:", e?.stack || e);
    return res.status(500).json({ error: "server_error" });
  }
});

// --- LOGIN ---
r.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const user = await users.findOne({ email: String(email).trim().toLowerCase() });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });

    const token = sign(user._id.toString(), user.roles || ["user"]);
    const pub = await users.findOne({ _id: user._id }, { projection: PUBLIC_PROJECTION });
    return res.json({ token, user: pub });
  } catch (e) {
    console.error("LOGIN_ERROR:", e?.stack || e);
    return res.status(500).json({ error: "server_error" });
  }
});

	return r;
}
