const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const upload = require("../middleware/upload");
const { listProducts, getProduct, createProduct } = require("../controllers/productsController");
const { uploadProductImage, deleteProductImage, reorderProductImages } = require("../controllers/imagesController");

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireBrandAuth, createProduct);
router.post("/:id/images", requireBrandAuth, upload.single("image"), uploadProductImage);
router.delete("/:id/images/:imageId", requireBrandAuth, deleteProductImage);
router.patch("/:id/images/reorder", requireBrandAuth, reorderProductImages);

module.exports = router;
