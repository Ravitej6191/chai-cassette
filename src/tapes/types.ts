/** Tape data model. Audio buffers live outside the store (see sources/library.ts). */

export type TapeFormat = 'C30' | 'C46' | 'C60' | 'C90' | 'C120'
export type Side = 'A' | 'B'
export type HandFont = 'Caveat' | 'Reenie Beanie' | 'Nanum Pen Script' | 'Special Elite'

export interface TapeFormatSpec {
  /** Minutes per side. */
  sideMin: number
  /** Tape thickness in metres (thinner for longer tapes). */
  thickness: number
}

/** Real cassette formats. Tape speed is the standard 4.76 cm/s. */
export const FORMATS: Record<TapeFormat, TapeFormatSpec> = {
  C30: { sideMin: 15, thickness: 22e-6 },
  C46: { sideMin: 23, thickness: 18e-6 },
  C60: { sideMin: 30, thickness: 14e-6 },
  C90: { sideMin: 45, thickness: 10e-6 },
  C120: { sideMin: 60, thickness: 7.5e-6 },
}
export const TAPE_SPEED = 0.0476 // m/s
export const HUB_R = 0.0095
export const sideSeconds = (f: TapeFormat) => FORMATS[f].sideMin * 60
/** Total ribbon length in metres. */
export const ribbonLength = (f: TapeFormat) => TAPE_SPEED * sideSeconds(f)
/** Radius of a pack holding the whole ribbon. */
export const fullPackRadius = (f: TapeFormat) =>
  Math.sqrt(HUB_R * HUB_R + (FORMATS[f].thickness * ribbonLength(f)) / Math.PI)

export interface SideInfo {
  title: string
  /** Seconds of programme on this side; 0 = blank side. */
  duration: number
}

export interface Tape {
  id: string
  title: string
  artist: string
  brand: string
  format: TapeFormat
  /** CSS colour of the translucent shell. */
  shellColor: string
  labelColor: string
  stripeColor: string
  ink: string
  font: HandFont
  /** 0 = mint, 1 = thrashed. Drives HF rolloff, dropouts and flutter. */
  wear: number
  plays: number
  /** Which label faces the viewer. */
  side: Side
  /** Fraction of ribbon on the cassette-A take-up hub (0 = start of side A, 1 = end). */
  wound: number
  sides: Record<Side, SideInfo>
  /** Slot in the rack, or -1 when stowed. */
  slot: number
  isDemo?: boolean
}

export type Placement = 'shelf' | 'held' | 'cradle' | 'loaded'
