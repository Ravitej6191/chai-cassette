/**
 * Tape generator: turns a file name + duration into a believable, hand-labelled
 * cassette. Everything is derived from a hash of the name, so the same file always
 * produces the same tape.
 */
import { FORMATS, type HandFont, type Tape, type TapeFormat } from './types'

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SHELLS = ['#2b2623', '#c9c4b8', '#8e2f2a', '#25405f', '#2f5a3d', '#c99a2e', '#4a3a2a', '#6b2f5a', '#d7d0c2']
const LABELS = ['#efe6cf', '#f4d9d0', '#d9e6ee', '#f1ecd2', '#e6dcc3', '#fbf6e9', '#e9d3a5']
const STRIPES = ['#c0392b', '#1f5f8b', '#2e7d4f', '#d68910', '#6c3483', '#1b1b1b']
const INKS = ['#1d3a8a', '#1b1b1b', '#8e1b1b', '#14532d']
const FONTS: HandFont[] = ['Caveat', 'Reenie Beanie', 'Nanum Pen Script', 'Special Elite']
const BRANDS = ['SARGAM', 'BHARAT AUDIO', 'RAGA FERRIC', 'KOHINOOR', 'MADHUR', 'SUPER-FI']

export function cleanTitle(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const words = base.split(' ').map((w) => (w.length > 2 && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w))
  return words.join(' ').slice(0, 42) || 'Untitled'
}

/** Smallest standard cassette whose side fits the programme. */
export function pickFormat(durationSec: number): TapeFormat {
  const order: TapeFormat[] = ['C30', 'C46', 'C60', 'C90', 'C120']
  return order.find((f) => FORMATS[f].sideMin * 60 >= durationSec + 12) ?? 'C120'
}

export interface TapeSeed {
  id: string
  name: string
  durationA: number
  titleB?: string
  durationB?: number
  isDemo?: boolean
  wear?: number
}

export function generateTape(seed: TapeSeed, slot: number): Tape {
  const r = rng(hash(seed.name + seed.durationA.toFixed(1)))
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const title = cleanTitle(seed.name)
  const longest = Math.max(seed.durationA, seed.durationB ?? 0)
  return {
    id: seed.id,
    title,
    artist: '',
    brand: pick(BRANDS),
    format: pickFormat(longest),
    shellColor: pick(SHELLS),
    labelColor: pick(LABELS),
    stripeColor: pick(STRIPES),
    ink: pick(INKS),
    font: pick(FONTS),
    wear: seed.wear ?? 0.08 + r() * 0.45,
    plays: 0,
    side: 'A',
    wound: 0,
    sides: {
      A: { title, duration: seed.durationA },
      B: { title: seed.titleB ?? '', duration: seed.durationB ?? 0 },
    },
    slot,
    isDemo: seed.isDemo,
  }
}
