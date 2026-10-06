import type { CategoryId } from './generators'

export interface Lesson {
  idea: string
  moves: string[]
  example: string
}

/** One short technique lesson per skill, shown when it unlocks and from the skill list. */
export const LESSONS: Record<CategoryId, Lesson> = {
  products: {
    idea: 'Work left to right in chunks and keep a running total. Never carry digits right to left in your head.',
    moves: [
      'Split: 87 × 7 = 80×7 + 7×7 = 560 + 49 = 609.',
      'Compensate near round numbers: 67 × 39 = 67 × 40 − 67 = 2,680 − 67 = 2,613.',
      'Halve and double when a factor ends in 5: 35 × 18 = 70 × 9 = 630.',
      'Squares: step to the nearest ten and back, then add the gap squared: 37² = 34 × 40 + 3² = 1,369.',
      'Near 100: 96 × 89 → 96 − 11 = 85 → 8,500, plus 4 × 11 = 44 → 8,544.',
    ],
    example: 'Estimate first (67 × 39 ≈ 70 × 40 = 2,800) so a slipped digit stands out.',
  },
  decimals: {
    idea: 'Treat decimals as whole numbers with a scale tag.',
    moves: [
      'Multiply: drop the points, multiply, then give the answer as many decimal places as the factors had: 3.7 × 4.5 → 37 × 45 = 1,665 → 16.65.',
      'Divide: scale both numbers until the divisor is whole: 22.8 ÷ 0.08 = 2,280 ÷ 8 = 285.',
      'Friendly decimals are fractions: 0.25 = 1/4, 0.75 = 3/4, 0.125 = 1/8, 1.25 = 5/4, 2.75 = 11/4.',
    ],
    example: '0.75 × 132 = three quarters of 132 = 33 × 3 = 99. Sanity check 3.7 × 4.5: it must lie between 3 × 4 = 12 and 4 × 5 = 20.',
  },
  percentOf: {
    idea: 'Rarely multiply by the rate directly. Build it from anchor pieces.',
    moves: [
      '10% = move the point one place; 1% = two places; 50% = halve; 25% = halve twice; 5% = half of 10%.',
      'Combine pieces: 35% = 3 × 10% + 5%.',
      'Use fractions when cleaner: 12.5% = 1/8, 37.5% = 3/8, 75% = 3/4.',
      'Round and adjust: 29% = 30% − 1%.',
      'Swap when it helps: 8% of 50 = 50% of 8 = 4.',
    ],
    example: '35% of 640: 10% = 64, so 30% = 192; 5% = 32; total 224. And 29% of 640 = 192 − 6.4 = 185.6.',
  },
  pctChange: {
    idea: '% change = (new − old) ÷ old. Always divide by the starting value, and think in multipliers.',
    moves: [
      'Up 20% is ×1.2; down 25% is ×0.75.',
      'To recover an original, divide by the multiplier, never reverse the percentage: after a 25% fall to 585, original = 585 ÷ 0.75 = 780 (585 + 25% = 731.25 is wrong).',
      'Successive changes multiply: +25% then −20% is 1.25 × 0.8 = 1.00, so 0% net, not +5%.',
      'A margin going from 10% to 12% is +2 percentage points but +20% in relative terms.',
    ],
    example: '240 → 276: change 36; 36 ÷ 240 = 0.15, so +15%.',
  },
  fractions: {
    idea: 'Work from a small set of anchors.',
    moves: [
      'Exact: 1/4 = 25%, 1/5 = 20%, 1/8 = 12.5%, 1/20 = 5%, 1/25 = 4%, 1/16 = 6.25%.',
      'Recurring: 1/3 = 33.33%, 1/6 = 16.67%, 1/7 = 14.29%, 1/9 = 11.11%, 1/11 = 9.09%, 1/12 = 8.33%.',
      'Simplify first: 18/24 = 3/4 = 75%.',
      'Multiply the unit fraction and keep an extra digit: 7/11 = 7 × 9.09 = 63.63 → 63.6% (7 × 9.1 = 63.7 is wrong).',
      'Use the complement when the top is close to the bottom: 7/8 = 1 − 0.125 = 0.875.',
    ],
    example: '9/14 = 4.5/7 = 4.5 × 14.29% ≈ 64.3%.',
  },
  division: {
    idea: 'Division is multiplication run backwards. Fix the size first, then chunk.',
    moves: [
      'Size: 877 ÷ 27 lies between 877 ÷ 30 ≈ 29 and 877 ÷ 25 ≈ 35.',
      'Friendly divisors become multiplication: ÷5 = ×2 then ÷10; ÷25 = ×4 then ÷100; ÷16 = halve four times.',
      'Otherwise chunk: take away easy multiples of the divisor, then turn the remainder into a decimal with fraction anchors.',
      'Get two decimals before rounding to one.',
    ],
    example: '877 ÷ 27: 27 × 30 = 810, leaving 67; 27 × 2 = 54, leaving 13; 13/27 is just under 1/2 (≈ 0.48). So 32.48 → 32.5.',
  },
  bigNumbers: {
    idea: 'k, m and bn are steps of a thousand. Do the arithmetic on the plain parts, then move the unit.',
    moves: [
      'Multiplying adds steps: k × k = m, k × m = bn.',
      'Dividing subtracts them: bn ÷ k = m; bn ÷ m leaves ×1,000.',
      'Re-express if it makes the plain sum easier: 2.4bn = 2,400m.',
    ],
    example: 'Revenue 2.4bn, 8,000 employees: 8,000 = 8k; 2.4 ÷ 8 = 0.3; bn ÷ k = m, so 0.3m = 300k per employee. Check: 300k × 8k = 2,400m = 2.4bn.',
  },
  multiples: {
    idea: 'Do the arithmetic in one unit (usually millions), then convert back.',
    moves: [
      'EV = multiple × EBITDA. Split awkward multiples: 8.5x = 8x + half.',
      'Equity value = EV − net debt (net cash is added back). Share price = equity value ÷ shares.',
      'P/E = price ÷ EPS, so price = P/E × EPS.',
      'Reverse questions: estimate, then check the remainder.',
    ],
    example: 'EBITDA 270m at 8.5x: 8 × 270 = 2,160; half of 270 = 135; EV = 2,295m = 2.295bn. Reverse: 2,295 ÷ 270 is 8 (2,160) plus half (135) → 8.5x.',
  },
  growth: {
    idea: 'Growth multiplies; it never just adds. Turn each rate into a factor and chain the factors.',
    moves: [
      'Two years: square the factor (1.1² = 1.21, 1.2² = 1.44).',
      'n years: factor ≈ 1 + n·r + n(n−1)/2·r².',
      'Discounting runs the other way: PV = future value ÷ factor.',
      'Rule of 72: doubling time ≈ 72 ÷ rate.',
      'CAGR from a multiple m over n years: x = ln(m)/n, then growth ≈ x + x²/2 + x³/6.',
    ],
    example: '3,000 at 7% for 5 years: 1 + 0.35 + 10 × 0.0049 = 1.399 → about 4,197 (exact 4,207.7, inside 1%). 1,452 due in 2 years at 10% is worth 1,452 ÷ 1.21 = 1,200 today.',
  },
  estimation: {
    idea: 'Estimating to ±2% means rounding carefully, not crudely.',
    moves: [
      'Round to two significant figures or a friendly neighbour (25, 50, 0.125), do the easy sum, then count the zeros.',
      'Moving a number by 1% moves the answer by about 1%: round one factor up and the other down, or nudge the result back.',
      'Dividing by a decimal is multiplying by its reciprocal: ÷0.25 = ×4, ÷0.4 = ×2.5, ÷0.125 = ×8.',
    ],
    example: '6,644 × 42: round to 6,600 (−0.7%). 6,600 × 42 = 277,200. Nudge up 0.7% (≈ 1,940) → ≈ 279,140. Exact: 279,048.',
  },
}
