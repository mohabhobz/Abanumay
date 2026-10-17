import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, KV, Money, MoneyField, Select, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { projectById } from '@/data/mock/projects'
import { nf } from '@/lib/format'
import { resizeIssue } from '@/data/budget/store'
import { APPROVER_SAY, CASE_KIND_SAY, OUTCOME_SAY, approverFor, createCase, grantOf, outcomesFor, paidToDate, stopPhase, useClosing } from '@/data/closing/store'
import type { CaseKind, CaseRow } from '@/types/domain'

/* Opening a distress case · 10.9.

   One screen for the three decisions, because the three start from the same facts: the grant,
   what was paid, and what's still ahead. What differs is what the decision needs:
   · a stop · the reason, and the phase decides the rest (a settlement when money went out)
   · a cut · the new value and the agreement's annex · and what the entity owes back when it was
     paid more than the new value
   · a raise · the new value, the extra payment, and room on the line to hold it
   The supervisor opens it; it goes to the grants manager and then the CEO, and nothing in the
   project changes before that approval. */

const KEYS = ['project', 'kind'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

export default function CaseNewPage() {
  const navigate = useNavigate()
  const { role, user } = useRole()
  useClosing()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const p = v.project ? projectById(v.project) : undefined
  const kind = (['stop', 'reduce', 'increase'].includes(v.kind ?? '') ? v.kind : 'stop') as CaseKind
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [annex, setAnnex] = useState('')
  const [extra, setExtra] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const [outcome, setOutcome] = useState<CaseRow['outcome']>()
  const [purpose, setPurpose] = useState('')
  const [decision, setDecision] = useState('')
  const [rfile, setRfile] = useState('')

  if (!p) {
    return (
      <AppLayout assistantContext={assistFor.page('حالة تعثّر')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="حالات التعثر" onClick={() => navigate(ROUTES.distresses)} />
          <Glass><Empty title="اختر المشروع من صفحته." note="تُفتح حالة التعثر من تبويب الإغلاق في صفحة المشروع." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const granted = grantOf(p.id)
  const paid = paidToDate(p.id)
  const phase = stopPhase(p.id)
  const value = Number(amount) || 0
  const claim = kind === 'reduce' && value ? Math.max(0, paid - value) : 0
  const raise = kind === 'increase' && value > granted ? value - granted : 0
  /* v3 · 10.9.1 – 10.9.3 · 10.4.28 · what the decision makes of the project and its money */
  const outs = outcomesFor(kind, p.id, value || undefined)
  const pick = outcome && outs.includes(outcome) ? outcome : outs[0]
  const independent = kind === 'increase' && pick === 'independent'
  const redirect = pick === 'redirect'
  const issue = kind === 'increase' && value && !independent ? resizeIssue(p.id, value) : ''
  const docsOk = !redirect || (purpose.trim() && decision.trim() && rfile)
  const ready = reason.trim() && docsOk && (kind === 'stop' || (kind === 'reduce' ? value > 0 && value < granted && annex : value > granted && !issue))
  /* v3 · 10.4.11 · a redirect outcome also needs the redirect row's approver */
  const own = approverFor(kind, p.id, kind === 'increase' ? value || undefined : undefined)
  const finalKey = own === 'grants-manager' && (!redirect || approverFor('redirect', p.id) === 'grants-manager') ? 'grants-manager' : 'ceo'
  const approver = APPROVER_SAY(finalKey)
  const mine = role.key === 'supervisor'

  const submit = () => {
    const out = createCase({
      projectId: p.id, kind, reason,
      newAmount: kind === 'stop' ? undefined : value,
      annex: kind === 'reduce' ? annex : undefined,
      extra: kind === 'increase' && !independent ? { amount: Number(extra) || raise, dueAt: dueAt || '2026-11-01' } : undefined,
      outcome: pick, redirect: redirect ? { purpose, decision, file: rfile } : undefined,
    }, user.name)
    setBad(out.errors)
    if (out.id) navigate(ROUTES.distress(out.id))
  }

  return (
    <AppLayout assistantContext={assistFor.page(CASE_KIND_SAY[kind], p.name)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="المشروع" onClick={() => navigate(ROUTES.project(p.id))} />
          <header>
            <div>
              <h1 className="ptitle">{CASE_KIND_SAY[kind]}</h1>
              <p className="sub mt-1"><Link className="tlink" to={ROUTES.project(p.id)}>{p.name}</Link> · {p.entityName}</p>
            </div>
          </header>

          <Glass className="ftoolbar">
            <div className="ftool-r"><div className="ftool-f">
              <Select
                value={kind}
                allowEmpty={false}
                all="نوع القرار"
                options={(['stop', 'reduce', 'increase'] as CaseKind[]).map((k) => ({ value: k, label: CASE_KIND_SAY[k] }))}
                onChange={(x) => set({ kind: x })}
              />
            </div></div>
          </Glass>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="القرار" meta={<Tag tone="mute">مشرف المنح</Tag>} />
                <label className="regf">
                  <span className="lb">سبب القرار<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب القرار" /></span>
                </label>
                {kind !== 'stop' && (
                  <label className="regf">
                    <span className="lb">القيمة الجديدة للمشروع<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <MoneyField value={amount} onChange={setAmount} label="القيمة الجديدة للمشروع" />
                    <span className="sub regf-h">القيمة الحالية <span className="num">{nf.format(granted)}</span></span>
                  </label>
                )}
                {kind === 'reduce' && (
                  <div className="apv-row mt-2">
                    <span className="sub">ملحق تعديل الاتفاقية{annex ? ` · ${annex}` : <> · إلزامي (<bdi>{/* doc 10.9.5 */}</bdi>)</>}</span>
                    <UploadButton label="ملحق الاتفاقية" onPick={(f) => setAnnex(f.name)} />
                  </div>
                )}
                <label className="regf">
                  <span className="lb">نتيجة القرار<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <Select value={pick} allowEmpty={false} all="النتيجة" options={outs.map((o) => ({ value: o, label: OUTCOME_SAY[o] }))} onChange={(x) => setOutcome(x as CaseRow['outcome'])} />
                  <span className="sub regf-h">{/* doc 10.9.1 – 10.9.3 · 10.4.28 */}
                    {kind === 'stop' ? 'قبل أي صرف «ملغى» · وبعد الصرف استرداد غير المستخدم، أو إعادة توجيهه، أو «متعثر» وفق القرار'
                      : kind === 'reduce' ? 'يُسترد فرق ما صُرف فوق القيمة الجديدة أو يُعاد توجيهه'
                      : 'ملحق يزيد قيمة هذا المشروع، أو مشروع مستقل جديد للجهة نفسها يمرّ بدورة الدراسة والاعتماد'}
                  </span>
                </label>
                {redirect && (
                  <div className="regfields">
                    <label className="regf"><span className="lb">الغرض الجديد داخل العلاقة نفسها<b className="regf-r" aria-label="إلزامي">*</b></span><span className="fld"><input value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="الغرض الجديد للدعم المعاد توجيهه" /></span></label>
                    <label className="regf"><span className="lb">رقم القرار<b className="regf-r" aria-label="إلزامي">*</b></span><span className="fld"><input value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="رقم قرار إعادة التوجيه" /></span></label>
                    <div className="apv-row"><span className="sub">{rfile || 'مستند القرار · إلزامي'}</span><UploadButton label="مستند قرار إعادة التوجيه" onPick={(f) => setRfile(f.name)} /></div>
                  </div>
                )}
                {kind === 'increase' && !independent && (
                  <div className="regfields">
                    <label className="regf">
                      <span className="lb">الدفعة الإضافية</span>
                      <MoneyField value={extra || (raise ? String(raise) : '')} onChange={setExtra} label="الدفعة الإضافية" />
                      <span className="sub regf-h">تُضاف إلى جدول الدفعات · وتزيد الحجز بقدر الزيادة</span>
                    </label>
                    <label className="regf">
                      <span className="lb">تاريخ استحقاقها</span>
                      <span className="fld"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} aria-label="تاريخ استحقاق الدفعة الإضافية" /></span>
                    </label>
                  </div>
                )}
                {issue && <p className="bad cnote">{issue}</p>}
                {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
              </Glass>

              <Glass>
                <Head title="أثر القرار" />
                <KV
                  rows={[
                    { k: 'قيمة المنحة', v: <Money sm>{granted}</Money> },
                    { k: 'المصروف حتى الآن', v: <Money sm>{paid}</Money> },
                    ...(kind === 'stop' ? [{ k: 'موضع الإيقاف', v: phase.say }] : []),
                    ...(kind === 'reduce' ? [{ k: 'يُطالَب بإعادته', v: claim ? <b className="bad"><Money sm>{claim}</Money></b> : <span className="sub">لا شيء · يُخفَّض الحجز والجدول</span> }] : []),
                    ...(kind === 'increase' ? [{ k: independent ? 'قيمة المشروع المستقل' : 'زيادة الحجز', v: raise ? <Money sm>{raise}</Money> : <span className="sub">—</span> }] : []),
                    { k: 'النتيجة', v: pick ? OUTCOME_SAY[pick] : '—' },
                    { k: 'يعتمده نهائيًّا', v: <>{approver}{/* doc 10.4.11 */}</> },
                  ]}
                />
                <p className="sub cnote">
                  {kind === 'stop'
                    ? `باعتماد ${approver} تُغلق سجلات الصرف المفتوحة وتُوقف الدفعات القادمة، ويُحرَّر المحجوز غير المصروف إلى مخصص المجال، ويُسترد ما لم يُستخدم أو يُعاد توجيهه.`
                    : independent ? `باعتماد ${approver} يُفتح طلب مشروع مستقل للجهة مرتبط بهذا المشروع · ولا تتغيّر قيمة المشروع الحالي.`
                    : `يُحدَّث المشروع بالقيمة الجديدة باعتماد ${approver}، ويتبعه الحجز وجدول الدفعات.`}
                </p>
              </Glass>
            </div>

            <AssistantAside
              title="مراجعة القرار"
              cta="راجع القرار"
              empty={`القرار مكتمل · يُرفع إلى مدير المنح${finalKey === 'grants-manager' ? '' : ` ثم ${approver}`}.`}
              readings={[
                ...(!reason.trim() ? [{ id: 'cn-reason', kind: 'flag' as const, label: 'ينقص', text: 'سبب القرار', src: '10.9' }] : []),
                ...(kind === 'stop' ? [{ id: 'cn-phase', kind: 'note' as const, label: 'موضع الإيقاف', text: phase.say, src: /* doc 10.9.1 – 10.9.4 */ '' }] : []),
                ...(kind === 'reduce' && !annex ? [{ id: 'cn-annex', kind: 'flag' as const, label: 'ينقص', text: 'ملحق تعديل الاتفاقية', src: /* doc 10.9.5 */ '' }] : []),
                ...(claim > 0 ? [{ id: 'cn-claim', kind: 'note' as const, label: 'استرداد', metric: { value: nf.format(claim), unit: 'ريال' }, text: 'يُطالَب بالفرق عمّا صُرف بعد الاعتماد.', src: /* doc 10.9.5 */ '' }] : []),
                ...(issue ? [{ id: 'cn-issue', kind: 'flag' as const, label: 'الحجز', text: issue, src: /* doc 10.9.6 */ '' }] : []),
              ]}
            />
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">{mine ? <>يُرفع القرار إلى مدير المنح{approver !== APPROVER_SAY('grants-manager') ? <> ثم {approver}</> : null}</> : <>يفتح الحالةَ مشرفُ المنح</>}</span>
            </div>
            {mine && <button type="button" className="btn btn-p" disabled={!ready} onClick={submit}>افتح الحالة</button>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
