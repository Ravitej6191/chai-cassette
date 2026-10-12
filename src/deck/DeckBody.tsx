import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { ExtrudeGeometry, Shape, Path, type MeshStandardMaterial, MathUtils } from 'three'
import { useRef } from 'react'
import { CAVITY, DECK, FRONT_Z } from '../layout'
import { brushedMetal, panelDecal } from '../scene/textures'
import { DL, PLATE } from './layout'
import { useDeck } from '../state/store'

/** Silk-screened legends: everything printed on the front plate. */
function useDecal() {
  return useMemo(
    () =>
      panelDecal(PLATE.w, PLATE.h, (g, px, py, s) => {
        const ink = '#1d1a17'
        g.textBaseline = 'middle'
        const text = (t: string, x: number, y: number, size: number, o: { align?: CanvasTextAlign; color?: string; weight?: string; font?: string; alpha?: number } = {}) => {
          g.font = `${o.weight ?? 'normal'} ${size * s}px ${o.font ?? '"Special Elite", "Courier New", monospace'}`
          g.textAlign = o.align ?? 'center'
          g.fillStyle = o.color ?? ink
          g.globalAlpha = o.alpha ?? 1
          g.fillText(t, px(x), py(y))
          g.globalAlpha = 1
        }
        const box = (x0: number, y0: number, x1: number, y1: number, fill: string, r = 0.004) => {
          g.fillStyle = fill
          g.beginPath()
          g.roundRect(px(x0), py(y1), (x1 - x0) * s, (y1 - y0) * s, r * s)
          g.fill()
        }
        // brand
        text('CHAI & CASSETTE', -0.33, 0.118, 0.0128, { weight: 'bold' })
        text('STEREO RADIO CASSETTE RECORDER', -0.33, 0.1, 0.0046)
        text('TWO-IN-ONE', 0.335, 0.118, 0.0125, { weight: 'bold' })
        text('FM·MW·SW  ·  DOLBY NR  ·  AUTO-REVERSE', 0.335, 0.098, 0.0042)
        // recessed panels
        box(-0.095, -0.07, 0.235, 0.067, 'rgba(0,0,0,0.13)', 0.006)
        g.strokeStyle = 'rgba(20,16,12,0.7)'
        g.lineWidth = 0.0016 * s
        g.strokeRect(px(CAVITY.x - CAVITY.w / 2 - 0.004), py(CAVITY.h / 2 + 0.004), (CAVITY.w + 0.008) * s, (CAVITY.h + 0.008) * s)
        // key slots
        for (let i = 0; i < 6; i++) box(DL.keys.x(i) - 0.0375, DL.keys.y - 0.0225, DL.keys.x(i) + 0.0375, DL.keys.y + 0.0225, '#0c0b0a', 0.003)
        // knobs: scale ticks + legends
        DL.knobs.x.forEach((kx, i) => {
          const name = DL.knobs.names[i]
          g.strokeStyle = ink
          g.lineWidth = 0.0007 * s
          for (let k = 0; k <= 10; k++) {
            const a = ((-135 + (k / 10) * 270) * Math.PI) / 180
            const r0 = 0.0205
            const r1 = k % 5 === 0 ? 0.0262 : 0.0238
            const sx = Math.sin(a)
            const cy = Math.cos(a)
            g.beginPath()
            g.moveTo(px(kx + sx * r0), py(DL.knobs.y + cy * r0))
            g.lineTo(px(kx + sx * r1), py(DL.knobs.y + cy * r1))
            g.stroke()
          }
          text(name, kx, DL.knobs.y - 0.036, 0.0054, { weight: 'bold' })
          if (name === 'VOLUME') {
            text('0', kx - 0.017, DL.knobs.y - 0.022, 0.0045)
            text('10', kx + 0.018, DL.knobs.y - 0.022, 0.0045)
          } else if (name === 'BALANCE') {
            text('L', kx - 0.019, DL.knobs.y - 0.022, 0.0048)
            text('R', kx + 0.019, DL.knobs.y - 0.022, 0.0048)
          } else {
            text('−', kx - 0.019, DL.knobs.y - 0.022, 0.0055)
            text('+', kx + 0.019, DL.knobs.y - 0.022, 0.0055)
          }
        })
        // switches
        ;['DOLBY NR', 'AUTO REV', 'LOW BATT'].forEach((t, i) => text(t, DL.toggles.x[i], DL.toggles.y - 0.021, 0.0048, { weight: 'bold' }))
        text('I', DL.slider.x - 0.025, DL.slider.y + 0.014, 0.005)
        text('II', DL.slider.x, DL.slider.y + 0.014, 0.005)
        text('IV', DL.slider.x + 0.025, DL.slider.y + 0.014, 0.005)
        text('TAPE TYPE', DL.slider.x, DL.slider.y - 0.021, 0.0048, { weight: 'bold' })
        text('NORM·CrO₂·METAL', DL.slider.x, DL.slider.y - 0.0275, 0.0033)
        // counter
        text('COUNTER', DL.counter.x, DL.counter.y + 0.0225, 0.0046, { weight: 'bold' })
        text('RESET', DL.reset.x, DL.reset.y - 0.0185, 0.0042)
        // radio
        text('TUNING', DL.tuning.x, DL.tuning.y - 0.0225, 0.0046, { weight: 'bold' })
        text('FM · MW · SW', DL.band.x, DL.band.y + 0.0185, 0.0042, { weight: 'bold' })
        text('BAND', DL.band.x, DL.band.y - 0.0165, 0.0042)
        // LED legends
        ;['POWER', 'REC', 'BATT'].forEach((t, i) => text(t, DL.leds.x[i], DL.leds.y - 0.0095, 0.0036))
        // footer
        text('MADE IN INDIA  ·  1986  ·  AC 220V / 6×R20', 0, -0.1325, 0.0042, { alpha: 0.7 })
        // plate screws
        for (const [x, y] of [[-0.405, 0.125], [0.405, 0.125], [-0.405, -0.125], [0.405, -0.125]]) {
          g.fillStyle = '#6a6a6a'
          g.beginPath()
          g.arc(px(x), py(y), 0.0034 * s, 0, 6.3)
          g.fill()
          g.strokeStyle = '#222'
          g.lineWidth = 0.0007 * s
          g.beginPath()
          g.moveTo(px(x - 0.0028), py(y))
          g.lineTo(px(x + 0.0028), py(y))
          g.stroke()
        }
      }),
    [],
  )
}

