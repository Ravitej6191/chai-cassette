/**
 * Deck controller — the glue between the pure state machine, the audio engine, the
 * synthesised sound effects and the mechanical animation values the meshes read.
 *
 *   UI event ──► dispatch() ──► machine.transition() ──► side effects
 *                                   (pure)              keys · door · sfx · audio · tape bookkeeping
 *   every frame ──► tick(dt) ──► engine.update() ──► reel radii / angles / counter
 */
import gsap from 'gsap'
import { Vector3 } from 'three'
import { engine, type Boundary } from '../audio/AudioEngine'
import { sfx, motorSound, rainSound } from '../sfx/sfx'
import { anim, live } from '../state/live'
import { isTransport, keysDown, transition, type DeckEvent, type KeyName } from '../state/machine'
import { useDeck } from '../state/store'
import { sourceFor, putProgramme, dropProgramme, warmProgramme } from '../sources/library'
import { decodeBlob } from '../sources/LocalFileSource'
import { generateTape } from '../tapes/generator'
import { DEMO_SECONDS, FOUND_TAPES, synthesiseFound, synthesiseSide } from '../tapes/demoTape'
import { forgetTape, loadSavedTapes, loadWear, saveTape, saveWear } from '../tapes/persistence'
import { HUB_R, TAPE_SPEED, fullPackRadius, sideSeconds, type Side, type Tape } from '../tapes/types'
import { RACK_SLOTS } from '../layout'

const store = () => useDeck.getState()

/** State of the tape being held in the hand (shared with the 3D drag handler). */
export const held = { yaw: 0, tilt: 0, dragTarget: null as Vector3 | null }

// ------------------------------------------------------------------ helpers

/** Run once audio is ready (first gesture creates the context asynchronously). */
function whenAudio(fn: () => void) {
  if (engine.ready) fn()
  else void engine.init().then(fn).catch(() => {})
}

export const getDeckTape = (): Tape | undefined => {
  const s = store()
  return s.tapes.find((t) => t.id === s.deckTapeId)
}

const wearOf = (t: Tape) => Math.min(1, t.wear + Math.min(0.3, t.plays * 0.01))
const contentEndFor = (t: Tape, side: Side) => {
  const L = sideSeconds(t.format)
  const d = t.sides[side].duration
  return Math.min(L, d > 0 ? d + 3 : 14)
}

/** Fraction of ribbon on the A-frame take-up hub given a position on `side`. */
const woundFrom = (pos: number, side: Side, L: number) => (side === 'A' ? pos / L : 1 - pos / L)
const posFrom = (w: number, side: Side, L: number) => (side === 'A' ? w : 1 - w) * L

// ------------------------------------------------------------------ keys

function tweenKey(k: string, to: number, dur: number, ease = 'power2.out') {
  gsap.to(anim.keys, { [k]: to, duration: dur, ease, overwrite: 'auto' })
}

function tapKey(k: string) {
  gsap.timeline({ overwrite: 'auto' })
    .to(anim.keys, { [k]: 1, duration: 0.06, ease: 'power2.out' })
    .to(anim.keys, { [k]: 0, duration: 0.2, ease: 'back.out(3)' })
}

function syncKeys(prevDown: KeyName[], nextDown: KeyName[], ev: DeckEvent) {
  const all: KeyName[] = ['REC', 'PLAY', 'REW', 'FF', 'PAUSE']
  for (const k of all) {
    const was = prevDown.includes(k)
    const now = nextDown.includes(k)
    if (now && !was) tweenKey(k, 1, 0.08)
    else if (!now && was) tweenKey(k, 0, 0.16, 'back.out(2.5)')
  }
  const released = prevDown.filter((k) => !nextDown.includes(k))
  const pressed = nextDown.filter((k) => !prevDown.includes(k))
  switch (ev.type) {
    case 'PLAY':
    case 'REC':
    case 'PAUSE':
    case 'FF_DOWN':
    case 'REW_DOWN':
      if (pressed.length) whenAudio(sfx.keyLatch)
      else whenAudio(sfx.keyDown)
      if (released.length && (ev.type === 'PLAY' || ev.type === 'FF_DOWN' || ev.type === 'REW_DOWN')) whenAudio(sfx.keyUp)
      break
    case 'STOP':
    case 'EJECT':
      tapKey('STOP')
      whenAudio(released.length ? sfx.stopClack : sfx.keyDown)
      break
    case 'FF_UP':
    case 'REW_UP':
      whenAudio(sfx.keyUp)
      break
  }
}

