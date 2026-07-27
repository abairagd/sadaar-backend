const pool = require("../db/pool");
const { isValidCategory, cleanString, isPositiveNumber, isNonNegativeInt } = require("../utils/validators");

async function listProducts(req, res) {
  const { category, subcategory, brandId, sort, minPrice, maxPrice, search } = req.query;
  try {
    const params = [];
    let query = `
      SELECT p.id, p.name, p.description, p.category, p.subcategory, p.price, p.created_at,
             b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
             (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url
      FROM products p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.status = 'active' AND b.status = 'active'
    `;
    if (category) {
      params.push(category);
      query += ` AND p.category = $${params.length}`;
    }
    if (subcategory) {
      params.push(subcategory);
      query += ` AND p.subcategory = $${params.length}`;
    }
    if (brandId) {
      params.push(brandId);
      query += ` AND p.brand_id = $${params.length}`;
    }
    if (minPrice && !isNaN(Number(minPrice))) {
      params.push(Number(minPrice));
      query += ` AND p.price >= $${params.length}`;
    }
    if (maxPrice && !isNaN(Number(maxPrice))) {
      params.push(Number(maxPrice));
      query += ` AND p.price <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND p.name ILIKE $${params.length}`;
    }
    if (sort === "price-asc") query += " ORDER BY p.price ASC";
    else if (sort === "price-desc") query += " ORDER BY p.price DESC";
    else if (sort === "name-asc") query += " ORDER BY p.name ASC";
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
    const imagesRes = await pool.query(
      "SELECT id, url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC",
      [req.params.id]
    );
    res.json({ ...productRes.rows[0], variants: variantsRes.rows, images: imagesRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not load product.", detail: err.message });
  }
}

async function createProduct(req, res) {
  const name = cleanString(req.body.name, 160);
  const description = cleanString(req.body.description, 4000);
  const category = req.body.category;
  const subcategory = cleanString(req.body.subcategory, 60);
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
      `INSERT INTO products (brand_id, name, description, category, subcategory, price)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.brandId, name, description || null, category, subcategory || null, price]
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

async function updateVariantStock(req, res) {
  const stockQty = Number(req.body.stockQty);
  if (!isNonNegativeInt(stockQty)) {
    return res.status(400).json({ error: "Stock quantity must be a non-negative whole number." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE product_variants v
       SET stock_qty = $1
       FROM products p
       WHERE v.id = $2 AND v.product_id = p.id AND p.id = $3 AND p.brand_id = $4
       RETURNING v.id, v.stock_qty`,
      [stockQty, req.params.variantId, req.params.id, req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Variant not found for this brand's product." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateVariantStock error:", err);
    res.status(500).json({ error: "Could not update stock.", detail: err.message });
  }
}

async function archiveProduct(req, res) {
  try {
    const { rows } = await pool.query(
      `UPDATE products SET status = 'archived' WHERE id = $1 AND brand_id = $2 RETURNING id`,
      [req.params.id, req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Product not found for this brand." });
    res.json({ id: rows[0].id, status: "archived" });
  } catch (err) {
    console.error("archiveProduct error:", err);
    res.status(500).json({ error: "Could not remove product.", detail: err.message });
  }
}

module.exports = { listProducts, getProduct, createProduct, updateVariantStock, archiveProduct };
