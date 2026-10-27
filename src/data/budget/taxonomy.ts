import { useSyncExternalStore } from 'react'
import { CFG, persist, readJson } from '@/lib/config'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { ALL_FIELDS, CYCLE } from '@/data/intake/cycle'
import { projectRows } from '@/data/mock/projects'
import { done } from '@/data/feedback'

/* Client sheet 26 Oct (#112) · the budget settings hold the classification every project and
   budget line reads · track › field › goal. A value added here joins the same lists the project
   form, the filters and the budget tree read, so it is picked like any seeded one. Nothing is
   deleted · a value carries the projects classified under it. */

export type TaxonLevel = 'track' | 'field' | 'goal'

interface Added { tracks: string[]; fields: Record<string, string[]>; goals: Record<string, string[]> }

const saved: Added = readJson<Added>(CFG.taxonomy, { tracks: [], fields: {}, goals: {} })

const tracks = TRACKS as unknown as string[]

const apply = (a: Added) => {
  for (const t of a.tracks) if (!tracks.includes(t)) tracks.push(t)
  for (const [t, fs] of Object.entries(a.fields)) {
    const list = (FIELDS_BY_TRACK[t] ??= [])
    for (const f of fs) {
      if (!list.includes(f)) list.push(f)
      if (!ALL_FIELDS.includes(f)) ALL_FIELDS.push(f)
      if (!CYCLE.domains[f]) CYCLE.domains[f] = { supervisors: [], distribution: 'manual', open: false }
    }
  }
  for (const [f, gs] of Object.entries(a.goals)) {
    const list = (GOALS_BY_FIELD[f] ??= [])
    for (const g of gs) if (!list.includes(g)) list.push(g)
  }
}
apply(saved)

let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }

export function useTaxonomy(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)
}

/** What refuses a new value · empty when it can be added */
export function taxonIssue(level: TaxonLevel, name: string, parent?: string): string {
  const n = name.trim()
  if (!n) return 'اكتب الاسم'
  if (level === 'track') return tracks.includes(n) ? 'المسار معرَّف من قبل' : ''
  if (!parent) return level === 'field' ? 'اختر المسار أولًا' : 'اختر المجال أولًا'
  if (level === 'field') return Object.values(FIELDS_BY_TRACK).some((fs) => fs.includes(n)) ? 'المجال معرَّف من قبل' : ''
  return (GOALS_BY_FIELD[parent] ?? []).includes(n) ? 'الهدف معرَّف في هذا المجال من قبل' : ''
}

export function addTaxon(level: TaxonLevel, name: string, parent?: string): string {
  const bad = taxonIssue(level, name, parent)
  if (bad) return bad
  const n = name.trim()
  if (level === 'track') saved.tracks.push(n)
  else if (level === 'field') (saved.fields[parent!] ??= []).push(n)
  else (saved.goals[parent!] ??= []).push(n)
  apply(saved)
  persist(CFG.taxonomy, saved)
  emit()
  done(`أُضيف ${level === 'track' ? 'المسار' : level === 'field' ? 'المجال' : 'الهدف'} «${n}»`)
  return ''
}

/** Projects classified under a value · what keeps it from being removed */
export const taxonUse = (level: TaxonLevel, name: string): number =>
  projectRows.filter((p) => (level === 'track' ? p.track : level === 'field' ? p.field : p.goal) === name).length

export const isAdded = (level: TaxonLevel, name: string): boolean =>
  level === 'track' ? saved.tracks.includes(name)
    : level === 'field' ? Object.values(saved.fields).some((x) => x.includes(name))
      : Object.values(saved.goals).some((x) => x.includes(name))
