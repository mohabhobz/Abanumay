import type { ActorKind, LogEvent } from '@/data/mock/log'
import { fileOpsOf } from '@/data/shared/files'

/* Client 27 Oct · every record's log reads in the projects' log shape (`LogTab`) · this turns a
   record's own entries (each store keeps its own) into the log's events, newest first */

export interface LogItem {
  at: string
  by: string
  what: string
  note?: string
  /** The seat or department · defaults to the record's */
  dept?: string
  /** Who acted · staff unless said */
  actor?: ActorKind
  /** Extra named values shown when the entry opens */
  fields?: { k: string; v: string }[]
}

export function recordLog(prefix: string, dept: string, items: LogItem[], newestFirst = false): LogEvent[] {
  const list = newestFirst ? items : [...items].reverse()
  return list.map((e, i): LogEvent => ({
    id: `${prefix}-${list.length - i}`,
    action: e.what,
    dept: e.dept ?? dept,
    by: e.by,
    actor: e.actor ?? 'staff',
    at: e.at.slice(0, 10),
    time: e.at.length > 11 && e.at[10] === 'T' ? e.at.slice(11, 16) : '',
    days: 0, hours: 0, limit: 0,
    fields: [...(e.note ? [{ k: 'الملاحظة', v: e.note }] : []), ...(e.fields ?? [])],
    tone: 'mute',
  }))
}

/** The files added on a record and removed from it, as log entries · the entity's own uploads read as the entity's */
export const fileMoves = (record: string, entityName: string, place = 'المرفقات'): LogItem[] =>
  fileOpsOf(record).map((o) => ({
    at: o.at, by: o.by,
    what: o.op === 'add' ? `أرفق «${o.name}» في ${place}` : `حذف «${o.name}» من ${place}`,
    actor: o.by === entityName ? 'entity' as const : 'staff' as const,
    dept: place,
    fields: [{ k: 'الملف', v: o.name }],
  }))
