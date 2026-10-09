import { useSyncExternalStore } from 'react'
import { EHSAN_PAYS, type EhsanPay, type PayTarget } from './store'
import { projectRows } from '@/data/mock/projects'
import { PORTFOLIOS } from './store'
import { amountOf, colOf, dateOf, type Table } from '@/lib/sheetRead'

/* Reconciling the Ehsan payments with the platform · batch 8 (partners#34 · 11.4.23 · 11.4.24).

   Ehsan executes the payments; the supervisor records each one here with the platform's operation
   number, and finance confirms it. What was missing is checking the two records against each other.
   Finance exports the platform's operations as a CSV or Excel file and uploads it; every row is
   matched by its operation number to the recorded payment:

   · matched · same number, same amount, same date
   · amount · same number, different amount
   · date · same number and amount, different date
   · platform only · on the platform, not recorded here · a payment nobody recorded
   · system only · recorded here within the file's dates, not on the platform · recorded by mistake,
     or not executed

   Each difference can be marked reviewed with a note, and each upload is kept with who uploaded it,
   so the reconciliation itself is on record. In production the file is fetched from the platform's
   API instead of uploaded, and the same comparison runs on the server. */

export interface ReconRow { ref: string; amount: number; paidAt: string; project: string }
export interface ReconResolve { key: string; note: string; by: string; at: string }
export interface ReconRun { id: string; at: string; by: string; file: string; rows: ReconRow[]; resolved: ReconResolve[] }

export type ReconKind = 'matched' | 'amount' | 'date' | 'platform' | 'system'
export const RECON_SAY: Record<ReconKind, string> = {
  matched: 'متطابقة', amount: 'فرق في المبلغ', date: 'فرق في التاريخ', platform: 'في المنصة فقط', system: 'في النظام فقط',
}
export const RECON_TONE: Record<ReconKind, 'ok' | 'no' | 'warn' | 'ret'> = { matched: 'ok', amount: 'no', date: 'warn', platform: 'no', system: 'ret' }

export interface ReconItem { key: string; kind: ReconKind; ref: string; platform?: ReconRow; system?: EhsanPay; diff: number; target: string; resolved?: ReconResolve }

type Op = { op: 'run'; run: Omit<ReconRun, 'resolved'> } | { op: 'resolve'; runId: string; r: ReconResolve }

const KEY = 'ab-eh-recon-ops'
let ops: Op[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { return [] } })()
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ } }

export function useReconcile(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => version)
}

export function reconRuns(): ReconRun[] {
  const runs: ReconRun[] = []
  for (const o of ops) {
    if (o.op === 'run') runs.push({ ...o.run, resolved: [] })
    else runs.find((r) => r.id === o.runId)?.resolved.push(o.r)
  }
  return runs.reverse()
}

/** The target of a recorded payment, named */
export function targetName(t: PayTarget): string {
  if (t.kind === 'project') return projectRows.find((p) => p.id === t.projectId)?.name ?? t.projectId
  const pf = PORTFOLIOS.find((p) => p.id === t.pfId)
  if (t.kind === 'portfolio') return pf?.name ?? t.pfId
  return `${pf?.items.find((x) => x.id === t.subId)?.name ?? t.subId} · ${pf?.name ?? t.pfId}`
}

/** The file's rows · the columns are found by their header, in Arabic or English */
export function rowsOfTable(t: Table): { rows: ReconRow[]; errors: string[] } {
  const [head, ...body] = t
  if (!head) return { rows: [], errors: ['الملف فارغ'] }
  const cRef = colOf(head, ['رقم العملية', 'المرجع', 'ref', 'reference', 'operation', 'رقمالعملية'])
  const cAmt = colOf(head, ['المبلغ', 'amount', 'القيمة'])
  const cDate = colOf(head, ['التاريخ', 'تاريخ التنفيذ', 'date', 'paidat'])
  const cPrj = colOf(head, ['المشروع', 'project', 'رقم المشروع'])
  const errors: string[] = []
  if (cRef < 0) errors.push('لا عمود «رقم العملية» في الملف')
  if (cAmt < 0) errors.push('لا عمود «المبلغ» في الملف')
  if (errors.length) return { rows: [], errors }
  const rows: ReconRow[] = []
  body.forEach((r, i) => {
    const ref = (r[cRef] ?? '').trim()
    if (!ref) return
    const amount = amountOf(r[cAmt] ?? '')
    if (!amount) errors.push(`السطر ${i + 2}: مبلغ غير مقروء`)
    rows.push({ ref, amount, paidAt: cDate >= 0 ? dateOf(r[cDate] ?? '') : '', project: cPrj >= 0 ? (r[cPrj] ?? '') : '' })
  })
  const dup = rows.map((x) => x.ref).filter((x, i, a) => a.indexOf(x) !== i)
  if (dup.length) errors.push(`رقم عملية مكرر في الملف: ${[...new Set(dup)].join('، ')}`)
  if (!rows.length) errors.push('لا صفوف بأرقام عمليات في الملف')
  return { rows, errors }
}

