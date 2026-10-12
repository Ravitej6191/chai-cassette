/**
 * Small shared helpers for pointer interaction with 3D parts: orbit locking while a
 * control is being dragged, hover cursors/labels, and the camera rig handle.
 */
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useDeck } from '../state/store'
import type { ZoomPart } from '../layout'

export const rig = {
  controls: null as OrbitControlsImpl | null,
  /** Number of active reasons to keep the orbit controls disabled. */
  locks: 0,
  /** Camera tween / intro in progress. */
  moving: false,
}

export function lockOrbit(lock: boolean) {
  rig.locks = Math.max(0, rig.locks + (lock ? 1 : -1))
  syncOrbit()
}

export function syncOrbit() {
  if (rig.controls) rig.controls.enabled = rig.locks === 0 && !rig.moving
}

/** Hover handlers: pointer cursor + a floating label in the HUD. */
export function hoverProps(label: string, cursor = 'pointer') {
  return {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      document.body.style.cursor = cursor
      useDeck.getState().patchUi({ hover: label })
    },
    onPointerOut: () => {
      document.body.style.cursor = ''
      useDeck.getState().patchUi({ hover: null })
    },
  }
}

/** Double-click a part to zoom the camera to it. */
export function zoomProps(part: ZoomPart) {
  return {
    onDoubleClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      useDeck.getState().patchUi({ zoom: part })
    },
  }
}

/** True once the camera is in a focus view — controls only respond then, so the first click just frames the part. */
export const controlsLive = () => useDeck.getState().ui.zoom !== null

/**
 * Click a part from the room to frame it (the "entry" view, default the part itself); double-click to jump to a
 * specific sub-part from any focus view.
 */
export function viewProps(part: ZoomPart, entry: ZoomPart = part) {
  return {
    onClick: (e: { stopPropagation: () => void }) => {
      const s = useDeck.getState()
      if (s.ui.zoom === null && s.heldId === null) {
        e.stopPropagation()
        s.patchUi({ zoom: entry })
      }
    },
    onDoubleClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      useDeck.getState().patchUi({ zoom: part })
    },
  }
}
