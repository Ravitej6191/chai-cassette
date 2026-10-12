import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, CylinderGeometry, Group, MeshStandardMaterial, type Mesh } from 'three'
import { live } from '../state/live'
import { CASSETTE } from '../layout'
import { HUB_R, fullPackRadius, type Tape } from '../tapes/types'
import { packTexture } from '../scene/textures'

/** Pack radii for a given fraction of ribbon on the right-hand hub. */
export function packRadii(tape: Tape, rightFrac: number) {
  const full = fullPackRadius(tape.format)
  const area = full * full - HUB_R * HUB_R
  return {
    rR: Math.sqrt(HUB_R * HUB_R + rightFrac * area),
    rL: Math.sqrt(HUB_R * HUB_R + (1 - rightFrac) * area),
  }
}

const PACK_T = 0.0074
const HUB_T = 0.0092

// Shared geometry/materials: every cassette has two reels, and there can be a dozen cassettes.
const packGeo = new CylinderGeometry(1, 1, PACK_T, 56, 1)
const hubGeo = new CylinderGeometry(HUB_R, HUB_R, HUB_T, 36)
const coreGeo = new CylinderGeometry(HUB_R * 0.6, HUB_R * 0.6, HUB_T + 0.0004, 32)
const toothGeo = new BoxGeometry(0.0016, HUB_T + 0.0006, 0.0023)
let packMats: MeshStandardMaterial[] | null = null
let hubMat: MeshStandardMaterial | null = null
let coreMat: MeshStandardMaterial | null = null

function mats() {
  if (!packMats) {
    const map = packTexture()
    const side = new MeshStandardMaterial({ color: '#3a261a', roughness: 0.4, metalness: 0.15 })
    const cap = new MeshStandardMaterial({ map, roughness: 0.32, metalness: 0.18 })
    packMats = [side, cap, cap]
    hubMat = new MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.45, metalness: 0.0 })
    coreMat = new MeshStandardMaterial({ color: '#17140f', roughness: 0.8 })
  }
  return { packMats: packMats!, hubMat: hubMat!, coreMat: coreMat! }
}

interface ReelProps {
  x: number
  /** Returns [radius, angle] each frame. */
  read: () => [number, number]
}

/** One reel: tape pack that grows/shrinks plus a toothed hub that spins with it. */
function Reel({ x, read }: ReelProps) {
  const pack = useRef<Mesh>(null)
  const hub = useRef<Group>(null)
  const m = useMemo(mats, [])
  useFrame(() => {
    const [r, a] = read()
    if (pack.current) {
      pack.current.scale.set(r, 1, r)
      pack.current.rotation.y = a
    }
    if (hub.current) hub.current.rotation.y = a
  })
  return (
    <group position={[x, CASSETTE.hubDy, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh ref={pack} geometry={packGeo} material={m.packMats} />
      <group ref={hub}>
        <mesh geometry={hubGeo} material={m.hubMat} />
        <mesh geometry={coreGeo} material={m.coreMat} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2
          const rad = HUB_R * 0.6 - 0.0004
          return (
            <mesh
              key={i}
              geometry={toothGeo}
              material={m.hubMat}
              position={[Math.cos(a) * rad, 0, Math.sin(a) * rad]}
              rotation={[0, -a, 0]}
            />
          )
        })}
      </group>
    </group>
  )
}

/**
 * Both reels of a cassette. When `isLive` the radii and angles come from the running
 * transport; otherwise a static pose is derived from where the ribbon was left.
 */
export function Reels({ tape, isLive }: { tape: Tape; isLive: boolean }) {
  const stat = useMemo(() => {
    const w = tape.wound
    return packRadii(tape, tape.side === 'A' ? w : 1 - w)
  }, [tape])
  const hubX = CASSETTE.hubDx
  return (
    <>
      <Reel x={-hubX} read={() => (isLive ? [live.rL, live.angL] : [stat.rL, 0])} />
      <Reel x={hubX} read={() => (isLive ? [live.rR, live.angR] : [stat.rR, 0])} />
    </>
  )
}
