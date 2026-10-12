import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { ASSET_BASE } from './assets'
import { Color, MathUtils, type AmbientLight, type SpotLight, type PointLight } from 'three'
import { DECK_POS, FAN_POS, HELD_POS, LAMP_POS, RACK_POS, ROOM, WINDOW } from '../layout'
import { PRESETS, resolveTod, tod, type Preset } from './tod'
import { useDeck } from '../state/store'

const _c = new Color()

/** Move every numeric/colour field of `cur` toward `to`. */
function ease(cur: Preset, to: Preset, k: number) {
  for (const key of Object.keys(to) as (keyof Preset)[]) {
    const a = cur[key]
    const b = to[key]
    if (typeof a === 'number' && typeof b === 'number') (cur[key] as number) = MathUtils.lerp(a, b, k)
    else if (typeof a === 'string' && typeof b === 'string') (cur[key] as string) = '#' + _c.set(a).lerp(new Color(b), k).getHexString()
  }
}

/**
 * All the lights, driven by the current time-of-day preset:
 *  - table lamp (shadow-casting spot + soft point fill) — the star at night
 *  - window light (moon / street / sun)
 *  - a dim ceiling light above the fan, whose spinning blades throw the rotating shadow
 *  - a faint amber glow in front of the deck, standing in for the backlit meters
 *  - an occasional rickshaw headlight sweeping across the ceiling
 */
