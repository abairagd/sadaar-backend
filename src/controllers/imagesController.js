const pool = require("../db/pool");

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "product-images";

function supabaseStorageBase() {
  return `${process.env.SUPABASE_URL}/storage/v1`;
}

async function uploadProductImage(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Image storage isn't configured yet (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)." });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Only JPEG, PNG, or WEBP images are allowed." });
  }
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be under 5MB." });
  }

  const productId = req.params.id;

  try {
    const productRes = await pool.query("SELECT id FROM products WHERE id = $1 AND brand_id = $2", [productId, req.brandId]);
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found for this brand." });
    }

    const ext = req.file.mimetype === "image/png" ? "png" : req.file.mimetype === "image/webp" ? "webp" : "jpg";
    const path = `${req.brandId}/${productId}/${Date.now()}.${ext}`;

const uploadRes = await fetch(`${supabaseStorageBase()}/object/${BUCKET}/${path}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": req.file.mimetype,
  },
  body: req.file.buffer,
});

if (!uploadRes.ok) {
      let detail = await uploadRes.text();
      if (!detail) detail = "(empty response body)";
      console.error(`Supabase Storage upload failed: status ${uploadRes.status}, body: ${detail}`);
      return res.status(500).json({ error: "Could not upload image.", status: uploadRes.status, detail });
    }

    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    const nextOrderRes = await pool.query(
      "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_id = $1",
      [productId]
    );
    const sortOrder = nextOrderRes.rows[0].next;

    const { rows } = await pool.query(
      "INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3) RETURNING id, url, sort_order",
      [productId, publicUrl, sortOrder]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("uploadProductImage error:", err);
    res.status(500).json({ error: "Could not upload image.", detail: err.message || err.toString() || "(unknown error)" });
  }
}

async function deleteProductImage(req, res) {
  try {
    const { rows } = await pool.query(
      `DELETE FROM product_images
       WHERE id = $1 AND product_id IN (SELECT id FROM products WHERE brand_id = $2)
       RETURNING id`,
      [req.params.imageId, req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Image not found for this brand." });
    res.json({ id: rows[0].id, deleted: true });
  } catch (err) {
    console.error("deleteProductImage error:", err);
    res.status(500).json({ error: "Could not delete image.", detail: err.message });
  }
}

module.exports = { uploadProductImage, deleteProductImage };
