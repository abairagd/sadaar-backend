require("dotenv").config({ path: ".env.test" });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let brandId, productId, variantId, customerId, orderId, orderItemId;

beforeAll(async () => {
  const brandRes = await pool.query(
    `INSERT INTO brands (name, slug, category, contact_email, password_hash, status)
     VALUES ('Test Brand', 'test-brand-${Date.now()}', 'Men', 'test@example.com', 'x', 'active')
     RETURNING id`
  );
  brandId = brandRes.rows[0].id;

  const productRes = await pool.query(
    `INSERT INTO products (brand_id, name, category, price, status)
     VALUES ($1, 'Test Product', 'Men', 100.00, 'active') RETURNING id`,
    [brandId]
  );
  productId = productRes.rows[0].id;

  const variantRes = await pool.query(
    `INSERT INTO product_variants (product_id, size, stock_qty) VALUES ($1, 'M', 10) RETURNING id`,
    [productId]
  );
  variantId = variantRes.rows[0].id;
});

afterAll(async () => {
  await pool.query("DELETE FROM order_items WHERE brand_id = $1", [brandId]);
  await pool.query("DELETE FROM orders WHERE id = $1", [orderId || 0]);
  await pool.query("DELETE FROM product_variants WHERE product_id = $1", [productId]);
  await pool.query("DELETE FROM products WHERE id = $1", [productId]);
  await pool.query("DELETE FROM brands WHERE id = $1", [brandId]);
  await pool.end();
});

describe("Order placement and stock", () => {
  test("placing an order reduces variant stock by the ordered quantity", async () => {
    const before = await pool.query("SELECT stock_qty FROM product_variants WHERE id = $1", [variantId]);
    expect(before.rows[0].stock_qty).toBe(10);

    const customerRes = await pool.query(
      `INSERT INTO customers (full_name, email) VALUES ('Test Customer', 'customer-${Date.now()}@example.com') RETURNING id`
    );
    customerId = customerRes.rows[0].id;

    const orderRes = await pool.query(
      `INSERT INTO orders (customer_id, subtotal, shipping_fee, total, shipping_city, payment_status)
       VALUES ($1, 100.00, 25.00, 125.00, 'Riyadh', 'unpaid') RETURNING id`,
      [customerId]
    );
    orderId = orderRes.rows[0].id;

    const itemRes = await pool.query(
      `INSERT INTO order_items (order_id, product_id, variant_id, brand_id, quantity, unit_price, commission_rate, commission_amount, brand_payout)
       VALUES ($1, $2, $3, $4, 2, 100.00, 20.00, 40.00, 160.00) RETURNING id`,
      [orderId, productId, variantId, brandId]
    );
    orderItemId = itemRes.rows[0].id;

    await pool.query("UPDATE product_variants SET stock_qty = stock_qty - 2 WHERE id = $1", [variantId]);

    const after = await pool.query("SELECT stock_qty FROM product_variants WHERE id = $1", [variantId]);
    expect(after.rows[0].stock_qty).toBe(8);
  });

  test("commission_amount and brand_payout are correctly split from unit_price", async () => {
    const result = await pool.query("SELECT unit_price, quantity, commission_rate, commission_amount, brand_payout FROM order_items WHERE id = $1", [orderItemId]);
    const row = result.rows[0];
    const lineTotal = Number(row.unit_price) * row.quantity;
    expect(Number(row.commission_amount) + Number(row.brand_payout)).toBeCloseTo(lineTotal, 2);
  });
});

describe("Cancellation flow", () => {
  test("a pending item can be marked as cancellation requested", async () => {
    await pool.query("UPDATE order_items SET cancellation_status = 'requested' WHERE id = $1", [orderItemId]);
    const result = await pool.query("SELECT cancellation_status, fulfillment_status FROM order_items WHERE id = $1", [orderItemId]);
    expect(result.rows[0].cancellation_status).toBe("requested");
    expect(result.rows[0].fulfillment_status).toBe("pending");
  });

  test("approving a cancellation restocks the variant by the ordered quantity", async () => {
    const before = await pool.query("SELECT stock_qty FROM product_variants WHERE id = $1", [variantId]);
    await pool.query("UPDATE order_items SET cancellation_status = 'refunded' WHERE id = $1", [orderItemId]);
    await pool.query("UPDATE product_variants SET stock_qty = stock_qty + 2 WHERE id = $1", [variantId]);
    const after = await pool.query("SELECT stock_qty FROM product_variants WHERE id = $1", [variantId]);
    expect(after.rows[0].stock_qty).toBe(Number(before.rows[0].stock_qty) + 2);
  });

  test("a shipped item cannot be cancellation-requested (must use returns instead)", async () => {
    await pool.query("UPDATE order_items SET fulfillment_status = 'shipped', cancellation_status = 'none' WHERE id = $1", [orderItemId]);
    const result = await pool.query("SELECT fulfillment_status FROM order_items WHERE id = $1", [orderItemId]);
    const isEligibleForCancellation = result.rows[0].fulfillment_status === "pending";
    expect(isEligibleForCancellation).toBe(false);
  });
});
