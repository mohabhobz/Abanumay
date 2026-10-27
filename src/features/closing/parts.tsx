import { holds } from '@/data/shared/decisions'
import { useState } from 'react'
import { FormField, FieldBox, Button, DockActions, DateText, Glass, Head, Icon, KV, Money, MoneyField, Num, Person, Select, Tabs, Tag, icons } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { useRole } from '@/hooks/useRole'
import { isolate, nf } from '@/lib/format'
import { CLOSE_DOCS, reportApproved } from '@/data/mock/closing'
import {
  CLOSE_RULES, DECISION_SAY, ESCALATION_STEPS, FEEDBACK_ITEMS, RELEASE_SAY, decideRecovery, escalateRecovery,
  failRecovery, openSavingsRecovery, paidToDate, recordReceipt, recoveryLeft, requirementsOf, savingsOf, savingsDue, caseSettled, finLinesTotal, evalScore,
  mayRedirect, redirectBase, redirectSupport, sendFeedback, useClosing, verifyInvoices,
  closeSayOf, EXC_FIELDS, mayException, recordException, type ExcField, mayReopen, reopenClosing,
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
  const [bad, setBad] = useState<string[]>([])
  const f = c.finance
  const paid = paidToDate(c.projectId)
  const sav = savingsOf(c)
  const due = savingsDue(c)
  const settled = caseSettled(c.projectId)
  /* v3 · 10.4.6 · the spend is approved at the supervisor's review · locked once the report goes on */
  const mayVerify = !asEntity && role.key === 'supervisor' && c.stage === 'supervisor'
  const mayClaim = !asEntity && role.key === 'supervisor' && c.stage !== 'closed'
  return (
    <Glass>
      <Head
        title="المصروف والتسوية"
        meta={f?.verified != null ? <Tag tone="ok">اعتمد المشرف المصروف</Tag> : <Tag tone="warn">لم يُعتمد المصروف بعد</Tag>}
      />
      <KV
        rows={[
          ...(f?.lines ?? []).map((l) => ({
            k: `${l.label} · المعتمد ${nf.format(l.approved)}`,
            v: l.spent === null ? <span className="sub">لم يُدخل بعد</span> : <span className={l.spent > l.approved ? 'bad' : undefined}><Num>{l.spent}</Num></span>,
          })),
          { k: 'المصروف للجهة حتى الآن', v: <Money sm>{paid}</Money> },
          ...(settled > 0 ? [{ k: 'سُوّي بقرار الحالة (استرداد أو توجيه)', v: <Money sm>{settled}</Money> }] : []),
          { k: 'المصروف المعتمد من التقرير المالي', v: f?.verified == null ? <span className="sub">لم يعتمده المشرف بعد</span> : <><Money sm>{f.verified}</Money>{f.verifiedBy && <span className="sub"> · {f.verifiedBy}</span>}</> },
          { k: 'الوفر المستحق الاسترداد', v: due > 0 ? <b className="bad"><Money sm>{due}</Money></b> : sav > 0 ? <span className="sub">أُعيد توجيهه بقرار</span> : <span className="sub">لا وفر</span> },
          /* Client 21 Oct (#6) · no settlements text · the two cost figures live in the report's table */
        ]}
      />
      {mayVerify && (
        <div className="apv-row mt-3">
          <MoneyField value={amount} onChange={setAmount} label="المصروف الفعلي المعتمد" placeholder={nf.format(finLinesTotal(c))} />
          {/* Client 26 Oct · the decision confirms in its popup · its note there */}
          <DockActions
            actions={[{ label: 'اعتمد المصروف', kind: 'btn-2 btn-sm', stops: amount === '' ? ['اكتب المصروف الفعلي المعتمد أولًا'] : [] }]}
            subject={<>{c.projectName} · المصروف الفعلي {nf.format(Number(amount) || 0)} ريال</>}
            onRun={(_x, n) => { const out = verifyInvoices(c.id, Number(amount), n, user.name); setBad(out); if (!out.length) setAmount(''); return out }}
          />
        </div>
      )}
      {due > 0 && !c.recovery && mayClaim && (
        <div className="act-a">
          <Button type="button" variant="p" size="sm" onClick={() => setBad(openSavingsRecovery(c.id, user.name))}>طالب الجهة بإعادة الوفر</Button>
        </div>
      )}
      <Err list={bad} />
    </Glass>
  )
}

