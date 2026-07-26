const express = require("express");
const router = express.Router();
const { adminLogin, requireAdminAuth } = require("../middleware/adminAuth");
const { listAllBrands, updateBrandStatus, platformStats } = require("../controllers/adminController");

router.post("/login", adminLogin);
router.get("/brands", requireAdminAuth, listAllBrands);
router.patch("/brands/:id/status", requireAdminAuth, updateBrandStatus);
router.get("/stats", requireAdminAuth, platformStats);

module.exports = router;
