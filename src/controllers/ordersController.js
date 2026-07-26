const pool = require("../db/pool");

// Places an order across possibly several brands in one checkout.
// body: { customer: {fullName, email, phone, city, address}, items: [{variantId, quantity}] }
// For each line item this snapshots the brand's current commission_rate so historical
// orders don't change if the brand's rate changes later, computes commission_amount and
// brand_payout, and decrements stock. Everything happens in one transaction.
async function placeOrder(req, res) {
  const { customer, items } = req.body;
  if (!customer || !customer.fullName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Customer details and at least one item are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Look up each variant with its product + brand commission rate, and lock the row
    // (FOR UPDATE) so concurrent orders can't oversell the same stock.
    const lineItems = [];
    for (const item of items) {
      const { rows } = await client.query(
        `SELECT v.id AS variant_id, v.stock_qty, p.id AS product_id, p.price, p.brand_id, b.commission_rate
         FROM product_variants v
         JOIN products p ON p.id = v.product_id
         JOIN brands b ON b.id = p.brand_id
         WHERE v.id = $1 FOR UPDATE`,
        [item.variantId]
      );
      if (rows.length === 0) throw new Error(`Variant ${item.variantId} not found.`);
      const row = rows[0];
      if (row.stock_qty < item.quantity) {
        throw new Error(`Not enough stock for variant ${item.variantId}.`);
      }
      lineItems.push({ ...row, quantity: item.quantity });
    }

    const subtotal = lineItems.reduce((s, li) => s + Number(li.price) * li.quantity, 0);

    const customerRes = await client.query(
      `INSERT INTO customers (full_name, email, phone) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id`,
      [customer.fullName, customer.email || null, customer.phone || null]
    );
    const customerId = customerRes.rows[0].id;

    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, subtotal, total, shipping_name, shipping_phone, shipping_city, shipping_address, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'unpaid') RETURNING id`,
      [customerId, subtotal, subtotal, customer.fullName, customer.phone || null, customer.city || null, customer.address || null]
    );
    const orderId = orderRes.rows[0].id;

    for (const li of lineItems) {
      const lineTotal = Number(li.price) * li.quantity;
      const commissionAmount = Math.round(lineTotal * (Number(li.commission_rate) / 100) * 100) / 100;
      const brandPayout = Math.round((lineTotal - commissionAmount) * 100) / 100;

      await client.query(
        `INSERT INTO order_items
         (order_id, product_id, variant_id, brand_id, quantity, unit_price, commission_rate, commission_amount, brand_payout)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [orderId, li.product_id, li.variant_id, li.brand_id, li.quantity, li.price, li.commission_rate, commissionAmount, brandPayout]
      );

      await client.query(
        `UPDATE product_variants SET stock_qty = stock_qty - $1 WHERE id = $2`,
        [li.quantity, li.variant_id]
      );
    }

    await client.query("COMMIT");

    // Order routing: in production this is where each brand gets notified
    // (email/webhook/dashboard push) that they have a new item to fulfill.
    // Left as a stub since no gateway/notification service is wired up yet.
    const distinctBrands = [...new Set(lineItems.map((li) => li.brand_id))];
    console.log(`Order #${orderId} routed to brand(s): ${distinctBrands.join(", ")}`);

    res.status(201).json({ orderId, subtotal, total: subtotal, status: "placed", paymentStatus: "unpaid" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: "Could not place order.", detail: err.message });
  } finally {
    client.release();
  }
}

async function getOrder(req, res) {
  const { contact } = req.query;
  if (!contact) {
    return res.status(400).json({ error: "Provide the email or phone number used on the order." });
  }
  try {
    const orderRes = await pool.query(
      `SELECT o.*, c.email AS customer_email, c.phone AS customer_phone
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: "Order not found." });
    const order = orderRes.rows[0];

    const contactNormalized = contact.trim().toLowerCase();
    const matches =
      (order.customer_email && order.customer_email.toLowerCase() === contactNormalized) ||
      (order.customer_phone && order.customer_phone.replace(/\s+/g, "") === contact.trim().replace(/\s+/g, ""));

    if (!matches) {
      return res.status(403).json({ error: "That email or phone doesn't match this order." });
    }

    const itemsRes = await pool.query(
      `SELECT oi.*, p.name AS product_name, b.name AS brand_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN brands b ON b.id = oi.brand_id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );
    const { customer_email, customer_phone, ...safeOrder } = order;
    res.json({ ...safeOrder, items: itemsRes.rows });
  } catch (err) {
    console.error("getOrder error:", err);
    res.status(500).json({ error: "Could not load order.", detail: err.message });
  }
}

// Brand dashboard: only the line items belonging to the logged-in brand (req.brandId).
async function listBrandOrderItems(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT oi.*, o.shipping_name, o.shipping_city, o.shipping_address, o.created_at AS order_created_at, p.name AS product_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE oi.brand_id = $1
       ORDER BY o.created_at DESC`,
      [req.brandId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load orders.", detail: err.message });
  }
}

// Brand marks their line item as shipped, with a tracking number.
async function markShipped(req, res) {
  const { trackingNumber } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE order_items SET fulfillment_status = 'shipped', tracking_number = $1, shipped_at = now()
       WHERE id = $2 AND brand_id = $3 RETURNING id`,
      [trackingNumber || null, req.params.itemId, req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Order item not found for this brand." });
    res.json({ id: rows[0].id, status: "shipped" });
  } catch (err) {
    res.status(500).json({ error: "Could not update fulfillment status.", detail: err.message });
  }
}

module.exports = { placeOrder, getOrder, listBrandOrderItems, markShipped };
