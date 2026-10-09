import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, Mono, Money, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { docSources, pathOf, sourceBalance, sourceByCode, splitOf, type BudgetDoc } from '@/data/mock/budgetTree'
import {
  BUDGET_REQS, MOVE_SAY, REQ_KIND_SAY, REQ_STATE_SAY, movesOf, reqTone, type MoveKind,
} from '@/data/budget/store'

/* The budget's own ledger (1.4.5 · 1.4.24) · every movement on its lines with the figure before and
   after: the opening allocation, holds and their release, commitments of multi-year projects, the
   annual hold, and the transfers, increases and decreases that executed. Each budget keeps its
   ledger alone, so two budgets in one year never mix their balances. */

const OUT: MoveKind[] = ['transfer-out', 'decrease', 'release', 'uncommit']

export function LedgerCard({ doc, line }: { doc: BudgetDoc; line?: string }) {
  const [all, setAll] = useState(false)
  const rows = movesOf(doc.id, line || undefined)
  const shown = all ? rows : rows.slice(0, 8)
  return (
    <Glass className="tblcard">
      <Head
        title="الحركات المالية"
        meta={<span className="sub"><Num>{rows.length}</Num> حركة{line ? ` · ${pathOf(doc.nodes, line)}` : ''}</span>}
      />
      {rows.length === 0 ? (
        <Empty title="لا حركات بعد." note="تبدأ الحركات عند اعتماد الميزانية · التخصيص الافتتاحي ثم كل حجز ومناقلة." />
      ) : (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحركة</th>
                <th>البند</th>
                <th className="n">المبلغ</th>
                <th className="n">قبل</th>
                <th className="n">بعد</th>
                <th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id}>
                  <td><DateText>{m.at.slice(0, 10)}</DateText></td>
                  <td>
                    <Tag tone={OUT.includes(m.kind) ? 'warn' : m.kind === 'open' ? 'mute' : 'ok'}>{MOVE_SAY[m.kind]}</Tag>
                    {m.ref && m.ref.startsWith('BOP-') && <> <Link className="lnk" to={ROUTES.budgetOp(m.ref)}><Mono>{m.ref}</Mono></Link></>}
                  </td>
                  <td className="trim1" title={pathOf(doc.nodes, m.nodeId)}>{doc.nodes.find((n) => n.id === m.nodeId)?.label ?? m.nodeId}</td>
                  <td className="n"><Money sm>{m.amount}</Money></td>
                  <td className="n"><Money sm>{m.before}</Money></td>
                  <td className="n"><Money sm>{m.after}</Money></td>
                  <td>{m.by === 'النظام' ? <span className="sub">النظام</span> : <Person name={m.by} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 8 && (
        <button className="btn btn-2 btn-sm mt-2" onClick={() => setAll((x) => !x)}>
          <Icon name={all ? icons.chevronUp : icons.chevronDown} size="sm" />
          {all ? 'اعرض أقل' : `اعرض كل الحركات (${rows.length})`}
        </button>
      )}
    </Glass>
  )
}

export function DocRequests({ doc }: { doc: BudgetDoc }) {
  const rows = BUDGET_REQS.filter((r) => r.docId === doc.id)
  return (
    <Glass>
      <Head
        title="طلبات العمليات"
        meta={<Link className="btn btn-2 btn-sm" to={`${ROUTES.budgetOpNew}?doc=${doc.id}`}><Icon name={icons.plus} size="sm" />طلب جديد</Link>}
      />
      {rows.length === 0 ? (
        <p className="sub cnote">لا طلبات مناقلة أو تعزيز أو تخفيض على هذه الميزانية.</p>
      ) : (
        <ul className="eprq">
          {rows.map((r) => (
            <li key={r.id}>
              <Link className="eprq-r well" to={ROUTES.budgetOp(r.id)}>
                <Icon name={icons.redo} size="sm" />
                <span className="eprq-b">
                  <b>{REQ_KIND_SAY[r.kind]} · <Money sm>{r.amount}</Money></b>
                  <span className="sub"><Mono>{r.id}</Mono> · <DateText>{r.createdAt.slice(0, 10)}</DateText></span>
                </span>
                <span className="pc-sp" />
                <Tag tone={reqTone(r.state)}>{REQ_STATE_SAY[r.state]}</Tag>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Glass>
  )
}

/* Batch 8 · the ledger by funding source · each movement attributed to the line's sources by their
   shares, so a budget funded by two endowments shows what each one gave, held and paid. Until the
   server records the source of each hold and payment, the split is by the line's shares · the card
   says so, and the server's ledger takes its place with the same columns. */
export function SourceLedgerCard({ doc }: { doc: BudgetDoc }) {
  const sources = docSources(doc)
  if (sources.length < 2) return null
  const rows = movesOf(doc.id)
  const shareOf = (nodeId: string): Record<string, number> => {
    const split = splitOf(doc, nodeId)
    const total = split?.reduce((s, x) => s + x.amount, 0) ?? 0
    return Object.fromEntries(sources.map((s) => [s.code, split && total ? (split.find((x) => x.code === s.code)?.amount ?? 0) / total : 1 / sources.length]))
  }
  const sum: Record<string, Record<'open' | 'held' | 'paid' | 'moved', number>> = Object.fromEntries(sources.map((s) => [s.code, { open: 0, held: 0, paid: 0, moved: 0 }]))
  for (const m of rows) {
    const sh = shareOf(m.nodeId)
    for (const s of sources) {
      const x = Math.round(m.amount * (sh[s.code] ?? 0))
      const t = sum[s.code]!
      if (m.kind === 'open') t.open += x
      else if (m.kind === 'hold' || m.kind === 'annual-hold') t.held += x
      else if (m.kind === 'release') t.held -= x
      else if (m.kind === 'paid') { t.paid += x; t.held -= x }
      else if (m.kind === 'transfer-in' || m.kind === 'increase') t.moved += x
      else if (m.kind === 'transfer-out' || m.kind === 'decrease') t.moved -= x
    }
  }
  return (
    <Glass className="tblcard">
      <Head title="الحركات حسب مصدر التمويل" meta={<Tag tone="mute">موزّعة بحصص البنود</Tag>} />
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>المصدر</th><th className="n">حصته في الميزانية</th><th className="n">التخصيص الافتتاحي</th><th className="n">مناقلات وتعديلات</th><th className="n">المحجوز الآن</th><th className="n">المصروف</th><th className="n">المتاح</th></tr></thead>
          <tbody>
            {sources.map((s) => {
              const t = sum[s.code]!
              return (
                <tr key={s.code}>
                  <td>{sourceByCode(s.code)?.name ?? s.code}</td>
                  <td className="n"><Money sm>{s.amount}</Money></td>
                  <td className="n"><Money sm>{t.open}</Money></td>
                  <td className="n"><Money sm>{t.moved}</Money></td>
                  <td className="n"><Money sm>{Math.max(0, t.held)}</Money></td>
                  <td className="n"><Money sm>{t.paid}</Money></td>
                  <td className="n"><b><Money sm>{sourceBalance(doc, s.code)}</Money></b></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="sub cnote">كل حركة تُنسب للمصادر بنسبة حصصها في بندها · عند ربط الخادم يُسجَّل مصدر كل حجز وصرف بعينه ويحل محل هذا التوزيع بالأعمدة نفسها.</p>
    </Glass>
  )
}