export function Lighting() {
  const quality = useDeck((s) => s.ui.quality)
  const todSetting = useDeck((s) => s.ui.tod)
  const { scene, gl } = useThree()
  const amb = useRef<AmbientLight>(null)
  const lampSpot = useRef<SpotLight>(null)
  const lampFill = useRef<PointLight>(null)
  const winLight = useRef<SpotLight>(null)
  const fanLight = useRef<SpotLight>(null)
  const deckGlow = useRef<PointLight>(null)
  const rackLight = useRef<PointLight>(null)
  const handLight = useRef<PointLight>(null)
  const rick = useRef<SpotLight>(null)
  const rickState = useRef({ t: -1, next: 10 })

  const low = quality === 'low'

  // aim the spots
  useEffect(() => {
    const aim = (l: SpotLight | null, x: number, y: number, z: number) => {
      if (!l) return
      l.target.position.set(x, y, z)
      l.target.updateMatrixWorld()
    }
    aim(lampSpot.current, DECK_POS.x - 0.1, DECK_POS.y, DECK_POS.z + 0.1)
    aim(winLight.current, 0, 0.9, 0.4)
    aim(fanLight.current, 0, 0.76, -0.1)
    aim(rick.current, -0.5, 2.8, 0.5)
  }, [])

  // The lamp's shadows only change when something is moved by hand, and the fan's turn slowly, so the
  // shadow maps are re-rendered 10×/s and 20×/s instead of every frame. That removes most of the
  // shadow cost for no visible difference.
  const shadowTick = useRef(0)
  useEffect(() => {
    if (lampSpot.current) lampSpot.current.shadow.autoUpdate = false
    if (fanLight.current) fanLight.current.shadow.autoUpdate = false
  }, [low])

  useFrame((state, dt) => {
    shadowTick.current++
    if (lampSpot.current && shadowTick.current % 6 === 0) lampSpot.current.shadow.needsUpdate = true
    if (fanLight.current && shadowTick.current % 3 === 0) fanLight.current.shadow.needsUpdate = true
    const want = PRESETS[resolveTod(todSetting)]
    ease(tod.cur, want, 1 - Math.exp(-dt * 1.2))
    const c = tod.cur
    gl.toneMappingExposure = c.exposure
    if (amb.current) {
      amb.current.intensity = c.ambient
      amb.current.color.set(c.ambientColor)
    }
    const flick = 1 + Math.sin(state.clock.elapsedTime * 9.3) * 0.006
    if (lampSpot.current) lampSpot.current.intensity = 3.4 * c.lamp * flick
    if (lampFill.current) lampFill.current.intensity = 1.5 * c.lamp * flick
    if (winLight.current) {
      winLight.current.intensity = c.windowIntensity
      winLight.current.color.set(c.windowColor)
    }
    if (fanLight.current) fanLight.current.intensity = 0.9 * c.fan * (c.lamp > 0.1 ? 1 : 3)
    if (handLight.current) {
      const want = useDeck.getState().heldId ? 1.6 : 0
      handLight.current.intensity += (want - handLight.current.intensity) * Math.min(1, dt * 6)
    }
    if (rackLight.current) rackLight.current.intensity = 0.7 + 1.3 * c.lamp * flick
    if (deckGlow.current) deckGlow.current.intensity = 0.02 + 0.02 * (1 - c.daylight)
    if (scene.background instanceof Color) scene.background.set(c.background)
    scene.environmentIntensity = c.env

    // rickshaw headlight sweep (night/evening only)
    const rs = rickState.current
    rs.next -= dt
    if (rs.next <= 0 && rs.t < 0 && c.daylight < 0.5) {
      rs.t = 0
      rs.next = 22 + Math.random() * 25
    }
    if (rs.t >= 0 && rick.current) {
      rs.t += dt / 6
      const k = rs.t
      rick.current.target.position.set(-1.3 + k * 2.6, 2.8, 0.2 + Math.sin(k * 3) * 0.3)
      rick.current.target.updateMatrixWorld()
      rick.current.intensity = Math.sin(Math.min(1, k) * Math.PI) * 1.6
      if (k > 1) {
        rs.t = -1
        rick.current.intensity = 0
      }
    }
  })

  const shadowSize = low ? 512 : 1024
  return (
    <>
      <color attach="background" args={['#07070c']} />
      <hemisphereLight args={["#8ea6cc", "#4a3220", 0.35]} />
      <ambientLight ref={amb} intensity={0.1} color="#6678b8" />

      {/* table lamp: spot casts the shadows, point fills the room */}
      <spotLight
        ref={lampSpot}
        position={[LAMP_POS.x - 0.02, LAMP_POS.y + 0.4, LAMP_POS.z]}
        angle={1.15}
        penumbra={1}
        decay={2}
        distance={6}
        color="#ffb468"
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.001}
        shadow-normalBias={0.05}
        shadow-radius={low ? 2 : 5}
      />
      <pointLight ref={lampFill} position={[LAMP_POS.x, LAMP_POS.y + 0.4, LAMP_POS.z + 0.1]} decay={2} distance={7} color="#ffb468" />

      {/* window */}
      <spotLight
        ref={winLight}
        position={[WINDOW.x, WINDOW.y, ROOM.backZ - 0.3]}
        angle={1.1}
        penumbra={1}
        decay={1.2}
        distance={9}
        intensity={1.3}
        color="#7f95d6"
      />

      {/* ceiling light over the fan → rotating blade shadows */}
      {!low && (
        <spotLight
          ref={fanLight}
          position={[FAN_POS.x, ROOM.h - 0.06, FAN_POS.z]}
          angle={0.85}
          penumbra={0.55}
          decay={1.4}
          distance={8}
          intensity={0.9}
          color="#ffcf9a"
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.0006}
          shadow-radius={6}
        />
      )}

      {/* soft warm bounce so the tape rack on the left is not lost in the dark */}
      <pointLight ref={rackLight} position={[RACK_POS.x + 0.1, RACK_POS.y + 0.55, RACK_POS.z + 0.55]} decay={2} distance={2.2} color="#ffc890" intensity={0.5} />
      {/* a soft lantern that follows the tape you are holding so its label stays readable */}
      <pointLight ref={handLight} position={[HELD_POS.x + 0.15, HELD_POS.y + 0.45, HELD_POS.z + 0.35]} decay={2} distance={2} color="#ffd3a0" intensity={0} />
      <pointLight position={[-0.9, 1.5, 0.9]} decay={2} distance={4.5} color="#9db4ff" intensity={0.5} />
      <pointLight ref={deckGlow} position={[0, DECK_POS.y + 0.02, DECK_POS.z + 0.34]} decay={2} distance={1.2} color="#ffb340" intensity={0.08} />

      {/* rickshaw headlights through the window, sweeping the ceiling */}
      <spotLight ref={rick} position={[WINDOW.x, 0.9, ROOM.backZ - 1.2]} angle={0.22} penumbra={1} decay={1.2} distance={8} intensity={0} color="#fff0c4" />

      {/* image-based lighting from a real photographed warm interior (Poly Haven, CC0) */}
      <Suspense fallback={null}>
        <Environment files={`${ASSET_BASE}hdri/warm_restaurant_night_1k.hdr`} environmentRotation={[0, 2.2, 0]} />
      </Suspense>
    </>
  )
}
