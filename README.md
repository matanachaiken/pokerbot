# Poker Brain

Real-time poker advisor via iMessage. Text your hand, get instant advice.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your keys
```

| Variable | Value |
|---|---|
| `SENDBLUE_API_KEY` | From Sendblue dashboard → API Keys |
| `SENDBLUE_API_SECRET` | From Sendblue dashboard → API Keys |
| `SENDBLUE_NUMBER` | Your Sendblue iMessage number (e.g. +12025551234) |
| `MY_PHONE` | Your personal iPhone number (e.g. +12025559999) |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |

### 3. Expose your server (local dev)
```bash
# Install ngrok if needed: brew install ngrok
ngrok http 3000
```

Copy the ngrok URL (e.g. `https://abc123.ngrok.io`).

### 4. Configure Sendblue webhook
In the Sendblue dashboard, set your webhook URL to:
```
https://abc123.ngrok.io/webhook
```

### 5. Start the bot
```bash
npm start        # production
npm run dev      # auto-restart on changes
```

---

## Shorthand Guide

### Cards
| Input | Meaning |
|---|---|
| `As` | Ace of spades |
| `Kh` | King of hearts |
| `Qd` | Queen of diamonds |
| `Jc` | Jack of clubs |
| `Tc` | Ten of clubs |
| `9s` | Nine of spades |
| `AK` | Ace-King (no suit needed preflop) |

Ranks: `A K Q J T 9 8 7 6 5 4 3 2`  
Suits: `s h d c`

### Positions
| Input | Meaning |
|---|---|
| `BTN` or `button` | Button |
| `SB` | Small blind |
| `BB` | Big blind |
| `EP` or `UTG` | Early position / under the gun |
| `MP` | Middle position |
| `HJ` | Hijack |
| `CO` or `cutoff` | Cutoff |

### Actions (opponent actions)
| Input | Meaning |
|---|---|
| `raised to 150` or `r 150` | Raised to 150 |
| `bet 200` or `b 200` | Bet 200 |
| `called` or `c` | Called |
| `checked` or `x` | Checked |
| `folded` or `f` | Folded |
| `shoved` or `all in` | All-in |

---

## Usage Examples

### Start a session
```
Text: setup
Bot:  New game! How many players?
Text: 6
Bot:  Blind levels?
Text: 25/50
Bot:  Starting stack?
Text: 1000
Bot:  Game type? 1. Tournament  2. Cash
Text: tournament
Bot:  Set! 6p | 25/50 blinds | 1000 chips (20 BBs) | tournament
```

### Preflop advice
```
Text: As Kh BTN, raised to 150 from EP
Bot:  RAISE to 450
      AKs is a 3-bet for value from BTN vs EP open.
      You're ahead of their range, build the pot.
```

```
Text: 72o BB, everyone calls, BTN raises to 200
Bot:  FOLD
      72o is bottom of range, no equity even with pot odds.
```

### Postflop advice
```
Text: board Ah 7c 2d, villain bets 200, pot 400
Bot:  CALL (or RAISE if you have Ax/77/22)
      Dry board, villain c-betting wide. With top pair+ raise. 
      With bluff catcher, call — pot odds ~33%, need ~25% equity.
```

```
Text: he checks, pot 300
Bot:  BET 200
      Dry board, bet 2/3 pot to charge draws and protect equity.
```

### Quick calculations
```
Text: pot odds 400 to call 150
Bot:  Pot odds: 400:150 → need 27.3% equity to break even
```

```
Text: equity
Bot:  CALL — ~65% equity
      AK on A-7-2 rainbow is strong vs typical villain range.
      SPR ~3, lean toward getting it in.
```

### Session commands
| Text | Action |
|---|---|
| `setup` or `new game` | Configure new game (players, blinds, stack, type) |
| `new hand` | Clear hand state, keep game config |
| `reset` | Clear everything |
| `stack` | Show current stack and BB count |
| `pot odds X to call Y` | Calculate pot odds |
| `equity` | Estimate your equity vs typical range |
| `help` | Show shorthand guide |

---

## Architecture

```
server.js          Express server + Sendblue webhook
src/
  handler.js       Message routing + setup wizard
  claude.js        Anthropic API with prompt caching
  state.js         game.json read/write
  sendblue.js      Send iMessages via Sendblue API
  parser.js        Shorthand parsing (cards, positions, actions)
  poker.js         Pot odds, SPR, board texture math
game.json          Persistent game + hand state
```

The bot remembers state between texts. Once you've set up the game and sent hole cards, follow-up messages like "he bets 200" use the stored pot size and position automatically.

## Deploying to production

Point Sendblue webhook to your server URL. Any host works (Railway, Fly.io, Render, VPS).

```bash
# Railway
railway up

# Or just run behind nginx on a VPS
npm start
```
