import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FieldSelect, Icon, icons, KV, Money } from '@/components/ui'
import { CfgNum } from '@/features/settings/CfgEdit'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import {
  docSources, docTitle, fiscalYears, moneyOf, sourceBalance, splitOf, yearById, type BudgetDoc, type BudgetNode,
} from '@/data/mock/budgetTree'
import { approverFor } from '@/data/approval'
import { projectRows } from '@/data/mock/projects'
import { readRole, roleByKey } from '@/data/roles'
import {
  HOLD_STAGE_SAY, linkIssues, linkOf, linkProject, planOf, sourceName, unlinkProject, usableLines, useBudget,
} from '@/data/budget/store'
import { BUDGET_RULES } from '@/data/budget/rules'

/* Link a project to the budget · one line, or a split over several budgets (client request 11 ·
   1.4.7 – 1.4.14 · 1.4.56 – 1.4.58).

   Holding happens on a leaf only, so each row's picker lists usable leaves (active, under active
   lines) of the approved budgets, each with its available amount (1.2.12 · 1.4.25 · 1.4.26). The
   rows must add up to the project's amount, and every level of each line's tree must cover what it
   is asked for (5.4.6) · the store checks the same before it holds. On a project already approved
   the same sheet changes the link: the old hold is released, the new one takes the full value and
   what was paid moves with it, with a reason kept in the history (1.4.56 – 1.4.58). */

export interface BudgetLinkProject {
  id: string
  name: string
  /** Project year id · '2026-f' */
  year: string
  /** Goal label · pre-selects the matching leaf when one exists */
  goal?: string
  amount: number
}

interface LineOpt {
  doc: BudgetDoc
  node: BudgetNode
  key: string
}

interface Row { key: string; amount: number }

/** The line's path under the root · the option itself carries the goal name only, so the
    available amount is never truncated */
const trail = (nodes: BudgetNode[], n: BudgetNode): string => {
  const parts: string[] = []
  let cur: BudgetNode | undefined = n
  while (cur?.parentId) {
    parts.push(cur.label)
    const up: string = cur.parentId
    cur = nodes.find((x) => x.id === up)
  }
  return parts.reverse().join(' · ')
}

/** Lines of the project's year first · any approved budget's lines may join a split (1.4.7) */
function linesFor(year: string): LineOpt[] {
  const name = year.slice(0, 4)
  const fy = fiscalYears.find((y) => y.name === name)
  const ofYear = fy ? usableLines(fy.id) : []
  const rest = usableLines().filter((l) => !ofYear.some((x) => x.key === l.key))
  return [...ofYear, ...rest].map(({ doc, node, key }) => ({ doc, node, key }))
}

