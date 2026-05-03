const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// ── OpenAI client ─────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ── Gmail transporter ─────────────────────────────────────────────
// Add these in Render → Environment Variables:
//   GMAIL_USER  →  you@gmail.com
//   GMAIL_PASS  →  16-char App Password (from Google, NOT your real password)
//   LEAD_EMAIL  →  where leads get sent (can be same as GMAIL_USER)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  }
});

// ── GET / — health check ──────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'BrightSmile Chat API' });
});

// ── POST /api/chat ────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `You are a helpful dental practice assistant for BrightSmile Dental.

Key information:
- Location: 9876 Wilshire Blvd, Suite 300, Beverly Hills, CA 90210
- Phone: (310) 555-0190
- Hours: Mon-Fri 8am-6pm, Sat 9am-3pm, Sunday closed
- Accepted insurance: Delta Dental, MetLife, Cigna, Aetna, Guardian, United Concordia, BlueCross BlueShield
- CareCredit financing available
- Accepting new patients: Yes
- Parking: Free validated parking in building garage, enter on Reeves Drive

Doctors:
- Dr. Sarah Chen, DDS - General & Cosmetic Dentistry
- Dr. Marcus Webb - Orthodontics & Invisalign (Diamond Provider)
- Dr. Priya Nair - Implants & Oral Surgery

Services & approximate prices:
- New patient exam + X-rays + cleaning: $150-$200
- Routine cleaning: $100-$150
- Teeth whitening (in-office Zoom): $450-$600
- Teeth whitening (take-home trays): $250-$350
- Invisalign: $3,500-$7,000 (free consultation available)
- Dental implant (single tooth): $3,000-$4,500
- Porcelain veneers: $1,200-$2,000 per tooth
- Filling: $150-$300 | Crown: $1,200-$1,800
- Root canal: $800-$1,500
- Emergency exam: $75-$150 (same-day available)

Be friendly, warm, and reassuring - many patients are nervous about dental visits.
Keep responses concise (2-4 sentences). Encourage booking appointments.
If unsure about clinical questions, suggest speaking with one of the doctors.
Always end with a gentle next-step suggestion.

LEAD COLLECTION - IMPORTANT:
When a user wants to book, get a callback, request a quote, or asks to be contacted:
1. Collect their Name first, then Email or Phone - one question at a time, naturally
2. Ask what they are interested in (e.g. cleaning, whitening, implants)
3. Once you have Name + at least Email OR Phone, append this EXACT tag to the END of your message:
LEAD_CAPTURE:{"name":"[name]","email":"[email or null]","phone":"[phone or null]","interest":"[what they want]"}
4. Tell the user: "Perfect! I have passed your details to our team and someone will be in touch very soon."

Lead rules:
- Only output LEAD_CAPTURE once per conversation
- Do NOT output it unless you have name + at least one contact method
- Never make the conversation feel like a form - keep it natural`
        },
        ...messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ]
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

// ── POST /api/lead ────────────────────────────────────────────────
app.post('/api/lead', async (req, res) => {
  const { name, email, phone, interest, practice } = req.body;

  if (!name || (!email && !phone)) {
    return res.status(400).json({ error: 'Need name and at least email or phone' });
  }

  const practiceLabel = practice || 'BrightSmile Dental';
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'short'
  });

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;">
      <div style="background:#2E5247;padding:18px 24px;border-radius:10px 10px 0 0;">
        <h2 style="color:white;margin:0;font-size:17px;">New Lead - ${practiceLabel}</h2>
        <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">${timestamp}</p>
      </div>
      <div style="border:1px solid #e0e0e0;border-top:none;padding:22px;border-radius:0 0 10px 10px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:9px 0;color:#888;width:110px;">Name</td>
            <td style="padding:9px 0;font-weight:600;">${name}</td>
          </tr>
          <tr style="border-top:1px solid #f5f5f5;">
            <td style="padding:9px 0;color:#888;">Email</td>
            <td style="padding:9px 0;">${email ? `<a href="mailto:${email}" style="color:#2E5247;">${email}</a>` : '-'}</td>
          </tr>
          <tr style="border-top:1px solid #f5f5f5;">
            <td style="padding:9px 0;color:#888;">Phone</td>
            <td style="padding:9px 0;">${phone ? `<a href="tel:${phone}" style="color:#2E5247;">${phone}</a>` : '-'}</td>
          </tr>
          <tr style="border-top:1px solid #f5f5f5;">
            <td style="padding:9px 0;color:#888;">Interested in</td>
            <td style="padding:9px 0;">${interest || 'General enquiry'}</td>
          </tr>
        </table>
        <div style="margin-top:18px;padding:12px;background:#f0f7f4;border-radius:8px;font-size:12px;color:#555;">
          This lead came from your AI chatbot on ${practiceLabel}. Reply within the hour for the best conversion rate.
        </div>
      </div>
    </div>`;

  const textBody = `New Lead - ${practiceLabel}
Time: ${timestamp}

Name:          ${name}
Email:         ${email || '-'}
Phone:         ${phone || '-'}
Interested in: ${interest || 'General enquiry'}`;

  try {
    await transporter.sendMail({
      from: `"${practiceLabel} AI" <${process.env.GMAIL_USER}>`,
      to: process.env.LEAD_EMAIL || process.env.GMAIL_USER,
      subject: `New lead from ${name} - ${practiceLabel}`,
      text: textBody,
      html: htmlBody
    });

    console.log(`Lead captured: ${name} | ${email || phone}`);
    res.json({ success: true });

  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send lead email' });
  }
});

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Chat API running on port ${PORT}`);
});
