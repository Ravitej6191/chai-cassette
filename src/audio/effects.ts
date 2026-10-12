/**
 * The tape effects chain.
 *
 *  input → wow & flutter (modulated delay) → saturation → HF rolloff
 *        → dropouts + stereo drift + hiss (AudioWorklet)
 *        → tape-type EQ → Dolby shelf  ┐  "tape stage" (bypassed for DRM sources)
 *  ──────────────────────────────────────┘
 *        → bass / treble → balance     ← "deck stage" (always in circuit)
 *
 * Pitch/speed is applied upstream by the source's playbackRate (the motor model).
 */
import type { TapeType } from '../state/store'

export interface ChainParams {
  tapeType: TapeType
  dolby: boolean
  /** 0..1 */
  wear: number
  lowBattery: boolean
  /** 1 when tape is moving past the heads, else 0 (gates the hiss). */
  hissGate: number
  /** -1..1 */
  bass: number
  treble: number
  balance: number
}

const HISS = [0.0055, 0.0032, 0.002] // Normal, Chrome, Metal — amplitude
const ROLLOFF = [11000, 14500, 17500]
const SHELF = [0, 2.5, 3.5] // dB of HF lift the deck applies per tape type
const DRIVE = [1.7, 1.35, 1.05] // saturation amount

function satCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 2048
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(k * x) / k // unity gain for small signals, soft-clips peaks
  }
  return c
}

export class TapeChain {
  /** Feed tape-affected sources here. */
  readonly tapeIn: GainNode
  /** Feed sources that bypass the tape stage (still go through tone + balance). */
  readonly deckIn: GainNode
  readonly out: GainNode
  /** Silences the whole tape stage (FF/REW with heads lifted). */
  readonly gate: GainNode
  worklet: AudioWorkletNode | null = null

  private delay: DelayNode
  private wow: GainNode
  private wow2: GainNode
  private flutter: GainNode
  private shaper: WaveShaperNode
  private lowpass: BiquadFilterNode
  private tapeEq: BiquadFilterNode
  private dolbyShelf: BiquadFilterNode
  private bass: BiquadFilterNode
  private treble: BiquadFilterNode
  private balL: GainNode
  private balR: GainNode
  private lastType: TapeType | -1 = -1

  constructor(private ctx: AudioContext, worklet: AudioWorkletNode | null) {
    const c = ctx
    this.worklet = worklet
    this.tapeIn = c.createGain()
    this.tapeIn.channelCount = 2
    this.tapeIn.channelCountMode = 'explicit'
    this.tapeIn.channelInterpretation = 'speakers' // mono files up-mix to both channels
    this.deckIn = c.createGain()
    this.deckIn.channelCount = 2
    this.deckIn.channelCountMode = 'explicit'
    this.deckIn.channelInterpretation = 'speakers'
    this.out = c.createGain()
    this.gate = c.createGain()

    // wow & flutter: a short delay line whose time wobbles
    this.delay = c.createDelay(0.1)
    this.delay.delayTime.value = 0.02
    this.wow = c.createGain()
    this.wow2 = c.createGain()
    this.flutter = c.createGain()
    const lfo = (freq: number, dest: GainNode) => {
      const o = c.createOscillator()
      o.frequency.value = freq
      o.connect(dest)
      dest.connect(this.delay.delayTime)
      o.start()
    }
    lfo(0.83, this.wow) // capstan eccentricity
    lfo(0.37, this.wow2) // slow supply-reel drift
    lfo(9.4, this.flutter) // pinch-roller flutter

    this.shaper = c.createWaveShaper()
    this.shaper.oversample = '2x'
    this.lowpass = c.createBiquadFilter()
    this.lowpass.type = 'lowpass'
    this.lowpass.Q.value = 0.6
    this.tapeEq = c.createBiquadFilter()
    this.tapeEq.type = 'highshelf'
    this.tapeEq.frequency.value = 7000
    this.dolbyShelf = c.createBiquadFilter()
    this.dolbyShelf.type = 'highshelf'
    this.dolbyShelf.frequency.value = 5000

    this.bass = c.createBiquadFilter()
    this.bass.type = 'lowshelf'
    this.bass.frequency.value = 120
    this.treble = c.createBiquadFilter()
    this.treble.type = 'highshelf'
    this.treble.frequency.value = 6000

    // tape stage
    this.tapeIn.connect(this.delay)
    this.delay.connect(this.shaper)
    this.shaper.connect(this.lowpass)
    let tail: AudioNode = this.lowpass
    if (worklet) {
      tail.connect(worklet)
      tail = worklet
    }
    tail.connect(this.tapeEq)
    this.tapeEq.connect(this.dolbyShelf)
    this.dolbyShelf.connect(this.gate)
    this.gate.connect(this.bass)
    // deck stage
    this.deckIn.connect(this.bass)
    this.bass.connect(this.treble)

    // balance: split → per-channel gain → merge
    const split = c.createChannelSplitter(2)
    const merge = c.createChannelMerger(2)
    this.balL = c.createGain()
    this.balR = c.createGain()
    this.treble.connect(split)
    split.connect(this.balL, 0)
    split.connect(this.balR, 1)
    this.balL.connect(merge, 0, 0)
    this.balR.connect(merge, 0, 1)
    merge.connect(this.out)
  }

  /** Apply knob / switch / tape state. Safe to call every frame (uses smoothed param sets). */
  apply(p: ChainParams) {
    const t = this.ctx.currentTime
    const wear = p.wear
    const batt = p.lowBattery ? 2.2 : 1

    if (p.tapeType !== this.lastType) {
      this.shaper.curve = satCurve(DRIVE[p.tapeType] + wear * 0.6)
      this.lastType = p.tapeType
    }
    this.wow.gain.setTargetAtTime((0.00022 + 0.0007 * wear) * batt, t, 0.1)
    this.wow2.gain.setTargetAtTime((0.00014 + 0.0005 * wear) * batt, t, 0.1)
    this.flutter.gain.setTargetAtTime(0.000018 + 0.00004 * wear + (p.lowBattery ? 0.00002 : 0), t, 0.1)

    this.lowpass.frequency.setTargetAtTime(ROLLOFF[p.tapeType] * (1 - 0.62 * wear) * (p.lowBattery ? 0.9 : 1), t, 0.05)
    this.tapeEq.gain.setTargetAtTime(SHELF[p.tapeType], t, 0.05)
    this.dolbyShelf.gain.setTargetAtTime(p.dolby ? -2.5 : 0, t, 0.05)

    if (this.worklet) {
      const prm = this.worklet.parameters
      const hiss = HISS[p.tapeType] * (1 + 1.6 * wear) * (p.dolby ? 0.3 : 1) * p.hissGate
      prm.get('hiss')?.setTargetAtTime(hiss, t, 0.08)
      prm.get('dropout')?.setTargetAtTime((0.05 + 1.6 * wear * wear) * p.hissGate, t, 0.1)
      prm.get('depth')?.setTargetAtTime(0.3 + 0.5 * wear, t, 0.1)
      prm.get('drift')?.setTargetAtTime(0.02 + 0.12 * wear, t, 0.1)
    }

    this.bass.gain.setTargetAtTime(p.bass * 12, t, 0.03)
    this.treble.gain.setTargetAtTime(p.treble * 12, t, 0.03)
    // constant-power-ish balance: centre = both at 1
    const b = p.balance
    this.balL.gain.setTargetAtTime(b > 0 ? 1 - b : 1, t, 0.03)
    this.balR.gain.setTargetAtTime(b < 0 ? 1 + b : 1, t, 0.03)
  }
}
