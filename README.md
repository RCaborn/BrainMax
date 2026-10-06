# BrainMax

A personal daily training app with three tasks a day and a progress dashboard:

1. **Mental maths:** 10 timed, adaptive questions at investment-banking numerical-test level.
2. **Spanish:** 20 typed answers a day from the 2000 most common words, scheduled with spaced repetition.
3. **Daily puzzle:** a different puzzle for each day of the week.

It runs locally in your browser, works offline, and can be installed as a desktop app.

## Run it

You need Node.js 20 or newer.

```bash
npm install
npm run build
npm run preview      # → http://localhost:5199
```

To install it as an app, open `http://localhost:5199` in Chrome or Edge and click the install icon in the address bar.
It then opens in its own window and works offline.

`npm run dev` runs the dev server (same port) with hot reload and shows the developer time-travel controls in Settings.

**Your data:** progress is stored in the browser's IndexedDB for `localhost:5199`. A different port or browser starts
empty, so the port is fixed. Use **Settings → Download backup** now and then; restore from the same page.

## How it works

### Mental maths
- **Ten skills:**
  - hard products
  - decimal arithmetic
  - percent-of
  - % change and back-solving
  - fraction ↔ decimal ↔ %
  - division to decimals
  - big numbers with k/m/bn
  - financial multiples (EV/EBITDA, P/E, EPS, equity value)
  - growth and compounding (rule of 72, CAGR, PV)
  - ±2% estimation
- **Adaptive levels:** each skill has a level from 1 to 10, moved by a 3-up/1-down staircase that settles near 80% accuracy:
  - 3 correct answers within the target time move it up
  - a wrong answer moves it down
  - a slow correct answer just resets the streak
- **The daily 10:** 4 from your weakest skills, 4 mixed, and 2 "stretch" questions one level up, interleaved.
- **Feedback:** every miss shows a worked mental shortcut.
- **Other modes:** **Exam** (10 minutes, skip allowed, −0.25 marking) and **Speed drill** (80 in 8 minutes).
- **Answers:** you can type `1.44bn`, `300k`, `15%` or `−20`.

### Spanish
- **Scheduler:** [FSRS](https://github.com/open-spaced-repetition/ts-fsrs), targeting 90% recall.
  - Each card is graded once per day: wrong → Again, accent slip or typo → Hard, right → Good, fast review → Easy.
  - Missed words get short intervals and come back often; known words are pushed out to just before you'd forget them.
- **Picking the daily 20:**
  1. Due cards, most-forgotten first.
  2. Then 2 spot-checks of placement-known words.
  3. Then new material: new Spanish → English words in frequency order, alternating with English → Spanish cards for words you already know.
- **In-session retries:** a missed word is re-drilled 3–5 cards later until you type it right.
- **Production cards:** an English → Spanish card unlocks once its Spanish → English card's stability reaches 7 days.
- **Placement test:** about 100 words, 10 per frequency band of 200. Bands where you score 90%+ are marked known and spot-checked over time.
- **Overrides:** "I was right" accepts your wording permanently. If you type a valid synonym (e.g. *pelo* for *cabello*), you're asked again without penalty.
- **The word list** (`data/words-*.txt` → `src/features/spanish/words.json`, built by `node scripts/build-words.mjs`):
  - Base words (lemmas), ordered using the OpenSubtitles frequency list from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords).
  - Topped up with core vocabulary that subtitle frequencies underrate (months, colours, everyday nouns).
  - The ordering is approximate.
  - The translations were written by an AI assistant, so expect occasional gaps or odd choices. The override button exists for that.

### Puzzles (seeded by date, so each day is fixed)

| Day | Puzzle |
|---|---|
| Mon | Countdown numbers (exact solution guaranteed and shown afterwards) |
| Tue | KenKen 4×4/5×5 (unique solution verified) |
| Wed | Palabra: a Spanish Wordle drawn from words you've learned |
| Thu | Code-breaker (Mastermind, 4 pegs, 6 colours) |
| Fri | Calibration: 90%-confidence ranges, scored on calibration over time |
| Sat | Hard Countdown |
| Sun | KenKen 6×6 |

Any puzzle can also be played as unranked practice.

### Dashboard
- Streaks and a 365-day activity heatmap
- An estimate of how many words you'd recognise today
- Spanish words by memory strength over time, first-try accuracy, and a 7-day review forecast
- Most-missed words and "leeches" (words missed 6+ times)
- Maths levels per skill, plus accuracy and speed trends
- Puzzle solve rates and your calibration hit rate

## A note on "brain training"
Practising these tasks makes you better at these tasks: arithmetic fluency and Spanish vocabulary are real, useful
skills. Large reviews of brain-training research (e.g. Simons et al., 2016) find little evidence of transfer to general
intelligence, so this app is skill practice, not an IQ booster.

## Development

```bash
npm test          # Vitest: grading, scheduler, staircase, generators, puzzle solvers
npm run typecheck
```

- **Tests** cover:
  - answer parsing and tolerances
  - every maths generator's answer against an independent evaluation
  - the staircase converging near 80%
  - a 30-day simulated Spanish learner (missed words recur far more often)
  - 365 days of solvable Countdowns
  - unique-solution KenKens
- **Stack:** Vite, React, TypeScript, Dexie (IndexedDB), ts-fsrs, Recharts, vite-plugin-pwa.
