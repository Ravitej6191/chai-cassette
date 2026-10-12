import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, type Group } from 'three'
import { RoundedBox } from '@react-three/drei'
import { FRONT_Z } from '../layout'
import { anim } from '../state/live'
import { pressKey } from '../controller/deck'
import { hoverProps } from '../scene/interaction'
import { keyTexture } from '../scene/textures'
import type { KeyName } from '../state/machine'
import { DL } from './layout'

const ICONS = { REC: 'rec', PLAY: 'play', REW: 'rew', FF: 'ff', STOP: 'stop', PAUSE: 'pause' } as const
const LABELS = { REC: 'REC', PLAY: 'PLAY', REW: 'REW', FF: 'FF', STOP: 'STOP/EJECT', PAUSE: 'PAUSE' } as const
const TRAVEL = 0.009
const KEY_D = 0.034
const KEY_Z = FRONT_Z - 0.005
const TIPS: Record<string, string> = {
  REC: 'REC — engages only together with PLAY',
  PLAY: 'PLAY (Space)',
  REW: 'REWIND (←) · hold while playing for review',
  FF: 'FAST FORWARD (→) · hold while playing to cue',
  STOP: 'STOP / EJECT (S, E)',
  PAUSE: 'PAUSE (Space)',
}

function Key({ name, index }: { name: KeyName; index: number }) {
  const g = useRef<Group>(null)
  const mats = useMemo(() => {
    const body = new MeshStandardMaterial({ color: '#cfcfcb', roughness: 0.45, metalness: 0.1 })
    const face = new MeshStandardMaterial({ map: keyTexture(ICONS[name], LABELS[name]), roughness: 0.4, metalness: 0.05 })
    // BoxGeometry face order: +x −x +y −y +z −z
    return [body, body, body, body, face, body]
  }, [name])
  useFrame(() => {
    if (g.current) g.current.position.z = KEY_Z - TRAVEL * (anim.keys[name] ?? 0)
  })
  const hp = hoverProps(TIPS[name])
  const down = (e: { stopPropagation: () => void; target?: unknown; pointerId?: number }) => {
    e.stopPropagation()
    pressKey(name, 'down')
    const up = () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      pressKey(name, 'up')
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return (
    <group ref={g} position={[DL.keys.x(index), DL.keys.y, KEY_Z]}>
      <RoundedBox args={[DL.keys.w, DL.keys.h, KEY_D]} radius={0.003} smoothness={2} material={mats} castShadow onPointerDown={down} {...hp} />
    </group>
  )
}

/** The six piano keys. PLAY/REC latch down (anim.keys is driven by the controller from the state machine). */
export function PianoKeys() {
  return (
    <group>
      {DL.keys.names.map((n, i) => (
        <Key key={n} name={n} index={i} />
      ))}
    </group>
  )
}
