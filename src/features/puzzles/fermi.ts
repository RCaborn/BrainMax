import { seeded, shuffle } from '../../lib/rng'

export interface FermiQ {
  id: number
  q: string
  answer: number
  unit: string
}

// Only well-established values. Interval answers make small rounding differences irrelevant.
export const FERMI_BANK: FermiQ[] = [
  { id: 1, q: 'Average distance from the Earth to the Moon', answer: 384_400, unit: 'km' },
  { id: 2, q: 'Height of Mount Everest', answer: 8_849, unit: 'm' },
  { id: 3, q: 'Year the Magna Carta was sealed', answer: 1215, unit: 'year' },
  { id: 4, q: 'Number of bones in the adult human body', answer: 206, unit: 'bones' },
  { id: 5, q: 'Speed of light in a vacuum', answer: 299_792, unit: 'km/s' },
  { id: 6, q: "Earth's circumference at the equator", answer: 40_075, unit: 'km' },
  { id: 7, q: 'Year the Berlin Wall fell', answer: 1989, unit: 'year' },
  { id: 8, q: 'Number of keys on a standard piano', answer: 88, unit: 'keys' },
  { id: 9, q: 'Melting point of iron', answer: 1_538, unit: '°C' },
  { id: 10, q: 'Year the first iPhone was released', answer: 2007, unit: 'year' },
  { id: 11, q: 'Year of the first crewed Moon landing', answer: 1969, unit: 'year' },
  { id: 12, q: 'Year Shakespeare was born', answer: 1564, unit: 'year' },
  { id: 13, q: 'Average distance from the Earth to the Sun', answer: 149.6, unit: 'million km' },
  { id: 14, q: 'Year euro notes and coins entered circulation', answer: 2002, unit: 'year' },
  { id: 15, q: 'Length of a marathon', answer: 42.195, unit: 'km' },
  { id: 16, q: 'Number of chromosomes in a typical human body cell', answer: 46, unit: 'chromosomes' },
  { id: 17, q: 'Year the Titanic sank', answer: 1912, unit: 'year' },
  { id: 18, q: "Year Spain's current constitution was approved", answer: 1978, unit: 'year' },
  { id: 19, q: 'Height of the Burj Khalifa', answer: 828, unit: 'm' },
  { id: 20, q: "Year Newton's Principia was first published", answer: 1687, unit: 'year' },
  { id: 21, q: 'Number of elements in the periodic table (as of 2016)', answer: 118, unit: 'elements' },
  { id: 22, q: 'Speed of sound in dry air at 20 °C', answer: 343, unit: 'm/s' },
  { id: 23, q: 'Year the First World War began', answer: 1914, unit: 'year' },
  { id: 24, q: 'Seconds in a 365-day year', answer: 31_536_000, unit: 'seconds' },
  { id: 25, q: 'Absolute zero', answer: -273.15, unit: '°C' },
  { id: 26, q: 'Year Google was founded', answer: 1998, unit: 'year' },
  { id: 27, q: 'Players per side in rugby union', answer: 15, unit: 'players' },
  { id: 28, q: 'Year Part One of Don Quixote was published', answer: 1605, unit: 'year' },
  { id: 29, q: 'Height of Mount Kilimanjaro', answer: 5_895, unit: 'm' },
  { id: 30, q: 'Number of hearts an octopus has', answer: 3, unit: 'hearts' },
  { id: 31, q: 'Year the Bitcoin white paper was published', answer: 2008, unit: 'year' },
  { id: 32, q: 'Teeth in a full adult set (including wisdom teeth)', answer: 32, unit: 'teeth' },
  { id: 33, q: 'Land area of Russia', answer: 17.1, unit: 'million km²' },
  { id: 34, q: 'Year of the storming of the Bastille', answer: 1789, unit: 'year' },
  { id: 35, q: 'Typical lifespan of a human red blood cell', answer: 120, unit: 'days' },
  { id: 36, q: 'Time for sunlight to reach the Earth', answer: 499, unit: 'seconds' },
  { id: 37, q: 'Number of official languages of the United Nations', answer: 6, unit: 'languages' },
  { id: 38, q: 'Year Columbus first reached the Americas', answer: 1492, unit: 'year' },
  { id: 39, q: 'Mean diameter of the Earth', answer: 12_742, unit: 'km' },
  { id: 40, q: 'Number of EU member states (2025)', answer: 27, unit: 'countries' },
  { id: 41, q: 'Boiling point of water at sea level', answer: 212, unit: '°F' },
  { id: 42, q: 'Year Tim Berners-Lee proposed the World Wide Web', answer: 1989, unit: 'year' },
  { id: 43, q: 'Year of the Spanish Armada', answer: 1588, unit: 'year' },
  { id: 44, q: 'Year of the US Declaration of Independence', answer: 1776, unit: 'year' },
  { id: 45, q: "Year Darwin's On the Origin of Species was published", answer: 1859, unit: 'year' },
  { id: 46, q: 'Number of UN member states', answer: 193, unit: 'countries' },
  { id: 47, q: 'Year Constantinople fell to the Ottomans', answer: 1453, unit: 'year' },
  { id: 48, q: 'Depth of the Challenger Deep (deepest ocean point)', answer: 10_935, unit: 'm' },
  { id: 49, q: 'Area of the Sahara Desert', answer: 9.2, unit: 'million km²' },
  { id: 50, q: 'Year Einstein published special relativity', answer: 1905, unit: 'year' },
  { id: 51, q: 'Average mass of an adult human brain', answer: 1_350, unit: 'g' },
  { id: 52, q: 'Gestation period of an African elephant', answer: 22, unit: 'months' },
  { id: 53, q: "Year Picasso painted Guernica", answer: 1937, unit: 'year' },
  { id: 54, q: 'Year Spain joined the European Communities (now EU)', answer: 1986, unit: 'year' },
  { id: 55, q: 'Straight-line distance from Madrid to Barcelona', answer: 505, unit: 'km' },
  { id: 56, q: 'Year the first Harry Potter book was published', answer: 1997, unit: 'year' },
  { id: 57, q: 'Number of bones in one human hand (including wrist)', answer: 27, unit: 'bones' },
  { id: 58, q: 'Length of the Channel Tunnel', answer: 50, unit: 'km' },
  { id: 59, q: 'World population in 2024', answer: 8.1, unit: 'billion' },
  { id: 60, q: "Year of the Wright brothers' first powered flight", answer: 1903, unit: 'year' },
]

export const QUESTIONS_PER_ROUND = 5

/** Walks a fixed shuffled order of the bank so questions don't repeat until it's exhausted. */
export function fermiRound(roundIndex: number): FermiQ[] {
  const order = shuffle(seeded('fermi-bank-v1'), FERMI_BANK)
  return Array.from({ length: QUESTIONS_PER_ROUND }, (_, i) => order[(roundIndex * QUESTIONS_PER_ROUND + i) % order.length])
}

export const isHit = (q: FermiQ, low: number, high: number) => Math.min(low, high) <= q.answer && q.answer <= Math.max(low, high)
