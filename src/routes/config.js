const express = require("express");
const router = express.Router();

router.get("/moyasar", (req, res) => {
  res.json({ publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY || null });
});

module.exports = router;
