const pool = require("../db/pool");
const { isValidEmail, cleanString, isNonNegativeInt } = require("../utils/validators");
const { evaluateDiscount } = require("./discountsController");
const { sendEmail } = require("../utils/sendEmail");

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
  if (items.length > 50) {
    return res.status(400).json({ error: "Too many items in one order (max 50)." });
  }
  for (const item of items) {
    if (!Number.isInteger(item.variantId) && !/^\d+$/.test(String(item.variantId))) {
      return res.status(400).json({ error: "Invalid item in order." });
    }
    if (!isNonNegativeInt(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return res.status(400).json({ error: "Quantity per item must be between 1 and 20." });
    }
  }

  const fullName = cleanString(customer.fullName, 160);
  const city = cleanString(customer.city, 80);
  const address = cleanString(customer.address, 500);
  const phone = cleanString(customer.phone, 30);
  const email = customer.email ? customer.email.trim() : null;

  if (!fullName || !city || !address) {
    return res.status(400).json({ error: "Full name, city, and address are required." });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email, or leave it blank." });
  }
  customer.fullName = fullName;
  customer.city = city;
  customer.address = address;
  customer.phone = phone;
  customer.email = email;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Look up each variant with its product + brand commission rate, and lock the row
    // (FOR UPDATE) so concurrent orders can't oversell the same stock.
    const lineItems = [];
    for (const item of items) {
      const { rows } = await client.query(
        `SELECT v.id AS variant_id, v.stock_qty, v.size, p.id AS product_id, p.name AS product_name, p.price, p.brand_id, b.commission_rate, b.name AS brand_name, b.contact_email AS brand_email
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

    // Shipping is charged per brand shipment, since each brand fulfills and ships
    // independently — waived if that brand's own subtotal in this order clears
    // the free-shipping threshold.
    const SHIPPING_FEE_PER_BRAND = 25;
    const FREE_SHIPPING_THRESHOLD = 300;
    const brandSubtotals = {};
    for (const li of lineItems) {
      brandSubtotals[li.brand_id] = (brandSubtotals[li.brand_id] || 0) + Number(li.price) * li.quantity;
    }
    const shippingFee = Object.values(brandSubtotals).reduce(
      (s, brandSubtotal) => s + (brandSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE_PER_BRAND),
      0
    );
    const total = Math.round((subtotal + shippingFee) * 100) / 100;

    // Re-validate the discount code server-side inside this same transaction —
    // never trust a discount amount sent from the browser. Lock the row so
    // concurrent orders can't both squeeze past a max_uses limit.
    let discountCode = null;
    let discountAmount = 0;
    if (req.body.discountCode) {
      const codeNormalized = String(req.body.discountCode).trim().toUpperCase();
      const discountRes = await client.query(
        "SELECT * FROM discount_codes WHERE UPPER(code) = $1 FOR UPDATE",
        [codeNormalized]
      );
      if (discountRes.rows.length === 0) {
        throw new Error("That discount code doesn't exist.");
      }
      const evaluation = evaluateDiscount(discountRes.rows[0], subtotal);
      if (!evaluation.valid) {
        throw new Error(evaluation.error);
      }
      discountCode = codeNormalized;
      discountAmount = evaluation.amount;
      await client.query("UPDATE discount_codes SET uses_count = uses_count + 1 WHERE id = $1", [discountRes.rows[0].id]);
    }

    const finalTotal = Math.round((total - discountAmount) * 100) / 100;

    const customerRes = await client.query(
      `INSERT INTO customers (full_name, email, phone) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id`,
      [customer.fullName, customer.email || null, customer.phone || null]
    );
    const customerId = customerRes.rows[0].id;

    const orderRes = await client.query(
      `INSERT INTO orders (customer_id, subtotal, shipping_fee, discount_code, discount_amount, total, shipping_name, shipping_phone, shipping_city, shipping_address, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'unpaid') RETURNING id`,
      [customerId, subtotal, shippingFee, discountCode, discountAmount, finalTotal, customer.fullName, customer.phone || null, customer.city || null, customer.address || null]
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

    // Low-stock alerts — if this order pushed a variant at or below the threshold,
    // email that brand so they can restock. Never let an email hiccup affect the
    // order itself, so this runs after commit and is fully wrapped in try/catch.
    try {
      const LOW_STOCK_THRESHOLD = 3;
      const lowStockByBrand = {};
      for (const li of lineItems) {
        const newStock = li.stock_qty - li.quantity;
        if (newStock <= LOW_STOCK_THRESHOLD) {
          if (!lowStockByBrand[li.brand_id]) lowStockByBrand[li.brand_id] = { email: li.brand_email, brandName: li.brand_name, items: [] };
          lowStockByBrand[li.brand_id].items.push({ productName: li.product_name, size: li.size, remaining: newStock });
        }
      }
      for (const brandId of Object.keys(lowStockByBrand)) {
        const { email, brandName, items } = lowStockByBrand[brandId];
        if (!email) continue;
        const rows = items.map((i) =>
          `<tr><td style="padding:6px 0;">${i.productName} (${i.size})</td><td style="padding:6px 0;text-align:right;">${i.remaining} left</td></tr>`
        ).join("");
        await sendEmail({
          to: email,
          subject: `Low stock alert — ${items.length} item(s) running low on SADAAR`,
          html: `
            <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
              <h2 style="color:#16261C;">Hi ${brandName},</h2>
              <p>A recent order (#${orderId}) brought the following down to ${LOW_STOCK_THRESHOLD} units or fewer:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
              <p style="font-size:13px;color:#7A7566;">Log into your SADAAR brand dashboard to restock or update these listings.</p>
            </div>
          `,
        });
      }
    } catch (alertErr) {
      console.error("Low-stock alert email failed:", alertErr);
    }

    res.status(201).json({ orderId, subtotal, shippingFee, discountCode, discountAmount, total: finalTotal, status: "placed", paymentStatus: "unpaid" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: "Could not place order.", detail: err.message });
  } finally {
    client.release();
  }
}

// Requires the customer to confirm their email or phone matches the order,
// so order details (name, address, items) can't be viewed by guessing an order
// number alone. This same endpoint powers the public "track your order" page.
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

// Customer requests cancellation of a single line item (not the whole order,
// since each brand fulfills independently). Requires the same email/phone
// verification as order lookup — the item must still be pending (not
// shipped) and belong to a paid order.
async function requestCancellation(req, res) {
  const { contact } = req.body;
  if (!contact) {
    return res.status(400).json({ error: "Provide the email or phone used on the order." });
  }
  try {
    const itemRes = await pool.query(
      `SELECT oi.*, o.payment_status, c.email AS customer_email, c.phone AS customer_phone
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE oi.id = $1 AND oi.brand_id = $2 FOR UPDATE OF oi`,
      [req.params.itemId, req.params.id]
    );
    if (itemRes.rows.length === 0) return res.status(404).json({ error: "Order item not found." });
    const item = itemRes.rows[0];

    const contactNormalized = contact.trim().toLowerCase();
    const matches =
      (item.customer_email && item.customer_email.toLowerCase() === contactNormalized) ||
      (item.customer_phone && item.customer_phone.replace(/\s+/g, "") === contact.trim().replace(/\s+/g, ""));
    if (!matches) {
      return res.status(403).json({ error: "That email or phone doesn't match this order." });
    }

    if (item.payment_status !== "paid") {
      return res.status(400).json({ error: "This order hasn't been paid yet." });
    }
    if (item.fulfillment_status !== "pending") {
      return res.status(400).json({ error: "This item has already shipped and can no longer be cancelled here — contact support instead." });
    }
    if (item.cancellation_status !== "none") {
      return res.status(400).json({ error: `A cancellation request already exists for this item (${item.cancellation_status}).` });
    }

    await pool.query("UPDATE order_items SET cancellation_status = 'requested' WHERE id = $1", [req.params.itemId]);
    res.json({ id: item.id, cancellationStatus: "requested" });
  } catch (err) {
    console.error("requestCancellation error:", err);
    res.status(500).json({ error: "Could not request cancellation.", detail: err.message });
  }
}

// Brand approves or denies a cancellation request. On approval: calls
// Moyasar's real refund API for that line item's value, restocks the
// variant, and emails the customer. Never affects other items in the same
// order — each brand's items are refunded/restocked independently.
async function respondToCancellation(req, res) {
  const { action } = req.body; // 'approve' | 'deny'
  if (!["approve", "deny"].includes(action)) {
    return res.status(400).json({ error: "action must be 'approve' or 'deny'." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const itemRes = await client.query(
      `SELECT oi.*, o.payment_ref, o.id AS order_id, p.name AS product_name,
              c.email AS customer_email, c.full_name AS customer_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE oi.id = $1 AND oi.brand_id = $2 FOR UPDATE OF oi`,
      [req.params.itemId, req.brandId]
    );
    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order item not found for this brand." });
    }
    const item = itemRes.rows[0];

    if (item.cancellation_status !== "requested") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `No pending cancellation request on this item (status: ${item.cancellation_status}).` });
    }

    if (action === "deny") {
      await client.query("UPDATE order_items SET cancellation_status = 'denied' WHERE id = $1", [item.id]);
      await client.query("COMMIT");
      return res.json({ id: item.id, cancellationStatus: "denied" });
    }

    // Approve: real refund via Moyasar for this line item's value.
    if (!process.env.MOYASAR_SECRET_KEY) {
      await client.query("ROLLBACK");
      return res.status(500).json({ error: "Payment gateway isn't configured yet." });
    }
    if (!item.payment_ref) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "No payment reference on this order — cannot process a refund." });
    }

    const refundHalalas = Math.round(Number(item.unit_price) * item.quantity * 100);
    const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${item.payment_ref}/refund`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${process.env.MOYASAR_SECRET_KEY}:`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: refundHalalas }),
    });
    const refundData = await moyasarRes.json();
    if (!moyasarRes.ok) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Moyasar refund failed.", detail: refundData.message || refundData });
    }

    await client.query("UPDATE order_items SET cancellation_status = 'refunded' WHERE id = $1", [item.id]);
    await client.query("UPDATE product_variants SET stock_qty = stock_qty + $1 WHERE id = $2", [item.quantity, item.variant_id]);

    await client.query("COMMIT");

    try {
      if (item.customer_email) {
        await sendEmail({
          to: item.customer_email,
          subject: `Refund processed for order #${item.order_id}`,
          html: `
            <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
              <h2 style="color:#14282E;">Hi ${item.customer_name || "there"},</h2>
              <p>Your cancellation for <strong>${item.product_name}</strong> (order #${item.order_id}) has been approved and refunded.</p>
              <p>SAR ${Number(item.unit_price * item.quantity).toFixed(2)} will be returned to your original payment method — this can take a few business days to appear, depending on your bank.</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Refund confirmation email failed:", emailErr);
    }

    res.json({ id: item.id, cancellationStatus: "refunded" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("respondToCancellation error:", err);
    res.status(500).json({ error: "Could not process cancellation.", detail: err.message });
  } finally {
    client.release();
  }
}

module.exports = { placeOrder, getOrder, listBrandOrderItems, markShipped, requestCancellation, respondToCancellation };
