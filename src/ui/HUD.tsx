import { useEffect, useRef, useState } from 'react'
import { live } from '../state/live'
import { useDeck, TAPE_TYPE_NAMES, type TimeOfDay } from '../state/store'
import { addFiles, flipHeld, loadTape, pressKey, putBack, resetCounter } from '../controller/deck'
import type { KeyName } from '../state/machine'
import { sideSeconds } from '../tapes/types'
import type { ZoomPart } from '../layout'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Press-and-hold button for transport keys (so FF/REW cue & review work by touch/mouse). */
function KeyButton({ k, label, children }: { k: KeyName; label: string; children: React.ReactNode }) {
  const latched = useDeck((s) => {
    const m = s.machine.mode
    return (
      (k === 'PLAY' && (m === 'PLAYING' || m === 'RECORDING' || m === 'PAUSED' || m === 'CUE' || m === 'REVIEW')) ||
      (k === 'REC' && m === 'RECORDING') ||
      (k === 'PAUSE' && m === 'PAUSED') ||
      (k === 'FF' && (m === 'FF' || m === 'CUE')) ||
      (k === 'REW' && (m === 'REW' || m === 'REVIEW'))
    )
  })
  return (
    <button
      type="button"
      className={`key ${latched ? 'key--on' : ''} ${k === 'REC' ? 'key--rec' : ''}`}
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

/** Time / counter readout, refreshed 10×/s from the live (non-reactive) transport values. */
function Readout() {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [])
  const tape = useDeck((s) => s.tapes.find((t) => t.id === s.deckTapeId))
  const playSide = useDeck((s) => s.playSide)
  const total = tape ? tape.sides[playSide].duration : 0
  const c = Math.floor(((live.counterRev % 1000) + 1000) % 1000)
  return (
    <div className="readout" aria-live="off">
      <span className="readout__time">{tape ? `${mmss(live.pos)} / ${total ? mmss(total) : 'blank'}` : '--:--'}</span>
      <span className="readout__counter">CTR {String(c).padStart(3, '0')}</span>
      <span className="readout__speed">{live.rate === 0 ? '' : `${live.rate > 0 ? '+' : '−'}${Math.abs(live.rate).toFixed(1)}×`}</span>
    </div>
  )
}

function TapeList() {
  // decorative rack tapes (no programme yet) stay off the quick-load list
  const tapes = useDeck((s) => s.tapes).filter((t) => !t.id.startsWith('found-'))
  const deckId = useDeck((s) => s.deckTapeId)
  const placement = useDeck((s) => s.placement)
  return (
    <div className="tapes" role="group" aria-label="Tape shelf">
      {tapes.map((t, i) => (
        <button
          key={t.id}
          type="button"
          className={`tape-chip ${deckId === t.id ? 'tape-chip--on' : ''}`}
          onClick={() => void loadTape(t.id)}
          title={`Load “${t.title}” into the deck`}
        >
          <span className="tape-chip__dot" style={{ background: t.shellColor }} />
          <span className="tape-chip__name">{t.title}</span>
          <span className="tape-chip__meta">{t.format}{placement[t.id] === 'held' ? ' · in hand' : ''}</span>
          <kbd>{i < 9 ? i + 1 : ''}</kbd>
        </button>
      ))}
    </div>
  )
}

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

const TODS: TimeOfDay[] = ['night', 'evening', 'afternoon', 'morning', 'auto']

export function HUD() {
  const mode = useDeck((s) => s.machine.mode)
  const heldId = useDeck((s) => s.heldId)
  const hover = useDeck((s) => s.ui.hover)
  const notice = useDeck((s) => s.ui.notice)
  const bypass = useDeck((s) => s.ui.fxBypass)
  const sourceName = useDeck((s) => s.ui.sourceName)
  const quality = useDeck((s) => s.ui.quality)
  const tod = useDeck((s) => s.ui.tod)
  const rain = useDeck((s) => s.ui.rain)
  const help = useDeck((s) => s.ui.help)
  const audioReady = useDeck((s) => s.ui.audioReady)
  const patch = useDeck((s) => s.patchUi)
  const tape = useDeck((s) => s.tapes.find((t) => t.id === s.deckTapeId))
  const playSide = useDeck((s) => s.playSide)
  const settings = useDeck((s) => s.settings)
  const fileInput = useRef<HTMLInputElement>(null)
  void audioReady
  const deckId = useDeck((s) => s.deckTapeId)

  // the help card gets out of the way once a tape is in the deck
  useEffect(() => {
    if (deckId) patch({ help: false })
  }, [deckId, patch])

  return (
    <>
      <header className="hud-top">
        <h1>Chai &amp; Cassette</h1>
        <div className="hud-top__right">
          <label className="select">
            <span className="sr-only">Time of day</span>
            <select value={tod} onChange={(e) => patch({ tod: e.target.value as TimeOfDay })} aria-label="Time of day">
              {TODS.map((t) => (
                <option key={t} value={t}>
                  {t === 'auto' ? 'Time: local clock' : `Time: ${t}`}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="pill" aria-pressed={rain} onClick={() => patch({ rain: !rain })} title="Rain sound">
            {rain ? "Rain on" : "Rain off"}
          </button>
          <button type="button" className="pill" onClick={() => patch({ quality: quality === 'low' ? 'high' : quality === 'high' ? 'ultra' : 'low' })} title="Cycle graphics quality (Ultra adds ambient occlusion — needs a strong GPU)">
            {quality === 'ultra' ? 'Ultra quality' : quality === 'high' ? 'High quality' : 'Low quality'}
          </button>
          <button type="button" className="pill" onClick={() => patch({ help: !help })} aria-expanded={help}>
            ?
          </button>
        </div>
      </header>

      <ViewBar />

      {help && (
        <aside className="help" aria-label="Help">
          <strong>How it works</strong>
          <ul>
            <li>Drag an <b>MP3 / WAV</b> onto the page to make a tape — or <button type="button" className="link" onClick={() => fileInput.current?.click()}>choose a file</button>.</li>
            <li>Click a cassette to pick it up. Drag it onto the deck door (or press its number key). <kbd>F</kbd> flips, mouse-wheel turns it, <kbd>Esc</kbd> puts it back.</li>
            <li><kbd>Space</kbd> play/pause · <kbd>S</kbd> stop · <kbd>E</kbd> eject/close · hold <kbd>←</kbd>/<kbd>→</kbd> rewind/fast-forward (while playing = review/cue).</li>
            <li>Drag knobs up/down. Double-click any part to zoom; click empty space to zoom back.</li>
          </ul>
        </aside>
      )}
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
          <button type="button" className="pill" onClick={flipHeld}>Flip (F)</button>
          <button type="button" className="pill" onClick={putBack}>Put back (Esc)</button>
          <button type="button" className="pill pill--accent" onClick={() => void loadTape(heldId)}>Load it</button>
        </div>
      )}

      <footer className="hud-bottom">
        <div className="hover-tip" aria-hidden="true">{hover ?? ''}</div>
        <TapeList />
        <div className="console">
          <div className="console__status">
            <span className={`badge badge--mode badge--${mode.toLowerCase()}`}>{mode}</span>
            {tape && <span className="badge">{tape.title} · side {playSide} · {tape.format}</span>}
            <span className={`badge ${bypass ? 'badge--warn' : 'badge--fx'}`} title={bypass ? 'This source cannot be processed, so the tape effects chain is bypassed.' : 'Audio runs through the tape effects chain.'}>
              {bypass ? `FX BYPASSED · ${sourceName}` : tape ? `TAPE FX ON · ${TAPE_TYPE_NAMES[settings.tapeType]}${settings.dolby ? ' · DOLBY' : ''}` : 'NO TAPE'}
            </span>
            {settings.lowBattery && <span className="badge badge--warn">LOW BATTERY</span>}
            <Readout />
          </div>
          <div className="console__keys" role="group" aria-label="Transport keys">
            <KeyButton k="REC" label="Record (R, with Play)">●</KeyButton>
            <KeyButton k="REW" label="Rewind (hold ← while playing for review)">◀◀</KeyButton>
            <KeyButton k="PLAY" label="Play">▶</KeyButton>
            <KeyButton k="PAUSE" label="Pause (Space)">❚❚</KeyButton>
            <KeyButton k="FF" label="Fast forward (hold → while playing to cue)">▶▶</KeyButton>
            <KeyButton k="STOP" label="Stop / Eject (S, E)">■▲</KeyButton>
            <button type="button" className="key key--small" onClick={resetCounter} aria-label="Reset tape counter" title="Reset counter">0:00</button>
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
