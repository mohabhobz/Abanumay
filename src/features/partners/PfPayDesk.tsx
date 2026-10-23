import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Money, MoneyField, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { nf } from '@/lib/format'
import { payBlock } from '@/data/entities/store'
import { entityById } from '@/data/mock/entities'
import {
  PF_REQ_SAY, PORTFOLIOS, actOnPfReq, pfReqIssue, requestPfPay, type PfRequest, type PortfolioRec,
} from '@/data/partners/store'
import { Said } from './parts'

/* Client 20 Oct (#25) · the portfolios' payments live in the disbursement procedure, not on the
   portfolio page · the supervisor files the next scheduled payment's requirements here (on the
   partner's behalf), then each seat acts on it in order · qualify, permit, approve, order, pay.
   The portfolio page only reflects where each payment stands. */
export function PfPayDesk() {
  const list = PORTFOLIOS.filter((pf) => pf.stage === 'approved' || pf.requests.length > 0)
  return (
    <Glass>
      <Head title="صرف دفعات المحافظ" meta={<span className="sub">إجراء صرف الدفعات · على مستوى المحفظة وفق جدولها</span>} />
      {list.length ? list.map((pf) => <PfPays key={pf.id} pf={pf} />) : <p className="sub cnote">لا محافظ معتمدة لها دفعات.</p>}
    </Glass>
  )
}

function PfPays({ pf }: { pf: PortfolioRec }) {
  const { role, user } = useRole()
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [why, setWhy] = useState('')
  const [amt, setAmt] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const sup = role.key === 'supervisor'
  const act = (rq: PfRequest, a: 'qualify' | 'permit' | 'approve' | 'order' | 'pay' | 'return', ok: string) => {
    const out = actOnPfReq(pf.id, rq.id, a, note, user.name, ref, role.key, a === 'permit' ? (Number(amt) || rq.asked || rq.amount) : undefined)
    setSaid(out.length ? { bad: out } : { ok })
    if (!out.length) { setNote(''); setRef(''); setAmt('') }
  }
  const mine = (rq: PfRequest) =>
    ((rq.state === 'supervisor' || rq.state === 'eligible') && role.key === 'supervisor') || (rq.state === 'manager' && role.key === 'grants-manager')
    || (rq.state === 'exec' && role.key === 'ceo') || ((rq.state === 'finance' || rq.state === 'order') && role.key === 'finance')
  const next = pf.schedule.find((s) => !pf.requests.some((r) => r.no === s.no && r.state !== 'returned'))
  const issue = next ? pfReqIssue(pf, next.no, next.amount) : ''
  return (
    <section className="pfdesk">
      <h4 className="ptn-sub"><Link className="tlink" to={`${ROUTES.portfolio(pf.id)}?from=partners`}>{pf.name}</Link> <span className="sub">· {pf.id}</span></h4>
      <ul className="ptn-slots">
        {pf.schedule.map((s) => {
          const rq = pf.requests.filter((r) => r.no === s.no).at(-1)
          return (
            <li key={s.no}>
              <span>الدفعة <span className="num">{s.no}</span> · <DateText>{s.dueAt}</DateText></span>
              <Money sm>{s.amount}</Money>
              {rq ? <Tag tone={rq.state === 'paid' ? 'ok' : rq.state === 'returned' ? 'ret' : 'warn'}>{PF_REQ_SAY[rq.state]}{rq.state === 'paid' ? ` · ${rq.ref}` : rq.state === 'returned' && rq.note ? ` · ${rq.note}` : ''}</Tag> : <Tag tone="mute">لم تُطلب</Tag>}
              {rq?.why && <span className="sub">{rq.why}{rq.docs?.length ? ` · ${rq.docs.join('، ')}` : ''}</span>}
              {rq && mine(rq) && (
                <span className="rowf gp-2">
                  {rq.state === 'supervisor' && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'qualify', 'اعتماد المتطلبات')}>اعتمد المتطلبات</button>}
                  {rq.state === 'eligible' && <><MoneyField value={amt} onChange={setAmt} label={`قيمة إذن الدفعة ${rq.no}`} placeholder={nf.format(rq.asked ?? rq.amount)} /><button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'permit', 'إذن الصرف')}>أنشئ إذن الصرف</button></>}
                  {(rq.state === 'manager' || rq.state === 'exec') && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'approve', 'اعتماد الإذن')}>اعتمد الإذن</button>}
                  {rq.state === 'finance' && <button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'order', 'اعتماد أمر الصرف')}>اعتمد أمر الصرف</button>}
                  {rq.state === 'order' && <><span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label={`رقم أمر التحويل · ${pf.name} · الدفعة ${rq.no}`} placeholder="رقم أمر التحويل" /></span><button type="button" className="btn btn-p btn-sm" onClick={() => act(rq, 'pay', 'صرف الدفعة')}>صرف</button></>}
                  <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label={`سبب الإعادة · ${pf.name}`} placeholder="سبب الإعادة" /></span>
                  <button type="button" className="btn btn-2 btn-sm" onClick={() => act(rq, 'return', 'إعادة الطلب')}>أعد</button>
                </span>
              )}
            </li>
          )
        })}
        {!pf.schedule.length && <li className="sub">يُحدَّد الجدول مع الاتفاقية.</li>}
      </ul>
      {payBlock(entityById(pf.entityId)) && <p className="bad cnote">{payBlock(entityById(pf.entityId))}</p>}
      {sup && pf.stage === 'approved' && next && (
        <div className="apv-row mt-3">
          {issue ? <span className="sub">{issue}</span> : null}
          <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label={`مبرّر طلب الدفعة · ${pf.name}`} placeholder="مبرّر الطلب وما أُنجز" /></span>
          <UploadButton label="مستند الطلب" onPick={(f) => setDocs((x) => [...x, f.name])} />
          {docs.length > 0 && <span className="sub">{docs.join('، ')}</span>}
          <button type="button" className="btn btn-p btn-sm" disabled={Boolean(issue) || pf.agreement.state !== 'signed'} title={pf.agreement.state !== 'signed' ? 'بعد توقيع الاتفاقية' : ''}
            onClick={() => { const out = requestPfPay(pf.id, next.no, next.amount, user.name, why, docs); setSaid(out.length ? { bad: out } : { ok: `متطلبات الدفعة ${next.no}` }); if (!out.length) { setWhy(''); setDocs([]) } }}>
            ارفع متطلبات الدفعة {next.no}
          </button>
        </div>
      )}
      <Said said={said} />
    </section>
  )
}
