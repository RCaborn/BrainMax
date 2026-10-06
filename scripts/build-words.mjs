// Builds src/features/spanish/words.json from data/words-*.txt.
// Line format: spanish|english1;english2|pos   (pos: v nm nf nmf adj adv prep conj pron det num int)
// Files 01-02 are ordered by subtitle frequency; 03 (frequency-ordered tail) and
// 04 (core vocab missing from subtitle lists) are interleaved 2:1 to fill ranks to 2000.
import { readFileSync, writeFileSync } from 'node:fs'

const read = (f) =>
  readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const head = [...read('words-01.txt'), ...read('words-02.txt')]
const a = read('words-03.txt')
const b = read('words-04.txt')
const tail = []
for (let i = 0, j = 0; i < a.length || j < b.length; ) {
  if (i < a.length) tail.push(a[i++])
  if (i < a.length) tail.push(a[i++])
  if (j < b.length) tail.push(b[j++])
}

const seen = new Set()
const words = []
for (const line of [...head, ...tail]) {
  const [es, en, pos] = line.split('|')
  if (!es || !en || !pos) throw new Error(`Bad line: ${line}`)
  const key = es.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  words.push({ id: words.length + 1, es: es.split('/'), en: en.split(';'), pos })
  if (words.length === 2000) break
}
if (words.length < 2000) throw new Error(`Only ${words.length} words`)
writeFileSync(
  new URL('../src/features/spanish/words.json', import.meta.url),
  JSON.stringify(words).replace(/\},\{/g, '},\n{') + '\n',
)
console.log(`Wrote ${words.length} words`)
