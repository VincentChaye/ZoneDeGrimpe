import jwt from "jsonwebtoken";

function decodeToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.uid) return null;
    return { uid: payload.uid, roles: Array.isArray(payload.roles) ? payload.roles : ["user"] };
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not set");
    return res.status(500).json({ error: "server_misconfigured" });
  }
  const decoded = decodeToken(req);
  if (!decoded) return res.status(401).json({ error: "unauthorized" });
  req.auth = decoded;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.auth?.roles?.includes("admin")) {
      return res.status(403).json({ error: "forbidden", detail: "admin_required" });
    }
    next();
  });
}

/** Middleware optionnel : tente de décoder le JWT sans bloquer si absent/invalide */
export function optionalAuth(req, res, next) {
  const decoded = decodeToken(req);
  if (decoded) req.auth = decoded;
  next();
}
