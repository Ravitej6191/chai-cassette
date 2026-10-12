/**
 * Runtime store for tape programme material. Audio data is too big and too
 * non-serialisable for the zustand store, so it lives here, keyed by tape id + side.
 */
import type { Side } from '../tapes/types'
import { LocalFileSource, decodeBlob } from './LocalFileSource'
import type { TapeSource } from './types'

interface Entry {
  buffer?: AudioBuffer
  blob?: Blob
}
const entries = new Map<string, Entry>()
const key = (id: string, side: Side) => `${id}:${side}`

export function putProgramme(id: string, side: Side, data: { buffer?: AudioBuffer; blob?: Blob }) {
  entries.set(key(id, side), { ...entries.get(key(id, side)), ...data })
}

export function getBlob(id: string, side: Side): Blob | undefined {
  return entries.get(key(id, side))?.blob
}

export function dropProgramme(id: string) {
  entries.delete(key(id, 'A'))
  entries.delete(key(id, 'B'))
}

/** Build a source for one side, decoding lazily from the stored blob. Null for a blank side. */
export async function sourceFor(id: string, side: Side, label: string): Promise<TapeSource | null> {
  const e = entries.get(key(id, side))
  if (!e) return null
  if (!e.buffer && e.blob) e.buffer = await decodeBlob(e.blob)
  if (!e.buffer) return null
  return new LocalFileSource(`${id}:${side}`, label, e.buffer)
}
