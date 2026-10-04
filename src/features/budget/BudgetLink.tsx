import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FieldSelect, Icon, icons, KV, Money } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import {
  docTitle, fiscalYears, moneyOf, yearById, type BudgetDoc, type BudgetNode,
} from '@/data/mock/budgetTree'
import { approverFor } from '@/data/approval'
import { readRole, roleByKey } from '@/data/roles'
import { linkOf, linkProject, planOf, unlinkProject, usableLines, useBudget } from '@/data/budget/store'

/* Link a project to a budget line · the grants manager's step on a project (client request 11).

   Holding happens on a leaf only, so the picker lists usable leaves (active, under active lines) of
   the approved budgets for the project's year, each with its available amount (1.2.12 · 1.4.25 ·
   1.4.26). A budget still on its approval path offers nothing. Confirming holds the amount on the
   line through the budget store, so the line, its ledger and every report move with it; a
   multi-year project holds through its funding plan instead, a year at a time. The link back to the budget document opens the
   tree on that exact row (`?line=` + `#line-<id>`), so the manager can check the line in context
   before confirming. */

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

function linesFor(year: string): LineOpt[] {
  const name = year.slice(0, 4)
  const fy = fiscalYears.find((y) => y.name === name)
  const ofYear = fy ? usableLines(fy.id) : []
  const lines = ofYear.length ? ofYear : usableLines()
  return lines.map(({ doc, node, key }) => ({ doc, node, key }))
}

export function BudgetLinkAction({ project }: { project: BudgetLinkProject }) {
  const ver = useBudget()
  const lines = useMemo(() => { void ver; return linesFor(project.year) }, [project.year, ver])
  const guess = lines.find((l) => l.node.label === project.goal)?.key ?? ''
  const held = linkOf(project.id)
  const linked = held ? `${held.docId}/${held.nodeId}` : ''
  const plan = planOf(project.id)
  const me = roleByKey(readRole()).name

  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(guess)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const cur = lines.find((l) => l.key === pick)
  const m = cur ? moneyOf(cur.doc.nodes, cur.node.id) : undefined
  /* Re-linking to the same line frees the current hold first, so it counts as available */
  const mine = held && cur && linked === cur.key ? held.amount : 0
  const after = m ? m.available + mine - project.amount : 0
  const done = held ? { node: { label: held.nodeId } } : undefined
  const tier = approverFor(project.amount)

  const docHref = (l: LineOpt) =>
    `${ROUTES.budgetDoc(l.doc.id)}?line=${l.node.id}#line-${l.node.id}`

  const multiDoc = new Set(lines.map((l) => l.doc.id)).size > 1

  return (
    <>
      <button
        className="btn btn-2"
        onClick={() => { setPick(linked || guess); setOpen(true) }}
        title={done ? 'مرتبط ببند في الميزانية' : 'اربط المشروع ببند في الميزانية'}
      >
        {done && <Icon name={icons.check} size="sm" />}
        {done ? 'مرتبط بالميزانية' : 'ربط بالميزانية'}
      </button>

      {open && createPortal(
        <div className="bmask" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="chrome modal"
            role="dialog"
            aria-modal="true"
            aria-label="ربط المشروع بالميزانية"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <Icon name={icons.budget} size="md" />
              <b>ربط المشروع بالميزانية</b>
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
                <p className="bad cnote">لا ميزانية معتمدة للسنة فيها بند نشط · الربط والحجز على الميزانيات المعتمدة المفعّلة وحدها.</p>
              )}
              <label className="regf">
                <span className="lb">بند الميزانية<b className="regf-r" aria-label="إلزامي">*</b></span>
                <FieldSelect
                  value={pick}
                  label="بند الميزانية"
                  placeholder="اختر البند الفرعي"
                  searchAt={6}
                  options={lines.map((l) => {
                    const a = moneyOf(l.doc.nodes, l.node.id).available
                    const where = multiDoc ? `${yearById(l.doc.yearId)?.name ?? ''} · ` : ''
                    return {
                      value: l.key,
                      label: isolate(`${where}${l.node.label} · متاح ${nf.format(a)}`),
                    }
                  })}
                  onChange={setPick}
                />
                <span className="sub regf-h">
                  الحجز على البنود الفرعية وحدها · ويُحجز مبلغ المشروع من المتاح عند الربط
                </span>
              </label>

              {cur && m && (
                <>
                  <KV
                    rows={[
                      { k: 'الميزانية', v: docTitle(cur.doc) },
                      { k: 'البند', v: trail(cur.doc.nodes, cur.node) },
                      { k: 'المبلغ المخصص', v: <Money sm>{m.allocated}</Money> },
                      { k: 'المبلغ المحتجز', v: <Money sm>{m.held}</Money> },
                      { k: 'الملتزم به', v: <Money sm>{m.committed}</Money> },
                      { k: 'المبلغ المدفوع', v: <Money sm>{m.paid}</Money> },
                      { k: 'المبلغ المتاح', v: <b><Money sm>{m.available}</Money></b> },
                      { k: 'مبلغ المشروع', v: <Money sm>{project.amount}</Money> },
                      { k: 'يعتمده', v: tier.role },
                      {
                        k: 'المتاح بعد الربط',
                        v: after < 0
                          ? <b>يتجاوز المتاح بـ <Money sm>{Math.abs(after)}</Money></b>
                          : <b><Money sm>{after}</Money></b>,
                      },
                    ]}
                  />
                  {/* Going back to the document · opens the tree on this line. */}
                  <Link className="btn btn-2 btn-sm bglink-go" to={docHref(cur)}>
                    عرض وثيقة الميزانية
                    <Icon name={icons.chevron} size="sm" />
                  </Link>
                </>
              )}
            </div>

            <div className="mf">
              <button
                className="btn btn-p"
                disabled={!cur || after < 0 || plan?.kind === 'multi'}
                title={!cur ? 'اختر البند أولًا' : after < 0 ? 'مبلغ المشروع يتجاوز المتاح في البند' : 'اربط المشروع بالبند'}
                onClick={() => {
                  if (!cur) return
                  linkProject({ projectId: project.id, projectName: project.name, docId: cur.doc.id, nodeId: cur.node.id, amount: project.amount, by: me })
                  setOpen(false)
                }}
              >
                {held ? 'غيّر البند' : 'اربط واحجز'}
              </button>
              {held && (
                <button className="btn btn-2" onClick={() => { unlinkProject(project.id, me); setOpen(false) }}>فكّ الربط</button>
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
