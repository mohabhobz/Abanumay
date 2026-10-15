import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, KV, Money, MoneyField, Num, Person, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import type { ProjectRow } from '@/types/domain'
import { HOLDER_LABEL, holderOf } from '@/data/holders'
import { flowOf } from '@/data/intake/flow'
import { meOf, readRole } from '@/data/roles'
import { HOLD_STAGE_SAY, useBudget } from '@/data/budget/store'
import { appFlowOf, changeAmount, completeCoverage, finPosition, supportAmount, useApprovals, type FinPosition } from '@/data/approvals/store'

/* v3 · the support amount on the approval path and the money behind it.

   «مبلغ الدعم» · the supervisor's recommended amount, then each level's change with its reason, the
   amount before and after · the levels before read it at once (4.2.5 · 5.4.11). The seat holding the
   project fixes, raises or cuts it there; the hold follows when the line has the balance, and a raise
   it can't cover is refused (1.4.14). The committee and the board change it with their decision in
   the session (6.4.5 · 7.4.7).

   «الموقف المالي» · the line's allocation, final approved, initial holds, accounting and available
   balances, the most the amount may rise and what the decision leaves (5.4.8 · 0.def.9 – 0.def.13). */

export function FinKV({ fin }: { fin: FinPosition }) {
  const one = fin.lines.length === 1 ? fin.lines[0] : undefined
  return (
    <>
      <KV rows={[
        { k: 'مبلغ الدعم الحالي', v: <b><Money sm>{fin.amount}</Money></b> },
        { k: 'مرحلة الحجز', v: HOLD_STAGE_SAY[fin.stage as keyof typeof HOLD_STAGE_SAY] ?? fin.stage },
        ...(one ? [
          { k: 'البند', v: <>{one.label} <span className="sub">· {one.budget}</span></> },
          { k: 'المخصص', v: <Money sm>{one.allocated}</Money> },
          { k: 'المعتمد النهائي على البند', v: <Money sm>{one.finalApproved}</Money> },
          { k: 'الحجوزات المبدئية القائمة', v: <Money sm>{one.initial}</Money> },
          { k: 'الرصيد المحاسبي المتبقي', v: <Money sm>{one.accounting}</Money> },
          { k: 'الرصيد المتاح فعليًا', v: <b><Money sm>{one.available}</Money></b> },
        ] : fin.lines.map((x) => ({ k: `${x.label} · ${x.budget}`, v: <>حصة <Money sm>{x.share}</Money> · محاسبي <Money sm>{x.accounting}</Money> · متاح <Money sm>{x.available}</Money> · مبدئي <Money sm>{x.initial}</Money></> }))),
        { k: 'الحد الأعلى الممكن للزيادة', v: <Money sm>{fin.maxRaise}</Money> },
        { k: 'الرصيد المتوقع بعد القرار', v: fin.afterDecision < 0 ? <span className="bad">عجز <Money sm>{-fin.afterDecision}</Money></span> : <Money sm>{fin.afterDecision}</Money> },
        { k: 'الرصيد المحاسبي بعد القرار', v: <Money sm>{fin.accountingAfter}</Money> },
      ]} />
    </>
  )
}

