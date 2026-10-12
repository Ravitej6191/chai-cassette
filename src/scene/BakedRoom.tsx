/**
 * The static room (walls, floor, ceiling, rug, skirting, table) as one mesh whose lighting was
 * rendered offline in Blender (tools/blender/room.py → public/assets/models/room_baked.glb +
 * tex/room_light.webp). Soft shadows, bounce light and ambient occlusion come from a path-traced
 * lightmap, so these surfaces cost almost nothing at runtime and look far richer than live lights.
 * Anything that moves or is interactive is still drawn live on top.
 */
import { useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import { Color, DoubleSide, Mesh, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { ASSET_BASE } from './assets'
import { rugTexture } from './textures'
import bakeInfo from './lightmap.json'

// colour multipliers used when the lightmap was baked (linear RGB), per Blender material
const TINT: Record<string, [number, number, number]> = {
  floor: [0.85, 0.78, 0.69],
  wall: [0.8, 0.75, 0.65],
  ceiling: [0.55, 0.5, 0.42],
  skirting: [0.09, 0.05, 0.025],
  table_top: [1, 1, 1],
  table_dark: [0.8, 0.71, 0.6],
  table_apron: [0.6, 0.5, 0.41],
  rug: [1, 1, 1],
}
const PBR: Record<string, string> = {
  floor: 'old_wooden_floor_02',
  wall: 'painted_plaster_wall',
  table_top: 'wood_table_001',
  table_dark: 'dark_wood',
  table_apron: 'dark_wood',
}

function prep(t: Texture, srgb: boolean, repeat: boolean) {
  const c = t.clone()
  c.flipY = false // glTF UVs are already top-left based
  c.colorSpace = srgb ? SRGBColorSpace : c.colorSpace
  if (repeat) c.wrapS = c.wrapT = RepeatWrapping
  c.anisotropy = 8
  c.needsUpdate = true
  return c
}

export function BakedRoom() {
  const gltf = useGLTF(`${ASSET_BASE}models/room_baked.glb`)
  const maps = useTexture({
    light: `${ASSET_BASE}tex/room_light.webp`,
    floor: `${ASSET_BASE}tex/old_wooden_floor_02/diff.webp`,
    wall: `${ASSET_BASE}tex/painted_plaster_wall/diff.webp`,
    wood: `${ASSET_BASE}tex/wood_table_001/diff.webp`,
    dark: `${ASSET_BASE}tex/dark_wood/diff.webp`,
  })
  const scene = useMemo(() => {
    const light = prep(maps.light, true, false)
    light.channel = 1
    const tex: Record<string, Texture> = {
      floor: prep(maps.floor, true, true),
      wall: prep(maps.wall, true, true),
      table_top: prep(maps.wood, true, true),
      table_dark: prep(maps.dark, true, true),
      table_apron: prep(maps.dark, true, true),
    }
    const rug = rugTexture()
    rug.flipY = false
    rug.needsUpdate = true
    tex.rug = rug
    const root = gltf.scene.clone(true)
    root.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const name = (Array.isArray(m.material) ? m.material[0] : m.material).name
      const t = TINT[name] ?? [1, 1, 1]
      m.material = new MeshBasicMaterial({
        map: tex[name] ?? null,
        color: new Color().setRGB(t[0], t[1], t[2]),
        lightMap: light,
        lightMapIntensity: bakeInfo.scale * LIGHT_GAIN,
        side: DoubleSide,
      })
      m.castShadow = false
      m.receiveShadow = false
      m.frustumCulled = false
    })
    void PBR
    return root
  }, [gltf, maps])
  return <primitive object={scene} />
}

/** Overall brightness trim of the baked lighting relative to the live HDR/tone-mapped scene. */
const LIGHT_GAIN = 6