/** Four boxes around the cassette compartment (deck-local), filling the space between back wall and plate. */
const frame = (() => {
  const z0 = CAVITY.backZ
  const z1 = FRONT_Z - PLATE.t
  const d = z1 - z0
  const zc = (z0 + z1) / 2
  const hw = PLATE.w / 2
  const hh = PLATE.h / 2
  const cl = CAVITY.x - CAVITY.w / 2
  const cr = CAVITY.x + CAVITY.w / 2
  const ct = CAVITY.y + CAVITY.h / 2
  const cb = CAVITY.y - CAVITY.h / 2
  return [
    { p: [(-hw + cl) / 2, 0, zc] as [number, number, number], s: [cl + hw, PLATE.h, d] as [number, number, number] },
    { p: [(cr + hw) / 2, 0, zc] as [number, number, number], s: [hw - cr, PLATE.h, d] as [number, number, number] },
    { p: [(cl + cr) / 2, (ct + hh) / 2, zc] as [number, number, number], s: [cr - cl, hh - ct, d] as [number, number, number] },
    { p: [(cl + cr) / 2, (cb - hh) / 2, zc] as [number, number, number], s: [cr - cl, hh + cb, d] as [number, number, number] },
  ]
})()

/** Body shell, aluminium front plate with the cassette cut-out, legends, handle, feet and status LEDs. */
export function DeckBody() {
  const decal = useDecal()
  const metal = useMemo(() => brushedMetal('#c4c6c9'), [])
  const plate = useMemo(() => {
    const shape = new Shape()
    const hw = PLATE.w / 2
    const hh = PLATE.h / 2
    shape.moveTo(-hw, -hh)
    shape.lineTo(hw, -hh)
    shape.lineTo(hw, hh)
    shape.lineTo(-hw, hh)
    shape.closePath()
    const hole = new Path()
    const cx = CAVITY.x
    hole.moveTo(cx - CAVITY.w / 2, CAVITY.y - CAVITY.h / 2)
    hole.lineTo(cx - CAVITY.w / 2, CAVITY.y + CAVITY.h / 2)
    hole.lineTo(cx + CAVITY.w / 2, CAVITY.y + CAVITY.h / 2)
    hole.lineTo(cx + CAVITY.w / 2, CAVITY.y - CAVITY.h / 2)
    hole.closePath()
    shape.holes.push(hole)
    const g = new ExtrudeGeometry(shape, { depth: PLATE.t, bevelEnabled: false })
    return g
  }, [])

  return (
    <group>
      {/* rear shell: its front face doubles as the back wall of the cassette compartment */}
      <RoundedBox args={[DECK.W, DECK.H, CAVITY.backZ + DECK.D / 2]} radius={0.012} smoothness={4} position={[0, 0, (CAVITY.backZ - DECK.D / 2) / 2]} castShadow receiveShadow>
        <meshStandardMaterial color="#17181a" roughness={0.55} metalness={0.15} />
      </RoundedBox>
      {/* front layer: four blocks framing the compartment, so it has real walls and depth */}
      {frame.map((b, i) => (
        <mesh key={i} position={b.p} castShadow receiveShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color="#121315" roughness={0.6} metalness={0.1} />
        </mesh>
      ))}
      {/* aluminium front plate */}
      <mesh geometry={plate} position={[0, 0, FRONT_Z - PLATE.t]} castShadow receiveShadow>
        <meshStandardMaterial map={metal.map} bumpMap={metal.bump} bumpScale={0.6} metalness={0.78} roughness={0.46} envMapIntensity={1.3} />
      </mesh>
      {/* printed legends */}
      <mesh position={[0, 0, FRONT_Z + 0.0004]}>
        <planeGeometry args={[PLATE.w, PLATE.h]} />
        <meshBasicMaterial map={decal} transparent toneMapped={false} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {/* rubber feet */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.38, -DECK.H / 2 - 0.002, sz * 0.09]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.008, 20]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
          </mesh>
        )),
      )}
      <Handle />
      <StatusLeds />
    </group>
  )
}

