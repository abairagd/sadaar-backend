const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { placeOrder, getOrder, listBrandOrderItems, markShipped } = require("../controllers/ordersController");
const { confirmPayment } = require("../controllers/paymentsController");

router.post("/", placeOrder);
router.get("/:id", getOrder);
router.post("/:id/confirm-payment", confirmPayment);

// Brand dashboard views: only that brand's own line items across all orders.
router.get("/brand/mine", requireBrandAuth, listBrandOrderItems);
router.patch("/items/:itemId/ship", requireBrandAuth, markShipped);

module.exports = router;
