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
  /** Lazily synthesises the programme the first time it is needed. */
  make?: () => Promise<AudioBuffer>
  pending?: Promise<AudioBuffer>
}
const entries = new Map<string, Entry>()
const key = (id: string, side: Side) => `${id}:${side}`

export function putProgramme(id: string, side: Side, data: { buffer?: AudioBuffer; blob?: Blob; make?: () => Promise<AudioBuffer> }) {
  entries.set(key(id, side), { ...entries.get(key(id, side)), ...data })
}

export function getBlob(id: string, side: Side): Blob | undefined {
  return entries.get(key(id, side))?.blob
}

export function dropProgramme(id: string) {
  entries.delete(key(id, 'A'))
  entries.delete(key(id, 'B'))
}

/** Make sure a side's audio exists (decode or synthesise it). Safe to call repeatedly and concurrently. */
export async function warmProgramme(id: string, side: Side): Promise<void> {
  const e = entries.get(key(id, side))
  if (!e || e.buffer) return
  if (e.blob) e.buffer = await decodeBlob(e.blob)
  else if (e.make) {
    e.pending ??= e.make()
    e.buffer = await e.pending
  }
}

/** Build a source for one side, decoding lazily from the stored blob. Null for a blank side. */
export async function sourceFor(id: string, side: Side, label: string): Promise<TapeSource | null> {
  const e = entries.get(key(id, side))
  if (!e) return null
  await warmProgramme(id, side)
  if (!e.buffer) return null
  return new LocalFileSource(`${id}:${side}`, label, e.buffer)
}
