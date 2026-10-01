import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FieldSelect, Icon, icons, KV, Money } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, nf } from '@/lib/format'
import { allBudgets } from '@/data/mock/chain'
import {
  docTitle, hasChildren, moneyOf, yearById, type BudgetDoc, type BudgetNode,
} from '@/data/mock/budgetTree'

/* Link a project to a budget line · the grants manager's step on a project (client request 11).

   Holding happens on a leaf only, so the picker lists active leaves of the budgets for the
   project's year, each with its available amount. The link back to the budget document opens the
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
  const sent = allBudgets.filter((d) => d.state === 'submitted')
  const ofYear = sent.filter((d) => yearById(d.yearId)?.name === name)
  const docs = ofYear.length ? ofYear : sent
  return docs.flatMap((doc) =>
    doc.nodes
      .filter((n) => n.active && n.parentId !== null && !hasChildren(doc.nodes, n.id))
      .map((node) => ({ doc, node, key: `${doc.id}/${node.id}` })),
  )
}

export function BudgetLinkAction({ project }: { project: BudgetLinkProject }) {
  const lines = useMemo(() => linesFor(project.year), [project.year])
  const guess = lines.find((l) => l.node.label === project.goal)?.key ?? ''

  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState(guess)
  const [linked, setLinked] = useState<string>('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const cur = lines.find((l) => l.key === pick)
  const m = cur ? moneyOf(cur.doc.nodes, cur.node.id) : undefined
  const after = m ? m.available - project.amount : 0
  const done = lines.find((l) => l.key === linked)

  const docHref = (l: LineOpt) =>
    `${ROUTES.budgetDoc(l.doc.id)}?line=${l.node.id}#line-${l.node.id}`

  const multiDoc = new Set(lines.map((l) => l.doc.id)).size > 1

  return (
    <>
      <button
        className="btn btn-2"
        onClick={() => { setPick(linked || guess); setOpen(true) }}
        title={done ? `مرتبط بـ ${done.node.label}` : 'اربط المشروع ببند في الميزانية'}
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
                      { k: 'المبلغ المدفوع', v: <Money sm>{m.paid}</Money> },
                      { k: 'المبلغ المتاح', v: <b><Money sm>{m.available}</Money></b> },
                      { k: 'مبلغ المشروع', v: <Money sm>{project.amount}</Money> },
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
                disabled={!cur || after < 0}
                title={!cur ? 'اختر البند أولًا' : after < 0 ? 'مبلغ المشروع يتجاوز المتاح في البند' : 'اربط المشروع بالبند'}
                onClick={() => { setLinked(pick); setOpen(false) }}
              >
                اربط بالبند
              </button>
              <button className="btn btn-2" onClick={() => setOpen(false)}>إلغاء</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
