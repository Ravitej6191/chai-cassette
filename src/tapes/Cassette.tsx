import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Vector2,
  Vector3,
  Plane,
  Raycaster,
  type Mesh,
} from 'three'
import { Reels } from '../deck/Reels'
import { packRadii } from './reelMath'
import { useDeck } from '../state/store'
import { live } from '../state/live'
import { held, flipHeld, insertHeld, pickUp, putBack } from '../controller/deck'
import { faceTexture } from './labelTextures'
import { CASSETTE, DECK_POS, HELD_POS, HELD_SCALE, LOADED_LOCAL, RACK_POS, cradlePose, loadedPose, slotPose } from '../layout'
import { HUB_R, type Tape } from './types'
import { hoverProps, lockOrbit } from '../scene/interaction'

const GUIDE_X = 0.0285
const GUIDE_Y = -0.0288
const SIDE_T = CASSETTE.t / 2

// Shared geometry
const labelGeo = new PlaneGeometry(CASSETTE.w, CASSETTE.h)
const screwGeo = new CylinderGeometry(0.0021, 0.0021, 0.0006, 14)
const rollerGeo = new CylinderGeometry(0.0017, 0.0017, 0.0062, 14)
const ribbonGeo = new BoxGeometry(1, 1, 1)
const ribbonMat = new MeshStandardMaterial({ color: '#1b100a', roughness: 0.3, metalness: 0.3 })
const screwMat = new MeshStandardMaterial({ color: '#b7b7b7', metalness: 0.9, roughness: 0.35 })
const rollerMat = new MeshStandardMaterial({ color: '#eeeeea', roughness: 0.4 })

/** Thin box between two 2D points in the cassette plane. */
function setSegment(mesh: Mesh | null, ax: number, ay: number, bx: number, by: number) {
  if (!mesh) return
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  mesh.visible = len > 0.0004
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, 0)
  mesh.rotation.z = Math.atan2(dy, dx)
  mesh.scale.set(len, 0.00055, 0.0038)
}

/** The strand of tape between each pack and the guide rollers, plus the open span across the front. */
function Ribbon({ tape, isLive }: { tape: Tape; isLive: boolean }) {
  const a = useRef<Mesh>(null)
  const b = useRef<Mesh>(null)
  const stat = useMemo(() => packRadii(tape, tape.side === 'A' ? tape.wound : 1 - tape.wound), [tape])
  useFrame(() => {
    const rL = isLive ? live.rL : stat.rL
    const rR = isLive ? live.rR : stat.rR
    const hx = CASSETTE.hubDx
    const hy = CASSETTE.hubDy
    // start each strand on the pack, on the line toward its guide roller
    const dl = Math.hypot(-GUIDE_X + hx, GUIDE_Y - hy)
    const pl = { x: -hx + ((-GUIDE_X + hx) / dl) * rL, y: hy + ((GUIDE_Y - hy) / dl) * rL }
    const dr = Math.hypot(GUIDE_X - hx, GUIDE_Y - hy)
    const pr = { x: hx + ((GUIDE_X - hx) / dr) * rR, y: hy + ((GUIDE_Y - hy) / dr) * rR }
    setSegment(a.current, pl.x, pl.y, -GUIDE_X, GUIDE_Y)
    setSegment(b.current, pr.x, pr.y, GUIDE_X, GUIDE_Y)
  })
  return (
    <>
      <mesh ref={a} geometry={ribbonGeo} material={ribbonMat} />
      <mesh ref={b} geometry={ribbonGeo} material={ribbonMat} />
      <mesh geometry={ribbonGeo} material={ribbonMat} position={[0, GUIDE_Y, 0]} scale={[GUIDE_X * 2, 0.00055, 0.0038]} />
    </>
  )
}

// ---------------------------------------------------------------- pose spring

const _q = new Quaternion()
const _qa = new Quaternion()
const _e = new Euler()
const _v = new Vector3()

interface Pose {
  pos: Vector3
  quat: Quaternion
  scale: number
}

