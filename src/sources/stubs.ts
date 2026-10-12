/**
 * Adapters for later phases. They satisfy the TapeSource interface so the rest of
 * the app can already be written against it, and fail loudly if used too early.
 */
import type { TapeSource } from './types'

abstract class PendingSource implements TapeSource {
  abstract readonly kind: TapeSource['kind']
  abstract readonly supportsEffects: boolean
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  getDuration() {
    return 0
  }
  async load(_ctx: AudioContext): Promise<void> {
    throw new Error(`${this.kind} source is not implemented yet`)
  }
  connect(_dest: AudioNode) {}
  play(_position: number, _direction: 1 | -1) {}
  pause() {}
  seek(_position: number) {}
  setRate(_rate: number) {}
  isPlaying() {
    return false
  }
  dispose() {}
}

/** Phase 4 — live FM/MW/SW stations via the Radio Browser API. */
export class RadioBrowserSource extends PendingSource {
  readonly kind = 'radio' as const
  readonly supportsEffects = true
}
/** Phase 5 — old radio shows, 78s and public-domain film songs. */
export class InternetArchiveSource extends PendingSource {
  readonly kind = 'archive' as const
  readonly supportsEffects = true
}
/** Phase 5 — free Creative-Commons music as "found tapes". */
export class JamendoSource extends PendingSource {
  readonly kind = 'jamendo' as const
  readonly supportsEffects = true
}
/** Phase 8 — Web Playback SDK. DRM: cannot be routed through Web Audio, so the FX chain is bypassed. */
export class SpotifySource extends PendingSource {
  readonly kind = 'spotify' as const
  readonly supportsEffects = false
}
/** Phase 7 — microphone recording / overdub. */
export class MicSource extends PendingSource {
  readonly kind = 'mic' as const
  readonly supportsEffects = true
}
