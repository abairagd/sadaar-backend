const jwt = require("jsonwebtoken");

module.exports = function requireBrandAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header." });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.brandId = payload.brandId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};
