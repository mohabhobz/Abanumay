import { useSyncExternalStore } from 'react'
import { done } from '@/data/feedback'
import { projectRows } from '@/data/mock/projects'
import type { LogEvent } from '@/data/mock/log'
import type { RoleKey } from '@/data/roles'
import type { ProjectRow } from '@/types/domain'

/* Client 24 Oct · «كل سكشن فيه بيانات محتاج أكشن تعديل في المشروع … في شكل بوب أب» · and
   «فكرة المشروع برضو تكون أداتابل».

   The project's own data, edited from each section of its data tab: the definition, the idea and
   its goals, the scope. Each save is one record (who, when, why, every field before → after),
   replayed on load, shown in the project's log. What the list and the other screens read from the
   row (region, city, beneficiaries, the dates, the tags) lands on the row itself, so every screen
   reads the edited value; the rest (the idea, the goals, the manager, the audiences) is read by the
   project page over the request's own content. */

export interface ProjectChange { key: string; label: string; from: string; to: string }
interface Op { projectId: string; section: string; changes: ProjectChange[]; reason: string; by: string; at: string }

const KEY = 'ab-project-edits'
let ops: Op[] = []
const VALUES = new Map<string, Record<string, string>>()
const EVENTS = new Map<string, LogEvent[]>()
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export function useProjectEdits(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}

/** The row's own fields · numbers stay numbers, the tags a list */
const ROW_KEYS = ['region', 'city', 'beneficiaries', 'startAt', 'endAt', 'tags', 'durationDays'] as const
const NUMS = ['beneficiaries', 'durationDays']
/** A list edited one per line · stored with its line breaks */
export const SPLIT = (v: string): string[] => v.split('\n').map((x) => x.trim()).filter(Boolean)

const SECTION_SAY: Record<string, string> = {
  def: 'تعديل تعريف المشروع', idea: 'تعديل فكرة المشروع', scope: 'تعديل النطاق والأثر', docs: 'استبدال مرفق',
}

function apply(o: Op) {
  const r = projectRows.find((x) => x.id === o.projectId)
  const v = { ...(VALUES.get(o.projectId) ?? {}) }
  for (const c of o.changes) {
    v[c.key] = c.to
    if (r && (ROW_KEYS as readonly string[]).includes(c.key)) {
      const rec = r as unknown as Record<string, unknown>
      rec[c.key] = NUMS.includes(c.key) ? Number(c.to) || 0 : c.key === 'tags' ? SPLIT(c.to) : c.to
    }
  }
  VALUES.set(o.projectId, v)
  const list = EVENTS.get(o.projectId) ?? []
  list.unshift({
    id: `pe-${o.projectId}-${list.length + 1}`,
    action: SECTION_SAY[o.section] ?? 'تعديل بيانات المشروع',
    dept: r?.stage ?? 'بيانات المشروع',
    by: o.by, actor: 'staff', at: o.at.slice(0, 10), time: o.at.slice(11, 16),
    days: 0, hours: 0, limit: 900, tone: 'ret', manual: true,
    fields: [...o.changes.map((c) => ({ k: c.label, v: `${c.from.replaceAll('\n', ' · ') || '—'} ← ${c.to.replaceAll('\n', ' · ') || '—'}` })), ...(o.reason ? [{ k: 'سبب التعديل', v: o.reason }] : [])],
  } as LogEvent)
  EVENTS.set(o.projectId, list)
}

try { ops = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { ops = [] }
for (const o of ops) apply(o)

/** What the edits made of the project's own content · by field */
export const projectEdited = (id: string): Record<string, string> => VALUES.get(id) ?? {}
/** The edits in the project's log */
export const projectEditEvents = (id: string): LogEvent[] => EVENTS.get(id) ?? []

/** Who edits a project's data · the system admin, the grants manager, and the supervisor who owns it ·
    a closed or dropped project keeps its record */
export function canEditProject(role: RoleKey | string, me: string, row: ProjectRow | undefined): boolean {
  if (!row) return false
  if (['مكتمل', 'معتذر عنه', 'ملغى'].includes(row.statusGroup)) return false
  return role === 'admin' || role === 'grants-manager' || (role === 'supervisor' && (!row.owner || row.owner === me))
}

export function editProject(projectId: string, section: string, changes: ProjectChange[], reason: string, by: string): string[] {
  if (!changes.length) return ['لم يتغيّر شيء']
  const bad = changes.find((c) => NUMS.includes(c.key) && !(Number(c.to) > 0))
  if (bad) return [`${bad.label} رقم أكبر من صفر`]
  const o: Op = { projectId, section, changes, reason, by, at: new Date().toISOString() }
  ops.push(o)
  apply(o)
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked · the edit holds for this visit */ }
  emit()
  done('edit', 'بيانات المشروع')
  return []
}
