with open("src/controllers/adminController.js", "r", encoding="utf-8") as f:
    content = f.read()

old_list = '''async function listAllBrands(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, category, contact_email, contact_phone, commission_rate, status, created_at
       FROM brands ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("listAllBrands error:", err);
    res.status(500).json({ error: "Could not load brands.", detail: err.message });
  }
}'''

new_list = '''async function listAllBrands(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, description, category, contact_email, contact_phone, commission_rate, status, created_at,
              vetting_legitimacy, vetting_quality, vetting_fulfillment, vetting_fit, vetting_authenticity
       FROM brands ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("listAllBrands error:", err);
    res.status(500).json({ error: "Could not load brands.", detail: err.message });
  }
}

// Brand can only be moved to 'active' once every vetting checkbox has been
// confirmed by an admin — see BRAND_VETTING_STANDARD.md for what each one means.
async function updateBrandVetting(req, res) {
  const { legitimacy, quality, fulfillment, fit, authenticity } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE brands
       SET vetting_legitimacy = $1, vetting_quality = $2, vetting_fulfillment = $3, vetting_fit = $4, vetting_authenticity = $5
       WHERE id = $6
       RETURNING id, vetting_legitimacy, vetting_quality, vetting_fulfillment, vetting_fit, vetting_authenticity`,
      [!!legitimacy, !!quality, !!fulfillment, !!fit, !!authenticity, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandVetting error:", err);
    res.status(500).json({ error: "Could not update vetting checklist.", detail: err.message });
  }
}'''

old_update_status = '''async function updateBrandStatus(req, res) {
  const { status } = req.body;
  if (!["active", "pending", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Status must be active, pending, or suspended." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE brands SET status = $1 WHERE id = $2 RETURNING id, name, status`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandStatus error:", err);
    res.status(500).json({ error: "Could not update brand status.", detail: err.message });
  }
}'''

new_update_status = '''async function updateBrandStatus(req, res) {
  const { status } = req.body;
  if (!["active", "pending", "suspended"].includes(status)) {
    return res.status(400).json({ error: "Status must be active, pending, or suspended." });
  }
  try {
    if (status === "active") {
      const check = await pool.query(
        `SELECT vetting_legitimacy, vetting_quality, vetting_fulfillment, vetting_fit, vetting_authenticity
         FROM brands WHERE id = $1`,
        [req.params.id]
      );
      if (check.rows.length === 0) return res.status(404).json({ error: "Brand not found." });
      const v = check.rows[0];
      const allChecked = v.vetting_legitimacy && v.vetting_quality && v.vetting_fulfillment && v.vetting_fit && v.vetting_authenticity;
      if (!allChecked) {
        return res.status(400).json({ error: "This brand can't be approved yet — complete all five vetting checklist items first." });
      }
    }
    const { rows } = await pool.query(
      `UPDATE brands SET status = $1 WHERE id = $2 RETURNING id, name, status`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Brand not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("updateBrandStatus error:", err);
    res.status(500).json({ error: "Could not update brand status.", detail: err.message });
  }
}'''

if old_list not in content or old_update_status not in content:
    print("EXACT MATCH NOT FOUND — no changes made.")
else:
    content = content.replace(old_list, new_list)
    content = content.replace(old_update_status, new_update_status)
    with open("src/controllers/adminController.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("adminController.js updated successfully.")
