import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "unauthorized" });

    if (!process.env.JWT_SECRET) {
      console.error("FATAL: JWT_SECRET is not set");
      return res.status(500).json({ error: "server_misconfigured" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const uid = payload?.uid;
    if (!uid) return res.status(401).json({ error: "unauthorized" });

    req.auth = { uid, roles: Array.isArray(payload.roles) ? payload.roles : ["user"] };
    next();
  } catch (e) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.auth?.roles?.includes("admin")) {
      return res.status(403).json({ error: "forbidden", detail: "admin_required" });
    }
    next();
  });
}
