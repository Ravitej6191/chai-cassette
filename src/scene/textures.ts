/**
 * Procedural textures, all drawn on canvas — no image assets.
 * Each factory returns THREE textures ready to plug into PBR materials.
 */
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'
import { rng } from '../tapes/generator'

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

export function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}): CanvasTexture {
  const t = new CanvasTexture(c)
  if (opts.srgb !== false) t.colorSpace = SRGBColorSpace
  if (opts.repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(...opts.repeat)
  } else {
    t.wrapS = t.wrapT = ClampToEdgeWrapping
  }
  t.anisotropy = opts.aniso ?? 8
  t.minFilter = LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

/** Warm, grainy wooden table top (colour + bump). */
export function woodTextures(): { map: Texture; bump: Texture } {
  const W = 1024
  const H = 512
  const [c, g] = canvas(W, H)
  const [b, bg] = canvas(W, H)
  const r = rng(7)
  g.fillStyle = '#5e4330'
  g.fillRect(0, 0, W, H)
  bg.fillStyle = '#808080'
  bg.fillRect(0, 0, W, H)
  // long grain lines with slow wobble
  for (let i = 0; i < 520; i++) {
    const y0 = r() * H
    const amp = 2 + r() * 8
    const f = 0.004 + r() * 0.008
    const ph = r() * 6
    const dark = r() < 0.55
    g.strokeStyle = dark ? `rgba(32,20,12,${0.04 + r() * 0.13})` : `rgba(190,150,110,${0.03 + r() * 0.07})`
    g.lineWidth = 0.6 + r() * 2.2
    g.beginPath()
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
    }
    g.stroke()
    bg.strokeStyle = dark ? 'rgba(40,40,40,0.35)' : 'rgba(200,200,200,0.2)'
    bg.lineWidth = g.lineWidth
    bg.beginPath()
    for (let x = 0; x <= W; x += 8) {
      const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.25
      x === 0 ? bg.moveTo(x, y) : bg.lineTo(x, y)
    }
    bg.stroke()
  }
  // a couple of knots
  for (let i = 0; i < 3; i++) {
    const x = r() * W
    const y = r() * H
    for (let k = 6; k > 0; k--) {
      g.strokeStyle = `rgba(30,14,5,${0.1 + k * 0.03})`
      g.lineWidth = 1.5
      g.beginPath()
      g.ellipse(x, y, k * 7, k * 3, 0, 0, 6.3)
      g.stroke()
    }
  }
  // ring stains and wear: this table has seen a lot of chai
  g.strokeStyle = 'rgba(30,15,5,0.18)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(W * 0.8, H * 0.35, 38, 0, 6.3)
  g.stroke()
  return { map: toTexture(c, { repeat: [1, 1] }), bump: toTexture(b, { srgb: false }) }
}

/** Painted wall: faded distemper with soft stains. */
export function wallTexture(base = '#b9a37a'): Texture {
  const [c, g] = canvas(512, 512)
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  const r = rng(11)
  for (let i = 0; i < 140; i++) {
    const x = r() * 512
    const y = r() * 512
    const rad = 20 + r() * 90
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    const dark = r() < 0.6
    gr.addColorStop(0, dark ? 'rgba(60,40,15,0.035)' : 'rgba(255,240,200,0.03)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  const img = g.getImageData(0, 0, 512, 512)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return toTexture(c, { repeat: [3, 2] })
}

/** Chequered mosaic floor (dark red-oxide / cream). */
export function floorTexture(): Texture {
  const [c, g] = canvas(512, 512)
  const r = rng(3)
  const n = 4
  const s = 512 / n
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dark = (x + y) % 2 === 0
      const v = (r() - 0.5) * 14
      g.fillStyle = dark ? `rgb(${92 + v},${40 + v / 2},${32 + v / 2})` : `rgb(${176 + v},${160 + v},${128 + v})`
      g.fillRect(x * s, y * s, s, s)
    }
  g.strokeStyle = 'rgba(20,10,5,0.55)'
  g.lineWidth = 3
  for (let i = 0; i <= n; i++) {
    g.beginPath()
    g.moveTo(i * s, 0)
    g.lineTo(i * s, 512)
    g.moveTo(0, i * s)
    g.lineTo(512, i * s)
    g.stroke()
  }
  return toTexture(c, { repeat: [5, 5] })
}

/** Crocheted doily: scalloped rings with an alpha cut-out. */
export function doilyTexture(): Texture {
  const S = 1024
  const [c, g] = canvas(S, S)
  g.translate(S / 2, S / 2)
  g.strokeStyle = '#f2e9d2'
  g.fillStyle = '#f2e9d2'
  g.lineCap = 'round'
  const rings = [
    { r: 0.1, n: 14, size: 0.04, w: 5 },
    { r: 0.2, n: 20, size: 0.05, w: 5 },
    { r: 0.32, n: 28, size: 0.06, w: 5 },
    { r: 0.45, n: 36, size: 0.07, w: 5 },
    { r: 0.58, n: 44, size: 0.06, w: 4 },
    { r: 0.7, n: 56, size: 0.055, w: 4 },
    { r: 0.82, n: 70, size: 0.05, w: 4 },
    { r: 0.92, n: 90, size: 0.045, w: 4 },
  ]
  for (const ring of rings) {
    const R = (ring.r * S) / 2
    g.lineWidth = ring.w
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2
      const x = Math.cos(a) * R
      const y = Math.sin(a) * R
      const sz = ring.size * S * 0.5
      g.beginPath()
      g.arc(x, y, sz, 0, 6.3)
      g.stroke()
      g.beginPath()
      g.arc(x, y, sz * 0.4, 0, 6.3)
      g.stroke()
      // spoke linking to the ring inside
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82)
      g.stroke()
    }
    g.beginPath()
    g.arc(0, 0, R, 0, 6.3)
    g.stroke()
  }
  g.beginPath()
  g.arc(0, 0, 0.08 * S, 0, 6.3)
  g.fill()
  return toTexture(c)
}