/* ── v3 · 10.4.32 · after the final closing · read and archive · a change only by a documented exception ── */

export function ExceptionCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [field, setField] = useState<ExcField | undefined>()
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [decision, setDecision] = useState('')
  const [file, setFile] = useState('')
  const [bad, setBad] = useState<string[]>([])
  if (c.stage !== 'closed') return null
  const may = !asEntity && mayException(c, role.key)
  const list = c.exceptions ?? []
  if (!may && !list.length) return null
  return (
    <Glass>
      <Head title="المشروع مغلق · للقراءة والأرشفة" meta={list.length ? <Tag tone="warn"><Num>{list.length}</Num> تعديل استثنائي</Tag> : <Tag tone="mute">بلا تعديل</Tag>} />
      {list.length > 0 && (
        <ul className="apv-list">
          {list.map((x, i) => (
            <li key={i}><span className="apv-t"><b>{x.field}: {x.was || '—'} ← {x.now}</b><span className="sub">{x.reason} · القرار {x.decision} · {x.file} · <Person name={x.by} /> ({x.role}) · <DateText>{x.at}</DateText></span></span></li>
          ))}
        </ul>
      )}
      {may && (
        <>
          <div className="regfields">
            <FormField label="الحقل"><Select value={field} all="اختر الحقل" allowEmpty={false} options={EXC_FIELDS.map((x) => ({ value: x.key, label: x.label }))} onChange={(v) => setField(v as ExcField)} /></FormField>
            <FormField label="القيمة الجديدة"><FieldBox><input value={value} onChange={(e) => setValue(e.target.value)} aria-label="القيمة الجديدة" /></FieldBox></FormField>
            <FormField label="سبب التعديل"><FieldBox><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب التعديل الاستثنائي" /></FieldBox></FormField>
            <FormField label="رقم القرار"><FieldBox><input value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="رقم قرار التعديل" /></FieldBox></FormField>
          </div>
          <div className="apv-row mt-2">
            <span className="sub">{file || 'مستند القرار · إلزامي'}</span>
            <UploadButton label="مستند القرار" onPick={(f) => setFile(f.name)} />
            <Button type="button" variant="2" size="sm" onClick={() => { if (!field) { setBad(['اختر الحقل']); return } const out = recordException(c.id, { field, value, reason, decision, file }, user.name, role.key); setBad(out); if (!out.length) { setValue(''); setReason(''); setDecision(''); setFile('') } }}>سجّل التعديل الاستثنائي</Button>
          </div>
        </>
      )}
      <Err list={bad} />
    </Glass>
  )
}

/* ── Client 21 Oct (#16) · reopening a closed project · a dedicated permission and a recorded reason ── */

export function ReopenCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [bad, setBad] = useState<string[]>([])
  if (asEntity || !mayReopen(c, role.key)) return null
  return (
    <Glass>
      <Head title="إعادة فتح المشروع" meta={<Tag tone="mute">صلاحية {role.title}</Tag>} />
      <div className="apv-row">
        {/* Client 26 Oct · the reason in the decision's popup */}
        <DockActions
          actions={[{ label: 'أعد فتح المشروع', kind: 'btn-2 btn-sm', needsNote: true }]}
          subject={<>{c.projectName} · تُعاد دورة التقرير ويبقى الإغلاق السابق إصدارًا محفوظًا</>}
          placeholder="سبب إعادة الفتح"
          onRun={(_x, n) => { const out = reopenClosing(c.id, n, user.name, role.key); setBad(out); return out }}
        />
      </div>
      <Err list={bad} />
    </Glass>
  )
}

