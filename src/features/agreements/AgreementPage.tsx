import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { HEAT_TONE } from '@/lib/tone'
import {
  BackTo, CheckMark, DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  StepArc, Tag, type GateStep,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter } from '@/lib/format'
import { AGR_LIMIT, agrHeat, agrPaymentsBalance, agreementById } from '@/data/mock/agreements'
import { KINDS, TEMPLATES, toPayments, type DraftPay } from '@/data/mock/agreementNew'
import { useBudget } from '@/data/budget/store'
import {
  HOLDER_SAY, actOnAgreement, agrActions, agrFlowOf, agrHolder, agrIssues, agrReview, agrStageSay, agreementText,
  issuesOfRow, mayEdit, openNewVersion, reservedOf, saveAgreement, submitAgreement, useAgreements,
  type AgrAction, type Clause,
} from '@/data/agreements/store'
import type { AgreementKind, AgreementRow, PayDoc } from '@/types/domain'
import { AgrActionDock } from './AgrActionDock'
import { ScheduleEditor, asDraft } from './ScheduleEditor'
import { AgreementTextCard, AnnexesCard, ClausesCard, IssuesCard, ReviewCard, SignaturesCard, VersionsCard } from './parts'
import { EditableCard } from '@/features/shared/EditableCard'

/* A single agreement · every station of the flow on one screen (BPD-008).

   All of them read the same agreement · the same terms, the same schedule, the same log. What
   differs is who may act (`agrActions`) and who may edit (`mayEdit`): the supervisor edits a draft
   and an agreement returned to them (8.2.16); after signing nothing is edited, a change opens a new
   version (8.4.17). The entity opens the same page from its portal (`?as=entity`), reads the text
   and the schedule, and signs or returns it with notes (8.2.24 · 8.2.25).

   Returns don't have one path:
     manager's return   → supervisor (8.2.15)
     executive's return → grants manager, who sends it back up or down to the supervisor (8.2.19 – 8.2.22)
     entity's return    → supervisor (8.2.25)
   The stage changes the project only at the end · it stays «اعتماد الإتفاقية» until activation,
   and a cancelled agreement leaves it there (8.4.26 · 8.4.27). */

const LADDER: { key: string; label: string; note: string; cap: string; steps: number[] }[] = [
  { key: 'draft', label: 'إعداد الاتفاقية', note: 'مشرف المنح', cap: 'الإعداد', steps: [3, 12] },
  { key: 'manager', label: 'مراجعة مدير المنح', note: 'مدير المنح', cap: 'المراجعة', steps: [13] },
  { key: 'executive', label: 'اعتماد المدير التنفيذي', note: 'المدير التنفيذي', cap: 'الاعتماد', steps: [17] },
  { key: 'entity', label: 'توقيع الجهة', note: 'الجهة المستفيدة', cap: 'التوقيع', steps: [21] },
  { key: 'final', label: 'اعتماد ممثل المؤسسة', note: 'ممثل المؤسسة', cap: 'السريان', steps: [24] },
]

/** Which station the agreement is at · a return goes to whoever it was sent back to */
function nowAt(a: AgreementRow): string {
  const h = agrHolder(a)
  if (a.stage === 'returned') return h === 'grants-manager' ? 'manager' : 'draft'
  if (a.stage === 'entity') return agrFlowOf(a.id).entitySign ? 'final' : 'entity'
  return a.stage === 'active' || a.stage === 'cancelled' ? '' : a.stage
}

function ladderFor(a: AgreementRow): GateStep[] {
  const now = nowAt(a)
  const at = LADDER.findIndex((s) => s.key === now)
  const days = Math.round(a.hoursInStage / 24)
  const limit = AGR_LIMIT[a.stage]
  const mine = a.log.filter((e) => e.version === a.version)
  return LADDER.map((s, i): GateStep => {
    const last = [...mine].reverse().find((e) => s.steps.includes(e.step))
    if (s.key === now) {
      return {
        label: s.note, title: s.label, cap: s.cap, state: 'now',
        lines: [
          <>مفتوح منذ <b>{days}</b> {nounAfter(days, NOUN.day)}</>,
          limit > 0 ? <><b>{nf.format(a.hoursInStage)}</b> ساعة مقابل حدّ <b>{nf.format(limit)}</b></> : null,
        ],
        src: 'المصدر: سجل التدقيق',
      }
    }
    if (a.stage === 'active' || (at >= 0 && i < at)) {
      return {
        label: s.note, title: s.label, cap: s.cap, state: 'done',
        lines: [last ? <>{last.who} · <DateText>{last.at}</DateText></> : null, last ? isolate(last.what) : null],
        src: 'المصدر: سجل التدقيق',
      }
    }
    return { label: s.note, title: s.label, cap: s.cap, state: 'pending', lines: ['تبدأ بعد اكتمال المرحلة السابقة'], src: 'المصدر: مسار الاتفاقية' }
  })
}

