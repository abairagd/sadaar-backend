async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send.");
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "SADAAR <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Resend send failed:", data);
    return { error: data };
  }
  return data;
}

module.exports = { sendEmail };
