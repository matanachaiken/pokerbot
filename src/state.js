import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'game.json');

const DEFAULT_STATE = {
  game: null,
  hand: null,
  setupStep: null,
};

export function readState() {
  if (!existsSync(STATE_FILE)) return { ...DEFAULT_STATE };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function updateState(updates) {
  const state = readState();
  const next = { ...state, ...updates };
  writeState(next);
  return next;
}

export function clearHand() {
  return updateState({ hand: null });
}

export function clearAll() {
  writeState({ ...DEFAULT_STATE });
}
