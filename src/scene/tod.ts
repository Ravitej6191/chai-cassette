/**
 * Time-of-day presets. The lighting component eases `tod.cur` toward the active
 * preset every frame, so switching (or the clock rolling over) is a smooth fade.
 */
import type { TimeOfDay } from '../state/store'

export type TodName = Exclude<TimeOfDay, 'auto'>

export interface Preset {
  ambient: number
  ambientColor: string
  /** Table lamp spot + fill intensity. */
  lamp: number
  /** Light coming through the window. */
  windowColor: string
  windowIntensity: number
  /** Dim ceiling light that casts the rotating fan shadow. */
  fan: number
  env: number
  /** 0 = night city, 1 = daylight sky in the window. */
  daylight: number
  background: string
  exposure: number
}

export const PRESETS: Record<TodName, Preset> = {
  night: {
    ambient: 0.3, ambientColor: '#6678b8', lamp: 1, windowColor: '#8ea6cc', windowIntensity: 3.6,
    fan: 1, env: 0.45, daylight: 0, background: '#07070c', exposure: 1,
  },
  evening: {
    ambient: 0.22, ambientColor: '#c9906a', lamp: 0.75, windowColor: '#ec8f4f', windowIntensity: 3.2,
    fan: 0.5, env: 0.38, daylight: 0.35, background: '#1a0f10', exposure: 1,
  },
  afternoon: {
    ambient: 0.5, ambientColor: '#fff0d8', lamp: 0, windowColor: '#fff3e0', windowIntensity: 8,
    fan: 0.15, env: 0.9, daylight: 1, background: '#9db4cc', exposure: 0.9,
  },
  morning: {
    ambient: 0.4, ambientColor: '#dde8ff', lamp: 0, windowColor: '#cfe2ff', windowIntensity: 6,
    fan: 0.15, env: 0.75, daylight: 0.9, background: '#a9c0dc', exposure: 0.95,
  },
}

export function resolveTod(mode: TimeOfDay, now = new Date()): TodName {
  if (mode !== 'auto') return mode
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 5.5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'afternoon'
  if (h >= 17 && h < 19.5) return 'evening'
  return 'night'
}

/** Live, smoothly-interpolated values read by lights and materials. */
export const tod = {
  cur: { ...PRESETS.night } as Preset,
}
