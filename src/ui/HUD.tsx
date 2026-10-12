import { useEffect, useRef, useState } from 'react'
import { live } from '../state/live'
import { useDeck, type Quality, type TimeOfDay } from '../state/store'
import { addFiles, flipHeld, loadTape, pressKey, putBack } from '../controller/deck'
import type { KeyName } from '../state/machine'
import type { ZoomPart } from '../layout'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ---------------------------------------------------------------- transport

/** Press-and-hold key so FF/REW work as cue/review with a mouse or finger. */
function KeyButton({ k, label, children }: { k: KeyName; label: string; children: React.ReactNode }) {
  const latched = useDeck((s) => {
    const m = s.machine.mode
    return (
      (k === 'PLAY' && (m === 'PLAYING' || m === 'RECORDING' || m === 'PAUSED' || m === 'CUE' || m === 'REVIEW')) ||
      (k === 'PAUSE' && m === 'PAUSED') ||
      (k === 'FF' && (m === 'FF' || m === 'CUE')) ||
      (k === 'REW' && (m === 'REW' || m === 'REVIEW'))
    )
  })
  return (
    <button
      type="button"
      className={`key ${latched ? 'key--on' : ''}`}
      aria-label={label}
      aria-pressed={latched}
      title={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pressKey(k, 'down')
      }}
      onPointerUp={() => pressKey(k, 'up')}
      onPointerCancel={() => pressKey(k, 'up')}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault()
          pressKey(k, 'down')
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') pressKey(k, 'up')
      }}
    >
      {children}
    </button>
  )
}

