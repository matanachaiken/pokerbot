const POSITION_MAP = {
  btn: 'BTN', button: 'BTN',
  sb: 'SB', 'small blind': 'SB',
  bb: 'BB', 'big blind': 'BB',
  utg: 'EP', ep: 'EP', 'early position': 'EP',
  mp: 'MP', 'middle position': 'MP',
  hj: 'HJ', hijack: 'HJ',
  co: 'CO', cutoff: 'CO', 'cut off': 'CO',
};

export function parsePosition(str) {
  const lower = str.toLowerCase();
  // Try longer phrases first to avoid partial matches
  const keys = Object.keys(POSITION_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (lower.includes(key)) return POSITION_MAP[key];
  }
  return null;
}

// Matches card patterns like As, Kh, Qd, Jc, Tc, 9s, 2h, A, K (no suit)
const CARD_RE = /\b([AaKkQqJjTt]|[2-9])([shdc])?\b/g;

export function extractCards(str) {
  const cards = [];
  let m;
  // Reset lastIndex since we reuse the regex
  CARD_RE.lastIndex = 0;
  while ((m = CARD_RE.exec(str)) !== null) {
    cards.push(m[0].toUpperCase());
  }
  return cards;
}

export function parsePotOdds(msg) {
  // "pot odds 300 to call 100" or "pot odds 300:100"
  const m =
    msg.match(/pot\s+odds\s+(\d+)\s+to\s+call\s+(\d+)/i) ||
    msg.match(/pot\s+odds\s+(\d+)\s*:\s*(\d+)/i);
  if (!m) return null;
  return { pot: parseInt(m[1]), call: parseInt(m[2]) };
}

export function extractPotSize(msg) {
  const m = msg.match(/\bpot\s+(\d+)\b/i);
  return m ? parseInt(m[1]) : null;
}

export function extractAmount(msg) {
  // Grab the last standalone number — covers "bets 200", "raises to 300"
  const matches = msg.match(/\b(\d+)\b/g);
  return matches ? parseInt(matches[matches.length - 1]) : null;
}

export function extractBoardCards(msg) {
  const m = msg.match(/\bboard\s+((?:[AaKkQqJjTt2-9][shdc]?\s*){3,5})/i);
  if (!m) return null;
  return m[1].trim().toUpperCase();
}

export function extractHoleCards(msg) {
  // Hole cards are at the start of the message, before position keywords or "board"
  const stripped = msg
    .replace(/\bboard\b.*/i, '')
    .replace(/\b(btn|button|sb|bb|ep|mp|co|hj|utg)\b.*/i, '')
    .trim();

  const cards = extractCards(stripped);
  if (cards.length === 2) return cards.join(' ');
  return null;
}

export function detectIntent(msg) {
  const lower = msg.toLowerCase().trim();

  if (/^(setup|new\s+game)$/i.test(lower)) return 'setup';
  if (/^reset$/i.test(lower)) return 'reset';
  if (/^new\s+hand$/i.test(lower)) return 'new_hand';
  if (/^help$/i.test(lower)) return 'help';
  if (/^stack$/i.test(lower)) return 'stack';
  if (/^pot\s+odds/i.test(lower)) return 'pot_odds';
  if (/^equity$/i.test(lower)) return 'equity';

  return 'advice'; // Send to Claude
}
