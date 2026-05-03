import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(express.json());

// ── Anthropic client ──────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Gmail transporter ─────────────────────────────────────────────
// Uses an App Password (NOT your real Gmail password)
// Set these in Render → Environment Variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,   // e.g. you@gmail.com
    pass: process.env.GMAIL_PASS,   // 16-char App Password from Google
  },
});

// ── POST /api/chat ────────────────────────────────────────────────
// Existing chat endpoint — unchanged
app.post("/api/chat", async (req, res) => {
  const { messages, systemPrompt } = req.body;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });
    res.json({ content: response.content[0].text });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ── POST /api/lead ────────────────────────────────────────────────
// Called by the frontend whenever the AI collects a complete lead
app.post("/api/lead", async (req, res) => {
  const { name, email, phone, interest, practice } = req.body;

  // Basic validation — need at least name + one contact method
  if (!name || (!email && !phone)) {
    return res.status(400).json({ error: "Need name and at least email or phone" });
  }

  // ── Format the email ──
  const practiceLabel = practice || "BrightSmile Dental";
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full",
    timeStyle: "short",
  });

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <div style="background:#2E5247;padding:20px 24px;border-radius:10px 10px 0 0;">
        <h2 style="color:white;margin:0;font-size:18px;">🔔 New Lead — ${practiceLabel}</h2>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px;">${timestamp}</p>
      </div>
      <div style="border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 10px 10px;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:10px 0;color:#666;width:120px;">Name</td>
              <td style="padding:10px 0;font-weight:500;">${name}</td></tr>
          <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;">Email</td>
              <td style="padding:10px 0;">${email ? `<a href="mailto:${email}" style="color:#2E5247;">${email}</a>` : "—"}</td></tr>
          <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;">Phone</td>
              <td style="padding:10px 0;">${phone ? `<a href="tel:${phone}" style="color:#2E5247;">${phone}</a>` : "—"}</td></tr>
          <tr style="border-top:1px solid #f0f0f0;">
              <td style="padding:10px 0;color:#666;">Interested in</td>
              <td style="padding:10px 0;">${interest || "General enquiry"}</td></tr>
        </table>
        <div style="margin-top:20px;padding:14px;background:#f5f9f8;border-radius:8px;font-size:13px;color:#555;">
          💡 This lead came from your AI chatbot on <strong>${practiceLabel}</strong>. Reply within the hour for the best conversion rate.
        </div>
      </div>
    </div>
  `;

  const textBody = `
New Lead — ${practiceLabel}
Time: ${timestamp}

Name:         ${name}
Email:        ${email || "—"}
Phone:        ${phone || "—"}
Interested in: ${interest || "General enquiry"}

Reply quickly — leads contacted within 1 hour convert 7x better.
  `.trim();

  try {
    await transporter.sendMail({
      from: `"${practiceLabel} AI" <${process.env.GMAIL_USER}>`,
      to: process.env.LEAD_EMAIL || process.env.GMAIL_USER,  // where YOU want leads sent
      subject: `🔔 New lead from ${name} — ${practiceLabel}`,
      text: textBody,
      html: htmlBody,
    });

    console.log(`Lead captured: ${name} | ${email || phone}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ error: "Failed to send lead email" });
  }
});

// ── Health check ──────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Transformly API running ✓"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
