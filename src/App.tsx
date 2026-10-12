import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { Scene } from './scene/Scene'
import { HUD, DropOverlay } from './ui/HUD'
import { LoadingScreen } from './ui/LoadingScreen'
import { useKeyboard } from './ui/useKeyboard'
import { addFiles, bootstrap } from './controller/deck'
import { useDeck } from './state/store'

export default function App() {
  const quality = useDeck((s) => s.ui.quality)
  const dprCap = useDeck((s) => s.ui.dprCap)
  const ready = useDeck((s) => s.ui.ready)
  const patch = useDeck((s) => s.patchUi)
  const [label, setLabel] = useState('Sharpening pencils')
  const [booted, setBooted] = useState(false)
  const [dragging, setDragging] = useState(false)
  useKeyboard()

  // boot: fonts, demo tape synthesis, saved tapes — then let the splash fade
  useEffect(() => {
    let alive = true
    const t0 = performance.now()
    void bootstrap((f, l) => {
      if (!alive) return
      patch({ progress: f })
      setLabel(l)
    }).then(async () => {
      // keep the winding animation on screen for at least a moment
      const wait = Math.max(0, 1600 - (performance.now() - t0))
      await new Promise((r) => setTimeout(r, wait))
      if (alive) setBooted(true)
    })
    return () => {
      alive = false
    }
  }, [patch])

  // the scene mounts after boot; keep the splash up until its textures/models (Poly Haven CC0) have streamed in
  const { active, total, progress: assetPct } = useProgress()
  useEffect(() => {
    if (!booted || ready) return
    patch({ progress: 0.8 + 0.2 * (assetPct / 100) })
    setLabel('Unpacking the room')
  }, [booted, ready, assetPct, patch])
  useEffect(() => {
    if (!booted || ready) return
    const done = total > 0 && !active
    // a slow network must not trap you behind the splash screen forever
    const t = setTimeout(() => patch({ ready: true }), done ? 150 : 20000)
    return () => clearTimeout(t)
  }, [booted, ready, active, total, patch])

  // drag-and-drop audio files anywhere on the page
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth++
      setDragging(true)
    }
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      void addFiles(Array.from(e.dataTransfer?.files ?? []))
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return (
    <>
      <div className="stage">
        {booted && (
          <Canvas
            shadows={quality === 'low' ? 'basic' : 'percentage'}
            dpr={quality === 'low' ? 1 : [1, quality === 'ultra' ? dprCap + 0.25 : dprCap]}
            camera={{ fov: 45, near: 0.02, far: 40, position: [0.5, 1.72, 3.55] }}
            gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}
            onCreated={(state) => {
              // dev-only handles for poking at the renderer from the console
              if (import.meta.env.DEV) Object.assign(window, { __gl: state.gl, __scene: state.scene, __r3f: state })
            }}
            onPointerMissed={() => {
              const s = useDeck.getState()
              if (s.ui.zoom) s.patchUi({ zoom: null })
            }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        )}
      </div>
      {ready && <HUD />}
      <DropOverlay active={dragging} />
      {!ready && <LoadingScreen label={label} />}
    </>
  )
}