/**
 * Physical key press from the UI. `down` presses, `up` releases (only meaningful for
 * the momentary cue/review behaviour of FF/REW).
 */
export function pressKey(key: KeyName, phase: 'down' | 'up' = 'down') {
  void engine.resume()
  if (phase === 'up') {
    if (key === 'FF') dispatch({ type: 'FF_UP' })
    if (key === 'REW') dispatch({ type: 'REW_UP' })
    return
  }
  if (key === 'REC') {
    // Microphone recording is a later phase. Do not latch a record state that records nothing.
    tapKey('REC')
    whenAudio(sfx.reject)
    store().notify('Recording is not built yet — it arrives with the microphone phase.')
    return
  }
  const ev: DeckEvent =
    key === 'PLAY' ? { type: 'PLAY' }
    : key === 'PAUSE' ? { type: 'PAUSE' }
    : key === 'FF' ? { type: 'FF_DOWN' }
    : key === 'REW' ? { type: 'REW_DOWN' }
    : { type: 'EJECT' }
  if (!dispatch(ev)) {
    // The key travels but nothing latches — like pressing REC with no PLAY engaged.
    tapKey(key)
    whenAudio(sfx.reject)
    const m = store().machine
    if (key === 'PLAY' && !m.hasTape) store().notify('No tape in the deck — drag a cassette in, or press L to load one.')
  }
}

/** Space: play / pause toggle. */
export function playPause() {
  const m = store().machine.mode
  if (m === 'PLAYING' || m === 'RECORDING' || m === 'PAUSED') pressKey('PAUSE')
  else pressKey('PLAY')
}

// ------------------------------------------------------------------ door

let doorTween: gsap.core.Timeline | null = null

function openDoor(): Promise<void> {
  return new Promise((resolve) => {
    doorTween?.kill()
    whenAudio(sfx.doorSpring)
    doorTween = gsap.timeline({ onComplete: resolve })
    // springs open fast, overshoots a touch and settles with damping
    doorTween.to(anim, { door: 1, duration: 1.0, ease: 'elastic.out(1, 0.5)' })
    gsap.delayedCall(0.2, () => whenAudio(() => sfx.doorBounce(1)))
    gsap.delayedCall(0.38, () => whenAudio(() => sfx.doorBounce(0.6)))
    gsap.delayedCall(0.55, () => whenAudio(() => sfx.doorBounce(0.35)))
  })
}

function closeDoor(): Promise<void> {
  return new Promise((resolve) => {
    doorTween?.kill()
    doorTween = gsap.timeline({
      onComplete: () => {
        whenAudio(sfx.doorLatch)
        resolve()
      },
    })
    doorTween.to(anim, { door: 0, duration: 0.5, ease: 'power3.in' })
  })
}


// ------------------------------------------------------------------ dispatch

