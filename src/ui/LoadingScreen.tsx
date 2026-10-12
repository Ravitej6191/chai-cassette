import { useEffect, useState } from 'react'
import { useDeck } from '../state/store'

const VB = { x: 60, y: -10, w: 420, h: 300 }
const pct = (v: number, o: number, s: number) => `${(((v - o) / s) * 100).toFixed(3)}%`

/** One six-spoke hub, drawn in its own box so it can spin on the compositor thread. */
function Hub({ cx, cy, className }: { cx: number; cy: number; className: string }) {
  return (
    <svg
      className={`hub ${className}`}
      viewBox="-13 -13 26 26"
      style={{ left: pct(cx - 13, VB.x, VB.w), top: pct(cy - 13, VB.y, VB.h), width: pct(26, 0, VB.w), height: pct(26, 0, VB.h) }}
      aria-hidden="true"
    >
      <circle r="13" fill="#e9e6dc" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x="-2" y="-13" width="4" height="9" fill="#14110e" transform={`rotate(${a})`} />
      ))}
    </svg>
  )
}

/** A tape pack: a disc that grows/shrinks by transform (compositor), not by redrawing. */
function Pack({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const R = 29 // largest radius
  return (
    <div
      className="pack"
      style={{
        left: pct(cx - R, VB.x, VB.w),
        top: pct(cy - R, VB.y, VB.h),
        width: pct(R * 2, 0, VB.w),
        height: pct(R * 2, 0, VB.h),
        transform: `scale(${r / R})`,
      }}
    />
  )
}

/**
 * Loading splash: a cassette winding as it loads. Tape moves from the left reel to the right
 * reel and the right pack grows with progress. The motion is all CSS transform on HTML layers,
 * so it keeps running smoothly even while the page is busy compiling the 3D scene.
 */
export function LoadingScreen({ label }: { label: string }) {
  const target = useDeck((s) => s.ui.progress)
  const ready = useDeck((s) => s.ui.ready)
  // never go backwards (boot and asset loading report separately), and never jump
  const [p, setP] = useState(0.02)
  useEffect(() => setP((v) => Math.max(v, Math.max(0.02, Math.min(1, target)))), [target])
  useEffect(() => {
    const t = setInterval(() => setP((v) => Math.min(0.97, v + 0.004)), 120) // keeps creeping so it never looks stuck
    return () => clearInterval(t)
  }, [])
  const rL = (46 - 24 * p) * 0.62
  const rR = (22 + 24 * p) * 0.62
  return (
    <div className={`loading ${ready ? 'loading--done' : ''}`} role="status" aria-live="polite">
      <div className="loading__art">
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="loading__svg" aria-hidden="true">
          <defs>
            <radialGradient id="cass-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffb340" stopOpacity="0.28" />
              <stop offset="60%" stopColor="#ffb340" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffb340" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="270" cy="140" rx="230" ry="165" fill="url(#cass-glow)" />
          <rect x="150" y="60" width="240" height="160" rx="12" fill="#2b2623" stroke="#6a5a48" strokeWidth="3" />
          <rect x="170" y="74" width="200" height="62" rx="6" fill="#efe6cf" />
          <rect x="170" y="74" width="200" height="12" fill="#c0392b" />
          <text x="186" y="118" fontFamily="Caveat, cursive" fontSize="26" fill="#1d3a8a">
            Chai &amp; Cassette
          </text>
          <rect x="190" y="150" width="160" height="58" rx="10" fill="#14110e" />
        </svg>
        <Pack cx={235} cy={179} r={rL} />
        <Pack cx={305} cy={179} r={rR} />
        <Hub cx={235} cy={179} className="hub--left" />
        <Hub cx={305} cy={179} className="hub--right" />
      </div>
      <p className="loading__label">{label}…</p>
    </div>
  )
}
