import { LogTab } from '@/features/projects/tabs'
import { fileMoves, recordLog } from '@/features/shared/recordLog'
import { RecordFiles } from '@/features/shared/RecordFiles'
import { RecordEntityCard, RecordProjectCard } from '@/features/shared/RecordParties'
import { useFiles } from '@/data/shared/files'
import { PayActivities } from './PayActivities'
import { payActOps, usePayActs } from '@/data/payments/payActs'
import { NextStep } from '@/components/assistant/NextStep'
import { extDocsOf, isExternalParty } from '@/data/partners/store'
import { suggestNext } from '@/data/shared/agent'
import { useMemo, useState, type ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { readFiles, readNeeds } from '@/data/shared/ai'
import { useDocReads } from '@/lib/docCache'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ButtonLink, Button, BankGrid, BankCard,
  BackTo, DateText, Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  StepArc, Tabs, Tag, type GateStep, type TabItem,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { DocFile } from '@/components/docs'
import { assistFor } from '@/data/mock/assistant'
import { payRequestById, payStateWho } from '@/data/mock/disbursements'
import { isolate, NOUN, nounAfter, pct, readDate } from '@/lib/format'
import {
  PAY_PROOFS,
  bankIssues, banksOf,
} from '@/data/mock/payEntity'
import type { PayRequest } from '@/types/domain'
import { ActionDock } from './ActionDock'
import { PayExceptions } from './PayExceptions'
import { PayeeCard } from './PayeeCard'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { readPayRequest } from '@/data/recordReadings'
import { PROXY_ROLES, actOnPay, grantLeft, mayResubmit, payActions, payStops, usePayments, type PayAction } from '@/data/payments/store'
import { PlanTab } from '@/features/projects/tabs/PlanTab'
import { FundingTab } from '@/features/projects/tabs/FundingTab'
import { planOfProject } from '@/data/mock/plans'
import { projectById } from '@/data/mock/projects'
import { payOutcome } from '@/data/shared/outcome'

/* A single disbursement request - screens 3, 4 and 5 in the disbursement spec.

   Note: this is one screen for three screens in the spec. The spec describes "request review"
   (supervisor, steps 5-7), "grants manager approval" (step 13), and "disbursement order and
   transfer" (finance, steps 15-18) as separate sections, because it's describing the process, not
   the screen.

   But all three show the same request, with the same attachments, conditions, and log - the only
   difference is the exits. Three files would have become three copies of the same view, and adding
   a field would mean adding it three times - or twice, forgetting the third, which is exactly what
   happened before. So the view is one, and `actionsFor(role, state)` decides the exits.

   === What the spec requires the screen to show ===

   Rule 10 - agreement and its validity shown        -> the "agreement" card
   Rule 11 - the reserved amount shown at execution   -> the "disbursement impact" card
   Rule 12 - funding source breakdown                 -> the sources table
   Rule 13 - reserved -> spent and budget impact       -> same card
   Rule 14 - a hard cap on the grant amount            -> the grant bar
   Rule 16 - an audit log for every operation          -> the timeline with its steps
   Rule 17 - a notification for every transition       -> the notice line inside the log
   Rule 18 - no edits after approval                   -> exits disappear after disbursement
   Rule 20 - the AI output is advisory                 -> the "advisory" tag
   Rule 21 - documents tied to the request             -> the attachments card

   === What is deliberately NOT here ===

   "Disbursement request" (steps 1 and 2) is the request form. The entity opens this same page from
   its portal (`?as=entity`) to follow its request (9.4.19): its own five states, the notes to
   complete, the attachments and the log - without the institution's internal cards or exits. */

/** The stages the user sees · v3 · 9.2.1 – 9.2.18 */
const LADDER: { key: string; label: string; note: string; cap: string; steps: number[] }[] = [
  { key: 'entity', label: 'رفع المتطلبات', note: 'الجهة المستفيدة', cap: 'المتطلبات', steps: [1, 2, 3, 4, 9] },
  { key: 'supervisor', label: 'اعتماد المتطلبات', note: 'مشرف المنح', cap: 'اعتماد المتطلبات', steps: [5, 6, 7] },
  { key: 'eligible', label: 'إذن الصرف', note: 'مشرف المنح', cap: 'إذن الصرف', steps: [10, 11] },
  { key: 'manager', label: 'اعتماد مدير المنح', note: 'مدير المنح', cap: 'اعتماد الإذن', steps: [12] },
  { key: 'exec', label: 'اعتماد المدير التنفيذي', note: 'المدير التنفيذي', cap: 'اعتماد الإذن', steps: [12] },
  { key: 'finance', label: 'أمر الصرف والتحويل', note: 'الإدارة المالية', cap: 'التحويل', steps: [13, 14, 15, 16, 17, 18] },
]

/** Which stage the record is currently at. */
const NOW_AT: Record<string, string> = {
  supervisor: 'supervisor',
  eligible: 'eligible',
  returned: 'entity',
  manager: 'manager',
  exec: 'exec',
  finance: 'finance',
  paid: '',
  closed: '',
}

/* Re-audit 7 Oct · a stage reads done once the request is past it · it used to need every step of
   the stage logged, and step 6 is never logged, so «مراجعة المشرف» read «لم تبدأ» to the end */
/* Client 19 Oct · the payment's approvals read like the project's and the other procedures' · the
   same arc (StepArc) the agreement, the closing and the plan carry · each sector names who holds the
   step, its caption the step, and hovering reads who did it and when */
function ladderFor(r: PayRequest): GateStep[] {
  const viaExec = r.state === 'exec' || r.log.some((e) => e.role === 'المدير التنفيذي' && e.step === 12)
  /* a payment with no requirements cycle starts at the permit (9.2.2) */
  const stages = LADDER.filter((s) => (s.key !== 'exec' || viaExec) && (r.origin !== 'supervisor' || (s.key !== 'entity' && s.key !== 'supervisor')))
  const now = NOW_AT[r.state]
  const nowAt = r.state === 'paid' ? stages.length : stages.findIndex((s) => s.key === now)
  const days = Math.round(r.hoursInState / 24)
  const steps = stages.map((s, i): GateStep => {
    const at = [...r.log].reverse().find((e) => s.steps.includes(e.step) && (s.key !== 'exec' ? s.key !== 'manager' || e.role !== 'المدير التنفيذي' : e.role === 'المدير التنفيذي'))
    /* Batch 7 · payments#10 · a closed (finally rejected) request reads the stages it passed as
       done, then its closing · it read every stage «لم تبدأ» */
    const state: GateStep['state'] = r.state === 'closed' ? (at ? 'done' : 'pending') : i === nowAt ? 'now' : nowAt >= 0 && i < nowAt ? 'done' : 'pending'
    return {
      label: s.note, title: s.label, cap: s.cap, state,
      lines: state === 'now'
        ? [<>مفتوح منذ <b>{days}</b> {nounAfter(days, NOUN.day)}</>]
        : state === 'done'
        ? [at ? <>{at.who} · <DateText>{at.at}</DateText></> : null, at ? isolate(at.what) : null]
        : ['تبدأ بعد اكتمال المرحلة السابقة'],
      src: state === 'pending' ? 'المصدر: مسار الصرف' : 'المصدر: سجل الطلب',
    }
  })
  if (r.state === 'closed') steps.push({ label: 'مغلق', title: 'مغلق · رفض نهائي', cap: 'رفض نهائي', state: 'now', lines: [/* doc rule 15 */ 'يبقى للاطلاع'] })
  return steps
}

/* Client 27 Oct · linking and unlinking plan activities reads in the payment's log */
const actMoves = (r: PayRequest) => {
  const plan = planOfProject(r.projectId)
  const nameOf = (id: string) => plan?.phases.flatMap((ph) => ph.activities).find((a) => a.id === id)?.name ?? id
  const actor = (by: string) => (by === r.entityName ? 'entity' as const : 'staff' as const)
  return payActOps(r.id).flatMap((o) => [
    ...(o.added.length ? [{ at: o.at, by: o.by, what: `ربط ${o.added.length === 1 ? 'نشاطًا' : `${o.added.length} أنشطة`} من الخطة بالدفعة`, dept: 'الأنشطة',
      actor: actor(o.by), fields: [{ k: 'الأنشطة', v: o.added.map(nameOf).join(' · ') }] }] : []),
    ...(o.dropped.length ? [{ at: o.at, by: o.by, what: `ألغى ربط ${o.dropped.length === 1 ? 'نشاط' : `${o.dropped.length} أنشطة`} بالدفعة`, dept: 'الأنشطة',
      actor: actor(o.by), fields: [{ k: 'الأنشطة', v: o.dropped.map(nameOf).join(' · ') }] }] : []),
  ])
}

export default function RequestPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const [params, setParams] = useSearchParams()
  const asEntity = params.get('as') === 'entity'
  const ver = usePayments()
  /* the log re-reads when a file is added or removed on the payment */
  useFiles()
  usePayActs()
  useDocReads() /* re-read the attachments once their content is in */
  const r = payRequestById(id)
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const mobile = useIsMobile()

  /* `ver` re-reads the ladder after every move · the request object itself is mutated in place */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ladder = useMemo(() => (r ? ladderFor(r) : []), [r, ver])

  /* Note: these hooks sit above the early `return` because they must. The first version placed them
     below, next to other computations - the rules-of-hooks require a consistent order on every
     render, and a request that isn't found exits early, so the hooks got skipped. The commit gate
     caught it (`rules-of-hooks`) before it reached the device - that's exactly the gate's job. The
     `r?.` is necessary: the hook runs even when the request doesn't exist. */
  const entBanks = useMemo(() => banksOf(r?.entityId ?? ''), [r?.entityId])
  const payBank = useMemo(
    () => entBanks.find((b) => b.bank === r?.bank.name) ?? entBanks[0],
    [entBanks, r?.bank.name],
  )
  const bankBad = useMemo(() => (r ? bankIssues(r, payBank) : []), [r, payBank])

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('الصرف')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الصرف" onClick={() => navigate(ROUTES.payments)} />
            <Glass>
              <Empty
                title="السجل غير موجود."
                actions={
                  <Button variant="2" onClick={() => navigate(ROUTES.payments)}>
                    العودة إلى صندوق الصرف
                  </Button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* the arc's hollow center · who holds the request now, like the agreement's */
  const center: { k: string; t: string; rest: ReactNode[] } =
    r.state === 'paid'
      ? { k: 'اكتمل مسار الصرف', t: 'تم الصرف', rest: [] }
      : r.state === 'closed'
        ? { k: 'توقّف مسار الصرف', t: 'مغلق · رفض نهائي', rest: [] }
        : { k: 'صاحب الإجراء الآن', t: payStateWho(r.state), rest: [] }
  const blocked = r.checks.filter((c) => !c.ok)
  const bankOk = r.bank.active
  const actions = payActions(r, role.key, asEntity)
  /* Cross · the attachments read against the request's amount */
  /* 17 Oct · the assistant suggests this seat's next step · the employee picks it inside the assistant */
  const nextPlan = suggestNext(actions, {
    issues: r.state === 'supervisor' || r.state === 'eligible' ? readNeeds(r).danger?.map((d) => `ينقص مرفق: ${d}`) ?? [] : r.state === 'manager' || r.state === 'exec' ? blocked.map((c) => c.label) : [],
    stops: (a) => payStops(r, a.act, Math.min(r.asked, r.due)),
    good: [`${r.checks.filter((c) => c.ok).length} من ${r.checks.length} فحوص سليمة`, r.asked <= r.due ? 'المبلغ ضمن الدفعة المعتمدة' : '', bankOk ? 'الحساب البنكي نشط' : ''],
  })
  const nextExec = (a: PayAction, n: string) => {
    const out = actOnPay(r.id, a.act, n, user.name, role.key, undefined, a.needsAmount ? Math.min(r.asked, r.due) : undefined)
    if (!out.length) setNote('')
    return out
  }
  const readings = [...readPayRequest(r), ...(asEntity ? [] : [readFiles('ai-pay-docs', 'قراءة متطلبات الدفعة', r.docs.map((d) => d.name), { amount: r.asked, findings: true }), readNeeds(r)])]
  const onAct = (a: PayAction, file?: string, amount?: number, n?: string): string[] => {
    const out = actOnPay(r.id, a.act, n ?? note, user.name, role.key, file, amount)
    if (out.length) return out
    setSaid({ ok: a.label })
    setNote('')
    return []
  }

  /* Rule 14 - the hard cap - spent plus this payment, against the grant. */
  const after = r.spent + r.asked
  const left = r.state === 'paid' ? r.granted - after : grantLeft(r.projectId, r.id) - r.asked

  /* v3 · 9.2.10 · the permit exists once the supervisor created it */
  const permitOn = Boolean(r.permitAt)
  const orderNo = `PO-${r.id.replace('SR-', '')}`
  const orderReady = r.state === 'finance' || r.state === 'paid'
  const prow = projectById(r.projectId)
  const tabs: TabItem[] = [
    { slug: 'data', label: 'بيانات الدفعة' },
    { slug: 'needs', label: 'المتطلبات' },
    ...(asEntity ? [] : [{ slug: 'order', label: 'أمر الصرف والتحويل' }]),
    { slug: 'plan', label: 'الخطة' },
    ...(asEntity ? [] : [{ slug: 'funding', label: 'الربط المالي' }]),
    { slug: 'project', label: 'المشروع' },
    { slug: 'entity', label: 'الجهة' },
    /* Client 27 Oct · the attachments and the log close every record's tabs */
    { slug: 'files', label: 'المرفقات', count: r.docs.length || undefined },
    { slug: 'log', label: 'سجل الدفعة', count: r.log.length || undefined },
  ]
  const tab = tabs.find((t) => t.slug === params.get('tab'))?.slug ?? 'data'
  const goTab = (slug: string) => {
    const next = new URLSearchParams(params)
    if (slug === 'data') next.delete('tab'); else next.set('tab', slug)
    setParams(next, { replace: true })
  }

  return (
    <AppLayout assistantContext={assistFor.page(`الدفعة ${r.no} · ${r.id}`, r.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo
            label={asEntity ? 'البوابة' : 'الصرف'}
            onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${r.entityId}` : ROUTES.payments)}
          />

          {said.ok && (
            <p className="ok-ink cnote" role="status">
              سُجّل الإجراء: <b>{said.ok}</b> · أُرسل الإشعار{/* doc rule 17 */}
            </p>
          )}
          {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          {/* Two-column header - same layout as the project and entity pages: name and amount on
              the right, the ladder opposite. */}
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{r.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{r.id}</Mono> · {r.entityName} ·{' '}
                الدفعة <Num>{r.no}</Num> من <Num>{r.of}</Num>
              </p>

              <div className="pamt">
                <div className="lb">{permitOn ? 'قيمة إذن الصرف' : 'قيمة الدفعة'}</div>
                <div className="v"><Money sm>{r.asked}</Money></div>
                <div className="sub">
                  {/* 9.4.4 · the permit can't exceed the approved payment */}
                  {r.asked === r.due
                    ? <>تستحق في <DateText>{r.dueAt}</DateText></>
                    : r.asked < r.due
                    ? <>من الدفعة المعتمدة <Money sm>{r.due}</Money></>
                    : <span className="bad">
                        أعلى من الدفعة المعتمدة <Money sm>{r.due}</Money>{/* doc 9.4.4 */}
                      </span>}
                </div>
              </div>
            </div>

            <div className="pgates">
              <StepArc
                steps={ladder}
                compact={mobile}
                aria={`مسار اعتماد الصرف، ${center.t}`}
                holderKey={center.k}
                holder={center.t}
                rest={center.rest}
                outcome={payOutcome(r.state)}
              />
            </div>
          </header>

          {/* Rule 15 - a closed request states that it's closed, with its log remaining beneath it. */}
          {r.state === 'closed' && (
            <Glass>
              <Head title="مغلق" meta={<Tag tone="no">رفض نهائي</Tag>} />
              {r.note && <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(r.note)}</span></div>}
            </Glass>
          )}

          {/* Client 27 Oct · the status row is gone · the arc names who holds the request and its outcome,
              the log carries every move · only the entity's resubmit action stays */}
          {mayResubmit(r) && (r.origin === 'proxy' ? !asEntity && PROXY_ROLES.includes(role.key) : asEntity) && (
            <div className="prow">
              <span className="pc-sp" />
              {/* 9.2.9 · whoever raised them completes them · the entity, or the authority for an external party (9.4.5) */}
              <ButtonLink variant="p" size="sm" to={`${ROUTES.paymentEdit(r.id)}${asEntity ? '?as=entity' : ''}`}>
                أكمل المتطلبات وأعد رفعها
              </ButtonLink>
            </div>
          )}

          {/* Client sheet 26 Oct (#107) · the payment's record reads in pinned tabs, the project's
              component: its data · requirements and attachments · the order and the transfer · the
              agreement · the plan · the financial link · its audit log */}
          <Tabs items={tabs} active={tab} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {tab === 'data' && <>
                {/* v3 · 9.2.10 · 9.4.24 · the permit, and any cancelled before the transfer */}
                {!asEntity && (permitOn || (r.cancels?.length ?? 0) > 0) && (
                  <Glass>
                    <Head title="إذن الصرف" meta={permitOn ? <Tag tone="ok">صادر</Tag> : <Tag tone="mute">لا إذن قائم</Tag>} />
                    {r.permitAt && (
                      <KV rows={[
                        { k: 'أنشأه', v: <Person name={r.permitAt.by} /> },
                        { k: 'في', v: <DateText>{r.permitAt.at}</DateText> },
                        { k: 'القيمة', v: <Money sm>{r.asked}</Money> },
                        ...(r.origin === 'supervisor' ? [{ k: 'المتطلبات', v: <span>{r.of === 1 ? 'دفعة وحيدة' : 'دفعة أولى'} بلا دورة متطلبات{/* doc 9.2.2 */}</span> }] : []),
                      ]} />
                    )}
                    {(r.cancels ?? []).map((c, i) => (
                      <div key={i} className="payq-note">
                        <Icon name={icons.alert} size="sm" />
                        <span>أُلغي إذن سابق · <Person name={c.by} /> ({c.role}) · <DateText>{c.at}</DateText> · {isolate(c.note)}</span>
                      </div>
                    ))}
                  </Glass>
                )}

                {!asEntity && <PayeeCard r={r} />}

                {/* Last return note - rules 7 and 8 require it to be explicit. */}
                {r.note && r.state !== 'closed' && (
                  <Glass>
                    <Head
                      title={r.cancels?.length && r.state === 'eligible' && !r.returnedBy ? 'سبب إلغاء الإذن' : 'ملاحظات الإعادة'}
                      meta={<Tag tone="warn">{r.returnedBy === 'manager' ? 'من مدير المنح' : r.returnedBy === 'finance' ? 'من الإدارة المالية' : 'للاستكمال'}</Tag>}
                    />
                    <div className="payq-note">
                      <Icon name={icons.chat} size="sm" />
                      <span>{isolate(r.note)}</span>
                    </div>
                  </Glass>
                )}

                {/* Rules 11, 13 and 14 - the reserved amount, its impact, and the cap. */}
                <Glass>
                  <Head title="أثر الصرف" />
                  <KV
                    rows={[
                      { k: 'المحجوز على الدفعة', v: <><Num>{r.reserved}</Num> <Riyal /></> },
                      { k: 'يتحوّل إلى', v: <span className="ok-ink">مصروف</span> },
                      { k: 'قيمة المنحة', v: <><Num>{r.granted}</Num> <Riyal /></> },
                      { k: 'المصروف قبل الدفعة', v: <><Num>{r.spent}</Num> <Riyal /></> },
                      {
                        k: 'المتبقي بعد الصرف',
                        v: left < 0
                          ? <b className="bad"><Num>{left}</Num> <Riyal /></b>
                          : <><Num>{left}</Num> <Riyal /></>,
                      },
                    ]}
                  />
                  <div className="paybar">
                    <span style={{ width: `${Math.min(100, Math.round((after / r.granted) * 100))}%` }} />
                  </div>
                  {left < 0 && <p className="bad cnote">{/* doc rule 14 */}تتجاوز الدفعة قيمة المنحة</p>}
                </Glass>

                {/* === H-5, H-6, H-7 - bank account ===
                    Client 27 Oct · the payment reads the account it goes to, drawn as the bank card it
                    is · display only · every account of the entity stays on the entity's own page */}
                {!asEntity && <Glass>
                  <Head
                    title="حساب الدفع"
                    meta={
                      <span className="rowf gp-2">
                        {bankBad.length
                          ? <Tag tone="warn"><Num>{bankBad.length}</Num> ملاحظة</Tag>
                          : <Tag tone="ok">جاهز</Tag>}
                        <Link className="lnk sub" to={ROUTES.entity(r.entityId, 'banks')}>حسابات الجهة ({entBanks.length})</Link>
                      </span>
                    }
                  />
                  {payBank && (
                    <BankGrid>
                      <BankCard bank={payBank.bank} iban={payBank.iban} holder={r.entityName} purpose={payBank.purpose}
                        status={payBank.active ? 'نشط' : 'غير نشط'} off={!payBank.active} tag={<Tag tone="mute">حساب الدفعة</Tag>} />
                    </BankGrid>
                  )}
                  {bankBad.map((b, i) => (
                    <p key={i} className="bad cnote">
                      {b.say}{/* doc · b.rule */}
                    </p>
                  ))}
                </Glass>}

                {/* 9.1.input-6 - special approvals and exceptions recorded before disbursing. */}
                {!asEntity && <PayExceptions request={r} />}
              </>}

              {tab === 'needs' && <>
                {/* Attachments - rule 21: tied to the request, not stored elsewhere. */}
                <Glass>
                  <Head
                    title="المرفقات"
                    meta={<span className="sub"><Num>{r.docs.length}</Num> {nounAfter(r.docs.length, NOUN.doc)}</span>}
                  />
                  {r.docs.length ? (
                    <div className="docgrid">
                      {r.docs.map((d, i) => (
                        <DocFile key={`${i}-${d.name}`} name={d.name} meta={readDate(d.at)} />
                      ))}
                    </div>
                  ) : <Empty title="لا مرفقات على الدفعة بعد." />}
                </Glass>

                {/* Client 27 Oct · the plan activities this payment rests on, in place of its requirements and conditions */}
                <PayActivities r={r} me={asEntity ? r.entityName : user.name}
                  canEdit={r.state !== 'paid' && r.state !== 'closed' && (asEntity || role.key === 'supervisor')} />
              </>}

              {tab === 'order' && <>
                <Glass>
                  <Head
                    title={`أمر الصرف · ${orderNo}`}
                    meta={
                      r.state === 'paid'
                        ? <Tag tone="ok">نُفّذ</Tag>
                        : r.order
                          ? <Tag tone="teal">معتمد · جاهز للتنفيذ</Tag>
                          : orderReady
                            ? <Tag tone="warn">مسودة · بانتظار اعتماد المالية</Tag>
                            : <Tag tone="mute">لم يُنشأ بعد</Tag>
                    }
                  />
                  {orderReady ? (
                    <>
                      <KV rows={[
                        { k: 'قيمة الأمر', v: <Money sm>{r.asked}</Money> },
                        { k: 'الحساب المعتمد', v: <>{r.bank.name}{r.bank.active ? '' : <span className="bad"> · غير نشط</span>}</> },
                        { k: 'مصادر التمويل', v: r.sources.map((x) => `${x.name} ${pct(x.share)}`).join(' · ') },
                      ]} />
                      <div className="rowf gp-2">
                        <ButtonLink variant="2" size="sm" to={ROUTES.paymentOrder(r.id)}>
                          <Icon name={icons.doc} size="sm" />
                          افتح أمر الصرف
                        </ButtonLink>
                      </div>
                    </>
                  ) : (
                    <Empty title="يُنشأ أمر الصرف بعد اعتماد الإدارة المالية." />
                  )}
                </Glass>

                {/* 9.2.17 · 9.1.output-2 - the executed transfer, with its proof. */}
                <Glass>
                  <Head title="التحويل المنفَّذ" meta={r.transfer ? <Tag tone="ok">تم الصرف</Tag> : <Tag tone="mute">لم يُنفَّذ</Tag>} />
                  {r.transfer ? (
                    <KV
                      rows={[
                        { k: 'تاريخ التحويل', v: <DateText>{r.transfer.at}</DateText> },
                        { k: 'البنك', v: r.transfer.bank },
                        { k: 'الحساب', v: <span className="num">{r.transfer.iban}</span> },
                        { k: 'نفّذه', v: <Person name={r.transfer.by} /> },
                        { k: 'إثبات التحويل', v: <span className="trim1">{r.transfer.proof}</span> },
                      ]}
                    />
                  ) : <Empty title="لم يُنفَّذ التحويل بعد." />}
                </Glass>

                {/* === H-4 - the two documents aren't the same type === */}
                <Glass>
                  <Head title="إثبات الصرف" />
                  <ul className="payproof">
                    {PAY_PROOFS.map((x) => (
                      <li key={x.key}>
                        <span className="payproof-h">
                          <b>{x.label}</b>
                          <span className="sub">· {x.by}</span>
                          <span className="pc-sp" />
                          <Tag tone={x.required ? 'warn' : 'mute'}>
                            {x.required ? 'إلزامي' : 'اختياري'}
                          </Tag>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              </>}

              {tab === 'project' && <RecordProjectCard projectId={r.projectId} projectName={r.projectName} />}
              {/* Rule 10 · the agreement and its validity, read on the entity's card now its own tab is gone */}
              {tab === 'entity' && <>
                <RecordEntityCard entityId={r.entityId} entityName={r.entityName} />
                {/* Rule 10 · the agreement and its validity · its summary with a way into it, like the plan tab's */}
                {isExternalParty(r.entityId) ? (
                  <Glass>
                    <Head title="الوثيقة الخارجية" meta={<Tag tone="mute">جهة خارجية</Tag>} />
                    <KV rows={[{ k: 'الوثيقة', v: extDocsOf(r.projectId).length ? extDocsOf(r.projectId).map((d) => d.file).join(' · ') : <span className="sub">لم تُسجَّل وثيقة بعد</span> }]} />
                  </Glass>
                ) : (
                  <Glass>
                    <Head title="الاتفاقية" meta={r.agreement.active ? <Tag tone="ok">سارية</Tag> : <Tag tone="no">غير سارية</Tag>} />
                    <KV rows={[
                      { k: 'رقم الاتفاقية', v: <Mono>{r.agreement.id}</Mono> },
                      { k: 'تنتهي في', v: <DateText>{r.agreement.endsAt}</DateText> },
                      { k: 'قيمة المنحة', v: <Money sm>{r.granted}</Money> },
                      { k: 'الدفعة', v: <><Num>{r.no}</Num> من <Num>{r.of}</Num> · مستحقة <DateText>{r.dueAt}</DateText></> },
                      { k: 'قيمة الدفعة المعتمدة', v: <Money sm>{r.due}</Money> },
                      /* 9.1.input-3 - the representative authorized to sign, from the agreement in force */
                      ...(r.rep ? [{ k: 'ممثل الجهة المخوّل', v: <>{r.rep.name} <span className="sub">· {r.rep.title}</span></> }] : []),
                    ]} />
                    {/* Client 27 Oct · the card's actions on its own foot, as on the plan tab */}
                    {!asEntity && (
                      <div className="cardfoot">
                        <ButtonLink to={ROUTES.agreement(r.agreement.id)} variant="p">
                          افتح الاتفاقية
                          <Icon name={icons.chevron} size="sm" />
                        </ButtonLink>
                        <ButtonLink to={ROUTES.agreements} variant="2">صندوق الاتفاقيات</ButtonLink>
                      </div>
                    )}
                  </Glass>
                )}
              </>}

              {tab === 'plan' && <PlanTab plan={planOfProject(r.projectId)} granted={r.granted} />}

              {tab === 'funding' && <>
                {/* Rule 12 - disbursement follows the approved source breakdown. */}
                <Glass>
                  <Head
                    title="مصادر تمويل الدفعة"
                    meta={r.sources.length > 1 ? <Tag tone="teal">مصدران</Tag> : <span className="sub">مصدر واحد</span>}
                  />
                  <ul className="paysrc">
                    {r.sources.map((s) => (
                      <li key={s.name}>
                        <span className="trim1">{s.name}</span>
                        <span className="num">{pct(s.share)}</span>
                        <span className="paysrc-v num">
                          {Math.round((r.asked * s.share) / 100).toLocaleString('en-US')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Glass>
                {prow && <FundingTab row={prow} />}
              </>}

              {tab === 'files' && <RecordFiles record={`pay:${r.id}`} me={asEntity ? r.entityName : user.name} canUpload={r.state !== 'paid'}
                seed={r.docs.map((d) => ({ name: d.name, meta: `${d.kind} · ${d.size} · ${d.at}` }))} />}
              {/* the payment's log · rule 16 · each transition with its notification (rule 17) */}
              {/* Client 27 Oct · every move on the payment · its workflow transitions and the files added on it */}
              {tab === 'log' && <LogTab title="سجل الدفعة" entityName={r.entityName} events={recordLog(`pay-${r.id}`, 'الدفعات', [
                ...r.log.map((e) => ({
                  at: e.at, by: e.who, what: e.what, note: e.note, dept: e.role !== e.who ? e.role : undefined,
                  actor: e.who === 'النظام' || e.who === 'الذكاء الاصطناعي' ? 'system' as const : e.who === r.entityName || e.role === 'الجهة المستفيدة' ? 'entity' as const : 'staff' as const,
                  fields: e.notified ? [{ k: 'الإشعار', v: e.notified }] : [],
                })),
                ...fileMoves(`pay:${r.id}`, r.entityName),
                ...actMoves(r),
              ].sort((a, b) => a.at.localeCompare(b.at)))} />}
            </div>

            <AssistantAside suggest={actions.length > 0 ? <NextStep s={nextPlan} exec={nextExec} /> : undefined} title="قراءة الدفعة" cta="اقرأ الدفعة" empty="لا ملاحظات على هذه الدفعة الآن." readings={readings} />
          </div>
        </div>

        {/* Role exits - what distinguishes screens 3, 4 and 5. */}
        {actions.length > 0 && (
          <ActionDock
            user={user}
            request={r}
            actions={actions}
            onAct={onAct}
          />
        )}
      </div>
    </AppLayout>
  )
}