function Handle() {
  return (
    <group position={[0, DECK.H / 2, -0.01]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.28, 0.006, 0]} castShadow>
          <boxGeometry args={[0.03, 0.012, 0.04]} />
          <meshStandardMaterial color="#111" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.026, 0]} castShadow>
        <boxGeometry args={[0.56, 0.012, 0.03]} />
        <meshStandardMaterial color="#202226" roughness={0.45} metalness={0.4} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`p${s}`} position={[s * 0.28, 0.016, 0]}>
          <boxGeometry args={[0.012, 0.024, 0.026]} />
          <meshStandardMaterial color="#202226" roughness={0.45} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/** POWER (always on), REC (lit while recording / REC key armed), BATT (lit when the low-battery switch is on). */
function StatusLeds() {
  const rec = useRef<MeshStandardMaterial>(null)
  const batt = useRef<MeshStandardMaterial>(null)
  const pwr = useRef<MeshStandardMaterial>(null)
  useFrame((state) => {
    const s = useDeck.getState()
    const t = state.clock.elapsedTime
    if (pwr.current) pwr.current.emissiveIntensity = 2.2 + Math.sin(t * 40) * 0.05
    if (rec.current) rec.current.emissiveIntensity = MathUtils.lerp(rec.current.emissiveIntensity, s.machine.mode === 'RECORDING' || s.machine.pausedFrom === 'RECORDING' ? 3 : 0, 0.3)
    if (batt.current) batt.current.emissiveIntensity = MathUtils.lerp(batt.current.emissiveIntensity, s.settings.lowBattery ? 2.4 : 0, 0.3)
  })
  const led = (x: number, color: string, ref: React.Ref<MeshStandardMaterial>) => (
    <mesh position={[x, DL.leds.y, FRONT_Z + 0.001]}>
      <sphereGeometry args={[0.0034, 16, 12]} />
      <meshStandardMaterial ref={ref} color="#220505" emissive={color} emissiveIntensity={0} roughness={0.2} toneMapped={false} />
    </mesh>
  )
  return (
    <>
      {led(DL.leds.x[0], '#ff2a1a', pwr)}
      {led(DL.leds.x[1], '#ff1a1a', rec)}
      {led(DL.leds.x[2], '#ffaa22', batt)}
    </>
  )
}
