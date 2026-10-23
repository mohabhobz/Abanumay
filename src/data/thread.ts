import { useSyncExternalStore } from 'react'
import type { ThreadMessage } from '@/data/mock/detail'

/* The correspondence with the entity · one store for every channel (client 21 Oct · #2 · #3).

   The thread used to be a drawing: the composer cleared its draft on send and nothing was kept,
   so the sender never saw what he had sent, and an attachment was a «[مرفق: …]» token in the text.
   Now each channel (a closing case, a project, a registration request) keeps its messages and the
   files on them, saved in the browser and replayed on reload, over the seed messages the record
   already carries.

   A file small enough is kept with its content (a data URL) so it opens again after a reload; a
   larger one keeps its name, size and type, and opens in the system's in-place preview. */

export interface ThreadFile {
  name: string
  size: number
  type: string
  /** The content, when small enough to keep in the browser */
  data?: string
}

export interface ChatMessage extends ThreadMessage {
  files?: ThreadFile[]
  /** Sent in this browser · not part of the record's seed */
  local?: boolean
}

const KEY = 'ab-threads-v1'
const SEEN = 'ab-threads-seen-v1'
/** Files up to this size keep their content · larger ones keep their record only */
export const KEEP_BYTES = 350 * 1024

type Store = Record<string, ChatMessage[]>
const load = <T,>(k: string, fb: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb } catch { return fb }
}
let sent: Store = load<Store>(KEY, {})
let seen: Record<string, string> = load<Record<string, string>>(SEEN, {})
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(sent)) } catch {
    /* Storage full or blocked · drop the kept contents and retry with the records alone */
    try {
      const slim: Store = Object.fromEntries(Object.entries(sent).map(([k, v]) => [k, v.map((m) => ({ ...m, files: m.files?.map(({ data: _d, ...f }) => f) }))]))
      localStorage.setItem(KEY, JSON.stringify(slim))
    } catch { /* the messages still apply for this visit */ }
  }
}

export function useThreads(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}

/** The channel's messages · the record's seed, then what was sent, in time order */
export function threadOf(channel: string, seed: ThreadMessage[] = []): ChatMessage[] {
  return [...seed, ...(sent[channel] ?? [])].sort((a, b) => a.at.localeCompare(b.at))
}

export function sendMessage(channel: string, m: Omit<ChatMessage, 'at' | 'local'>): void {
  const msg: ChatMessage = { ...m, at: new Date().toISOString(), local: true }
  sent = { ...sent, [channel]: [...(sent[channel] ?? []), msg] }
  seen = { ...seen, [`${channel}:${m.from}`]: msg.at }
  save()
  try { localStorage.setItem(SEEN, JSON.stringify(seen)) } catch { /* blocked */ }
  emit()
}

/** Messages from the other side newer than the last time this side opened the channel */
export function unreadOf(channel: string, me: 'staff' | 'entity', seed: ThreadMessage[] = []): number {
  const last = seen[`${channel}:${me}`] ?? ''
  return threadOf(channel, seed).filter((m) => m.from !== me && m.at > last).length
}

export function markSeen(channel: string, me: 'staff' | 'entity'): void {
  const at = new Date().toISOString()
  if ((seen[`${channel}:${me}`] ?? '') >= at) return
  seen = { ...seen, [`${channel}:${me}`]: at }
  try { localStorage.setItem(SEEN, JSON.stringify(seen)) } catch { /* blocked */ }
  emit()
}

/** Read a picked file into the record kept with the message */
export function readFile(f: File): Promise<ThreadFile> {
  const base: ThreadFile = { name: f.name, size: f.size, type: f.type || 'application/octet-stream' }
  if (f.size > KEEP_BYTES) return Promise.resolve(base)
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res({ ...base, data: typeof r.result === 'string' ? r.result : undefined })
    r.onerror = () => res(base)
    r.readAsDataURL(f)
  })
}
