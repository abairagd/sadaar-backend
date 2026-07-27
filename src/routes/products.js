const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const upload = require("../middleware/upload");
const { listProducts, getProduct, createProduct } = require("../controllers/productsController");
const { uploadProductImage, deleteProductImage } = require("../controllers/imagesController");

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireBrandAuth, createProduct);
router.post("/:id/images", requireBrandAuth, upload.single("image"), uploadProductImage);
router.delete("/:id/images/:imageId", requireBrandAuth, deleteProductImage);

module.exports = router;
