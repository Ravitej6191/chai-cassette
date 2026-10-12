/** Positions of every control on the deck's front face (deck-local metres, origin at the deck centre). */
import { FRONT_Z } from '../layout'

export const PLATE = { w: 0.84, h: 0.28, t: 0.004 }

export const DL = {
  z: FRONT_Z,
  keys: {
    y: -0.1,
    w: 0.07,
    h: 0.04,
    names: ['REC', 'PLAY', 'REW', 'FF', 'STOP', 'PAUSE'] as const,
    x: (i: number) => -0.19375 + 0.0775 * i,
  },
  knobs: {
    y: -0.03,
    x: [-0.055, 0.01, 0.075, 0.14, 0.205],
    names: ['VOLUME', 'BASS', 'TREBLE', 'BALANCE', 'PITCH'] as const,
  },
  toggles: { y: 0.04, x: [0.03, 0.085, 0.14] },
  slider: { x: 0.205, y: 0.04 },
  counter: { x: -0.045, y: 0.04 },
  reset: { x: 0.0, y: 0.04 },
  vu: { y: 0.112, x: [0.1, 0.19], w: 0.076, h: 0.053 },
  dial: { x: -0.11, y: 0.112, w: 0.14, h: 0.0275 },
  tuning: { x: -0.21, y: 0.112 },
  band: { x: 0.0, y: 0.112 },
  leds: { y: 0.072, x: [0.07, 0.115, 0.16] },
  speaker: { x: 0.335, y: -0.01, r: 0.083 },
}
