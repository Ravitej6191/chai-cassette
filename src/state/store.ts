import { create } from 'zustand'
import { initialMachine, type MachineState } from './machine'
import type { Placement, Side, Tape } from '../tapes/types'
import type { ZoomPart } from '../layout'

export type TapeType = 0 | 1 | 2 // Normal / Chrome / Metal
export const TAPE_TYPE_NAMES = ['NORMAL', 'CHROME', 'METAL'] as const

export interface Settings {
  /** 0..1 */
  volume: number
  /** -1..1 (±12 dB) */
  bass: number
  treble: number
  /** -1..1 (left … right) */
  balance: number
  /** -1..1 (±12 % speed, centre detent) */
  pitch: number
  dolby: boolean
  tapeType: TapeType
  autoReverse: boolean
  lowBattery: boolean
}

export const defaultSettings: Settings = {
  volume: 0.7,
  bass: 0,
  treble: 0,
  balance: 0,
  pitch: 0,
  dolby: false,
  tapeType: 0,
  autoReverse: false,
  lowBattery: false,
}

export type Quality = 'low' | 'high' | 'ultra'
export type TimeOfDay = 'auto' | 'morning' | 'afternoon' | 'evening' | 'night'

interface UiState {
  quality: Quality
  tod: TimeOfDay
  rain: boolean
  /** Smoothed frames per second, updated once a second. */
  fps: number
  /** When true the app lowers quality by itself if it cannot hold a smooth frame rate. */
  autoQuality: boolean
  help: boolean
  reducedMotion: boolean
  notice: string | null
  hover: string | null
  zoom: ZoomPart | null
  introDone: boolean
  /** 0..1 loading progress for the splash screen. */
  progress: number
  ready: boolean
  audioReady: boolean
  /** True when the loaded source cannot be processed and bypasses the tape FX chain. */
  fxBypass: boolean
  /** Name of the active source adapter, for the HUD. */
  sourceName: string
}

interface DeckStore {
  machine: MachineState
  tapes: Tape[]
  placement: Record<string, Placement>
  heldId: string | null
  /** Id of the tape in the cradle / loaded. */
  deckTapeId: string | null
  /** Side currently under the heads (differs from tape.side after an auto-reverse). */
  playSide: Side
  settings: Settings
  ui: UiState

  setMachine: (m: MachineState) => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  patchTape: (id: string, patch: Partial<Tape>) => void
  addTape: (t: Tape, placement?: Placement) => void
  removeTape: (id: string) => void
  setPlacement: (id: string, p: Placement) => void
  setHeld: (id: string | null) => void
  setDeckTape: (id: string | null) => void
  setPlaySide: (s: Side) => void
  patchUi: (patch: Partial<UiState>) => void
  notify: (msg: string | null) => void
}

const isMobile =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760)

let noticeTimer: ReturnType<typeof setTimeout> | undefined

export const useDeck = create<DeckStore>((set, get) => ({
  machine: initialMachine,
  tapes: [],
  placement: {},
  heldId: null,
  deckTapeId: null,
  playSide: 'A',
  settings: defaultSettings,
  ui: {
    quality: isMobile ? 'low' : 'high',
    tod: 'night',
    rain: true,
    fps: 0,
    autoQuality: true,
    help: !isMobile,
    reducedMotion:
      typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    notice: null,
    hover: null,
    zoom: null,
    introDone: false,
    progress: 0,
    ready: false,
    audioReady: false,
    fxBypass: false,
    sourceName: 'Tape',
  },

  setMachine: (machine) => set({ machine }),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  patchTape: (id, patch) =>
    set((s) => ({ tapes: s.tapes.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  addTape: (t, placement = 'shelf') =>
    set((s) => ({ tapes: [...s.tapes, t], placement: { ...s.placement, [t.id]: placement } })),
  removeTape: (id) =>
    set((s) => {
      const placement = { ...s.placement }
      delete placement[id]
      return { tapes: s.tapes.filter((t) => t.id !== id), placement }
    }),
  setPlacement: (id, p) => set((s) => ({ placement: { ...s.placement, [id]: p } })),
  setHeld: (heldId) => set({ heldId }),
  setDeckTape: (deckTapeId) => set({ deckTapeId }),
  setPlaySide: (playSide) => set({ playSide }),
  patchUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
  notify: (msg) => {
    clearTimeout(noticeTimer)
    set((s) => ({ ui: { ...s.ui, notice: msg } }))
    if (msg) noticeTimer = setTimeout(() => get().notify(null), 3600)
  },
}))
