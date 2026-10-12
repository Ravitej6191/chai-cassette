import { useMemo } from 'react'
import { CHAI_POS, DECK_POS, TABLE_TOP } from '../layout'
import { doilyTexture } from './textures'

/** Lace doilies on the table (the table itself is part of the baked room). */
export function Table() {
  const doily = useMemo(doilyTexture, [])
  return (
    <group name="table">
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