/** One quiet line: what is in the deck and where it is. Refreshed 10×/s from the live transport values. */
function NowPlaying() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [])
  const mode = useDeck((s) => s.machine.mode)
  const tape = useDeck((s) => s.tapes.find((t) => t.id === s.deckTapeId))
  const side = useDeck((s) => s.playSide)
  const bypass = useDeck((s) => s.ui.fxBypass)
  const total = tape ? tape.sides[side].duration : 0
  const idle = mode === 'EMPTY' || mode === 'LOADED' || mode === 'EJECTING'
  return (
    <div className="now" aria-live="off">
      <span className={`now__dot ${!idle ? 'now__dot--on' : ''}`} aria-hidden="true" />
      <span className="now__title">{tape ? tape.title : 'No tape in the deck'}</span>
      {tape && <span className="now__meta">Side {side}</span>}
      {tape && (
        <span className="now__time">
          {mmss(live.pos)} / {total ? mmss(total) : '–:––'}
        </span>
      )}
      {bypass && (
        <span className="now__warn" title="This source cannot be processed, so the tape effects chain is bypassed.">
          FX bypassed
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- camera views

/** Guided camera views: pick one and the camera glides to a clean, front-on framing. */
const VIEWS: [string, ZoomPart | null][] = [
  ['Room', null],
  ['Deck', 'deck'],
  ['Tape', 'tape'],
  ['Controls', 'controls'],
  ['Radio', 'radio'],
  ['Meters', 'vu'],
  ['Shelf', 'rack'],
  ['Chai', 'chai'],
]

function ViewBar() {
  const zoom = useDeck((s) => s.ui.zoom)
  const patch = useDeck((s) => s.patchUi)
  return (
    <nav className="views" aria-label="Camera views">
      {VIEWS.map(([label, part]) => (
        <button key={label} type="button" className={`view ${zoom === part ? 'view--on' : ''}`} aria-pressed={zoom === part} onClick={() => patch({ zoom: part })}>
          {label}
        </button>
      ))}
    </nav>
  )
}

// ---------------------------------------------------------------- settings

const TODS: [string, TimeOfDay][] = [
  ['Night', 'night'],
  ['Evening', 'evening'],
  ['Day', 'afternoon'],
  ['Morning', 'morning'],
  ['Clock', 'auto'],
]
const QUALITIES: [string, Quality | 'auto'][] = [
  ['Auto', 'auto'],
  ['Low', 'low'],
  ['High', 'high'],
  ['Ultra', 'ultra'],
]

/** Everything that is a preference, tucked behind one button. */
function Settings() {
  const [open, setOpen] = useState(false)
  const ui = useDeck((s) => s.ui)
  const patch = useDeck((s) => s.patchUi)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  const qualityValue: Quality | 'auto' = ui.autoQuality ? 'auto' : ui.quality
  return (
    <div className="settings" ref={wrap}>
      <button type="button" className="pill" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Settings
      </button>
      {open && (
        <div className="menu" role="dialog" aria-label="Settings">
          <div className="menu__row">
            <span className="menu__label">Time of day</span>
            <div className="seg" role="group" aria-label="Time of day">
              {TODS.map(([label, v]) => (
                <button key={v} type="button" className={`seg__btn ${ui.tod === v ? 'seg__btn--on' : ''}`} aria-pressed={ui.tod === v} onClick={() => patch({ tod: v })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="menu__row">
            <span className="menu__label">
              Graphics{ui.fps ? <em> · {ui.fps} fps</em> : null}
            </span>
            <div className="seg" role="group" aria-label="Graphics quality">
              {QUALITIES.map(([label, v]) => (
                <button
                  key={v}
                  type="button"
                  className={`seg__btn ${qualityValue === v ? 'seg__btn--on' : ''}`}
                  aria-pressed={qualityValue === v}
                  onClick={() => (v === 'auto' ? patch({ autoQuality: true }) : patch({ autoQuality: false, quality: v }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="menu__row menu__row--inline">
            <span className="menu__label">Rain sound</span>
            <button type="button" className={`switch ${ui.rain ? 'switch--on' : ''}`} role="switch" aria-checked={ui.rain} aria-label="Rain sound" onClick={() => patch({ rain: !ui.rain })}>
              <span />
            </button>
          </div>
          <div className="menu__row menu__row--inline">
            <span className="menu__label">How to use</span>
            <button
              type="button"
              className="pill pill--small"
              onClick={() => {
                patch({ help: !ui.help })
                setOpen(false)
              }}
            >
              {ui.help ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function HelpCard({ onPick }: { onPick: () => void }) {
  const patch = useDeck((s) => s.patchUi)
  return (
    <aside className="help" aria-label="How to use">
      <button type="button" className="help__close" aria-label="Close help" onClick={() => patch({ help: false })}>
        ×
      </button>
      <h2>How it works</h2>
      <ul>
        <li>
          Click a cassette on the shelf to pick it up, then drag it onto the deck door — or press <kbd>Load it</kbd>.
        </li>
        <li>
          Drop an <b>MP3 / WAV</b> on the page to make your own tape, or{' '}
          <button type="button" className="link" onClick={onPick}>
            choose a file
          </button>
          .
        </li>
        <li>
          <kbd>Space</kbd> play · <kbd>S</kbd> stop · <kbd>E</kbd> eject · hold <kbd>←</kbd> <kbd>→</kbd> to rewind / fast-forward.
        </li>
        <li>
          Click the deck to move in close; <kbd>V</kbd> or the bar above cycles views; <kbd>Esc</kbd> goes back.
        </li>
      </ul>
    </aside>
  )
}

// ---------------------------------------------------------------- root

export function HUD() {
  const heldId = useDeck((s) => s.heldId)
  const hover = useDeck((s) => s.ui.hover)
  const notice = useDeck((s) => s.ui.notice)
  const help = useDeck((s) => s.ui.help)
  const patch = useDeck((s) => s.patchUi)
  const deckId = useDeck((s) => s.deckTapeId)
  const fileInput = useRef<HTMLInputElement>(null)

  // the help card gets out of the way once a tape is in the deck
  useEffect(() => {
    if (deckId) patch({ help: false })
  }, [deckId, patch])

  return (
    <>
      <header className="hud-top">
        <h1>Chai &amp; Cassette</h1>
        <Settings />
      </header>

      <ViewBar />

      {help && <HelpCard onPick={() => fileInput.current?.click()} />}
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          void addFiles(files)
        }}
      />

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {heldId && (
        <div className="hand-bar" role="group" aria-label="Held tape">
          <button type="button" className="pill" onClick={flipHeld}>
            Flip <kbd>F</kbd>
          </button>
          <button type="button" className="pill" onClick={putBack}>
            Put back <kbd>Esc</kbd>
          </button>
          <button type="button" className="pill pill--accent" onClick={() => void loadTape(heldId)}>
            Load it
          </button>
        </div>
      )}

      <footer className="hud-bottom">
        <div className="hover-tip" aria-hidden="true">
          {hover ?? ''}
        </div>
        <div className="console">
          <NowPlaying />
          <div className="console__keys" role="group" aria-label="Transport keys">
            <KeyButton k="REW" label="Rewind (hold ← while playing for review)">
              ◀◀
            </KeyButton>
            <KeyButton k="PLAY" label="Play (Space)">
              ▶
            </KeyButton>
            <KeyButton k="PAUSE" label="Pause (Space)">
              ❚❚
            </KeyButton>
            <KeyButton k="FF" label="Fast forward (hold → while playing to cue)">
              ▶▶
            </KeyButton>
            <KeyButton k="STOP" label="Stop / Eject (S, E)">
              ■
            </KeyButton>
          </div>
        </div>
      </footer>
    </>
  )
}

/** Fullscreen hint while a file is being dragged over the window. */
export function DropOverlay({ active }: { active: boolean }) {
  return active ? (
    <div className="drop" aria-hidden="true">
      <div className="drop__box">Drop an MP3 or WAV to wind a new tape</div>
    </div>
  ) : null
}
