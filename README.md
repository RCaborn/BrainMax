# BrainMax

A personal daily training app with four tasks a day and a progress dashboard:

1. **Mental maths:** 10 timed, adaptive questions that build up to investment-banking numerical-test level.
2. **Spanish:** 20 typed answers a day from the 2000 most common words, scheduled with spaced repetition.
3. **Geography:** 15 cards a day (maps, capitals, flags, rivers, mountains), about 35% of them about the UK.
4. **Daily puzzle:** a different puzzle for each day of the week.

## Use it

**Open https://rcaborn.github.io/BrainMax/**. That's it: no install, no terminal.

- **Desktop app:** in Chrome or Edge, click the install icon at the right of the address bar.
- **Phone:** on iPhone, Share → Add to Home Screen; on Android, ⋮ → Install app.
- **Offline:** after the first visit it works without a connection.
- **Updates:** every push to `main` redeploys automatically (`.github/workflows/deploy.yml`).

## Run it locally instead

You need Node.js 20 or newer.

```bash
npm install
npm run build
npm run preview      # → http://localhost:5199
```

`npm run dev` runs the dev server (same port) with hot reload and shows the developer time-travel controls in Settings.

**Your data:** progress is stored in your browser's IndexedDB for whichever address you use. The hosted link,
`localhost:5199`, a different browser, and your phone each keep separate progress. Use **Settings → Download backup**
now and then; restore from the same page (this is also how you move progress between devices).

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
- **Skill ladders:** each skill is a ladder of 12–18 rungs, each with its own question type, target time and tolerance:
  - **On-ramp** (rungs 1–3): warm-ups such as 25 × 80 or "18/24 as a %"
  - **Core**: the bulk of the skill
  - **IB-ready** (last 4 rungs): numerical-test level, e.g. 5-digit ÷ 3-digit within 0.5%, or a 4-year CAGR
- **Fast start:** you begin at rung 1 and climb one rung per quick correct answer until your first miss. After that, a
  3-up/1-down staircase settles near 80% accuracy:
  - 3 correct answers within the target time move you up
  - a correct answer within 2× the target keeps your streak; slower than that resets it
  - a wrong answer moves you down
- **Skill path:** you start with products, percent-of and fractions. Each other skill unlocks when its building blocks
  reach rung 4, and comes with a 1-minute technique lesson (readable any time from the Maths page).
- **The daily 10:** from unlocked skills only. Every skill appears at least once, a newly unlocked skill gets 3 slots,
  2 "stretch" questions are one rung up, and the rest go to your weakest skills.
- **Feedback:** every miss shows a worked mental shortcut for that rung's method.
- **Other modes:** **Exam** (10 minutes, skip allowed, −0.25 marking) and **Speed drill** (80 in 8 minutes).
- **Answers:** you can type `1.44bn`, `300k`, `15%`, `x1.08` or `−20`. For money answers the unit is optional: `120`
  counts as 120m when the answer is 120m. `11/16` works on "?/16" questions.

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

### Geography
- **Cards (about 2,300):**
  - **World:** all 193 UN members plus Vatican City and Palestine. For each one: find it on the map, name it from the
    map, its capital (both ways) and its flag. Plus about 180 physical features (oceans, seas, rivers, ranges,
    peaks, deserts, lakes, straits) with click-the-location cards and short fact cards.
  - **UK:** 107 counties and council areas (47 English ceremonial counties, 32 Scottish council areas, 22 Welsh principal
    areas, and the 6 Northern Irish counties as points), plus about 250 rivers, national parks, peaks, islands, coasts,
    cities and lakes.
- **Scheduling:** the same FSRS scheduler as Spanish. Due cards come first (most-forgotten first) and new cards fill
  the rest of the 15. New cards arrive best-known first, interleaved about 35% UK to 65% world.
- **Grading:**
  - A map click inside the right shape (or near a river or point) is correct.
  - A neighbouring country or a near miss counts as Hard, with the answer highlighted.
  - Typed answers allow typos and alternative names, and "I was right" adds your wording permanently.
  - Capitals accept every defensible answer (e.g. Bolivia: Sucre or La Paz).
- **Where the data comes from** (built by `node scripts/build-geo.mjs`):
  - Countries, capitals and alternative names: [mledoze/countries](https://github.com/mledoze/countries) (ODbL).
  - World map: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 1:50m).
  - UK areas: Natural Earth 1:10m admin-1, grouped into ceremonial counties. The boundaries are simplified, Northern
    Ireland's counties are approximate points, and Stockton-on-Tees is filed under Durham.
  - Flags: [flag-icons](https://github.com/lipis/flag-icons) (MIT).
  - The UK and world physical features and their facts (`src/features/geo/data/curated.json`) were drafted by an AI
    assistant and checked by two independent AI fact-checkers told to refute each item. Disputed items were dropped
    and disputed facts or names removed. That removes most errors, not all of them.

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
- Maths: progress up each skill ladder, plus accuracy and speed trends
- Geography: % of countries you could find on a map, capitals and flags known, UK coverage, maps shaded by how well
  you know each country and county, and most-missed cards
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
  - every rung of every maths ladder: self-consistent answers, hints that land inside the tolerance, an independent
    evaluation of pure arithmetic, and no big difficulty dips
  - fast start, the staircase converging near 80%, skill unlocks and the daily 10
  - geography data (unique ids, every feature on its map, 30–40% UK), map and name grading, and the review queue
  - a 30-day simulated Spanish learner (missed words recur far more often)
  - 365 days of solvable Countdowns
  - unique-solution KenKens
- **Stack:** Vite, React, TypeScript, Dexie (IndexedDB), ts-fsrs, Recharts, d3-geo + topojson, vite-plugin-pwa.
- **Rebuilding geography data:** `node scripts/build-geo.mjs` (downloads Natural Earth into `data/raw/` if missing).
