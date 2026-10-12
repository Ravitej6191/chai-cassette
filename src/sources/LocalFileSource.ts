import type { TapeSource } from './types'

/** Decode without needing a running (user-gesture-gated) AudioContext. */
export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const data = await blob.arrayBuffer()
  const offline = new OfflineAudioContext(2, 1, 44100)
  return offline.decodeAudioData(data)
}

function reversed(buf: AudioBuffer): AudioBuffer {
  const out = new AudioBuffer({
    length: buf.length,
    numberOfChannels: buf.numberOfChannels,
    sampleRate: buf.sampleRate,
  })
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i]
  }
  return out
}

/**
 * Plays a decoded AudioBuffer (from a dropped MP3/WAV or the synthesised demo tape).
 * Reverse play (REW audible / review) uses a lazily-built reversed copy.
 */
export class LocalFileSource implements TapeSource {
  readonly kind = 'local' as const
  readonly supportsEffects = true
  private ctx: AudioContext | null = null
  private out: AudioNode | null = null
  private node: AudioBufferSourceNode | null = null
  private rev: AudioBuffer | null = null
  private rate = 1
  private playing = false

  constructor(
    readonly id: string,
    readonly label: string,
    private buffer: AudioBuffer,
  ) {}

  getDuration() {
    return this.buffer.duration
  }

  async load(ctx: AudioContext) {
    this.ctx = ctx
  }

  connect(dest: AudioNode) {
    this.out = dest
  }

  play(position: number, direction: 1 | -1) {
    if (!this.ctx || !this.out) return
    this.stopNode()
    const dur = this.buffer.duration
    const node = this.ctx.createBufferSource()
    let offset: number
    if (direction === 1) {
      node.buffer = this.buffer
      offset = position
    } else {
      this.rev ??= reversed(this.buffer)
      node.buffer = this.rev
      offset = dur - position
    }
    if (offset < 0 || offset >= dur) return // outside the programme: silence
    node.playbackRate.value = this.rate
    node.connect(this.out)
    node.start(0, offset)
    this.node = node
    this.playing = true
    node.onended = () => {
      if (this.node === node) {
        this.node = null
        this.playing = false
      }
    }
  }

  private stopNode() {
    if (!this.node) return
    this.node.onended = null
    try {
      this.node.stop()
    } catch {
      /* already stopped */
    }
    this.node.disconnect()
    this.node = null
    this.playing = false
  }

  pause() {
    this.stopNode()
  }

  seek(_position: number) {
    // The deck restarts the node with play(position, dir); nothing to hold here.
  }

  setRate(rate: number) {
    this.rate = Math.max(0.01, rate)
    if (this.node && this.ctx) this.node.playbackRate.setTargetAtTime(this.rate, this.ctx.currentTime, 0.015)
  }

  isPlaying() {
    return this.playing
  }

  dispose() {
    this.stopNode()
    this.rev = null
  }
}
