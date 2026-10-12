import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import gsap from 'gsap'
import { Vector3 } from 'three'
import { DECK_POS, DEFAULT_CAM, RACK_POS, CHAI_POS, ZOOM_PARTS, type ZoomPart } from '../layout'
import { useDeck } from '../state/store'
import { rig, syncOrbit } from './interaction'

/** World-space point a zoom target looks at. */
export function zoomFocus(part: ZoomPart): Vector3 {
  if (part === 'rack') return RACK_POS.clone().add(new Vector3(0, 0.12, 0.03))
  if (part === 'chai') return CHAI_POS.clone().add(new Vector3(0, 0.07, 0))
  const [x, y, z] = ZOOM_PARTS[part].local
  return DECK_POS.clone().add(new Vector3(x, y, z))
}

/** Free-look range used in the room. */
const widenLimits = () => {
  const c = rig.controls
  if (!c) return
  c.minAzimuthAngle = -0.95
  c.maxAzimuthAngle = 0.95
  c.minPolarAngle = 0.6
  c.maxPolarAngle = 1.52
  c.minDistance = 0.25
  c.maxDistance = 4.4
}

/** In a focus view the camera may only drift a little around the framed position, so the view stays tidy. */
const tightenLimits = (dist: number) => {
  const c = rig.controls
  if (!c) return
  const az = c.getAzimuthalAngle()
  const po = c.getPolarAngle()
  c.minAzimuthAngle = az - 0.28
  c.maxAzimuthAngle = az + 0.28
  c.minPolarAngle = po - 0.16
  c.maxPolarAngle = po + 0.16
  c.minDistance = dist * 0.78
  c.maxDistance = dist * 1.25
}

/** How much farther back to stand so the deck still fits a narrow (portrait) viewport. */
const fitFor = (aspect: number) => Math.min(2, Math.max(1, 1.25 / Math.max(aspect, 0.01)))

function defaultPose(aspect: number) {
  const k = fitFor(aspect)
  const t = DEFAULT_CAM.target
  return { pos: t.clone().add(DEFAULT_CAM.pos.clone().sub(t).multiplyScalar(k)), target: t.clone() }
}

/**
 * Camera rig: intro dolly from the doorway, believable orbit limits, double-click zoom
 * to a part (click empty space to return) and a barely-there handheld sway.
 */
export function CameraRig() {
  const { camera } = useThree()
  const zoom = useDeck((s) => s.ui.zoom)
  const ready = useDeck((s) => s.ui.ready)
  const reduced = useDeck((s) => s.ui.reducedMotion)
  const holding = useDeck((s) => s.heldId !== null)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const controls = useRef<{ target: Vector3; update: () => void } | null>(null)
  const tween = useRef<gsap.core.Timeline | null>(null)
  const introPlayed = useRef(false)

  const flyTo = (pos: Vector3, target: Vector3, duration: number, ease = 'power3.inOut', onDone?: () => void) => {
    const c = controls.current
    if (!c) return
    tween.current?.kill()
    rig.moving = true
    syncOrbit()
    const dur = reduced ? Math.min(0.25, duration) : duration
    tween.current = gsap.timeline({
      onComplete: () => {
        rig.moving = false
        syncOrbit()
        onDone?.()
      },
    })
    tween.current.to(camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: dur, ease }, 0)
    tween.current.to(c.target, { x: target.x, y: target.y, z: target.z, duration: dur, ease, onUpdate: () => c.update() }, 0)
  }

  // initial placement: in the doorway, far from the table
  useEffect(() => {
    camera.position.set(0.5, 1.72, 3.55)
    controls.current?.target.set(0.0, 1.05, -0.2)
    controls.current?.update()
  }, [camera])

  // intro dolly once the loading screen is gone
  useEffect(() => {
    if (!ready || introPlayed.current) return
    introPlayed.current = true
    const skip = () => tween.current?.progress(1)
    window.addEventListener('pointerdown', skip, { once: true })
    const d = defaultPose(aspect)
    flyTo(d.pos, d.target, 6.5, 'power2.inOut', () => {
      useDeck.getState().patchUi({ introDone: true })
      window.removeEventListener('pointerdown', skip)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // focus view / back to the room
  useEffect(() => {
    if (!useDeck.getState().ui.introDone) return
    widenLimits() // free the camera while it travels
    if (zoom) {
      const f = zoomFocus(zoom)
      const d = ZOOM_PARTS[zoom].dist * fitFor(aspect)
      // nearly front-on, a touch above, so every control is easy to see and hit
      flyTo(new Vector3(f.x, f.y + d * 0.1, f.z + d * 0.99), f, 1.1, 'power3.inOut', () => tightenLimits(d))
    } else {
      const d = defaultPose(aspect)
      flyTo(d.pos, d.target, 1.1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // rotating a phone / resizing the window: re-frame the default view
  useEffect(() => {
    const s = useDeck.getState().ui
    if (!s.introDone || s.zoom) return
    const d = defaultPose(aspect)
    flyTo(d.pos, d.target, 0.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.round(aspect * 10)])

  // subtle handheld sway — applied after OrbitControls has aimed the camera each frame
  useFrame((state) => {
    if (reduced || rig.moving) return
    const t = state.clock.elapsedTime
    camera.rotateX(Math.sin(t * 0.62) * 0.0016 + Math.sin(t * 1.7) * 0.0005)
    camera.rotateY(Math.sin(t * 0.47 + 1) * 0.0018 + Math.sin(t * 1.3) * 0.0006)
  })

  return (
    <OrbitControls
      ref={(c) => {
        controls.current = c as unknown as typeof controls.current
        rig.controls = c as never
      }}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.45}
      enableZoom={!holding}
      minDistance={0.25}
      maxDistance={4.4}
      minPolarAngle={0.6}
      maxPolarAngle={1.52}
      minAzimuthAngle={-0.95}
      maxAzimuthAngle={0.95}
    />
  )
}
