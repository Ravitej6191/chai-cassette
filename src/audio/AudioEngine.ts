/**
 * AudioEngine — the single shared AudioContext, the tape transport (motor model +
 * position clock) and the master bus with analysers for the VU meters.
 *
 * The transport clock is owned here: `update(dt)` advances the tape position at the
 * motor's current speed; the active source is told to play at the matching rate so
 * audio and reels stay in step.
 */
import type { DeckMode } from '../state/machine'
import type { Settings } from '../state/store'
import { live } from '../state/live'
import type { TapeSource } from '../sources/types'
import { TapeChain } from './effects'

export interface TransportInfo {
  /** Programme length of the side under the heads (seconds of tape at 1×). */
  length: number
  /** Where auto-stop trips while playing (end of programme + a short tail). */
  contentEnd: number
}

export type Boundary = 'contentEnd' | 'ribbonEnd' | 'start'

/** Signed tape-speed target per transport mode. */
const TARGET: Partial<Record<DeckMode, number>> = {
  PLAYING: 1,
  RECORDING: 1,
  CUE: 5,
  REVIEW: -5,
  FF: 28,
  REW: -28,
}
const AUDIBLE: DeckMode[] = ['PLAYING', 'RECORDING', 'CUE', 'REVIEW']

export const pitchFactor = (pitch: number) => 1 + 0.12 * pitch

export class AudioEngine {
  ctx: AudioContext | null = null
  private chain: TapeChain | null = null
  private routeIn: GainNode | null = null
  private sourceGain: GainNode | null = null
  private volume: GainNode | null = null
  private analyserL: AnalyserNode | null = null
  private analyserR: AnalyserNode | null = null
  private bufL = new Float32Array(1024)
  private bufR = new Float32Array(1024)
  /** Mechanical sounds go here, outside the tape chain. */
  sfxBus: GainNode | null = null
  private initPromise: Promise<void> | null = null

  // transport
  mode: DeckMode = 'EMPTY'
  source: TapeSource | null = null
  info: TransportInfo = { length: 1800, contentEnd: 0 }
  pos = 0
  speed = 0
  private srcDir: 1 | -1 = 1
  private runout = false
  private settings: Settings | null = null
  private wear = 0
  private bypass = false
  private battPhase = 0
  private coasting = false
  private frame = 0

  /** Boundary callback: set by the controller. */
  onBoundary: (b: Boundary) => void = () => {}

  /** Create the context + graph. Must be called from a user gesture the first time. */
  init(): Promise<void> {
    this.initPromise ??= this.build()
    return this.initPromise
  }

