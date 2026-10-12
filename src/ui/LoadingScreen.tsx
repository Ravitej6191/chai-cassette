import { useDeck } from '../state/store'

/**
 * Loading splash: a cassette being wound by hand with a pencil. The pencil turns the
 * left hub, tape moves across to the right reel, and the right pack grows with progress.
 */
export function LoadingScreen({ label }: { label: string }) {
  const progress = useDeck((s) => s.ui.progress)
  const ready = useDeck((s) => s.ui.ready)
  const p = Math.max(0.02, Math.min(1, progress))
  const rL = 46 - 24 * p
  const rR = 22 + 24 * p
  return (
    <div className={`loading ${ready ? 'loading--done' : ''}`} role="status" aria-live="polite">
      <svg viewBox="0 0 420 300" className="loading__svg" aria-hidden="true">
        {/* pencil, wiggling as it turns the hub */}
        <g className="pencil">
          <polygon points="150,150 95,128 95,172" fill="#e8c36a" />
          <polygon points="98,134 80,150 98,166" fill="#f1dcc0" />
          <polygon points="80,150 70,150 80,146" fill="#333" />
          <rect x="-30" y="132" width="125" height="36" fill="#d9a21b" rx="3" />
          <rect x="-30" y="132" width="125" height="8" fill="#e9bd4a" />
          <rect x="-48" y="132" width="18" height="36" fill="#d96b6b" rx="3" />
          <rect x="-32" y="132" width="4" height="36" fill="#b9b9b9" />
        </g>
        {/* cassette body */}
        <rect x="150" y="60" width="240" height="160" rx="12" fill="#2b2623" stroke="#6a5a48" strokeWidth="3" />
        <rect x="170" y="74" width="200" height="62" rx="6" fill="#efe6cf" />
        <rect x="170" y="74" width="200" height="12" fill="#c0392b" />
        <text x="186" y="118" fontFamily="Caveat, cursive" fontSize="26" fill="#1d3a8a">
          Chai &amp; Cassette
        </text>
        <rect x="190" y="150" width="160" height="58" rx="10" fill="#14110e" />
        {/* tape */}
        <line x1={235 - rL * 0.2} y1={179 + rL * 0.95} x2={305 + rR * 0.2} y2={179 + rR * 0.95} stroke="#3a261a" strokeWidth="2" />
        {/* reels */}
        <g transform={`translate(235 179)`}>
          <circle r={rL * 0.62} fill="#3a261a" />
          <g className="reel reel--left">
            <circle r="13" fill="#e9e6dc" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <rect key={a} x="-2" y="-13" width="4" height="9" fill="#14110e" transform={`rotate(${a})`} />
            ))}
          </g>
        </g>
        <g transform={`translate(305 179)`}>
          <circle r={rR * 0.62} fill="#3a261a" />
          <g className="reel reel--right">
            <circle r="13" fill="#e9e6dc" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <rect key={a} x="-2" y="-13" width="4" height="9" fill="#14110e" transform={`rotate(${a})`} />
            ))}
          </g>
        </g>
      </svg>
      <div className="loading__bar" aria-hidden="true">
        <div className="loading__fill" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <p className="loading__label">{label}…</p>
    </div>
  )
}
