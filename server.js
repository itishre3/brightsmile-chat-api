const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'BrightSmile Chat API' });
});

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
- Location: 123 Main St, Los Angeles, CA 90210
- Phone: (310) 555-0190
- Hours: Mon-Fri 8am-6pm, Sat 9am-2pm
- Accepted insurance: Delta Dental, MetLife, Cigna, Aetna
- Services: General dentistry, cosmetic procedures, orthodontics, implants
- Typical prices: Cleaning $120, Exam $80, Whitening $450, Crown $1200

Be friendly, concise, and helpful. Encourage booking appointments. If unsure, suggest calling the office.`
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Chat API running on port ${PORT}`);
});
