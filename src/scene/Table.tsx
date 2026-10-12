import { useMemo } from 'react'
import { CHAI_POS, DECK_POS, TABLE_TOP } from '../layout'
import { doilyTexture } from './textures'
import { usePbr } from './assets'

const TOP = { w: 2.2, d: 0.8, t: 0.05, z: -0.1 }

/** Wooden table with a lace doily under the deck and a small one under the chai. */
export function Table() {
  const top = usePbr('wood_table_001', [2, 1])
  const legs = usePbr('dark_wood', [0.4, 1.2])
  const doily = useMemo(doilyTexture, [])
  const legX = TOP.w / 2 - 0.09
  const legZ = TOP.d / 2 - 0.08
  return (
    <group name="table">
      <mesh position={[0, TABLE_TOP - TOP.t / 2, TOP.z]} castShadow receiveShadow>
        <boxGeometry args={[TOP.w, TOP.t, TOP.d]} />
        <meshStandardMaterial {...top} />
      </mesh>
      {/* bevelled edge lip */}
      <mesh position={[0, TABLE_TOP - TOP.t - 0.02, TOP.z]} castShadow>
        <boxGeometry args={[TOP.w - 0.12, 0.08, TOP.d - 0.12]} />
        <meshStandardMaterial {...legs} color="#9a8068" />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * legX, (TABLE_TOP - TOP.t) / 2, TOP.z + sz * legZ]} castShadow>
            <cylinderGeometry args={[0.035, 0.024, TABLE_TOP - TOP.t, 14]} />
            <meshStandardMaterial {...legs} color="#cdb49a" />
          </mesh>
        )),
      )}
      {/* big oval doily under the deck */}
      <mesh position={[DECK_POS.x, TABLE_TOP + 0.0012, DECK_POS.z + 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.62, 1]} receiveShadow>
        <planeGeometry args={[1.06, 1.06]} />
        <meshStandardMaterial map={doily} transparent alphaTest={0.4} roughness={0.95} />
      </mesh>
      {/* small doily under the chai */}
      <mesh position={[CHAI_POS.x, TABLE_TOP + 0.0016, CHAI_POS.z]} rotation={[-Math.PI / 2, 0, 0.6]} receiveShadow>
        <planeGeometry args={[0.3, 0.3]} />
        <meshStandardMaterial map={doily} transparent alphaTest={0.4} roughness={0.95} />
      </mesh>
    </group>
  )
}