/* ── The requirements of final closing · 10.4.8 · 10.4.18 · 10.4.2 ── */

export function RequirementsCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
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
          <div className="apv-row mt-2">
            {/* Client 26 Oct · the reason in the decision's popup */}
            <DockActions
              actions={open.map((s) => ({ label: `سوِّ الدفعة ${s.no}`, kind: 'btn-2 btn-sm', needsNote: true, no: s.no }))}
              subject={<>{c.projectName} · تُسوّى بقرار بدل صرفها ويُحرَّر محجوزها عند الإغلاق</>}
              placeholder="سبب التسوية"
              onRun={(x, n) => { const out = settleSlot(c.projectId, x.no, n, user.name); setBad(out); return out }}
            />
          </div>
        </>
      )}
      <Err list={bad} />
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
  /* Client 18 Oct (sheet V2 · #42) · each step carries its supporting document */
  const [stepFile, setStepFile] = useState('')
  const [decFile, setDecFile] = useState('')
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
        <div className="apv-row mt-3 recrow">
          <MoneyField value={amount} onChange={setAmount} label="المبلغ المستلم" />
          <FieldBox><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="مرجع التحويل للمطابقة" aria-label="مرجع التحويل" /></FieldBox>
          <UploadButton label="إشعار التحويل" onPick={(f) => setFile(f.name)} />
          <Button type="button" variant="2" size="sm" disabled={!amount || !ref.trim() || !file} onClick={() => done(recordReceipt(owner, Number(amount), ref, file, user.name), () => { setAmount(''); setRef(''); setFile('') })}>
            سجّل الاستلام
          </Button>
        </div>
      )}
      {file && receiving && <p className="sub cnote">الإشعار: {file}</p>}

      {/* 10.9.9 · when it can't be recovered · the claims are proven, then escalated */}
      {staff && rec.state === 'open' && left > 0 && (
        <div className="apv-row mt-3 recrow">
          <FieldBox><input value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="المطالبات المرسلة وردّ الجهة" aria-label="إثبات المطالبات" /></FieldBox>
          <UploadButton label="مستند المطالبة" onPick={(f) => setClaimFile(f.name)} />
          <Button type="button" variant="2" size="sm" disabled={!claim.trim() || !claimFile} title={claimFile ? undefined : 'ارفع إثبات المطالبات المرسلة'} onClick={() => done(failRecovery(owner, claim, user.name, claimFile || undefined, role.key), () => { setClaim(''); setClaimFile('') })}>
            تعذّر الاسترداد · أثبت المطالبة
          </Button>
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
              <li key={`e${i}`}><span className="apv-t"><b>تصعيد · {x.step}</b>{x.text && <span className="sub">{isolate(x.text)}</span>}{x.file && <span className="sub">{x.file}</span>}</span><span className="pc-sp" /><Person name={x.by} /><span className="sub"><DateText>{x.at}</DateText></span></li>
            ))}
          </ul>
        </>
      )}
      {staff && rec.state === 'failed' && (
        <div className="apv-row mt-3">
          <Select value={step} all="خطوة التصعيد" options={ESCALATION_STEPS.map((x) => ({ value: x, label: x }))} onChange={setStep} />
          <FieldBox><input value={stepText} onChange={(e) => setStepText(e.target.value)} placeholder="تفاصيل الخطوة" aria-label="تفاصيل التصعيد" /></FieldBox>
          <UploadButton label={stepFile || 'مستند الخطوة'} onPick={(f) => setStepFile(f.name)} />
          <Button type="button" variant="2" size="sm" disabled={!step || !stepFile} title={stepFile ? undefined : 'ارفع مستند خطوة التصعيد'} onClick={() => done(escalateRecovery(owner, step ?? '', stepText, user.name, stepFile, role.key), () => { setStep(undefined); setStepText(''); setStepFile('') })}>صعِّد</Button>
        </div>
      )}
      {!asEntity && holds('recoveryBy', role.key) && rec.state === 'failed' && (
        <div className="apv-row mt-3">
          <Select value={kind} all="القرار النهائي" options={Object.entries(DECISION_SAY).map(([value, label]) => ({ value, label }))} onChange={setKind} />
          <FieldBox><input value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="نص القرار" aria-label="نص القرار النهائي" /></FieldBox>
          <UploadButton label={decFile || 'مستند القرار'} onPick={(f) => setDecFile(f.name)} />
          <Button type="button" variant="p" size="sm" disabled={!kind || !decision.trim() || !decFile} title={decFile ? undefined : 'ارفع مستند القرار'} onClick={() => done(decideRecovery(owner, kind as never, decision, user.name, role.key, decFile), () => { setKind(undefined); setDecision(''); setDecFile('') })}>اعتمد القرار</Button>
        </div>
      )}
      {rec.decision && (
        <div className="payq-cond"><span className="lb">القرار النهائي · {DECISION_SAY[rec.decision.kind]}</span><span>{isolate(rec.decision.text)} · {rec.decision.by}{rec.decision.file ? ` · ${rec.decision.file}` : ''}</span></div>
      )}
      <Err list={bad} />
    </Glass>
  )
}

