const express = require("express");
const router = express.Router();
const { listBrands, getBrand, applyBrand, loginBrand, requestPasswordReset, resetPassword } = require("../controllers/brandsController");
const { authLimiter, writeLimiter } = require("../middleware/rateLimiters");

router.get("/", listBrands);
router.get("/:slug", getBrand);
router.post("/apply", writeLimiter, applyBrand);
router.post("/login", authLimiter, loginBrand);
router.post("/request-password-reset", authLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);

module.exports = router;
