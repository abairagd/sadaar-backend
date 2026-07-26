const jwt = require("jsonwebtoken");

function adminLogin(req, res) {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect admin password." });
  }
  const token = jwt.sign({ isAdmin: true }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token });
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header." });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.isAdmin) return res.status(403).json({ error: "Not an admin token." });
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

module.exports = { adminLogin, requireAdminAuth };