export function AmountCard({ row }: { row: ProjectRow }) {
  useApprovals()
  useBudget()
  const role = readRole()
  const me = meOf(role)
  const f = appFlowOf(row.id)
  const holder = holderOf(row)
  const st = flowOf(row.id).study
  const amount = supportAmount(row)
  const fin = finPosition(row)
  const seat = row.stage === 'دراسة المشروع' && ((holder === 'manager' && role === 'grants-manager') || (holder === 'exec' && role === 'ceo'))
  const [to, setTo] = useState(0)
  const [why, setWhy] = useState('')
  const [said, setSaid] = useState<string[]>([])
  const cov = f.coverage
  const mayCover = cov && !cov.done && (role === 'ceo' || role === 'grants-manager')

  return (
    <Glass>
      <Head title="مبلغ الدعم" meta={<span className="rowf gp-2"><b><Money sm>{amount}</Money></b>{f.amounts.length > 0 && <Tag tone="warn">عُدّل <Num>{f.amounts.length - 1}</Num></Tag>}</span>} />
      <KV rows={[
        { k: 'المبلغ المطلوب من الجهة', v: <Money sm>{row.amountRequested}</Money> },
        ...(st?.recommendation === 'approve' ? [{ k: 'مبلغ توصية مشرف المنح', v: <><Money sm>{st.amount}</Money> <span className="sub">· <Person name={st.by} /></span></> }] : []),
      ]} />
      {f.amounts.length > 1 && (
        <ul className="apv-list">
          {f.amounts.slice(1).map((x, i) => (
            <li key={i}>
              <Tag tone={x.to > x.from ? 'warn' : 'ok'}>{x.to > x.from ? 'رفع' : 'خفض'}</Tag>
              <span className="apv-t">
                <b>{HOLDER_LABEL[x.level]} · <Money sm>{x.from}</Money> ← <Money sm>{x.to}</Money></b>
                <span className="sub">المبررات: {x.reason}{x.session ? <> · في الجلسة <Link className="lnk" to={ROUTES.approvalSession(x.session)}>{x.session}</Link></> : null}</span>
              </span>
              <span className="pc-sp" />
              <Person name={x.by} />
              <span className="sub"><DateText>{x.at}</DateText></span>
            </li>
          ))}
        </ul>
      )}
      {seat && (
        <>
          <div className="regfields mt-2">
            <label className="regf">
              <span className="lb">المبلغ الجديد</span>
              <MoneyField value={to ? String(to) : ''} label="مبلغ الدعم الجديد" onChange={(x) => setTo(Number(x) || 0)} />
            </label>
            <label className="regf regf-w">
              <span className="lb">مبررات التعديل<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="مبررات تعديل المبلغ" placeholder="مثال: خفض بند التجهيزات بعد مقارنة التكلفة بالمجال" /></span>
            </label>
          </div>
          <div className="apv-row">
            <button className="btn btn-2 btn-sm" disabled={!(to > 0) || !why.trim() || to === amount} onClick={() => { const w = changeAmount(row, holder!, to, why, me); setSaid(w); if (!w.length) { setTo(0); setWhy('') } }}>
              ثبّت المبلغ الجديد
            </button>
            {fin && <span className="sub">الحد الأعلى الممكن للزيادة <Money sm>{fin.maxRaise}</Money> · يُحدَّث الحجز تلقائيًا</span>}
          </div>
          {said.length > 0 && <ul className="apv-sig">{said.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>}
        </>
      )}
      {cov && (
        <div className="apv-rec mt-2">
          <div className="apv-rec-h">
            <b>{HOLDER_LABEL[cov.level]} · اعتماد صادر {cov.done ? '· نفذ ماليًا' : '· بانتظار التغطية المالية'}</b>
            <span className="pc-sp" />
            <Tag tone={cov.done ? 'ok' : 'warn'}>{cov.done ? 'اعتماد مالي نافذ' : 'غير نافذ ماليًا'}</Tag>
          </div>
          <p className="sub cnote">{/* doc 6.4.3 · 7.4.5 */}حُفظ القرار كما صدر بمبلغ <Money sm>{cov.amount}</Money> · {cov.short} · لا يتحول الحجز إلى نهائي حتى معالجة التغطية (مناقلة أو تعزيز للبند أو تعديل الارتباط).</p>
          {mayCover && (
            <div className="apv-row">
              <button className="btn btn-p btn-sm" onClick={() => setSaid(completeCoverage(row, me))}>تحقّق من التغطية ونفّذ القرار</button>
              <Link className="lnk" to={ROUTES.budget}>عمليات الميزانية</Link>
            </div>
          )}
          {cov.done && <p className="sub cnote">نفذ ماليًا · <Person name={cov.done.by} /> · <DateText>{cov.done.at}</DateText></p>}
          {said.length > 0 && !seat && <ul className="apv-sig">{said.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>}
        </div>
      )}
      {f.briefs.length > 0 && (
        <p className="sub cnote">
          <Icon name={icons.doc} size="sm" /> ملفات العرض: {f.briefs.map((b, i) => <span key={b.id}>{i > 0 && ' · '}<Link className="lnk" to={ROUTES.projectBrief(row.id, b.id)}>{HOLDER_LABEL[b.level]} · {b.at} {b.time}</Link></span>)}
        </p>
      )}
    </Glass>
  )
}
