import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CopyId, DateText, Glass, Head, Icon, KV, Mono, Num, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { DocList, UploadButton } from '@/components/docs'
import { Thread } from '@/components/thread'
import { Background, NotificationBell } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { agreements } from '@/data/mock/agreements'
import { agrFlowOf, agrHolder, agrStageSay, useAgreements } from '@/data/agreements/store'
import { payableProjects, requestsOfEntity, usePayments } from '@/data/payments/store'
import { entityStateOf } from '@/data/mock/payEntity'
import { closeRows, closeStageLabel } from '@/data/mock/closing'
import { CASES, CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, useClosing } from '@/data/closing/store'
import { isPortalPreview, signOut } from '@/data/session'
import { useQueryParams } from '@/hooks/useQueryParams'
import { NOUN, nounAfter, readDate } from '@/lib/format'
import {
  BANK_DOC_LABEL, REG_STATE_SAY, REG_TONE, regMissingDocs, regRequestById,
} from '@/data/mock/registration'
import { portalViewOf, regThread } from '@/data/mock/regPortal'
import { planStageLabel, plansOfEntity, waitingReview } from '@/data/mock/plans'
import { projectsOfEntity } from '@/data/mock/projects'
import { flowOf, missingDocs, resubmit, uploadDoc, useFlow, REQUEST_DOCS } from '@/data/intake/flow'
import { CYCLE, inPeriod } from '@/data/intake/cycle'
import { entityById } from '@/data/mock/entities'
import { regRows, REG_STAGES } from '@/data/mock/registration'
import { resubmitRegistration, useEntityFlow, valuesOf, fieldLabel } from '@/data/entities/store'
import { formatIssue } from '@/data/entities/validate'
import { entityCode } from '@/lib/format'
import { Field } from './Field'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { PF_STAGE_SAY, PF_STAGE_TONE, isStrategic, pfOfEntity, typeAllowed, usePartners } from '@/data/partners/store'
import type { Reading } from '@/components/assistant'
import { PortalAccount } from './PortalAccount'
import { PortalNotices } from './PortalNotices'
import { ReadOnly } from '@/components/shell/ReadOnly'

/* Entity portal - "a screen that only shows its own application."

   Note: the most important thing about this screen is that it's empty on purpose. An entity opens
   it and finds one application, with no reel, no projects, no payments - and if that's not stated,
   it will read as a broken system or a missing permission. So the screen states outright that this
   is all it has until the application is approved, and that the entity's full account gets created
   at that point (rule 2).

   Note: status is stated as the action required, not by its label. "Awaiting completion" is an
   administrative label that tells the entity who's holding it, not what to do - the line underneath
   is what actually says "upload what's missing and resubmit". Same lesson as elsewhere: a final
   status (rejected) with "pending" written next to it promises something that isn't coming.

   Note: editing is open in exactly one state. An application under review can't be edited, or a
   reviewer would be reading one version while the entity edits a different one at the same moment.

   Note: this screen used to explain the system instead of getting the application through. It had
   "what reaches you" (a table of emails you'd receive) and "the five statuses" (rule 26's states) -
   system explanations for someone with exactly one thing to do: upload what's missing and submit.
   Worse, the button used to send them back to the start of the form (`?step=form`) just to upload
   two documents.

   So the screen is now two things:
   - right: the application card - the stepper on top like the rest of the system, the review
   outcome by name below it, each missing item with its own upload button in place, and one button
   to resubmit.
   - left: correspondence - the exact same project thread (`Thread`), because whatever's stuck with
   the entity gets resolved with a word, not a form. */

/** The application the entity is viewing - determined by the URL in this model. */
const DEFAULT_REQ = 'REQ-2026-947139'

