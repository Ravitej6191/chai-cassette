/**
 * Loaders for the downloaded CC0 Poly Haven assets in /public/assets (see ASSETS.json and the README).
 *  - usePbr(id, repeat): colour + roughness + normal maps as a spreadable material-props object
 *  - <Model name height …>: loads a glTF, scales it to a real-world height and sits it on y = 0
 */
import { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { Box3, Group, NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector3, type Mesh, type Texture } from 'three'
import { SkeletonUtils } from 'three-stdlib'

export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`

type Maps = { map: Texture; roughnessMap: Texture; normalMap: Texture }

/** PBR texture set `public/assets/tex/<id>/{diff,rough,nor}.jpg`, tiled `repeat` times. */
export function usePbr(id: string, repeat: [number, number]): Maps {
  const t = useTexture({
    map: `${ASSET_BASE}tex/${id}/diff.jpg`,
    roughnessMap: `${ASSET_BASE}tex/${id}/rough.jpg`,
    normalMap: `${ASSET_BASE}tex/${id}/nor.jpg`,
  }) as Maps
  return useMemo(() => {
    const out = {} as Maps
    for (const key of Object.keys(t) as (keyof Maps)[]) {
      const c = t[key].clone() // share the image, but tile independently of other users of the same set
      c.wrapS = c.wrapT = RepeatWrapping
      c.repeat.set(repeat[0], repeat[1])
      c.anisotropy = 8
      c.colorSpace = key === 'map' ? SRGBColorSpace : NoColorSpace
      c.needsUpdate = true
      out[key] = c
    }
    return out
  }, [t, repeat[0], repeat[1]]) // eslint-disable-line react-hooks/exhaustive-deps
}

interface ModelProps {
  name: string
  /** Target height in metres (ignored if maxDim is given). */
  height?: number
  /** Fit the largest dimension to this many metres — for wide, low models like ground plants. */
  maxDim?: number
  /** Fit the X width to this many metres — for models whose height bounding box is unreliable. */
  width?: number
  position?: [number, number, number]
  rotY?: number
  rotZ?: number
  castShadow?: boolean
}

/** A Poly Haven glTF scaled to `height`, centred on x/z and resting on y = 0. */
export function Model({ name, height = 1, maxDim, width, position = [0, 0, 0], rotY = 0, rotZ = 0, castShadow = true }: ModelProps) {
  const gltf = useGLTF(`${ASSET_BASE}models/${name}/${name}.gltf`)
  const obj = useMemo(() => {
    const inner = SkeletonUtils.clone(gltf.scene) as Group
    const box = new Box3().setFromObject(inner)
    const size = box.getSize(new Vector3())
    if (import.meta.env.DEV) console.info(`[model] ${name} raw size`, size.toArray().map((v) => +v.toFixed(2)))
    inner.scale.setScalar(width ? width / (size.x || 1) : maxDim ? maxDim / (Math.max(size.x, size.y, size.z) || 1) : height / (size.y || 1))
    box.setFromObject(inner)
    inner.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    inner.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) {
        m.castShadow = castShadow
        m.receiveShadow = true
      }
    })
    const g = new Group()
    g.add(inner)
    return g
  }, [gltf, height, maxDim, width, castShadow])
  return <primitive object={obj} position={position} rotation={[0, rotY, rotZ]} />
}