/* ── The entity's evaluation of the foundation · 10.3.2 ── */

/* ── v3 · 0.status.9 · 10.9.7 · redirecting the support within the same relationship ── */

export function RedirectCard({ c, asEntity }: { c: CloseRow; asEntity: boolean }) {
  useClosing()
  const { role, user } = useRole()
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [decision, setDecision] = useState('')
  const [file, setFile] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [bad, setBad] = useState<string[]>([])
  const r = c.redirect
  if (!r && (asEntity || !mayRedirect(role.key, c.projectId) || c.stage === 'closed')) return null
  const b = redirectBase(c)
  return (
    <Glass>
      <Head title="إعادة توجيه الدعم" meta={r ? <Tag tone="ok">بقرار معتمد</Tag> : undefined} />
      {r ? (
        <KV
          rows={[
            { k: 'المبلغ الأصلي', v: <Money sm>{r.original}</Money> },
            { k: 'المستخدم', v: <Money sm>{r.used}</Money> },
            { k: 'المعاد توجيهه', v: <Money sm>{r.redirected}</Money> },
            { k: 'الغرض', v: r.purpose },
            { k: 'القرار', v: <>{r.decision} · {r.decisionFile}</> },
            { k: 'الشواهد', v: r.evidence.join('، ') },
            { k: 'سجّله', v: <><Person name={r.by} /> · <DateText>{r.at}</DateText></> },
          ]}
        />
      ) : (
        <>
          <KV rows={[{ k: 'المبلغ الأصلي', v: <Money sm>{b.original}</Money> }, { k: 'المستخدم', v: <Money sm>{b.used}</Money> }, { k: 'الحد الأقصى للتوجيه', v: c.finance?.verified == null ? <span className="sub">بعد اعتماد المصروف الفعلي</span> : <Money sm>{b.max}</Money> }]} />
          <div className="apv-row mt-3">
            <MoneyField value={amount} onChange={setAmount} label="المبلغ المعاد توجيهه" />
            <FieldBox><input value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="الغرض الجديد" placeholder="الغرض الجديد داخل العلاقة نفسها" /></FieldBox>
            <FieldBox><input value={decision} onChange={(e) => setDecision(e.target.value)} aria-label="رقم القرار" placeholder="رقم القرار" /></FieldBox>
          </div>
          <div className="apv-row mt-2">
            <UploadButton label={file || 'مستند القرار'} onPick={(f) => setFile(f.name)} />
            <UploadButton label="شاهد" onPick={(f) => setEvidence((x) => [...x, f.name])} />
            {evidence.length > 0 && <span className="sub">{evidence.join('، ')}</span>}
            <Button type="button" variant="p" size="sm" onClick={() => setBad(redirectSupport(c.id, { redirected: Number(amount.replace(/[^\d]/g, '')) || 0, purpose, decision, decisionFile: file, evidence }, user.name, role.key))}>اعتمد إعادة التوجيه</Button>
          </div>
          <Err list={bad} />
        </>
      )}
    </Glass>
  )
}

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
      <Head title="تقييم الجهة للمؤسسة" meta={fb ? <Tag tone="ok">أرسلته الجهة</Tag> : <Tag tone="mute">اختياري</Tag>} />
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
              <FormField key={x.key} label={x.label}>
                <Select value={scores[x.key] ? String(scores[x.key]) : undefined} all="اختر من 5" allowEmpty={false} options={['1', '2', '3', '4', '5'].map((v) => ({ value: v, label: v }))} onChange={(v) => setScores((s) => ({ ...s, [x.key]: Number(v) }))} />
              </FormField>
            ))}
          </div>
          <FormField label="ملاحظاتكم">
            <FieldBox><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="ملاحظات الجهة على المؤسسة" /></FieldBox>
          </FormField>
          <div className="act-a">
            <Button type="button" variant="p" size="sm" disabled={FEEDBACK_ITEMS.some((x) => !scores[x.key])} onClick={() => setBad(sendFeedback(c.id, scores, comment, c.entityName || user.name))}>أرسل التقييم</Button>
          </div>
        </>
      )}
      <Err list={bad} />
    </Glass>
  )
}

