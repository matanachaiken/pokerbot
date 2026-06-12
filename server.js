import 'dotenv/config';
import express from 'express';
import { handleMessage } from './src/handler.js';
import { sendMessage } from './src/sendblue.js';

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  // Acknowledge immediately — Sendblue expects a fast 200
  res.sendStatus(200);

  const { from_number, content, is_outbound } = req.body;

  // Ignore outgoing messages to prevent loops
  if (is_outbound) return;

  // Normalize phone numbers for comparison (strip spaces/dashes)
  const normalize = n => (n || '').replace(/[\s\-()]/g, '');
  if (normalize(from_number) !== normalize(process.env.MY_PHONE)) {
    console.log(`Ignoring message from unknown number: ${from_number}`);
    return;
  }

  console.log(`← ${from_number}: ${content}`);

  try {
    const reply = await handleMessage(content);
    if (reply) {
      await sendMessage(from_number, reply);
      console.log(`→ ${from_number}: ${reply}`);
    }
  } catch (err) {
    console.error('Error handling message:', err);
    try {
      await sendMessage(from_number, 'Error — try again.');
    } catch {}
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Poker Brain running on port ${PORT}`);
  console.log(`Webhook: POST http://localhost:${PORT}/webhook`);
});
