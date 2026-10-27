import { holds, holdersSay } from '@/data/shared/decisions'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DateField, BackTo, Empty, Glass, Head, KV, Money, MoneyField, Select, Tag } from '@/components/ui'
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
import { APPROVER_SAY, CASE_KIND_SAY, DIRECT_PATH, OUTCOME_SAY, approverFor, cancelBlockers, createCase, grantOf, outcomesFor, paidToDate, stopPhase, useClosing } from '@/data/closing/store'
import { payRequests } from '@/data/mock/disbursements'
import { closeOfProject } from '@/data/mock/closing'
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
  const kind = (['stop', 'reduce', 'increase', 'direct'].includes(v.kind ?? '') ? v.kind : 'stop') as CaseKind
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
          <Glass><Empty title="اختر المشروع من صفحته." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  if (kind === 'direct') return <DirectNew projectId={p.id} />

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
  const own = approverFor(kind as Exclude<CaseKind, 'direct'>, p.id, kind === 'increase' ? value || undefined : undefined)
  const finalKey = own === 'grants-manager' && (!redirect || approverFor('redirect', p.id) === 'grants-manager') ? 'grants-manager' : 'ceo'
  const approver = APPROVER_SAY(finalKey)
  /* Client 18 Oct · #17 · a value annex is opened by whoever holds the permission */
  const valueAnnex = kind === 'reduce' || pick === 'annex'
  const mine = valueAnnex ? holds('annexBy', role.key) : holds('distressBy', role.key)

  const submit = () => {
    const out = createCase({
      projectId: p.id, kind, reason,
      newAmount: kind === 'stop' ? undefined : value,
      annex: kind === 'reduce' ? annex : undefined,
      extra: kind === 'increase' && !independent ? { amount: Number(extra) || raise, dueAt: dueAt || '2026-11-01' } : undefined,
      outcome: pick, redirect: redirect ? { purpose, decision, file: rfile } : undefined,
    }, user.name, role.key)
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
                    <span className="sub">ملحق تعديل الاتفاقية{annex ? ` · ${annex}` : ' · إلزامي'}</span>
                    <UploadButton label="ملحق الاتفاقية" onPick={(f) => setAnnex(f.name)} />
                  </div>
                )}
                <label className="regf">
                  <span className="lb">نتيجة القرار<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <Select value={pick} allowEmpty={false} all="النتيجة" options={outs.map((o) => ({ value: o, label: OUTCOME_SAY[o] }))} onChange={(x) => setOutcome(x as CaseRow['outcome'])} />
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
                    </label>
                    <label className="regf">
                      <span className="lb">تاريخ استحقاقها</span>
                      <DateField value={dueAt} onChange={setDueAt} label="تاريخ استحقاق الدفعة الإضافية" />
                    </label>
                  </div>
                )}
                {/* Client 18 Oct (sheet V2 · #4) · warned now · checked at the approval that cancels the project */}
                {kind === 'stop' && pick === 'cancel' && cancelBlockers(p.id).map((x) => (
                  <p key={x} className="bad cnote" role="status">قبل اعتماد الإلغاء · {x}</p>
                ))}
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
                    ...(kind === 'reduce' ? [{ k: 'يُطالَب بإعادته', v: claim ? <b className="bad"><Money sm>{claim}</Money></b> : <span className="sub">لا شيء</span> }] : []),
                    ...(kind === 'increase' ? [{ k: independent ? 'قيمة المشروع المستقل' : 'زيادة الحجز', v: raise ? <Money sm>{raise}</Money> : <span className="sub">—</span> }] : []),
                    { k: 'النتيجة', v: pick ? OUTCOME_SAY[pick] : '—' },
                    { k: 'يعتمده نهائيًّا', v: <>{approver}{/* doc 10.4.11 */}</> },
                  ]}
                />
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
              <span className="decsent">{mine ? <>يُرفع القرار إلى مدير المنح{approver !== APPROVER_SAY('grants-manager') ? <> ثم {approver}</> : null}</> : <>{valueAnnex ? <>يتخذ قرار ملحق القيمة {holdersSay('annexBy')}</> : `يفتح الحالةَ ${holdersSay('distressBy')}`}</>}</span>
            </div>
            {mine && <button type="button" className="btn btn-p" disabled={!ready} onClick={submit}>افتح الحالة</button>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

/** Client sheet 24 Oct (#27) · opening a direct closing · the reason and its document · what the
    closing will do to the money is shown before it goes up, and nothing changes before finance */
function DirectNew({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const { role, user } = useRole()
  useClosing()
  const p = projectById(projectId)!
  const [reason, setReason] = useState('')
  const [file, setFile] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const granted = grantOf(p.id)
  const paid = paidToDate(p.id)
  const open = payRequests.filter((r) => r.projectId === p.id && r.state !== 'paid' && r.state !== 'closed')
  const cycle = closeOfProject(p.id)
  const mine = holds('distressBy', role.key)
  const ready = Boolean(reason.trim() && file)
  const submit = () => {
    const out = createCase({ projectId: p.id, kind: 'direct', reason, file }, user.name, role.key)
    setBad(out.errors)
    if (out.id) navigate(ROUTES.distress(out.id))
  }
  return (
    <AppLayout assistantContext={assistFor.page(CASE_KIND_SAY.direct, p.name)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo label="المشروع" onClick={() => navigate(ROUTES.projectTab(p.id, 'closing'))} />
          <header>
            <div>
              <h1 className="ptitle">{CASE_KIND_SAY.direct}</h1>
              <p className="sub mt-1"><Link className="tlink" to={ROUTES.project(p.id)}>{p.name}</Link> · {p.entityName}</p>
            </div>
          </header>
          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="طلب الإغلاق" meta={<Tag tone="mute">مشرف المنح</Tag>} />
                <label className="regf">
                  <span className="lb">سبب الإغلاق المباشر<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب الإغلاق المباشر" /></span>
                </label>
                <div className="apv-row mt-2">
                  <span className="sub">مستند الإغلاق{file ? ` · ${file}` : ' · إلزامي'}</span>
                  <UploadButton label="مستند الإغلاق" onPick={(f) => setFile(f.name)} />
                </div>
                {cycle && cycle.stage !== 'closed' && <p className="bad cnote" role="status">للمشروع إغلاق قائم {cycle.id} · الإغلاق المباشر لا يُفتح فوقه</p>}
                {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
              </Glass>
              <Glass>
                <Head title="أثر الإغلاق" />
                <KV rows={[
                  { k: 'قيمة المنحة', v: <Money sm>{granted}</Money> },
                  { k: 'المصروف حتى الآن', v: <Money sm>{paid}</Money> },
                  { k: 'يعود إلى بند الميزانية', v: <Money sm>{Math.max(0, granted - paid)}</Money> },
                  { k: 'طلبات صرف مفتوحة تُغلق', v: open.length ? open.map((r) => r.id).join('، ') : <span className="sub">لا شيء</span> },
                  { k: 'مسار الاعتماد', v: DIRECT_PATH.join(' ← ') },
                  { k: 'حالة المشروع بعده', v: 'مشروع مكتمل' },
                ]} />
              </Glass>
            </div>
            <AssistantAside
              title="مراجعة الطلب"
              cta="راجع الطلب"
              empty="الطلب مكتمل · يُرفع إلى مدير المنح ثم المدير التنفيذي ثم الإدارة المالية."
              readings={[
                ...(!reason.trim() ? [{ id: 'dc-reason', kind: 'flag' as const, label: 'ينقص', text: 'سبب الإغلاق المباشر', src: '' }] : []),
                ...(!file ? [{ id: 'dc-file', kind: 'flag' as const, label: 'ينقص', text: 'مستند الإغلاق', src: '' }] : []),
                ...(open.length ? [{ id: 'dc-open', kind: 'note' as const, label: 'طلبات صرف', text: `تُغلق ${open.length} طلبات مفتوحة عند اعتماد الإدارة المالية`, src: '' }] : []),
              ]}
            />
          </div>
        </div>
        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">{mine ? <>يُرفع الطلب إلى {DIRECT_PATH.slice(1).join(' ثم ')}</> : `يفتح الإغلاق المباشر ${holdersSay('distressBy')}`}</span>
            </div>
            {mine && <button type="button" className="btn btn-p" disabled={!ready} title={!reason.trim() ? 'اكتب السبب' : !file ? 'أرفق مستند الإغلاق' : undefined} onClick={submit}>افتح الإغلاق المباشر</button>}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
