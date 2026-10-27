import { useSyncExternalStore } from 'react'
import { stampNow } from '@/data/clock'
import { done } from '@/data/feedback'

/* Client 27 Oct · «المرفقات» on every record · the files a record carries (its own documents, passed
   in by its page) and the files added on it from its attachments tab. One store for every record,
   keyed `kind:id` («agreement:AG-2026-3101»), so a file added on a record is the one its tab lists
   on every visit. Nothing is overwritten · a removed file leaves its line in the record's own log.

   On the server each operation is a `POST /api/files/<op>` and the list is a `GET /api/files?record=`. */

export interface RecordFile {
  id: string
  record: string
  name: string
  size: number
  by: string
  at: string
}

type Op =
  | { op: 'add'; id: string; record: string; name: string; size: number; by: string; at: string }
  | { op: 'drop'; id: string; by: string; at: string }

const KEY = 'ab-files'
const read = (): Op[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { return [] } }
const ops: Op[] = read()
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ } }

let files: RecordFile[] = []
const rebuild = () => {
  const out = new Map<string, RecordFile>()
  for (const o of ops) {
    if (o.op === 'add') out.set(o.id, { id: o.id, record: o.record, name: o.name, size: o.size, by: o.by, at: o.at })
    else out.delete(o.id)
  }
  files = [...out.values()]
}
rebuild()

let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export const useFiles = (): number => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)

/** The files added on a record, newest first */
export const filesOf = (record: string): RecordFile[] => files.filter((f) => f.record === record).sort((a, b) => b.at.localeCompare(a.at))

/** Every add and remove on a record, in order · a removed file keeps its name for the log */
export const fileOpsOf = (record: string): { op: 'add' | 'drop'; name: string; size: number; by: string; at: string }[] => {
  const added = new Map<string, { name: string; size: number }>()
  const out: { op: 'add' | 'drop'; name: string; size: number; by: string; at: string }[] = []
  for (const o of ops) {
    if (o.op === 'add') {
      if (o.record !== record) continue
      added.set(o.id, { name: o.name, size: o.size })
      out.push({ op: 'add', name: o.name, size: o.size, by: o.by, at: o.at })
    } else {
      const f = added.get(o.id)
      if (f) out.push({ op: 'drop', name: f.name, size: f.size, by: o.by, at: o.at })
    }
  }
  return out
}

export function addFiles(record: string, picked: { name: string; size: number }[], by: string): void {
  if (!picked.length) return
  const at = stampNow()
  picked.forEach((p, i) => ops.push({ op: 'add', id: `f-${Date.now().toString(36)}-${i}`, record, name: p.name, size: p.size, by, at }))
  write(); rebuild(); emit()
  done(picked.length === 1 ? `أُرفق «${picked[0]!.name}»` : `أُرفقت ${picked.length} ملفات`)
}

/** Only the one who added a file removes it · refused (the reason) otherwise */
export function dropFile(id: string, by: string): string {
  const f = files.find((x) => x.id === id)
  if (!f) return 'الملف غير موجود'
  if (f.by !== by) return 'يحذف الملف من أرفقه فقط'
  ops.push({ op: 'drop', id, by, at: stampNow() })
  write(); rebuild(); emit()
  done(`حُذف «${f.name}»`)
  return ''
}
