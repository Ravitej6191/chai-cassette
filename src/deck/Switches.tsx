import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { FRONT_Z } from '../layout'
import { controlsLive, hoverProps } from '../scene/interaction'
import { sfx } from '../sfx/sfx'
import { TAPE_TYPE_NAMES, useDeck, type TapeType } from '../state/store'
import { DL } from './layout'

/** A little toggle: chrome lever on a black base that tilts ±0.55 rad with a spring ease. */
export function Toggle({ x, y, on, onToggle, label }: { x: number; y: number; on: boolean; onToggle: () => void; label: string }) {
  const lever = useRef<Group>(null)
  useFrame(() => {
    if (lever.current) lever.current.rotation.x = MathUtils.lerp(lever.current.rotation.x, on ? -0.55 : 0.55, 0.3)
  })
  const hp = hoverProps(label)
  return (
    <group
      position={[x, y, FRONT_Z]}
      onPointerDown={(e) => {
        if (!controlsLive()) return
        e.stopPropagation()
        sfx.switchFlip()
        onToggle()
      }}
      {...hp}
    >
      <mesh position={[0, 0, 0.0016]} castShadow>
        <boxGeometry args={[0.014, 0.019, 0.0034]} />
        <meshStandardMaterial color="#0c0c0d" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.0036]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0042, 0.0045, 0.0016, 18]} />
        <meshStandardMaterial color="#b9bcc0" metalness={1} roughness={0.3} />
      </mesh>
      <group ref={lever} position={[0, 0, 0.0044]}>
        <mesh position={[0, 0, 0.0055]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0016, 0.0022, 0.011, 12]} />
          <meshStandardMaterial color="#d6d8db" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.0112]}>
          <sphereGeometry args={[0.0028, 14, 10]} />
          <meshStandardMaterial color="#d6d8db" metalness={1} roughness={0.2} />
        </mesh>
      </group>
      {/* tiny indicator dot that lights when engaged */}
      <mesh position={[0, 0.0128, 0.0035]}>
        <sphereGeometry args={[0.0013, 8, 8]} />
        <meshStandardMaterial color="#331a00" emissive="#ff9a1f" emissiveIntensity={on ? 2.2 : 0} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Three-position slide switch (tape type I / II / IV). Click a notch to move the slider there. */
export function SlideSwitch3({ x, y, value, onChange }: { x: number; y: number; value: TapeType; onChange: (v: TapeType) => void }) {
  const knob = useRef<Group>(null)
  useFrame(() => {
    if (knob.current) knob.current.position.x = MathUtils.lerp(knob.current.position.x, (value - 1) * 0.025, 0.3)
  })
  const hp = hoverProps(`Tape type: ${TAPE_TYPE_NAMES[value]} — click to change`)
  return (
    <group position={[x, y, FRONT_Z]} {...hp}>
      <mesh
        position={[0, 0, 0.0012]}
        castShadow
        onPointerDown={(e) => {
          if (!controlsLive()) return
          e.stopPropagation()
          const lx = e.object.worldToLocal(e.point.clone()).x
          const next = (lx < -0.0125 ? 0 : lx > 0.0125 ? 2 : 1) as TapeType
          if (next !== value) {
            sfx.switchFlip()
            onChange(next)
          } else onChange(((value + 1) % 3) as TapeType)
        }}
      >
        <boxGeometry args={[0.066, 0.011, 0.003]} />
        <meshStandardMaterial color="#0c0c0d" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.0029]}>
        <boxGeometry args={[0.056, 0.0022, 0.0006]} />
        <meshStandardMaterial color="#000" />
      </mesh>
      <group ref={knob} position={[0, 0, 0.0033]}>
        <mesh castShadow>
          <boxGeometry args={[0.012, 0.0085, 0.0045]} />
          <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.28} />
        </mesh>
        {[-0.003, 0, 0.003].map((o) => (
          <mesh key={o} position={[o, 0, 0.0024]}>
            <boxGeometry args={[0.0004, 0.0072, 0.0004]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Dolby, auto-reverse and low-battery toggles, plus the tape-type slider. */
export function Switches() {
  const s = useDeck((st) => st.settings)
  const set = useDeck((st) => st.setSetting)
  return (
    <group>
      <Toggle x={DL.toggles.x[0]} y={DL.toggles.y} on={s.dolby} onToggle={() => set('dolby', !s.dolby)} label={`Dolby NR ${s.dolby ? 'ON' : 'OFF'} — less hiss`} />
      <Toggle x={DL.toggles.x[1]} y={DL.toggles.y} on={s.autoReverse} onToggle={() => set('autoReverse', !s.autoReverse)} label={`Auto-reverse ${s.autoReverse ? 'ON' : 'OFF'}`} />
      <Toggle x={DL.toggles.x[2]} y={DL.toggles.y} on={s.lowBattery} onToggle={() => set('lowBattery', !s.lowBattery)} label={`Low-battery mode ${s.lowBattery ? 'ON' : 'OFF'} — slow & flat`} />
      <SlideSwitch3 x={DL.slider.x} y={DL.slider.y} value={s.tapeType} onChange={(v) => set('tapeType', v)} />
    </group>
  )
}
