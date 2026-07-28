const jwt = require("jsonwebtoken");

module.exports = function requireCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header." });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.customerId = payload.customerId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Optional variant — if a valid token is present, sets req.customerId; if not
// (or invalid), just continues as a guest. Used on placeOrder so logged-in
// customers get their order linked to their account, but guest checkout keeps
// working exactly as before for everyone else.
module.exports.optionalCustomerAuth = function optionalCustomerAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      req.customerId = payload.customerId;
    } catch (err) {
      // Invalid/expired token on a guest-allowed route — just proceed as guest.
    }
  }
  next();
};
