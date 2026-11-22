const pool = require("../db/pool");
const { categoriesForBrand } = require("../utils/validators");

// Each placement is its own paid space, priced per duration (days -> SAR).
// The homepage is the most visible, so it costs the most. Edit prices here.
const SPOTLIGHT_PRICES = {
  Home: { 7: 200, 14: 350, 30: 600 },
  Men: { 7: 120, 14: 210, 30: 360 },
  Women: { 7: 120, 14: 210, 30: 360 },
  Perfumes: { 7: 120, 14: 210, 30: 360 },
};
const PLACEMENTS = Object.keys(SPOTLIGHT_PRICES);

const BANNER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BANNER_BUCKET = "product-images";

async function getPricing(req, res) {
  res.json(SPOTLIGHT_PRICES);
}

async function createSpotlightPurchase(req, res) {
  const placement = req.body.placement || "Home";
  if (!PLACEMENTS.includes(placement)) {
    return res.status(400).json({ error: "Choose a valid spotlight space (Home, Men, Women, or Perfumes)." });
  }
  const durationDays = Number(req.body.durationDays);
  const price = SPOTLIGHT_PRICES[placement][durationDays];
  if (!price) {
    return res.status(400).json({ error: "Choose a valid duration (7, 14, or 30 days)." });
  }
  try {
    // A brand can take the homepage, or the page of a category it is approved to sell in.
    if (placement !== "Home") {
      const brandRes = await pool.query("SELECT category FROM brands WHERE id = $1", [req.brandId]);
      const allowed = categoriesForBrand(brandRes.rows[0] && brandRes.rows[0].category);
      if (!allowed.includes(placement)) {
        return res.status(403).json({ error: "Your brand isn't set up to sell in that category. Contact SADAAR to add it." });
      }
    }
    // Don't let a brand pay twice for a space it already holds.
    const activeRes = await pool.query(
      `SELECT ends_at FROM spotlight_slots
       WHERE brand_id = $1 AND placement = $2 AND payment_status = 'paid' AND ends_at > now() LIMIT 1`,
      [req.brandId, placement]
    );
    if (activeRes.rows.length > 0) {
      return res.status(409).json({ error: `You already have an active spotlight on this space until ${new Date(activeRes.rows[0].ends_at).toLocaleDateString()}.` });
    }
    const { rows } = await pool.query(
      `INSERT INTO spotlight_slots (brand_id, duration_days, price, placement) VALUES ($1,$2,$3,$4) RETURNING id, price, placement`,
      [req.brandId, durationDays, price, placement]
    );
    res.status(201).json({ id: rows[0].id, price: Number(rows[0].price), placement: rows[0].placement });
  } catch (err) {
    console.error("createSpotlightPurchase error:", err);
    res.status(500).json({ error: "Could not start spotlight purchase.", detail: err.message });
  }
}

async function confirmSpotlightPayment(req, res) {
  const { paymentId } = req.body;
  const slotId = req.params.id;

  if (!paymentId) return res.status(400).json({ error: "paymentId is required." });
  if (!process.env.MOYASAR_SECRET_KEY) {
    return res.status(500).json({ error: "Payment gateway isn't configured yet." });
  }

  try {
    const slotRes = await pool.query("SELECT * FROM spotlight_slots WHERE id = $1 AND brand_id = $2", [slotId, req.brandId]);
    if (slotRes.rows.length === 0) return res.status(404).json({ error: "Spotlight purchase not found." });
    const slot = slotRes.rows[0];

    const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
      headers: { Authorization: "Basic " + Buffer.from(`${process.env.MOYASAR_SECRET_KEY}:`).toString("base64") },
    });
    const payment = await moyasarRes.json();
    if (!moyasarRes.ok) {
      return res.status(400).json({ error: "Could not verify payment with Moyasar.", detail: payment.message || payment });
    }

    const expectedHalalas = Math.round(Number(slot.price) * 100);
    if (payment.amount !== expectedHalalas) {
      return res.status(400).json({ error: "Payment amount does not match spotlight price." });
    }
    if (payment.status !== "paid") {
      return res.status(400).json({ error: `Payment status is "${payment.status}", not paid.` });
    }

    const { rows } = await pool.query(
      `UPDATE spotlight_slots
       SET payment_status = 'paid', payment_ref = $1, starts_at = now(), ends_at = now() + ($2 || ' days')::interval
       WHERE id = $3 RETURNING *`,
      [payment.id, slot.duration_days, slotId]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("confirmSpotlightPayment error:", err);
    res.status(500).json({ error: "Could not confirm payment.", detail: err.message });
  }
}

