import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { CAVITY, FRONT_Z } from '../layout'
import { anim } from '../state/live'
import { doorClick } from '../controller/deck'
import { controlsLive, hoverProps } from '../scene/interaction'
import { useDeck } from '../state/store'

const W = CAVITY.w + 0.008
const H = CAVITY.h + 0.0055
const HINGE_Y = CAVITY.y + CAVITY.h / 2 + 0.0025
const OPEN_ANGLE = 1.5

/**
 * Smoked-acrylic cassette door, hinged at the top edge. `anim.door` (0 closed … 1 open,
 * overshooting slightly while GSAP's elastic ease settles) drives its angle.
 */
export function CassetteDoor() {
  const hinge = useRef<Group>(null)
  useFrame(() => {
    if (hinge.current) hinge.current.rotation.x = -MathUtils.clamp(anim.door, -0.02, 1.1) * OPEN_ANGLE
  })
  const open = useDeck((s) => s.machine.doorOpen)
  const hp = hoverProps(open ? 'Cassette door — click to close' : 'Cassette door — click to open')
  return (
    <group position={[CAVITY.x, HINGE_Y, FRONT_Z + 0.0035]}>
      <group ref={hinge}>
        <group position={[0, -H / 2, 0]} onClick={(e) => {
          if (!controlsLive()) return // first click only frames the deck
          e.stopPropagation()
          doorClick()
        }} {...hp}>
          {/* smoked pane */}
          <mesh renderOrder={6}>
            <boxGeometry args={[W - 0.012, H - 0.012, 0.0022]} />
            <meshPhysicalMaterial color="#1b1612" transparent opacity={0.3} roughness={0.06} metalness={0} clearcoat={1} clearcoatRoughness={0.04} envMapIntensity={1.4} depthWrite={false} />
          </mesh>
          {/* frame */}
          {[
            { p: [0, H / 2 - 0.003, 0], s: [W, 0.006, 0.0042] },
            { p: [0, -H / 2 + 0.003, 0], s: [W, 0.006, 0.0042] },
            { p: [-W / 2 + 0.003, 0, 0], s: [0.006, H, 0.0042] },
            { p: [W / 2 - 0.003, 0, 0], s: [0.006, H, 0.0042] },
          ].map((b, i) => (
            <mesh key={i} position={b.p as [number, number, number]} castShadow>
              <boxGeometry args={b.s as [number, number, number]} />
              <meshStandardMaterial color="#26282c" roughness={0.4} metalness={0.5} />
            </mesh>
          ))}
          {/* finger lip */}
          <mesh position={[0, -H / 2 - 0.0015, 0.003]} castShadow>
            <boxGeometry args={[0.03, 0.004, 0.006]} />
            <meshStandardMaterial color="#26282c" roughness={0.4} metalness={0.5} />
          </mesh>
          {/* glossy diagonal reflection streak */}
          
        </group>
      </group>
      {/* hinge barrel */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0025, 0.0025, W, 14]} />
        <meshStandardMaterial color="#9fa3a8" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  )
}
