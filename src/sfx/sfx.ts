/**
 * Mechanical sound effects, synthesised with the Web Audio API (no sample files).
 * Each sound is a few oscillators + shaped noise bursts through filters — the same
 * recipe as a Foley artist: a transient "click", a body "thump", and some ring.
 * They go to the engine's SFX bus, bypassing the tape chain.
 */
import { engine } from '../audio/AudioEngine'

let noiseBuf: AudioBuffer | null = null

function ctxBus(): { ctx: AudioContext; bus: GainNode } | null {
  const ctx = engine.ctx
  const bus = engine.sfxBus
  if (!ctx || !bus || ctx.state === 'closed') return null
  return { ctx, bus }
}

function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

interface BurstOpts {
  at?: number
  dur: number
  freq: number
  q?: number
  type?: BiquadFilterType
  gain: number
  /** Optional frequency sweep target. */
  to?: number
}

/** Filtered noise burst with a fast exponential decay. */
function burst(o: BurstOpts) {
  const c = ctxBus()
  if (!c) return
  const { ctx, bus } = c
  const t = ctx.currentTime + (o.at ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = o.type ?? 'bandpass'
  f.frequency.setValueAtTime(o.freq, t)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  f.Q.value = o.q ?? 1
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.0015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  src.connect(f).connect(g).connect(bus)
  src.start(t, Math.random() * 0.5)
  src.stop(t + o.dur + 0.02)
}

interface ToneOpts {
  at?: number
  dur: number
  from: number
  to?: number
  gain: number
  type?: OscillatorType
}

/** Pitched thump / ping with exponential decay. */
function tone(o: ToneOpts) {
  const c = ctxBus()
  if (!c) return
  const { ctx, bus } = c
  const t = ctx.currentTime + (o.at ?? 0)
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.from, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
  osc.connect(g).connect(bus)
  osc.start(t)
  osc.stop(t + o.dur + 0.02)
}

export const sfx = {
  /** Piano key travelling down: soft plastic thock. */
  keyDown() {
    burst({ dur: 0.05, freq: 1500, q: 0.9, gain: 0.5 })
    tone({ dur: 0.06, from: 190, to: 90, gain: 0.5 })
  },
  /** PLAY/REC catching on the latch bar: crisp metallic click. */
  keyLatch() {
    burst({ dur: 0.02, freq: 4200, q: 3, gain: 0.55 })
    burst({ at: 0.012, dur: 0.05, freq: 1100, q: 1.5, gain: 0.35 })
    tone({ dur: 0.05, from: 260, to: 110, gain: 0.5 })
  },
  /** Latches released by STOP: the loud "clack" of the whole key bank springing up. */
  stopClack() {
    burst({ dur: 0.07, freq: 900, q: 1.1, gain: 0.8 })
    burst({ at: 0.005, dur: 0.03, freq: 3600, q: 2, gain: 0.5 })
    tone({ dur: 0.1, from: 150, to: 55, gain: 0.7 })
    tone({ at: 0.03, dur: 0.12, from: 520, to: 380, gain: 0.12, type: 'triangle' })
  },
  keyUp() {
    burst({ dur: 0.025, freq: 2600, q: 2, gain: 0.25 })
  },
  /** Pressing a key that cannot engage (REC without PLAY, PLAY with no tape). */
  reject() {
    burst({ dur: 0.04, freq: 700, q: 0.8, gain: 0.35 })
    tone({ dur: 0.05, from: 110, to: 70, gain: 0.35 })
  },
  /** Door release: spring twang, then plastic bounces. */
  doorSpring() {
    tone({ dur: 0.7, from: 310, to: 250, gain: 0.18, type: 'sawtooth' })
    tone({ dur: 0.5, from: 1180, to: 1080, gain: 0.07 })
    burst({ dur: 0.04, freq: 2500, q: 1.5, gain: 0.5 })
    tone({ at: 0.04, dur: 0.12, from: 160, to: 70, gain: 0.5 })
  },
  doorBounce(strength = 1) {
    burst({ dur: 0.05, freq: 1300, q: 1, gain: 0.3 * strength })
    tone({ dur: 0.07, from: 220, to: 110, gain: 0.3 * strength })
  },
  /** Door pushed shut and catching. */
  doorLatch() {
    burst({ dur: 0.03, freq: 3300, q: 2.5, gain: 0.55 })
    tone({ dur: 0.09, from: 170, to: 80, gain: 0.55 })
    burst({ at: 0.04, dur: 0.04, freq: 2000, q: 2, gain: 0.3 })
  },
  /** Cassette dropping into the cradle / seating on the spindles. */
  tapeInsert() {
    tone({ dur: 0.1, from: 140, to: 60, gain: 0.7 })
    burst({ dur: 0.08, freq: 600, q: 0.7, gain: 0.5 })
    burst({ at: 0.05, dur: 0.05, freq: 2200, q: 1.5, gain: 0.25 })
  },
  /** Cassette popping up on eject. */
  tapePop() {
    tone({ dur: 0.12, from: 90, to: 200, gain: 0.35 })
    burst({ at: 0.01, dur: 0.06, freq: 1800, q: 1, gain: 0.4 })
  },
  /** Picking a tape off the shelf / putting it back: light plastic tap. */
  tapeHandle() {
    burst({ dur: 0.04, freq: 1900, q: 1.2, gain: 0.3 })
    tone({ dur: 0.05, from: 240, to: 150, gain: 0.2 })
  },
  /** End-of-side auto-stop: a heavy clunk. */
  autoStop() {
    tone({ dur: 0.16, from: 120, to: 42, gain: 0.9 })
    burst({ dur: 0.1, freq: 500, q: 0.8, gain: 0.7 })
    burst({ at: 0.01, dur: 0.03, freq: 3000, q: 2, gain: 0.4 })
  },
  /** Knob detent tick. */
  detent(strong = false) {
    burst({ dur: 0.012, freq: strong ? 3000 : 4400, q: 3, gain: strong ? 0.45 : 0.25, type: 'bandpass' })
    if (strong) tone({ dur: 0.02, from: 520, to: 300, gain: 0.15 })
  },
  /** Slide/toggle switch flip. */
  switchFlip() {
    burst({ dur: 0.014, freq: 3500, q: 3, gain: 0.45 })
    burst({ at: 0.035, dur: 0.02, freq: 1800, q: 2, gain: 0.35 })
    tone({ at: 0.035, dur: 0.03, from: 300, to: 180, gain: 0.2 })
  },
  /** Counter reset button. */
  counterReset() {
    burst({ dur: 0.02, freq: 3800, q: 3, gain: 0.4 })
    for (let i = 0; i < 6; i++) burst({ at: 0.05 + i * 0.035, dur: 0.01, freq: 5200, q: 4, gain: 0.18 })
  },
  /** Head flip during auto-reverse. */
  headFlip() {
    tone({ dur: 0.14, from: 200, to: 90, gain: 0.55 })
    burst({ dur: 0.09, freq: 1400, q: 1, gain: 0.45 })
    burst({ at: 0.12, dur: 0.05, freq: 2800, q: 2, gain: 0.4 })
  },
}

/**
 * Looping motor + fast-wind whirr. Driven each frame with the transport speed so the
 * hum rises and falls with the motor and the whirr appears only in FF/REW.
 */
class MotorSound {
  private osc: OscillatorNode | null = null
  private whirr: BiquadFilterNode | null = null
  private humGain: GainNode | null = null
  private whirrGain: GainNode | null = null
  private started = false

  private start() {
    const c = ctxBus()
    if (!c || this.started) return
    const { ctx, bus } = c
    this.started = true
    // low hum: square wave through a lowpass, plus a quiet sine an octave up
    this.osc = ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 50
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 260
    this.humGain = ctx.createGain()
    this.humGain.gain.value = 0
    this.osc.connect(lp).connect(this.humGain).connect(bus)
    this.osc.start()
    // fast wind whirr: band-passed noise
    const n = ctx.createBufferSource()
    n.buffer = noise(ctx)
    n.loop = true
    this.whirr = ctx.createBiquadFilter()
    this.whirr.type = 'bandpass'
    this.whirr.Q.value = 2.5
    this.whirr.frequency.value = 900
    this.whirrGain = ctx.createGain()
    this.whirrGain.gain.value = 0
    n.connect(this.whirr).connect(this.whirrGain).connect(bus)
    n.start()
  }

  /** @param speed signed tape speed multiplier, @param fast true in FF/REW */
  update(speed: number, fast: boolean) {
    const c = ctxBus()
    if (!c) return
    this.start()
    const t = c.ctx.currentTime
    const a = Math.min(1, Math.abs(speed) / 1.2)
    this.osc!.frequency.setTargetAtTime(48 + Math.min(Math.abs(speed), 30) * 2.2, t, 0.05)
    this.humGain!.gain.setTargetAtTime(a * 0.045, t, 0.08)
    this.whirr!.frequency.setTargetAtTime(500 + Math.min(Math.abs(speed), 30) * 38, t, 0.08)
    this.whirrGain!.gain.setTargetAtTime(fast ? Math.min(1, Math.abs(speed) / 20) * 0.16 : 0, t, 0.1)
  }
}

/** Soft steady rain on glass: filtered noise bed plus the occasional fat drop. Quiet on purpose. */
class RainSound {
  private gain: GainNode | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private on = false

  private start() {
    const c = ctxBus()
    if (!c || this.gain) return
    const { ctx, bus } = c
    const n = ctx.createBufferSource()
    n.buffer = noise(ctx)
    n.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 500
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 7000
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    n.connect(hp).connect(lp).connect(this.gain).connect(bus)
    n.start()
    const drop = () => {
      if (this.on) burst({ dur: 0.03, freq: 2500 + Math.random() * 3500, q: 4, gain: 0.04 + Math.random() * 0.05 })
      this.timer = setTimeout(drop, 60 + Math.random() * 260)
    }
    drop()
  }

  update(on: boolean) {
    const c = ctxBus()
    if (!c) return
    this.on = on
    if (on) this.start()
    this.gain?.gain.setTargetAtTime(on ? 0.05 : 0, c.ctx.currentTime, 0.6)
  }
}

export const rainSound = new RainSound()
export const motorSound = new MotorSound()
