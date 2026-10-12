import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type PointLight } from 'three'
import { ROOM, TABLE_TOP } from '../layout'
import { rng } from '../tapes/generator'
import { Model, usePbr } from './assets'
import { artTexture, spineRowTexture } from './textures'

const WOOD = '#4a2d1a'

/** Wooden bookcase: shelf rows are textured spine strips (books + a row of cassette cases), with depth behind. */
export function Bookcase({ position, width = 0.7, height = 1.5, depth = 0.3 }: { position: [number, number, number]; width?: number; height?: number; depth?: number }) {
  const rows = 4
  const rowH = (height - 0.05) / rows
  const wood = usePbr('dark_wood', [0.6, 0.6])
  const spines = useMemo(() => Array.from({ length: rows }, (_, i) => spineRowTexture(7 + i * 13, i === 1)), [])
  const mat = { ...wood, color: '#b89a7e' }
  const bookH = rowH - 0.03
  return (
    <group name="bookcase" position={position}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (width / 2 + 0.01), height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.02, height, depth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <mesh key={i} position={[0, i * rowH + 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[width + 0.04, 0.025, depth]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}
      <mesh position={[0, height / 2, -depth / 2 + 0.005]} receiveShadow>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.9} />
      </mesh>
      {spines.map((tex, i) => (
        <group key={i} position={[0, 0.033 + i * rowH + bookH / 2, 0]}>
          {/* front rank, and a darker rank behind it so the row has depth */}
          <mesh position={[0, 0, depth * 0.18]}>
            <planeGeometry args={[width, bookH]} />
            <meshStandardMaterial map={tex} alphaTest={0.4} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0, -depth * 0.1]}>
            <planeGeometry args={[width, bookH]} />
            <meshStandardMaterial map={tex} color="#6a625a" alphaTest={0.4} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* a small lamp on top, so the dark left side of the room has its own warm pool */}
      <group position={[width / 2 - 0.12, height + 0.0, 0.02]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.06, 20]} />
          <meshStandardMaterial color="#2a2220" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.055, 0.085, 0.12, 24, 1, true]} />
          <meshStandardMaterial color="#f0cf92" emissive="#ff9f45" emissiveIntensity={1.2} side={DoubleSide} roughness={0.9} />
        </mesh>
        <pointLight position={[0, 0.12, 0.08]} color="#ffb468" intensity={0.9} distance={2.6} decay={2} />
      </group>
    </group>
  )
}

function Frame({ position, rotation = [0, 0, 0], size, kind }: { position: [number, number, number]; rotation?: [number, number, number]; size: [number, number]; kind: number }) {
  const art = useMemo(() => artTexture(kind), [kind])
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[size[0], size[1], 0.03]} />
        <meshStandardMaterial color="#1a1512" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[size[0] - 0.04, size[1] - 0.04]} />
        <meshStandardMaterial map={art} roughness={0.7} />
      </mesh>
    </group>
  )
}

/** A little wall of framed prints on the left wall. */
export function Frames() {
  const x = -ROOM.w / 2 + 0.02
  return (
    <group name="frames" position={[x, 0, 0.3]} rotation={[0, Math.PI / 2, 0]}>
      <Frame position={[0, 1.65, 0]} size={[0.5, 0.65]} kind={0} />
      <Frame position={[0.52, 1.5, 0]} size={[0.3, 0.4]} kind={1} />
      <Frame position={[-0.45, 1.45, 0]} size={[0.32, 0.4]} kind={2} />
    </group>
  )
}

