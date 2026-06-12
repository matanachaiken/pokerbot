export function potOdds(pot, call) {
  const total = pot + call;
  const pct = (call / total) * 100;
  return {
    ratio: `${pot}:${call}`,
    pct: pct.toFixed(1),
    breakEvenPct: pct.toFixed(1),
  };
}

export function stackToBlinds(stack, bigBlind) {
  return Math.round(stack / bigBlind);
}

export function bigBlindFromBlinds(blindsStr) {
  // "25/50" → 50
  if (!blindsStr) return null;
  const parts = blindsStr.split('/');
  return parts.length === 2 ? parseInt(parts[1]) : null;
}

// Push/fold threshold: generally shove ≤13 BB, consider 14-20 BB with premium hands
export function pushFoldZone(bbs) {
  if (bbs <= 10) return 'shove_zone';    // Shove any reasonable hand
  if (bbs <= 13) return 'push_fold';     // Standard push/fold
  if (bbs <= 20) return 'shallow';       // Shallow — limit speculative play
  if (bbs <= 40) return 'medium';        // Standard postflop game
  return 'deep';                          // Deep stack, full game
}

export function spr(effectiveStack, pot) {
  return +(effectiveStack / pot).toFixed(1);
}

// Rough board texture descriptor
export function boardTexture(boardStr) {
  if (!boardStr) return null;
  const cards = boardStr.trim().split(/\s+/);
  if (cards.length < 3) return null;

  const ranks = cards.map(c => c[0]);
  const suits = cards.map(c => c[1]).filter(Boolean);

  const uniqueSuits = new Set(suits);
  const flush_draw = uniqueSuits.size <= 2 && suits.length >= 3;

  const rankValues = {
    A: 14, K: 13, Q: 12, J: 11, T: 10,
    '9': 9, '8': 8, '7': 7, '6': 6, '5': 5,
    '4': 4, '3': 3, '2': 2,
  };
  const vals = ranks.map(r => rankValues[r] || 0).sort((a, b) => a - b);
  const gaps = vals.slice(1).map((v, i) => v - vals[i]);
  const connected = gaps.some(g => g <= 2);

  const paired = new Set(ranks).size < ranks.length;

  const parts = [];
  if (paired) parts.push('paired');
  if (flush_draw) parts.push('monotone/flush-draw');
  if (connected) parts.push('connected');
  if (!paired && !flush_draw && !connected) parts.push('dry/rainbow');

  return parts.join(', ');
}