/** Wall calendar for the current month. */
export function calendarTexture(now = new Date()): Texture {
  const W = 512
  const H = 720
  const [c, g] = canvas(W, H)
  g.fillStyle = '#f7f0dc'
  g.fillRect(0, 0, W, H)
  // picture: dusk landscape with a temple silhouette
  const sky = g.createLinearGradient(0, 0, 0, 330)
  sky.addColorStop(0, '#3b2a5c')
  sky.addColorStop(0.55, '#d9604a')
  sky.addColorStop(1, '#f2b45a')
  g.fillStyle = sky
  g.fillRect(18, 18, W - 36, 312)
  g.fillStyle = '#fff2c4'
  g.beginPath()
  g.arc(380, 150, 36, 0, 6.3)
  g.fill()
  g.fillStyle = '#2a1830'
  g.beginPath()
  g.moveTo(18, 330)
  g.lineTo(18, 270)
  g.quadraticCurveTo(140, 240, 230, 280)
  g.quadraticCurveTo(350, 250, W - 18, 285)
  g.lineTo(W - 18, 330)
  g.fill()
  g.fillStyle = '#1a0f20'
  g.fillRect(150, 215, 60, 70)
  g.beginPath()
  g.moveTo(140, 215)
  g.lineTo(180, 165)
  g.lineTo(220, 215)
  g.fill()
  g.fillRect(176, 140, 8, 28)
  g.fillStyle = '#c9a35a'
  g.font = 'bold 22px "Special Elite", serif'
  g.textAlign = 'center'
  g.fillText('SHREE LAXMI TRADERS — 1986', W / 2, 358)

  const month = now.toLocaleString('en-IN', { month: 'long' }).toUpperCase()
  g.fillStyle = '#8e1b1b'
  g.font = 'bold 54px "Special Elite", Georgia, serif'
  g.fillText(`${month} ${now.getFullYear()}`, W / 2, 425)
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const cw = (W - 40) / 7
  g.font = 'bold 22px "Special Elite", Georgia, serif'
  days.forEach((d, i) => {
    g.fillStyle = i === 0 ? '#b3261e' : '#3a2a1a'
    g.fillText(d, 20 + cw * i + cw / 2, 465)
  })
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  g.font = '26px "Special Elite", Georgia, serif'
  for (let d = 1; d <= count; d++) {
    const idx = first + d - 1
    const x = 20 + cw * (idx % 7) + cw / 2
    const y = 505 + Math.floor(idx / 7) * 40
    if (d === now.getDate()) {
      g.strokeStyle = '#b3261e'
      g.lineWidth = 3
      g.beginPath()
      g.ellipse(x, y - 8, 20, 18, 0, 0, 6.3)
      g.stroke()
    }
    g.fillStyle = idx % 7 === 0 ? '#b3261e' : '#2a1d12'
    g.fillText(String(d), x, y)
  }
  return toTexture(c)
}

