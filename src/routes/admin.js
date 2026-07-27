const express = require("express");
const router = express.Router();
const { adminLogin, requireAdminAuth } = require("../middleware/adminAuth");
const { listAllBrands, updateBrandStatus, updateBrandCommission, platformStats, listPendingPayouts, markBrandPayoutsPaid } = require("../controllers/adminController");
const { authLimiter } = require("../middleware/rateLimiters");

router.post("/login", authLimiter, adminLogin);
router.get("/brands", requireAdminAuth, listAllBrands);
router.patch("/brands/:id/status", requireAdminAuth, updateBrandStatus);
router.patch("/brands/:id/commission", requireAdminAuth, updateBrandCommission);
router.get("/stats", requireAdminAuth, platformStats);
router.get("/payouts", requireAdminAuth, listPendingPayouts);
router.post("/payouts/:brandId/mark-paid", requireAdminAuth, markBrandPayoutsPaid);

module.exports = router;
