import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { useState } from 'react'
import { readClauses } from '@/data/shared/ai'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FormField, FieldBox, Modal, ModalHead, Button, EditButton, type TabItem, Tabs, DockActions,
  BackTo, CheckMark, DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person,
  StepArc, Tag, type GateStep,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter } from '@/lib/format'
import { AGR_LIMIT, agrPaymentsBalance, agreementById } from '@/data/mock/agreements'
import { KINDS, TEMPLATES, toPayments, type DraftPay } from '@/data/mock/agreementNew'
import { useBudget } from '@/data/budget/store'
import {
  HOLDER_SAY, actOnAgreement, agrActions, agrFlowOf, agrHolder, agrIssues, agrReview, agrStageSay, agreementText,
  issuesOfRow, mayEdit, openNewVersion, reservedOf, saveAgreement, submitAgreement, useAgreements,
  type AgrAction, type Clause,
signHash } from '@/data/agreements/store'
import type { AgreementKind, AgreementRow, PayDoc } from '@/types/domain'
import { AgrActionDock } from './AgrActionDock'
import { OtpPanel } from '@/features/entities/OtpPanel'
import { entityById } from '@/data/mock/entities'
import { ScheduleEditor, asDraft } from './ScheduleEditor'
import { AgreementTextCard, AnnexesCard, ClausesCard, SignaturesCard, VersionsCard } from './parts'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { LogTab } from '@/features/projects/tabs'
import { RecordEntityCard, RecordProjectCard } from '@/features/shared/RecordParties'
import { RecordFiles } from '@/features/shared/RecordFiles'
import type { LogEvent } from '@/data/mock/log'
import { agreementOutcome } from '@/data/shared/outcome'

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
                actions={<Button variant="2" onClick={() => navigate(ROUTES.agreements)}>ارجع إلى الصندوق</Button>}
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
  const [params, setParams] = useSearchParams()
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
  const [signing, setSigning] = useState(false)
  /* Client 27 Oct · the draft's data and its schedule are edited in popups */
  const [pop, setPop] = useState<null | 'data' | 'pay'>(null)

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
  const balance = agrPaymentsBalance({ ...a, payments })
  const reserved = reservedOf(a)
  const gap = a.amount - reserved
  const saveDraft = () => saveAgreement(a.id, { payments, clauses, docs, signer, template, kind }, user.name)

  const onAct = (x: AgrAction, file?: string, n?: string): string[] => {
    let out: string[]
    /* Batch 8 · the electronic signature is confirmed with a code on the signer's phone first */
    if (x.act === 'entitySign') { setSigning(true); setSaid(''); return [] }
    if (x.act === 'submit') {
      if (dirty) saveDraft()
      out = submitAgreement(a.id, user.name)
    } else {
      out = actOnAgreement(a.id, x.act, n ?? note, asEntity ? a.signer.name : user.name, file)
    }
    setSaid('')
    if (!out.length) setNote('')
    return out
  }

  /* 17 Oct · the assistant suggests the next step from the agreement's own checks · the employee picks */
  const nextActs = actions.filter((x) => x.act !== 'entitySign')
  const nextPlan = suggestNext(nextActs, { issues: issues.map((x) => x.say), good: [hints.length ? '' : 'لا ملاحظات على نص البنود', gap === 0 ? 'القيمة مطابقة للمحجوز في الميزانية' : '', balance.balanced ? 'الدفعات متوازنة مع قيمة المنحة' : ''] })
  const nextExec = (x: AgrAction, n: string) => {
    const out = x.act === 'submit' ? (dirty && saveDraft(), submitAgreement(a.id, user.name)) : actOnAgreement(a.id, x.act, n, user.name)
    if (!out.length) setNote('')
    return out
  }

  const center: { k: string; t: string; rest: React.ReactNode[] } =
    a.stage === 'active'
      ? { k: 'اكتمل مسار الاعتماد', t: 'الاتفاقية سارية', rest: [a.activeAt ? <>فُعّلت في <DateText>{a.activeAt}</DateText></> : null] }
      : a.stage === 'cancelled'
        ? { k: 'توقّف مسار الاعتماد', t: agrStageSay(a), rest: [] }
        : { k: 'صاحب القرار الآن', t: holder ? HOLDER_SAY[holder] : '', rest: [] }
  const stop = issues[0]?.say
  const tabs: TabItem[] = [
    { slug: 'data', label: 'بيانات الاتفاقية' },
    { slug: 'pay', label: 'جدول الدفعات', count: payments.length || undefined },
    { slug: 'versions', label: 'الإصدارات والملاحق', count: (a.docs.length + (asEntity ? 0 : f.versions.length)) || undefined },
    /* Client 27 Oct · the project and the entity read in tabs, as on the other records · the
       agreement's own log in the projects' log shape (the audit log tab is gone) */
    { slug: 'project', label: 'المشروع' },
    { slug: 'entity', label: 'الجهة' },
    { slug: 'files', label: 'المرفقات' },
    ...(asEntity ? [] : [{ slug: 'log', label: 'سجل الاتفاقية', count: a.log.length || undefined }]),
  ]
  const tab = tabs.find((t) => t.slug === params.get('tab'))?.slug ?? 'data'
  const goTab = (slug: string) => {
    const next = new URLSearchParams(params)
    if (slug === 'data') next.delete('tab'); else next.set('tab', slug)
    setParams(next, { replace: true })
  }

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
                {/* Client 27 Oct · the payment count left the header (the schedule tab counts them) · a
                    value that differs from the budget hold still says so here */}
                {gap !== 0 && <div className="sub"><span className="bad">المحجوز <Mono>{nf.format(reserved)}</Mono> · فرق <Mono>{nf.format(Math.abs(gap))}</Mono></span></div>}
              </div>
            </div>
            <div className="pgates">
              <StepArc steps={ladder} compact={mobile} aria={`مسار اعتماد الاتفاقية، ${center.t}`} holderKey={center.k} holder={center.t} rest={center.rest} outcome={agreementOutcome(a.stage)} />
            </div>
          </header>

          {/* Client 27 Oct · the status row under the header is gone · the arc names who holds the
              agreement now, and its final outcome once it ends · the preparer reads in the data tab */}

          {asEntity && signing && holder === 'entity' && (
            <Glass>
              <Head title="التوقيع الإلكتروني" meta={<Tag tone="warn">تأكيد الهوية</Tag>} />
              <p className="sub cnote">يوقّع <b>{a.signer.name}</b> · {a.signer.title}</p>
              <OtpPanel
                purpose="sign"
                to={[entityById(a.entityId)?.mobile ?? '']}
                onVerified={() => {
                  void signHash(a).then((hash) => {
                    const out = actOnAgreement(a.id, 'entitySign', note, a.signer.name, undefined, { hash, via: 'otp', to: entityById(a.entityId)?.mobile ?? '' })
                    setSaid(out[0] ?? ''); setSigning(false)
                  })
                }}
              />
              <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setSigning(false)}>إلغاء</Button>
            </Glass>
          )}


          {/* Client sheet 26 Oct (#105) · the agreement reads in pinned tabs, the project's component */}
          <Tabs items={tabs} active={tab} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {tab === 'data' && <>
                {/* Client sheet 26 Oct (#106) · the agreement's own data · its representative here,
                    the retrieved block that repeated the header is gone */}
                <Glass>
                  <Head title="بيانات الاتفاقية" meta={edit ? <span className="rowf gp-2">{dirty && <Tag tone="warn">تعديلات غير محفوظة</Tag>}<EditButton onClick={() => setPop('data')} /></span> : undefined} />
                  <KV rows={[
                    { k: 'نوع الاتفاقية', v: a.kind },
                    { k: 'النموذج', v: a.kind === 'ورقية' ? (f.paperCopy ?? 'نسخة ورقية') : a.template },
                    { k: 'الإصدار', v: <><Num>{a.version}</Num>{f.inForce !== undefined && <> · النافذ <Num>{f.inForce}</Num></>}</> },
                    { k: 'بدء الإعداد', v: <DateText>{a.openedAt}</DateText> },
                    { k: 'معد الاتفاقية · مشرف المنح', v: <Person name={a.owner} /> },
                    { k: 'ممثل الجهة', v: <>{a.signer.name} <span className="sub">· {a.signer.title}</span></> },
                  ]} />
                </Glass>

                {a.note && (
                  <Glass>
                    <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">{agrStageSay(a)}</Tag>} />
                    <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(a.note)}</span></div>
                  </Glass>
                )}

                <ClausesCard clauses={edit ? clauses : f.clauses} onChange={edit ? setClauses : undefined} />

                {/* Client 27 Oct · the completeness check and the assistant's review cards are gone · what
                    stops sending still reads in the assistant aside and on the decision bar */}

                <AgreementTextCard parts={text} />

                <SignaturesCard a={a} />
              </>}

              {/* Client 27 Oct · the schedule reads in the page's column like every other tab · it is
                  edited in a large popup, where its fields have the room they need */}
              {tab === 'pay' && (
                <Glass className="tblcard">
                  <Head title="جدول صرف الدفعات" meta={<span className="rowf gp-2">
                    {balance.balanced ? <Tag tone="ok">متوازن</Tag> : <Tag tone="no">غير متوازن{/* doc 8.2.12 */}</Tag>}
                    {edit && <Button type="button" variant="2" size="sm" onClick={() => setPop('pay')}><Icon name={icons.edit} size="sm" />عدّل الجدول</Button>}
                  </span>} />
                  <ScheduleEditor rows={edit ? rows : asDraft(a.payments)} amount={a.amount} readOnly projectId={a.projectId} />
                </Glass>
              )}

              {tab === 'versions' && <>
                <AnnexesCard docs={edit ? docs : a.docs} onChange={edit ? setDocs : undefined} />
                {!asEntity && (
                  <VersionsCard a={a} versions={f.versions}>
                    {a.stage === 'active' && role.key === 'supervisor' && (
                      <div className="apv-row mt-3">
                        {/* v3 · 8.3.29 · an amending annex beside the original, or a full replacement · Client 26 Oct · the reason in the popup */}
                        <DockActions
                          actions={[
                            { label: 'ملحق تعديلي', kind: 'btn-2 btn-sm', needsNote: true, mode: 'annex' as const },
                            { label: 'إصدار كامل بديل', kind: 'btn-2 btn-sm', needsNote: true, mode: 'full' as const },
                          ]}
                          subject={<>اتفاقية {a.projectName}</>}
                          placeholder="سبب التعديل بعد التوقيع"
                          onRun={(x, n) => { const out = openNewVersion(a.id, n, user.name, x.mode); setSaid(out[0] ?? ''); return out }}
                        />
                      </div>
                    )}
                  </VersionsCard>
                )}
              </>}

              {tab === 'project' && <RecordProjectCard projectId={a.projectId} projectName={a.projectName} />}
              {tab === 'entity' && <RecordEntityCard entityId={a.entityId} entityName={a.entityName} extra={[{ k: 'ممثل الجهة في الاتفاقية', v: <>{a.signer.name} <span className="sub">· {a.signer.title}</span></> }]} />}
              {tab === 'files' && (
                <RecordFiles record={`agreement:${a.id}`} me={asEntity ? a.entityName : user.name} canUpload={a.stage !== 'cancelled'}
                  seed={[...a.docs.map((d) => ({ name: d.name, meta: d.kind })), ...(f.paperCopy ? [{ name: f.paperCopy, meta: 'النسخة الورقية الموقّعة' }] : [])]} />
              )}

              {tab === 'log' && <LogTab title="سجل الاتفاقية" events={agreementLog(a)} entityName={a.entityName} entityLogo={entityById(a.entityId)?.logo} />}
            </div>

            <AssistantAside
              title="مراجعة الاتفاقية"
              suggest={!asEntity && nextActs.length > 0 ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
              cta="راجع الاتفاقية"
              empty="لا ملاحظات · الاتفاقية مطابقة لبيانات المشروع والجدول."
              ask={!asEntity}
              readings={asEntity || a.stage === 'active' || a.stage === 'cancelled' ? [] : [
                ...issues.map((x, i) => ({ id: `ag-i${i}`, kind: 'flag' as const, label: 'يمنع الإرسال', text: x.say, src: x.rule })),
                ...hints.map((h) => ({ id: `ag-h${h.id}`, kind: h.tone === 'warn' ? 'flag' as const : 'note' as const, label: 'مراجعة البنود', text: h.text, src: /* doc rule 21 */ 'مراجعة استرشادية' })),
                readClauses(a),
              ]}
            />
          </div>
        </div>

        {pop && <Modal label={pop === 'pay' ? 'تعديل جدول صرف الدفعات' : 'تعديل بيانات الاتفاقية'} onClose={() => setPop(null)} className={pop === 'pay' ? 'modal-xl' : 'modal-w'}>
              <ModalHead icon={icons.edit} title={pop === 'pay' ? 'تعديل جدول صرف الدفعات' : 'تعديل بيانات الاتفاقية'}>
                {pop === 'pay' && <span className="pc-sp" />}
                {pop === 'pay' && (balance.balanced ? <Tag tone="ok">متوازن</Tag> : <Tag tone="no">غير متوازن</Tag>)}
              </ModalHead>
              <div className="mb col">
                {pop === 'pay'
                  ? <ScheduleEditor rows={rows} amount={a.amount} onChange={setRows} projectId={a.projectId} />
                  : <>
              <div className="regfields">
                      <FormField label="اسم الموقّع"><FieldBox><input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} aria-label="اسم الموقّع" /></FieldBox></FormField>
                      <FormField label="صفة الموقّع"><FieldBox><input value={signer.title} onChange={(e) => setSigner({ ...signer, title: e.target.value })} aria-label="صفة الموقّع" /></FieldBox></FormField>
                      {kind === 'إلكترونية' && (
                        <FormField label="النموذج المعتمد" wide>
                          <FieldSelect value={template} options={TEMPLATES.includes(template as (typeof TEMPLATES)[number]) || !template ? [...TEMPLATES] : [template, ...TEMPLATES]} onChange={setTemplate} label="النموذج المعتمد" placeholder="اختر النموذج" />
                        </FormField>
                      )}
                    </div>
                    {!f.submitted ? (
                      <ul className="pkinds mt-3">
                        {KINDS.map((k) => (
                          <li key={k.key}>
                            <label className={`pkind${kind === k.key ? ' on' : ''}`}>
                              <input type="radio" name="agkind-edit" checked={kind === k.key} onChange={() => setKind(k.key)} />
                              <span className="pkind-h"><span className="pkind-r" aria-hidden="true">{kind === k.key && <CheckMark />}</span><b>{k.label}</b></span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
      
                  </>}
              </div>
              <div className="mf">
                <Button type="button" variant="p" disabled={!dirty} onClick={() => { saveDraft(); setPop(null) }}>احفظ التعديلات</Button>
                <Button type="button" variant="2" onClick={() => {
                  if (pop === 'pay') setRows(asDraft(a.payments))
                  else { setSigner({ ...a.signer }); setTemplate(a.template); setKind(a.kind) }
                  setPop(null)
                }}>تراجع</Button>
              </div>
            </Modal>}
        {actions.length > 0 && (
          <AgrActionDock
            who={asEntity ? a.signer.name : user.name}
            agreement={a}
            actions={actions}
            stop={stop}
            said={said}
            onAct={onAct}
          />
        )}
      </div>
    </AppLayout>
  )
}

/** Client 27 Oct · the agreement's events in the projects' log shape · newest first */
function agreementLog(a: AgreementRow): LogEvent[] {
  return [...a.log].reverse().map((e, i): LogEvent => ({
    id: `ag-${a.id}-${a.log.length - i}`,
    action: e.what,
    dept: e.role,
    by: e.who,
    actor: e.who === a.signer.name || e.who === a.entityName ? 'entity' : 'staff',
    at: e.at,
    time: '',
    days: 0,
    hours: 0,
    limit: 0,
    fields: [
      ...(e.note ? [{ k: 'الملاحظة', v: e.note }] : []),
      ...(e.version > 1 ? [{ k: 'الإصدار', v: String(e.version) }] : []),
      ...(e.notified ? [{ k: 'الإشعار', v: e.notified }] : []),
    ],
    tone: 'mute',
  }))
}