// Brand uploads the banner picture for one of its paid spotlights. It stays
// hidden (pending) until an admin approves it.
async function uploadSpotlightBanner(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Image storage isn't configured yet." });
  }
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  if (!BANNER_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Only JPEG, PNG, or WEBP images are allowed." });
  }
  if (req.file.size > 5 * 1024 * 1024) return res.status(400).json({ error: "Image must be under 5MB." });

  try {
    const slotRes = await pool.query(
      "SELECT id FROM spotlight_slots WHERE id = $1 AND brand_id = $2 AND payment_status = 'paid'",
      [req.params.id, req.brandId]
    );
    if (slotRes.rows.length === 0) {
      return res.status(404).json({ error: "Paid spotlight not found for this brand." });
    }

    const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
    const path = `spotlight/${req.brandId}/${req.params.id}/${Date.now()}.${ext}`;
    const uploadRes = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BANNER_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": req.file.mimetype,
      },
      body: req.file.buffer,
    });
    if (!uploadRes.ok) {
      const detail = (await uploadRes.text()) || "(empty response body)";
      console.error(`Spotlight banner upload failed: status ${uploadRes.status}, body: ${detail}`);
      return res.status(500).json({ error: "Could not upload image.", status: uploadRes.status });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BANNER_BUCKET}/${path}`;
    const { rows } = await pool.query(
      `UPDATE spotlight_slots SET image_url = $1, image_status = 'pending' WHERE id = $2 RETURNING id, image_url, image_status`,
      [publicUrl, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("uploadSpotlightBanner error:", err);
    res.status(500).json({ error: "Could not save banner.", detail: err.message });
  }
}

// Admin approves or rejects a brand's banner. Only approved banners are shown publicly.
async function reviewSpotlightBanner(req, res) {
  const status = req.body.status;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Status must be approved or rejected." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE spotlight_slots SET image_status = $1 WHERE id = $2 AND image_url IS NOT NULL RETURNING id, image_status`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No banner to review for that spotlight." });
    res.json(rows[0]);
  } catch (err) {
    console.error("reviewSpotlightBanner error:", err);
    res.status(500).json({ error: "Could not update banner status.", detail: err.message });
  }
}

async function listActiveSpotlights(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.ends_at, s.placement,
             CASE WHEN s.image_status = 'approved' THEN s.image_url END AS image_url,
             b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug, b.description AS brand_description, b.category
      FROM spotlight_slots s
      JOIN brands b ON b.id = s.brand_id
      WHERE s.payment_status = 'paid' AND s.ends_at > now() AND b.status = 'active'
      ORDER BY s.ends_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("listActiveSpotlights error:", err);
    res.status(500).json({ error: "Could not load spotlights.", detail: err.message });
  }
}

async function listMySpotlights(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM spotlight_slots WHERE brand_id = $1 ORDER BY created_at DESC",
      [req.brandId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load spotlight history.", detail: err.message });
  }
}

async function listAllSpotlights(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, b.name AS brand_name
      FROM spotlight_slots s
      JOIN brands b ON b.id = s.brand_id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load spotlight purchases.", detail: err.message });
  }
}

module.exports = {
  getPricing, createSpotlightPurchase, confirmSpotlightPayment,
  listActiveSpotlights, listMySpotlights, listAllSpotlights,
  uploadSpotlightBanner, reviewSpotlightBanner,
};