/** City lights seen through the window at night. */
export function cityTexture(): Texture {
  const W = 1024
  const H = 512
  const [c, g] = canvas(W, H)
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#06091a')
  sky.addColorStop(0.7, '#1a1a3a')
  sky.addColorStop(1, '#3a2a40')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  const r = rng(21)
  // skyline blocks with lit windows
  for (let x = 0; x < W; x += 10 + r() * 40) {
    const bw = 28 + r() * 70
    const bh = 70 + r() * 230
    g.fillStyle = `rgb(${10 + r() * 14},${10 + r() * 12},${18 + r() * 16})`
    g.fillRect(x, H - bh, bw, bh)
    for (let wy = H - bh + 8; wy < H - 6; wy += 13)
      for (let wx = x + 5; wx < x + bw - 6; wx += 11)
        if (r() < 0.32) {
          g.fillStyle = r() < 0.8 ? 'rgba(255,205,120,0.95)' : 'rgba(180,220,255,0.9)'
          g.fillRect(wx, wy, 5, 7)
        }
  }
  // street lamps glow
  for (let i = 0; i < 30; i++) {
    const x = r() * W
    const y = H - 10 - r() * 60
    const gr = g.createRadialGradient(x, y, 0, x, y, 14)
    gr.addColorStop(0, 'rgba(255,220,150,0.95)')
    gr.addColorStop(1, 'rgba(255,200,100,0)')
    g.fillStyle = gr
    g.fillRect(x - 14, y - 14, 28, 28)
  }
  return toTexture(c)
}

/** Brushed aluminium: horizontal streaks as colour, bump and roughness. */
export function brushedMetal(tint = '#b9bcc0'): { map: Texture; bump: Texture } {
  const W = 512
  const H = 256
  const [c, g] = canvas(W, H)
  const [b, bg] = canvas(W, H)
  g.fillStyle = tint
  g.fillRect(0, 0, W, H)
  bg.fillStyle = '#808080'
  bg.fillRect(0, 0, W, H)
  for (let i = 0; i < 1400; i++) {
    const y = Math.random() * H
    const x = Math.random() * W
    const len = 40 + Math.random() * 260
    const v = Math.random()
    g.strokeStyle = v < 0.5 ? `rgba(255,255,255,${Math.random() * 0.1})` : `rgba(0,0,0,${Math.random() * 0.09})`
    g.lineWidth = 0.5 + Math.random()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + len, y)
    g.stroke()
    bg.strokeStyle = v < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'
    bg.beginPath()
    bg.moveTo(x, y)
    bg.lineTo(x + len, y)
    bg.stroke()
  }
  return { map: toTexture(c, { repeat: [2, 1] }), bump: toTexture(b, { srgb: false, repeat: [2, 1] }) }
}

/** Perforated speaker grille: dark cloth with a hex dot pattern. */
export function grilleTexture(): { map: Texture; alpha: Texture } {
  const S = 512
  const [c, g] = canvas(S, S)
  const [a, ag] = canvas(S, S)
  g.fillStyle = '#16120f'
  g.fillRect(0, 0, S, S)
  ag.fillStyle = '#000'
  ag.fillRect(0, 0, S, S)
  ag.fillStyle = '#fff'
  const step = 14
  for (let y = 0, row = 0; y < S + step; y += step * 0.866, row++)
    for (let x = (row % 2) * step * 0.5; x < S + step; x += step) {
      ag.beginPath()
      ag.arc(x, y, 3.4, 0, 6.3)
      ag.fill()
    }
  return { map: toTexture(c), alpha: toTexture(a, { srgb: false }) }
}

/** Silk-screened labels on the deck's front panel. Coordinates map deck-local metres → pixels. */
export function panelDecal(W: number, H: number, draw: (g: CanvasRenderingContext2D, px: (x: number) => number, py: (y: number) => number, s: number) => void): Texture {
  const PX = 2400
  const PY = Math.round((PX * H) / W)
  const [c, g] = canvas(PX, PY)
  const px = (x: number) => (x / W + 0.5) * PX
  const py = (y: number) => (0.5 - y / H) * PY
  draw(g, px, py, PX / W)
  return toTexture(c)
}