export function dispatch(ev: DeckEvent): boolean {
  const s = store()
  const prev = s.machine
  const { state: next, accepted } = transition(prev, ev)
  if (!accepted) return false

  s.setMachine(next)
  engine.setMode(next.mode)
  syncKeys(keysDown(prev), keysDown(next), ev)

  // Tape stopped → remember where the ribbon is.
  if (isTransport(prev.mode) && !isTransport(next.mode)) {
    commitWound()
    if (ev.type === 'END_OF_TAPE' || ev.type === 'START_OF_TAPE') {
      whenAudio(sfx.autoStop)
      for (const k of ['PLAY', 'REC', 'FF', 'REW', 'PAUSE'] as const) tweenKey(k, 0, 0.16, 'back.out(2.5)')
    }
  }

  // Door opening with a tape inside: tape pops into the cradle.
  if (!prev.doorOpen && next.doorOpen) {
    const t = getDeckTape()
    if (t) {
      engine.setSource(null, { length: sideSeconds(t.format), contentEnd: 0 }, 0, 0)
      s.setPlacement(t.id, 'cradle')
      gsap.delayedCall(0.12, () => whenAudio(sfx.tapePop))
    }
    void openDoor().then(() => dispatch({ type: 'EJECT_DONE' }))
  }
  // Door closing: seat the tape and bring the audio side up.
  if (prev.doorOpen && !next.doorOpen) {
    void closeDoor()
    if (next.hasTape && s.deckTapeId) {
      s.setPlacement(s.deckTapeId, 'loaded')
      gsap.delayedCall(0.25, () => whenAudio(sfx.tapeInsert))
      void attachSide(getDeckTape()?.side ?? 'A')
    }
  }
  return true
}

/** Store the ribbon position into the tape so it resumes where it stopped. */
function commitWound() {
  const t = getDeckTape()
  if (!t) return
  const L = sideSeconds(t.format)
  const w = Math.min(1, Math.max(0, woundFrom(engine.pos, store().playSide, L)))
  store().patchTape(t.id, { wound: w })
  void saveWear({ ...t, wound: w })
}

/** Point the engine at the programme on `side` (blank sides play hiss only). */
let attachToken = 0
async function attachSide(side: Side, startPos?: number) {
  const s = store()
  const t = getDeckTape()
  if (!t) return
  const token = ++attachToken
  s.setPlaySide(side)
  const L = sideSeconds(t.format)
  const info = { length: L, contentEnd: contentEndFor(t, side) }
  const pos = startPos ?? posFrom(t.wound, side, L)
  engine.setSource(null, info, pos, wearOf(t))
  try {
    await engine.init()
    const src = await sourceFor(t.id, side, t.sides[side].title || t.title)
    if (token !== attachToken) return
    engine.setSource(src, info, engine.pos, wearOf(t))
    store().patchUi({ fxBypass: !!src && !src.supportsEffects, sourceName: src ? src.kind.toUpperCase() : 'BLANK' })
  } catch (err) {
    console.warn('Could not prepare tape side', err)
    store().notify('That audio file could not be decoded.')
  }
}

// ------------------------------------------------------------------ boundaries

engine.onBoundary = (b: Boundary) => {
  const s = store()
  const mode = s.machine.mode
  const t = getDeckTape()
  if (!t) return
  if (b === 'start') {
    dispatch({ type: 'START_OF_TAPE' })
    return
  }
  const playing = mode === 'PLAYING' || mode === 'RECORDING'
  if (engine.isRunout && b === 'ribbonEnd') {
    // End of the ribbon during auto-reverse: head flips and the other side plays on.
    engine.endRunout()
    sfx.headFlip()
    void attachSide(s.playSide === 'A' ? 'B' : 'A', 0)
    return
  }
  if (b === 'contentEnd' && playing && s.settings.autoReverse && s.playSide === t.side) {
    engine.beginRunout()
    return
  }
  if (playing && b === 'contentEnd') {
    const plays = t.plays + 1
    s.patchTape(t.id, { plays })
    void saveWear({ ...t, plays })
  }
  dispatch({ type: 'END_OF_TAPE' })
}

// ------------------------------------------------------------------ eject / door keys

/** E key / STOP-EJECT key. */
export function eject() {
  pressKey('STOP')
}

/** Click on the cassette door itself: open it, or push it shut. */
export function doorClick() {
  void engine.resume()
  const m = store().machine
  if (m.doorOpen) {
    if (m.mode === 'EMPTY') pressKey('STOP')
  } else if (!isTransport(m.mode)) pressKey('STOP')
  else store().notify('Press STOP first, then eject.')
}

// ------------------------------------------------------------------ tape handling

function freeSlot(): number {
  const used = new Set(store().tapes.filter((t) => t.slot >= 0).map((t) => t.slot))
  for (let i = 0; i < RACK_SLOTS; i++) if (!used.has(i)) return i
  return -1
}