/* ── Versions with their content · 10.4.15 · 10.4.19 ── */

const FIELD_SAY: { key: keyof FinalReport; label: string }[] = [
  { key: 'beneficiaries', label: 'المستفيدون' },
  { key: 'budget', label: 'مبلغ دعم المؤسسة الفعلي' },
  { key: 'days', label: 'مدة التنفيذ' },
  { key: 'outcomes', label: 'المخرجات' },
  { key: 'risks', label: 'التحديات' },
  { key: 'projectValue', label: 'الميزانية الإجمالية الفعلية' },
  { key: 'contribution', label: 'مساهمة الجهة' },
]
const say = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? nf.format(v) : String(v))

function diffOf(s: CloseSnapshot, c: CloseRow): { label: string; was: string; now: string }[] {
  if (s.report) {
    const out = FIELD_SAY.filter((f) => s.report![f.key] !== c.report[f.key]).map((f) => ({ label: f.label, was: say(s.report![f.key]), now: say(c.report[f.key]) }))
    const outs = (r?: FinalReport) => (r?.outputs ?? []).map((x) => `${x.text}: ${x.achieved || '—'}`).join(' · ')
    if (outs(s.report) !== outs(c.report)) out.push({ label: 'المخرجات المتفق عليها والمحققة', was: outs(s.report) || '—', now: outs(c.report) || '—' })
    const files = (r: FinalReport) => Object.entries(r.files ?? {}).filter(([k, f]) => s.report!.docs.includes(k) && (s.report!.files ?? {})[k] !== f).map(([k]) => CLOSE_DOCS.find((d) => d.key === k)?.label ?? k)
    const swapped = files(c.report)
    if (swapped.length) out.push({ label: 'مرفقات مستبدلة', was: '', now: swapped.join('، ') })
    const added = c.report.docs.filter((d) => !s.report!.docs.includes(d))
    if (added.length) out.push({ label: 'المرفقات', was: `${s.report.docs.length}`, now: `${c.report.docs.length} · أُضيف ${added.map((k) => CLOSE_DOCS.find((d) => d.key === k)?.label ?? k).join('، ')}` })
    return out
  }
  if (s.evaluation && c.evaluation) {
    const out: { label: string; was: string; now: string }[] = []
    s.evaluation.indicators.forEach((i, n) => { const now = c.evaluation!.indicators[n]; if (now && now.actual !== i.actual) out.push({ label: i.name, was: say(i.actual), now: say(now.actual) }) })
    if (s.evaluation.impact !== c.evaluation.impact) out.push({ label: 'الأثر', was: say(s.evaluation.impact), now: say(c.evaluation.impact) })
    if (s.evaluation.lessons !== c.evaluation.lessons) out.push({ label: 'الدروس', was: say(s.evaluation.lessons), now: say(c.evaluation.lessons) })
    ;(s.evaluation.criteria ?? []).forEach((k) => { const now = c.evaluation!.criteria?.find((x) => x.key === k.key); if (now && now.rating !== k.rating) out.push({ label: `${k.label} (${nf.format(k.weight)})`, was: say(k.rating), now: say(now.rating) }) })
    const was = evalScore(s.evaluation)
    const nowScore = evalScore(c.evaluation)
    if (was !== nowScore) out.push({ label: 'الدرجة من 100', was: say(was), now: say(nowScore) })
    return out
  }
  return []
}

