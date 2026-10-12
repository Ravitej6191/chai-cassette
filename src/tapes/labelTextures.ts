/**
 * Canvas artwork for a cassette's two faces and its J-card.
 * Faces are drawn with an alpha cut-out so the reels show through the tape window.
 */
import type { CanvasTexture } from 'three'
import { canvas, toTexture } from '../scene/textures'
import { rng } from './generator'
import type { Side, Tape } from './types'

export const FACE_W = 1024
export const FACE_H = 642
const PX_MM = FACE_W / 102.2
const X = (mm: number) => (mm + 51.1) * PX_MM
const Y = (mm: number) => (32 - mm) * PX_MM

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Shrink the font until the text fits `maxW`. */
function fit(g: CanvasRenderingContext2D, text: string, font: string, size: number, maxW: number) {
  let s = size
  do {
    g.font = `${s}px "${font}", cursive`
    s -= 2
  } while (g.measureText(text).width > maxW && s > 18)
}

/** One face of the cassette. */
export function drawFace(tape: Tape, side: Side): HTMLCanvasElement {
  const [c, g] = canvas(FACE_W, FACE_H)
  const info = tape.sides[side]
  const r = rng(tape.id.length * 977 + (side === 'A' ? 1 : 2) + tape.title.length)

  // label paper
  g.save()
  roundRect(g, X(-46), Y(30), 92 * PX_MM, 20.5 * PX_MM, 14)
  g.fillStyle = tape.labelColor
  g.fill()
  g.clip()
  // paper fibre
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(90,60,20,${r() * 0.05})`
    g.fillRect(X(-46) + r() * 92 * PX_MM, Y(30) + r() * 20 * PX_MM, 2 + r() * 14, 1)
  }
  // colour stripe along the top + brand
  g.fillStyle = tape.stripeColor
  g.fillRect(X(-46), Y(30), 92 * PX_MM, 4.6 * PX_MM)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.font = 'bold 34px "Special Elite", Arial, sans-serif'
  g.textAlign = 'left'
  g.fillText(tape.brand, X(-43), Y(26.6))
  g.textAlign = 'right'
  g.font = 'bold 30px "Special Elite", Arial, sans-serif'
  g.fillText(`${tape.format}  ·  TYPE I  ·  NR`, X(44), Y(26.6))
  // side letter in a rounded square
  g.fillStyle = '#1a1a1a'
  roundRect(g, X(-44), Y(23.6), 11 * PX_MM, 11 * PX_MM, 10)
  g.fill()
  g.fillStyle = tape.labelColor
  g.font = 'bold 96px "Special Elite", Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(side, X(-38.5), Y(18.2) + 6)
  g.textBaseline = 'alphabetic'
  // ruled lines
  g.strokeStyle = 'rgba(60,70,120,0.35)'
  g.lineWidth = 2
  for (const y of [20.6, 16.4, 12.2]) {
    g.beginPath()
    g.moveTo(X(-31), Y(y))
    g.lineTo(X(44), Y(y))
    g.stroke()
  }
  // handwriting
  g.save()
  g.translate(X(-30), Y(21))
  g.rotate(-0.012 + r() * 0.02)
  g.fillStyle = tape.ink
  g.textAlign = 'left'
  const blank = info.duration === 0 && !info.title
  const title = blank ? '' : info.title || tape.title
  if (title) {
    fit(g, title, tape.font, 66, 72 * PX_MM)
    g.fillText(title, 0, 0)
    g.font = `38px "${tape.font}", cursive`
    g.fillText(info.duration ? `${mmss(info.duration)}  —  ${tape.artist || (tape.isDemo ? 'synth tanpura & tabla' : 'my favourites')}` : tape.artist, 6, 4.2 * PX_MM)
  } else {
    g.font = `44px "${tape.font}", cursive`
    g.globalAlpha = 0.65
    g.fillText('— blank side —', 10, 2)
  }
  g.restore()
  g.restore()

  // tape window frame: dark border, transparent inside
  g.save()
  g.fillStyle = 'rgba(14,12,10,0.88)'
  g.beginPath()
  roundRect(g, X(-41), Y(10), 82 * PX_MM, 33.5 * PX_MM, 26)
  roundRect(g, X(-38.5), Y(7.6), 77 * PX_MM, 28.5 * PX_MM, 18)
  g.fill('evenodd')
  g.restore()

  // bottom plate hole markings & write-protect notches are 3D; draw small arrows + serial
  g.fillStyle = 'rgba(30,25,20,0.75)'
  g.font = '30px "Special Elite", Arial, sans-serif'
  g.textAlign = 'left'
  g.fillText(`▸ ${side === 'A' ? '1' : '2'}`, X(-47), Y(-27))
  return c
}

export function faceTexture(tape: Tape, side: Side): CanvasTexture {
  return toTexture(drawFace(tape, side), { aniso: 8 })
}

/** The paper J-card insert: cover art, title, track list. */
export function drawJCard(tape: Tape): HTMLCanvasElement {
  const W = 700
  const H = 728
  const [c, g] = canvas(W, H)
  const r = rng(tape.title.length * 131 + 9)
  g.fillStyle = tape.labelColor
  g.fillRect(0, 0, W, H)
  // generated cover: concentric arches + sun, in the tape's stripe colour
  const sky = g.createLinearGradient(0, 0, 0, 380)
  sky.addColorStop(0, tape.stripeColor)
  sky.addColorStop(1, '#f2b45a')
  g.fillStyle = sky
  g.fillRect(24, 24, W - 48, 360)
  g.globalAlpha = 0.5
  for (let i = 7; i > 0; i--) {
    g.fillStyle = i % 2 ? '#1c1020' : '#fff1c9'
    g.beginPath()
    g.arc(W / 2, 384, i * 46, Math.PI, 0)
    g.fill()
  }
  g.globalAlpha = 1
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`
    g.beginPath()
    g.arc(30 + r() * (W - 60), 30 + r() * 150, 1 + r() * 2.4, 0, 6.3)
    g.fill()
  }
  g.fillStyle = '#16101a'
  g.fillRect(24, 330, W - 48, 54)
  g.fillStyle = tape.labelColor
  g.font = 'bold 34px "Special Elite", Arial'
  g.textAlign = 'center'
  g.fillText(tape.brand, W / 2, 366)

  g.fillStyle = tape.ink
  fit(g, tape.title, tape.font, 78, W - 80)
  g.textAlign = 'center'
  g.fillText(tape.title, W / 2, 462)
  g.textAlign = 'left'
  g.font = `40px "${tape.font}", cursive`
  let y = 520
  for (const s of ['A', 'B'] as Side[]) {
    const si = tape.sides[s]
    g.fillText(`${s}.  ${si.duration ? si.title || tape.title : '— blank —'}`, 50, y)
    g.textAlign = 'right'
    g.fillText(si.duration ? mmss(si.duration) : '', W - 50, y)
    g.textAlign = 'left'
    y += 58
  }
  g.strokeStyle = 'rgba(60,40,20,0.25)'
  g.lineWidth = 2
  g.strokeRect(10, 10, W - 20, H - 20)
  return c
}
