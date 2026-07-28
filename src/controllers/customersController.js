const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db/pool");
const { isValidEmail, cleanString } = require("../utils/validators");
const { sendEmail } = require("../utils/sendEmail");

// Sign up for an account. If this email already placed a guest order before,
// that existing customer row (and its order history) is reused and upgraded
// with a password — nothing needs to be manually linked.
async function signup(req, res) {
  const fullName = cleanString(req.body.fullName, 160);
  const email = (req.body.email || "").trim();
  const phone = cleanString(req.body.phone, 30);
  const password = req.body.password;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (typeof password !== "string" || password.length < 4 || password.length > 200) {
    return res.status(400).json({ error: "Password must be between 4 and 200 characters." });
  }

  try {
    const existing = await pool.query("SELECT id, password_hash FROM customers WHERE email = $1", [email]);
    if (existing.rows.length > 0 && existing.rows[0].password_hash) {
      return res.status(409).json({ error: "An account with this email already exists. Try logging in instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let customer;
    if (existing.rows.length > 0) {
      const { rows } = await pool.query(
        "UPDATE customers SET full_name = $1, phone = COALESCE($2, phone), password_hash = $3 WHERE id = $4 RETURNING id, full_name, email",
        [fullName, phone || null, passwordHash, existing.rows[0].id]
      );
      customer = rows[0];
    } else {
      const { rows } = await pool.query(
        "INSERT INTO customers (full_name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, full_name, email",
        [fullName, email, phone || null, passwordHash]
      );
      customer = rows[0];
    }

    const token = jwt.sign({ customerId: customer.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, customer: { id: customer.id, fullName: customer.full_name, email: customer.email } });
  } catch (err) {
    console.error("customer signup error:", err);
    res.status(500).json({ error: "Could not create account.", detail: err.message });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM customers WHERE email = $1", [email.trim()]);
    if (rows.length === 0 || !rows[0].password_hash) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    const customer = rows[0];
    const ok = await bcrypt.compare(password, customer.password_hash);
    if (!ok) return res.status(401).json({ error: "Incorrect email or password." });

    const token = jwt.sign({ customerId: customer.id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, customer: { id: customer.id, fullName: customer.full_name, email: customer.email } });
  } catch (err) {
    console.error("customer login error:", err);
    res.status(500).json({ error: "Could not log in.", detail: err.message });
  }
}

async function requestPasswordReset(req, res) {
  const email = (req.body.email || "").trim();
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  try {
    const { rows } = await pool.query("SELECT id, full_name, password_hash FROM customers WHERE email = $1", [email]);
    if (rows.length > 0 && rows[0].password_hash) {
      const customer = rows[0];
      const token = crypto.randomBytes(32).toString("hex");
      await pool.query(
        "UPDATE customers SET reset_token = $1, reset_token_expires = now() + interval '1 hour' WHERE id = $2",
        [token, customer.id]
      );
      const resetUrl = `https://sadaar.com/?resetToken=${token}`;
      try {
        await sendEmail({
          to: email,
          subject: "Reset your SADAAR password",
          html: `
            <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
              <h2 style="color:#14282E;">Hi ${customer.full_name},</h2>
              <p>Click the link below to set a new password. This link expires in 1 hour.</p>
              <p><a href="${resetUrl}" style="background:#14282E;color:#FBF8F1;padding:12px 24px;text-decoration:none;display:inline-block;">Reset password</a></p>
              <p style="font-size:13px;color:#7A7566;">If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Customer password reset email failed:", emailErr);
      }
    }
    res.json({ message: "If that email has a SADAAR account, a reset link has been sent." });
  } catch (err) {
    console.error("customer requestPasswordReset error:", err);
    res.status(500).json({ error: "Could not process request.", detail: err.message });
  }
}

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
      "SELECT id FROM customers WHERE reset_token = $1 AND reset_token_expires > now()",
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      "UPDATE customers SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, rows[0].id]
    );
    res.json({ message: "Password updated. You can now log in." });
  } catch (err) {
    console.error("customer resetPassword error:", err);
    res.status(500).json({ error: "Could not reset password.", detail: err.message });
  }
}

async function getMyProfile(req, res) {
  try {
    const { rows } = await pool.query("SELECT id, full_name, email, phone FROM customers WHERE id = $1", [req.customerId]);
    if (rows.length === 0) return res.status(404).json({ error: "Account not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Could not load profile.", detail: err.message });
  }
}

async function getMyOrders(req, res) {
  try {
    const ordersRes = await pool.query(
      "SELECT id, status, payment_status, subtotal, shipping_fee, discount_amount, total, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
      [req.customerId]
    );
    const orders = ordersRes.rows;
    if (orders.length === 0) return res.json([]);

    const itemsRes = await pool.query(
      `SELECT oi.*, p.name AS product_name, b.name AS brand_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN brands b ON b.id = oi.brand_id
       WHERE oi.order_id = ANY($1::int[])`,
      [orders.map((o) => o.id)]
    );
    const itemsByOrder = {};
    for (const item of itemsRes.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    }
    res.json(orders.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })));
  } catch (err) {
    console.error("getMyOrders error:", err);
    res.status(500).json({ error: "Could not load order history.", detail: err.message });
  }
}

async function getMyWishlist(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.name, p.category, p.subcategory, p.price,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url,
              b.name AS brand_name
       FROM customer_wishlist w
       JOIN products p ON p.id = w.product_id
       JOIN brands b ON b.id = p.brand_id
       WHERE w.customer_id = $1
       ORDER BY w.created_at DESC`,
      [req.customerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load wishlist.", detail: err.message });
  }
}

async function addToWishlist(req, res) {
  const productId = req.body.productId;
  if (!productId) return res.status(400).json({ error: "productId is required." });
  try {
    await pool.query(
      "INSERT INTO customer_wishlist (customer_id, product_id) VALUES ($1,$2) ON CONFLICT (customer_id, product_id) DO NOTHING",
      [req.customerId, productId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not add to wishlist.", detail: err.message });
  }
}

async function removeFromWishlist(req, res) {
  try {
    await pool.query("DELETE FROM customer_wishlist WHERE customer_id = $1 AND product_id = $2", [req.customerId, req.params.productId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not remove from wishlist.", detail: err.message });
  }
}

async function listMyAddresses(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC",
      [req.customerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load addresses.", detail: err.message });
  }
}

async function createMyAddress(req, res) {
  const label = cleanString(req.body.label, 60);
  const fullName = cleanString(req.body.fullName, 160);
  const phone = cleanString(req.body.phone, 30);
  const city = cleanString(req.body.city, 80);
  const address = cleanString(req.body.address, 500);
  const isDefault = !!req.body.isDefault;

  if (!fullName || !city || !address) {
    return res.status(400).json({ error: "Full name, city, and address are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isDefault) {
      await client.query("UPDATE customer_addresses SET is_default = false WHERE customer_id = $1", [req.customerId]);
    }
    const { rows } = await client.query(
      `INSERT INTO customer_addresses (customer_id, label, full_name, phone, city, address, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.customerId, label || null, fullName, phone || null, city, address, isDefault]
    );
    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: "Could not save address.", detail: err.message });
  } finally {
    client.release();
  }
}

async function deleteMyAddress(req, res) {
  try {
    const { rows } = await pool.query(
      "DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2 RETURNING id",
      [req.params.id, req.customerId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Address not found." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not delete address.", detail: err.message });
  }
}

module.exports = {
  signup, login, requestPasswordReset, resetPassword, getMyProfile, getMyOrders,
  getMyWishlist, addToWishlist, removeFromWishlist,
  listMyAddresses, createMyAddress, deleteMyAddress,
};