export function pickUp(id: string) {
  const s = store()
  if (s.heldId && s.heldId !== id) return
  const place = s.placement[id]
  if (place === 'cradle') {
    if (!dispatch({ type: 'REMOVE' })) return
    s.setDeckTape(null)
  } else if (place !== 'shelf') return
  held.yaw = 0
  held.tilt = 0
  held.dragTarget = null
  s.setPlacement(id, 'held')
  s.setHeld(id)
  whenAudio(sfx.tapeHandle)
}

export function putBack() {
  const s = store()
  const id = s.heldId
  if (!id) return
  const t = s.tapes.find((x) => x.id === id)
  if (!t) return
  if (t.slot < 0) s.patchTape(id, { slot: freeSlot() })
  s.setPlacement(id, 'shelf')
  s.setHeld(null)
  held.dragTarget = null
  whenAudio(sfx.tapeHandle)
}

export function flipHeld() {
  const s = store()
  const t = s.tapes.find((x) => x.id === s.heldId)
  if (!t) return
  s.patchTape(t.id, { side: t.side === 'A' ? 'B' : 'A' })
  held.yaw = 0
  whenAudio(sfx.tapeHandle)
}

/** Drop the held tape toward the deck: opens the door if needed, then seats it. */
export async function insertHeld(): Promise<boolean> {
  const s = store()
  const id = s.heldId
  if (!id) return false
  if (s.machine.hasTape) {
    s.notify('There is already a tape in the deck — eject it first (E).')
    return false
  }
  if (isTransport(s.machine.mode) || s.machine.mode === 'EJECTING') return false
  if (!s.machine.doorOpen) {
    dispatch({ type: 'EJECT' })
  }
  // the door must have finished springing open (EJECTING → EMPTY) before a tape can drop in
  await waitFor(() => store().machine.mode === 'EMPTY' && store().machine.doorOpen)
  if (!dispatch({ type: 'INSERT' })) return false
  held.yaw = 0
  s.setHeld(null)
  s.setDeckTape(id)
  s.setPlacement(id, 'cradle')
  whenAudio(sfx.tapeInsert)
  await sleep(750)
  await waitFor(() => store().machine.mode === 'EMPTY')
  dispatch({ type: 'EJECT' }) // door closes: EMPTY + door open → latches shut
  return true
}

