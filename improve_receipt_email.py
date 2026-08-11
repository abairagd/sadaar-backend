with open("src/controllers/paymentsController.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Safety check before touching anything.
line_8 = lines[7]   # 0-indexed
line_27 = lines[26]

if "function buildOrderEmailHtml" not in line_8:
    print(f"SAFETY CHECK FAILED — line 8 is not buildOrderEmailHtml. It says: {line_8!r}")
elif line_27.strip() != "}":
    print(f"SAFETY CHECK FAILED — line 27 is not a closing brace. It says: {line_27!r}")
else:
    new_function = '''function buildOrderEmailHtml(order, items) {
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
'''
    new_lines = lines[:7] + [new_function] + lines[27:]
    with open("src/controllers/paymentsController.js", "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Itemized receipt email added successfully.")