export default function PortalPage() {
  const navigate = useNavigate()
  const { values } = useQueryParams(['req', 'entity'])
  const preview = isPortalPreview()
  useFlow()
  usePartners()
  useEntityFlow()
  /* Once approved the portal is the entity's own · its projects, its file and a new request
     (0.2.1 · 3.2.5 · 2.3.upd-1). `?entity=` opens an entity's portal; an entity registered before
     the portal existed has no registration request, so its portal starts at its account. */
  const ent = values.entity ? entityById(values.entity) : undefined
  const r = (values.req ? regRequestById(values.req) : undefined)
    ?? (ent ? regRows.find((x) => x.entityId === ent.id) : undefined)
    ?? (ent ? undefined : regRequestById(DEFAULT_REQ))
  const legacy = !r && Boolean(ent)
  const reqOf = r ?? regRequestById(DEFAULT_REQ)!
  const entityId = ent ? ent.id : reqOf.state === 'approved' ? reqOf.entityId : undefined
  const account = entityId ? entityById(entityId) : undefined
  const mine = entityId ? projectsOfEntity(entityId).filter((p) => p.statusGroup === 'في الدراسة' || p.stage === 'استكمال بيانات المشروع') : []

  const view = portalViewOf(reqOf.state)
  /* The entity's plans - read from the `entityId` created after approval. */
  const plans = entityId ? plansOfEntity(entityId) : []
  useAgreements()
  const agrs = entityId
    ? agreements.filter((x) => x.entityId === entityId && x.stage !== 'draft' && x.stage !== 'manager' && x.stage !== 'executive' && !(x.stage === 'returned' && agrFlowOf(x.id).returnedTo === 'manager'))
      .sort((x, y) => Number(agrHolder(y) === 'entity') - Number(agrHolder(x) === 'entity'))
    : []
  usePayments()
  /* The entity's requests · the ones waiting on it first (returned, or a permit for its justification) */
  const pays = entityId
    ? requestsOfEntity(entityId).slice().sort((x, y) => Number(y.state === 'returned') - Number(x.state === 'returned'))
    : []
  const due = entityId ? payableProjects(entityId).filter((p) => p.can && p.open > 0) : []
  useClosing()
  /* 10.2.2 · the closings waiting on the entity first · and its distress cases (10.9) */
  const closes = entityId
    ? closeRows.filter((c) => c.entityId === entityId).sort((x, y) => Number(y.stage === 'draft' || y.stage === 'returned') - Number(x.stage === 'draft' || x.stage === 'returned'))
    : []
  const cases = entityId ? CASES.filter((c) => c.entityId === entityId) : []
  /* The entity's assistant · what waits on it across its procedures, the most pressing first */
  const portalReadings: Reading[] = [
    ...agrs.filter((ag) => agrHolder(ag) === 'entity').map((ag) => ({ id: `pt-ag-${ag.id}`, kind: 'flag' as const, label: 'اتفاقية بانتظار توقيعك', text: ag.projectName, src: 'إجراء الاتفاقيات' })),
    ...pays.filter((r) => r.state === 'returned').map((r) => ({ id: `pt-pay-${r.id}`, kind: 'flag' as const, label: r.permit ? 'إذن صرف بانتظار مسوّغاتك' : 'طلب صرف مُعاد للاستكمال', text: `${r.projectName} · الدفعة ${r.no}${r.note ? ` · ${r.note}` : ''}`, src: 'إجراء الصرف' })),
    ...closes.filter((c) => c.stage === 'draft' || c.stage === 'returned').map((c) => ({ id: `pt-cl-${c.id}`, kind: 'flag' as const, label: 'تقرير ختامي مطلوب', text: `${c.projectName}${c.note ? ` · ${c.note}` : ''}`, src: 'إجراء الإغلاق' })),
    ...cases.filter((c) => c.stage === 'settle' || (c.recovery && c.recovery.state === 'open')).map((c) => ({ id: `pt-cs-${c.id}`, kind: 'flag' as const, label: c.stage === 'settle' ? 'تسوية المصروف' : 'مبلغ مطلوب إعادته', text: c.projectName, src: 'حالات التعثر' })),
    ...due.map((d) => ({ id: `pt-due-${d.id}`, kind: 'note' as const, label: 'دفعة مستحقة', metric: { value: String(d.open), unit: d.open === 1 ? 'دفعة' : 'دفعات' }, text: `${d.name} · يمكنك طلب صرفها الآن.`, src: 'جدول الدفعات المعتمد' })),
  ]
  const missing = regMissingDocs(reqOf)

  /* Note: upload here needs to actually do something, and so does submit after it. "Upload" and
     "resubmit" used to be buttons with no action - and this is the one thing the entity came to the
     portal for. Now every uploaded document is marked with its file name, the button enables once
     nothing is missing, and submitting actually moves the application to "under review" on screen. */
  const [up, setUp] = useState<Record<string, string>>({})
  const [resent, setResent] = useState(false)
  const short = missing.filter((d) => !up[d.key])
  /* 2.2.14 · the fields the reviewer flagged open for editing, and only those */
  const flagged = reqOf.state === 'completion' ? reqOf.returnFields ?? [] : []
  const [edit, setEdit] = useState<Record<string, string>>(() => valuesOf(reqOf))
  const editErr = Object.fromEntries(flagged.map((k) => {
    const f = REG_STAGES.flatMap((x) => x.fields).find((y) => y.key === k)
    return [k, f ? formatIssue(k, f.kind, edit[k] ?? '') || (f.req && !edit[k]?.trim() ? 'حقل إلزامي.' : '') : '']
  }).filter(([, e]) => e))
  const resend = () => {
    const changed = Object.fromEntries(flagged.map((k) => [k, edit[k] ?? '']))
    resubmitRegistration(reqOf.id, changed, Object.keys(up), reqOf.clerkName || reqOf.name)
    setResent(true)
  }

  /* Note: the path shown is the application's own stages, not our internal ones. The entity never
     sees "with the system admin" or "with the grants manager" - those describe who's holding it on
     our side, and the entity can't act on them, so they turn into worry rather than information
     (same lesson as elsewhere). */
  /* Note: a returned application goes back to the first stage. `completion` used to be computed
     alongside the decision (`at = 2`), so the stepper would say "institution review complete" while
     the tag above it said "awaiting completion" - two things contradicting each other on the same
     card. An application actually returned with comments is with the entity again, so its stage is
     the first one. */
  const done = (k: string) => {
    const order = ['draft', 'review', 'decided']
    /* After "resubmit" the application really is back with the institution, so the stage moves. */
    const at = resent
      ? 1
      : reqOf.state === 'draft' || reqOf.state === 'completion'
        ? 0
        : reqOf.state === 'review' ? 1 : 2
    return order.indexOf(k) < at ? 'done' : order.indexOf(k) === at ? 'now' : 'todo'
  }

  /* Note: no `note` in the stepper. The horizontal bar answers one question: where are you and how
     far along - a second line under every stage turns it into a paragraph, and that text already
     lives below the bar. Same rule applied to the registration stepper. */
  /* Note: the decision made is a result, not an ongoing stage - approved (check) or rejected (x).
     `at = 2` used to keep "decision" as the current stage even after rejection. */
  const outcome: StepItem['state'] | null =
    resent ? null : reqOf.state === 'approved' ? 'done' : reqOf.state === 'rejected' ? 'no' : null
  const steps: StepItem[] = [
    { label: 'تجهيز الطلب', state: done('draft') },
    { label: 'مراجعة المؤسسة', state: done('review') },
    { label: reqOf.state === 'rejected' && !resent ? 'القرار · مرفوض' : 'القرار', state: outcome ?? done('decided') },
  ]

  const thread = regThread(reqOf.state, reqOf.name)

  /* Note: no reel and no internal assistant - exactly like the registration screen. Whoever opens
     this is an entity with no system account, and a reel featuring "projects" and "budget" promises
     things that aren't theirs - the first click would have dropped them onto a login screen with no
     explanation why. The shared shell matches `RegisterPage`, so the entity sees the same
     surroundings it registered from. */
  const body = (
      <div className="viewstack">
        <div className="screen col hasg2">
          <div className="regtop">
            <Logo className="mark mark-38" />
            <div>
              <b>منح أبانمي</b>
              <span className="sub">بوّابة الجهة · طلبك أنت</span>
            </div>
            <span className="pc-sp" />
            {/* Batch 3 · the entity's bell · its own notices, on its own session only */}
            {!preview && <NotificationBell user={{ name: account ? account.name : reqOf.name }} entity={account ? account.name : reqOf.name} place="top" />}
            {/* Note: this used to be a button with no `onClick` - it looked like logout, could be
                clicked, and nothing happened; the client caught it. It now clears the session and
                returns to the login screen with `replace`, so a browser "back" doesn't reopen the
                portal after logout. */}
            <button
              className="btn btn-2 btn-sm"
              onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}
            >
              <Icon name={icons.logout} size="sm" />
              تسجيل الخروج
            </button>
          </div>

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{legacy && account ? account.name : reqOf.name}</h1>
              {legacy && account
                ? <p className="sub mt-1">حساب الجهة <CopyId>{entityCode(account.id, account.registeredAt)}</CopyId> · مسجّلة منذ <DateText>{account.registeredAt}</DateText></p>
                : <p className="sub mt-1">
                    طلب تسجيل <CopyId>{reqOf.id}</CopyId> · أُرسل في{' '}
                    <DateText>{reqOf.submittedAt}</DateText>
                  </p>}
            </div>
          </header>

          {/* Note: the stepper sits in its own section, like the rest of the system. It used to
              live inside the application card here, while every other screen (portal registration,
              internal registration, and the plan page) treats it as its own `regsteps` card above
              the content - the same element in two different places. */}
          {!legacy && (
            <Glass className="regsteps">
              <Steps items={steps} flow="stepper" />
            </Glass>
          )}

          {/* Re-audit 7 Oct · staff read the portal as the entity sees it, and act on nothing */}
          {preview && <p className="sub cnote"><Tag tone="mute">معاينة للقراءة فقط</Tag> تقرأ بوابة الجهة كما تراها · الإجراءات للجهة من حسابها</p>}
          <ReadOnly on={preview}>
          <div className="g2">
            {/* Right - application card
                Everything the entity needs in one card: what the institution said, what's missing,
                and a submit button, in that order. */}
            <div className="col">
              {account && <PortalAccount e={account} />}
              {!legacy && <>
              <Glass className="ptl-req">
                <Head
                  title="طلبك"
                  /* The tag follows submission - without it the card says "awaiting completion"
                     while the stepper above it says "review". */
                  meta={resent
                    ? <Tag tone={REG_TONE.review}>{REG_STATE_SAY.review}</Tag>
                    : <Tag tone={REG_TONE[reqOf.state]}>{REG_STATE_SAY[reqOf.state]}</Tag>}
                />

                {!resent && <p className="sub cnote">{view.say}</p>}

                {/* Review outcome - what the institution said, verbatim */}
                {reqOf.note && (
                  <div className={`ptl-res${reqOf.state === 'rejected' ? ' no' : ''}`}>
                    <Icon name={icons.alert} size="sm" />
                    <div>
                      <b>{reqOf.state === 'rejected' ? 'سبب الرفض' : 'ما طلبته المؤسسة'}</b>
                      <p>{reqOf.note}</p>
                    </div>
                  </div>
                )}

                {/* What's missing - each with its own upload button in place
                    Note: upload happens from here, not from the start of the form. The old button
                    used to send `?step=form`, meaning uploading two documents meant passing through
                    six already-filled stages.

                    Note: via `DocList`, not a list written here. `.ptl-short` was hand-written and
                    is a fifth version of the same table we unified elsewhere yesterday - the exact
                    mistake `onedoc` was written to prevent, broken again a day later. The checker
                    catches `.dstat` and `DocDownload`, and wouldn't have caught a list built from
                    scratch. */}
                {/* Note: the row stays after upload and flips to "uploaded" - if it disappeared,
                    the entity wouldn't know whether it uploaded or lost the file, and the card
                    would shrink under their hand while they upload the next one. */}
                {/* 2.2.14 · what the reviewer flagged opens for editing here, nothing else */}
                {view.editable && !resent && flagged.length > 0 && (
                  <>
                    <Head title="الحقول المطلوب تعديلها" meta={<span className="sub"><Num>{flagged.length}</Num> حقول</span>} />
                    <div className="regfields">
                      {flagged.map((k) => {
                        const f = REG_STAGES.flatMap((x) => x.fields).find((y) => y.key === k)
                        if (!f) return <p key={k} className="sub cnote">{fieldLabel(k)}</p>
                        return (
                          <Field key={k} f={f} value={edit[k] ?? ''} parent={f.dependsOn ? edit[f.dependsOn] ?? '' : ''}
                            onChange={(x) => setEdit((s) => ({ ...s, [k]: x }))} error={editErr[k]} />
                        )
                      })}
                    </div>
                  </>
                )}

                {view.editable && !resent && missing.length > 0 && (
                  <>
                    <Head
                      title="المستندات الناقصة"
                      /* A count inside the status card above - text, not a second tag. */
                      meta={<span className="sub">{short.length > 0
                        ? <><Num>{short.length}</Num> {nounAfter(short.length, NOUN.doc)}</>
                        : 'اكتمل'}</span>}
                    />
                    <DocList
                      label="المستندات الناقصة في الطلب"
                      rows={missing.map((d) => ({
                        name: up[d.key] ?? d.label,
                        meta: up[d.key] ? `${d.label} · بانتظار الإرسال` : undefined,
                        uploaded: Boolean(up[d.key]),
                        required: true,
                        action: up[d.key]
                          ? undefined
                          : (
                            <UploadButton
                              label={`ارفع ${d.label}`}
                              onPick={(f) => setUp((x) => ({ ...x, [d.key]: f.name }))}
                            />
                          ),
                      }))}
                    />
                  </>
                )}

                {resent && (
                  <p className="sub cnote">
                    أُرسل الطلب إلى المؤسسة وحالته «قيد المراجعة» · ستصل رسالة إلى
                    بريد الحساب فور مراجعته.
                  </p>
                )}

                {/* Note: one button, stating what happens next. "Resubmit", not "edit": the entity
                    isn't editing its data, it's completing what's missing and returning the
                    application for review. */}
                <footer className="payq-f">
                  <span className="sub payq-when">
                    أُرسل <DateText>{reqOf.submittedAt}</DateText>
                    {' · '}<Mono>{reqOf.id}</Mono>
                  </span>
                  {view.act && !resent && (
                    <button
                      className="btn btn-p"
                      disabled={view.editable && (short.length > 0 || Object.keys(editErr).length > 0)}
                      title={view.editable && short.length > 0
                        ? 'ارفع المستندات الناقصة أولًا'
                        : view.editable && Object.keys(editErr).length > 0 ? 'صحّح الحقول المطلوبة أولًا' : undefined}
                      onClick={() => {
                        if (reqOf.state === 'approved') navigate(`${ROUTES.entityPortal}?entity=${reqOf.entityId ?? ''}`)
                        else resend()
                      }}
                    >
                      <Icon name={reqOf.state === 'approved' ? icons.entity : icons.send} size="sm" />
                      {reqOf.state === 'approved' ? view.act : 'أعد إرسال الطلب'}
                    </button>
                  )}
                </footer>
              </Glass>

              <Glass>
                <Head title="بيانات الطلب" meta={<span className="sub">كما أرسلتها الجهة</span>} />
                <KV
                  rows={[
                    { k: 'التصنيف', v: reqOf.type },
                    { k: 'جهة الإشراف الفني', v: reqOf.licensor },
                    { k: 'المنطقة', v: `${reqOf.region} · ${reqOf.city}` },
                    { k: 'رقم الترخيص', v: <Mono>{reqOf.licenseNo}</Mono> },
                    {
                      k: 'بريد الحساب',
                      v: <a className="tlink" href={`mailto:${reqOf.acctEmail}`}><Mono>{reqOf.acctEmail}</Mono></a>,
                    },
                    { k: 'المستندات المرفوعة', v: <><Num>{reqOf.docs.length}</Num> {nounAfter(reqOf.docs.length, NOUN.doc)}</> },
                  ]}
                />
                {!view.editable && (
                  <p className="sub cnote">
                    البيانات مقفلة الآن · وتُفتح للتعديل عندما تعيد المؤسسة الطلب
                    للاستكمال، حتى لا تُعدَّل نسخة بينما يقرأ المراجع نسخة أخرى.
                  </p>
                )}
              </Glass>

              <Glass>
                <Head
                  title="الحسابات البنكية"
                  meta={<span className="sub"><Num>{reqOf.banks.length}</Num> حساب</span>}
                />
                {/* Note: the bank certificate is a `DocList` row like any attachment. `DocFile`
                    used to stand alone inside the account column - and `.dfile-b`'s padding is
                    built for a table row (44px thumbnail + padding = row height), so outside a
                    table that padding adds to the space above and below it, leaving the row loose
                    and unlike its counterpart on the project page (which the client has seen). */}
                <ul className="rgbanks">
                  {reqOf.banks.map((b, i) => (
                    <li key={b.id}>
                      <span className="rgbank-n num">{i + 1}</span>
                      <div className="rgbank-b">
                        <div className="rgbank-t">
                          <b>{b.bankName}</b>
                          <span className="sub">· {b.bankHolder}</span>
                        </div>
                        <div className="sub"><Mono>{b.iban}</Mono></div>
                        <DocList
                          label={`الشهادة البنكية · ${b.bankName}`}
                          rows={[{
                            name: b.doc || `${BANK_DOC_LABEL}.pdf`,
                            meta: BANK_DOC_LABEL,
                            uploaded: Boolean(b.doc),
                          }]}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </Glass>
              </>}

              {/* Cross · notifications · what the foundation told this entity, and on which channels */}
              <PortalNotices name={account ? account.name : reqOf.name} />

              {/* BPD-013 · a strategic partner's own portfolios · it requests, adds its sub-projects,
                  updates execution and files the final report · it decides nothing (13.2.3 · 13.2.20) */}
              {entityId && isStrategic(entityId) && (
                <Glass>
                  <Head title="محافظك" meta={typeAllowed(entityId, 'portfolio') ? <Link className="btn btn-p btn-sm" to={`${ROUTES.portfolioNew}?as=partner&entity=${entityId}`}>طلب محفظة</Link> : undefined} />
                  <ul className="ptn-slots">
                    {pfOfEntity(entityId).map((pf) => (
                      <li key={pf.id}>
                        <Link className="tlink" to={`${ROUTES.portfolio(pf.id)}?as=partner`}>{pf.name}</Link>
                        <Tag tone={PF_STAGE_TONE[pf.stage]}>{PF_STAGE_SAY[pf.stage]}</Tag>
                        <span className="sub">{pf.items.filter((x) => x.state === 'approved').length} مشروع معتمد · {pf.items.filter((x) => x.state === 'draft').length} مسودة</span>
                      </li>
                    ))}
                    {!pfOfEntity(entityId).length && <li className="sub">لا محافظ بعد.</li>}
                  </ul>
                </Glass>
              )}

              {/* The entity's requests · procedure 3. A request returned for completion is the one
                  thing the entity acts on here: upload what's asked and send it back (3.4.16). */}
              {entityId && (
                <Glass>
                  <Head
                    title="طلبات مشاريعك"
                    meta={account && !account.canApply
                      ? <Tag tone="mute">التقديم موقوف</Tag>
                      : inPeriod()
                      ? <Link className="btn btn-p btn-sm" to={`${ROUTES.projectNew}?as=entity&entity=${entityId}`}>
                          <Icon name={icons.plus} size="sm" />
                          قدّم طلب مشروع
                        </Link>
                      : <Tag tone="mute">البوابة مغلقة</Tag>}
                  />
                  <p className="sub cnote">
                    {CYCLE.name} · التقديم مفتوح حتى <DateText>{CYCLE.to}</DateText>
                  </p>
                  {mine.length === 0 && <p className="sub cnote">لا طلبات قيد الدراسة لديك الآن.</p>}
                  <ul className="ptl-miss ptl-plans">
                    {mine.map((p) => {
                      const f = flowOf(p.id)
                      const back = p.stage === 'استكمال بيانات المشروع'
                      const short = missingDocs(p.id)
                      return (
                        <li key={p.id} className="ptl-rq">
                          <Icon name={icons.navProjects} size="sm" />
                          <span className="ptl-rq-b">
                            <b>{p.name}</b>
                            <span className="sub">
                              {back ? `مُعاد للاستكمال · ${f.completionNote ?? 'راجع ملاحظة المشرف'}` : 'قيد الدراسة لدى المؤسسة'}
                            </span>
                            {back && short.length > 0 && (
                              <span className="ptl-rq-up">
                                {REQUEST_DOCS.filter((d) => short.includes(d.label)).map((d) => (
                                  <span key={d.key} className="ptl-rq-doc">
                                    <span className="sub">{d.label}</span>
                                    <UploadButton label={`ارفع ${d.label}`} onPick={(file) => uploadDoc(p.id, d.key, file.name, p.entityName)} />
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                          <span className="pc-sp" />
                          {back
                            ? <button className="btn btn-p btn-sm" disabled={short.length > 0} title={short.length ? 'ارفع المرفقات الناقصة أولًا' : undefined} onClick={() => resubmit(p.id, p.entityName)}>
                                <Icon name={icons.send} size="sm" />
                                أعد الإرسال
                              </button>
                            : <Tag tone="mute">قيد الدراسة</Tag>}
                        </li>
                      )
                    })}
                  </ul>
                </Glass>
              )}

              {/* The entity's agreements (8.2.23 · 8.2.24) · the one waiting for its signature first */}
              {entityId && agrs.length > 0 && (
                <Glass>
                  <Head title="اتفاقياتك" meta={<span className="sub"><Num>{agrs.length}</Num> اتفاقية</span>} />
                  <ul className="ptl-miss ptl-plans">
                    {agrs.map((ag) => (
                      <li key={ag.id}>
                        <Icon name={icons.doc} size="sm" />
                        <Link className="lnk" to={`${ROUTES.agreement(ag.id)}?as=entity`}>{ag.projectName}</Link>
                        <span className="pc-sp" />
                        <span className="sub">{agrStageSay(ag)}</span>
                        {agrHolder(ag) === 'entity' && <Tag tone="warn">بانتظار توقيعك</Tag>}
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}

              {/* Disbursement (9.2.2 · 9.4.19) · what's due to request, then each request in the
                  entity's own five states, with what it should do now */}
              {entityId && (pays.length > 0 || due.length > 0) && (
                <Glass>
                  <Head title="طلبات الصرف" meta={<span className="sub"><Num>{pays.length}</Num> {nounAfter(pays.length, NOUN.request)}</span>} />
                  <ul className="ptl-miss ptl-plans">
                    {due.map((d) => (
                      <li key={`due-${d.id}`}>
                        <Icon name={icons.pay} size="sm" />
                        <span className="trim1">{d.name}</span>
                        <span className="pc-sp" />
                        <Tag tone="teal"><Num>{d.open}</Num> مستحقة</Tag>
                        <Link className="btn btn-p btn-sm" to={`${ROUTES.paymentNew(d.id)}&as=entity`}>اطلب الصرف</Link>
                      </li>
                    ))}
                    {pays.map((r) => {
                      const st = entityStateOf(r.state)
                      const label = r.permit ? 'إذن صرف بانتظار مسوّغاتك' : st.label
                      return (
                        <li key={r.id}>
                          <Icon name={icons.doc} size="sm" />
                          <Link className="lnk" to={`${ROUTES.payment(r.id)}?as=entity`}>{r.projectName} · الدفعة <Num>{r.no}</Num></Link>
                          <span className="pc-sp" />
                          {st.act && <span className="sub">{st.act}</span>}
                          <Tag tone={st.tone}>{label}</Tag>
                        </li>
                      )
                    })}
                  </ul>
                </Glass>
              )}

              {entityId && (closes.length > 0 || cases.length > 0) && (
                <Glass>
                  <Head title="إغلاق مشاريعك" meta={<span className="sub"><Num>{closes.length + cases.length}</Num> إجراء</span>} />
                  <ul className="ptl-miss ptl-plans">
                    {closes.map((c) => (
                      <li key={c.id}>
                        <Icon name={icons.doc} size="sm" />
                        <Link className="lnk" to={`${ROUTES.closing(c.id)}?as=entity`}>{c.projectName}</Link>
                        <span className="pc-sp" />
                        {(c.stage === 'draft' || c.stage === 'returned') && <span className="sub">اكتب التقرير الختامي وأرسله</span>}
                        <Tag tone={c.stage === 'draft' || c.stage === 'returned' ? 'warn' : 'mute'}>{closeStageLabel(c.stage)}</Tag>
                      </li>
                    ))}
                    {cases.map((c) => (
                      <li key={c.id}>
                        <Icon name={icons.alert} size="sm" />
                        <Link className="lnk" to={`${ROUTES.distress(c.id)}?as=entity`}>{CASE_KIND_SAY[c.kind]} · {c.projectName}</Link>
                        <span className="pc-sp" />
                        <Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}

              {/* Entity plans - rule 12.
                  Note: this only appears after approval. Before that, the entity has no projects at
                  all, so it has no plans - and an empty card labeled "your plans" on a screen still
                  awaiting a decision implies something is missing, when really it just hasn't
                  started. */}
              {entityId && plans.length > 0 && (
                <Glass>
                  <Head
                    title="خطط مشاريعك"
                    meta={<span className="sub"><Num>{plans.length}</Num> {nounAfter(plans.length, NOUN.plan)}</span>}
                  />
                  {/* Note: this sentence is what prevents the biggest misunderstanding in this
                      module: "uploaded the evidence" isn't "counted as complete". */}
                  <p className="sub cnote">
                    ترفع الجهة الشواهد وتُبلغ باكتمال النشاط · ويُحتسب الإنجاز بعد
                    مراجعة مشرف المنح وقبوله{/* doc rule 14 */}.
                  </p>
                  <ul className="ptl-miss ptl-plans">
                    {plans.map((pl) => (
                      <li key={pl.id}>
                        <Icon name={icons.plan} size="sm" />
                        <Link className="lnk" to={`${ROUTES.plan(pl.id)}?as=entity`}>
                          {pl.projectName}
                        </Link>
                        <span className="pc-sp" />
                        <span className="sub">{planStageLabel(pl.stage)}</span>
                        {waitingReview(pl).length > 0 && (
                          <Tag tone="warn">
                            <Num>{waitingReview(pl).length}</Num> بانتظار المشرف
                          </Tag>
                        )}
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}

            {/* Correspondence · in the main column, the end column is the assistant's alone
                Note: the exact same `Thread` as the project page - whatever's stuck with the entity
                gets resolved with a word, not a form, and the channel is the natural place for a
                question. */}
              <Glass className="ptl-talk">
                <Head
                  title="التواصل مع المؤسسة"
                  /* Note: the counter shows only when there are messages - "none" next to a
                     placeholder saying the same thing in a full sentence is redundant. */
                  meta={thread.length > 0
                    ? <span className="sub"><Num>{thread.length}</Num> رسائل</span>
                    : undefined}
                />
                <Thread
                  messages={thread}
                  entityName={reqOf.name}
                  me="entity"
                  placeholder="اكتب رسالة إلى المؤسسة…"
                  emptyTitle="قناة التواصل مفتوحة عند الحاجة"
                  emptyNote="راسل المؤسسة إن كان في الطلب ما يحتاج إلى توضيح · مثل مستند لا يُعرف مصدره، أو ملاحظة تحتاج إلى شرح. أما حالة الطلب فتُتابع من البطاقة المجاورة."
                />
              </Glass>

              {/* Note: the paragraph "this account is for your application..." was removed at the
                  client's request - it explained rule 2 to someone here to finish two documents,
                  and the header above already says "entity portal - your application". */}
            </div>

            <AssistantAside
              title="ما ينتظرك"
              cta="اعرض ما ينتظرك"
              empty="لا شيء ينتظرك الآن · ستصلك الإشعارات حين يحتاج إجراء إلى ردّك."
              ask={false}
              readings={portalReadings}
            />
          </div>
          </ReadOnly>

          <p className="sub tcen cnote">
            ليس طلبك؟{' '}
            <Link className="lnk" to={ROUTES.entityRegister}>ابدأ طلب تسجيل جديد</Link>
            {!legacy && <>{' · '}{readDate(reqOf.submittedAt)}</>}
          </p>
        </div>
      </div>
  )

  return (
    <>
      <Background />
      <div className="app">
        <div className="shell">{body}</div>
      </div>
    </>
  )
}