/** Target pose of a tape for its placement. `held` is read live (drag/rotate). */
function poseFor(tape: Tape, placement: string, t: number): Pose {
  switch (placement) {
    case 'held': {
      const base = held.dragTarget ?? HELD_POS
      const bob = Math.sin(t * 1.7) * 0.003
      const yaw = (tape.side === 'B' ? Math.PI : 0) + held.yaw
      _qa.setFromEuler(_e.set(0, yaw, 0))
      _q.setFromEuler(_e.set(-0.5 + held.tilt, 0, 0))
      return { pos: new Vector3(base.x, base.y + bob, base.z), quat: _q.clone().multiply(_qa), scale: HELD_SCALE }
    }
    case 'cradle':
      return cradlePose(tape.side)
    case 'loaded':
      return loadedPose(tape.side)
    default:
      return slotPose(Math.max(0, tape.slot))
  }
}

const ndc = new Vector2()
const ray = new Raycaster()
const plane = new Plane()

interface Props {
  id: string
}

export function Cassette({ id }: Props) {
  const tape = useDeck((s) => s.tapes.find((t) => t.id === id))
  const placement = useDeck((s) => s.placement[id] ?? 'shelf')
  const isDeckTape = useDeck((s) => s.deckTapeId === id)
  const root = useRef<Group>(null)
  const shellMat = useRef<MeshPhysicalMaterial>(null)
  const { camera, gl } = useThree()
  const vel = useRef(new Vector3())
  const prevPos = useRef<Vector3>(new Vector3(0, -10, 0))
  const initialised = useRef(false)

  const textures = useMemo(
    () => (tape ? { A: faceTexture(tape, 'A'), B: faceTexture(tape, 'B') } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tape?.id, tape?.title, tape?.sides.A.title, tape?.sides.A.duration, tape?.sides.B.title, tape?.sides.B.duration],
  )
  useEffect(
    () => () => {
      textures?.A.dispose()
      textures?.B.dispose()
    },
    [textures],
  )

  const labelMats = useMemo(() => {
    if (!textures) return null
    const mk = (map: typeof textures.A) =>
      new MeshStandardMaterial({ map, transparent: true, alphaTest: 0.02, roughness: 0.55, metalness: 0, side: DoubleSide, depthWrite: false })
    return { A: mk(textures.A), B: mk(textures.B) }
  }, [textures])

  const shell = useMemo(
    () =>
      tape
        ? new MeshPhysicalMaterial({
            color: tape.shellColor,
            transparent: true,
            opacity: 0.38,
            roughness: 0.12,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            depthWrite: false,
          })
        : null,
    [tape?.shellColor], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const plateMat = useMemo(
    () => (tape ? new MeshStandardMaterial({ color: tape.shellColor, roughness: 0.35, metalness: 0.0 }) : null),
    [tape?.shellColor], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // poses for rack / cradle / deck never change while the placement does not, so build them once
  const fixed = useMemo(
    () => (tape && placement !== 'held' ? poseFor(tape, placement, 0) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placement, tape?.slot, tape?.side],
  )

  // ---- follow the target pose with a damped spring
  useFrame((state, dt) => {
    const g = root.current
    if (!g || !tape) return
    dt = Math.min(dt, 0.05)
    const target = fixed ?? poseFor(tape, placement, state.clock.elapsedTime)
    if (!initialised.current) {
      g.position.copy(target.pos)
      g.quaternion.copy(target.quat)
      g.scale.setScalar(target.scale)
      initialised.current = true
    }
    // spring: a = k (x* − x) − c v
    const k = placement === 'held' ? 180 : 230
    const c = placement === 'held' ? 22 : 21
    _v.copy(target.pos).sub(g.position).multiplyScalar(k)
    _v.addScaledVector(vel.current, -c)
    vel.current.addScaledVector(_v, dt)
    g.position.addScaledVector(vel.current, dt)
    // orientation: slerp, plus a little lag-tilt from sideways velocity when held
    let q = target.quat
    if (placement === 'held') {
      _qa.setFromEuler(_e.set(vel.current.z * 0.5, 0, -vel.current.x * 0.7))
      q = _qa.multiply(target.quat.clone())
    }
    g.quaternion.slerp(q, 1 - Math.exp(-dt * 13))
    g.scale.setScalar(g.scale.x + (target.scale - g.scale.x) * (1 - Math.exp(-dt * 10)))
    prevPos.current.copy(g.position)
  })

  if (!tape || !labelMats || !shell || !plateMat) return null
  const isLive = isDeckTape && (placement === 'loaded' || placement === 'cradle')
  const label = `${tape.title}${tape.isDemo ? '' : ''} · ${tape.format}`

  // ---- interaction
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (placement === 'shelf' || placement === 'cradle') {
      e.stopPropagation()
      pickUp(id)
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (placement !== 'held') return
    e.stopPropagation()
    lockOrbit(true)
    const g = root.current!
    const normal = camera.getWorldDirection(new Vector3()).negate()
    plane.setFromNormalAndCoplanarPoint(normal, g.position)
    held.dragTarget = g.position.clone()
    const rect = gl.domElement.getBoundingClientRect()
    const hit = new Vector3()
    const move = (ev: PointerEvent) => {
      ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.ray.intersectPlane(plane, hit)) held.dragTarget = hit.clone()
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      lockOrbit(false)
      const toScreen = (p: Vector3) => {
        const v = p.clone().project(camera)
        return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height }
      }
      const door = toScreen(DECK_POS.clone().add(LOADED_LOCAL))
      const rack = toScreen(RACK_POS.clone().add(new Vector3(0, 0.12, 0)))
      const dDoor = Math.hypot(ev.clientX - door.x, ev.clientY - door.y)
      const dRack = Math.hypot(ev.clientX - rack.x, ev.clientY - rack.y)
      held.dragTarget = null
      if (dDoor < Math.max(90, rect.height * 0.12)) void insertHeld()
      else if (dRack < Math.max(110, rect.height * 0.16)) putBack()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const hp = hoverProps(placement === 'held' ? 'Drag into the door · wheel/arrows rotate · F flips' : `${label} — click to pick up`)

  return (
    <group
      ref={root}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        if (placement === 'held') {
          e.stopPropagation()
          flipHeld()
        }
      }}
      onWheel={(e) => {
        if (placement === 'held') held.yaw += e.deltaY * 0.004
      }}
      onPointerOver={(e) => {
        hp.onPointerOver(e)
        if (shellMat.current) shellMat.current.emissive.set('#3a2a10')
      }}
      onPointerOut={() => {
        hp.onPointerOut()
        if (shellMat.current) shellMat.current.emissive.set('#000000')
      }}
    >
      {/* translucent shell */}
      <RoundedBox args={[CASSETTE.w, CASSETTE.h, CASSETTE.t]} radius={0.0026} smoothness={3} castShadow renderOrder={1}>
        <primitive object={shell} ref={shellMat} attach="material" />
      </RoundedBox>
      {/* front & back label art (with the tape window cut out) */}
      <mesh geometry={labelGeo} material={labelMats.A} position={[0, 0, SIDE_T + 0.0002]} renderOrder={3} />
      <mesh geometry={labelGeo} material={labelMats.B} position={[0, 0, -SIDE_T - 0.0002]} rotation={[0, Math.PI, 0]} renderOrder={3} />
      {/* opaque chin and side blocks around the open tape-access slot */}
      <mesh position={[0, -0.0307, 0]} material={plateMat}>
        <boxGeometry args={[0.0825, 0.0026, CASSETTE.t + 0.0004]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.0415, -0.0272, 0]} material={plateMat}>
          <boxGeometry args={[0.0105, 0.0096, CASSETTE.t + 0.0004]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`r${s}`} geometry={rollerGeo} material={rollerMat} position={[s * GUIDE_X, GUIDE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      {/* corner screws on both faces */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].flatMap((sy) =>
          [-1, 1].map((sz) => (
            <mesh
              key={`${sx}${sy}${sz}`}
              geometry={screwGeo}
              material={screwMat}
              position={[sx * 0.0462, sy * 0.0268, sz * (SIDE_T + 0.0003)]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          )),
        ),
      )}
      <Reels tape={tape} isLive={isLive} />
      <Ribbon tape={tape} isLive={isLive} />
      {/* hub-guard rings give the window its moulded look */}
      {[-1, 1].map((s) => (
        <mesh key={`ring${s}`} position={[s * CASSETTE.hubDx, CASSETTE.hubDy, SIDE_T - 0.0006]}>
          <ringGeometry args={[HUB_R + 0.0006, HUB_R + 0.0017, 40]} />
          <meshStandardMaterial color="#1a1612" roughness={0.6} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
