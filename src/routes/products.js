const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const upload = require("../middleware/upload");
const { listProducts, getProduct, createProduct, updateProduct, updateVariantStock, archiveProduct, toggleSignatureProduct } = require("../controllers/productsController");
const { uploadProductImage, deleteProductImage, reorderProductImages } = require("../controllers/imagesController");

router.get("/", listProducts);
router.get("/:id", getProduct);
router.post("/", requireBrandAuth, createProduct); // brand dashboard adds a product to their own catalog
router.patch("/:id", requireBrandAuth, updateProduct);
router.patch("/:id/signature", requireBrandAuth, toggleSignatureProduct);
router.patch("/:id/variants/:variantId/stock", requireBrandAuth, updateVariantStock);
router.delete("/:id", requireBrandAuth, archiveProduct);
router.post("/:id/images", requireBrandAuth, upload.single("image"), uploadProductImage);
router.delete("/:id/images/:imageId", requireBrandAuth, deleteProductImage);
router.patch("/:id/images/reorder", requireBrandAuth, reorderProductImages);

module.exports = router;
