/**
 * The tape that ships on the shelf. No audio assets are bundled, so the music is
 * synthesised here: Karplus–Strong plucked strings (tanpura drone + sitar-ish
 * melody) over a simple tabla-like pulse, in two ragas for sides A and B.
 */
import { rng } from './generator'

const SR = 44100

/** Add a Karplus–Strong pluck into stereo buffers. */
function pluck(L: Float32Array, R: Float32Array, startSec: number, freq: number, dur: number, amp: number, pan: number, bright = 0.5) {
  const n = Math.max(2, Math.round(SR / freq))
  const line = new Float32Array(n)
  for (let i = 0; i < n; i++) line[i] = Math.random() * 2 - 1
  const total = Math.min(Math.floor(dur * SR), L.length - Math.floor(startSec * SR))
  const s0 = Math.floor(startSec * SR)
  const decay = 0.9965 + bright * 0.0025
  let idx = 0
  const gl = amp * Math.cos((pan + 1) * Math.PI * 0.25)
  const gr = amp * Math.sin((pan + 1) * Math.PI * 0.25)
  for (let i = 0; i < total; i++) {
    const next = (idx + 1) % n
    const v = line[idx]
    line[idx] = decay * 0.5 * (v + line[next])
    const env = i < 200 ? i / 200 : 1 - (i / total) * 0.35
    L[s0 + i] += v * gl * env
    R[s0 + i] += v * gr * env
    idx = next
  }
}

/** Low "dha" thump or high "tin" tick. */
function tabla(L: Float32Array, R: Float32Array, startSec: number, low: boolean, amp: number) {
  const s0 = Math.floor(startSec * SR)
  const len = Math.floor((low ? 0.28 : 0.09) * SR)
  let phase = 0
  for (let i = 0; i < len && s0 + i < L.length; i++) {
    const t = i / SR
    const f = low ? 96 + 70 * Math.exp(-t * 28) : 520
    phase += (2 * Math.PI * f) / SR
    const env = Math.exp(-t * (low ? 12 : 55))
    const v = (Math.sin(phase) * (low ? 1 : 0.45) + (low ? 0 : (Math.random() * 2 - 1) * 0.25)) * env * amp
    L[s0 + i] += v
    R[s0 + i] += v
  }
}

interface RagaSpec {
  rootHz: number
  /** Semitone offsets of the scale degrees used. */
  scale: number[]
  bpm: number
  seed: number
  seconds: number
}

function renderRaga(spec: RagaSpec): AudioBuffer {
  const len = Math.floor(spec.seconds * SR)
  const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR })
  const L = new Float32Array(len)
  const R = new Float32Array(len)
  const r = rng(spec.seed)
  const hz = (semi: number) => spec.rootHz * Math.pow(2, semi / 12)

  // tanpura: Pa – Sa – Sa – low Sa, repeating every 5 beats' worth
  const cycle = 60 / spec.bpm * 4
  const strings = [7 - 12, 0, 0, -12]
  for (let t = 0; t < spec.seconds - 2; t += cycle) {
    strings.forEach((s, i) => pluck(L, R, t + (i * cycle) / 4.4, hz(s), 4.2, 0.1, i % 2 ? 0.5 : -0.5, 0.8))
  }

  // tabla pulse (8-beat cycle)
  const beat = 60 / spec.bpm
  for (let b = 0, t = 4 * beat; t < spec.seconds - 1; b++, t += beat / 2) {
    const pos = b % 16
    if (pos === 0 || pos === 8) tabla(L, R, t, true, 0.38)
    else if (pos % 2 === 0) tabla(L, R, t, false, 0.14)
    else if (pos % 4 === 3) tabla(L, R, t, true, 0.09)
  }

  // melody: random walk on the scale with ornamented phrase endings
  let deg = 2
  let t = 6 * beat
  while (t < spec.seconds - 3) {
    const phraseLen = 3 + Math.floor(r() * 5)
    for (let i = 0; i < phraseLen && t < spec.seconds - 3; i++) {
      deg = Math.max(0, Math.min(spec.scale.length * 2 - 1, deg + Math.round((r() - 0.48) * 3)))
      const octave = Math.floor(deg / spec.scale.length)
      const semi = spec.scale[deg % spec.scale.length] + octave * 12
      const d = beat * (r() < 0.3 ? 1 : 0.5)
      pluck(L, R, t, hz(semi + 12), 1.6, 0.2, 0.15, 0.4)
      if (r() < 0.25) pluck(L, R, t + d * 0.45, hz(semi + 12 + 2), 0.7, 0.1, 0.15, 0.3) // grace note
      t += d
    }
    t += beat * (1 + Math.floor(r() * 3)) // breath between phrases
  }

  // light stereo width, then normalise
  const delay = Math.floor(0.011 * SR)
  let peak = 0
  for (let i = 0; i < len; i++) {
    const wet = i >= delay ? L[i - delay] * 0.18 : 0
    R[i] += wet
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
  }
  const norm = 0.72 / (peak || 1)
  // short fade in/out
  const fade = Math.floor(0.4 * SR)
  for (let i = 0; i < len; i++) {
    const f = Math.min(1, i / fade, (len - i) / (fade * 2))
    L[i] *= norm * f
    R[i] *= norm * f
  }
  buf.copyToChannel(L, 0)
  buf.copyToChannel(R, 1)
  return buf
}

export interface DemoAudio {
  A: AudioBuffer
  B: AudioBuffer
}

/** Yield to the event loop so the loading screen can paint between the two renders. */
const tick = () => new Promise<void>((res) => setTimeout(res, 0))

export async function synthesiseDemo(onProgress?: (f: number) => void): Promise<DemoAudio> {
  const A = renderRaga({ rootHz: 130.81, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 68, seed: 1984, seconds: 156 }) // Yaman
  onProgress?.(0.5)
  await tick()
  const B = renderRaga({ rootHz: 146.83, scale: [0, 2, 4, 7, 9], bpm: 84, seed: 1987, seconds: 112 }) // Bhoopali
  onProgress?.(1)
  return { A, B }
}
