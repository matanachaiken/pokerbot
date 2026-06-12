import 'dotenv/config';
import axios from 'axios';

const SEND_URL = 'https://api.sendblue.com/api/send-message';
const MESSAGES_URL = 'https://api.sendblue.com/accounts/messages';

function authHeaders() {
  return {
    'sb-api-key-id': process.env.SENDBLUE_API_KEY,
    'sb-api-secret-key': process.env.SENDBLUE_API_SECRET,
  };
}

export async function sendMessage(to, content) {
  await axios.post(
    SEND_URL,
    { number: to, from_number: process.env.SENDBLUE_NUMBER, content },
    { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
  );
}

export async function getMessages(limit = 20) {
  try {
    const res = await axios.get(MESSAGES_URL, {
      params: { limit },
      headers: authHeaders(),
      timeout: 10_000,
    });
    return res.data.messages ?? [];
  } catch (err) {
    console.error('[poll] getMessages error:', err.response?.status, err.response?.data || err.message);
    return [];
  }
}
