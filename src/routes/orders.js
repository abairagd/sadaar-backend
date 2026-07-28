const express = require("express");
const router = express.Router();
const requireBrandAuth = require("../middleware/requireBrandAuth");
const { optionalCustomerAuth } = require("../middleware/requireCustomerAuth");
const {
  placeOrder, getOrder, listBrandOrderItems, markShipped, requestCancellation, respondToCancellation,
  requestReturn, respondToReturn, confirmReturnReceived,
} = require("../controllers/ordersController");
const { confirmPayment } = require("../controllers/paymentsController");
const { writeLimiter, authLimiter } = require("../middleware/rateLimiters");

router.post("/", writeLimiter, optionalCustomerAuth, placeOrder);
router.get("/:id", authLimiter, getOrder); // contact-verification guess-proofing
router.post("/:id/confirm-payment", confirmPayment);
router.post("/:id/items/:itemId/request-cancellation", authLimiter, requestCancellation);
router.post("/:id/items/:itemId/request-return", authLimiter, requestReturn);

// Brand dashboard views: only that brand's own line items across all orders.
router.get("/brand/mine", requireBrandAuth, listBrandOrderItems);
router.patch("/items/:itemId/ship", requireBrandAuth, markShipped);
router.patch("/items/:itemId/cancellation", requireBrandAuth, respondToCancellation);
router.patch("/items/:itemId/return", requireBrandAuth, respondToReturn);
router.post("/items/:itemId/return/received", requireBrandAuth, confirmReturnReceived);

module.exports = router;