/** Piano-key face with an icon. */
export function keyTexture(icon: 'rec' | 'play' | 'rew' | 'ff' | 'stop' | 'pause', label: string): Texture {
  const [c, g] = canvas(256, 160)
  g.fillStyle = '#d9d9d6'
  g.fillRect(0, 0, 256, 160)
  const grad = g.createLinearGradient(0, 0, 0, 160)
  grad.addColorStop(0, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(0,0,0,0.12)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 160)
  g.fillStyle = icon === 'rec' ? '#c0281f' : '#26231f'
  const cx = 128
  const cy = 74
  switch (icon) {
    case 'rec':
      g.beginPath()
      g.arc(cx, cy, 30, 0, 6.3)
      g.fill()
      break
    case 'play':
      g.beginPath()
      g.moveTo(cx - 24, cy - 32)
      g.lineTo(cx + 34, cy)
      g.lineTo(cx - 24, cy + 32)
      g.fill()
      break
    case 'rew':
      for (const o of [-6, 28]) {
        g.beginPath()
        g.moveTo(cx + o, cy - 26)
        g.lineTo(cx + o - 32, cy)
        g.lineTo(cx + o, cy + 26)
        g.fill()
      }
      break
    case 'ff':
      for (const o of [-28, 6]) {
        g.beginPath()
        g.moveTo(cx + o, cy - 26)
        g.lineTo(cx + o + 32, cy)
        g.lineTo(cx + o, cy + 26)
        g.fill()
      }
      break
    case 'stop':
      g.fillRect(cx - 24, cy - 10, 48, 40)
      g.beginPath()
      g.moveTo(cx - 26, cy - 16)
      g.lineTo(cx, cy - 44)
      g.lineTo(cx + 26, cy - 16)
      g.fill()
      break
    case 'pause':
      g.fillRect(cx - 28, cy - 30, 20, 60)
      g.fillRect(cx + 8, cy - 30, 20, 60)
      break
  }
  g.font = 'bold 26px "Special Elite", Arial, sans-serif'
  g.textAlign = 'center'
  g.fillStyle = '#3b3631'
  g.fillText(label, 128, 140)
  return toTexture(c)
}

/** VU meter face: arc scale, red zone, "VU" mark. Needle pivot is at (0.5, 0.12) of the texture. */
export function meterFace(channel: string): Texture {
  const W = 512
  const H = 360
  const [c, g] = canvas(W, H)
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#ffe7a6')
  bg.addColorStop(1, '#f1c970')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  const cx = W / 2
  const cy = H * 1.02
  const R = H * 0.88
  const a0 = -Math.PI / 2 - 0.62
  const a1 = -Math.PI / 2 + 0.62
  const val = (v: number) => a0 + (a1 - a0) * v
  // red zone
  g.strokeStyle = '#b3261e'
  g.lineWidth = 16
  g.beginPath()
  g.arc(cx, cy, R * 0.93, val(0.72), a1)
  g.stroke()
  g.strokeStyle = '#2a2018'
  g.lineWidth = 4
  g.beginPath()
  g.arc(cx, cy, R * 0.93, a0, val(0.72))
  g.stroke()
  g.fillStyle = '#2a2018'
  g.font = 'bold 26px Arial, sans-serif'
  g.textAlign = 'center'
  const labels = [
    [0, '-20'], [0.15, '-10'], [0.3, '-7'], [0.45, '-5'], [0.58, '-3'], [0.72, '0'], [0.86, '+2'], [1, '+3'],
  ] as const
  for (const [v, t] of labels) {
    const a = val(v)
    g.strokeStyle = v >= 0.72 ? '#b3261e' : '#2a2018'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86)
    g.lineTo(cx + Math.cos(a) * R * 0.99, cy + Math.sin(a) * R * 0.99)
    g.stroke()
    g.fillStyle = v >= 0.72 ? '#b3261e' : '#2a2018'
    g.fillText(t, cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72 + 8)
  }
  for (let i = 0; i <= 40; i++) {
    const a = val(i / 40)
    g.strokeStyle = '#2a2018'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9)
    g.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95)
    g.stroke()
  }
  g.fillStyle = '#2a2018'
  g.font = 'bold 60px Georgia, serif'
  g.fillText('VU', cx, H * 0.52)
  g.font = 'bold 24px Arial, sans-serif'
  g.fillText(channel, cx, H * 0.7)
  // gentle vignette so it reads as backlit glass
  const vg = g.createRadialGradient(cx, H * 0.6, 40, cx, H * 0.6, W * 0.7)
  vg.addColorStop(0, 'rgba(255,255,255,0.0)')
  vg.addColorStop(1, 'rgba(120,60,0,0.35)')
  g.fillStyle = vg
  g.fillRect(0, 0, W, H)
  return toTexture(c)
}

