const pool = require("../db/pool");

const SPOTLIGHT_TIERS = {
  7: 200,
  14: 350,
  30: 600,
};

async function getPricing(req, res) {
  res.json(SPOTLIGHT_TIERS);
}

async function createSpotlightPurchase(req, res) {
  const durationDays = Number(req.body.durationDays);
  const price = SPOTLIGHT_TIERS[durationDays];
  if (!price) {
    return res.status(400).json({ error: "Choose a valid duration (7, 14, or 30 days)." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO spotlight_slots (brand_id, duration_days, price) VALUES ($1,$2,$3) RETURNING id, price`,
      [req.brandId, durationDays, price]
    );
    res.status(201).json({ id: rows[0].id, price: Number(rows[0].price) });
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

async function listActiveSpotlights(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.ends_at, b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug, b.description AS brand_description, b.category
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
};
