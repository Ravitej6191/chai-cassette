import { describe, expect, it } from 'vitest'
import { cleanTitle, generateTape, pickFormat, rng } from './generator'
import { packRadii } from './reelMath'
import { FORMATS, HUB_R, TAPE_SPEED, fullPackRadius, ribbonLength, sideSeconds, type TapeFormat } from './types'

const formats = Object.keys(FORMATS) as TapeFormat[]

describe('cassette geometry', () => {
  it('uses real 4.76 cm/s ribbon lengths (C60 ≈ 86 m per side)', () => {
    expect(ribbonLength('C60')).toBeCloseTo(TAPE_SPEED * 1800, 5)
    expect(ribbonLength('C60')).toBeGreaterThan(85)
    expect(ribbonLength('C60')).toBeLessThan(87)
  })

  it('full packs fit inside the shell for every format', () => {
    for (const f of formats) {
      expect(fullPackRadius(f)).toBeGreaterThan(HUB_R)
      expect(fullPackRadius(f)).toBeLessThan(0.024)
    }
  })

  it('conserves tape area between the two reels at every position', () => {
    for (const f of formats) {
      const full = fullPackRadius(f)
      const total = full * full - HUB_R * HUB_R
      for (const frac of [0, 0.1, 0.5, 0.9, 1]) {
        const { rL, rR } = packRadii({ format: f }, frac)
        expect(rL * rL + rR * rR - 2 * HUB_R * HUB_R).toBeCloseTo(total, 9)
      }
    }
  })

  it('right pack grows and left shrinks as the tape plays', () => {
    const a = packRadii({ format: 'C60' }, 0.2)
    const b = packRadii({ format: 'C60' }, 0.7)
    expect(b.rR).toBeGreaterThan(a.rR)
    expect(b.rL).toBeLessThan(a.rL)
  })

  it('an empty hub is exactly the hub radius', () => {
    expect(packRadii({ format: 'C90' }, 0).rR).toBeCloseTo(HUB_R, 9)
    expect(packRadii({ format: 'C90' }, 1).rL).toBeCloseTo(HUB_R, 9)
  })

  it('side lengths scale with the format', () => {
    expect(sideSeconds('C90')).toBe(45 * 60)
    expect(sideSeconds('C30')).toBeLessThan(sideSeconds('C60'))
  })
})

describe('tape generator', () => {
  it('picks the smallest cassette that fits a programme', () => {
    expect(pickFormat(60)).toBe('C30')
    expect(pickFormat(15 * 60 - 20)).toBe('C30') // 880 s + 12 s margin still fits a C30 side
    expect(pickFormat(15 * 60 - 5)).toBe('C46') // 895 s + margin spills over → next size up
    expect(pickFormat(40 * 60)).toBe('C90')
    expect(pickFormat(10 * 3600)).toBe('C120')
  })

  it('cleans file names into hand-written titles', () => {
    expect(cleanTitle('mohd_rafi_old_hits.mp3')).toBe('Mohd Rafi Old Hits')
    expect(cleanTitle('  ')).toBe('Untitled')
    expect(cleanTitle('a'.repeat(100) + '.wav').length).toBeLessThanOrEqual(42)
  })

  it('is deterministic: the same file always makes the same tape', () => {
    const a = generateTape({ id: 'x', name: 'song.mp3', durationA: 200 }, 3)
    const b = generateTape({ id: 'x', name: 'song.mp3', durationA: 200 }, 3)
    expect(a).toEqual(b)
    expect(a.slot).toBe(3)
    expect(a.sides.A.duration).toBe(200)
    expect(a.wear).toBeGreaterThan(0)
    expect(a.wear).toBeLessThan(1)
  })

  it('seeded rng repeats and stays in [0, 1)', () => {
    const r1 = rng(42)
    const r2 = rng(42)
    for (let i = 0; i < 50; i++) {
      const v = r1()
      expect(v).toBe(r2())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
