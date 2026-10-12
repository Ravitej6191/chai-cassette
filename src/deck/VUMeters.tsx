import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, MathUtils, type Group, type MeshStandardMaterial } from 'three'
import { FRONT_Z } from '../layout'
import { live } from '../state/live'
import { engine } from '../audio/AudioEngine'
import { meterFace } from '../scene/textures'
import { DL } from './layout'

const { w: MW, h: MH } = DL.vu
const NEEDLE_LEN = MH * 0.86
const SWING = 0.62 // radians either side of vertical

/**
 * One analog VU meter. The needle is a damped spring (stiffness 230, damping 15 →
 * ~16 % overshoot) chasing the analyser level, so it kicks past and settles like a
 * real coil movement. The peak LED lights when either channel clips.
 */
function Meter({ index, label }: { index: 0 | 1; label: string }) {
  const needle = useRef<Group>(null)
  const led = useRef<MeshStandardMaterial>(null)
  const face = useMemo(() => meterFace(label), [label])
  const state = useRef({ x: 0, v: 0 })

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    const target = index === 0 ? live.vuL : live.vuR
    const s = state.current
    // semi-implicit Euler is stable at 60 fps for these constants
    const acc = 230 * (target - s.x) - 15 * s.v
    s.v += acc * dt
    s.x += s.v * dt
    s.x = MathUtils.clamp(s.x, -0.04, 1.12)
    if (needle.current) needle.current.rotation.z = (0.5 - s.x) * SWING * 2
    if (led.current) led.current.emissiveIntensity = engine.now < live.clipUntil ? 4 : 0.0
  })

  return (
    <group position={[DL.vu.x[index], DL.vu.y, FRONT_Z]}>
      {/* bezel */}
      <mesh position={[0, 0, 0.001]} castShadow>
        <boxGeometry args={[MW + 0.008, MH + 0.008, 0.004]} />
        <meshStandardMaterial color="#0e0e10" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* backlit amber face */}
      <mesh position={[0, 0, 0.0032]}>
        <planeGeometry args={[MW, MH]} />
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffb340" emissiveIntensity={0.4} roughness={0.5} />
      </mesh>
      {/* needle with pivot below the face */}
      <group position={[0, -MH / 2 - MH * 0.02, 0.0042]}>
        <group ref={needle}>
          <mesh position={[0, NEEDLE_LEN / 2, 0]}>
            <boxGeometry args={[0.00075, NEEDLE_LEN, 0.0004]} />
            <meshStandardMaterial color="#111" roughness={0.4} />
          </mesh>
          <mesh position={[0, NEEDLE_LEN * 0.94, 0.0001]}>
            <boxGeometry args={[0.0009, NEEDLE_LEN * 0.12, 0.0004]} />
            <meshStandardMaterial color="#b3261e" roughness={0.4} />
          </mesh>
        </group>
      </group>
      {/* lower housing hides the pivot */}
      <mesh position={[0, -MH / 2 - 0.0014, 0.0048]}>
        <boxGeometry args={[MW, 0.003, 0.002]} />
        <meshStandardMaterial color="#0e0e10" roughness={0.5} />
      </mesh>
      {/* peak LED */}
      <mesh position={[MW * 0.38, MH * 0.34, 0.0048]}>
        <sphereGeometry args={[0.0021, 12, 10]} />
        <meshStandardMaterial ref={led} color="#300" emissive="#ff2200" emissiveIntensity={0} toneMapped={false} />
      </mesh>
      {/* glass */}
      <mesh position={[0, 0, 0.0056]} renderOrder={4}>
        <planeGeometry args={[MW, MH]} />
        <meshPhysicalMaterial transparent opacity={0.12} roughness={0.02} clearcoat={1} color="#ffffff" depthWrite={false} side={DoubleSide} envMapIntensity={1.5} />
      </mesh>
    </group>
  )
}

export function VUMeters() {
  return (
    <group>
      <Meter index={0} label="LEFT" />
      <Meter index={1} label="RIGHT" />
    </group>
  )
}
