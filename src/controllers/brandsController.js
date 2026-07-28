const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db/pool");
const { isValidEmail, isValidCategory, cleanString } = require("../utils/validators");
const { sendEmail } = require("../utils/sendEmail");

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
      `SELECT id, name, slug, description, category, created_at,
              founder_story, brand_philosophy, origin_city,
              instagram_url, tiktok_url, snapchat_url, x_url, whatsapp_url, website_url
       FROM brands WHERE slug = $1 AND status = 'active'`,
      [req.params.slug]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    const brand = rows[0];

    const signatureRes = await pool.query(
      `SELECT p.id, p.name, p.category, p.subcategory, p.price,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url
       FROM products p
       WHERE p.brand_id = $1 AND p.is_signature = true AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [brand.id]
    );

    res.json({ ...brand, signatureProducts: signatureRes.rows });
  } catch (err) {
    res.status(500).json({ error: "Could not load brand.", detail: err.message });
  }
}

// Brand edits their own profile — founder story, philosophy, origin city, social links.
async function updateMyBrandProfile(req, res) {
  const founderStory = cleanString(req.body.founderStory, 4000);
  const brandPhilosophy = cleanString(req.body.brandPhilosophy, 4000);
  const originCity = cleanString(req.body.originCity, 100);
  const instagramUrl = cleanString(req.body.instagramUrl, 255);
  const tiktokUrl = cleanString(req.body.tiktokUrl, 255);
  const snapchatUrl = cleanString(req.body.snapchatUrl, 255);
  const xUrl = cleanString(req.body.xUrl, 255);
  const whatsappUrl = cleanString(req.body.whatsappUrl, 255);
  const websiteUrl = cleanString(req.body.websiteUrl, 255);

  try {
    const { rows } = await pool.query(
      `UPDATE brands
       SET founder_story = $1, brand_philosophy = $2, origin_city = $3,
           instagram_url = $4, tiktok_url = $5, snapchat_url = $6, x_url = $7, whatsapp_url = $8, website_url = $9
       WHERE id = $10
       RETURNING id`,
      [founderStory || null, brandPhilosophy || null, originCity || null,
       instagramUrl || null, tiktokUrl || null, snapchatUrl || null, xUrl || null, whatsappUrl || null, websiteUrl || null,
       req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json({ id: rows[0].id });
  } catch (err) {
    console.error("updateMyBrandProfile error:", err);
    res.status(500).json({ error: "Could not update profile.", detail: err.message });
  }
}

// A new brand applies to join SADAAR. Starts as "pending" until approved manually.
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

// Brand requests a reset link. Always responds the same way whether or not
// the email exists, so this endpoint can't be used to check which emails
// have brand accounts.
async function requestPasswordReset(req, res) {
  const email = (req.body.email || "").trim();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  try {
    const { rows } = await pool.query("SELECT id, name FROM brands WHERE contact_email = $1", [email]);
    if (rows.length > 0) {
      const brand = rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      await pool.query(
        "UPDATE brands SET reset_token = $1, reset_token_expires = now() + interval '1 hour' WHERE id = $2",
        [token, brand.id]
      );
      const resetUrl = `https://sadaar-brand-dashboard.vercel.app/?resetToken=${token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Reset your SADAAR brand dashboard password",
          html: `
            <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
              <h2 style="color:#14282E;">Hi ${brand.name},</h2>
              <p>Click the link below to set a new password. This link expires in 1 hour.</p>
              <p><a href="${resetUrl}" style="background:#14282E;color:#FBF8F1;padding:12px 24px;text-decoration:none;display:inline-block;">Reset password</a></p>
              <p style="font-size:13px;color:#7A7566;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Password reset email failed:", emailErr);
      }
    }
    res.json({ message: "If that email has a SADAAR brand account, a reset link has been sent." });
  } catch (err) {
    console.error("requestPasswordReset error:", err);
    res.status(500).json({ error: "Could not process request.", detail: err.message });
  }
}

// Brand submits their reset token + new password.
async function resetPassword(req, res) {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required." });
  }
  if (typeof password !== "string" || password.length < 4 || password.length > 200) {
    return res.status(400).json({ error: "Password must be between 4 and 200 characters." });
  }
  try {
    const { rows } = await pool.query(
      "SELECT id FROM brands WHERE reset_token = $1 AND reset_token_expires > now()",
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE brands SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, rows[0].id]
    );
    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ error: "Could not reset password.", detail: err.message });
  }
}

// Brand fetches their own full profile (including fields not exposed on the
// public getBrand endpoint) to pre-fill their profile edit form.
async function getMyBrandProfile(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, category, founder_story, brand_philosophy, origin_city,
              instagram_url, tiktok_url, snapchat_url, x_url, whatsapp_url, website_url
       FROM brands WHERE id = $1`,
      [req.brandId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Could not load profile.", detail: err.message });
  }
}

module.exports = { listBrands, getBrand, applyBrand, loginBrand, requestPasswordReset, resetPassword, getMyBrandProfile, updateMyBrandProfile };
