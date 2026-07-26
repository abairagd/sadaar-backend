const express = require("express");
const router = express.Router();
const { listBrands, getBrand, applyBrand, loginBrand } = require("../controllers/brandsController");
const { authLimiter, writeLimiter } = require("../middleware/rateLimiters");

router.get("/", listBrands);
router.get("/:slug", getBrand);
router.post("/apply", writeLimiter, applyBrand);
router.post("/login", authLimiter, loginBrand);

module.exports = router;
