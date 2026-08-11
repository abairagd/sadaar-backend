const pool = require("../db/pool");
const { sendEmail } = require("../utils/sendEmail");

function money(n) {
  return `SAR ${Number(n).toLocaleString()}`;
}

function buildOrderEmailHtml(order, items) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 0;">${i.product_name} (${i.brand_name})</td>
        <td style="padding:8px 0;text-align:right;">${i.quantity} × ${money(i.unit_price)}</td>
        <td style="padding:8px 0;text-align:right;">${money(i.quantity * i.unit_price)}</td>
      </tr>`
    )
    .join("");
  const discountRow = Number(order.discount_amount) > 0
    ? `<tr><td colspan="2" style="padding:4px 0;color:#2F5B3C;">Discount${order.discount_code ? ` (${order.discount_code})` : ""}</td><td style="padding:4px 0;text-align:right;color:#2F5B3C;">-${money(order.discount_amount)}</td></tr>`
    : "";
  const shippingLabel = Number(order.shipping_fee) === 0 ? "Free" : money(order.shipping_fee);
  return `
    <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
      <h2 style="color:#14282E;">Thanks for your order, ${order.shipping_name}!</h2>
      <p>Order #${order.id} has been confirmed and paid. Each brand below has been notified to prepare your item(s) for shipping.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${rows}
        <tr><td colspan="2" style="padding-top:10px;border-top:1px solid #DCD2BB;">Subtotal</td><td style="padding-top:10px;border-top:1px solid #DCD2BB;text-align:right;">${money(order.subtotal)}</td></tr>
        <tr><td colspan="2" style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${shippingLabel}</td></tr>
        ${discountRow}
        <tr><td colspan="2" style="padding-top:8px;font-weight:bold;">Total</td><td style="padding-top:8px;text-align:right;font-weight:bold;">${money(order.total)}</td></tr>
      </table>
      <p style="font-size:13px;color:#7A7566;">Shipping to: ${order.shipping_address}, ${order.shipping_city}</p>
      <p style="font-size:13px;color:#7A7566;margin-top:24px;">— SADAAR, home of Saudi fashion</p>
    </div>
  `;
}

async function confirmPayment(req, res) {
  const { paymentId } = req.body;
  const orderId = req.params.id;

  if (!paymentId) return res.status(400).json({ error: "paymentId is required." });
  if (!process.env.MOYASAR_SECRET_KEY) {
    return res.status(500).json({ error: "Payment gateway isn't configured yet (MOYASAR_SECRET_KEY missing)." });
  }

  try {
    const orderRes = await pool.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: "Order not found." });
    const order = orderRes.rows[0];

    const moyasarRes = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
      headers: { Authorization: "Basic " + Buffer.from(`${process.env.MOYASAR_SECRET_KEY}:`).toString("base64") },
    });
    const payment = await moyasarRes.json();

    if (!moyasarRes.ok) {
      return res.status(400).json({ error: "Could not verify payment with Moyasar.", detail: payment.message || payment });
    }

    const expectedHalalas = Math.round(Number(order.total) * 100);
    if (payment.amount !== expectedHalalas) {
      return res.status(400).json({ error: "Payment amount does not match order total." });
    }

    if (payment.status !== "paid") {
      return res.status(400).json({ error: `Payment status is "${payment.status}", not paid.` });
    }

    await pool.query(
      `UPDATE orders SET payment_status = 'paid', payment_ref = $1, status = 'paid' WHERE id = $2`,
      [payment.id, orderId]
    );

    try {
      const customerRes = await pool.query(
        `SELECT c.email FROM customers c WHERE c.id = $1`,
        [order.customer_id]
      );
      const customerEmail = customerRes.rows[0]?.email;
      if (customerEmail) {
        const itemsRes = await pool.query(
          `SELECT oi.quantity, oi.unit_price, p.name AS product_name, b.name AS brand_name
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
           JOIN brands b ON b.id = oi.brand_id
           WHERE oi.order_id = $1`,
          [orderId]
        );
        await sendEmail({
          to: customerEmail,
          subject: `SADAAR order #${orderId} confirmed`,
          html: buildOrderEmailHtml({ ...order, id: orderId }, itemsRes.rows),
        });
      }
    } catch (emailErr) {
      console.error("Order confirmation email failed:", emailErr);
    }

    res.json({ orderId: Number(orderId), paymentStatus: "paid", paymentRef: payment.id });
  } catch (err) {
    console.error("confirmPayment error:", err);
    res.status(500).json({ error: "Could not confirm payment.", detail: err.message });
  }
}

module.exports = { confirmPayment };
