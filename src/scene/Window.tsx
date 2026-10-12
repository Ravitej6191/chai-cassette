import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, PlaneGeometry, type Mesh, type MeshBasicMaterial, type Texture } from 'three'
import { ROOM, WINDOW } from '../layout'
import { tod } from './tod'
import { canvas, rainGlassTextures, rainyOutsideTexture, toTexture } from './textures'
import { useDeck } from '../state/store'
import { usePbr } from './assets'

const FRAME = '#16181a'

/** A sheer curtain: vertical folds baked into the geometry, soft cream, slightly see-through. */
function Curtain({ x, w, folds = 7, flip = 1 }: { x: number; w: number; folds?: number; flip?: number }) {
  const linen = usePbr('rough_linen', [2, 5])
  const geo = useMemo(() => {
    const g = new PlaneGeometry(w, 2.62, 60, 4)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / w + 0.5
      p.setZ(i, Math.sin(u * Math.PI * 2 * folds) * 0.034 + Math.sin(u * 23 + 1) * 0.006)
    }
    g.computeVertexNormals()
    return g
  }, [w, folds])
  return (
    <mesh geometry={geo} position={[x, 1.33 - WINDOW.y, 0.16 * flip]} castShadow>
      <meshStandardMaterial {...linen} color="#f4efe4" emissive="#9fb2cc" emissiveIntensity={0.28} transparent opacity={0.9} side={DoubleSide} />
    </mesh>
  )
}

/**
 * The window behind the table: a blurred rainy dusk outside (with a daylight sky that fades in
 * by day), a dark steel frame, rain droplets and slowly sliding streaks on the glass, and
 * sheer curtains either side. The odd auto-rickshaw still crosses the street below.
 */
export function Window() {
  const outside = useMemo(rainyOutsideTexture, [])
  const rain = useMemo(rainGlassTextures, [])
  const sky = useMemo(() => {
    const [c, g] = canvas(8, 256)
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#6aa0dc')
    gr.addColorStop(1, '#f4dcb0')
    g.fillStyle = gr
    g.fillRect(0, 0, 8, 256)
    return toTexture(c)
  }, [])
  const lights = useMemo(() => {
    const [c, g] = canvas(128, 64)
    for (const x of [38, 90]) {
      const gr = g.createRadialGradient(x, 32, 0, x, 32, 22)
      gr.addColorStop(0, 'rgba(255,250,220,1)')
      gr.addColorStop(0.3, 'rgba(255,230,160,0.6)')
      gr.addColorStop(1, 'rgba(255,200,100,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, 128, 64)
    }
    return toTexture(c)
  }, [])
  const outMat = useRef<MeshBasicMaterial>(null)
  const skyMat = useRef<MeshBasicMaterial>(null)
  const rickshaw = useRef<Mesh>(null)
  const state = useRef({ next: 8, t: -1 })
  const quality = useDeck((s) => s.ui.quality)

  useFrame((_, dt) => {
    const day = tod.cur.daylight
    if (outMat.current) outMat.current.color.setScalar(0.85 - day * 0.15)
    if (skyMat.current) skyMat.current.opacity = day
    // streaks run down the pane (slower when reduced motion is on)
    const slow = useDeck.getState().ui.reducedMotion ? 0.3 : 1
    ;(rain.streaks as Texture).offset.y -= dt * 0.035 * slow
    // rickshaw crossing every ~25 s
    const st = state.current
    st.next -= dt
    if (st.next <= 0 && st.t < 0) {
      st.t = 0
      st.next = 20 + Math.random() * 25
    }
    if (st.t >= 0) {
      st.t += dt / 5.5
      if (rickshaw.current) {
        rickshaw.current.visible = true
        rickshaw.current.position.x = WINDOW.w * 0.45 - st.t * WINDOW.w * 0.9
      }
      if (st.t > 1) {
        st.t = -1
        if (rickshaw.current) rickshaw.current.visible = false
      }
    }
  })

  const w = WINDOW.w
  const h = WINDOW.h
  const bars = [-w / 6, w / 6] // two vertical mullions → three panes
  return (
    <group position={[WINDOW.x, WINDOW.y, ROOM.backZ]}>
      {/* the world outside */}
      <mesh position={[0, -0.05, -1.4]}>
        <planeGeometry args={[w * 2.6, h * 2.2]} />
        <meshBasicMaterial ref={outMat} map={outside} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.05, -1.39]}>
        <planeGeometry args={[w * 2.6, h * 2.2]} />
        <meshBasicMaterial ref={skyMat} map={sky} transparent opacity={0} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={rickshaw} position={[0, -h * 0.4, -1.38]} visible={false}>
        <planeGeometry args={[0.28, 0.12]} />
        <meshBasicMaterial map={lights} color="#fff2c8" transparent opacity={0.9} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* rain on the glass */}
      <mesh position={[0, 0, 0.012]} renderOrder={5}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={rain.drops} transparent roughness={0.05} metalness={0} emissive="#8ea4c4" emissiveMap={rain.drops} emissiveIntensity={0.22} depthWrite={false} />
      </mesh>
      {quality !== 'low' && (
        <mesh position={[0, 0, 0.016]} renderOrder={6}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={rain.streaks} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
        </mesh>
      )}

      {/* dark steel frame with mullions and a transom */}
      {[
        { p: [0, h / 2 + 0.025, 0.04], s: [w + 0.1, 0.06, 0.12] },
        { p: [0, -h / 2 - 0.025, 0.06], s: [w + 0.16, 0.06, 0.2] },
        { p: [-w / 2 - 0.025, 0, 0.04], s: [0.06, h, 0.12] },
        { p: [w / 2 + 0.025, 0, 0.04], s: [0.06, h, 0.12] },
        { p: [0, h * 0.18, 0.02], s: [w, 0.035, 0.07] },
        ...bars.map((x) => ({ p: [x, 0, 0.02], s: [0.04, h, 0.07] })),
      ].map((b, i) => (
        <mesh key={i} position={b.p as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={b.s as [number, number, number]} />
          <meshStandardMaterial color={FRAME} roughness={0.55} metalness={0.6} />
        </mesh>
      ))}
      {/* balcony railing seen through the glass */}
      <mesh position={[0, -h * 0.28, -0.3]}>
        <boxGeometry args={[w * 1.6, 0.025, 0.025]} />
        <meshStandardMaterial color="#0e0f10" roughness={0.6} metalness={0.5} />
      </mesh>
      {Array.from({ length: 22 }, (_, i) => (
        <mesh key={i} position={[(i / 21 - 0.5) * w * 1.6, -h * 0.4, -0.3]}>
          <boxGeometry args={[0.012, h * 0.24, 0.012]} />
          <meshStandardMaterial color="#0e0f10" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}

      {/* curtain rod with end finials */}
      <mesh position={[0, 2.64 - WINDOW.y, 0.19]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, w + 1.5, 12]} />
        <meshStandardMaterial color="#14110f" metalness={0.7} roughness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + 0.76), 2.64 - WINDOW.y, 0.19]}>
          <sphereGeometry args={[0.03, 12, 10]} />
          <meshStandardMaterial color="#b88a3c" metalness={1} roughness={0.3} />
        </mesh>
      ))}
      {/* sheer curtains, drawn to the sides */}
      <Curtain x={-w / 2 - 0.22} w={0.62} />
      <Curtain x={w / 2 + 0.22} w={0.62} folds={6} />
    </group>
  )
}
