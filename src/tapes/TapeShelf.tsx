import { RACK, RACK_POS } from '../layout'
import { useDeck } from '../state/store'
import { usePbr } from '../scene/assets'
import { viewProps } from '../scene/interaction'
import { Cassette } from './Cassette'

const WIDTH = RACK.cols * RACK.colPitch + 0.03
const BACK_Z = -0.05

/**
 * Stepped wooden display rack (3 tiers × 4 cassettes) on the table. Also owns the
 * <Cassette> instances: every tape in the store is rendered here and moves between
 * rack, hand, cradle and deck by following its placement.
 */
export function TapeShelf() {
  const ids = useDeck((s) => s.tapes.map((t) => t.id).join('|'))
  const wood = usePbr('dark_wood', [0.5, 0.5])
  const tiers = Array.from({ length: RACK.tiers }, (_, t) => t)
  const front = (t: number) => 0.075 - t * 0.035 + 0.032
  return (
    <>
      <group name="rack" position={RACK_POS} {...viewProps('rack')}>
        {/* back panel */}
        <mesh position={[0, 0.12, BACK_Z]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH + 0.03, 0.245, 0.012]} />
          <meshStandardMaterial {...wood} color="#b99a7c" roughness={0.6} />
        </mesh>
        {tiers.map((t) => {
          const d = front(t) - BACK_Z
          const zc = (front(t) + BACK_Z) / 2
          return (
            <group key={t}>
              {/* shelf board */}
              <mesh position={[0, t * RACK.tierPitch + 0.005, zc]} castShadow receiveShadow>
                <boxGeometry args={[WIDTH, 0.01, d]} />
                <meshStandardMaterial {...wood} color="#c4a583" roughness={0.55} />
              </mesh>
              {/* front lip */}
              <mesh position={[0, t * RACK.tierPitch + 0.0125, front(t) - 0.003]} castShadow>
                <boxGeometry args={[WIDTH, 0.012, 0.006]} />
                <meshStandardMaterial {...wood} color="#a98a6c" roughness={0.55} />
              </mesh>
              {/* side slab for this tier: builds the staircase silhouette */}
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * (WIDTH / 2 + 0.006), (t + 0.5) * RACK.tierPitch, zc]} castShadow receiveShadow>
                  <boxGeometry args={[0.012, RACK.tierPitch, d]} />
                  <meshStandardMaterial {...wood} color="#ae8f70" roughness={0.6} />
                </mesh>
              ))}
            </group>
          )
        })}
      </group>
      {ids.split('|').filter(Boolean).map((id) => (
        <Cassette key={id} id={id} />
      ))}
    </>
  )
}
