import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldBox, Button, DockActions, DateText, Glass, Head, Money, MoneyField, Tag } from '@/components/ui'
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
      <Head title="صرف دفعات المحافظ" />
      {list.length ? list.map((pf) => <PfPays key={pf.id} pf={pf} />) : <p className="sub cnote">لا محافظ معتمدة لها دفعات.</p>}
    </Glass>
  )
}

function PfPays({ pf }: { pf: PortfolioRec }) {
  const { role, user } = useRole()
  const [ref, setRef] = useState('')
  const [why, setWhy] = useState('')
  const [amt, setAmt] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const sup = role.key === 'supervisor'
  const act = (rq: PfRequest, a: 'qualify' | 'permit' | 'approve' | 'order' | 'pay' | 'return', ok: string, note: string) => {
    const out = actOnPfReq(pf.id, rq.id, a, note, user.name, ref, role.key, a === 'permit' ? (Number(amt) || rq.asked || rq.amount) : undefined)
    setSaid(out.length ? { bad: out } : { ok })
    if (!out.length) { setRef(''); setAmt('') }
    return out
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
                  {rq.state === 'eligible' && <MoneyField value={amt} onChange={setAmt} label={`قيمة إذن الدفعة ${rq.no}`} placeholder={nf.format(rq.asked ?? rq.amount)} />}
                  {rq.state === 'order' && <FieldBox><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label={`رقم أمر التحويل · ${pf.name} · الدفعة ${rq.no}`} placeholder="رقم أمر التحويل" /></FieldBox>}
                  {/* Client 26 Oct · each decision confirms in its popup · the return's reason there */}
                  <DockActions
                    actions={[
                      { label: 'أعد', kind: 'btn-2 btn-sm', needsNote: true, a: 'return' as const, ok: 'إعادة الطلب' },
                      ...(rq.state === 'supervisor' ? [{ label: 'اعتمد المتطلبات', kind: 'btn-p btn-sm', a: 'qualify' as const, ok: 'اعتماد المتطلبات' }] : []),
                      ...(rq.state === 'eligible' ? [{ label: 'أنشئ إذن الصرف', kind: 'btn-p btn-sm', a: 'permit' as const, ok: 'إذن الصرف' }] : []),
                      ...(rq.state === 'manager' || rq.state === 'exec' ? [{ label: 'اعتمد الإذن', kind: 'btn-p btn-sm', a: 'approve' as const, ok: 'اعتماد الإذن' }] : []),
                      ...(rq.state === 'finance' ? [{ label: 'اعتمد أمر الصرف', kind: 'btn-p btn-sm', a: 'order' as const, ok: 'اعتماد أمر الصرف' }] : []),
                      ...(rq.state === 'order' ? [{ label: 'صرف', kind: 'btn-p btn-sm', a: 'pay' as const, ok: 'صرف الدفعة' }] : []),
                    ]}
                    subject={<>{pf.name} · الدفعة {rq.no} · {nf.format(rq.asked ?? rq.amount)} ريال</>}
                    placeholder="سبب الإعادة"
                    onRun={(x, n) => act(rq, x.a, x.ok, n)}
                  />
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
          <FieldBox><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label={`مبرّر طلب الدفعة · ${pf.name}`} placeholder="مبرّر الطلب وما أُنجز" /></FieldBox>
          <UploadButton label="مستند الطلب" onPick={(f) => setDocs((x) => [...x, f.name])} />
          {docs.length > 0 && <span className="sub">{docs.join('، ')}</span>}
          <Button type="button" variant="p" size="sm" disabled={Boolean(issue) || pf.agreement.state !== 'signed'} title={pf.agreement.state !== 'signed' ? 'بعد توقيع الاتفاقية' : ''}
            onClick={() => { const out = requestPfPay(pf.id, next.no, next.amount, user.name, why, docs); setSaid(out.length ? { bad: out } : { ok: `متطلبات الدفعة ${next.no}` }); if (!out.length) { setWhy(''); setDocs([]) } }}>
            ارفع متطلبات الدفعة {next.no}
          </Button>
        </div>
      )}
      <Said said={said} />
    </section>
  )
}
