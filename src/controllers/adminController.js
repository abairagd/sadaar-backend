const pool = require("../db/pool");

async function listAllBrands(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, category, contact_email, contact_phone, commission_rate, status, created_at
       FROM brands ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("listAllBrands error:", err);
    res.status(500).json({ error: "Could not load brands.", detail: err.message });
  }
}

async function updateBrandStatus(req, res) {
  const { status } = req.body;
  if (!["active", "pending", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Status must be active, pending, or suspended." });
    
    async function updateBrandCommission(req, res) {
  const commissionRate = Number(req.body.commissionRate);
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    return res.status(400).json({ error: "Commission rate must be a number between 0 and 100." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE brands SET commission_rate = $1 WHERE id = $2 RETURNING id, name, commission_rate`,
      [commissionRate, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandCommission error:", err);
    res.status(500).json({ error: "Could not update commission rate.", detail: err.message });
  }
}
  try {
    const { rows } = await pool.query(
      `UPDATE brands SET commission_rate = $1 WHERE id = $2 RETURNING id, name, commission_rate`,
      [commissionRate, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandCommission error:", err);
    res.status(500).json({ error: "Could not update commission rate.", detail: err.message });
  }
}
  }
  try {
    const { rows } = await pool.query(
      `UPDATE brands SET status = $1 WHERE id = $2 RETURNING id, name, status`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandStatus error:", err);
    res.status(500).json({ error: "Could not update brand status.", detail: err.message });
  }
}

async function platformStats(req, res) {
  try {
    const [brandCounts, orderStats, topBrands] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count FROM brands GROUP BY status`),
      pool.query(`
        SELECT COUNT(DISTINCT o.id)::int AS order_count,
               COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float AS gmv,
               COALESCE(SUM(oi.commission_amount), 0)::float AS commission_revenue
        FROM orders o JOIN order_items oi ON oi.order_id = o.id
      `),
      pool.query(`
        SELECT b.name, COUNT(oi.id)::int AS items_sold, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float AS revenue
        FROM order_items oi JOIN brands b ON b.id = oi.brand_id
        GROUP BY b.name ORDER BY revenue DESC LIMIT 5
      `),
    ]);

    const statusMap = { active: 0, pending: 0, suspended: 0 };
    brandCounts.rows.forEach((r) => { statusMap[r.status] = r.count; });

    res.json({
      brands: statusMap,
      gmv: orderStats.rows[0].gmv,
      orderCount: orderStats.rows[0].order_count,
      commissionRevenue: orderStats.rows[0].commission_revenue,
      topBrands: topBrands.rows,
    });
  } catch (err) {
    console.error("platformStats error:", err);
    res.status(500).json({ error: "Could not load platform stats.", detail: err.message });
  }
}

async function listPendingPayouts(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT b.id AS brand_id, b.name AS brand_name,
             COUNT(oi.id)::int AS item_count,
             COALESCE(SUM(oi.brand_payout), 0)::float AS amount_due
      FROM order_items oi
      JOIN brands b ON b.id = oi.brand_id
      WHERE oi.payout_status = 'pending' AND oi.fulfillment_status IN ('shipped', 'delivered')
      GROUP BY b.id, b.name
      HAVING COALESCE(SUM(oi.brand_payout), 0) > 0
      ORDER BY amount_due DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("listPendingPayouts error:", err);
    res.status(500).json({ error: "Could not load pending payouts.", detail: err.message });
  }
}

async function markBrandPayoutsPaid(req, res) {
  const { reference } = req.body;
  const brandId = req.params.brandId;
  try {
    const { rows } = await pool.query(
      `UPDATE order_items
       SET payout_status = 'paid', payout_date = now(), payout_reference = $1
       WHERE brand_id = $2 AND payout_status = 'pending' AND fulfillment_status IN ('shipped', 'delivered')
       RETURNING id, brand_payout`,
      [reference || null, brandId]
    );
    const total = rows.reduce((s, r) => s + Number(r.brand_payout), 0);
    res.json({ itemsMarked: rows.length, totalPaid: total });
  } catch (err) {
    console.error("markBrandPayoutsPaid error:", err);
    res.status(500).json({ error: "Could not mark payouts as paid.", detail: err.message });
  }
}

module.exports = { listAllBrands, updateBrandStatus, updateBrandCommission, platformStats, listPendingPayouts, markBrandPayoutsPaid };
