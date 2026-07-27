const express = require("express");
const router = express.Router();
const requireAdminAuth = require("../middleware/adminAuth").requireAdminAuth;
const { submitMessage, listMessages, markMessageRead } = require("../controllers/supportController");
const { writeLimiter } = require("../middleware/rateLimiters");

router.post("/", writeLimiter, submitMessage);
router.get("/", requireAdminAuth, listMessages);
router.patch("/:id/read", requireAdminAuth, markMessageRead);

module.exports = router;
