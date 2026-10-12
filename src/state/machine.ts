/**
 * Deck state machine — a pure transition table, no side effects.
 * The controller (src/controller) turns accepted transitions into audio, sound and animation.
 *
 * Door/tape bookkeeping lives here too so that EMPTY can mean either
 * "door closed, nothing inside" or "door open, tape (maybe) sitting in the cradle".
 */
export type DeckMode =
  | 'EMPTY'
  | 'LOADED'
  | 'PLAYING'
  | 'PAUSED'
  | 'FF'
  | 'REW'
  | 'CUE'
  | 'REVIEW'
  | 'RECORDING'
  | 'EJECTING'
  | 'CHEWED'

export type KeyName = 'REC' | 'PLAY' | 'REW' | 'FF' | 'STOP' | 'PAUSE'

export interface MachineState {
  mode: DeckMode
  /** Cassette door is open (or opening). */
  doorOpen: boolean
  /** A cassette is in the cradle (door open) or loaded (door closed). */
  hasTape: boolean
  /** What PAUSE interrupted, so a second press resumes it. */
  pausedFrom: 'PLAYING' | 'RECORDING' | null
}

export type DeckEvent =
  | { type: 'PLAY' }
  | { type: 'REC' }
  | { type: 'STOP' }
  | { type: 'PAUSE' }
  | { type: 'FF_DOWN' }
  | { type: 'FF_UP' }
  | { type: 'REW_DOWN' }
  | { type: 'REW_UP' }
  | { type: 'EJECT' }
  | { type: 'EJECT_DONE' }
  | { type: 'INSERT' }
  | { type: 'REMOVE' }
  | { type: 'DOOR_CLOSE' }
  | { type: 'END_OF_TAPE' }
  | { type: 'START_OF_TAPE' }
  | { type: 'CHEW' }

export interface Transition {
  state: MachineState
  /** False when the event was ignored (key pressed but nothing happened). */
  accepted: boolean
}

export const initialMachine: MachineState = {
  mode: 'EMPTY',
  doorOpen: false,
  hasTape: false,
  pausedFrom: null,
}

/** Modes in which tape is (or may be) moving past the heads. */
export const TRANSPORT_MODES: readonly DeckMode[] = [
  'PLAYING', 'PAUSED', 'FF', 'REW', 'CUE', 'REVIEW', 'RECORDING',
]

export const isTransport = (m: DeckMode) => TRANSPORT_MODES.includes(m)

/** Keys that are mechanically latched down in a given state. */
export function keysDown(s: MachineState): KeyName[] {
  switch (s.mode) {
    case 'PLAYING': return ['PLAY']
    case 'RECORDING': return ['REC', 'PLAY']
    case 'PAUSED': return s.pausedFrom === 'RECORDING' ? ['REC', 'PLAY', 'PAUSE'] : ['PLAY', 'PAUSE']
    case 'FF': return ['FF']
    case 'REW': return ['REW']
    case 'CUE': return ['PLAY', 'FF']
    case 'REVIEW': return ['PLAY', 'REW']
    default: return []
  }
}

const ok = (state: MachineState): Transition => ({ state, accepted: true })
const no = (state: MachineState): Transition => ({ state, accepted: false })
const stopped = (s: MachineState): MachineState => ({ ...s, mode: 'LOADED', pausedFrom: null })

export function transition(s: MachineState, ev: DeckEvent): Transition {
  const m = s.mode
  switch (ev.type) {
    case 'INSERT':
      return s.doorOpen && !s.hasTape ? ok({ ...s, hasTape: true }) : no(s)
    case 'REMOVE':
      return s.doorOpen && s.hasTape ? ok({ ...s, hasTape: false }) : no(s)
    case 'DOOR_CLOSE':
      if (!s.doorOpen || m === 'EJECTING') return no(s)
      return ok({ ...s, doorOpen: false, mode: s.hasTape ? 'LOADED' : 'EMPTY' })
    case 'EJECT':
      if (isTransport(m)) return ok(stopped(s)) // first press stops, second ejects
      if (m === 'LOADED' || m === 'CHEWED') return ok({ ...s, mode: 'EJECTING', doorOpen: true, pausedFrom: null })
      if (m === 'EMPTY') {
        // Door open → close it; door closed and empty → open it.
        return s.doorOpen
          ? ok({ ...s, doorOpen: false, mode: s.hasTape ? 'LOADED' : 'EMPTY' })
          : ok({ ...s, mode: 'EJECTING', doorOpen: true })
      }
      return no(s)
    case 'EJECT_DONE':
      return m === 'EJECTING' ? ok({ ...s, mode: 'EMPTY' }) : no(s)
    case 'STOP':
      return isTransport(m) ? ok(stopped(s)) : no(s)
    case 'PLAY':
      if (m === 'LOADED' || m === 'FF' || m === 'REW' || m === 'CUE' || m === 'REVIEW')
        return ok({ ...s, mode: 'PLAYING', pausedFrom: null })
      if (m === 'PAUSED') return ok({ ...s, mode: s.pausedFrom ?? 'PLAYING', pausedFrom: null })
      return no(s)
    case 'REC':
      if (m === 'PLAYING') return ok({ ...s, mode: 'RECORDING' })
      if (m === 'PAUSED' && s.pausedFrom === 'PLAYING') return ok({ ...s, pausedFrom: 'RECORDING' })
      return no(s)
    case 'PAUSE':
      if (m === 'PLAYING' || m === 'RECORDING') return ok({ ...s, mode: 'PAUSED', pausedFrom: m })
      if (m === 'PAUSED') return ok({ ...s, mode: s.pausedFrom ?? 'PLAYING', pausedFrom: null })
      return no(s)
    case 'FF_DOWN':
      if (m === 'PLAYING') return ok({ ...s, mode: 'CUE' })
      if (m === 'LOADED' || m === 'PAUSED' || m === 'REW' || m === 'REVIEW')
        return ok({ ...s, mode: 'FF', pausedFrom: null })
      return no(s)
    case 'REW_DOWN':
      if (m === 'PLAYING') return ok({ ...s, mode: 'REVIEW' })
      if (m === 'LOADED' || m === 'PAUSED' || m === 'FF' || m === 'CUE')
        return ok({ ...s, mode: 'REW', pausedFrom: null })
      return no(s)
    // Cue / review are momentary: releasing the key drops back to PLAY.
    case 'FF_UP':
      return m === 'CUE' ? ok({ ...s, mode: 'PLAYING' }) : no(s)
    case 'REW_UP':
      return m === 'REVIEW' ? ok({ ...s, mode: 'PLAYING' }) : no(s)
    case 'END_OF_TAPE':
    case 'START_OF_TAPE':
      return isTransport(m) ? ok(stopped(s)) : no(s)
    case 'CHEW':
      return isTransport(m) ? ok({ ...s, mode: 'CHEWED', pausedFrom: null }) : no(s)
  }
}
