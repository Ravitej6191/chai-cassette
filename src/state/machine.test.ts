import { describe, expect, it } from 'vitest'
import { initialMachine, keysDown, transition, type DeckEvent, type MachineState } from './machine'

const run = (s: MachineState, ...evs: DeckEvent['type'][]) =>
  evs.reduce((acc, type) => transition(acc, { type } as DeckEvent).state, s)

const loaded = run(initialMachine, 'EJECT', 'EJECT_DONE', 'INSERT', 'DOOR_CLOSE')

describe('deck state machine', () => {
  it('walks the load cycle', () => {
    expect(loaded.mode).toBe('LOADED')
    expect(loaded.hasTape).toBe(true)
    expect(loaded.doorOpen).toBe(false)
  })

  it('ignores PLAY with no tape', () => {
    expect(transition(initialMachine, { type: 'PLAY' }).accepted).toBe(false)
  })

  it('latches PLAY, and REC only after PLAY', () => {
    expect(transition(loaded, { type: 'REC' }).accepted).toBe(false)
    const playing = run(loaded, 'PLAY')
    expect(keysDown(playing)).toEqual(['PLAY'])
    const rec = run(playing, 'REC')
    expect(rec.mode).toBe('RECORDING')
    expect(keysDown(rec)).toEqual(['REC', 'PLAY'])
  })

  it('cue and review are momentary while playing', () => {
    const playing = run(loaded, 'PLAY')
    const cue = transition(playing, { type: 'FF_DOWN' }).state
    expect(cue.mode).toBe('CUE')
    expect(transition(cue, { type: 'FF_UP' }).state.mode).toBe('PLAYING')
    const rev = transition(playing, { type: 'REW_DOWN' }).state
    expect(rev.mode).toBe('REVIEW')
    expect(transition(rev, { type: 'REW_UP' }).state.mode).toBe('PLAYING')
  })

  it('FF/REW latch when stopped', () => {
    const ff = transition(loaded, { type: 'FF_DOWN' }).state
    expect(ff.mode).toBe('FF')
    expect(transition(ff, { type: 'FF_UP' }).accepted).toBe(false)
    expect(transition(ff, { type: 'STOP' }).state.mode).toBe('LOADED')
  })

  it('pause toggles and remembers what it interrupted', () => {
    const rec = run(loaded, 'PLAY', 'REC')
    const paused = run(rec, 'PAUSE')
    expect(paused.mode).toBe('PAUSED')
    expect(keysDown(paused)).toEqual(['REC', 'PLAY', 'PAUSE'])
    expect(run(paused, 'PAUSE').mode).toBe('RECORDING')
  })

  it('STOP/EJECT stops first, then ejects', () => {
    const playing = run(loaded, 'PLAY')
    const stopped = run(playing, 'EJECT')
    expect(stopped.mode).toBe('LOADED')
    const ejecting = run(stopped, 'EJECT')
    expect(ejecting.mode).toBe('EJECTING')
    expect(ejecting.doorOpen).toBe(true)
    expect(run(ejecting, 'EJECT_DONE').mode).toBe('EMPTY')
  })

  it('end of tape auto-stops; a chewed tape only recovers via eject', () => {
    expect(run(loaded, 'PLAY', 'END_OF_TAPE').mode).toBe('LOADED')
    const chewed = run(loaded, 'PLAY', 'CHEW')
    expect(chewed.mode).toBe('CHEWED')
    expect(transition(chewed, { type: 'PLAY' }).accepted).toBe(false)
    expect(run(chewed, 'EJECT').mode).toBe('EJECTING')
  })

  it('cannot insert with the door closed', () => {
    expect(transition(initialMachine, { type: 'INSERT' }).accepted).toBe(false)
  })
})
