/**
 * Source adapter interface. Every audio origin (local file, radio stream, Internet
 * Archive item, Jamendo track, Spotify, microphone…) implements this so the deck
 * never needs to know where sound comes from.
 *
 * The deck owns the transport clock; adapters just render audio at the speed and
 * direction the motor asks for.
 */
export interface TapeSource {
  readonly id: string
  readonly kind: 'local' | 'radio' | 'archive' | 'jamendo' | 'spotify' | 'mic'
  readonly label: string
  /** False for DRM / remote streams that cannot be routed through the Web Audio FX chain. */
  readonly supportsEffects: boolean
  /** Duration in seconds (0 for blank or live sources). */
  getDuration(): number
  /** Prepare the source (decode, fetch, connect). */
  load(ctx: AudioContext): Promise<void>
  /** Route output into `dest` (the effects chain input, or the master bus when bypassing). */
  connect(dest: AudioNode): void
  /** Start producing audio from `position` seconds in the given direction (1 forward, -1 reverse). */
  play(position: number, direction: 1 | -1): void
  pause(): void
  seek(position: number): void
  /** Change playback speed while playing (always positive; direction is set by play()). */
  setRate(rate: number): void
  isPlaying(): boolean
  dispose(): void
}

/** Where tape programme sits relative to the physical tape. */
export interface SideProgramme {
  source: TapeSource | null
  /** Seconds of programme before auto-stop would trip. */
  contentEnd: number
}
