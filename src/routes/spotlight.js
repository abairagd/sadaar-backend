const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const requireAdminAuth = require("../middleware/adminAuth").requireAdminAuth;
const {
  getPricing, createSpotlightPurchase, confirmSpotlightPayment,
  listActiveSpotlights, listMySpotlights, listAllSpotlights,
} = require("../controllers/spotlightController");
const { writeLimiter } = require("../middleware/rateLimiters");

router.get("/pricing", getPricing);
router.get("/active", listActiveSpotlights);
router.post("/", requireBrandAuth, writeLimiter, createSpotlightPurchase);
router.post("/:id/confirm-payment", requireBrandAuth, confirmSpotlightPayment);
router.get("/mine", requireBrandAuth, listMySpotlights);
router.get("/admin/all", requireAdminAuth, listAllSpotlights);

module.exports = router;
