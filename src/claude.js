import Anthropic from '@anthropic-ai/sdk';
import { readState, updateState } from './state.js';
import { bigBlindFromBlinds, stackToBlinds, pushFoldZone, boardTexture } from './poker.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Static poker rules — cached across calls (doesn't change between hands)
const RULES_PROMPT = `You are Poker Brain — a real-time poker advisor over iMessage. The user is mid-game and needs fast, sharp advice.

RESPONSE RULES (strictly enforced):
- Line 1: Recommendation in ALL CAPS — FOLD / CALL / RAISE to X / SHOVE / CHECK / BET X
- Line 2-3: Brief reason (hand strength, pot odds, board texture, stack pressure)
- Line 4 (optional): One key number — equity %, pot odds %, or BB count
- MAXIMUM 4 lines. Never more.
- No questions. Make a reasonable assumption, state it in 3 words if needed.
- You have full context of this hand from the conversation history — use it.

SHORTHAND REFERENCE:
Cards: As=A♠ Kh=K♥ Qd=Q♦ Jc=J♣ T=Ten, suit optional preflop
Positions: BTN=button SB=small blind BB=big blind EP=early MP=middle CO=cutoff HJ=hijack
Actions: r X=raise-to X | b X=bet X | c=call | x=check | f=fold | shove/all-in=all-in

POKER LOGIC:
Preflop: consider position, hand equity, SPR, stack depth, action history, squeeze spots
Postflop: board texture (wet/dry/paired/connected), relative hand strength, equity vs range, SPR, c-bet sizing
Tournament: ICM near bubble (fold equity shrinks, survival > chips), push/fold ranges at ≤20BB
Cash game: implied odds matter more, speculative hands gain value deep

When facing a bet/raise: always consider pot odds and required equity to call.
SPR < 3: commit with top pair+. SPR 3-8: careful with one-pair hands. SPR > 8: careful, big implied odds scenarios.
Short stack (≤13BB): simplified push/fold. Medium (14-30BB): standard game. Deep (>50BB): full implied odds.`;

function buildGameContext(g, h) {
  const lines = [];

  if (g) {
    const bb = bigBlindFromBlinds(g.blinds);
    const bbs = bb && g.stack ? stackToBlinds(g.stack, bb) : null;
    const zone = bbs ? pushFoldZone(bbs) : null;
    lines.push('=== GAME ===');
    lines.push(`Players: ${g.players || '?'} | Blinds: ${g.blinds || '?'} | Type: ${g.gameType || '?'}`);
    lines.push(`Hero stack: ${g.stack || '?'} chips${bbs ? ` (${bbs} BBs — ${zone})` : ''}`);
  }

  if (h) {
    lines.push('=== CURRENT HAND (extracted state) ===');
    if (h.holeCards) lines.push(`Hole cards: ${h.holeCards}`);
    if (h.position) lines.push(`Position: ${h.position}`);
    if (h.board) {
      const texture = boardTexture(h.board);
      lines.push(`Board: ${h.board}${texture ? ` [${texture}]` : ''}`);
    }
    if (h.pot) lines.push(`Pot: ${h.pot}`);
    if (h.villainBet) lines.push(`Villain bet: ${h.villainBet}`);
  }

  return lines.join('\n');
}

export async function getPokerAdvice(userMessage) {
  const state = readState();
  const g = state.game;
  const h = state.hand || {};

  // System prompt = static rules (cached) + dynamic game context
  const gameCtx = buildGameContext(g, h);
  const systemText = gameCtx
    ? `${RULES_PROMPT}\n\n${gameCtx}`
    : RULES_PROMPT;

  // Full conversation history for this hand + new user message
  const history = h.messages || [];
  const messages = [...history, { role: 'user', content: userMessage }];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: [{ type: 'text', text: systemText, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  const assistantReply = response.content[0].text.trim();

  // Persist the updated conversation history
  const updatedMessages = [
    ...messages,
    { role: 'assistant', content: assistantReply },
  ];
  updateState({ hand: { ...h, messages: updatedMessages } });

  return assistantReply;
}
