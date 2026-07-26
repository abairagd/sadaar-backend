const pool = require("../db/pool");

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

    res.json({ orderId: Number(orderId), paymentStatus: "paid", paymentRef: payment.id });
  } catch (err) {
    console.error("confirmPayment error:", err);
    res.status(500).json({ error: "Could not confirm payment.", detail: err.message });
  }
}

module.exports = { confirmPayment };
