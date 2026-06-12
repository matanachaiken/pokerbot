import axios from 'axios';

const BASE_URL = 'https://api.sendblue.co/api';

export async function sendMessage(to, content) {
  await axios.post(
    `${BASE_URL}/send-message`,
    { number: to, content, send_style: 'invisible' },
    {
      headers: {
        'SB-API-KEY-ID': process.env.SENDBLUE_API_KEY,
        'SB-API-SECRET-KEY': process.env.SENDBLUE_API_SECRET,
        'Content-Type': 'application/json',
      },
    }
  );
}
