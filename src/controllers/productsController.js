const pool = require("../db/pool");
const { isValidCategory, cleanString, isPositiveNumber, isNonNegativeInt } = require("../utils/validators");

async function listProducts(req, res) {
  const { category, brandId, sort } = req.query;
  try {
    const params = [];
    let query = `
      SELECT p.id, p.name, p.description, p.category, p.price, p.created_at,
             b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.status = 'active' AND b.status = 'active'
    `;
    if (category) {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    if (brandId) {
      params.push(brandId);
      query += ` AND p.brand_id = $${params.length}`;
    }
    if (sort === "price-asc") query += " ORDER BY p.price ASC";
    else if (sort === "price-desc") query += " ORDER BY p.price DESC";
    else query += " ORDER BY p.created_at DESC";

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load products.", detail: err.message });
  }
}

async function getProduct(req, res) {
  try {
    const productRes = await pool.query(
      `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug
       FROM products p JOIN brands b ON b.id = p.brand_id
       WHERE p.id = $1 AND p.status = 'active'`,
      [req.params.id]
    );
    if (productRes.rows.length === 0) return res.status(404).json({ error: "Product not found." });

    const variantsRes = await pool.query(
      "SELECT id, size, stock_qty FROM product_variants WHERE product_id = $1 ORDER BY id ASC",
      [req.params.id]
    );
    res.json({ ...productRes.rows[0], variants: variantsRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not load product.", detail: err.message });
  }
}

async function createProduct(req, res) {
  const name = cleanString(req.body.name, 160);
  const description = cleanString(req.body.description, 4000);
  const category = req.body.category;
  const price = req.body.price;
  const sizes = req.body.sizes;

  if (!name || !category || !isPositiveNumber(price) || !Array.isArray(sizes) || sizes.length === 0) {
    return res.status(400).json({ error: "Name, category, a positive price, and at least one size are required." });
  }
  if (!isValidCategory(category)) {
    return res.status(400).json({ error: "Choose a valid category." });
  }
  if (sizes.length > 30) {
    return res.status(400).json({ error: "Too many size variants (max 30)." });
  }
  for (const s of sizes) {
    const size = cleanString(s.size, 20);
    if (!size) return res.status(400).json({ error: "Each size variant needs a size label." });
    if (s.stockQty !== undefined && !isNonNegativeInt(s.stockQty)) {
      return res.status(400).json({ error: "Stock quantity must be a non-negative whole number." });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const productRes = await client.query(
      `INSERT INTO products (brand_id, name, description, category, price)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.brandId, name, description || null, category, price]
    );
    const productId = productRes.rows[0].id;

    for (const s of sizes) {
      const size = cleanString(s.size, 20);
      const sku = cleanString(s.sku, 60);
      await client.query(
        `INSERT INTO product_variants (product_id, size, sku, stock_qty) VALUES ($1,$2,$3,$4)`,
        [productId, size, sku || null, s.stockQty || 0]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ id: productId });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Could not create product.", detail: err.message });
  } finally {
    client.release();
  }
}

module.exports = { listProducts, getProduct, createProduct };