export function compare(run: ReconRun): ReconItem[] {
  const live = EHSAN_PAYS.filter((p) => p.state !== 'returned')
  const byRef = new Map(live.map((p) => [p.ref.trim(), p]))
  const done = new Map(run.resolved.map((r) => [r.key, r]))
  const out: ReconItem[] = []
  for (const row of run.rows) {
    const sys = byRef.get(row.ref)
    const key = `p:${row.ref}`
    if (!sys) { out.push({ key, kind: 'platform', ref: row.ref, platform: row, diff: row.amount, target: row.project || '—', resolved: done.get(key) }); continue }
    const kind: ReconKind = sys.amount !== row.amount ? 'amount' : row.paidAt && sys.paidAt !== row.paidAt ? 'date' : 'matched'
    out.push({ key, kind, ref: row.ref, platform: row, system: sys, diff: row.amount - sys.amount, target: targetName(sys.target), resolved: done.get(key) })
  }
  /* Recorded here within the file's dates and absent from it */
  const dates = run.rows.map((r) => r.paidAt).filter(Boolean).sort()
  const from = dates[0]
  const to = dates[dates.length - 1]
  const inFile = new Set(run.rows.map((r) => r.ref))
  for (const p of live) {
    if (inFile.has(p.ref.trim())) continue
    if (from && to && (p.paidAt < from || p.paidAt > to)) continue
    const key = `s:${p.id}`
    out.push({ key, kind: 'system', ref: p.ref, system: p, diff: -p.amount, target: targetName(p.target), resolved: done.get(key) })
  }
  const order: ReconKind[] = ['amount', 'platform', 'system', 'date', 'matched']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
}

export function reconTotals(items: ReconItem[]) {
  const n = (k: ReconKind) => items.filter((x) => x.kind === k).length
  return {
    matched: n('matched'), amount: n('amount'), date: n('date'), platform: n('platform'), system: n('system'),
    open: items.filter((x) => x.kind !== 'matched' && !x.resolved).length,
    platformSum: items.reduce((s, x) => s + (x.platform?.amount ?? 0), 0),
    systemSum: items.reduce((s, x) => s + (x.system?.amount ?? 0), 0),
  }
}

export function addRun(file: string, rows: ReconRow[], by: string): string {
  const id = `RC-${String(reconRuns().length + 1).padStart(3, '0')}`
  ops.push({ op: 'run', run: { id, at: new Date().toISOString(), by, file, rows } })
  save(); emit()
  return id
}

export function resolveItem(runId: string, key: string, note: string, by: string): string[] {
  if (!note.trim()) return ['اكتب ما تبيّن في المراجعة']
  ops.push({ op: 'resolve', runId, r: { key, note: note.trim(), by, at: new Date().toISOString() } })
  save(); emit()
  return []
}

/** A sample of the platform's export · the recorded payments with three differences, for a first try */
export function sampleTable(): Table {
  const live = EHSAN_PAYS.filter((p) => p.state !== 'returned')
  const rows = live.slice(0, Math.max(0, live.length - 1)).map((p, i) => [p.ref, String(i === 1 ? p.amount + 500 : p.amount), i === 2 ? p.paidAt.replace(/\d{2}$/, '01') : p.paidAt, targetName(p.target)])
  rows.push(['EH-99901', '18000', live[0]?.paidAt ?? '2026-09-01', 'غير مسجّلة في النظام'])
  return [['رقم العملية', 'المبلغ', 'التاريخ', 'المشروع'], ...rows]
}

export const resetReconcile = () => { ops = []; save(); emit() }
