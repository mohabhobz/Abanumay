import { useSyncExternalStore } from 'react'
import { projectRows } from '@/data/mock/projects'
import { amountOf, colOf, dateOf, type Table } from '@/lib/sheetRead'

/* The old system's payments · batch 8 (migration).

   Until now a project paid before the system was inferred: completed, an agreement on record, no
   request here, so «paid in full». That reads right in closing and the reports, but it isn't a
   record: no voucher, no date, no split across payments. Finance now exports the old system's
   vouchers (CSV or Excel) and imports them here. Each row is checked before anything is saved:

   · the project exists
   · the amount is a positive number and the date can be read
   · the voucher number isn't already imported or repeated in the file
   · the project's imported total doesn't pass its grant

   An import is one batch with who imported it and from which file; a batch can be withdrawn whole
   (with a reason) if it was the wrong file. Imported vouchers replace the inference for their
   project: the schedule marks payments paid in order with the voucher on each, and the paid amount
   is the vouchers' total. In production this is the migration script's table. */

export interface LegacyVoucher { projectId: string; voucher: string; amount: number; paidAt: string; no?: number; batch: string }
export interface LegacyBatch { id: string; at: string; by: string; file: string; vouchers: LegacyVoucher[]; withdrawn?: { by: string; at: string; reason: string } }
export interface LegacyCheck { row: number; projectId: string; voucher: string; amount: number; paidAt: string; no?: number; errors: string[] }

type Op = { op: 'import'; batch: Omit<LegacyBatch, 'withdrawn'> } | { op: 'withdraw'; id: string; by: string; at: string; reason: string }

const KEY = 'ab-legacy-pay-ops'
const ops: Op[] = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { return [] } })()
let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ } }

export function useLegacy(): number {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => version)
}

export function legacyBatches(): LegacyBatch[] {
  const out: LegacyBatch[] = []
  for (const o of ops) {
    if (o.op === 'import') out.push({ ...o.batch })
    else { const b = out.find((x) => x.id === o.id); if (b) b.withdrawn = { by: o.by, at: o.at, reason: o.reason } }
  }
  return out
}

/** A project's imported vouchers, oldest first · withdrawn batches don't count */
export const legacyOf = (projectId: string): LegacyVoucher[] =>
  legacyBatches().filter((b) => !b.withdrawn).flatMap((b) => b.vouchers).filter((v) => v.projectId === projectId).sort((a, b) => a.paidAt.localeCompare(b.paidAt))
export const legacyTotal = (projectId: string): number => legacyOf(projectId).reduce((s, v) => s + v.amount, 0)
export const hasLegacy = (projectId: string): boolean => legacyOf(projectId).length > 0

/** Which payments of a schedule the vouchers cover · a voucher that names its payment covers it,
    the rest cover the payments in order while their total reaches each amount */
export function legacyCover(projectId: string, slots: { no: number; amount: number }[]): Map<number, LegacyVoucher> {
  const out = new Map<number, LegacyVoucher>()
  const vs = legacyOf(projectId)
  for (const v of vs) if (v.no && slots.some((s) => s.no === v.no)) out.set(v.no, v)
  let pool = vs.filter((v) => !v.no).reduce((s, v) => s + v.amount, 0)
  const free = vs.filter((v) => !v.no)
  let i = 0
  for (const s of slots) {
    if (out.has(s.no)) continue
    if (pool >= s.amount && s.amount > 0) { out.set(s.no, free[Math.min(i, free.length - 1)]!); pool -= s.amount; i++ }
    else break
  }
  return out
}

const grantOfRow = (projectId: string) => { const p = projectRows.find((x) => x.id === projectId); return p ? (p.amountGranted || p.amountRequested) : 0 }

