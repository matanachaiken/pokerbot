// server.js — Poker Brain entry point
//
// Polling mode (default): calls Sendblue GET /api/v2/messages every
//   POLL_INTERVAL ms and processes new inbound messages from MY_PHONE.
//   No public URL or ngrok required.
//
// Webhook mode: remove the startPolling() call and add back the POST /webhook
//   handler. Requires a public HTTPS URL set in the Sendblue dashboard.

import 'dotenv/config';
import express from 'express';
import { handleMessage } from './src/handler.js';
import { getMessages, sendMessage } from './src/sendblue.js';

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);

// ── Dedup ────────────────────────────────────────────────────────────────────
// Messages can appear in multiple poll windows. Track by uuid and content key.
const DEDUP_TTL_MS = 30_000;
const seen = new Map();

setInterval(() => {
  const cutoff = Date.now() - DEDUP_TTL_MS;
  for (const [k, t] of seen) {
    if (t < cutoff) seen.delete(k);
  }
}, DEDUP_TTL_MS);

function isSeen(key) {
  const t = seen.get(key);
  return t !== undefined && Date.now() - t < DEDUP_TTL_MS;
}

function markSeen(...keys) {
  const now = Date.now();
  for (const k of keys) seen.set(k, now);
}

// ── Polling loop ─────────────────────────────────────────────────────────────
function startPolling() {
  const myPhone = process.env.MY_PHONE;
  if (!myPhone) {
    console.error('[poll] MY_PHONE not set in .env');
    return;
  }

  // Only handle messages that arrive after the bot starts
  let lastSeenAt = new Date().toISOString();
  console.log(`[poll] started — checking every ${POLL_INTERVAL / 1000}s`);
  console.log(`[poll] ignoring messages before ${lastSeenAt}`);

  setInterval(async () => {
    let messages;
    try {
      messages = await getMessages(20);
    } catch (err) {
      console.error('[poll] error fetching messages:', err.message);
      return;
    }

    // Inbound only, newer than bot start, oldest first
    const fresh = messages
      .filter(m =>
        m.isOutbound === false &&
        m.number === myPhone &&
        m.createdAt > lastSeenAt &&
        !!m.content
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const msg of fresh) {
      const contentKey = `${msg.number}|${msg.content}`;

      // Mark seen synchronously before any await to prevent double-processing
      if (isSeen(msg.uuid) || isSeen(contentKey)) {
        console.log(`[poll] duplicate dropped: ${msg.uuid}`);
        continue;
      }
      markSeen(msg.uuid, contentKey);

      console.log(`← ${msg.number}: ${msg.content}`);

      try {
        const reply = await handleMessage(msg.content);
        if (reply) {
          await sendMessage(msg.number, reply);
          console.log(`→ ${msg.number}: ${reply}`);
        }
      } catch (err) {
        console.error('[poll] handler error:', err.message);
        try {
          await sendMessage(msg.number, 'Error — try again.');
        } catch {}
      }

      lastSeenAt = msg.createdAt;
    }
  }, POLL_INTERVAL);
}

// ── Express (health check only) ───────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', mode: 'polling', interval: POLL_INTERVAL })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Poker Brain running — polling mode (no ngrok needed)`);
  console.log(`Health: http://localhost:${PORT}/health`);
  startPolling();
});
