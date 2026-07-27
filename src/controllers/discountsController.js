const pool = require("../db/pool");
const { cleanString, isPositiveNumber } = require("../utils/validators");

function evaluateDiscount(row, subtotal) {
  if (!row.active) return { valid: false, error: "This code is no longer active." };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { valid: false, error: "This code has expired." };
  if (row.max_uses !== null && row.uses_count >= row.max_uses) return { valid: false, error: "This code has reached its usage limit." };
  if (Number(subtotal) < Number(row.min_subtotal)) {
    return { valid: false, error: `This code requires a subtotal of at least SAR ${row.min_subtotal}.` };
  }
  const amount = row.type === "percent"
    ? Math.round(subtotal * (Number(row.value) / 100) * 100) / 100
    : Math.min(Number(row.value), Number(subtotal));
  return { valid: true, amount };
}

async function validateDiscount(req, res) {
  const code = (req.body.code || "").trim().toUpperCase();
  const subtotal = Number(req.body.subtotal);
  if (!code || !isPositiveNumber(subtotal)) {
    return res.status(400).json({ error: "A code and a positive subtotal are required." });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM discount_codes WHERE UPPER(code) = $1", [code]);
    if (rows.length === 0) return res.status(404).json({ error: "That code doesn't exist." });

    const result = evaluateDiscount(rows[0], subtotal);
    if (!result.valid) return res.status(400).json({ error: result.error });

    res.json({ code, type: rows[0].type, value: Number(rows[0].value), discountAmount: result.amount });
  } catch (err) {
    console.error("validateDiscount error:", err);
    res.status(500).json({ error: "Could not check that code.", detail: err.message });
  }
}

async function listDiscountCodes(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM discount_codes ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Could not load discount codes.", detail: err.message });
  }
}

async function createDiscountCode(req, res) {
  const code = cleanString(req.body.code, 40)?.toUpperCase();
  const type = req.body.type;
  const value = Number(req.body.value);
  const minSubtotal = Number(req.body.minSubtotal) || 0;
  const maxUses = req.body.maxUses ? Number(req.body.maxUses) : null;
  const expiresAt = req.body.expiresAt || null;

  if (!code || !["percent", "fixed"].includes(type) || !isPositiveNumber(value)) {
    return res.status(400).json({ error: "Code, a valid type (percent/fixed), and a positive value are required." });
  }
  if (type === "percent" && value > 100) {
    return res.status(400).json({ error: "Percent discounts can't exceed 100." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO discount_codes (code, type, value, min_subtotal, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code, type, value, minSubtotal, maxUses, expiresAt]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "A code with that name already exists." });
    res.status(500).json({ error: "Could not create discount code.", detail: err.message });
  }
}

async function updateDiscountCodeStatus(req, res) {
  const { active } = req.body;
  if (typeof active !== "boolean") return res.status(400).json({ error: "active must be true or false." });
  try {
    const { rows } = await pool.query(
      "UPDATE discount_codes SET active = $1 WHERE id = $2 RETURNING *",
      [active, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Code not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Could not update code.", detail: err.message });
  }
}

module.exports = { evaluateDiscount, validateDiscount, listDiscountCodes, createDiscountCode, updateDiscountCodeStatus };
