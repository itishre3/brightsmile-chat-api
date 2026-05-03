const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

// Health check endpoint (required by DigitalOcean)
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'BrightSmile Chat API' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: `You are a helpful dental practice assistant for BrightSmile Dental. 

Key information:
- Location: 123 Main St, Los Angeles, CA 90210
- Phone: (310) 555-0190
- Hours: Mon-Fri 8am-6pm, Sat 9am-2pm
- Accepted insurance: Delta Dental, MetLife, Cigna, Aetna
- Services: General dentistry, cosmetic procedures, orthodontics, implants
- Typical prices: Cleaning $120, Exam $80, Whitening $450, Crown $1200

Be friendly, concise, and helpful. Encourage booking appointments. If unsure, suggest calling the office.`,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: true
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const event of response) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Chat API running on port ${PORT}`);
});