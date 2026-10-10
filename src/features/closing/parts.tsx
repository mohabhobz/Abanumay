import { useState } from 'react'
import { DateText, Glass, Head, Icon, KV, Money, MoneyField, Num, Person, Select, Tag, icons } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { isolate, nf } from '@/lib/format'
import { CLOSE_DOCS, closeStageLabel, reportApproved } from '@/data/mock/closing'
import {
  CLOSE_RULES, DECISION_SAY, ESCALATION_STEPS, FEEDBACK_ITEMS, RELEASE_SAY, decideRecovery, escalateRecovery,
  failRecovery, openSavingsRecovery, paidToDate, recordReceipt, recoveryLeft, requirementsOf, savingsOf,
  sendFeedback, useClosing, verifyInvoices,
} from '@/data/closing/store'
import { settleSlot, unsettledSlots } from '@/data/payments/store'
import type { CloseRow, CloseSnapshot, FinalReport, Recovery } from '@/types/domain'

/* Closing parts (BPD-010) · the cards the closing page and the distress page share.

   · the final financial report and the invoices check, with the savings it leaves (10.1.input-3 ·
     10.9.7)
   · the financial and administrative requirements, each named, and the unpaid payments the
     supervisor settles instead of paying (10.4.2 · 10.4.8 · 10.4.18)
   · a recovery · receipts with their reference and proof, what's left, the claims and escalation
     when it can't be recovered, and the CEO's final decision (10.9.2 – 10.9.9)
   · the entity's evaluation of the foundation (10.3.2)
   · versions with their content · a previous one is read and compared field by field (10.4.15 ·
     10.4.19) */

const Err = ({ list }: { list: string[] }) => <>{list.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}</>

/* ── The final financial report · 10.1.input-3 · 10.9.7 ── */

export function FinanceCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const f = c.finance
  const paid = paidToDate(c.projectId)
  const sav = savingsOf(c)
  const mayVerify = !asEntity && role.key === 'supervisor' && c.stage !== 'closed'
  return (
    <Glass>
      <Head
        title="التقرير المالي والتسوية"
        meta={f?.verified != null ? <Tag tone="ok">تحقّق المشرف من الفواتير</Tag> : <Tag tone="warn">الفواتير لم تُطابَق بعد</Tag>}
      />
      <KV
        rows={[
          ...(f?.lines ?? []).map((l) => ({
            k: `${l.label} · المعتمد ${nf.format(l.approved)}`,
            v: l.spent === null ? <span className="sub">لم يُدخل بعد</span> : <span className={l.spent > l.approved ? 'bad' : undefined}><Num>{l.spent}</Num></span>,
          })),
          { k: 'المصروف للجهة حتى الآن', v: <Money sm>{paid}</Money> },
          { k: 'الفواتير المتحقَّق منها', v: f?.verified == null ? <span className="sub">لم يتحقّق المشرف بعد</span> : <><Money sm>{f.verified}</Money>{f.verifiedBy && <span className="sub"> · {f.verifiedBy}</span>}</> },
          { k: 'الوفر المستحق الاسترداد', v: sav > 0 ? <b className="bad"><Money sm>{sav}</Money></b> : <span className="sub">لا وفر</span> },
        ]}
      />
      {f?.settlements && <div className="payq-cond"><span className="lb">التسويات المالية</span><span>{isolate(f.settlements)}</span></div>}
      {mayVerify && (
        <div className="apv-row mt-3">
          <MoneyField value={amount} onChange={setAmount} label="مبلغ الفواتير المتحقَّق منها" placeholder={c.report.budget !== null ? nf.format(c.report.budget) : '0'} />
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المطابقة · اختيارية" aria-label="ملاحظة مطابقة الفواتير" /></span>
          <button type="button" className="btn btn-2 btn-sm" disabled={amount === ''} onClick={() => { const out = verifyInvoices(c.id, Number(amount), note, user.name); setBad(out); if (!out.length) { setAmount(''); setNote('') } }}>
            طابِق الفواتير
          </button>
        </div>
      )}
      {sav > 0 && !c.recovery && mayVerify && (
        <div className="act-a">
          <button type="button" className="btn btn-p btn-sm" onClick={() => setBad(openSavingsRecovery(c.id, user.name))}>طالب الجهة بإعادة الوفر</button>
        </div>
      )}
      <Err list={bad} />
      <p className="sub cnote">
        يطابق المشرف الفواتير بالمبلغ المصروف · وما صُرف ولم تغطِّه الفواتير وفرٌ تُطالَب الجهة بإعادته،
        ويعود مع المحجوز غير المصروف إلى مخصص المجال (<bdi>{/* doc 10.9.7 */}</bdi>).
      </p>
    </Glass>
  )
}

