/**
 * IndexedDB persistence (idb-keyval): dropped tapes (metadata + original audio blob)
 * and a small wear history for every tape, including the built-in demo.
 */
import { get, set, del } from 'idb-keyval'
import type { Side, Tape } from './types'

const TAPES = 'cc:tapes'
const WEAR = 'cc:wear'
const blobKey = (id: string, side: Side) => `cc:blob:${id}:${side}`

interface WearEntry {
  plays: number
  wound: number
  side: Side
}

export async function loadSavedTapes(): Promise<{ tapes: Tape[]; blobs: Record<string, Partial<Record<Side, Blob>>> }> {
  try {
    const tapes = (await get<Tape[]>(TAPES)) ?? []
    const blobs: Record<string, Partial<Record<Side, Blob>>> = {}
    for (const t of tapes) {
      blobs[t.id] = {}
      for (const s of ['A', 'B'] as Side[]) {
        const b = await get<Blob>(blobKey(t.id, s))
        if (b) blobs[t.id][s] = b
      }
    }
    return { tapes, blobs }
  } catch (err) {
    console.warn('Could not read saved tapes', err)
    return { tapes: [], blobs: {} }
  }
}

export async function saveTape(tape: Tape, blobs: Partial<Record<Side, Blob>>) {
  try {
    const all = ((await get<Tape[]>(TAPES)) ?? []).filter((t) => t.id !== tape.id)
    all.push(tape)
    await set(TAPES, all)
    for (const s of ['A', 'B'] as Side[]) if (blobs[s]) await set(blobKey(tape.id, s), blobs[s])
  } catch (err) {
    console.warn('Could not save tape', err)
  }
}

export async function forgetTape(id: string) {
  try {
    const all = ((await get<Tape[]>(TAPES)) ?? []).filter((t) => t.id !== id)
    await set(TAPES, all)
    await del(blobKey(id, 'A'))
    await del(blobKey(id, 'B'))
  } catch (err) {
    console.warn('Could not forget tape', err)
  }
}

export async function loadWear(): Promise<Record<string, WearEntry>> {
  try {
    return (await get<Record<string, WearEntry>>(WEAR)) ?? {}
  } catch {
    return {}
  }
}

export async function saveWear(tape: Tape) {
  try {
    const all = (await get<Record<string, WearEntry>>(WEAR)) ?? {}
    all[tape.id] = { plays: tape.plays, wound: tape.wound, side: tape.side }
    await set(WEAR, all)
  } catch {
    /* storage unavailable (private mode) — wear just won't persist */
  }
}