export function BudgetLinkAction({ project, label }: { project: BudgetLinkProject; label?: string }) {
  const ver = useBudget()
  const lines = useMemo(() => { void ver; return linesFor(project.year) }, [project.year, ver])
  /* Re-audit 7 Oct · a project through Ehsan is funded from the Ehsan allocation, not its domain line */
  const viaEhsanPlatform = projectRows.find((x) => x.id === project.id)?.platform === 'منصة إحسان'
  const guess = (viaEhsanPlatform ? lines.find((l) => /منصة إحسان/.test(l.node.label))?.key : undefined)
    ?? lines.find((l) => l.node.label === project.goal)?.key ?? ''
  const held = linkOf(project.id)
  const plan = planOf(project.id)
  const me = roleByKey(readRole()).name
  const after = held?.stage === 'final'

  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const start = () => {
    setRows(held
      ? held.shares.map((x) => ({ key: `${x.docId}/${x.nodeId}`, amount: x.amount }))
      : [{ key: guess, amount: project.amount }])
    setReason('')
    setSaid([])
    setOpen(true)
  }

  const optOf = (key: string) => lines.find((l) => l.key === key)
  const input = {
    projectId: project.id, projectName: project.name, by: me,
    shares: rows.filter((r) => r.key).map((r) => {
      const [docId, nodeId] = r.key.split('/')
      return { docId, nodeId, amount: r.amount }
    }),
  }
  const total = rows.reduce((a, r) => a + (r.key ? r.amount : 0), 0)
  const issues = rows.some((r) => !r.key) ? ['اختر البند في كل سطر'] : linkIssues(input, project.amount)
  const tier = approverFor(project.amount)
  const multiDoc = new Set(lines.map((l) => l.doc.id)).size > 1
  const unpaid = !held || held.shares.every((x) => x.paid === 0)

  const put = (i: number, r: Partial<Row>) => setRows((xs) => {
    const next = xs.map((x, j) => (j === i ? { ...x, ...r } : x))
    /* One row carries the whole amount · a split asks for each part */
    return next.length === 1 ? [{ ...next[0], amount: project.amount }] : next
  })
  const addRow = () => setRows((xs) => {
    const used = xs.reduce((a, x) => a + x.amount, 0)
    return [...xs, { key: '', amount: Math.max(0, project.amount - used) }]
  })
  const dropRow = (i: number) => setRows((xs) => {
    const next = xs.filter((_, j) => j !== i)
    return next.length === 1 ? [{ ...next[0], amount: project.amount }] : next
  })

  const one = rows.length === 1 ? optOf(rows[0].key) : undefined
  const m = one ? moneyOf(one.doc.nodes, one.node.id) : undefined
  const mine = held && one ? held.shares.filter((x) => `${x.docId}/${x.nodeId}` === one.key).reduce((a, x) => a + x.amount, 0) : 0
  const left = m ? m.available + (held?.stage === 'planned' ? 0 : mine) - project.amount : 0

  const docHref = (l: LineOpt) => `${ROUTES.budgetDoc(l.doc.id)}?line=${l.node.id}#line-${l.node.id}`

  const button = label ?? (after ? 'تعديل الارتباط' : held ? 'مرتبط بالميزانية' : 'ربط بالميزانية')
  const go = after ? 'عدّل الارتباط' : held ? 'احفظ التوزيع' : BUDGET_RULES.holdAt === 'approval' ? 'اربط' : 'اربط واحجز'
  const stop = issues[0] || (after && !reason.trim() ? /* doc 1.4.58 */ 'اكتب سبب التعديل أولًا' : '') || (plan?.kind === 'multi' ? 'المشروع متعدد السنوات · يُحجز من خطته المالية' : '')

  return (
    <>
      <button
        className="btn btn-2"
        onClick={start}
        title={held ? `${HOLD_STAGE_SAY[held.stage]} على ${nf.format(held.shares.length)} ${held.shares.length > 1 ? 'بنود' : 'بند'}` : 'اربط المشروع ببند في الميزانية'}
      >
        {held && !after && <Icon name={icons.check} size="sm" />}
        {button}
      </button>

      {open && createPortal(
        <div className="bmask" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="chrome modal"
            role="dialog"
            aria-modal="true"
            aria-label={after ? 'تعديل الارتباط المالي' : 'ربط المشروع بالميزانية'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <Icon name={icons.budget} size="md" />
              <b>{after ? 'تعديل الارتباط المالي بعد الاعتماد' : 'ربط المشروع بالميزانية'}</b>
              <span className="pc-sp" />
              <span className="sub trim1">{project.name}</span>
            </div>

            <div className="mb col bglink">
              {plan?.kind === 'multi' && (
                <p className="sub cnote">
                  المشروع متعدد السنوات · يُحجز من خطته المالية سنةً بسنة، وحصص السنوات القادمة التزامات مستقبلية لا حجوزات.
                  {' '}<Link className="lnk" to={ROUTES.projectTab(project.id, 'study')}>افتح الخطة المالية</Link>
                </p>
              )}
              {lines.length === 0 && (
                <p className="bad cnote">لا ميزانية معتمدة فيها بند نشط · الربط والحجز على الميزانيات المعتمدة المفعّلة وحدها.</p>
              )}
              {after && (
                <p className="sub cnote">
                  يُلغى الحجز الحالي ويُطبَّق الارتباط الجديد على كامل قيمة المشروع
                  {held && held.shares.some((x) => x.paid) ? ` · وينتقل المصروف (${nf.format(held.shares.reduce((a, x) => a + x.paid, 0))}) والمتبقي والدفعات القادمة معه` : ''}.
                </p>
              )}

              <div className="regf">
                <span className="lb">{rows.length > 1 ? 'توزيع التمويل على الميزانيات' : 'بند الميزانية'}<b className="regf-r" aria-label="إلزامي">*</b></span>
                <ul className="bgsrc">
                  {rows.map((r, i) => (
                    <li key={i}>
                      <FieldSelect
                        value={r.key}
                        label={i === 0 ? 'بند الميزانية' : `بند الميزانية ${i + 1}`}
                        placeholder="اختر البند الفرعي"
                        searchAt={6}
                        options={lines
                          .filter((l) => l.key === r.key || !rows.some((x) => x.key === l.key))
                          .map((l) => {
                            const a = moneyOf(l.doc.nodes, l.node.id).available
                            const where = multiDoc ? `${yearById(l.doc.yearId)?.name ?? ''} · ` : ''
                            return { value: l.key, label: isolate(`${where}${l.node.label} · متاح ${nf.format(a)}`) }
                          })}
                        onChange={(v) => put(i, { key: v })}
                      />
                      {rows.length > 1
                        ? <CfgNum value={r.amount} label={`مبلغ البند ${i + 1}`} onChange={(n) => put(i, { amount: n })} />
                        : <span className="sub"><Money sm>{project.amount}</Money></span>}
                      {rows.length > 1 ? (
                        <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف السطر ${i + 1}`} onClick={() => dropRow(i)}>
                          <Icon name={icons.close} size="sm" />
                        </button>
                      ) : <span />}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-2 btn-sm bglink-go" onClick={addRow} disabled={rows.length >= lines.length}>
                  <Icon name={icons.plus} size="sm" />أضف ميزانية أخرى
                </button>
                <span className="sub regf-h">
                  الحجز على البنود الفرعية وحدها · ويُحجز كل جزء على بنده مستقلًّا ويُصرف ويُبلَّغ عنه وحده
                </span>
              </div>

              {one && m ? (
                <>
                  <KV
                    rows={[
                      { k: 'الميزانية', v: docTitle(one.doc) },
                      { k: 'البند', v: trail(one.doc.nodes, one.node) },
                      { k: 'المبلغ المخصص', v: <Money sm>{m.allocated}</Money> },
                      { k: 'المبلغ المحتجز', v: <Money sm>{m.held}</Money> },
                      { k: 'الملتزم به', v: <Money sm>{m.committed}</Money> },
                      { k: 'المبلغ المدفوع', v: <Money sm>{m.paid}</Money> },
                      { k: 'المبلغ المتاح', v: <b><Money sm>{m.available}</Money></b> },
                      /* Re-audit 7 Oct · 5.2.5 · the line's sources and what each still has on the line ·
                         batch 5 · and each source's own balance in the budget, which the link checks too */
                      ...(docSources(one.doc).length > 1 && splitOf(one.doc, one.node.id)?.length ? [{
                        k: 'مصادر التمويل',
                        v: isolate(splitOf(one.doc, one.node.id)!.map((x) => `${sourceName(x.code)} ${nf.format(x.amount)} · متاح في البند ${nf.format(m.allocated ? Math.max(0, Math.round(m.available * x.amount / m.allocated)) : 0)} · رصيد المصدر في الميزانية ${nf.format(Math.max(0, sourceBalance(one.doc, x.code)))}`).join(' · ')),
                      }] : docSources(one.doc).length === 1 ? [{ k: 'مصدر التمويل', v: sourceName(docSources(one.doc)[0]!.code) }] : []),
                      { k: 'مبلغ المشروع', v: <Money sm>{project.amount}</Money> },
                      { k: 'يعتمده', v: tier.role },
                      {
                        k: 'المتاح بعد الربط',
                        v: left < 0
                          ? <b>يتجاوز المتاح بـ <Money sm>{Math.abs(left)}</Money></b>
                          : <b><Money sm>{left}</Money></b>,
                      },
                    ]}
                  />
                  {/* Going back to the document · opens the tree on this line. */}
                  <Link className="btn btn-2 btn-sm bglink-go" to={docHref(one)}>
                    عرض وثيقة الميزانية
                    <Icon name={icons.chevron} size="sm" />
                  </Link>
                </>
              ) : rows.length > 1 && (
                <KV
                  rows={[
                    ...rows.filter((r) => r.key).map((r) => {
                      const o = optOf(r.key)!
                      const a = moneyOf(o.doc.nodes, o.node.id).available
                      return { k: `${docTitle(o.doc)} · ${o.node.label}`, v: <span><Money sm>{r.amount}</Money><span className="sub"> من متاح {nf.format(a)}</span></span> }
                    }),
                    { k: 'مجموع التوزيع', v: <b><Money sm>{total}</Money></b> },
                    { k: 'مبلغ المشروع', v: <Money sm>{project.amount}</Money> },
                    { k: 'الفرق', v: <b><Money sm>{project.amount - total}</Money></b> },
                  ]}
                />
              )}

              {after && (
                <label className="regf">
                  <span className="lb">سبب التعديل<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب تعديل الارتباط" placeholder="مثال: نقل التمويل إلى بند الهدف الصحيح" /></span>
                </label>
              )}

              {(said.length > 0 || (issues.length > 0 && rows.every((r) => r.key))) && (
                <ul className="apv-sig" aria-live="polite">
                  {(said.length ? said : issues).map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}
                </ul>
              )}
            </div>

            <div className="mf">
              <button
                className="btn btn-p"
                disabled={Boolean(stop)}
                title={stop || go}
                onClick={() => {
                  const out = linkProject(input, after ? reason : undefined)
                  if (out.length) { setSaid(out); return }
                  setOpen(false)
                }}
              >
                {go}
              </button>
              {held && !after && unpaid && (
                <button className="btn btn-2" onClick={() => { unlinkProject(project.id, me, 'فكّ الربط يدويًّا'); setOpen(false) }}>فكّ الربط</button>
              )}
              <button className="btn btn-2" onClick={() => setOpen(false)}>إلغاء</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