/* ── The requirements of final closing · 10.4.8 · 10.4.18 · 10.4.2 ── */

export function RequirementsCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [note, setNote] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const req = requirementsOf(c)
  const miss = req.filter((x) => !x.ok).length
  const slots = unsettledSlots(c.projectId)
  const open = [...slots.due, ...slots.future].filter((s) => s.state !== 'pending')
  const maySettle = !asEntity && role.key === 'supervisor' && c.stage !== 'closed'
  return (
    <Glass>
      <Head title="المتطلبات المالية والإدارية" meta={c.stage === 'closed' ? <Tag tone="ok">اكتملت</Tag> : miss ? <Tag tone="warn"><Num>{miss}</Num> غير مستوفى</Tag> : <Tag tone="ok">مستوفاة</Tag>} />
      <ul className="payq-ck">
        {req.map((x) => (
          <li key={x.key} className={x.ok || c.stage === 'closed' ? 'ok' : 'no'}>
            <Icon name={x.ok || c.stage === 'closed' ? icons.check : icons.alert} size="sm" />
            <span>{x.label}</span>
            <span className="payq-r">{x.say}</span>
          </li>
        ))}
      </ul>
      {maySettle && open.length > 0 && (
        <>
          <p className="sub cnote">الدفعات التي لم تُصرف تُسوّى بقرار بدل صرفها، ويُحرَّر محجوزها عند الإغلاق (<bdi>{/* doc 10.4.2 */}</bdi>):</p>
          <div className="apv-row mt-2">
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التسوية · إلزامي" aria-label="سبب تسوية الدفعة" /></span>
            {open.map((s) => (
              <button key={s.no} type="button" className="btn btn-2 btn-sm" disabled={!note.trim()} onClick={() => { const out = settleSlot(c.projectId, s.no, note, user.name); setBad(out); if (!out.length) setNote('') }}>
                سوِّ الدفعة <Num>{s.no}</Num>
              </button>
            ))}
          </div>
        </>
      )}
      <Err list={bad} />
      <p className="sub cnote">لا يتحوّل المشروع إلى «مكتمل» قبل اعتماد التقرير والتقييم واستيفاء هذه كلها معًا · القاعدتان 8 و18.</p>
    </Glass>
  )
}

/* ── A recovery · 10.9.2 – 10.9.9 ── */

const REC_SAY: Record<Recovery['state'], { label: string; tone: 'warn' | 'ok' | 'no' | 'mute' }> = {
  open: { label: 'استرداد جارٍ', tone: 'warn' },
  done: { label: 'اكتمل الاسترداد', tone: 'ok' },
  failed: { label: 'تعذّر الاسترداد · مصعَّد', tone: 'no' },
  decided: { label: 'بقرار نهائي', tone: 'mute' },
}

