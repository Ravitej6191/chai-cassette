import { HUB_R, fullPackRadius, type Tape } from './types'

/**
 * Pack radii for a given fraction of the ribbon on the right-hand (take-up) hub.
 * Tape area is conserved: whatever leaves one pack lands on the other.
 */
export function packRadii(tape: Pick<Tape, 'format'>, rightFrac: number) {
  const full = fullPackRadius(tape.format)
  const area = full * full - HUB_R * HUB_R
  const f = Math.min(1, Math.max(0, rightFrac))
  return {
    rR: Math.sqrt(HUB_R * HUB_R + f * area),
    rL: Math.sqrt(HUB_R * HUB_R + (1 - f) * area),
  }
}