/** Keyboard / HUD path: load a tape without dragging (handles eject-first). */
export async function loadTape(id: string) {
  void engine.resume()
  const s = store()
  if (s.heldId === id) {
    await insertHeld()
    return
  }
  if (s.heldId) putBack()
  if (s.deckTapeId === id && s.machine.hasTape) return
  if (isTransport(s.machine.mode)) dispatch({ type: 'STOP' })
  if (store().machine.hasTape) {
    dispatch({ type: 'EJECT' })
    await waitFor(() => store().machine.mode === 'EMPTY')
    const out = store().deckTapeId
    if (out) {
      dispatch({ type: 'REMOVE' })
      store().setDeckTape(null)
      store().setPlacement(out, 'shelf')
      await sleep(350)
    }
  } else if (!store().machine.doorOpen) {
    dispatch({ type: 'EJECT' })
    await waitFor(() => store().machine.mode === 'EMPTY')
  }
  // never drop a tape into a door that is still springing open
  await waitFor(() => store().machine.mode === 'EMPTY' && store().machine.doorOpen)
  if (store().machine.mode !== 'EMPTY' || !dispatch({ type: 'INSERT' })) return
  store().setDeckTape(id)
  store().setPlacement(id, 'cradle')
  whenAudio(sfx.tapeInsert)
  await sleep(750)
  await waitFor(() => store().machine.mode === 'EMPTY') // the door must be fully open before it can be pushed shut
  dispatch({ type: 'EJECT' })
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
async function waitFor(cond: () => boolean, timeout = 60000) {
  const t0 = performance.now()
  while (!cond() && performance.now() - t0 < timeout) await sleep(30)
}

// ------------------------------------------------------------------ settings

export function setSetting<K extends keyof ReturnType<typeof store>['settings']>(
  key: K,
  value: ReturnType<typeof store>['settings'][K],
) {
  store().setSetting(key, value)
}

export function resetCounter() {
  live.counterRev = 0
  whenAudio(sfx.counterReset)
}

// ------------------------------------------------------------------ files

const AUDIO_RE = /\.(mp3|wav|wave|m4a|aac|ogg|oga|opus|flac|webm)$/i

export async function addFiles(files: File[]) {
  const audio = files.filter((f) => f.type.startsWith('audio/') || AUDIO_RE.test(f.name))
  if (!audio.length) {
    store().notify('Drop an MP3 or WAV file to make a tape.')
    return
  }
  void engine.resume()
  for (const file of audio.slice(0, 6)) {
    try {
      store().notify(`Winding a tape for “${file.name}”…`)
      const buffer = await decodeBlob(file)
      const s = store()
      let slot = freeSlot()
      if (slot < 0) {
        // Rack full: the oldest dropped tape makes room.
        // make room by retiring a mix tape first, then the oldest dropped one; never the demo
        const retire = (t: Tape) => t.id !== 'demo-yaman' && t.slot >= 0 && s.placement[t.id] === 'shelf'
        const oldest = [...s.tapes].reverse().find((t) => t.id.startsWith('found-') && retire(t)) ?? s.tapes.find(retire)
        if (!oldest) {
          s.notify('The shelf is full — put a tape back first.')
          return
        }
        slot = oldest.slot
        dropProgramme(oldest.id)
        void forgetTape(oldest.id)
        s.removeTape(oldest.id)
      }
      const id = `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
      const tape = generateTape({ id, name: file.name, durationA: buffer.duration }, slot)
      putProgramme(id, 'A', { buffer, blob: file })
      s.addTape(tape, 'shelf')
      void saveTape(tape, { A: file })
      s.notify(`New tape: “${tape.title}” (${tape.format}). Drag it into the deck, or press L.`)
      if (!store().heldId) pickUp(id)
    } catch (err) {
      console.warn('decode failed', err)
      store().notify(`Could not read “${file.name}” as audio.`)
    }
  }
}

// ------------------------------------------------------------------ per-frame

const TWO_PI = Math.PI * 2
const CAPSTAN_R = 0.002

/** Called once per rendered frame from <Ticker/>. */
export function tick(dt: number) {
  dt = Math.min(dt, 0.1)
  engine.update(dt)

  const s = store()
  const t = s.tapes.find((x) => x.id === s.deckTapeId)
  const inDeck = !!t && (s.placement[t.id] === 'loaded' || s.placement[t.id] === 'cradle')
  if (t && inDeck) {
    const L = sideSeconds(t.format)
    const fullR = fullPackRadius(t.format)
    const area = fullR * fullR - HUB_R * HUB_R
    const w = woundFrom(live.pos, s.playSide, L)
    const right = Math.min(1, Math.max(0, t.side === 'A' ? w : 1 - w))
    live.rightFrac = right
    live.rR = Math.sqrt(HUB_R * HUB_R + right * area)
    live.rL = Math.sqrt(HUB_R * HUB_R + (1 - right) * area)
    // ribbon moves left→right while the playing side faces the viewer; reversed otherwise
    const dir = s.playSide === t.side ? 1 : -1
    const v = TAPE_SPEED * live.rate * dir
    live.angL += (v / live.rL) * dt
    live.angR += (v / live.rR) * dt
    live.counterRev += (v / live.rR / TWO_PI) * dt
    live.capstanAngle += (TAPE_SPEED * live.rate / CAPSTAN_R) * dt
  }
  const mode = s.machine.mode
  motorSound.update(live.rate, mode === 'FF' || mode === 'REW')
  rainSound.update(s.ui.rain)
}

// ------------------------------------------------------------------ boot

type ProgressFn = (f: number, label: string) => void
const progressListeners = new Set<ProgressFn>()
let booting: Promise<void> | null = null

/** Idempotent (React StrictMode mounts effects twice): every caller shares one boot. */
export function bootstrap(progress: ProgressFn): Promise<void> {
  progressListeners.add(progress)
  booting ??= runBoot((f, l) => progressListeners.forEach((p) => p(f, l)))
  return booting
}

async function runBoot(progress: ProgressFn) {
  const s = store()
  // 1. hand-writing fonts (don't block forever if offline)
  progress(0.02, 'Sharpening pencils')
  const fonts = ['Caveat', 'Reenie Beanie', 'Nanum Pen Script', 'Special Elite']
  await Promise.all(
    fonts.map((f) =>
      Promise.race([document.fonts.load(`28px "${f}"`).catch(() => []), sleep(2500)]),
    ),
  )
  progress(0.15, 'Warming up the tape heads')

  // 2. the demo tape. Its music is synthesised the first time the tape is needed (and pre-warmed
  // while the browser is idle), so boot does not wait on several seconds of synthesis.
  const demoTape = generateTape(
    {
      id: 'demo-yaman',
      name: 'Raga Yaman – Evening',
      durationA: DEMO_SECONDS.A,
      titleB: 'Bhoopali Bandish',
      durationB: DEMO_SECONDS.B,
      isDemo: true,
      wear: 0.32,
    },
    0,
  )
  demoTape.sides.B.title = 'Bhoopali Bandish'
  putProgramme(demoTape.id, 'A', { make: () => synthesiseSide('yaman') })
  putProgramme(demoTape.id, 'B', { make: () => synthesiseSide('bhoopali') })
  s.addTape(demoTape, 'shelf')
  progress(0.75, 'Dusting the shelf')

  // 3. tapes saved from earlier sessions
  const { tapes, blobs } = await loadSavedTapes()
  const wear = await loadWear()
  const used = new Set<number>([0])
  for (const t of tapes) {
    let slot = t.slot
    if (slot < 0 || slot >= RACK_SLOTS || used.has(slot)) slot = freeSlot()
    if (slot < 0) continue
    used.add(slot)
    const w = wear[t.id]
    const restored: Tape = { ...t, slot, plays: w?.plays ?? t.plays, wound: 0, side: 'A' }
    putProgramme(t.id, 'A', { blob: blobs[t.id]?.A })
    if (blobs[t.id]?.B) putProgramme(t.id, 'B', { blob: blobs[t.id].B })
    s.addTape(restored, 'shelf')
  }
  // mix tapes that fill the rack. Each has its own synthesised programme (different raga, tempo and
  // mood), generated on demand when you load it — real "found tape" libraries arrive in a later phase.
  FOUND_TAPES.forEach((f, i) => {
    const slot = freeSlot()
    if (slot < 0) return
    const id = `found-${i}`
    const t = generateTape({ id, name: f.title, durationA: f.spec.seconds, wear: 0.15 + (i % 4) * 0.12, isDemo: true }, slot)
    t.artist = f.note
    t.title = f.title
    t.sides.A.title = f.title
    putProgramme(id, 'A', { make: () => synthesiseFound(i) })
    s.addTape(t, 'shelf')
  })
  const dw = wear[demoTape.id]
  if (dw) s.patchTape(demoTape.id, { plays: dw.plays })
  progress(0.92, 'Almost there')

  // 4. settings → audio engine; first gesture unlocks audio
  const unlock = () => {
    void engine.resume().then(() => engine.applySettings(store().settings))
    for (const ev of GESTURES) window.removeEventListener(ev, unlock)
  }
  const GESTURES = ['pointerdown', 'touchend', 'click', 'keydown'] as const
  for (const ev of GESTURES) window.addEventListener(ev, unlock)
  engine.applySettings(store().settings)
  useDeck.subscribe((st, prev) => {
    if (st.settings !== prev.settings) engine.applySettings(st.settings)
  })
  progress(1, 'Ready')
  // pre-synthesise the demo tape while the browser is idle so the first load feels instant
  setTimeout(() => void warmProgramme(demoTape.id, 'A'), 4000)
}
