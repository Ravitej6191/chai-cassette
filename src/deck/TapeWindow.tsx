import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, type Group, type Mesh } from 'three'
import { CAVITY, CASSETTE, LOADED_LOCAL } from '../layout'
import { live } from '../state/live'
import { useDeck } from '../state/store'
import { HUB_R } from '../tapes/types'

const BZ = CAVITY.backZ
const HEAD_Y = -0.0372
const CAPSTAN_R = 0.002
const ROLLER_R = 0.0055

const spindleGeo = new CylinderGeometry(HUB_R * 0.58, HUB_R * 0.58, 0.011, 28)

/**
 * The inside of the cassette compartment: spindles that grip the reel hubs, the head
 * block, the spinning capstan and the rubber pinch roller that presses against it.
 */
export function TapeWindow() {
  const capstan = useRef<Group>(null)
  const roller = useRef<Group>(null)
  const spinL = useRef<Group>(null)
  const spinR = useRef<Group>(null)
  const spindleY = LOADED_LOCAL.y + CASSETTE.hubDy
  const capX = CAVITY.x + 0.028
  const teeth = useMemo(() => [0, 1, 2, 3, 4, 5], [])

  useFrame(() => {
    const mode = useDeck.getState().machine.mode
    const engaged = mode === 'PLAYING' || mode === 'RECORDING' || mode === 'CUE' || mode === 'REVIEW' || mode === 'PAUSED'
    if (capstan.current) capstan.current.rotation.z = live.capstanAngle
    if (roller.current) {
      roller.current.rotation.z = -live.capstanAngle * (CAPSTAN_R / ROLLER_R)
      const target = capX + CAPSTAN_R + ROLLER_R + (engaged ? 0 : 0.0045)
      roller.current.position.x += (target - roller.current.position.x) * 0.25
    }
    if (spinL.current) spinL.current.rotation.y = live.angL
    if (spinR.current) spinR.current.rotation.y = live.angR
  })

  const metal = { color: '#c9ccd0', metalness: 1, roughness: 0.28 } as const

  return (
    <group>
      {/* spindles (white toothed hubs on the back wall) */}
      {[
        { x: CAVITY.x - CASSETTE.hubDx, ref: spinL },
        { x: CAVITY.x + CASSETTE.hubDx, ref: spinR },
      ].map(({ x, ref }) => (
        <group key={x} position={[x, spindleY, BZ + 0.0055]} rotation={[Math.PI / 2, 0, 0]}>
          <group ref={ref}>
            <mesh geometry={spindleGeo}>
              <meshStandardMaterial color="#e9e6dc" roughness={0.5} />
            </mesh>
            {teeth.map((i) => {
              const a = (i / 6) * Math.PI * 2
              return (
                <mesh key={i} position={[Math.cos(a) * HUB_R * 0.58, 0, Math.sin(a) * HUB_R * 0.58]} rotation={[0, -a, 0]}>
                  <boxGeometry args={[0.0018, 0.0112, 0.0024]} />
                  <meshStandardMaterial color="#e9e6dc" roughness={0.5} />
                </mesh>
              )
            })}
          </group>
        </group>
      ))}

      {/* head block: erase + record/play heads and guide posts */}
      <group position={[CAVITY.x, HEAD_Y, BZ + 0.006]}>
        <mesh>
          <boxGeometry args={[0.02, 0.0075, 0.012]} />
          <meshStandardMaterial color="#202226" roughness={0.5} metalness={0.5} />
        </mesh>
        {[-0.0055, 0.0055].map((x) => (
          <mesh key={x} position={[x, 0, 0.0068]}>
            <boxGeometry args={[0.0042, 0.0045, 0.0025]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        ))}
        {[-0.013, 0.013].map((x) => (
          <mesh key={`p${x}`} position={[x, 0.0005, 0.003]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0011, 0.0011, 0.012, 10]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        ))}
      </group>

      {/* capstan: slotted so its rotation is visible */}
      <group ref={capstan} position={[capX, HEAD_Y, BZ + 0.0075]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[CAPSTAN_R, CAPSTAN_R, 0.015, 14]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        <mesh position={[0, 0, 0.0076]}>
          <boxGeometry args={[0.0042, 0.0007, 0.0004]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>

      {/* pinch roller: rubber with a steel hub and a marker so it visibly turns */}
      <group ref={roller} position={[capX + CAPSTAN_R + ROLLER_R + 0.0045, HEAD_Y, BZ + 0.0075]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[ROLLER_R, ROLLER_R, 0.012, 24]} />
          <meshStandardMaterial color="#0e0e0e" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.0062]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0028, 0.0028, 0.0006, 16]} />
          <meshStandardMaterial {...metal} />
        </mesh>
        <mesh position={[0.0016, 0, 0.0066]}>
          <boxGeometry args={[0.0018, 0.0006, 0.0004]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
    </group>
  )
}

export type { Mesh }
