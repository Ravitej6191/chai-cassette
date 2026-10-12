import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { FAN_POS, ROOM } from '../layout'
import { useDeck } from '../state/store'

/** Ceiling fan on a downrod. Blades cast the rotating shadow across the table. */
export function Fan() {
  const rotor = useRef<Group>(null)
  useFrame((_, dt) => {
    const slow = useDeck.getState().ui.reducedMotion ? 0.35 : 1
    if (rotor.current) rotor.current.rotation.y += dt * 1.15 * slow
  })
  const rod = ROOM.h - FAN_POS.y
  return (
    <group name="fan" position={FAN_POS}>
      <mesh position={[0, rod / 2, 0]}>
        <cylinderGeometry args={[0.012, 0.012, rod, 10]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, rod - 0.01, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.03, 20]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.45} />
      </mesh>
      <group ref={rotor}>
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.11, 0.07, 28]} />
          <meshStandardMaterial color="#5c5c5c" metalness={0.8} roughness={0.35} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]}>
            {/* arm */}
            <mesh position={[0.2, -0.012, 0]} rotation={[0, 0, 0.0]} castShadow>
              <boxGeometry args={[0.2, 0.012, 0.035]} />
              <meshStandardMaterial color="#303030" metalness={0.6} roughness={0.5} />
            </mesh>
            {/* blade, slightly pitched */}
            <mesh position={[0.5, -0.02, 0]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.62, 0.012, 0.19]} />
              <meshStandardMaterial color="#7a5230" roughness={0.55} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