export default function AgreementPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  useAgreements()
  useBudget()
  const a = agreementById(id)
  if (!a) {
    return (
      <AppLayout assistantContext={assistFor.page('الاتفاقيات')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الاتفاقيات" onClick={() => navigate(ROUTES.agreements)} />
            <Glass>
              <Empty
                title="الاتفاقية غير موجودة."
                note="ربما أُلغيت، أو أن الرابط قديم."
                actions={<button className="btn btn-2" onClick={() => navigate(ROUTES.agreements)}>ارجع إلى الصندوق</button>}
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }
  /* The editable state lives in a child keyed by the agreement's station, so it starts fresh
     whenever the agreement moves */
  return <AgreementView key={`${a.id}-${a.version}-${a.stage}-${agrHolder(a)}`} a={a} />
}

function AgreementView({ a }: { a: AgreementRow }) {
  const navigate = useNavigate()
  const { role, user } = useRole()
  const mobile = useIsMobile()
  const [params] = useSearchParams()
  const asEntity = params.get('as') === 'entity'
  const f = agrFlowOf(a.id)
  const edit = mayEdit(a, role.key, asEntity)

  const [rows, setRows] = useState<DraftPay[]>(() => asDraft(a.payments))
  const [clauses, setClauses] = useState<Clause[]>(() => structuredClone(f.clauses))
  const [docs, setDocs] = useState<PayDoc[]>(() => structuredClone(a.docs))
  const [signer, setSigner] = useState(() => ({ ...a.signer }))
  const [template, setTemplate] = useState(a.template)
  const [kind, setKind] = useState<AgreementKind>(a.kind)
  const [note, setNote] = useState('')
  const [said, setSaid] = useState('')
  const [reason, setReason] = useState('')

  const payments = edit ? toPayments(rows, a.amount) : a.payments
  const live = edit
    ? { projectId: a.projectId, kind, template, signer, amount: a.amount, reserved: reservedOf(a), payments, clauses, docs, paperCopy: f.paperCopy }
    : { ...a, reserved: reservedOf(a), clauses: f.clauses, paperCopy: f.paperCopy }
  const dirty = edit && JSON.stringify([payments, clauses, docs, signer, template, kind]) !== JSON.stringify([a.payments, f.clauses, a.docs, a.signer, a.template, a.kind])
  const issues = edit ? agrIssues(live) : issuesOfRow(a)
  const hints = agrReview(live)
  const text = agreementText(live)
  const ladder = ladderFor(a)
  const actions = agrActions(a, role.key, asEntity)
  const holder = agrHolder(a)
  const heat = agrHeat(a)
  const days = Math.round(a.hoursInStage / 24)
  const balance = agrPaymentsBalance({ ...a, payments })
  const reserved = reservedOf(a)
  const gap = a.amount - reserved
  const saveDraft = () => saveAgreement(a.id, { payments, clauses, docs, signer, template, kind }, user.name)

  const onAct = (x: AgrAction, file?: string) => {
    let out: string[]
    if (x.act === 'submit') {
      if (dirty) saveDraft()
      out = submitAgreement(a.id, user.name)
    } else {
      out = actOnAgreement(a.id, x.act, note, asEntity ? a.signer.name : user.name, file)
    }
    setSaid(out[0] ?? '')
    if (!out.length) setNote('')
  }

  const center: { k: string; t: string; rest: React.ReactNode[] } =
    a.stage === 'active'
      ? { k: 'اكتمل مسار الاعتماد', t: 'الاتفاقية سارية', rest: [a.activeAt ? <>فُعّلت في <DateText>{a.activeAt}</DateText></> : null] }
      : a.stage === 'cancelled'
        ? { k: 'توقّف مسار الاعتماد', t: agrStageSay(a), rest: [] }
        : { k: 'صاحب القرار الآن', t: holder ? HOLDER_SAY[holder] : '', rest: [agrStageSay(a)] }
  const stop = issues[0]?.say

  return (
    <AppLayout assistantContext={assistFor.page(`اتفاقية ${a.id}`, a.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label={asEntity ? 'البوابة' : 'الاتفاقيات'} onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${a.entityId}` : ROUTES.agreements)} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{a.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{a.id}</Mono> · {a.entityName} · {a.kind}
                {a.version > 1 && <> · الإصدار <span className="num">{a.version}</span></>}
                {f.inForce !== undefined && f.inForce !== a.version && <> · النافذ الإصدار <span className="num">{f.inForce}</span></>}
              </p>
              <div className="pamt">
                <div className="lb">قيمة المنحة</div>
                <div className="v"><Money sm>{a.amount}</Money></div>
                <div className="sub">
                  {gap === 0
                    ? <>مطابقة للمخصص المحجوز في الميزانية · على <Num>{payments.length}</Num> {nounAfter(payments.length, NOUN.payment)}</>
                    : <span className="bad">المحجوز <Mono>{nf.format(reserved)}</Mono> · فرق <Mono>{nf.format(Math.abs(gap))}</Mono> يمنع الإرسال للاعتماد</span>}
                </div>
              </div>
            </div>
            <div className="pgates">
              <StepArc steps={ladder} compact={mobile} aria={`مسار اعتماد الاتفاقية، ${center.t}`} holderKey={center.k} holder={center.t} rest={center.rest} />
            </div>
          </header>

          <div className="prow">
            <Tag tone={heat === 'ok' ? (a.stage === 'active' ? 'ok' : a.stage === 'returned' ? 'warn' : 'mute') : HEAT_TONE[heat]}>{agrStageSay(a)}</Tag>
            {holder && <span className="sub">عند {HOLDER_SAY[holder]} منذ <Num>{days}</Num> {nounAfter(days, NOUN.day)}</span>}
            {a.stage === 'active' && a.activeAt && <span className="sub">فُعّلت في <DateText>{a.activeAt}</DateText></span>}
            <span className="pc-sp" />
            <Person name={a.owner} />
            {!asEntity && (
              <Link className="btn btn-2 btn-sm" to={ROUTES.project(a.projectId)}>
                <Icon name={icons.doc} size="sm" />المشروع
              </Link>
            )}
          </div>

          {asEntity && (
            <Glass>
              <Head title="اتفاقية منحتك" meta={<Tag tone="mute">الجهة المستفيدة</Tag>} />
              <p className="sub cnote">
                {holder === 'entity'
                  ? a.kind === 'إلكترونية'
                    ? 'راجع نص الاتفاقية وجدول الدفعات، ثم وقّعها إلكترونيًّا باسم ممثلك المخوّل أو أعدها بملاحظاتك إلى مشرف المنح.'
                    : 'الاتفاقية ورقية · تُسلَّم لك مطبوعة وتوقّعها ثم تُعيدها إلى مشرف المنح ليرفع النسخة الموقّعة.'
                  : f.entitySign && a.stage === 'entity' ? 'وقّعت الاتفاقية · بانتظار اعتماد ممثل المؤسسة للنسخة النهائية.'
                    : a.stage === 'active' ? 'الاتفاقية سارية · يمكنك تقديم طلبات صرف الدفعات المستحقة.' : 'الاتفاقية في مراجعة المؤسسة الداخلية.'}
              </p>
              {holder === 'entity' && a.kind === 'إلكترونية' && <p className="sub cnote">الموقّع: <b>{a.signer.name}</b> · {a.signer.title}</p>}
            </Glass>
          )}

          {!asEntity && a.stage !== 'active' && (
            <p className="sub cnote tcen">
              مرحلة الاتفاقية لا تغيّر حالة المشروع · يبقى «اعتماد الإتفاقية» حتى سريانها، ولا ينتقل للتنفيذ عند إلغائها (8.4.26 · 8.4.27).
            </p>
          )}

          {edit && (
            <Glass>
              <Head title="تعديل المسودة" meta={dirty ? <Tag tone="warn">تعديلات غير محفوظة</Tag> : <Tag tone="mute">محفوظة</Tag>} />
              <p className="sub cnote">{a.stage === 'returned' ? 'أُعيدت للتعديل · عدّل البنود أو الجدول أو الملاحق ثم أعد الإرسال إلى مدير المنح (8.2.16 · 8.2.17).' : 'المسودة عند مشرف المنح · تُستكمل هنا ثم تُرسل إلى مدير المنح.'}</p>
              <div className="regfields">
                <label className="regf"><span className="lb">اسم الموقّع</span><span className="fld"><input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} aria-label="اسم الموقّع" /></span></label>
                <label className="regf"><span className="lb">صفة الموقّع</span><span className="fld"><input value={signer.title} onChange={(e) => setSigner({ ...signer, title: e.target.value })} aria-label="صفة الموقّع" /></span></label>
                {kind === 'إلكترونية' && (
                  <label className="regf regf-w"><span className="lb">النموذج المعتمد</span>
                    <FieldSelect value={template} options={TEMPLATES.includes(template as (typeof TEMPLATES)[number]) || !template ? [...TEMPLATES] : [template, ...TEMPLATES]} onChange={setTemplate} label="النموذج المعتمد" placeholder="اختر النموذج" />
                  </label>
                )}
              </div>
              {!f.submitted ? (
                <ul className="pkinds mt-3">
                  {KINDS.map((k) => (
                    <li key={k.key}>
                      <label className={`pkind${kind === k.key ? ' on' : ''}`}>
                        <input type="radio" name="agkind-edit" checked={kind === k.key} onChange={() => setKind(k.key)} />
                        <span className="pkind-h"><span className="pkind-r" aria-hidden="true">{kind === k.key && <CheckMark />}</span><b>{k.label}</b><span className="sub trim1">· {k.note}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : <p className="sub cnote">النوع <b>{a.kind}</b> ثابت منذ إرسال هذا الإصدار للاعتماد · تغييره بإصدار جديد (8.4.3).</p>}
              <div className="apv-row mt-3">
                <button type="button" className="btn btn-2" disabled={!dirty} onClick={saveDraft}>احفظ التعديلات</button>
                {dirty && <button type="button" className="btn btn-ghost" onClick={() => { setRows(asDraft(a.payments)); setClauses(structuredClone(f.clauses)); setDocs(structuredClone(a.docs)); setSigner({ ...a.signer }); setTemplate(a.template); setKind(a.kind) }}>تراجع</button>}
              </div>
            </Glass>
          )}

          {/* The schedule being edited takes the full width · its fields don't fit half a page */}
          {edit && (
            <Glass className="tblcard">
              <Head title="جدول صرف الدفعات" meta={balance.balanced ? <Tag tone="ok">متوازن</Tag> : <Tag tone="no">غير متوازن · 8.2.12</Tag>} />
              <ScheduleEditor rows={rows} amount={a.amount} onChange={setRows} />
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              {!edit && (
                <Glass className="tblcard">
                  <Head title="جدول صرف الدفعات" meta={balance.balanced ? <Tag tone="ok">متوازن</Tag> : <Tag tone="no">غير متوازن · 8.2.12</Tag>} />
                  <ScheduleEditor rows={asDraft(a.payments)} amount={a.amount} readOnly />
                </Glass>
              )}

              <ClausesCard clauses={edit ? clauses : f.clauses} onChange={edit ? setClauses : undefined} />

              <AgreementTextCard parts={text} note={asEntity ? undefined : 'البيانات مسترجعة من المشروع والجهة والميزانية والخطة · وتُعدَّل في مصدرها لا هنا.'} />

              {a.note && (
                <Glass>
                  <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">{agrStageSay(a)}</Tag>} />
                  <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(a.note)}</span></div>
                </Glass>
              )}

              <AnnexesCard docs={edit ? docs : a.docs} onChange={edit ? setDocs : undefined} />

              {!asEntity && (
                <Glass>
                  <Head title="سجل التدقيق" meta={<span className="sub">كل انتقال مع رقم خطوته في الوثيقة</span>} />
                  <ol className="paylog">
                    {[...a.log].reverse().map((e, i) => (
                      <li key={`${e.step}-${i}`}>
                        <span className="paylog-s num">{e.step}</span>
                        <div className="paylog-b">
                          <div className="paylog-t">{e.what}</div>
                          <div className="sub">
                            {e.who}{e.role !== e.who && <> · {e.role}</>}
                            <span className="pc-dot" /><DateText>{e.at}</DateText>
                            {e.version > 1 && <><span className="pc-dot" />الإصدار <span className="num">{e.version}</span></>}
                          </div>
                          {e.note && <div className="paylog-n">{isolate(e.note)}</div>}
                          {e.notified && <div className="paylog-i sub"><Icon name={icons.send} size="sm" />إشعار · {e.notified}</div>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Glass>
              )}
            </div>

            <div className="col">
              {!asEntity && <EditableCard module="agreement" state={a.stage} label={agrStageSay(a)} />}
              {!asEntity && a.stage !== 'active' && a.stage !== 'cancelled' && (
                <IssuesCard issues={issues} ready="الاتفاقية مكتملة · البيانات والبنود والملاحق والجدول والقيمة مطابقة." />
              )}
              {!asEntity && a.stage !== 'active' && a.stage !== 'cancelled' && (
                <ReviewCard hints={hints} onAdd={edit ? (c) => setClauses((xs) => [...xs, c]) : undefined} onTemplate={edit && kind === 'إلكترونية' ? setTemplate : undefined} />
              )}
              <SignaturesCard a={a} />

              <Glass>
                <Head title="النموذج والنوع" meta={<span className="sub"><bdi>8.2.4 · 8.2.5 · 8.4.3</bdi></span>} />
                <KV rows={[
                  { k: 'نوع الاتفاقية', v: a.kind },
                  { k: 'النموذج', v: a.kind === 'ورقية' ? (f.paperCopy ?? 'نسخة ورقية') : a.template },
                  { k: 'الإصدار', v: <><Num>{a.version}</Num>{f.inForce !== undefined && <> · النافذ <Num>{f.inForce}</Num></>}</> },
                  { k: 'بدء الإعداد', v: <DateText>{a.openedAt}</DateText> },
                ]} />
              </Glass>

              {!asEntity && (
                <Glass>
                  <Head title="البيانات المسترجعة" meta={<span className="sub">قاعدة 5</span>} />
                  <KV rows={[
                    { k: 'المشروع', v: <Link className="tlink" to={ROUTES.project(a.projectId)}><Mono>{a.projectId}</Mono></Link> },
                    { k: 'الجهة المستفيدة', v: <Link className="tlink" to={ROUTES.entity(a.entityId)}>{a.entityName}</Link> },
                    { k: 'ممثل الجهة', v: a.signer.name },
                    { k: 'صفة الممثل', v: a.signer.title },
                    { k: 'المخصص المحجوز', v: <><Num>{reserved}</Num> <Riyal /></> },
                  ]} />
                </Glass>
              )}

              {!asEntity && (
                <VersionsCard a={a} versions={f.versions}>
                  {a.stage === 'active' && role.key === 'supervisor' && (
                    <div className="apv-row mt-3">
                      <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب التعديل بعد التوقيع" aria-label="سبب الإصدار الجديد" /></span>
                      <button type="button" className="btn btn-2 btn-sm" disabled={!reason.trim()} onClick={() => { const out = openNewVersion(a.id, reason, user.name); setSaid(out[0] ?? ''); setReason('') }}>
                        <Icon name={icons.plus} size="sm" />افتح إصدارًا جديدًا
                      </button>
                    </div>
                  )}
                  {a.stage === 'active' && <p className="sub cnote">لا تُعدَّل الاتفاقية بعد التوقيع · التعديل إصدار جديد يمرّ بدورة الاعتماد كاملة، ويبقى الإصدار النافذ ساريًا حتى سريانه (8.4.17).</p>}
                </VersionsCard>
              )}
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <AgrActionDock
            who={asEntity ? a.signer.name : user.name}
            agreement={a}
            actions={actions}
            note={note}
            onNote={setNote}
            stop={stop}
            said={said}
            onAct={onAct}
          />
        )}
      </div>
    </AppLayout>
  )
}
