import type { ProjectRow } from '@/types/domain'
import { allBudgets } from '@/data/mock/chain'
import { moneyOf, type LineMoney } from '@/data/mock/budgetTree'
import { projectRows } from '@/data/mock/projects'
import { entityById } from '@/data/mock/entities'

/* What the supervisor studies against (3.2.11 · 3.2.12).

   Three readings the study needs beside the request itself, all computed from records the system
   already has — none is a model's guess presented as data:
     the domain's budget       the 2026 line of the project's domain and goal: allocated, held,
                               paid, available, and what this request would leave
     similar projects          the same goal (or domain) elsewhere, with what they asked and
                               what became of them
     fit and strengths          a short list of signals: goal in the domain's tree, cost per
                               beneficiary against the domain's median, the entity's record */

export interface DomainBudget { label: string; money: LineMoney; goal?: { label: string; money: LineMoney } }

export const domainBudget = (p: Pick<ProjectRow, 'track' | 'field' | 'goal' | 'year'>): DomainBudget | null => {
  const year = p.year.slice(0, 4)
  /* The approved budget of the project's year · a budget still on its approval path isn't money yet */
  const doc = allBudgets.find((d) => d.state === 'approved' && d.id.includes(year) && d.nodes.some((n) => n.label === p.field)) ??
    allBudgets.find((d) => d.state === 'approved' && d.id.includes(year)) ??
    allBudgets.find((d) => d.state === 'approved')
  if (!doc) return null
  const parentOf = (id: string | null) => doc.nodes.find((n) => n.id === id)
  const field = doc.nodes.find((n) => n.label === p.field && parentOf(n.parentId)?.label === p.track) ??
    doc.nodes.find((n) => n.label === p.field)
  if (!field) return null
  const goal = doc.nodes.find((n) => n.parentId === field.id && n.label === p.goal)
  return {
    label: field.label,
    money: moneyOf(doc.nodes, field.id),
    goal: goal ? { label: goal.label, money: moneyOf(doc.nodes, goal.id) } : undefined,
  }
}

export const similarProjects = (p: ProjectRow, n = 3): ProjectRow[] => {
  const others = projectRows.filter((x) => x.id !== p.id && x.type !== 'محفظة')
  const same = others.filter((x) => x.goal === p.goal)
  const near = others.filter((x) => x.goal !== p.goal && x.field === p.field)
  const rank = (x: ProjectRow) => (x.statusGroup === 'مكتمل' ? 0 : x.statusGroup === 'في التشغيل' ? 1 : 2)
  return [...same.sort((a, b) => rank(a) - rank(b)), ...near.sort((a, b) => rank(a) - rank(b))].slice(0, n)
}

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

export interface Signal { tone: 'ok' | 'warn'; text: string }

/** Fit indicator 0–100 and the signals behind it · each signal is a rule, stated */
export const fitOf = (p: ProjectRow): { score: number; signals: Signal[] } => {
  const signals: Signal[] = []
  let score = 50
  const b = domainBudget(p)
  if (b?.goal) { score += 20; signals.push({ tone: 'ok', text: `الهدف «${p.goal}» بند قائم في ميزانية المجال` }) }
  else { score -= 10; signals.push({ tone: 'warn', text: `الهدف «${p.goal}» ليس بندًا في ميزانية المجال لهذا العام` }) }

  const per = p.beneficiaries > 0 ? p.amountRequested / p.beneficiaries : 0
  const peers = projectRows.filter((x) => x.field === p.field && x.beneficiaries > 0 && x.id !== p.id)
    .map((x) => x.amountRequested / x.beneficiaries)
  const med = median(peers)
  if (per && med) {
    if (per <= med * 1.2) { score += 15; signals.push({ tone: 'ok', text: `تكلفة المستفيد ${Math.round(per).toLocaleString('en-US')} ⃁ ضمن وسيط المجال (${Math.round(med).toLocaleString('en-US')})` }) }
    else { score -= 10; signals.push({ tone: 'warn', text: `تكلفة المستفيد ${Math.round(per).toLocaleString('en-US')} ⃁ أعلى من وسيط المجال (${Math.round(med).toLocaleString('en-US')})` }) }
  }

  const e = entityById(p.entityId)
  if (e) {
    if (e.projectsCompleted > 0) { score += 10; signals.push({ tone: 'ok', text: `للجهة ${e.projectsCompleted} مشاريع مكتملة معنا` }) }
    if (e.projectsStalled > 0) { score -= 10; signals.push({ tone: 'warn', text: `للجهة ${e.projectsStalled} مشروع متعثر` }) }
    if (e.governance === 'غير مقيم' || e.governance === 'غير مقيَّم') signals.push({ tone: 'warn', text: 'حوكمة الجهة غير مقيَّمة' })
  }
  if (b && p.amountRequested > b.money.available) { score -= 15; signals.push({ tone: 'warn', text: 'المبلغ المطلوب يتجاوز المتاح في المجال' }) }
  return { score: Math.max(0, Math.min(100, score)), signals }
}
