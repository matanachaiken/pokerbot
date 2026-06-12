import {
  detectIntent,
  parsePosition,
  extractHoleCards,
  extractBoardCards,
  extractPotSize,
  extractAmount,
  parsePotOdds,
} from './parser.js';
import { readState, updateState, clearHand, clearAll } from './state.js';
import { getPokerAdvice } from './claude.js';
import { potOdds, bigBlindFromBlinds, stackToBlinds } from './poker.js';

const HELP_TEXT = `POKER BRAIN — QUICK GUIDE

CARDS
As Kh Qd Jc Tc 9s 8h ... 2c
Suits optional preflop: "AK" is fine

POSITIONS
BTN  SB  BB  EP  MP  HJ  CO

ACTIONS
r X  = raise to X
b X  = bet X
c    = call
x    = check
f    = fold
all in / shove

PREFLOP
"As Kh BTN, raised to 150 from EP"
"KQs CO, two callers"

POSTFLOP
"board Ah 7c 2d, villain bets 200, pot 400"
"he checks, pot 300"

COMMANDS
setup / new game — configure game
new hand         — clear hand state
reset            — clear everything
stack            — show stack + blinds
stack 1500       — update chip count
pot odds X to call Y
equity           — estimate your equity
help             — this guide`;

export async function handleMessage(content) {
  const msg = (content || '').trim();
  if (!msg) return null;

  const state = readState();

  // Setup wizard takes priority over everything
  if (state.setupStep) {
    return handleSetupStep(msg, state);
  }

  const intent = detectIntent(msg);

  switch (intent) {
    case 'setup': {
      updateState({ setupStep: 'players', hand: null });
      return 'New game!\n\nHow many players? (e.g. 6)';
    }

    case 'reset': {
      clearAll();
      return 'Reset. Text "setup" to start a new game.';
    }

    case 'new_hand': {
      clearHand();
      return 'Hand cleared. Ready for next hand.';
    }

    case 'help':
      return HELP_TEXT;

    case 'stack': {
      const g = state.game;
      if (!g) return 'No game set up. Text "setup" first.';
      const bb = bigBlindFromBlinds(g.blinds);
      const bbs = bb && g.stack ? stackToBlinds(g.stack, bb) : '?';
      return `Stack: ${g.stack} chips\nBlinds: ${g.blinds}\n${bbs} BBs | ${g.gameType}`;
    }

    case 'stack_update': {
      const g = state.game;
      if (!g) return 'No game set up. Text "setup" first.';
      const m = msg.match(/(\d+)/);
      if (!m) return 'Format: stack 1500 or update stack 1500';
      const newStack = parseInt(m[1]);
      updateState({ game: { ...g, stack: newStack } });
      const bb = bigBlindFromBlinds(g.blinds);
      const bbs = bb ? stackToBlinds(newStack, bb) : '?';
      return `Stack updated: ${newStack} chips (${bbs} BBs)`;
    }

    case 'pot_odds': {
      const parsed = parsePotOdds(msg);
      if (!parsed) {
        return 'Format: pot odds [pot] to call [amount]\nEx: pot odds 400 to call 150';
      }
      const { pot, call } = parsed;
      const o = potOdds(pot, call);
      return `Pot odds: ${o.ratio} → need ${o.breakEvenPct}% equity to break even`;
    }

    case 'equity':
    case 'advice':
    default: {
      // Update hand state with anything extractable from this message
      syncHandState(msg, state);
      return await getPokerAdvice(msg);
    }
  }
}

function handleSetupStep(msg, state) {
  const step = state.setupStep;
  const game = state.game || {};

  switch (step) {
    case 'players': {
      const n = parseInt(msg);
      if (!n || n < 2 || n > 10) return 'Players? Enter a number 2–10:';
      updateState({ game: { ...game, players: n }, setupStep: 'blinds' });
      return 'Blind levels? (e.g. 25/50)';
    }

    case 'blinds': {
      const m = msg.match(/(\d+)\s*\/\s*(\d+)/);
      if (!m) return 'Format: small/big (e.g. 25/50):';
      updateState({ game: { ...game, blinds: msg.trim() }, setupStep: 'stack' });
      return 'Starting stack? (e.g. 1000)';
    }

    case 'stack': {
      const n = parseInt(msg.replace(/,/g, ''));
      if (!n || n < 1) return 'Enter a chip count (e.g. 1000):';
      updateState({ game: { ...game, stack: n }, setupStep: 'gametype' });
      return 'Game type?\n1. Tournament\n2. Cash';
    }

    case 'gametype': {
      const lower = msg.toLowerCase();
      let gameType;
      if (/tournament|tourney|1/.test(lower)) gameType = 'tournament';
      else if (/cash|ring|2/.test(lower)) gameType = 'cash';
      else return 'Reply "tournament" or "cash":';

      const g = { ...game, gameType };
      updateState({ game: g, setupStep: null });

      const bb = bigBlindFromBlinds(g.blinds);
      const bbs = bb ? stackToBlinds(g.stack, bb) : '?';
      return `Set!\n${g.players}p | ${g.blinds} blinds | ${g.stack} chips (${bbs} BBs) | ${g.gameType}\n\nSend your hole cards + position to start.`;
    }

    default:
      updateState({ setupStep: null });
      return 'Setup cancelled. Text "setup" to try again.';
  }
}

// Extract and persist whatever hand info is in this message
function syncHandState(msg, state) {
  const hand = state.hand || {};
  const updates = { ...hand };

  const pos = parsePosition(msg);
  if (pos) updates.position = pos;

  const board = extractBoardCards(msg);
  if (board) updates.board = board;

  const pot = extractPotSize(msg);
  if (pot) updates.pot = pot;

  // Only grab hole cards when the message isn't describing the board
  if (!/\bboard\b/i.test(msg)) {
    const hole = extractHoleCards(msg);
    if (hole) updates.holeCards = hole;
  }

  // Villain bet/raise amount
  if (/\b(bets?|raises?\s+to|shoves?|all.?in)\b/i.test(msg)) {
    const amount = extractAmount(msg);
    if (amount) updates.villainBet = amount;
  }

  // Accumulate action descriptions
  const actionMatch = msg.match(
    /\b(?:villain|he|she|they|player)\s+([^,\.]+)/gi
  );
  if (actionMatch) {
    updates.actions = [
      ...(hand.actions || []),
      ...actionMatch.map(a => a.trim()),
    ];
  }

  updateState({ hand: updates });
}
