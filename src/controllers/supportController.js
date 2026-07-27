const pool = require("../db/pool");
const { cleanString, isValidEmail } = require("../utils/validators");
const { sendEmail } = require("../utils/sendEmail");

async function submitMessage(req, res) {
  const name = cleanString(req.body.name, 160);
  const email = (req.body.email || "").trim();
  const subject = cleanString(req.body.subject, 200);
  const message = cleanString(req.body.message, 4000);

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO support_messages (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id`,
      [name, email, subject || null, message]
    );

    try {
      if (process.env.SUPPORT_EMAIL) {
        await sendEmail({
          to: process.env.SUPPORT_EMAIL,
          subject: `New contact message: ${subject || "(no subject)"}`,
          html: `
            <div style="font-family:Arial,sans-serif;color:#22201B;max-width:480px;margin:0 auto;">
              <h2 style="color:#16261C;">New message from ${name}</h2>
              <p style="font-size:13px;color:#7A7566;">${email}</p>
              <p style="white-space:pre-wrap;">${message}</p>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Support notification email failed:", emailErr);
    }

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    console.error("submitMessage error:", err);
    res.status(500).json({ error: "Could not send your message.", detail: err.message });
  }
}

async function listMessages(req, res) {
  try {
    const { rows } = await pool.query("SELECT * FROM support_messages ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error("listMessages error:", err);
    res.status(500).json({ error: "Could not load messages.", detail: err.message });
  }
}

async function markMessageRead(req, res) {
  try {
    const { rows } = await pool.query(
      "UPDATE support_messages SET status = 'read' WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Message not found." });
    res.json({ id: rows[0].id, status: "read" });
  } catch (err) {
    res.status(500).json({ error: "Could not update message.", detail: err.message });
  }
}

module.exports = { submitMessage, listMessages, markMessageRead };
