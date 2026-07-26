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

module.exports = { listAllBrands, updateBrandStatus, platformStats };
