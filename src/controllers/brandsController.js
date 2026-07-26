const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { isValidEmail, isValidCategory, cleanString } = require("../utils/validators");

async function listBrands(req, res) {
  const { category } = req.query;
  try {
    const params = [];
    let query = "SELECT id, name, slug, description, category, created_at FROM brands WHERE status = 'active'";
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    query += " ORDER BY name ASC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("listBrands error:", err);
    res.status(500).json({ error: "Could not load brands.", code: err.code, detail: err.message, hint: err.hint });
  }
}

async function getBrand(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, slug, description, category, created_at FROM brands WHERE slug = $1 AND status = 'active'",
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Could not load brand.", detail: err.message });
  }
}

async function applyBrand(req, res) {
  const name = cleanString(req.body.name, 120);
  const description = cleanString(req.body.description, 2000);
  const category = req.body.category;
  const contactEmail = req.body.contactEmail;
  const contactPhone = cleanString(req.body.contactPhone, 30);
  const password = req.body.password;

  if (!name || !category || !contactEmail || !password) {
    return res.status(400).json({ error: "Name, category, contact email, and password are required." });
  }
  if (!isValidEmail(contactEmail)) {
    return res.status(400).json({ error: "Enter a valid contact email." });
  }
  if (!isValidCategory(category)) {
    return res.status(400).json({ error: "Choose a valid category." });
  }
  if (typeof password !== "string" || password.length < 4 || password.length > 200) {
    return res.status(400).json({ error: "Password must be between 4 and 200 characters." });
  }

  try {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO brands (name, slug, description, category, contact_email, contact_phone, password_hash, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id, name, slug, status`,
      [name, slug, description || null, category, contactEmail.trim(), contactPhone || null, passwordHash]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A brand with a similar name already exists." });
    res.status(500).json({ error: "Could not submit application.", detail: err.message });
  }
}

async function loginBrand(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM brands WHERE contact_email = $1", [email.trim()]);
    if (rows.length === 0) return res.status(401).json({ error: "Invalid email or password." });
    const brand = rows[0];
    const ok = await bcrypt.compare(password, brand.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });
    if (brand.status !== "active") return res.status(403).json({ error: "This brand account is not yet active." });

    const token = jwt.sign({ brandId: brand.id, name: brand.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, brand: { id: brand.id, name: brand.name, slug: brand.slug } });
  } catch (err) {
    res.status(500).json({ error: "Login failed.", detail: err.message });
  }
}

module.exports = { listBrands, getBrand, applyBrand, loginBrand };
