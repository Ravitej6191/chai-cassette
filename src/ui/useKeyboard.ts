import { useEffect } from 'react'
import { flipHeld, held, loadTape, pressKey, playPause, putBack } from '../controller/deck'
import { useDeck } from '../state/store'

/**
 * Global keyboard map:  Space play/pause · S stop · E eject/close door · R record (with play)
 * ←/→ rewind / fast-forward (hold while playing for review / cue) · 1–9 load tape · F flip
 * held tape · Esc put the held tape back / zoom out.
 */
export function useKeyboard() {
  useEffect(() => {
    const target = (e: KeyboardEvent) => e.target as HTMLElement | null
    const typing = (e: KeyboardEvent) => {
      const t = target(e)
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')
    }
    const onDown = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return
      // let focused buttons handle Space/Enter themselves
      const onButton = target(e)?.tagName === 'BUTTON'
      const s = useDeck.getState()
      switch (e.key) {
        case ' ':
          if (onButton) return
          e.preventDefault()
          if (!e.repeat) playPause()
          break
        case 's':
        case 'S':
          if (!e.repeat) pressKey('STOP')
          break
        case 'e':
        case 'E':
          if (!e.repeat) pressKey('STOP')
          break
        case 'r':
        case 'R':
          if (!e.repeat) pressKey('REC')
          break
        case 'p':
        case 'P':
          if (!e.repeat) pressKey('PLAY')
          break
        case 'ArrowRight':
          e.preventDefault()
          if (s.heldId) held.yaw += 0.35
          else if (!e.repeat) pressKey('FF', 'down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (s.heldId) held.yaw -= 0.35
          else if (!e.repeat) pressKey('REW', 'down')
          break
        case 'f':
        case 'F':
        case 'ArrowUp':
        case 'ArrowDown':
          if (s.heldId) flipHeld()
          break
        case 'l':
        case 'L':
          if (s.heldId) void loadTape(s.heldId)
          else if (s.tapes[0]) void loadTape(s.deckTapeId ?? s.tapes[0].id)
          break
        case 'v':
        case 'V': {
          const order = [null, 'deck', 'tape', 'controls', 'radio', 'vu', 'rack', 'chai'] as const
          const i = order.indexOf(s.ui.zoom as (typeof order)[number])
          s.patchUi({ zoom: order[(i + 1) % order.length] })
          break
        }
        case 'Escape':
          if (s.heldId) putBack()
          else if (s.ui.zoom) s.patchUi({ zoom: null })
          break
        default:
          if (/^[1-9]$/.test(e.key)) {
            const t = s.tapes[Number(e.key) - 1]
            if (t) void loadTape(t.id)
          }
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !useDeck.getState().heldId) pressKey('FF', 'up')
      if (e.key === 'ArrowLeft' && !useDeck.getState().heldId) pressKey('REW', 'up')
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])
}
