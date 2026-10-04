import { DateText, Glass, Head, Icon, Money, Num, Person, Tag, icons } from '@/components/ui'
import { docTitle } from '@/data/mock/budgetTree'
import type { ProjectRow } from '@/types/domain'
import { holderOf } from '@/data/holders'
import { readRole } from '@/data/roles'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { BUDGET_RULES } from '@/data/budget/rules'
import {
  HOLD_STAGE_SAY, LINK_CHANGE_SAY, docOf, fundingIssues, fundingReport, linkHistory, linkOf, useBudget,
  type HoldStage, type LinkShare,
} from '@/data/budget/store'
import { BudgetLinkAction } from '@/features/budget/BudgetLink'
import { nf } from '@/lib/format'

/* «الارتباط المالي» · one project's funding, read by every seat (1.4.42 · 5.2.5 · 6.2.10 · 7.2.2).

   Each budget share on its own row: what it funds, what it still holds, what was paid from it and
   what is left · then the standing check before a decision, and the link's history (1.4.58) — kept
   after a release, so a rejected or re-studied project still shows where its money went.

   The seat that holds the decision may link or redistribute; after approval only the roles the
   budget settings name may change the link (1.4.56). */

const TONE: Record<HoldStage, 'ok' | 'warn' | 'mute'> = { planned: 'mute', initial: 'warn', final: 'ok', closed: 'mute' }

const shareSay = (xs: LinkShare[] | undefined, title: (x: LinkShare) => string) =>
  (xs ?? []).map((x) => `${title(x)} ${nf.format(x.amount)}`).join(' · ')

export function FundingCard({ row }: { row: ProjectRow }) {
  useBudget()
  const role = readRole()
  const l = linkOf(row.id)
  const rep = fundingReport(row.id)
  const log = linkHistory(row.id)
  const holder = holderOf(row)
  const studying = row.stage === 'دراسة المشروع'
  const seat = studying && (
    (holder === 'manager' && role === 'grants-manager') || (holder === 'exec' && role === 'ceo') ||
    (holder === 'committee' && APPROVAL_RULES.committeeBy.includes(role)) || (holder === 'board' && APPROVAL_RULES.boardBy.includes(role)))
  const canEdit = l?.stage === 'closed' ? false : l?.stage === 'final' ? BUDGET_RULES.relinkBy.includes(role) : Boolean(seat)
  const issues = studying && holder && holder !== 'supervisor' ? fundingIssues(row.id, row.amountRequested) : []
  /* Labels between the root and the leaf · the root is the budget itself, named once */
  const above = (x: LinkShare): string[] => {
    const nodes = docOf(x.docId)?.nodes ?? []
    const out: string[] = []
    let cur = nodes.find((n) => n.id === x.nodeId)
    while (cur?.parentId) {
      const up: string = cur.parentId
      cur = nodes.find((n) => n.id === up)
      if (cur?.parentId) out.unshift(cur.label)
    }
    return out
  }
  const title = (x: LinkShare) => docOf(x.docId)?.nodes.find((n) => n.id === x.nodeId)?.label ?? x.nodeId

  return (
    <Glass>
      <Head
        title="الارتباط المالي"
        meta={(
          <span className="rowf gp-2">
            {l ? <Tag tone={TONE[l.stage]}>{HOLD_STAGE_SAY[l.stage]}</Tag> : <span className="sub">غير مرتبط</span>}
            {canEdit && (
              <BudgetLinkAction
                project={{ id: row.id, name: row.name, year: row.year, goal: row.goal, amount: row.amountRequested }}
                label={l?.stage === 'final' ? 'تعديل الارتباط' : l ? 'عدّل التوزيع' : 'ربط بالميزانية'}
              />
            )}
          </span>
        )}
      />

      {!rep ? (
        <p className="sub cnote">
          {BUDGET_RULES.holdAt === 'approval'
            ? 'يُربط المشروع ببند أو أكثر عند التوصية · ويُحجز المبلغ عند الاعتماد النهائي وفق السياسة المالية.'
            : 'يُربط المشروع ببند أو أكثر ويُحجز المبلغ مبدئيًّا عند توصية مدير المنح · ويثبت نهائيًّا عند الاعتماد.'}
        </p>
      ) : (
        <div className="fnd-scroll">
          <table className="tbl" aria-label="توزيع تمويل المشروع على الميزانيات">
            <colgroup><col className="fnd-c1" /><col /><col /><col /><col /></colgroup>
            <thead>
              <tr>
                <th>البند والميزانية</th>
                <th className="n">المبلغ</th><th className="n">المحجوز</th><th className="n">المصروف</th>
                <th className="n">{rep.link.stage === 'closed' ? 'أُعيد للبند' : 'المتبقي'}</th>
              </tr>
            </thead>
            <tbody>
              {rep.rows.map((r) => (
                <tr key={`${r.share.docId}/${r.share.nodeId}`}>
                  <td>
                    {/* The leaf, then its budget and the levels above it under the root */}
                    <span className="apv-t">
                      <b>{r.node?.label ?? r.share.nodeId}</b>
                      <span className="sub">{[r.doc ? docTitle(r.doc) : r.share.docId, ...above(r.share)].join(' · ')}</span>
                    </span>
                  </td>
                  <td className="n"><Money sm>{r.share.amount}</Money></td>
                  <td className="n"><Money sm>{r.held}</Money></td>
                  <td className="n"><Money sm>{r.paid}</Money></td>
                  <td className="n"><Money sm>{rep.link.stage === 'closed' ? r.released : r.remaining}</Money></td>
                </tr>
              ))}
            </tbody>
            {rep.rows.length > 1 && (
              <tfoot>
                <tr>
                  <td><b>الإجمالي</b></td>
                  <td className="n"><b><Money sm>{rep.totals.amount}</Money></b></td>
                  <td className="n"><Money sm>{rep.totals.held}</Money></td>
                  <td className="n"><Money sm>{rep.totals.paid}</Money></td>
                  <td className="n"><Money sm>{rep.link.stage === 'closed' ? rep.totals.released : rep.totals.remaining}</Money></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="apv-sig">
          {issues.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}
        </ul>
      )}
      {studying && rep && issues.length === 0 && (
        <ul className="apv-sig"><li className="ok"><Icon name={icons.check} size="sm" /><span>المبلغ ومصادره متحققان · التوزيع يساوي قيمة المشروع وكل مستويات البنود تغطيه</span></li></ul>
      )}

      {log.length > 0 && (
        <>
          <h4 className="fnd-h">سجل الارتباط <span className="sub"><Num>{log.length}</Num></span></h4>
          <ul className="apv-list">
            {log.map((c, i) => (
              <li key={`${c.at}-${i}`}>
                <Tag tone={c.kind === 'release' || c.kind === 'savings' ? 'mute' : c.kind === 'relink' ? 'warn' : 'ok'}>{LINK_CHANGE_SAY[c.kind]}</Tag>
                <span className="apv-t">
                  <b>{c.text}</b>
                  {c.kind === 'relink' && <span className="sub">السابق: {shareSay(c.from, title)} · الجديد: {shareSay(c.to, title)}</span>}
                  {c.reason && <span className="sub">السبب: {c.reason}</span>}
                </span>
                <span className="pc-sp" />
                <Person name={c.by} />
                <span className="sub"><DateText>{c.at.slice(0, 10)}</DateText></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Glass>
  )
}
