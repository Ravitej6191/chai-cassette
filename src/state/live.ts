/**
 * Fast-changing values read every frame by meshes. Kept outside React/zustand on
 * purpose: writing these must never trigger a re-render.
 */
export const live = {
  /** Position on the playing side, seconds. */
  pos: 0,
  /** Signed tape speed multiplier actually applied (1 = normal play speed). */
  rate: 0,
  /** Fraction of ribbon on the viewer-right (take-up) hub. */
  rightFrac: 0,
  rL: 0.0095,
  rR: 0.0095,
  angL: 0,
  angR: 0,
  capstanAngle: 0,
  /** Right-hub revolutions accumulated — the tape counter reads this. */
  counterRev: 0,
  /** Needle targets 0..1 and the analyser peak (0..1). */
  vuL: 0,
  vuR: 0,
  peakL: 0,
  peakR: 0,
  /** Speaker cone excursion 0..1. */
  cone: 0,
  /** Time (ctx seconds) until which the clip LED stays lit. */
  clipUntil: 0,
  /** 0..1 how much the motor is running (hum, vibration). */
  motor: 0,
}

/** Mechanical animation state shared between the controller (writes) and meshes (read). */
export const anim = {
  /** 0 = closed, 1 = fully open. */
  door: 0,
  keys: { REC: 0, PLAY: 0, REW: 0, FF: 0, STOP: 0, PAUSE: 0 } as Record<string, number>,
  /** Cassette flip animation helper while in hand. */
  shake: 0,
}
