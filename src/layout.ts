/**
 * Shared world-space layout (metres, y up, z toward the viewer).
 * Everything that needs to agree on where things sit — the deck, the cassette
 * placements, the camera zoom targets — reads from here.
 */
import { Euler, Quaternion, Vector3 } from 'three'

export const TABLE_TOP = 0.76
export const ROOM = { w: 4.4, d: 4.6, h: 2.8, backZ: -0.9 }

/** Deck body dimensions and where it sits on the table. */
export const DECK = { W: 0.86, H: 0.3, D: 0.26 }
export const DECK_POS = new Vector3(0, TABLE_TOP + 0.003 + DECK.H / 2, -0.15)
export const FRONT_Z = DECK.D / 2

/** Cassette compartment (deck-local coordinates). */
export const CAVITY = { x: -0.169, y: 0, w: 0.122, h: 0.092, backZ: FRONT_Z - 0.025 }
/** Cassette sits slightly high in the cavity, leaving room for the head block underneath. */
export const CASSETTE = { w: 0.1022, h: 0.064, t: 0.012, hubDx: 0.024, hubDy: 0.002 }
export const LOADED_LOCAL = new Vector3(CAVITY.x, 0.008, CAVITY.backZ + 0.0085)
export const CRADLE_LOCAL = new Vector3(CAVITY.x, 0.022, CAVITY.backZ + 0.058)

export const RACK_POS = new Vector3(-0.68, TABLE_TOP, -0.3)
export const RACK = { cols: 4, tiers: 3, colPitch: 0.108, tierPitch: 0.075, tilt: -0.24 }
export const RACK_SLOTS = RACK.cols * RACK.tiers

export interface Pose {
  pos: Vector3
  quat: Quaternion
  scale: number
}

const q = (x: number, y = 0, z = 0) => new Quaternion().setFromEuler(new Euler(x, y, z))

/** World pose of a rack slot (cassette standing in the tray, leaning back). */
export function slotPose(slot: number): Pose {
  const tier = Math.floor(slot / RACK.cols)
  const col = slot % RACK.cols
  const pos = new Vector3(
    RACK_POS.x + (col - (RACK.cols - 1) / 2) * RACK.colPitch,
    RACK_POS.y + 0.042 + tier * RACK.tierPitch,
    RACK_POS.z + 0.075 - tier * 0.035,
  )
  return { pos, quat: q(RACK.tilt), scale: 1 }
}

export function loadedPose(side: 'A' | 'B'): Pose {
  return { pos: DECK_POS.clone().add(LOADED_LOCAL), quat: q(0, side === 'B' ? Math.PI : 0), scale: 1 }
}

export function cradlePose(side: 'A' | 'B'): Pose {
  return { pos: DECK_POS.clone().add(CRADLE_LOCAL), quat: q(0.3, side === 'B' ? Math.PI : 0), scale: 1 }
}

/** Where a picked-up tape hovers, in front of the deck. */
export const HELD_POS = new Vector3(-0.02, 0.95, 0.52)
export const HELD_SCALE = 2.2

/** Deck-local → world helper. */
export const deckWorld = (x: number, y: number, z: number) => new Vector3(x, y, z).add(DECK_POS)

export const DEFAULT_CAM = {
  pos: new Vector3(0.2, 1.38, 1.9),
  target: new Vector3(-0.1, 1.05, -0.2),
}

export type ZoomPart = 'tape' | 'vu' | 'keys' | 'knobs' | 'switches' | 'counter' | 'radio' | 'speaker' | 'rack' | 'chai'

/** Camera zoom framings per touchable part (deck-local focus + viewing distance). */
export const ZOOM_PARTS: Record<ZoomPart, { local: [number, number, number]; dist: number }> = {
  tape: { local: [CAVITY.x, 0.0, FRONT_Z], dist: 0.34 },
  vu: { local: [0.145, 0.115, FRONT_Z], dist: 0.3 },
  keys: { local: [0, -0.1, FRONT_Z], dist: 0.42 },
  knobs: { local: [0.07, -0.03, FRONT_Z], dist: 0.34 },
  switches: { local: [0.1, 0.045, FRONT_Z], dist: 0.32 },
  counter: { local: [-0.04, 0.045, FRONT_Z], dist: 0.26 },
  radio: { local: [-0.1, 0.115, FRONT_Z], dist: 0.34 },
  speaker: { local: [-0.335, -0.01, FRONT_Z], dist: 0.4 },
  rack: { local: [0, 0, 0], dist: 0.7 },
  chai: { local: [0, 0, 0], dist: 0.5 },
}

/** A big window right behind the table, like a desk by the glass. */
export const WINDOW = { x: 0.15, y: 1.62, w: 2.1, h: 1.45 }
export const CHAI_POS = new Vector3(0.62, TABLE_TOP, 0.1)
export const LAMP_POS = new Vector3(0.84, TABLE_TOP, -0.34)
export const FAN_POS = new Vector3(0, 2.2, -0.1)
export const CALENDAR_POS = new Vector3(-1.72, 2.12, ROOM.backZ + 0.01)
