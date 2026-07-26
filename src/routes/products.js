const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { listProducts, getProduct, createProduct } = require("../controllers/productsController");

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireBrandAuth, createProduct); // brand dashboard adds a product to their own catalog

module.exports = router;
