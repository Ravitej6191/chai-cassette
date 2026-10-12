import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, type Mesh, type Texture } from 'three'
import { FRONT_Z } from '../layout'
import { live } from '../state/live'
import { resetCounter } from '../controller/deck'
import { controlsLive, hoverProps } from '../scene/interaction'
import { digitStrip } from '../scene/textures'
import { DL } from './layout'

const WHEEL_R = 0.022
const WHEEL_W = 0.0155
const geo = new CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 40, 1, true)

/**
 * 3-digit mechanical counter. Reads right-reel revolutions (so it is naturally
 * non-linear in tape time: the reel turns faster as its pack shrinks). Each wheel
 * rolls continuously and only the carry digit advances while the lower wheel passes 9→0.
 */
export function TapeCounter() {
  const wheels = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)]
  const strip = useMemo<Texture>(() => {
    const t = digitStrip()
    t.center.set(0.5, 0.5)
    t.rotation = -Math.PI / 2 // lays the vertical digit strip around the wheel, digits upright
    return t
  }, [])

  useFrame(() => {
    const c = ((live.counterRev % 1000) + 1000) % 1000 // 0..999.99
    for (let i = 0; i < 3; i++) {
      const place = Math.pow(10, i)
      const base = Math.floor(c / place) % 10
      // carry: the wheel rolls only while the wheel to its right goes 9 → 0
      let carry = 0
      if (i > 0) {
        const lower = Math.floor(c / (place / 10)) % 10
        if (lower === 9) carry = (c / (place / 10)) % 1
      }
      const digit = base + carry
      const m = wheels[i].current
      // the strip has each digit centred in its cell, so a half-cell offset brings a digit square to the window
      if (m) m.rotation.x = -(digit + 0.5) * ((Math.PI * 2) / 10)
    }
  })

  const hp = hoverProps('Tape counter')
  const rp = hoverProps('Counter reset')
  return (
    <group position={[DL.counter.x, DL.counter.y, FRONT_Z]} {...hp}>
      {/* dark backing + frame around a short window: only the front of each wheel shows */}
      <mesh position={[0, 0, 0.0004]}>
        <planeGeometry args={[0.07, 0.026]} />
        <meshStandardMaterial color="#0d0d0e" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.0305, 0, 0.001]} castShadow>
          <boxGeometry args={[0.009, 0.026, 0.004]} />
          <meshStandardMaterial color="#0d0d0e" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} position={[0, s * 0.01, 0.001]} castShadow>
          <boxGeometry args={[0.052, 0.006, 0.004]} />
          <meshStandardMaterial color="#0d0d0e" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={wheels[2 - i]}
          geometry={geo}
          position={[(i - 1) * (WHEEL_W + 0.0012), 0, -WHEEL_R + 0.0012]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <meshStandardMaterial map={strip} roughness={0.55} side={2} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.0031]} renderOrder={4}>
        <planeGeometry args={[0.052, 0.014]} />
        <meshPhysicalMaterial transparent opacity={0.1} roughness={0.02} clearcoat={1} depthWrite={false} />
      </mesh>
      {/* reset button */}
      <group position={[DL.reset.x - DL.counter.x, DL.reset.y - DL.counter.y, 0]}>
        <mesh
          position={[0, 0, 0.003]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          onPointerDown={(e) => {
            if (!controlsLive()) return
            e.stopPropagation()
            resetCounter()
            const b = e.object
            b.position.z = 0.0015
            setTimeout(() => (b.position.z = 0.003), 120)
          }}
          {...rp}
        >
          <cylinderGeometry args={[0.0072, 0.0072, 0.006, 24]} />
          <meshStandardMaterial color="#202226" roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
    </group>
  )
}
