const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { placeOrder, getOrder, listBrandOrderItems, markShipped } = require("../controllers/ordersController");

router.post("/", placeOrder);
router.get("/:id", getOrder);

// Brand dashboard views: only that brand's own line items across all orders.
router.get("/brand/mine", requireBrandAuth, listBrandOrderItems);
router.patch("/items/:itemId/ship", requireBrandAuth, markShipped);

module.exports = router;
