import { useEffect, useRef } from 'react'
import { Box3, Sphere, Vector3 } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Deck } from '../deck/Deck'
import { tick } from '../controller/deck'
import { ContactShadows } from '@react-three/drei'
import { TABLE_TOP } from '../layout'
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
 * first lowers the render resolution (cheap, no recompiling), then steps the graphics tier down
 * (ultra → high → low). It never steps up, and stops interfering once you pick a tier by hand.
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
    if (a.slow < 3) return
    a.slow = 0
    a.age = 5 // give the change a moment before judging it
    if (s.ui.dprCap > 1) {
      const next = Math.max(1, s.ui.dprCap - 0.25)
      s.patchUi({ dprCap: next })
      s.notify(`Running at ${Math.round(fps)} fps — lowered the render resolution to keep it smooth.`)
      return
    }
    const tier = STEP_DOWN[s.ui.quality]
    if (tier) {
      s.patchUi({ quality: tier })
      s.notify(`Running at ${Math.round(fps)} fps — switched graphics to ${tier} to keep it smooth.`)
    }
  })
  return null
}

/**
 * A shadow-map pass redraws every caster. Parts smaller than ~5 cm (knobs, screws, LEDs, key
 * legends…) leave no visible shadow, so they are dropped from the shadow passes — a large saving
 * for the same picture. Re-checked every couple of seconds because tapes and models come and go.
 */
function ShadowCuller() {
  const scene = useThree((s) => s.scene)
  const tick = useRef(0)
  const sphere = useRef(new Sphere())
  const box = useRef(new Box3())
  const scale = useRef(new Vector3())
  useFrame(() => {
    if (tick.current++ % 120 !== 5) return
    scene.traverse((o) => {
      const m = o as unknown as { isMesh?: boolean; castShadow: boolean; geometry: { boundingSphere: Sphere | null; computeBoundingSphere: () => void }; userData: Record<string, unknown> }
      if (!m.isMesh || !m.castShadow || m.userData.keepShadow) return
      const g = m.geometry
      if (!g.boundingSphere) g.computeBoundingSphere()
      const bs = g.boundingSphere
      if (!bs) return
      o.getWorldScale(scale.current)
      const r = bs.radius * Math.max(scale.current.x, scale.current.y, scale.current.z)
      if (r < 0.025) m.castShadow = false
    })
    void box
    void sphere
  })
  return null
}

/** Reads draw-call / triangle counts once a second and tells you which GPU the browser picked. */
function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const acc = useRef({ t: 0, n: 0, ms: 0 })
  useEffect(() => {
    gl.info.autoReset = false // accumulate over the whole frame, composer passes included
    let name = ''
    try {
      const ctx = gl.getContext()
      const ext = ctx.getExtension('WEBGL_debug_renderer_info')
      name = ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    } catch {
      /* unavailable */
    }
    useDeck.getState().patchUi({ gpu: name.replace(/ANGLE \((.*)\)/, '$1').replace(/\s*Direct3D.*$/, '') })
  }, [gl])
  useFrame((_, dt) => {
    const info = gl.info
    const a = acc.current
    a.t += dt
    a.n++
    a.ms += dt * 1000
    if (a.t >= 1) {
      if (useDeck.getState().ui.showStats) {
        useDeck.getState().patchUi({
          perf: { ms: +(a.ms / a.n).toFixed(1), calls: Math.round(info.render.calls / a.n), tris: Math.round(info.render.triangles / a.n), textures: info.memory.textures },
        })
      }
      a.t = 0
      a.n = 0
      a.ms = 0
      info.reset()
    }
  })
  return null
}

export function Scene() {
  const quality = useDeck((s) => s.ui.quality)
  return (
    <>
      <Lighting />
      <Room />
      <Window />
      <Fan />
      <Table />
      {/* soft contact shadows grounding the deck, rack, lamp and chai on the wood */}
      {quality !== 'low' && (
        <ContactShadows position={[0, TABLE_TOP + 0.0015, -0.1]} scale={[2.1, 0.85]} far={0.28} blur={2.4} opacity={0.5} resolution={512} frames={300} color="#120804" />
      )}
      <Props />
      <Lamp />
      <Chai />
      <Deck />
      <TapeShelf />
      <CameraRig />
      <Ticker />
      <PerfGovernor />
      <PerfProbe />
      <ShadowCuller />
      <PostFX />
    </>
  )
}