export function RecoveryCard({ rec, owner, asEntity }: { rec: Recovery; owner: { kind: 'close' | 'case'; id: string }; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [file, setFile] = useState('')
  const [claim, setClaim] = useState('')
  const [claimFile, setClaimFile] = useState('')
  const [step, setStep] = useState<string | undefined>()
  const [stepText, setStepText] = useState('')
  const [kind, setKind] = useState<string | undefined>()
  const [decision, setDecision] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const got = rec.receipts.reduce((s, x) => s + x.amount, 0)
  const left = recoveryLeft(rec)
  const staff = !asEntity && (role.key === 'supervisor' || role.key === 'ceo' || role.key === 'finance')
  const receiving = rec.state === 'open' || rec.state === 'failed' || (rec.state === 'decided' && rec.decision?.kind === 'installments')
  const done = (out: string[], reset: () => void) => { setBad(out); if (!out.length) reset() }

  return (
    <Glass>
      <Head title="استرداد المبالغ" meta={<Tag tone={REC_SAY[rec.state].tone}>{REC_SAY[rec.state].label}</Tag>} />
      <KV
        rows={[
          { k: 'المطالَب بإعادته', v: <Money sm>{rec.due}</Money> },
          { k: 'السبب', v: rec.reason },
          { k: 'المستلم', v: <Money sm>{got}</Money> },
          { k: left > 0 && rec.state === 'decided' ? 'الرصيد غير المسترد' : 'المتبقي', v: left > 0 ? <b className="bad"><Money sm>{left}</Money></b> : <span className="ok-ink">لا شيء</span> },
          { k: 'المحرَّر إلى مخصص المجال', v: <><Money sm>{rec.released}</Money> <span className="sub">· {RELEASE_SAY[CLOSE_RULES.releaseMode]}</span></> },
        ]}
      />

      {rec.receipts.length > 0 && (
        <>
          <h4 className="fnd-h">عمليات الاسترداد</h4>
          <ul className="apv-list">
            {rec.receipts.map((x) => (
              <li key={x.id}>
                <span className="apv-t"><b><Num>{x.amount}</Num> ريال · مرجع {x.ref}</b><span className="sub">{x.file}</span></span>
                <span className="pc-sp" />
                <Tag tone="ok">مطابَق</Tag>
                <span className="sub"><DateText>{x.at}</DateText></span>
              </li>
            ))}
          </ul>
        </>
      )}

      {staff && receiving && left > 0 && (
        <div className="apv-row mt-3">
          <MoneyField value={amount} onChange={setAmount} label="المبلغ المستلم" />
          <span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="مرجع التحويل للمطابقة" aria-label="مرجع التحويل" /></span>
          <UploadButton label="إشعار التحويل" onPick={(f) => setFile(f.name)} />
          <button type="button" className="btn btn-2 btn-sm" disabled={!amount || !ref.trim() || !file} onClick={() => done(recordReceipt(owner, Number(amount), ref, file, user.name), () => { setAmount(''); setRef(''); setFile('') })}>
            سجّل الاستلام
          </button>
        </div>
      )}
      {file && receiving && <p className="sub cnote">الإشعار: {file}</p>}

      {/* 10.9.9 · when it can't be recovered · the claims are proven, then escalated */}
      {staff && rec.state === 'open' && left > 0 && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="المطالبات المرسلة وردّ الجهة" aria-label="إثبات المطالبات" /></span>
          <UploadButton label="مستند المطالبة" onPick={(f) => setClaimFile(f.name)} />
          <button type="button" className="btn btn-2 btn-sm" disabled={!claim.trim()} onClick={() => done(failRecovery(owner, claim, user.name, claimFile || undefined), () => { setClaim(''); setClaimFile('') })}>
            تعذّر الاسترداد · أثبت المطالبة
          </button>
        </div>
      )}
      {rec.claims.length > 0 && (
        <>
          <h4 className="fnd-h">المطالبات المثبتة</h4>
          <ul className="apv-list">
            {rec.claims.map((x, i) => (
              <li key={i}><span className="apv-t"><b>{isolate(x.text)}</b>{x.file && <span className="sub">{x.file}</span>}</span><span className="pc-sp" /><Person name={x.by} /><span className="sub"><DateText>{x.at}</DateText></span></li>
            ))}
            {rec.escalations.map((x, i) => (
              <li key={`e${i}`}><span className="apv-t"><b>تصعيد · {x.step}</b>{x.text && <span className="sub">{isolate(x.text)}</span>}</span><span className="pc-sp" /><Person name={x.by} /><span className="sub"><DateText>{x.at}</DateText></span></li>
            ))}
          </ul>
        </>
      )}
      {staff && rec.state === 'failed' && (
        <div className="apv-row mt-3">
          <Select value={step} all="خطوة التصعيد" options={ESCALATION_STEPS.map((x) => ({ value: x, label: x }))} onChange={setStep} />
          <span className="fld"><input value={stepText} onChange={(e) => setStepText(e.target.value)} placeholder="تفاصيل الخطوة" aria-label="تفاصيل التصعيد" /></span>
          <button type="button" className="btn btn-2 btn-sm" disabled={!step} onClick={() => done(escalateRecovery(owner, step ?? '', stepText, user.name), () => { setStep(undefined); setStepText('') })}>صعِّد</button>
        </div>
      )}
      {!asEntity && role.key === 'ceo' && rec.state === 'failed' && (
        <div className="apv-row mt-3">
          <Select value={kind} all="القرار النهائي" options={Object.entries(DECISION_SAY).map(([value, label]) => ({ value, label }))} onChange={setKind} />
          <span className="fld"><input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="نص القرار" aria-label="نص القرار النهائي" /></span>
          <button type="button" className="btn btn-p btn-sm" disabled={!kind || !decision.trim()} onClick={() => done(decideRecovery(owner, kind as never, decision, user.name, role.key), () => { setKind(undefined); setDecision('') })}>اعتمد القرار</button>
        </div>
      )}
      {rec.decision && (
        <div className="payq-cond"><span className="lb">القرار النهائي · {DECISION_SAY[rec.decision.kind]}</span><span>{isolate(rec.decision.text)} · {rec.decision.by}</span></div>
      )}
      <Err list={bad} />
      {asEntity && left > 0 && receiving && (
        <p className="sub cnote">حوّل المبلغ المتبقي إلى حساب المؤسسة وأرسل إشعار التحويل لمشرف المنح · يُسجَّل كل مبلغ ويُطابَق حتى اكتمال الاسترداد.</p>
      )}
    </Glass>
  )
}

