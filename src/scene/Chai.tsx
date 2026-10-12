import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, LatheGeometry, Vector2, type Points } from 'three'
import { CHAI_POS } from '../layout'
import { useDeck } from '../state/store'
import { softDot } from './textures'
import { hoverProps, viewProps } from './interaction'

/** Steel tumbler of chai on a dabarah (saucer-bowl), with rising steam. */
export function Chai() {
  const tumbler = useMemo(() => {
    const p = [
      [0.0, 0.0], [0.03, 0.0], [0.032, 0.004], [0.034, 0.012], [0.0345, 0.04], [0.0385, 0.082],
      [0.0405, 0.094], [0.0425, 0.0975], [0.0405, 0.1], [0.0385, 0.097], [0.0375, 0.09],
      [0.0335, 0.02], [0.0, 0.012],
    ].map(([x, y]) => new Vector2(x, y)).reverse()
    return new LatheGeometry(p, 48)
  }, [])
  const dabarah = useMemo(() => {
    const p = [
      [0.0, 0.0], [0.04, 0.0], [0.06, 0.004], [0.075, 0.016], [0.082, 0.026], [0.086, 0.028],
      [0.088, 0.0265], [0.085, 0.0245], [0.078, 0.014], [0.062, 0.0035], [0.0, 0.0025],
    ].map(([x, y]) => new Vector2(x, y)).reverse()
    return new LatheGeometry(p, 56)
  }, [])

  return (
    <group name="chai" position={CHAI_POS} {...viewProps('chai')} {...hoverProps('Chai — still hot')}>
      <mesh geometry={dabarah} position={[0, 0.002, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#cdd1d7" metalness={0.3} roughness={0.3} envMapIntensity={2.2} emissive="#34373d" emissiveIntensity={0.6} side={2} />
      </mesh>
      <mesh geometry={tumbler} position={[0, 0.014, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d4d8de" metalness={0.3} roughness={0.26} envMapIntensity={2.2} emissive="#3a3d44" emissiveIntensity={0.7} side={2} />
      </mesh>
      {/* the tea itself */}
      <mesh position={[0, 0.014 + 0.084, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0372, 40]} />
        <meshStandardMaterial color="#9a5f26" roughness={0.18} metalness={0} />
      </mesh>
      <mesh position={[0.008, 0.014 + 0.0845, 0.004]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.014, 24]} />
        <meshStandardMaterial color="#c99a5c" roughness={0.9} transparent opacity={0.55} />
      </mesh>
      <Steam />
    </group>
  )
}

/** A handful of soft sprites that rise, widen and fade. */
function Steam() {
  const ref = useRef<Points>(null)
  const quality = useDeck((s) => s.ui.quality)
  const N = quality === 'low' ? 10 : 26
  const tex = useMemo(softDot, [])
  const { geo, data } = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('color', new BufferAttribute(new Float32Array(N * 4), 4))
    const data = Array.from({ length: N }, (_, i) => ({
      t: i / N,
      x: (Math.random() - 0.5) * 0.04,
      z: (Math.random() - 0.5) * 0.04,
      w: Math.random() * 6,
      sp: 0.1 + Math.random() * 0.05,
    }))
    return { geo, data }
  }, [N])
  useFrame((_, dt) => {
    const pos = geo.attributes.position as BufferAttribute
    const col = geo.attributes.color as BufferAttribute
    for (let i = 0; i < N; i++) {
      const p = data[i]
      p.t += dt * p.sp * 1.4
      if (p.t > 1) {
        p.t -= 1
        p.x = (Math.random() - 0.5) * 0.04
        p.z = (Math.random() - 0.5) * 0.04
      }
      const y = 0.11 + p.t * 0.2
      pos.setXYZ(i, p.x + Math.sin(p.t * 7 + p.w) * 0.012 * p.t, y, p.z + Math.cos(p.t * 5 + p.w) * 0.01 * p.t)
      const a = Math.sin(p.t * Math.PI) * 0.22
      col.setXYZW(i, 1, 0.95, 0.88, a)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false} raycast={() => null}>
      <pointsMaterial map={tex} size={0.075} vertexColors transparent depthWrite={false} blending={AdditiveBlending} sizeAttenuation />
    </points>
  )
}
