import { useSyncExternalStore } from 'react'
import { DECISIONS } from '@/data/shared/decisions'
import { CRITERIA, studyScore } from './criteria'
import { flowOf } from './flow'

/* A request's priority · batch 8 (the priority decision).

   Two ways, one setting (settings › قرارات المؤسسة):
   · manual · the project's supervisor or the grants manager sets it, with a reason, and each change
     is kept
   · computed · from the study's weighted score: 80 and above is high, 60 – 79 medium, below 60
     normal · before the study is scored it says so instead of guessing

   The list of manual settings is an ordered log in the browser like the other stores; in production
   each is a POST. */

export type Priority = 'high' | 'medium' | 'normal'
export const PRIORITY_SAY: Record<Priority, string> = { high: 'عالية', medium: 'متوسطة', normal: 'عادية' }
export const PRIORITY_TONE: Record<Priority, 'no' | 'warn' | 'mute'> = { high: 'no', medium: 'warn', normal: 'mute' }

export interface PrioritySet { projectId: string; level: Priority; reason: string; by: string; at: string }

const KEY = 'ab-priority-ops'
let ops: PrioritySet[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as PrioritySet[] } catch { return [] } })()
let version = 0
const subs = new Set<() => void>()

export function usePriority(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => version)
}

/** The manual settings of a project, oldest first */
export const priorityLog = (projectId: string): PrioritySet[] => ops.filter((o) => o.projectId === projectId)

export function setPriority(projectId: string, level: Priority, reason: string, by: string): string[] {
  if (DECISIONS.priority !== 'manual') return ['الأولوية محسوبة من الدراسة حسب قرار المؤسسة']
  if (!reason.trim()) return ['اكتب سبب تحديد الأولوية']
  ops = [...ops, { projectId, level, reason: reason.trim(), by, at: new Date().toISOString() }]
  try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ }
  version++
  subs.forEach((f) => f())
  return []
}

export interface PriorityRead { level: Priority | null; say: string; basis: string; mode: 'manual' | 'computed' }

export function priorityOf(projectId: string): PriorityRead {
  if (DECISIONS.priority === 'manual') {
    const last = priorityLog(projectId).at(-1)
    return last
      ? { level: last.level, say: PRIORITY_SAY[last.level], basis: `حدّدها ${last.by} · ${last.reason}`, mode: 'manual' }
      : { level: null, say: 'لم تُحدَّد', basis: 'يحدّدها مشرف المنح أو مدير المنح', mode: 'manual' }
  }
  const scores = flowOf(projectId).study?.scores ?? {}
  const scored = CRITERIA.list.filter((c) => scores[c.key]).length
  if (!scored) return { level: null, say: 'تُحسب بعد الدراسة', basis: 'من درجة الدراسة الموزونة', mode: 'computed' }
  const n = studyScore(scores)
  const level: Priority = n >= 80 ? 'high' : n >= 60 ? 'medium' : 'normal'
  return { level, say: PRIORITY_SAY[level], basis: `درجة الدراسة ${n} من 100${scored < CRITERIA.list.length ? ` · ${scored} من ${CRITERIA.list.length} معايير مقيّمة` : ''}`, mode: 'computed' }
}