/* ── The entity's evaluation of the foundation · 10.3.2 ── */

export function FeedbackCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { user } = useRole()
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const fb = c.feedback
  const can = asEntity && !fb && reportApproved(c)
  if (!fb && !can && asEntity) return null
  return (
    <Glass>
      <Head title="تقييم الجهة للمؤسسة" meta={fb ? <Tag tone="ok">أرسلته الجهة</Tag> : <Tag tone="mute">لم يُرسل بعد</Tag>} />
      {fb && (
        <>
          <KV rows={FEEDBACK_ITEMS.map((x) => ({ k: x.label, v: <><Num>{fb.scores[x.key] ?? 0}</Num> <span className="sub">من 5</span></> }))} />
          {fb.comment && <div className="payq-cond"><span className="lb">ملاحظات الجهة</span><span>{isolate(fb.comment)}</span></div>}
        </>
      )}
      {can && (
        <>
          <div className="regfields">
            {FEEDBACK_ITEMS.map((x) => (
              <label key={x.key} className="regf">
                <span className="lb">{x.label}</span>
                <Select value={scores[x.key] ? String(scores[x.key]) : undefined} all="اختر من 5" allowEmpty={false} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} onChange={(v) => setScores((s) => ({ ...s, [x.key]: Number(v) }))} />
              </label>
            ))}
          </div>
          <label className="regf">
            <span className="lb">ملاحظاتكم</span>
            <span className="fld"><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="ملاحظات الجهة على المؤسسة" /></span>
          </label>
          <div className="act-a">
            <button type="button" className="btn btn-p btn-sm" disabled={FEEDBACK_ITEMS.some((x) => !scores[x.key])} onClick={() => setBad(sendFeedback(c.id, scores, comment, c.entityName || user.name))}>أرسل التقييم</button>
          </div>
        </>
      )}
      {!fb && !asEntity && <p className="sub cnote">تقيّم الجهة المؤسسة بعد اعتماد تقريرها الختامي، ويُعدّ من المتطلبات الإدارية للإغلاق.</p>}
      <Err list={bad} />
    </Glass>
  )
}

/* ── Versions with their content · 10.4.15 · 10.4.19 ── */

const FIELD_SAY: { key: keyof FinalReport; label: string }[] = [
  { key: 'beneficiaries', label: 'المستفيدون' },
  { key: 'budget', label: 'الميزانية الفعلية' },
  { key: 'days', label: 'مدة التنفيذ' },
  { key: 'outcomes', label: 'المخرجات' },
  { key: 'risks', label: 'التحديات' },
]
const say = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? nf.format(v) : String(v))

