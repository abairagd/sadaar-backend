const express = require("express");
const router = express.Router();
const requireCustomerAuth = require("../middleware/requireCustomerAuth");
const {
  signup, login, requestPasswordReset, resetPassword, getMyProfile, getMyOrders,
  getMyWishlist, addToWishlist, removeFromWishlist,
  listMyAddresses, createMyAddress, deleteMyAddress,
} = require("../controllers/customersController");
const { authLimiter, writeLimiter } = require("../middleware/rateLimiters");

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/request-password-reset", authLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);

router.get("/me", requireCustomerAuth, getMyProfile);
router.get("/me/orders", requireCustomerAuth, getMyOrders);

router.get("/me/wishlist", requireCustomerAuth, getMyWishlist);
router.post("/me/wishlist", requireCustomerAuth, writeLimiter, addToWishlist);
router.delete("/me/wishlist/:productId", requireCustomerAuth, removeFromWishlist);

router.get("/me/addresses", requireCustomerAuth, listMyAddresses);
router.post("/me/addresses", requireCustomerAuth, writeLimiter, createMyAddress);
router.delete("/me/addresses/:id", requireCustomerAuth, deleteMyAddress);

module.exports = router;
