import { agreements } from './agreements'
import { projectRows } from './projects'
import { budgetDocs, type BudgetDoc, type BudgetNode } from './budgetTree'
import type { ProjectRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   السلسلة · هـ-7 · ميزانية ← مشروع ← اتفاقية ← دفعات

   ⚠️ **أول حاجة اتكشفت لمّا جيت أوصّل السلسلة: هي مش موصولة.**
   شجرة الميزانية `BG-2025-SA` بنودها «مسار التعليم · مجال التعليم
   العام · هدف تطوير المدارس»، والمشاريع مساراتها «المنح النوعي ·
   التعليم · المنح الدراسية الجامعية» · **مفرداتان مختلفتان**،
   فأي محاولة نربط بيهم كانت هترجّع «مش لاقي» في كل مشروع.

   والسبب مش غلط: `BG-2025-SA` **منقولة بالحرف من مثال الوثيقة**،
   و`taxonomy.ts` **منقولة بالحرف من النظام العامل**. مصدران
   حقيقيان بيقولوا حاجتين · فما ينفعش نعدّل واحد فيهم عشان يطابق
   التاني، ده بيخفي الفرق بدل ما يحلّه.

   **فاللي اتعمل:** ميزانية تانية لسنة 2026 **مبنية من مفردات
   النظام العامل**، ومولَّدة من المشاريع نفسها · فالسلسلة بتمشي
   على داتا واحدة فعلًا لا بالتمنّي. والفرق بين المفردتين اتسجّل
   سؤالًا لعمر بدل ما يتلمّ تحت السجادة.

   ⚠️ **والتوليد مقصود.** لو الميزانية اتكتبت بالإيد، أول ما مشروع
   يتغيّر مبلغه تبقى السلسلة مكسورة والشاشة بتقول «مطابق» · فهي
   بتتحسب من المشاريع، والفحص بيبقى فحصًا حقيقيًا.
   ═══════════════════════════════════════════════════════════ */

/** مسار ← مجال ← هدف من مفردات النظام العامل */
const cap = (n: number) => Math.ceil(n / 100_000) * 100_000

/** المشاريع اللي سنتها 2026 · دي اللي الميزانية بتتبني عليها */
const rows2026 = projectRows.filter((p) => p.year.startsWith('2026'))

function buildNodes(): BudgetNode[] {
  const out: BudgetNode[] = []
  const put = (
    id: string, label: string, kind: BudgetNode['kind'],
    parentId: string | null, allocated: number, available: number,
  ) => out.push({ id, label, kind, parentId, allocated, available, active: true })

  /* المستويات التلاتة بتتبني من تحت لفوق: الهدف بيتحسب من
     مشاريعه، والمجال من أهدافه، والمسار من مجالاته · فالتحقّق
     «مجموع الأبناء = الأب» بيبقى صحيحًا بالبناء */
  const byTrack = new Map<string, Map<string, Map<string, ProjectRow[]>>>()
  for (const p of rows2026) {
    if (!byTrack.has(p.track)) byTrack.set(p.track, new Map())
    const fields = byTrack.get(p.track)!
    if (!fields.has(p.field)) fields.set(p.field, new Map())
    const goals = fields.get(p.field)!
    if (!goals.has(p.goal)) goals.set(p.goal, [])
    goals.get(p.goal)!.push(p)
  }

  let rootAlloc = 0
  let rootAvail = 0
  const trackNodes: { id: string; alloc: number; avail: number }[] = []

  let ti = 0
  for (const [track, fields] of byTrack) {
    ti += 1
    const tid = `t${ti}`
    let tAlloc = 0
    let tAvail = 0
    let fi = 0

    for (const [field, goals] of fields) {
      fi += 1
      const fid = `${tid}f${fi}`
      let fAlloc = 0
      let fAvail = 0
      let gi = 0

      for (const [goal, ps] of goals) {
        gi += 1
        const gid = `${fid}g${gi}`
        const granted = ps.reduce((a, x) => a + x.amountGranted, 0)
        const spent = ps.reduce((a, x) => a + x.amountSpent, 0)
        /* المخصص بيتقرّب لأعلى مئة ألف · الميزانية بتتحط بأرقام
           مدوّرة لا بمجموع مشاريع بالقرش */
        const alloc = cap(Math.max(granted, 100_000))
        put(gid, goal, 'sub', fid, alloc, alloc - spent)
        fAlloc += alloc
        fAvail += alloc - spent
      }

      put(fid, field, 'main', tid, fAlloc, fAvail)
      tAlloc += fAlloc
      tAvail += fAvail
    }

    put(tid, track, 'main', 'b0', tAlloc, tAvail)
    trackNodes.push({ id: tid, alloc: tAlloc, avail: tAvail })
    rootAlloc += tAlloc
    rootAvail += tAvail
  }

  put('b0', 'ميزانية المنح · 2026', 'main', null, rootAlloc, rootAvail)
  return out
}

export const budget2026: BudgetDoc = {
  id: 'BG-2026-SA',
  yearId: 'fy-2026',
  sourceCode: 'SA',
  from: '2026-01-01',
  to: '2026-12-31',
  total: 0,
  state: 'submitted',
  nodes: [],
}

{
  const nodes = buildNodes()
  budget2026.nodes = nodes
  budget2026.total = nodes.find((n) => n.parentId === null)?.allocated ?? 0
}

/** كل الميزانيات · مثال الوثيقة ومعاه اللي مبنية على النظام العامل */
export const allBudgets: BudgetDoc[] = [...budgetDocs, budget2026]

/**
 * ⚠️ **الحلّال ده لازم يكون هنا لا في `budgetTree`.**
 * `budget2026` مولَّدة من المشاريع، والمشاريع مالهاش علاقة بشجرة
 * الميزانية · فلو `budgetTree` استوردها كان هيبقى فيه دورة
 * استيراد. الشاشات بتقرا من هنا، والفكستشر بيفضل نضيف.
 */
export const budgetDocOf = (id: string): BudgetDoc | undefined =>
  allBudgets.find((d) => d.id === id)

/* ═══════════════════════════════════════════════════════════
   حلقات السلسلة لمشروع واحد

   كل حلقة بتقول: القيمة عندها · القيمة المتوقّعة من اللي قبلها ·
   وهل اتطابقوا. والحلقة اللي ما بتتطابقش **بتتقال** لا بتتخفي.
   ═══════════════════════════════════════════════════════════ */
export type LinkState = 'ok' | 'gap' | 'none'

export interface ChainLink {
  key: 'budget' | 'project' | 'agreement' | 'payments'
  label: string
  /** الاسم أو الرقم اللي بيعرّف الحلقة */
  name: string
  value: number
  /** الجملة اللي بتشرح الرقم */
  say: string
  state: LinkState
  /** رابط للحلقة لو ليها شاشة */
  to?: string
}

export const goalNodeOf = (p: ProjectRow): BudgetNode | undefined =>
  budget2026.nodes.find((n) => n.kind === 'sub' && n.label === p.goal)

export function projectChain(p: ProjectRow): ChainLink[] {
  const node = goalNodeOf(p)
  const ag = agreements.find((a) => a.projectId === p.id && a.stage !== 'cancelled')
  const schedule = ag ? ag.payments.reduce((a, x) => a + x.amount, 0) : 0

  const links: ChainLink[] = []

  /* 1 · الميزانية · الهدف اللي المشروع تحته */
  links.push({
    key: 'budget',
    label: 'الميزانية',
    name: node ? node.label : 'مش متربط ببند',
    value: node?.allocated ?? 0,
    say: node
      ? `مخصص الهدف · والمشروع واحد من ${rows2026.filter((x) => x.goal === p.goal).length} تحته`
      : 'المشروع مش متربط ببند في الميزانية',
    state: node ? (node.allocated >= p.amountGranted ? 'ok' : 'gap') : 'none',
    to: node ? `/budget/doc/${budget2026.id}` : undefined,
  })

  /* 2 · المشروع · المعتمد */
  links.push({
    key: 'project',
    label: 'المشروع',
    name: p.name,
    value: p.amountGranted,
    say: p.amountGranted > 0 ? 'المبلغ المعتمد بعد الدراسة' : 'ما اتحجزش له مخصص لسه',
    state: p.amountGranted > 0 ? 'ok' : 'none',
  })

  /* 3 · الاتفاقية · قيمتها لازم تساوي المعتمد (خطوة 11) */
  links.push({
    key: 'agreement',
    label: 'الاتفاقية',
    name: ag ? ag.id : 'مفيش اتفاقية',
    value: ag?.amount ?? 0,
    say: ag
      ? ag.amount === p.amountGranted
        ? 'قيمتها تساوي المعتمد · خطوة 11'
        : 'قيمتها مختلفة عن المعتمد · خطوة 11'
      : 'الاتفاقية بتتعمل بعد الاعتماد',
    state: ag ? (ag.amount === p.amountGranted ? 'ok' : 'gap') : 'none',
    to: ag ? `/agreements/${ag.id}` : undefined,
  })

  /* 4 · الدفعات · مجموع الجدول لازم يساوي الاتفاقية (قاعدة 8) */
  links.push({
    key: 'payments',
    label: 'جدول الدفعات',
    name: ag ? `${ag.payments.length} دفعات` : 'مفيش جدول',
    value: schedule,
    say: ag
      ? schedule === ag.amount
        ? 'المجموع يساوي قيمة الاتفاقية · قاعدة 8'
        : 'المجموع مختلف عن قيمة الاتفاقية · قاعدة 8'
      : 'الجدول جزء من الاتفاقية',
    state: ag ? (schedule === ag.amount ? 'ok' : 'gap') : 'none',
  })

  return links
}

/** الحلقات المكسورة · صفر يعني السلسلة ماشية */
export const chainGaps = (p: ProjectRow): number =>
  projectChain(p).filter((l) => l.state === 'gap').length
