import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { DECK, FRONT_Z } from '../layout'
import { dialTexture } from '../scene/textures'
import { sfx } from '../sfx/sfx'
import { useDeck } from '../state/store'
import { hoverProps } from '../scene/interaction'
import { Knob } from './Knobs'
import { SlideSwitch3 } from './Switches'
import { DL } from './layout'

let told = false
const notifyOnce = () => {
  if (told) return
  told = true
  useDeck.getState().notify('The radio section is a later phase — the dial, band switch and antenna move, but nothing is tuned yet.')
}

/**
 * Tuning dial, band selector and telescopic antenna. Phase 4 will connect these to the
 * Radio Browser source; for now they are fully physical (needle, band, antenna) but silent.
 */
export function RadioSection() {
  const [tune, setTune] = useState(0.38)
  const [band, setBand] = useState<0 | 1 | 2>(0)
  const needle = useRef<Group>(null)
  const dial = useMemo(dialTexture, [])
  const { x, y, w, h } = DL.dial

  useFrame(() => {
    if (needle.current) needle.current.position.x = MathUtils.lerp(needle.current.position.x, (tune - 0.5) * (w - 0.016), 0.35)
  })

  const hp = hoverProps('Radio dial')
  return (
    <group>
      {/* dial window */}
      <group position={[x, y, FRONT_Z]} {...hp}>
        <mesh position={[0, 0, 0.001]} castShadow>
          <boxGeometry args={[w + 0.008, h + 0.008, 0.004]} />
          <meshStandardMaterial color="#0e0e10" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.0032]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={dial} emissiveMap={dial} emissive="#ffb340" emissiveIntensity={0.32} roughness={0.5} />
        </mesh>
        <group ref={needle} position={[0, 0, 0.0045]}>
          <mesh>
            <boxGeometry args={[0.0011, h * 0.95, 0.0006]} />
            <meshStandardMaterial color="#d6281c" emissive="#d6281c" emissiveIntensity={0.9} toneMapped={false} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.0052]} renderOrder={4}>
          <planeGeometry args={[w, h]} />
          <meshPhysicalMaterial transparent opacity={0.1} roughness={0.02} clearcoat={1} depthWrite={false} />
        </mesh>
      </group>

      <Knob
        position={[DL.tuning.x, DL.tuning.y, FRONT_Z]}
        value={tune}
        label="Tuning (radio arrives in a later phase)"
        steps={24}
        onChange={(n) => {
          notifyOnce()
          setTune(n)
        }}
      />
      <SlideSwitch3
        x={DL.band.x}
        y={DL.band.y}
        value={band}
        onChange={(v) => {
          notifyOnce()
          sfx.switchFlip()
          setBand(v)
        }}
      />
      <Antenna />
    </group>
  )
}

/** Telescopic antenna hinged at the back-right of the top face. Click to fold / extend. */
function Antenna() {
  const g = useRef<Group>(null)
  const [out, setOut] = useState(true)
  useFrame(() => {
    if (g.current) {
      g.current.rotation.z = MathUtils.lerp(g.current.rotation.z, out ? -0.45 : -1.45, 0.12)
      const s = MathUtils.lerp(g.current.scale.y, out ? 1 : 0.38, 0.12)
      g.current.scale.y = s
    }
  })
  const hp = hoverProps('Telescopic antenna — click to fold / extend')
  return (
    <group
      position={[0.36, DECK.H / 2 + 0.004, -0.09]}
      onClick={(e) => {
        e.stopPropagation()
        sfx.switchFlip()
        setOut((o) => !o)
      }}
      {...hp}
    >
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[0.009, 16, 12]} />
        <meshStandardMaterial color="#1a1a1c" roughness={0.4} metalness={0.5} />
      </mesh>
      <group ref={g}>
        {[0.0042, 0.0034, 0.0026, 0.0019].map((r, i) => (
          <mesh key={r} position={[0, 0.07 + i * 0.07, 0]} castShadow>
            <cylinderGeometry args={[r, r + 0.0004, 0.14, 10]} />
            <meshStandardMaterial color="#d3d6da" metalness={1} roughness={0.2} />
          </mesh>
        ))}
        <mesh position={[0, 0.29, 0]}>
          <sphereGeometry args={[0.004, 12, 10]} />
          <meshStandardMaterial color="#d3d6da" metalness={1} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}