/** Read the file's rows and check each one · nothing is saved */
export function checkTable(t: Table): { rows: LegacyCheck[]; errors: string[] } {
  const [head, ...body] = t
  if (!head) return { rows: [], errors: ['الملف فارغ'] }
  const cP = colOf(head, ['رقم المشروع', 'المشروع', 'project', 'projectid'])
  const cV = colOf(head, ['رقم السند', 'السند', 'voucher', 'رقم سند الصرف'])
  const cA = colOf(head, ['المبلغ', 'amount'])
  const cD = colOf(head, ['تاريخ الصرف', 'التاريخ', 'date'])
  const cN = colOf(head, ['رقم الدفعة', 'الدفعة', 'no', 'payment'])
  const errors = [
    cP < 0 ? 'لا عمود «رقم المشروع»' : '', cV < 0 ? 'لا عمود «رقم السند»' : '', cA < 0 ? 'لا عمود «المبلغ»' : '', cD < 0 ? 'لا عمود «تاريخ الصرف»' : '',
  ].filter(Boolean)
  if (errors.length) return { rows: [], errors }
  const known = new Set(legacyBatches().filter((b) => !b.withdrawn).flatMap((b) => b.vouchers.map((v) => v.voucher)))
  const seen = new Set<string>()
  const running = new Map<string, number>()
  const rows: LegacyCheck[] = body.map((r, i) => {
    const projectId = (r[cP] ?? '').trim()
    const voucher = (r[cV] ?? '').trim()
    const amount = amountOf(r[cA] ?? '')
    const paidAt = dateOf(r[cD] ?? '')
    const no = cN >= 0 && r[cN] ? Number(r[cN]) || undefined : undefined
    const e: string[] = []
    const p = projectRows.find((x) => x.id === projectId)
    if (!p) e.push('مشروع غير موجود')
    if (!voucher) e.push('بلا رقم سند')
    else if (known.has(voucher)) e.push('السند مستورد من قبل')
    else if (seen.has(voucher)) e.push('السند مكرر في الملف')
    if (amount <= 0) e.push('مبلغ غير صحيح')
    if (!paidAt) e.push('تاريخ غير مقروء')
    if (p) {
      const sum = (running.get(projectId) ?? legacyTotal(projectId)) + Math.max(0, amount)
      running.set(projectId, sum)
      if (sum > grantOfRow(projectId)) e.push('مجموع سندات المشروع يتجاوز منحته')
    }
    seen.add(voucher)
    return { row: i + 2, projectId, voucher, amount, paidAt, no, errors: e }
  })
  return { rows, errors: rows.length ? [] : ['لا صفوف في الملف'] }
}

export function importBatch(file: string, rows: LegacyCheck[], by: string): { id?: string; errors: string[] } {
  const ok = rows.filter((r) => !r.errors.length)
  if (!ok.length) return { errors: ['لا صف سليم للاستيراد'] }
  const id = `LG-${String(legacyBatches().length + 1).padStart(3, '0')}`
  ops.push({ op: 'import', batch: { id, at: new Date().toISOString(), by, file, vouchers: ok.map((r) => ({ projectId: r.projectId, voucher: r.voucher, amount: r.amount, paidAt: r.paidAt, no: r.no, batch: id })) } })
  save(); emit()
  return { id, errors: [] }
}

export function withdrawBatch(id: string, reason: string, by: string): string[] {
  const b = legacyBatches().find((x) => x.id === id)
  if (!b) return ['الدفعة غير موجودة']
  if (b.withdrawn) return ['سُحبت من قبل']
  if (!reason.trim()) return ['اكتب سبب السحب']
  ops.push({ op: 'withdraw', id, by, at: new Date().toISOString(), reason: reason.trim() })
  save(); emit()
  return []
}

/** Completed projects with no request here · what a first import usually covers · as a sample file */
export function legacySample(): Table {
  const done = projectRows.filter((p) => p.statusGroup === 'مكتمل' && (p.amountGranted || p.amountRequested) > 0).slice(0, 4)
  const rows = done.flatMap((p, i) => {
    const g = p.amountGranted || p.amountRequested
    const half = Math.round(g / 2 / 1000) * 1000
    return [[p.id, `OLD-${2400 + i * 2}`, String(half), '2025-03-10', '1'], [p.id, `OLD-${2401 + i * 2}`, String(g - half), '2025-07-15', '2']]
  })
  return [['رقم المشروع', 'رقم السند', 'المبلغ', 'تاريخ الصرف', 'رقم الدفعة'], ...rows]
}