/** Radio dial scale. */
export function dialTexture(): Texture {
  const W = 1024
  const H = 200
  const [c, g] = canvas(W, H)
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#f3d98f')
  bg.addColorStop(1, '#d8b25a')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#2a2018'
  g.strokeStyle = '#2a2018'
  g.textAlign = 'center'
  const bands: [string, number, number, number, number, string[]][] = [
    ['FM', 28, 88, 108, 6, ['88', '92', '96', '100', '104', '108']],
    ['MW', 98, 530, 1600, 1, ['600', '800', '1000', '1200', '1400', '1600']],
    ['SW', 168, 5.9, 18, 1, ['6', '8', '10', '12', '15', '18']],
  ]
  g.font = 'bold 22px "Special Elite", Arial'
  for (const [name, y, , , , labels] of bands) {
    g.textAlign = 'left'
    g.fillText(name, 14, y + 4)
    g.textAlign = 'center'
    g.font = '18px "Special Elite", Arial'
    labels.forEach((l, i) => {
      const x = 90 + (i / (labels.length - 1)) * (W - 160)
      g.fillText(l, x, y - 10)
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(x, y - 4)
      g.lineTo(x, y + 12)
      g.stroke()
    })
    g.lineWidth = 1
    for (let i = 0; i <= 50; i++) {
      const x = 90 + (i / 50) * (W - 160)
      g.beginPath()
      g.moveTo(x, y + 2)
      g.lineTo(x, y + (i % 5 === 0 ? 10 : 6))
      g.stroke()
    }
    g.font = 'bold 22px "Special Elite", Arial'
  }
  g.textAlign = 'right'
  g.font = '16px "Special Elite", Arial'
  g.fillText('MHz · kHz · MHz', W - 10, H - 8)
  return toTexture(c)
}

/** Rolling digit strip (0-9, repeated) for the mechanical counter. */
export function digitStrip(): Texture {
  const [c, g] = canvas(128, 1280)
  g.fillStyle = '#141210'
  g.fillRect(0, 0, 128, 1280)
  g.fillStyle = '#f2ead6'
  g.font = 'bold 96px "Special Elite", Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < 10; i++) g.fillText(String(i), 64, i * 128 + 68)
  const t = toTexture(c)
  t.wrapT = RepeatWrapping
  return t
}

/** Soft round sprite for steam / dust / glows. */
export function softDot(): Texture {
  const [c, g] = canvas(64, 64)
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return toTexture(c)
}

