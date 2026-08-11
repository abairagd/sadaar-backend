
// Generates a downloadable PDF receipt for an order. Works for guests (via
// ?contact= matching the order's email/phone, same verification as order
// lookup) or logged-in customers (via their JWT, if they own the order).
async function getOrderReceipt(req, res) {
  const orderId = req.params.id;
  const contact = req.query.contact;
  try {
    const orderRes = await pool.query(
      `SELECT o.*, c.email AS customer_email, c.phone AS customer_phone
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [orderId]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: "Order not found." });
    const order = orderRes.rows[0];

    const isOwner = req.customerId && order.customer_id === req.customerId;
    let contactMatches = false;
    if (contact) {
      const contactNormalized = contact.trim().toLowerCase();
      contactMatches =
        (order.customer_email && order.customer_email.toLowerCase() === contactNormalized) ||
        (order.customer_phone && order.customer_phone.replace(/\s+/g, "") === contact.trim().replace(/\s+/g, ""));
    }
    if (!isOwner && !contactMatches) {
      return res.status(403).json({ error: "Provide the email or phone used on this order." });
    }

    const itemsRes = await pool.query(
      `SELECT oi.quantity, oi.unit_price, p.name AS product_name, b.name AS brand_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN brands b ON b.id = oi.brand_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sadaar-order-${orderId}-receipt.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).fillColor("#14282E").text("SADAAR");
    doc.fontSize(10).fillColor("#7A7566").text("Home of Saudi Fashion");
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor("#22201B").text(`Order #${orderId}`);
    doc.fontSize(10).fillColor("#7A7566").text(`${new Date(order.created_at).toLocaleDateString()}`);
    doc.moveDown();

    doc.fontSize(10).fillColor("#22201B");
    doc.text(`Ship to: ${order.shipping_name || ""}`);
    doc.text(`${order.shipping_address || ""}, ${order.shipping_city || ""}`);
    doc.text(`${order.shipping_phone || ""}`);
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fontSize(10).fillColor("#7A7566");
    doc.text("Item", 50, tableTop);
    doc.text("Brand", 250, tableTop);
    doc.text("Qty", 350, tableTop, { width: 40, align: "right" });
    doc.text("Price", 400, tableTop, { width: 60, align: "right" });
    doc.text("Total", 470, tableTop, { width: 70, align: "right" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(540, doc.y).strokeColor("#DCD2BB").stroke();
    doc.moveDown(0.5);

    doc.fillColor("#22201B");
    itemsRes.rows.forEach((item) => {
      const y = doc.y;
      doc.text(item.product_name, 50, y, { width: 190 });
      doc.text(item.brand_name, 250, y, { width: 90 });
      doc.text(String(item.quantity), 350, y, { width: 40, align: "right" });
      doc.text(`SAR ${Number(item.unit_price).toLocaleString()}`, 400, y, { width: 60, align: "right" });
      doc.text(`SAR ${(item.quantity * item.unit_price).toLocaleString()}`, 470, y, { width: 70, align: "right" });
      doc.moveDown(0.8);
    });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(540, doc.y).strokeColor("#DCD2BB").stroke();
    doc.moveDown(0.5);

    const addSummaryRow = (label, value, bold) => {
      const y = doc.y;
      doc.fontSize(bold ? 12 : 10).fillColor(bold ? "#14282E" : "#22201B");
      doc.text(label, 400, y, { width: 60 });
      doc.text(value, 470, y, { width: 70, align: "right" });
      doc.moveDown(0.5);
    };

    addSummaryRow("Subtotal", `SAR ${Number(order.subtotal).toLocaleString()}`, false);
    addSummaryRow("Shipping", Number(order.shipping_fee) === 0 ? "Free" : `SAR ${Number(order.shipping_fee).toLocaleString()}`, false);
    if (Number(order.discount_amount) > 0) {
      addSummaryRow("Discount", `-SAR ${Number(order.discount_amount).toLocaleString()}`, false);
    }
    addSummaryRow("Total", `SAR ${Number(order.total).toLocaleString()}`, true);

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#7A7566").text("Each item is shipped directly by the brand that made it. Thank you for shopping SADAAR.", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("getOrderReceipt error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not generate receipt.", detail: err.message });
    }
  }
}
