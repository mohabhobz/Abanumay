import { useSyncExternalStore } from 'react'
import { CFG, persist, readJson } from '@/lib/config'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { ALL_FIELDS, CYCLE } from '@/data/intake/cycle'
import { projectRows } from '@/data/mock/projects'
import { allBudgets } from '@/data/mock/chain'
import { done } from '@/data/feedback'

/* Client sheet 26 Oct (#112) · the budget settings hold the classification every project and
   budget line reads · track › field › goal. A value added here joins the same lists the project
   form, the filters and the budget tree read, so it is picked like any seeded one. Nothing is
   deleted · a value carries the projects classified under it. */

export type TaxonLevel = 'track' | 'field' | 'goal'

/* Client 27 Oct · each value has a code, like a funding source · a seeded value reads its code from
   its order, a value added here takes the code it was given · a value nothing is classified under
   yet may be renamed */
interface Rename { level: TaxonLevel; from: string; to: string }
interface Added {
  tracks: string[]; fields: Record<string, string[]>; goals: Record<string, string[]>
  codes?: Record<string, string>
  renames?: Rename[]
}

const saved: Added = readJson<Added>(CFG.taxonomy, { tracks: [], fields: {}, goals: {} })
saved.codes ??= {}
saved.renames ??= []

const tracks = TRACKS as unknown as string[]

const swap = (list: string[], from: string, to: string) => { const i = list.indexOf(from); if (i >= 0) list[i] = to }
const rekey = (m: Record<string, string[]>, from: string, to: string) => { if (m[from] && !m[to]) { m[to] = m[from]; delete m[from] } }

const applyRename = (r: Rename) => {
  if (r.level === 'track') { swap(tracks, r.from, r.to); rekey(FIELDS_BY_TRACK, r.from, r.to) }
  else if (r.level === 'field') {
    for (const fs of Object.values(FIELDS_BY_TRACK)) swap(fs, r.from, r.to)
    swap(ALL_FIELDS, r.from, r.to)
    rekey(GOALS_BY_FIELD, r.from, r.to)
    if (CYCLE.domains[r.from] && !CYCLE.domains[r.to]) { CYCLE.domains[r.to] = CYCLE.domains[r.from]!; delete CYCLE.domains[r.from] }
  } else for (const gs of Object.values(GOALS_BY_FIELD)) swap(gs, r.from, r.to)
}

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
for (const r of saved.renames!) applyRename(r)

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

/* ── Codes ── */

const PREFIX: Record<TaxonLevel, string> = { track: 'TR', field: 'FD', goal: 'GL' }
/* a goal is named within its field (one name can sit under two fields), so its code is keyed by both */
const keyOf = (level: TaxonLevel, name: string, parent?: string) => level === 'goal' ? `goal:${parent ?? ''}/${name}` : `${level}:${name}`
const seededOrder = (level: TaxonLevel): { name: string; parent?: string }[] =>
  level === 'track' ? tracks.map((name) => ({ name }))
    : level === 'field' ? Object.values(FIELDS_BY_TRACK).flat().map((name) => ({ name }))
      : tracks.flatMap((t) => (FIELDS_BY_TRACK[t] ?? []).flatMap((f) => (GOALS_BY_FIELD[f] ?? []).map((name) => ({ name, parent: f }))))

/** A value's code · the one it was given, else one read from its order in the list */
export function taxonCode(level: TaxonLevel, name: string, parent?: string): string {
  const own = saved.codes![keyOf(level, name, parent)]
  if (own) return own
  const i = seededOrder(level).findIndex((x) => x.name === name && (level !== 'goal' || x.parent === parent))
  return `${PREFIX[level]}-${String(i + 1).padStart(level === 'goal' ? 3 : 2, '0')}`
}

/** What refuses a code · empty when it is free */
export function codeIssue(level: TaxonLevel, code: string): string {
  const c = code.trim().toUpperCase()
  if (!c) return 'اكتب الرمز'
  return seededOrder(level).some((x) => taxonCode(level, x.name, x.parent) === c) ? 'الرمز مستعمل من قبل' : ''
}

/** Budget lines labelled with the value · in any budget document */
export const taxonBudgets = (name: string): number => allBudgets.filter((d) => d.nodes.some((n) => n.label === name)).length

/** Rename a value nothing is classified under yet · refused (the reason) otherwise */
export function renameTaxon(level: TaxonLevel, from: string, to: string, parent?: string): string {
  const n = to.trim()
  if (!n || n === from) return ''
  if (taxonUse(level, from) || taxonBudgets(from)) return 'لا يُعاد تسمية قيمة مصنَّف عليها مشاريع أو بنود ميزانية'
  const bad = taxonIssue(level, n, level === 'goal' ? parent : level === 'field' ? parent ?? '-' : undefined)
  if (bad) return bad
  const code = taxonCode(level, from, parent)
  const r: Rename = { level, from, to: n }
  applyRename(r)
  saved.renames!.push(r)
  saved.codes![keyOf(level, n, parent)] = code
  delete saved.codes![keyOf(level, from, parent)]
  persist(CFG.taxonomy, saved)
  emit()
  done(`أُعيدت التسمية إلى «${n}»`)
  return ''
}

export function addTaxon(level: TaxonLevel, name: string, parent?: string, code?: string): string {
  const bad = taxonIssue(level, name, parent) || (code !== undefined ? codeIssue(level, code) : '')
  if (bad) return bad
  const n = name.trim()
  if (code !== undefined) saved.codes![keyOf(level, n, parent)] = code.trim().toUpperCase()
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
