const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { placeOrder, getOrder, listBrandOrderItems, markShipped } = require("../controllers/ordersController");
const { confirmPayment } = require("../controllers/paymentsController");
const { writeLimiter, authLimiter } = require("../middleware/rateLimiters");

router.post("/", writeLimiter, placeOrder);
router.get("/:id", authLimiter, getOrder);
router.post("/:id/confirm-payment", confirmPayment);

router.get("/brand/mine", requireBrandAuth, listBrandOrderItems);
router.patch("/items/:itemId/ship", requireBrandAuth, markShipped);

module.exports = router;
