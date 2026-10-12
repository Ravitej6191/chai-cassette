import { useMemo } from 'react'
import { CALENDAR_POS, ROOM } from '../layout'
import { calendarTexture, canvas, toTexture } from './textures'

function Calendar() {
  const tex = useMemo(() => calendarTexture(), [])
  return (
    <group position={CALENDAR_POS} rotation={[0, 0, 0.01]}>
      {/* hanging nail + backing card */}
      <mesh position={[0, 0.02, -0.004]} castShadow>
        <boxGeometry args={[0.34, 0.48, 0.006]} />
        <meshStandardMaterial color="#e8dcc0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0.0]} receiveShadow>
        <planeGeometry args={[0.32, 0.455]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.265, 0.004]}>
        <cylinderGeometry args={[0.004, 0.004, 0.34, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Clock() {
  const face = useMemo(() => {
    const [c, g] = canvas(256, 256)
    g.fillStyle = '#f2ead0'
    g.beginPath()
    g.arc(128, 128, 124, 0, 6.3)
    g.fill()
    g.fillStyle = '#222'
    g.font = 'bold 34px Georgia'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96)
    }
    return toTexture(c)
  }, [])
  const now = new Date()
  const m = now.getMinutes() / 60
  const h = ((now.getHours() % 12) + m) / 12
  return (
    <group position={[1.85, 2.15, ROOM.backZ + 0.03]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 40]} />
        <meshStandardMaterial color="#3a2414" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.0205]}>
        <circleGeometry args={[0.135, 40]} />
        <meshStandardMaterial map={face} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.024]} rotation={[0, 0, -h * Math.PI * 2]}>
        <boxGeometry args={[0.012, 0.075, 0.003]} />
        <meshStandardMaterial color="#111" />
        <mesh position={[0, 0.0375, 0]} />
      </mesh>
      <mesh position={[0, 0, 0.026]} rotation={[0, 0, -m * Math.PI * 2]}>
        <boxGeometry args={[0.008, 0.11, 0.003]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  )
}

/** Wall calendar and clock (the shell itself is the baked room in BakedRoom.tsx). */
export function Room() {
  return (
    <group>
      <Calendar />
      <Clock />
    </group>
  )
}