  private async build() {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    let worklet: AudioWorkletNode | null = null
    try {
      await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/tape-processor.js`)
      worklet = new AudioWorkletNode(ctx, 'tape-degrade', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
    } catch (err) {
      console.warn('tape-degrade worklet unavailable, running without dropouts/hiss', err)
    }
    this.chain = new TapeChain(ctx, worklet)
    this.routeIn = ctx.createGain()
    this.sourceGain = ctx.createGain()
    this.sourceGain.gain.value = 0
    this.sourceGain.connect(this.routeIn)
    this.routeIn.connect(this.chain.tapeIn)

    this.volume = ctx.createGain()
    this.volume.gain.value = 0
    const comp = ctx.createDynamicsCompressor() // safety limiter
    comp.threshold.value = -3
    comp.knee.value = 6
    comp.ratio.value = 12
    comp.attack.value = 0.003
    comp.release.value = 0.15
    this.chain.out.connect(this.volume)
    this.volume.connect(comp)
    comp.connect(ctx.destination)

    const split = ctx.createChannelSplitter(2)
    this.analyserL = ctx.createAnalyser()
    this.analyserR = ctx.createAnalyser()
    this.analyserL.fftSize = this.analyserR.fftSize = 1024
    comp.connect(split)
    split.connect(this.analyserL, 0)
    split.connect(this.analyserR, 1)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.9
    this.sfxBus.connect(ctx.destination)

    if (this.settings) this.applySettings(this.settings, true)
  }

  get ready() {
    return !!this.ctx && !!this.chain
  }

  async resume() {
    await this.init()
    if (this.ctx && this.ctx.state !== 'running') await this.ctx.resume()
  }

  // ---------------------------------------------------------------- source

  /** Attach the programme for the side now under the heads. */
  setSource(src: TapeSource | null, info: TransportInfo, startPos: number, wear: number) {
    if (this.source && this.source !== src) this.source.dispose()
    this.source = src
    this.info = info
    this.pos = startPos
    this.wear = wear
    this.runout = false
    if (src && this.ctx && this.sourceGain) {
      void src.load(this.ctx).then(() => {
        src.connect(this.sourceGain!)
      })
      this.setBypass(!src.supportsEffects)
    }
    this.srcDir = 1
    if (this.settings) this.applySettings(this.settings)
  }

  /** Route around the tape imperfections (Spotify/DRM). Tone + balance stay in circuit. */
  setBypass(on: boolean) {
    if (!this.routeIn || !this.chain || on === this.bypass) return
    this.bypass = on
    this.routeIn.disconnect()
    this.routeIn.connect(on ? this.chain.deckIn : this.chain.tapeIn)
  }

  setMode(mode: DeckMode) {
    const wasAudible = AUDIBLE.includes(this.mode)
    this.mode = mode
    if (mode !== 'PLAYING') this.runout = false
    // On STOP/PAUSE the audio keeps sounding while the motor winds down (pitch drops away).
    this.coasting = wasAudible && ['LOADED', 'PAUSED', 'EMPTY', 'EJECTING', 'CHEWED'].includes(mode)
  }

  /** Start the runout-to-flip used by auto-reverse: fast silent wind to the end of ribbon. */
  beginRunout() {
    this.runout = true
  }

  endRunout() {
    this.runout = false
  }

  get isRunout() {
    return this.runout
  }

  /** Jump the clock (used when a tape is inserted or the side flips). */
  setPosition(p: number) {
    this.pos = p
    this.srcDir = 1
    if (this.source?.isPlaying()) this.source.pause()
  }

  // ---------------------------------------------------------------- settings

  applySettings(s: Settings, force = false) {
    this.settings = s
    if (!this.ready || !this.ctx) return
    const t = this.ctx.currentTime
    // volume taper: perceptual curve, with a little make-up so 0.7 is comfortable
    this.volume!.gain.setTargetAtTime(Math.pow(s.volume, 2.2) * 1.3, t, force ? 0.001 : 0.03)
    this.chain!.apply({
      tapeType: s.tapeType,
      dolby: s.dolby,
      wear: this.wear,
      lowBattery: s.lowBattery,
      hissGate: this.hissGate(),
      bass: s.bass,
      treble: s.treble,
      balance: s.balance,
    })
  }

  private hissGate() {
    return AUDIBLE.includes(this.mode) && Math.abs(this.speed) > 0.2 ? 1 : 0
  }

  /** Combined speed factor from the pitch knob and the battery. */
  private motorFactor(): number {
    const s = this.settings
    if (!s) return 1
    let f = pitchFactor(s.pitch)
    if (s.lowBattery) f *= 0.87 + 0.012 * Math.sin(this.battPhase)
    return f
  }

  // ---------------------------------------------------------------- per-frame

  update(dt: number) {
    dt = Math.min(dt, 0.1)
    this.battPhase += dt * 0.9

    // --- motor model ---------------------------------------------------
    let target = TARGET[this.mode] ?? 0
    if (this.runout) target = TARGET.FF!
    const abs = Math.abs(target)
    let tau: number
    if (target === 0) tau = this.mode === 'PAUSED' ? 0.03 : 0.09 // quick, audible pitch drop on STOP
    else if (abs <= Math.abs(this.speed) && Math.abs(this.speed) > abs) tau = 0.25
    else tau = abs <= 1 ? 0.17 : abs <= 5 ? 0.3 : 0.55 // ~0.5 s to reach play speed
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / tau))
    if (target === 0 && Math.abs(this.speed) < 0.004) this.speed = 0

    const rate = this.speed * this.motorFactor()
    live.rate = rate
    live.motor = Math.min(1, Math.abs(this.speed) / 1.2)

    // --- advance tape --------------------------------------------------
    if (rate !== 0) {
      const { length, contentEnd } = this.info
      const playing = AUDIBLE.includes(this.mode) || this.mode === 'PAUSED'
      // Auto-stop trips at the end of the programme — but only if we were still inside it when
      // the step began (starting a play from past the programme runs on to the end of the ribbon).
      const hi = this.runout || !playing ? length : this.pos < contentEnd || contentEnd >= length ? contentEnd : length
      this.pos += rate * dt
      if (rate > 0 && this.pos >= hi) {
        this.pos = hi
        this.onBoundary(hi >= length ? 'ribbonEnd' : 'contentEnd')
      } else if (rate < 0 && this.pos <= 0) {
        this.pos = 0
        this.onBoundary('start')
      }
    }
    live.pos = this.pos

    // --- drive the source ---------------------------------------------
    if (this.coasting && Math.abs(this.speed) < 0.05) this.coasting = false
    const audible = (AUDIBLE.includes(this.mode) || this.coasting) && !this.runout
    const src = this.source
    if (this.ctx && src && this.sourceGain) {
      const absRate = Math.abs(rate)
      if (audible && absRate > 0.02) {
        const dir: 1 | -1 = rate >= 0 ? 1 : -1
        if (!src.isPlaying() || dir !== this.srcDir) {
          src.setRate(absRate)
          src.play(this.pos, dir)
          this.srcDir = dir
        } else src.setRate(absRate)
        this.sourceGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.02)
      } else {
        this.sourceGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015)
        if (src.isPlaying() && (!audible || absRate <= 0.02)) src.pause()
      }
    }

    // --- chain params that follow the transport -----------------------
    if (this.ready && this.settings && ++this.frame % 4 === 0) this.applySettings(this.settings)
    if (this.chain && this.ctx) this.chain.gate.gain.setTargetAtTime(audible ? 1 : 0, this.ctx.currentTime, 0.02)

    this.measure()
  }

  /** Read both analysers → VU needle targets, clip detection, speaker cone. */
  private measure() {
    if (!this.analyserL || !this.analyserR || !this.ctx) {
      live.vuL *= 0.9
      live.vuR *= 0.9
      return
    }
    this.analyserL.getFloatTimeDomainData(this.bufL)
    this.analyserR.getFloatTimeDomainData(this.bufR)
    const stat = (buf: Float32Array) => {
      let sum = 0
      let peak = 0
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i]
        sum += v * v
        const a = Math.abs(v)
        if (a > peak) peak = a
      }
      return { rms: Math.sqrt(sum / buf.length), peak }
    }
    const l = stat(this.bufL)
    const r = stat(this.bufR)
    const toNeedle = (rms: number) => Math.min(1.08, Math.max(0, (20 * Math.log10(rms + 1e-5) + 34) / 26))
    live.vuL = toNeedle(l.rms)
    live.vuR = toNeedle(r.rms)
    live.peakL = l.peak
    live.peakR = r.peak
    if (l.peak > 0.96 || r.peak > 0.96) live.clipUntil = this.ctx.currentTime + 0.18
    live.cone = Math.min(1, (l.rms + r.rms) * 2.4)
  }

  /** Hiss/levels use ctx time for the clip LED. */
  get now() {
    return this.ctx?.currentTime ?? 0
  }
}

export const engine = new AudioEngine()