/** Concentric wound-tape rings for the reel packs. */
export function packTexture(): Texture {
  const S = 256
  const [c, g] = canvas(S, S)
  g.fillStyle = '#2c1c14'
  g.fillRect(0, 0, S, S)
  const r = rng(5)
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '0,0,0' : '120,80,50'},${0.1 + r() * 0.2})`
    g.lineWidth = 1 + r() * 2
    g.beginPath()
    g.arc(S / 2, S / 2, 8 + (i / 70) * 118, 0, 6.3)
    g.stroke()
  }
  // a faint splice / crease so rotation is readable
  g.strokeStyle = 'rgba(210,170,120,0.35)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(S / 2, S / 2)
  g.lineTo(S / 2 + 118, S / 2 - 10)
  g.stroke()
  return toTexture(c)
}

/** Blurred rainy dusk outside the window: grey-blue sky, dark trees, towers with a few lit windows. */
export function rainyOutsideTexture(): Texture {
  const W = 1024
  const H = 512
  const [c, g] = canvas(W, H)
  const r = rng(33)
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#59647a')
  sky.addColorStop(0.55, '#8b97a8')
  sky.addColorStop(1, '#a3a8ae')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  g.filter = 'blur(6px)'
  // far apartment blocks
  for (let i = 0; i < 9; i++) {
    const x = r() * W
    const bw = 50 + r() * 90
    const bh = 120 + r() * 170
    g.fillStyle = `rgb(${96 + r() * 16},${102 + r() * 16},${114 + r() * 16})`
    g.fillRect(x, H - bh - 60, bw, bh + 60)
    for (let wy = H - bh - 50; wy < H - 70; wy += 16)
      for (let wx = x + 6; wx < x + bw - 8; wx += 14)
        if (r() < 0.18) {
          g.fillStyle = 'rgba(255,196,110,0.9)'
          g.fillRect(wx, wy, 7, 9)
        }
  }
  // tree canopies in layers
  for (const [col, n, base] of [['#3d4a44', 26, 380], ['#2e3a35', 30, 430], ['#202a26', 34, 480]] as const) {
    g.fillStyle = col
    for (let i = 0; i < n; i++) {
      const x = (i / n) * W + r() * 30
      const rad = 34 + r() * 44
      g.beginPath()
      g.arc(x, base - r() * 70, rad, 0, 6.3)
      g.fill()
    }
  }
  // a couple of warm street lamps through the leaves
  for (let i = 0; i < 6; i++) {
    const x = r() * W
    const y = 330 + r() * 120
    const gr = g.createRadialGradient(x, y, 0, x, y, 20)
    gr.addColorStop(0, 'rgba(255,214,150,0.95)')
    gr.addColorStop(1, 'rgba(255,190,100,0)')
    g.fillStyle = gr
    g.fillRect(x - 20, y - 20, 40, 40)
  }
  return toTexture(c)
}

/** Rain on glass. `drops` = still droplets with a bright rim; `streaks` = long runs that scroll downward. */
export function rainGlassTextures(): { drops: Texture; streaks: Texture } {
  const W = 1024
  const H = 1024
  const r = rng(77)
  const [dc, dg] = canvas(W, H)
  for (let i = 0; i < 520; i++) {
    const x = r() * W
    const y = r() * H
    const rad = 1.5 + r() * r() * 9
    const gr = dg.createRadialGradient(x - rad * 0.3, y - rad * 0.35, 0, x, y, rad)
    gr.addColorStop(0, 'rgba(235,245,255,0.85)')
    gr.addColorStop(0.55, 'rgba(120,140,165,0.25)')
    gr.addColorStop(1, 'rgba(20,30,45,0.5)')
    dg.fillStyle = gr
    dg.beginPath()
    dg.ellipse(x, y, rad, rad * 1.18, 0, 0, 6.3)
    dg.fill()
  }
  const [sc, sg] = canvas(W, H)
  for (let i = 0; i < 90; i++) {
    const x = r() * W
    const y = r() * H
    const len = 80 + r() * 380
    const grad = sg.createLinearGradient(x, y, x, y + len)
    grad.addColorStop(0, 'rgba(210,225,245,0)')
    grad.addColorStop(0.15, 'rgba(210,225,245,0.45)')
    grad.addColorStop(1, 'rgba(210,225,245,0)')
    sg.strokeStyle = grad
    sg.lineWidth = 1 + r() * 2.2
    sg.beginPath()
    sg.moveTo(x, y)
    sg.lineTo(x + (r() - 0.5) * 6, y + len)
    sg.stroke()
    sg.fillStyle = 'rgba(225,238,255,0.55)'
    sg.beginPath()
    sg.arc(x, y + len * 0.95, 2.2 + r() * 2, 0, 6.3)
    sg.fill()
  }
  const drops = toTexture(dc, { repeat: [1, 1] })
  const streaks = toTexture(sc, { repeat: [1, 1] })
  streaks.wrapT = RepeatWrapping
  streaks.wrapS = RepeatWrapping
  return { drops, streaks }
}

/** Dark hardwood planks. */
export function plankFloorTexture(): Texture {
  const W = 1024
  const H = 1024
  const [c, g] = canvas(W, H)
  const r = rng(91)
  const rows = 8
  const rh = H / rows
  for (let row = 0; row < rows; row++) {
    let x = -r() * 300
    while (x < W) {
      const len = 260 + r() * 340
      const l = 26 + r() * 9
      g.fillStyle = `hsl(24, ${28 + r() * 10}%, ${l}%)`
      g.fillRect(x, row * rh, len, rh)
      for (let k = 0; k < 26; k++) {
        g.strokeStyle = `rgba(10,4,0,${0.05 + r() * 0.12})`
        g.lineWidth = 0.6 + r()
        g.beginPath()
        const y0 = row * rh + r() * rh
        g.moveTo(x, y0)
        g.lineTo(x + len, y0 + (r() - 0.5) * 6)
        g.stroke()
      }
      g.fillStyle = 'rgba(0,0,0,0.55)'
      g.fillRect(x, row * rh, 2, rh)
      x += len
    }
    g.fillStyle = 'rgba(0,0,0,0.5)'
    g.fillRect(0, row * rh, W, 2)
  }
  return toTexture(c, { repeat: [3, 3] })
}

/** Framed-print artwork. kind 0: mountain line print, 1: sunset gradient, 2: polaroid cluster. */
export function artTexture(kind: number): Texture {
  const [c, g] = canvas(384, 512)
  g.fillStyle = '#efe9db'
  g.fillRect(0, 0, 384, 512)
  if (kind === 0) {
    g.fillStyle = '#d8d3c4'
    g.fillRect(40, 50, 304, 360)
    g.fillStyle = '#6b6f6a'
    g.beginPath()
    g.moveTo(40, 340)
    g.lineTo(130, 190)
    g.lineTo(190, 270)
    g.lineTo(250, 140)
    g.lineTo(344, 330)
    g.lineTo(344, 410)
    g.lineTo(40, 410)
    g.fill()
    g.fillStyle = '#2d3a30'
    for (let i = 0; i < 26; i++) {
      const x = 50 + i * 11
      g.beginPath()
      g.moveTo(x, 410)
      g.lineTo(x + 6, 350 - (i % 5) * 8)
      g.lineTo(x + 12, 410)
      g.fill()
    }
  } else if (kind === 1) {
    const gr = g.createLinearGradient(0, 50, 0, 410)
    gr.addColorStop(0, '#3e3560')
    gr.addColorStop(0.6, '#d36a4a')
    gr.addColorStop(1, '#f2b45a')
    g.fillStyle = gr
    g.fillRect(40, 50, 304, 360)
    g.fillStyle = 'rgba(20,15,30,0.85)'
    g.fillRect(40, 360, 304, 50)
  } else {
    for (let i = 0; i < 3; i++) {
      g.save()
      g.translate(110 + (i % 2) * 150, 120 + i * 130)
      g.rotate((i - 1) * 0.12)
      g.fillStyle = '#fbf9f2'
      g.fillRect(-60, -60, 120, 135)
      g.fillStyle = ['#5d6b5a', '#8a6e56', '#566a7c'][i]
      g.fillRect(-52, -52, 104, 100)
      g.restore()
    }
  }
  return toTexture(c)
}

/** A single broad leaf (heart-shaped, with a midrib and side veins) on a transparent background. */
export function leafTexture(): Texture {
  const [c, g] = canvas(256, 256)
  const grad = g.createLinearGradient(0, 0, 256, 256)
  grad.addColorStop(0, '#2f5a3a')
  grad.addColorStop(1, '#1b3a27')
  g.fillStyle = grad
  g.beginPath()
  g.moveTo(128, 250)
  g.bezierCurveTo(10, 190, -10, 70, 128, 6)
  g.bezierCurveTo(266, 70, 246, 190, 128, 250)
  g.fill()
  g.strokeStyle = 'rgba(190,225,170,0.55)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(128, 246)
  g.lineTo(128, 24)
  g.stroke()
  g.lineWidth = 1.6
  for (let i = 0; i < 8; i++) {
    const y = 210 - i * 24
    g.beginPath()
    g.moveTo(128, y)
    g.quadraticCurveTo(170, y - 22, 214, y - 46 + i * 3)
    g.moveTo(128, y)
    g.quadraticCurveTo(86, y - 22, 42, y - 46 + i * 3)
    g.stroke()
  }
  const t = toTexture(c)
  return t
}

/** A shelf-row of book spines on a transparent background: varied heights, widths, colours, bands and titles. */
export function spineRowTexture(seed: number, cassetteRow = false): Texture {
  const W = 1024
  const H = 256
  const [c, g] = canvas(W, H)
  const r = rng(seed)
  const palette = ['#6f2a28', '#2c4660', '#55633a', '#a8843a', '#3a2f36', '#7d5f42', '#cfc7b2', '#31574f', '#9a4e36', '#4d3b5c']
  let x = 6
  while (x < W - 24) {
    if (!cassetteRow && r() < 0.06) {
      // a book leaning, or a gap
      x += 40 + r() * 30
      continue
    }
    const w = cassetteRow ? 15 + r() * 3 : 18 + r() * 34
    const h = cassetteRow ? 190 : 150 + r() * 96
    const col = cassetteRow ? ['#24211f', '#c9c4b8', '#8e2f2a', '#25405f', '#c99a2e', '#2f5a3d'][Math.floor(r() * 6)] : palette[Math.floor(r() * palette.length)]
    g.fillStyle = col
    g.fillRect(x, H - h, w, h)
    // edge shading so each spine reads as a rounded object
    const sh = g.createLinearGradient(x, 0, x + w, 0)
    sh.addColorStop(0, 'rgba(0,0,0,0.38)')
    sh.addColorStop(0.18, 'rgba(255,255,255,0.1)')
    sh.addColorStop(0.7, 'rgba(0,0,0,0.05)')
    sh.addColorStop(1, 'rgba(0,0,0,0.45)')
    g.fillStyle = sh
    g.fillRect(x, H - h, w, h)
    if (!cassetteRow) {
      g.fillStyle = 'rgba(224,196,120,0.85)'
      g.fillRect(x, H - h + 16, w, 3)
      g.fillRect(x, H - h + 24, w, 1.5)
      g.fillRect(x, H - 26, w, 3)
      g.fillStyle = 'rgba(240,230,205,0.55)'
      g.fillRect(x + w * 0.35, H - h * 0.75, w * 0.3, h * 0.36)
    } else {
      g.fillStyle = 'rgba(214,205,186,0.6)'
      g.fillRect(x + 3, H - 160, w - 6, 90)
    }
    x += w + 1 + (r() < 0.2 ? 2 : 0)
  }
  return toTexture(c)
}

/** Woven linen for lampshades: warm cream with a fine cross-hatch. */
export function linenTexture(): Texture {
  const [c, g] = canvas(256, 256)
  g.fillStyle = '#e2c68e'
  g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 256; i += 2) {
    g.fillStyle = `rgba(120,80,30,${0.05 + ((i * 7) % 5) * 0.012})`
    g.fillRect(i, 0, 1, 256)
    g.fillRect(0, i, 256, 1)
  }
  return toTexture(c, { repeat: [3, 1] })
}

/** Ornamental rug: muted reds and indigos, a medallion, border bands, worn pile. */
export function rugTexture(): Texture {
  const S = 1024
  const [c, g] = canvas(S, S)
  const r = rng(12)
  g.fillStyle = '#6a2a26'
  g.fillRect(0, 0, S, S)
  const border = (inset: number, col: string, w: number) => {
    g.strokeStyle = col
    g.lineWidth = w
    g.strokeRect(inset, inset, S - inset * 2, S - inset * 2)
  }
  border(26, '#d8c89c', 10)
  border(70, '#1f2c4a', 40)
  border(120, '#d8c89c', 6)
  // repeating motif along the indigo band
  g.fillStyle = '#b8924a'
  for (let i = 0; i < 28; i++) {
    const p = 70 + (i / 28) * (S - 140)
    for (const [x, y] of [[p, 70], [p, S - 70], [70, p], [S - 70, p]] as const) {
      g.beginPath()
      g.moveTo(x, y - 10)
      g.lineTo(x + 8, y)
      g.lineTo(x, y + 10)
      g.lineTo(x - 8, y)
      g.fill()
    }
  }
  // central field: lattice of small diamonds
  g.strokeStyle = 'rgba(216,200,156,0.35)'
  g.lineWidth = 2
  for (let i = -S; i < S * 2; i += 64) {
    g.beginPath()
    g.moveTo(i, 150)
    g.lineTo(i + S, 150 + S)
    g.moveTo(i, 150 + S)
    g.lineTo(i + S, 150)
    g.stroke()
  }
  g.save()
  g.beginPath()
  g.rect(150, 150, S - 300, S - 300)
  g.clip()
  // medallion
  const cx = S / 2
  g.fillStyle = '#243556'
  g.beginPath()
  g.moveTo(cx, 230)
  g.lineTo(S - 230, cx)
  g.lineTo(cx, S - 230)
  g.lineTo(230, cx)
  g.closePath()
  g.fill()
  g.strokeStyle = '#d8c89c'
  g.lineWidth = 6
  g.stroke()
  g.fillStyle = '#7a3430'
  g.beginPath()
  g.arc(cx, cx, 120, 0, 6.3)
  g.fill()
  g.strokeStyle = '#d8c89c'
  g.lineWidth = 4
  for (let k = 1; k <= 3; k++) {
    g.beginPath()
    g.arc(cx, cx, 120 - k * 28, 0, 6.3)
    g.stroke()
  }
  g.restore()
  // wear, fibres
  const img = g.getImageData(0, 0, S, S)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 34
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return toTexture(c)
}

/** Perforated speaker cloth as an OPAQUE texture (alpha-tested holes alias badly at an angle). */
export function grilleColorTexture(): Texture {
  const S = 512
  const [c, g] = canvas(S, S)
  g.fillStyle = '#8d9096'
  g.fillRect(0, 0, S, S)
  const step = 12
  for (let y = 0, row = 0; y < S + step; y += step * 0.866, row++)
    for (let x = (row % 2) * step * 0.5; x < S + step; x += step) {
      g.fillStyle = '#06060a'
      g.beginPath()
      g.arc(x, y, 3.2, 0, 6.3)
      g.fill()
    }
  const t = toTexture(c)
  t.anisotropy = 16
  return t
}
