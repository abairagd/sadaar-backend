const express = require("express");
const router = express.Router();
const requireAdminAuth = require("../middleware/adminAuth").requireAdminAuth;
const { validateDiscount, listDiscountCodes, createDiscountCode, updateDiscountCodeStatus } = require("../controllers/discountsController");
const { writeLimiter } = require("../middleware/rateLimiters");

router.post("/validate", writeLimiter, validateDiscount);
router.get("/", requireAdminAuth, listDiscountCodes);
router.post("/", requireAdminAuth, createDiscountCode);
router.patch("/:id/status", requireAdminAuth, updateDiscountCodeStatus);

module.exports = router;