export function VersionsCard({ c }: { c: CloseRow }) {
  useClosing()
  const [open, setOpen] = useState<string>('')
  const [pane, setPane] = useState<'report' | 'eval'>('report')
  const snaps = c.snapshots ?? []
  /* Client 21 Oct (#12) · the standard of the plans · every version stays with its state and its files ·
     only the last one is active · a returned one reads «مُعاد» and an older closing «أعيد فتحه» */
  const list = pane === 'report' ? c.versions : c.evalVersions
  const stateOf = (no: number, n: number, sayNext?: string) =>
    no === n ? { tone: 'ok' as const, say: 'النسخة النشطة' }
      : sayNext?.startsWith('إعادة فتح') ? { tone: 'mute' as const, say: 'أُغلق ثم أعيد فتحه' }
        : { tone: 'warn' as const, say: 'مُعاد · محفوظ' }
  return (
    <Glass>
      <Head title="الإصدارات" />
      <Tabs
        items={[
          { slug: 'report', label: 'التقرير الختامي', count: c.versions.length },
          { slug: 'eval', label: 'التقييم', count: c.evalVersions.length },
        ]}
        active={pane}
        onChange={(x) => setPane(x === 'eval' ? 'eval' : 'report')}
      />
      {list.length === 0 && <p className="sub cnote">لا إصدارات للتقييم بعد.</p>}
      <ul className="apv-list">
        {[...list].reverse().map((v) => {
          const key = `${pane}-${v.no}`
          const snap = snaps.find((s) => s.cycle === pane && s.no === v.no)
          const d = snap ? diffOf(snap, c) : []
          const st = stateOf(v.no, list.length, list.find((x) => x.no === v.no + 1)?.say)
          const files = snap?.report ? [
            ...snap.report.docs.map((k) => snap.report!.files?.[k] ?? CLOSE_DOCS.find((x) => x.key === k)?.label ?? k),
            ...(snap.report.uploads ?? []).map((u) => u.name),
          ] : []
          return (
            <li key={key}>
              <span className="apv-t">
                <b>{pane === 'report' ? 'التقرير' : 'التقييم'} · الإصدار <Num>{v.no}</Num> <Tag tone={st.tone}>{st.say}</Tag></b>
                <span className="sub">{v.say} · {v.by} · <DateText>{v.at}</DateText></span>
                {files.length > 0 && <span className="sub">ملفات هذا الإصدار: {files.join('، ')}</span>}
                {open === key && snap && (
                  d.length
                    ? <span className="sub">{d.map((x) => `${x.label}: كان ${x.was} · صار ${x.now}`).join(' | ')}</span>
                    : <span className="sub">لا فرق عن النسخة النشطة</span>
                )}
              </span>
              <span className="pc-sp" />
              {snap && (
                <Button type="button" variant="2" size="sm" onClick={() => setOpen(open === key ? '' : key)}>
                  {open === key ? 'أخفِ المقارنة' : 'قارِن بالنشطة'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
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
      <Head title="سجلّ الإجراء" meta={<span className="sub">الآن: {closeSayOf(c)}</span>} />
      {part('دورة التقرير الختامي', c.audit)}
      {part('دورة تقييم المشروع', c.evalAudit ?? [])}
    </Glass>
  )
}