function diffOf(s: CloseSnapshot, c: CloseRow): { label: string; was: string; now: string }[] {
  if (s.report) {
    const out = FIELD_SAY.filter((f) => s.report![f.key] !== c.report[f.key]).map((f) => ({ label: f.label, was: say(s.report![f.key]), now: say(c.report[f.key]) }))
    const added = c.report.docs.filter((d) => !s.report!.docs.includes(d))
    if (added.length) out.push({ label: 'المرفقات', was: `${s.report.docs.length}`, now: `${c.report.docs.length} · أُضيف ${added.map((k) => CLOSE_DOCS.find((d) => d.key === k)?.label ?? k).join('، ')}` })
    return out
  }
  if (s.evaluation && c.evaluation) {
    const out: { label: string; was: string; now: string }[] = []
    s.evaluation.indicators.forEach((i, n) => { const now = c.evaluation!.indicators[n]; if (now && now.actual !== i.actual) out.push({ label: i.name, was: say(i.actual), now: say(now.actual) }) })
    if (s.evaluation.impact !== c.evaluation.impact) out.push({ label: 'الأثر', was: say(s.evaluation.impact), now: say(c.evaluation.impact) })
    if (s.evaluation.lessons !== c.evaluation.lessons) out.push({ label: 'الدروس', was: say(s.evaluation.lessons), now: say(c.evaluation.lessons) })
    if (s.evaluation.score !== c.evaluation.score) out.push({ label: 'التقدير', was: say(s.evaluation.score), now: say(c.evaluation.score) })
    return out
  }
  return []
}

export function VersionsCard({ c }: { c: CloseRow }) {
  useClosing()
  const [open, setOpen] = useState<string>('')
  const snaps = c.snapshots ?? []
  const rows = [
    ...c.versions.map((v) => ({ cycle: 'report' as const, ...v })),
    ...c.evalVersions.map((v) => ({ cycle: 'eval' as const, ...v })),
  ]
  return (
    <Glass>
      <Head title="الإصدارات" meta={<span className="sub"><Num>{c.versions.length}</Num> للتقرير · <Num>{c.evalVersions.length}</Num> للتقييم</span>} />
      <ul className="apv-list">
        {rows.map((v) => {
          const key = `${v.cycle}-${v.no}`
          const snap = snaps.find((s) => s.cycle === v.cycle && s.no === v.no)
          const d = snap ? diffOf(snap, c) : []
          return (
            <li key={key}>
              <span className="apv-t">
                <b>{v.cycle === 'report' ? 'التقرير' : 'التقييم'} · الإصدار <Num>{v.no}</Num></b>
                <span className="sub">{v.say} · {v.by} · <DateText>{v.at}</DateText></span>
                {open === key && snap && (
                  d.length
                    ? <span className="sub">{d.map((x) => `${x.label}: كان ${x.was} · صار ${x.now}`).join(' | ')}</span>
                    : <span className="sub">لا فرق عن الحالي</span>
                )}
              </span>
              <span className="pc-sp" />
              {snap && (
                <button type="button" className="btn btn-2 btn-sm" onClick={() => setOpen(open === key ? '' : key)}>
                  {open === key ? 'أخفِ المقارنة' : 'قارِن بالحالي'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sub cnote">كل إعادة تُنشئ إصدارًا جديدًا ويُحفظ محتوى السابق ليُقرأ ويُقارَن · وللتقييم إصداراته المستقلة (القاعدتان 15 و19).</p>
    </Glass>
  )
}

/** The two logs side by side · rule 17 keeps the cycles' notes and decisions apart */
export function LogsCard({ c }: { c: CloseRow }) {
  useClosing()
  const part = (title: string, list: CloseRow['audit']) => (
    <>
      <h4 className="fnd-h">{title}</h4>
      {list.length ? (
        <ul className="plchg">
          {list.map((a, i) => (
            <li key={`${a.at}-${i}`}>
              <div className="plchg-h"><Tag tone="mute"><DateText>{a.at}</DateText></Tag><span className="sub">{a.by}</span></div>
              <p className="plchg-t">{isolate(a.what)}</p>
            </li>
          ))}
        </ul>
      ) : <p className="sub cnote">لا قيود بعد.</p>}
    </>
  )
  return (
    <Glass>
      <Head title="سجلّ الإجراء" meta={<span className="sub">سجلّان منفصلان{/* doc rule 17 */} · الآن: {closeStageLabel(c.stage)}</span>} />
      {part('دورة التقرير الختامي', c.audit)}
      {part('دورة تقييم المشروع', c.evalAudit ?? [])}
      <p className="sub cnote">تمنع القواعد {/* doc rule 21 */} أي تعديل بعد الإغلاق النهائي · وأي تغيير بعده إجراء جديد.</p>
    </Glass>
  )
}
