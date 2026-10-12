import { useMemo, useRef } from 'react'
import { BufferGeometry, CylinderGeometry, type Group } from 'three'
import { FRONT_Z } from '../layout'
import { controlsLive, lockOrbit, hoverProps } from '../scene/interaction'
import { sfx } from '../sfx/sfx'
import { useDeck, type Settings } from '../state/store'
import { DL } from './layout'

/** Rubber knob body with a knurled skirt (alternating radii around the rim). */
function knurledGeometry(r: number, h: number, ridges = 28): BufferGeometry {
  const g = new CylinderGeometry(r, r * 1.04, h, ridges * 2, 1, false)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = pos.getY(i)
    if (y > h * 0.49) continue // keep the top cap round
    const a = Math.atan2(z, x)
    const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * ridges * 2)
    const k = seg % 2 ? 0.94 : 1
    pos.setX(i, x * k)
    pos.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}

const SWEEP = (270 * Math.PI) / 180

interface KnobProps {
  position: [number, number, number]
  /** Normalised 0..1 position. */
  value: number
  onChange: (n: number) => void
  label: string
  /** Notches that click while turning. */
  steps?: number
  /** Bipolar knobs snap to centre. */
  center?: boolean
  size?: number
}

/**
 * A rotary knob you drag vertically (works for touch too). Sweeps 270°, clicks on
 * detents, and for bipolar knobs snaps to a centre detent with a stronger click.
 */
export function Knob({ position, value, onChange, label, steps = 10, center = false, size = 1 }: KnobProps) {
  const body = useMemo(() => knurledGeometry(0.0165 * size, 0.016 * size), [size])
  const group = useRef<Group>(null)
  const last = useRef(value)

  const hp = hoverProps(label, 'ns-resize')
  const down = (e: { stopPropagation: () => void; clientY?: number; nativeEvent?: PointerEvent }) => {
    if (!controlsLive()) return
    e.stopPropagation()
    const startY = (e as unknown as { clientY: number }).clientY
    const startV = value
    last.current = value
    lockOrbit(true)
    const move = (ev: PointerEvent) => {
      let n = Math.min(1, Math.max(0, startV + (startY - ev.clientY) / 190))
      if (center && Math.abs(n - 0.5) < 0.035) n = 0.5
      const stepIdx = Math.round(n * steps)
      if (stepIdx !== Math.round(last.current * steps)) sfx.detent(center && n === 0.5)
      else if (center && n === 0.5 && last.current !== 0.5) sfx.detent(true)
      last.current = n
      onChange(n)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      lockOrbit(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return (
    <group position={position}>
      {/* chrome bezel ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.0015]}>
        <cylinderGeometry args={[0.0215 * size, 0.0215 * size, 0.003, 36]} />
        <meshStandardMaterial color="#0c0c0d" roughness={0.5} metalness={0.5} />
      </mesh>
      <group ref={group} rotation={[0, 0, -(value - 0.5) * SWEEP]} onPointerDown={down} {...hp}>
        <mesh geometry={body} position={[0, 0, 0.0108 * size]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <meshStandardMaterial color="#1b1c1f" roughness={0.6} metalness={0.2} />
        </mesh>
        {/* brushed cap */}
        <mesh position={[0, 0, 0.0192 * size]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0118 * size, 0.0122 * size, 0.0014, 36]} />
          <meshStandardMaterial color="#b9bcc0" metalness={1} roughness={0.32} />
        </mesh>
        {/* pointer line */}
        <mesh position={[0, 0.0105 * size, 0.0201 * size]}>
          <boxGeometry args={[0.0017 * size, 0.0075 * size, 0.0006]} />
          <meshStandardMaterial color="#f3efe4" emissive="#f3efe4" emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  )
}

type NumKey = 'volume' | 'bass' | 'treble' | 'balance' | 'pitch'
const MAP: { key: NumKey; bipolar: boolean; tip: string }[] = [
  { key: 'volume', bipolar: false, tip: 'Volume — drag up/down' },
  { key: 'bass', bipolar: true, tip: 'Bass ±12 dB — drag' },
  { key: 'treble', bipolar: true, tip: 'Treble ±12 dB — drag' },
  { key: 'balance', bipolar: true, tip: 'Balance — drag' },
  { key: 'pitch', bipolar: true, tip: 'Pitch / speed ±12 % — drag (centre detent)' },
]

/** Volume, bass, treble, balance and pitch, wired to the store → audio engine. */
export function Knobs() {
  const settings = useDeck((s) => s.settings)
  const set = useDeck((s) => s.setSetting)
  return (
    <group>
      {MAP.map((k, i) => {
        const v = settings[k.key]
        const n = k.bipolar ? (v + 1) / 2 : v
        return (
          <Knob
            key={k.key}
            position={[DL.knobs.x[i], DL.knobs.y, FRONT_Z]}
            value={n}
            label={k.tip}
            steps={k.bipolar ? 10 : 10}
            center={k.bipolar}
            onChange={(nn) => set(k.key as keyof Settings, (k.bipolar ? nn * 2 - 1 : nn) as never)}
          />
        )
      })}
    </group>
  )
}
