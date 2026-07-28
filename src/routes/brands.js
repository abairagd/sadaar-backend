const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { listBrands, getBrand, applyBrand, loginBrand, requestPasswordReset, resetPassword, getMyBrandProfile, updateMyBrandProfile } = require("../controllers/brandsController");
const { authLimiter, writeLimiter } = require("../middleware/rateLimiters");

router.get("/", listBrands);
router.get("/me", requireBrandAuth, getMyBrandProfile);
router.patch("/me", requireBrandAuth, writeLimiter, updateMyBrandProfile);
router.get("/:slug", getBrand);
router.post("/apply", writeLimiter, applyBrand);
router.post("/login", authLimiter, loginBrand);
router.post("/request-password-reset", authLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);

module.exports = router;
