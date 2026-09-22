const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// A JWT stays valid for up to 12h (see auth.routes.js signToken), so a
// deactivated staff account must be rejected on the next request, not only
// at their next login — otherwise revoking access does nothing until the
// old token happens to expire. This costs one indexed lookup per request,
// which is negligible for a single-shop SQLite database.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { isActive: true, role: true, businessId: true }
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "This account no longer has access." });
  }

  // Trust the freshly-read role/businessId over the token's own copy, so a
  // role change or reassignment also takes effect immediately rather than
  // waiting for the token to expire.
  req.user = { id: payload.id, email: payload.email, businessId: user.businessId, role: user.role };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
