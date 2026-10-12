import { useMemo } from 'react'
import { DoubleSide, Path, Shape, ShapeGeometry } from 'three'
import { CALENDAR_POS, ROOM, WINDOW } from '../layout'
import { calendarTexture, canvas, rugTexture, toTexture } from './textures'
import { usePbr } from './assets'

/** Back wall with a rectangular opening for the window. */
function BackWall() {
  const geo = useMemo(() => {
    const hw = ROOM.w / 2
    const s = new Shape()
    s.moveTo(-hw, 0)
    s.lineTo(hw, 0)
    s.lineTo(hw, ROOM.h)
    s.lineTo(-hw, ROOM.h)
    s.closePath()
    const hole = new Path()
    const x0 = WINDOW.x - WINDOW.w / 2
    const x1 = WINDOW.x + WINDOW.w / 2
    const y0 = WINDOW.y - WINDOW.h / 2
    const y1 = WINDOW.y + WINDOW.h / 2
    hole.moveTo(x0, y0)
    hole.lineTo(x0, y1)
    hole.lineTo(x1, y1)
    hole.lineTo(x1, y0)
    hole.closePath()
    s.holes.push(hole)
    const g = new ShapeGeometry(s)
    // ShapeGeometry UVs are in metres; scale so the wall texture tiles sensibly
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5)
    return g
  }, [])
  const tex = usePbr('painted_plaster_wall', [1.9, 1.9])
  return (
    <mesh geometry={geo} position={[0, 0, ROOM.backZ]} receiveShadow>
      <meshStandardMaterial {...tex} color="#cdbfa6" />
    </mesh>
  )
}

function Calendar() {
  const tex = useMemo(() => calendarTexture(), [])
  return (
    <group position={CALENDAR_POS} rotation={[0, 0, 0.01]}>
      {/* hanging nail + backing card */}
      <mesh position={[0, 0.02, -0.004]} castShadow>
        <boxGeometry args={[0.34, 0.48, 0.006]} />
        <meshStandardMaterial color="#e8dcc0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0.0]} receiveShadow>
        <planeGeometry args={[0.32, 0.455]} />
        <meshStandardMaterial map={tex} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.265, 0.004]}>
        <cylinderGeometry args={[0.004, 0.004, 0.34, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Clock() {
  const face = useMemo(() => {
    const [c, g] = canvas(256, 256)
    g.fillStyle = '#f2ead0'
    g.beginPath()
    g.arc(128, 128, 124, 0, 6.3)
    g.fill()
    g.fillStyle = '#222'
    g.font = 'bold 34px Georgia'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96)
    }
    return toTexture(c)
  }, [])
  const now = new Date()
  const m = now.getMinutes() / 60
  const h = ((now.getHours() % 12) + m) / 12
  return (
    <group position={[1.85, 2.15, ROOM.backZ + 0.03]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 40]} />
        <meshStandardMaterial color="#3a2414" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.0205]}>
        <circleGeometry args={[0.135, 40]} />
        <meshStandardMaterial map={face} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.024]} rotation={[0, 0, -h * Math.PI * 2]}>
        <boxGeometry args={[0.012, 0.075, 0.003]} />
        <meshStandardMaterial color="#111" />
        <mesh position={[0, 0.0375, 0]} />
      </mesh>
      <mesh position={[0, 0, 0.026]} rotation={[0, 0, -m * Math.PI * 2]}>
        <boxGeometry args={[0.008, 0.11, 0.003]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  )
}

/** The living room shell: floor, walls, ceiling, rug, skirting, calendar and wall clock. */
export function Room() {
  const floor = usePbr('old_wooden_floor_02', [3, 3])
  const rugTex = useMemo(rugTexture, [])
  const wall = usePbr('painted_plaster_wall', [2.6, 1.4])
  const rug = useMemo(() => {
    const [c, g] = canvas(512, 512)
    g.fillStyle = '#6b1f1f'
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = '#d9b36a'
    g.lineWidth = 8
    g.strokeRect(24, 24, 464, 464)
    g.lineWidth = 3
    g.strokeRect(48, 48, 416, 416)
    g.fillStyle = '#2b3a67'
    g.beginPath()
    g.moveTo(256, 90)
    g.lineTo(420, 256)
    g.lineTo(256, 422)
    g.lineTo(92, 256)
    g.closePath()
    g.fill()
    g.strokeStyle = '#d9b36a'
    g.lineWidth = 5
    g.stroke()
    g.fillStyle = '#d9b36a'
    g.beginPath()
    g.arc(256, 256, 38, 0, 6.3)
    g.fill()
    const img = g.getImageData(0, 0, 512, 512)
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26
      img.data[i] += n
      img.data[i + 1] += n
      img.data[i + 2] += n
    }
    g.putImageData(img, 0, 0)
    return toTexture(c)
  }, [])
  const midZ = (ROOM.backZ + ROOM.backZ + ROOM.d) / 2
  const hw = ROOM.w / 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial {...floor} color="#d9c6b0" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.2]} receiveShadow>
        <planeGeometry args={[2.8, 2.0]} />
        <meshStandardMaterial map={rugTex} roughness={0.98} />
      </mesh>
      <BackWall />
      <mesh position={[-hw, ROOM.h / 2, midZ]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial {...wall} color="#cdbfa6" />
      </mesh>
      <mesh position={[hw, ROOM.h / 2, midZ]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM.d, ROOM.h]} />
        <meshStandardMaterial {...wall} color="#cdbfa6" />
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.backZ + ROOM.d]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
        <meshStandardMaterial {...wall} color="#cdbfa6" />
      </mesh>
      <mesh position={[0, ROOM.h, midZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial color="#c9bfa8" roughness={1} side={DoubleSide} />
      </mesh>
      {/* skirting boards */}
      <mesh position={[0, 0.06, ROOM.backZ + 0.012]} receiveShadow>
        <boxGeometry args={[ROOM.w, 0.12, 0.024]} />
        <meshStandardMaterial color="#4a2f1b" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (hw - 0.012), 0.06, midZ]}>
          <boxGeometry args={[0.024, 0.12, ROOM.d]} />
          <meshStandardMaterial color="#4a2f1b" roughness={0.6} />
        </mesh>
      ))}
      <Calendar />
      <Clock />
    </group>
  )
}
