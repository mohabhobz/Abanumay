import { useSyncExternalStore } from 'react'
import { stampNow } from '@/data/clock'
import { done } from '@/data/feedback'

/* Client 27 Oct · «الأنشطة المتعلقة بالدفعة» · the plan activities a payment request rests on. The
   supervisor or the entity picks any number of the project plan's activities, whatever their state,
   and each pick is kept as an operation so the payment's log reads who linked or unlinked what.
   An activity belongs to one payment at a time · another payment of the project can't take it.

   On the server a save is a `PUT /api/payments/<id>/activities` with the full set. */

type Op = { pay: string; acts: string[]; added: string[]; dropped: string[]; by: string; at: string }

const KEY = 'ab-pay-acts'
const read = (): Op[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Op[] } catch { return [] } }
const ops: Op[] = read()
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(ops)) } catch { /* storage blocked */ } }

let version = 0
const subs = new Set<() => void>()
const emit = () => { version++; subs.forEach((f) => f()) }
export const usePayActs = (): number => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => version)

/** The activities linked to a payment now */
export const actsOfPay = (pay: string): string[] => ops.filter((o) => o.pay === pay).at(-1)?.acts ?? []

/** The payment an activity is linked to, among the given ones · undefined when free */
export const payOfAct = (act: string, pays: string[]): string | undefined => pays.find((p) => actsOfPay(p).includes(act))

/** Every save on a payment, oldest first · for its log */
export const payActOps = (pay: string): Op[] => ops.filter((o) => o.pay === pay && (o.added.length || o.dropped.length))

export function setPayActs(pay: string, acts: string[], by: string): void {
  const before = new Set(actsOfPay(pay))
  const next = [...new Set(acts)]
  const added = next.filter((a) => !before.has(a))
  const dropped = [...before].filter((a) => !next.includes(a))
  if (!added.length && !dropped.length) return
  ops.push({ pay, acts: next, added, dropped, by, at: stampNow() })
  write(); emit()
  done(!next.length ? 'أُلغي ربط الأنشطة بالدفعة' : next.length === 1 ? 'رُبط نشاط واحد بالدفعة' : `رُبطت ${next.length} أنشطة بالدفعة`)
}
