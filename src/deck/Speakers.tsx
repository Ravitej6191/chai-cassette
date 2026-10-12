import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import { FRONT_Z } from '../layout'
import { live } from '../state/live'
import { grilleColorTexture } from '../scene/textures'
import { DL } from './layout'

/** Perforated grille over a cone that visibly pumps with the signal level. */
function Speaker({ x }: { x: number }) {
  const cone = useRef<Group>(null)
  const g = useMemo(grilleColorTexture, [])
  const R = DL.speaker.r
  useFrame((state) => {
    if (!cone.current) return
    const k = live.cone
    cone.current.position.z = -0.012 + Math.sin(state.clock.elapsedTime * 55) * 0.0011 * k
    cone.current.scale.setScalar(1 + k * 0.012)
  })
  return (
    <group position={[x, DL.speaker.y, FRONT_Z]}>
      {/* recess */}
      <mesh position={[0, 0, -0.002]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, 0.004, 48]} />
        <meshStandardMaterial color="#070606" roughness={0.9} />
      </mesh>
      {/* cone */}
      <group ref={cone} position={[0, 0, -0.012]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[R * 0.82, 0.02, 40, 1, true]} />
          <meshStandardMaterial color="#151311" roughness={0.8} side={DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.006]}>
          <sphereGeometry args={[R * 0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#26231f" roughness={0.6} />
        </mesh>
      </group>
      {/* grille: perforated metal sheet via alpha map */}
      <mesh position={[0, 0, 0.0016]}>
        <circleGeometry args={[R * 0.97, 64]} />
        <meshStandardMaterial map={g} color="#c8c8c8" metalness={0.55} roughness={0.5} />
      </mesh>
      {/* trim ring */}
      <mesh position={[0, 0, 0.0012]}>
        <torusGeometry args={[R * 0.985, 0.0034, 12, 64]} />
        <meshStandardMaterial color="#cfd2d6" metalness={1} roughness={0.28} />
      </mesh>
    </group>
  )
}

export function Speakers() {
  return (
    <group>
      <Speaker x={-DL.speaker.x} />
      <Speaker x={DL.speaker.x} />
    </group>
  )
}
