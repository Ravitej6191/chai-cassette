import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Deck } from '../deck/Deck'
import { tick } from '../controller/deck'
import { useDeck, type Quality } from '../state/store'
import { TapeShelf } from '../tapes/TapeShelf'
import { CameraRig } from './Camera'
import { Chai } from './Chai'
import { Fan } from './Fan'
import { Lamp } from './Lamp'
import { Lighting } from './Lighting'
import { PostFX } from './PostFX'
import { Props } from './Props'
import { Room } from './Room'
import { Table } from './Table'
import { Window } from './Window'

/** Drives the transport, audio meters and reel physics once per rendered frame. */
function Ticker() {
  useFrame((_, dt) => tick(dt))
  return null
}

const STEP_DOWN: Record<Quality, Quality | null> = { ultra: 'high', high: 'low', low: null }

/**
 * Measures the real frame rate and, if the machine cannot hold ~40 fps for a few seconds in a row,
 * steps the graphics tier down by itself (ultra → high → low). It never steps up, and stops
 * interfering as soon as you pick a tier by hand.
 */
function PerfGovernor() {
  const acc = useRef({ t: 0, n: 0, slow: 0, age: 0 })
  useFrame((_, dt) => {
    if (dt > 0.5 || document.visibilityState !== 'visible') return // tab was hidden / stalled: not a real sample
    const a = acc.current
    a.t += dt
    a.n++
    if (a.t < 1) return
    const fps = a.n / a.t
    a.t = 0
    a.n = 0
    a.age++
    const s = useDeck.getState()
    s.patchUi({ fps: Math.round(fps) })
    if (!s.ui.autoQuality || a.age < 8) return // let shaders compile and the intro settle first
    a.slow = fps < 40 ? a.slow + 1 : 0
    const next = STEP_DOWN[s.ui.quality]
    if (a.slow >= 3 && next) {
      a.slow = 0
      a.age = 5 // give the lower tier a moment before judging it
      s.patchUi({ quality: next })
      s.notify(`Running at ${Math.round(fps)} fps — switched graphics to ${next} to keep it smooth.`)
    }
  })
  return null
}

export function Scene() {
  return (
    <>
      <Lighting />
      <Room />
      <Window />
      <Fan />
      <Table />
      <Props />
      <Lamp />
      <Chai />
      <Deck />
      <TapeShelf />
      <CameraRig />
      <Ticker />
      <PerfGovernor />
      <PostFX />
    </>
  )
}