/** A notebook with a pen and a stack of books on the table. */
export function Clutter() {
  return (
    <group>
      {/* notebook + pen */}
      <group position={[0.42, TABLE_TOP + 0.006, 0.12]} rotation={[0, -0.25, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.012, 0.14]} />
          <meshStandardMaterial color="#2a3a4a" roughness={0.7} />
        </mesh>
        <mesh position={[0.005, 0.0075, 0]}>
          <boxGeometry args={[0.19, 0.004, 0.13]} />
          <meshStandardMaterial color="#efe6cf" roughness={0.9} />
        </mesh>
        <mesh position={[0.02, 0.014, 0.03]} rotation={[0, 0.6, Math.PI / 2]}>
          <cylinderGeometry args={[0.004, 0.004, 0.13, 8]} />
          <meshStandardMaterial color="#b3261e" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
      {/* book stack: cloth covers around cream page blocks */}
      {[
        { y: 0.012, c: '#6e2a27', w: 0.2, r: 0.1 },
        { y: 0.036, c: '#2f5249', w: 0.18, r: -0.06 },
        { y: 0.056, c: '#9a7b38', w: 0.16, r: 0.2 },
      ].map((b, i) => (
        <group key={i} position={[0.62, TABLE_TOP + b.y, -0.4]} rotation={[0, b.r, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.w, 0.024, 0.13]} />
            <meshStandardMaterial color={b.c} roughness={0.75} />
          </mesh>
          <mesh position={[0.004, 0, 0.0]}>
            <boxGeometry args={[b.w - 0.004, 0.017, 0.134]} />
            <meshStandardMaterial color="#e8dfc8" roughness={0.95} />
          </mesh>
          <mesh position={[-b.w / 2 + 0.003, 0, 0]}>
            <boxGeometry args={[0.008, 0.026, 0.132]} />
            <meshStandardMaterial color={b.c} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Everything that makes the room feel lived-in: real Poly Haven models (CC0) around the procedural bookcase. */
export function Props() {
  return (
    <>
      <Bookcase position={[-1.8, 0, -0.74]} />
      <Frames />
      <Clutter />
      <Suspense fallback={null}>
        <Model name="calathea_orbifolia_01" maxDim={0.85} position={[1.7, 0, -0.38]} rotY={0.6} />
        <Model name="potted_plant_02" height={0.5} position={[-1.14, 0, -0.76]} rotY={3.4} />
        <Model name="potted_plant_02" height={0.3} position={[0.96, TABLE_TOP, -0.06]} rotY={0.4} />
        <Model name="WoodenChair_01" width={0.48} position={[-1.2, 0, 0.66]} rotY={2.5} />
        <Model name="wicker_basket_01" maxDim={0.5} position={[0.5, 0, -0.1]} rotY={0.4} />
        <Model name="ArmChair_01" height={0.95} position={[-1.95, 0, 1.55]} rotY={0.9} />
        <Model name="vintage_radio_transceiver" height={0.22} position={[-1.92, 1.5, -0.76]} rotY={0.25} />
        <Model name="Ukulele_01" height={0.55} position={[-1.4, 0.04, -0.52]} rotY={0.3} rotZ={0.16} />
        <Model name="mantel_clock_01" width={0.2} position={[1.14, 0.9, -0.8]} rotY={-0.3} />
        <Diya />
      </Suspense>
    </>
  )
}

/** Brass diya on the desk with a small living flame (emissive + flickering light). */
function Diya() {
  const light = useRef<PointLight>(null)
  useFrame((state) => {
    if (light.current) light.current.intensity = 0.28 + Math.sin(state.clock.elapsedTime * 11) * 0.03 + Math.sin(state.clock.elapsedTime * 4.3) * 0.04
  })
  const x = 0.86
  const z = 0.14
  return (
    <group>
      <Model name="brass_diya_lantern" height={0.2} position={[x, TABLE_TOP, z]} />
      <mesh position={[x, TABLE_TOP + 0.085, z]} scale={[0.6, 1.4, 0.6]}>
        <sphereGeometry args={[0.0065, 10, 10]} />
        <meshBasicMaterial color="#ffc766" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[x, TABLE_TOP + 0.1, z + 0.03]} color="#ffa94d" distance={1.1} decay={2} intensity={0.3} />
    </group>
  )
}
