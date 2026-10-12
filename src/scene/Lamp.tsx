import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { DoubleSide, type MeshStandardMaterial } from 'three'
import { LAMP_POS } from '../layout'
import { tod } from './tod'
import { linenTexture } from './textures'
import { useDeck } from '../state/store'

/** Brass-based table lamp with a fabric shade, a visible light cone and floating dust. */
export function Lamp() {
  const shade = useRef<MeshStandardMaterial>(null)
  const linen = useMemo(linenTexture, [])
  const quality = useDeck((s) => s.ui.quality)
  useFrame((state) => {
    const k = tod.cur.lamp
    const flicker = 1 + Math.sin(state.clock.elapsedTime * 9.3) * 0.006 + Math.sin(state.clock.elapsedTime * 2.1) * 0.01
    if (shade.current) shade.current.emissiveIntensity = (0.12 + 1.3 * k) * flicker
  })
  return (
    <group name="lamp" position={LAMP_POS}>
      <mesh position={[0, 0.014, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.085, 0.028, 32]} />
        <meshStandardMaterial color="#b88a3c" metalness={1} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.012, 0.28, 12]} />
        <meshStandardMaterial color="#b88a3c" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <sphereGeometry args={[0.032, 20, 14]} />
        <meshStandardMaterial color="#b88a3c" metalness={1} roughness={0.28} />
      </mesh>
      {/* bulb + shade (the shade does not cast shadows, so the lamp's own light escapes) */}
      <mesh position={[0, 0.37, 0]}>
        <sphereGeometry args={[0.026, 16, 12]} />
        <meshStandardMaterial color="#fff2cc" emissive="#ffc46b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.1, 0.17, 0.2, 40, 1, true]} />
        <meshStandardMaterial ref={shade} map={linen} color="#f0dcb0" emissive="#ff9e3d" emissiveIntensity={1.0} emissiveMap={linen} roughness={0.95} side={DoubleSide} />
      </mesh>
      <Sparkles count={quality === 'low' ? 12 : 55} scale={[0.9, 0.6, 0.9]} position={[-0.15, 0.2, 0.1]} size={1.1} speed={0.18} opacity={0.5} color="#ffd9a0" noise={0.4} />
    </group>
  )
}
