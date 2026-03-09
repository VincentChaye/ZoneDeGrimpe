// backend/src/routes/auth.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

export function authRouter(db) {
	const r = Router();
	const users = db.collection("users");

	const PUBLIC_PROJECTION = {
		passwordHash: 0,
		security: 0,
	};

	function sign(uid, roles = ["user"]) {
		return jwt.sign({ uid, roles }, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
	}

// --- REGISTER (conforme au validator users) ---
r.post("/register", async (req, res) => {
  try {
    let { email, password, displayName } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "missing_fields", detail: "email_and_password_required" });
    }

    email = String(email).trim().toLowerCase();
    const baseDisplay = (displayName || email.split("@")[0]).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "invalid_email" });
    }

    const existing = await users.findOne({ email });

    // MIGRATION : l’utilisateur existe mais SANS passwordHash → initialiser mdp
    if (existing && !existing.passwordHash) {
      const passwordHash = bcrypt.hashSync(password, 10);
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
    const passwordHash = bcrypt.hashSync(password, 10);
    const doc = {
      email,
      passwordHash,                    // required: string
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
    if (e?.code === 11000) return res.status(409).json({ error: "email_taken" });
    console.error("REGISTER_ERROR:", { code: e?.code, msg: e?.message, stack: e?.stack });
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

    const ok = bcrypt.compareSync(password, user.passwordHash); // ✅ sync
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
