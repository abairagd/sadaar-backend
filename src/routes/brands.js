const express = require("express");
const router = express.Router();
const { listBrands, getBrand, applyBrand, loginBrand } = require("../controllers/brandsController");

router.get("/", listBrands);
router.get("/:slug", getBrand);
router.post("/apply", applyBrand);
router.post("/login", loginBrand);

module.exports = router;
