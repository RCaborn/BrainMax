import raw from './words.json'

export interface Word {
  id: number // = frequency rank
  es: string[] // accepted Spanish forms; first is canonical
  en: string[] // accepted English meanings; first is primary
  pos: string // v nm nf nmf adj adv prep conj pron det num int
}

export const WORDS: Word[] = raw as Word[]
export const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]))
export const TOTAL_WORDS = WORDS.length

const POS_LABEL: Record<string, string> = {
  v: 'verb', nm: 'noun, masc.', nf: 'noun, fem.', nmf: 'noun', adj: 'adjective', adv: 'adverb',
  prep: 'preposition', conj: 'conjunction', pron: 'pronoun', det: 'determiner', num: 'number', int: 'interjection',
}
export const posLabel = (pos: string) => POS_LABEL[pos] ?? pos

// Feminine nouns starting with a stressed a- take "el" in the singular.
const EL_FEMININE = new Set(['agua', 'alma', 'arma', 'área', 'ala', 'hambre', 'águila', 'aula', 'hacha'])
const PLURAL_NOUNS = new Set(['vacaciones', 'gafas', 'pantalones', 'padres', 'datos', 'antecedentes', 'matemáticas', 'ganas', 'correos'])

export function article(w: Word): string | null {
  const es = w.es[0]
  if (es.includes(' ')) return null
  if (w.pos === 'nmf') return 'el/la'
  if (w.pos === 'nm') return PLURAL_NOUNS.has(es) ? 'los' : 'el'
  if (w.pos === 'nf') return PLURAL_NOUNS.has(es) ? 'las' : EL_FEMININE.has(es) ? 'el' : 'la'
  return null
}

/** "la casa", "el agua", "hablar" */
export function spanishDisplay(w: Word): string {
  const a = article(w)
  return a ? `${a} ${w.es[0]}` : w.es.join(' / ')
}

export function englishPrompt(w: Word): string {
  return w.en.slice(0, 3).join(' / ')
}
