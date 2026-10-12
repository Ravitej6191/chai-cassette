/**
 * tape-degrade — an AudioWorklet that adds the "physical tape" imperfections
 * that are awkward to build from stock nodes:
 *   - random dropouts (oxide shedding: short gain dips with smooth edges)
 *   - stereo drift (slowly wandering L/R balance, like a mis-aligned head azimuth)
 *   - tape hiss (high-passed noise, level set by tape type / wear / Dolby)
 *
 * Parameters (all k-rate):
 *   hiss     0..1   noise amplitude
 *   dropout  0..20  expected dropout events per second
 *   depth    0..1   how deep a dropout cuts the signal
 *   drift    0..0.5 amplitude of the stereo gain wander
 *
 * Works with or without an input connection so hiss keeps running over silence.
 */
class TapeDegrade extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'hiss', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'dropout', defaultValue: 0, minValue: 0, maxValue: 20, automationRate: 'k-rate' },
      { name: 'depth', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'drift', defaultValue: 0, minValue: 0, maxValue: 0.5, automationRate: 'k-rate' },
    ]
  }

  constructor() {
    super()
    this.dropGain = 1
    this.dropTarget = 1
    this.holdSamples = 0
    this.t = 0
    this.nPrevL = 0
    this.nPrevR = 0
    this.phaseA = Math.random() * 6.28
    this.phaseB = Math.random() * 6.28
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0]
    const input = inputs[0]
    const hiss = parameters.hiss[0]
    const rate = parameters.dropout[0]
    const depth = parameters.depth[0]
    const drift = parameters.drift[0]
    const n = out[0].length
    const pDrop = rate / sampleRate
    const dt = 1 / sampleRate
    const inL = input && input[0]
    const inR = input && (input[1] || input[0])

    for (let i = 0; i < n; i++) {
      // --- dropouts -------------------------------------------------------
      if (this.holdSamples > 0) {
        this.holdSamples--
        if (this.holdSamples === 0) this.dropTarget = 1
      } else if (pDrop > 0 && Math.random() < pDrop) {
        this.dropTarget = 1 - depth * (0.4 + Math.random() * 0.6)
        this.holdSamples = ((0.015 + Math.random() * 0.1) * sampleRate) | 0
      }
      this.dropGain += (this.dropTarget - this.dropGain) * 0.004

      // --- stereo drift ---------------------------------------------------
      this.t += dt
      const gl = 1 + drift * Math.sin(6.2832 * 0.071 * this.t + this.phaseA)
      const gr = 1 + drift * Math.sin(6.2832 * 0.053 * this.t + this.phaseB)

      // --- hiss (differentiated white noise ≈ bright, like real tape) ----
      const nl = Math.random() * 2 - 1
      const nr = Math.random() * 2 - 1
      const hl = (nl - this.nPrevL * 0.9) * hiss
      const hr = (nr - this.nPrevR * 0.9) * hiss
      this.nPrevL = nl
      this.nPrevR = nr

      const sl = inL ? inL[i] : 0
      const sr = inR ? inR[i] : 0
      out[0][i] = sl * this.dropGain * gl + hl
      if (out[1]) out[1][i] = sr * this.dropGain * gr + hr
    }
    return true
  }
}

registerProcessor('tape-degrade', TapeDegrade)
