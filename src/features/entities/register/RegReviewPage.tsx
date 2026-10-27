import { useDocReads } from '@/lib/docCache'
import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { textIssues } from '@/lib/textCheck'
import { ibanValid } from '@/lib/iban'
import { useMemo, useState } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { registrationAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BankGrid, BankCard, FieldMultiSelect,
  DateText, EditButton, EditModal, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Num, OrgName, Person, StepArc, Tabs, Tag, type EditField, type GateStep,
  blockerCount, type Blocker, type StepItem } from '@/components/ui'
import { DocFile, DocList, UploadButton } from '@/components/docs'
import { Crumbs } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nounAfter } from '@/lib/format'
import { useQueryParams } from '@/hooks/useQueryParams'
import { pickedSay, type PickedReason } from '@/data/entities/reasons'
import { ReasonDialog } from '@/features/entities/ReasonDialog'
import { REQ_TABS, STOP_NOUN } from './reqTabs'
import { entityRows } from '@/data/mock/entities'
import {
  BANK_DOC_LABEL, BANK_REJECTS, REG_DOCS, REG_REJECT_REASONS, REG_STATE_SAY, REG_STATE_WHO,
  docRequired, licenseClash, partnerKind, regMissingDocs, regRequestById, type RegRejectReason,
} from '@/data/mock/registration'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { canAdminEdit, canDecide, decideRegistration, editRegistration, fieldLabel, regHistory, returnRegistration, useEntityFlow } from '@/data/entities/store'
import { Modal } from '@/features/entities/SelectionActions'
import { duplicates, expiredDocs, formatIssue } from '@/data/entities/validate'
import { meOf, readRole, roleByKey } from '@/data/roles'
import { BANKS, REG_STAGES, citiesOf } from '@/data/mock/registration'
import { ENTITY_RULES } from '@/data/entities/rules'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { regOutcome } from '@/data/shared/outcome'

/* Registration request review - system admin's screen.

   Note: the reviewer is reviewing a declaration, not a record. Every value on this screen was
   entered by the entity about itself through a public portal, so the governance level is tagged
   "entity declaration", and the license number is verified in front of the reviewer, not after the
   decision. What the reviewer needs isn't "what is the data" but "what hasn't been verified".

   Three outcomes, plus a fourth for the bank:

     Approve and activate  - the entity is generated here and the username is sent
     Return for completion - goes back to the entity with a note (rule 26)
     Reject and suspend    - archived with a reason (rules 28 and 31)

   Client meeting 23 Oct · the decision is picked first, then the reason: return and reject each open
   a popup with the reasons kept in the entity settings, or «أخرى» with a written reason (rule 31
   still holds · no return or rejection without one). The reason lands in the request's log with
   who and when. The inline note field that sat in the dock is gone.

   Note: bank account approval is separate - the system has two bank screens and seven coded
   rejection reasons, so the bank makes its own decision even when tied to the same request (rule
   11).

   Note: there is no delete button. Rule 28: deletion is never allowed, only archive or deactivate.
   This absence is documented on the screen because an absence doesn't explain itself. */

type Outcome = 'approve' | 'return' | 'reject'

/** A reason picked in settings, mapped to the coded key the rejection indicator counts */
const codeOf = (p: PickedReason): RegRejectReason => REG_REJECT_REASONS.find((x) => x.label === p.reason)?.key ?? 'other'

const OUT_SAY: Record<Outcome, string> = {
  approve: 'اعتماد وتفعيل · أُنشئت الجهة وأُرسل اسم المستخدم',
  return: 'إعادة للاستكمال · أُعيد الطلب إلى الجهة مع الملاحظة',
  reject: 'رفض وإيقاف · أُرشف الطلب بسببه',
}

export default function RegReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const flowV = useEntityFlow()
  useDocReads() /* 2.6.4 · the documents' content once it's read */
  const r = id ? regRequestById(id) : undefined
  /* Client 23 Oct · the decision is picked in the dock, its reason in a popup */
  const [ask, setAsk] = useState<'return' | 'reject' | null>(null)
  const { values: q, set: setQ } = useQueryParams(['tab'])
  const tab = REQ_TABS.some((t) => t.slug === q.tab) ? (q.tab as string) : 'data'
  const [taken, setTaken] = useState<Outcome | null>(null)
  /* One decision per account (2.2.15) · '' accepted, otherwise one of the coded reasons */
  const [bankNo, setBankNo] = useState<Record<string, string>>({})
  /* The fields a return flags · the entity may edit these and only these (2.2.14) */
  const [flag, setFlag] = useState<string[]>([])
  /* v3 · 2.4.6 · legible documents · the system can only measure size, so the reviewer confirms
     reading them · approval waits for it */
  const [legible, setLegible] = useState(false)
  const mobile = useIsMobile()
  /* Client 23 Oct (the recording · 37:02) · «ما يمنع» opens in a popup from the action bar · every action on the screen sits in the bar, never inside a block */
  const [stopOpen, setStopOpen] = useState(false)
  const [editing, setEditing] = useState<'def' | 'contact' | string | null>(null)
  const role = readRole()
  const me = meOf(role)
  const mayApprove = canDecide('approve', role)
  const mayReturn = canDecide('return', role)
  const deciders = ENTITY_RULES.approveBy.map((k) => roleByKey(k).title).join(' أو ')

  /* A wrong request ID is not the same as an empty request - same lesson learned on the
     disbursement screen: a screen that renders fine on `undefined` still looks "healthy", so every
     check tool returns green while measuring the wrong screen. */
  const missingDocs = useMemo(() => (r ? regMissingDocs(r) : []), [r, flowV])
  const clash = useMemo(
    () => (r ? licenseClash(r.licenseNo, r.type, entityRows.filter((e) => e.id !== r.entityId)) : null),
    [r, flowV],
  )
  /* What the request carries that a person must look at (2.4.5 · 2.4.6 · 2.4.10) */
  const dups = useMemo(() => (r && r.state !== 'approved' ? duplicates(r, r.banks, { exceptReq: r.id }) : []), [r, flowV])
  const stale = useMemo(() => (r ? expiredDocs({ licenseEndsAt: r.licenseEndsAt, boardEndsAt: r.boardEndsAt }, r.docs) : []), [r, flowV])
  const badFormat = useMemo(() => (r
    ? REG_STAGES.flatMap((st) => st.fields).map((f) => ({ f, e: formatIssue(f.key, f.kind, String((r as unknown as Record<string, unknown>)[f.key] ?? '')) }))
      .filter((x) => x.e && !/X/.test(String((r as unknown as Record<string, unknown>)[x.f.key] ?? '')))
    : []), [r, flowV])
  const warnFiles = r?.files ? Object.entries(r.files).filter(([, f]) => f.warn) : []

  if (!r) {
    return (
      <AppLayout assistantContext={assistFor.page('طلبات تسجيل الجهات')}>
        <div className="viewstack">
          <div className="screen col">
            {/* Empty state: no request, so there's no last stage to name. */}
            <Crumbs
              items={[
                { label: 'الجهات', to: ROUTES.entities },
                { label: 'طلبات التسجيل' },
              ]}
            />
            <Glass>
              <Empty
                title="الطلب غير موجود."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>
                    العودة إلى صندوق الطلبات
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const decided = r.state === 'approved' || r.state === 'rejected'
  const open = r.state === 'review'
  /* Re-audit 7 Oct · 2.4.6 · an accepted account with a failing IBAN blocks the approval · reject the
     account, or return the request for its correction */
  const badIban = r.banks.filter((b) => !bankNo[b.id] && !ibanValid(b.iban.replace(/\s/g, '')))
  /* Batch 7 · entities#11 · a duplicate showed red under «ما يمنع الاعتماد» and approval stayed open ·
     it blocks now, as on the update review (2.4.10) */
  /* v3 · 2.4.7 · a format error blocks too · and 2.4.6 · the documents' legibility confirmed */
  const blocked = missingDocs.length > 0 || Boolean(clash) || stale.length > 0 || badIban.length > 0 || dups.length > 0
    || badFormat.length > 0 || (open && !legible)
  /* Client 23 Oct · «الطلب متوقف للأسباب أدناه» · each blocker names the field or document it
     stands on, and where to see it */
  const noBank = r.banks.length > 0 && r.banks.every((b) => bankNo[b.id])
  const see = (to: string, at: string) => (
    <button type="button" className="lnk" onClick={() => { setStopOpen(false); setQ({ tab: to === 'data' ? undefined : to }); setTimeout(() => document.getElementById(at)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 0) }}>عرض</button>
  )
  const stops: Blocker[] = [
    ...(clash ? [{ head: 'رقم الترخيص', text: <>مسجَّل لـ«{clash.name}» بنفس التصنيف</>, why: see('data', 'rg-def') }] : []),
    ...missingDocs.map((d) => ({ head: d.label, text: 'مستند إلزامي لهذا التصنيف غير مرفوع', why: see('docs', 'rg-docs') })),
    ...stale.map((k) => ({ head: REG_DOCS.find((d) => d.key === k)?.label ?? k, text: 'منتهية عند التقديم', why: see('docs', 'rg-docs') })),
    ...badFormat.map((x) => ({ head: x.f.label, text: x.e, why: see('data', 'rg-def') })),
    ...dups.map((d) => ({ head: d.label, text: <>مكرَّر مع «{d.who}»</>, why: see('data', 'rg-def') })),
    ...badIban.map((b) => ({ head: `آيبان ${b.bankName}`, text: 'غير صحيح · ارفض الحساب أو أعد الطلب لتصحيحه', why: see('data', 'rg-banks') })),
    ...(noBank ? [{ head: 'الحسابات البنكية', text: 'لا حساب مقبول · يلزم حساب واحد على الأقل', why: see('data', 'rg-banks') }] : []),
    ...(open && !legible ? [{ head: 'الوثائق النظامية', text: 'لم يُؤكَّد وضوحها وقراءتها بعد · يؤكّدها المراجع بعلامة الفحص أدناه' }] : []),
  ]
  const nStop = blockerCount(stops)
  /* Client 24 Oct · each section's «تعديل» · the reviewer corrects the request's own data in a popup ·
     open requests only · whoever holds «تعديل بيانات الجهة» */
  const canEdit = !decided && canAdminEdit(readRole())
  const saveEdit = (changes: { key: string; label: string; from: string; to: string }[], reason: string) => editRegistration(r.id, changes, reason, me, readRole())
  const optsOf = (k: string) => REG_STAGES.flatMap((st) => st.fields).find((x) => x.key === k)?.options ?? []
  const rv = (k: string) => String((r as unknown as Record<string, unknown>)[k] ?? '')
  const editFields = (sec: string): EditField[] => {
    if (sec === 'def') return [
      { key: 'name', label: 'اسم الجهة', value: rv('name'), required: true },
      { key: 'type', label: 'تصنيف الجهة', kind: 'select', options: optsOf('type'), value: rv('type'), required: true },
      { key: 'licensor', label: 'جهة الإشراف الفني', kind: 'select', options: optsOf('licensor'), value: rv('licensor') },
      { key: 'licenseNo', label: 'رقم الترخيص', kind: 'digits', value: rv('licenseNo'), required: true },
      { key: 'region', label: 'المنطقة', kind: 'select', options: optsOf('region'), value: rv('region') },
      { key: 'city', label: 'المحافظة / المدينة', kind: 'select', dependsOn: { key: 'region', options: citiesOf }, value: rv('city') },
      { key: 'foundedAt', label: 'تاريخ التأسيس', kind: 'date', value: rv('foundedAt') },
      { key: 'licenseEndsAt', label: 'نهاية الترخيص', kind: 'date', value: rv('licenseEndsAt') },
      { key: 'boardEndsAt', label: 'نهاية تكليف المجلس', kind: 'date', value: rv('boardEndsAt') },
    ]
    if (sec === 'contact') return [
      { key: 'mobile', label: 'جوال الجهة', kind: 'tel', value: rv('mobile') },
      { key: 'email', label: 'البريد الإلكتروني', kind: 'email', value: rv('email') },
      { key: 'directorName', label: 'المدير التنفيذي', value: rv('directorName') },
      { key: 'clerkName', label: 'مدخل البيانات', value: rv('clerkName') },
      { key: 'clerkMobile', label: 'جوال مدخل البيانات', kind: 'tel', value: rv('clerkMobile') },
      { key: 'clerkEmail', label: 'بريد مدخل البيانات', kind: 'email', value: rv('clerkEmail') },
    ]
    const b = r.banks.find((x) => `bank:${x.id}` === sec)
    if (!b) return []
    return [
      { key: `bank:${b.id}:bankName`, label: 'اسم البنك', kind: 'select', options: BANKS, value: b.bankName, required: true },
      { key: `bank:${b.id}:bankHolder`, label: 'اسم الحساب', value: b.bankHolder, required: true },
      { key: `bank:${b.id}:shortName`, label: 'الاسم المختصر', value: b.shortName },
      { key: `bank:${b.id}:iban`, label: 'رقم الآيبان', value: b.iban, required: true },
    ]
  }
  const pick = (p: PickedReason) => {
    if (ask === 'return') { returnRegistration(r.id, pickedSay(p), flag, me); setTaken('return') }
    else if (ask === 'reject') { decideRegistration(r.id, 'reject', pickedSay(p), bankNo, me, codeOf(p)); setTaken('reject') }
    setAsk(null)
  }
  /* 17 Oct · the assistant suggests · the registration's own checks decide between approving and returning ·
     a rejection (archives the entity) stays the person's */
  type RegAct = { label: string; kind: string }
  const nextPlan = suggestNext<RegAct>([
    ...(mayApprove ? [{ label: 'اعتماد وتفعيل', kind: 'btn-p' }] : []),
    ...(mayReturn ? [{ label: 'إعادة للاستكمال', kind: 'btn-2' }] : []),
  ].filter(() => open), {
    issues: [
      ...missingDocs.map((d) => `ينقص مستند: ${d.label}`),
      ...stale.map((x) => `منتهي: ${x}`),
      ...badFormat.map((x) => `${x.f.label}: ${x.e}`),
      ...(clash ? [`رقم الترخيص مسجّل لجهة أخرى (${clash.name})`] : []),
      ...dups.map((d) => `مكرر مع سجل آخر: ${d.label}`),
      ...badIban.map((b) => `آيبان غير صحيح: ${b.iban}`),
    ],
    stops: (a) => (a.label === 'اعتماد وتفعيل' ? [...(!legible ? ['تأكيد وضوح الوثائق عمل المراجع'] : []), ...(r.banks.every((b) => bankNo[b.id]) ? ['لا حساب بنكيًا مقبولًا'] : [])] : []),
    good: [`${r.docs.length} مستندات مرفقة`, 'الحقول بصيغها الصحيحة', 'لا تكرار مع جهة مسجّلة'],
  })
  const nextExec = (a: RegAct, n: string) => {
    if (a.label === 'إعادة للاستكمال') { returnRegistration(r.id, n, flag, me); setTaken('return') }
    else { decideRegistration(r.id, 'approve', n, bankNo, me); setTaken('approve') }
    return []
  }

  const steps: StepItem[] = [
    { label: 'تعبئة الجهة وإرسالها', at: <DateText>{r.submittedAt}</DateText>, state: 'done' },
    {
      label: /* doc rule 19 */ 'تحقّق الجوال',
      note: r.clerkMobile,
      state: r.state === 'draft' ? 'todo' : 'done',
    },
    {
      label: 'مراجعة مسؤول النظام',
      note: REG_STATE_WHO[r.state],
      at: r.decidedAt ? <DateText>{r.decidedAt}</DateText> : '',
      state: r.state === 'rejected' ? 'no' : decided ? 'done' : r.state === 'draft' ? 'todo' : 'now',
    },
    {
      label: /* doc rule 2 */ 'إنشاء حساب الجهة',
      note: r.entityId ? `الجهة ${r.entityId}` : undefined,
      /* A rejected entity never gets an account created - this stage is skipped, not pending. */
      state: r.entityId ? 'done' : r.state === 'rejected' ? 'skip' : 'todo',
    },
  ]

  const ARC_STATE: Record<StepItem['state'], GateStep['state']> = { done: 'done', now: 'now', todo: 'pending', no: 'now', skip: 'skip' }
  const ARC_SEAT = ['الجهة المستفيدة', 'الجهة المستفيدة', 'مسؤول النظام', 'النظام']
  const arc: GateStep[] = steps.map((x, i) => ({
    label: ARC_SEAT[i]!,
    title: String(x.label),
    cap: String(x.label),
    state: ARC_STATE[x.state],
    lines: [x.note ?? null, x.at || null],
  }))

  return (
    <AppLayout assistantContext={assistFor.page('مراجعة طلب تسجيل', r.name)}>
      <div className="viewstack hasdock">
        {/* `hasg2` as on the request and agreement pages - content ends above the dock, so the
            gradient shows, and the side column keeps a margin from it. */}
        <div className="screen col hasg2">
          <Crumbs
            items={[
              { label: 'الجهات', to: ROUTES.entities },
              { label: 'طلبات التسجيل', to: ROUTES.entityRequests },
              { label: r.id },
            ]}
          />

          {/* Client sheet (#98) · the request's states read on the half-circle every other procedure
              carries · the title on the right, the arc opposite */}
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{r.name}</h1>
              <p className="sub mt-1">
                <Mono>{r.id}</Mono> · {r.type}
              </p>
            </div>
            <div className="pgates">
              <StepArc
                steps={arc}
                compact={mobile}
                aria={`مسار طلب التسجيل، ${REG_STATE_SAY[r.state]}`}
                holderKey={decided || r.state === 'rejected' ? 'اكتمل مسار الطلب' : 'صاحب الإجراء الآن'}
                holder={decided || r.state === 'rejected' ? REG_STATE_SAY[r.state] : REG_STATE_WHO[r.state]}
              />
            </div>
          </header>

          <div className="prow">
            <Tag tone="mute">{REG_STATE_SAY[r.state]}</Tag>
            {/* Client sheet 24 Oct (#95) · a decided request reads its outcome beside its state */}
            <OutcomeTag outcome={regOutcome(r.state)} />
          </div>

          <Tabs items={REQ_TABS} active={tab} onChange={(x) => setQ({ tab: x === 'data' ? undefined : x })} />

          <div className="g2">
            <div className="col">
              {tab === 'data' && (
                <>
              {/* Note: the verification card sits above the data on purpose - the reviewer needs
                  "what hasn't been verified" before "what the data is". */}
              {/* Client 23 Oct (twice · the recording and the sheet) · the card said «موقوف» while the
                  request was still under review, and mixed what passed with what blocks · it now says
                  «الطلب متوقف للأسباب أدناه» and lists the blockers by field, each with where to fix it;
                  what passed folds under them, and the advisory notes (wording, the governance claim)
                  sit apart since they never block */}
              <Glass id="rg-def">
                <Head title="التعريف" meta={canEdit ? <EditButton onClick={() => setEditing('def')} /> : undefined} />
                <KV
                  rows={[
                    { k: 'اسم الجهة', v: <OrgName name={r.name} /> },
                    /* Note: the entity never sees this type - it's set automatically because it
                       comes from the portal. The reviewer must see it because it gates conditions
                       in later steps, and it's the only thing on the page that isn't the entity's
                       own declaration. */
                    {
                      k: 'نوع الشراكة',
                      v: (
                        <span className="kvpair">
                          {partnerKind(r.partner).label}
                          <Tag tone="mute">افتراضي للقادم من البوابة</Tag>
                        </span>
                      ),
                    },
                    { k: 'تصنيف الجهة', v: r.type },
                    { k: 'جهة الإشراف الفني', v: r.licensor },
                    { k: 'رقم الترخيص', v: <Mono>{r.licenseNo}</Mono> },
                    { k: 'المنطقة', v: r.region },
                    { k: 'المحافظة / المدينة', v: r.city },
                    { k: 'تاريخ التأسيس', v: <DateText>{r.foundedAt}</DateText> },
                    { k: 'نهاية الترخيص', v: <DateText>{r.licenseEndsAt}</DateText> },
                    {
                      k: 'نهاية تكليف المجلس',
                      v: (
                        <DateText>{r.boardEndsAt}</DateText>
                      ),
                    },
                  ]}
                />
              </Glass>

              <Glass>
                <Head title="الاتصال والأشخاص" meta={canEdit ? <EditButton onClick={() => setEditing('contact')} /> : undefined} />
                <KV
                  rows={[
                    { k: 'جوال الجهة', v: <Mono>{r.mobile}</Mono> },
                    /* K-2: email is an actionable field, not text to copy by hand - and it's the
                       most common action taken during a request review. */
                    {
                      k: 'البريد الإلكتروني',
                      v: <a className="tlink" href={`mailto:${r.email}`}><Mono>{r.email}</Mono></a>,
                    },
                    { k: 'المدير التنفيذي', v: <Person name={r.directorName} size="md" quiet={false} /> },
                    { k: 'مدخل البيانات', v: <Person name={r.clerkName} size="md" quiet={false} /> },
                    { k: 'جوال مدخل البيانات', v: <Mono>{r.clerkMobile}</Mono> },
                    {
                      k: 'بريد مدخل البيانات',
                      v: <a className="tlink" href={`mailto:${r.clerkEmail}`}><Mono>{r.clerkEmail}</Mono></a>,
                    },
                  ]}
                />
              </Glass>

              {/* Bank account - a separate decision even though it's entered together. */}
              <Glass id="rg-banks">
                <Head
                  title="الحسابات البنكية"
                  meta={<span className="sub"><Num>{r.banks.length}</Num> حساب</span>}
                />
                {/* Note: one account per beneficiary purpose (H-5), so the review is a list, not a
                    row. Each account's supporting document sits next to it rather than in the
                    general document pile: the reviewer compares the IBAN against the document, and
                    an unordered pile of documents would make them search. */}
                {/* Client 27 Oct · the accounts as bank cards · each with its certificate, its decision
                    and its actions under it */}
                <BankGrid>
                  {r.banks.map((b, i) => {
                    const dec = r.bankDecisions && b.id in r.bankDecisions ? r.bankDecisions[b.id] : undefined
                    return (
                      <BankCard
                        key={b.id}
                        bank={b.bankName}
                        iban={b.iban}
                        holder={b.bankHolder}
                        off={Boolean(dec)}
                        tag={dec !== undefined ? <Tag tone={dec ? 'no' : 'ok'}>{dec ? `مرفوض · ${dec}` : 'مقبول'}</Tag> : undefined}
                        actions={<>
                          {canEdit && <UploadButton label={`${b.doc ? 'استبدال' : 'ارفع'} ${BANK_DOC_LABEL}`} text={b.doc ? 'استبدال' : 'ارفع'} onPick={(fl) => saveEdit([{ key: `bank:${b.id}:doc`, label: `${BANK_DOC_LABEL} · ${b.bankName}`, from: b.doc ?? '', to: fl.name }], '')} />}
                          {canEdit && <EditButton onClick={() => setEditing(`bank:${b.id}`)} />}
                        </>}
                      >
                        {b.doc
                          ? <DocFile name={b.doc} meta={BANK_DOC_LABEL} />
                          : <span className="bad">{BANK_DOC_LABEL} ناقصة</span>}
                        {open && mayApprove && (
                          <label className="regf">
                            <span className="lb">قرار الحساب</span>
                            <FieldSelect
                              value={bankNo[b.id] ?? ''}
                              options={[{ value: '', label: 'الحساب مقبول' }, ...BANK_REJECTS.map((x) => ({ value: x, label: `مرفوض · ${x}` }))]}
                              onChange={(x) => setBankNo((m) => ({ ...m, [b.id]: x }))}
                              label={`قرار الحساب ${i + 1}`}
                            />
                          </label>
                        )}
                      </BankCard>
                    )
                  })}
                </BankGrid>
              </Glass>

              {/* 2.2.14 · a return names the fields the entity may change · only those open on its portal */}
              {open && mayReturn && (
                <Glass>
                  <Head title="عند الإعادة للاستكمال" meta={<span className="sub"><Num>{flag.length}</Num> حقول محدّدة</span>} />
                  <FieldMultiSelect
                    values={flag}
                    options={REG_STAGES.flatMap((st) => st.fields).map((f) => ({ value: f.key, label: f.label }))}
                    label="الحقول التي تعدّلها الجهة"
                    placeholder="الحقول التي تعدّلها الجهة"
                    onChange={setFlag}
                  />
                </Glass>
              )}

              {r.note && (
                <Glass>
                  <Head
                    title={r.state === 'rejected' ? 'سبب الرفض' : 'ملاحظة الاستكمال'}
                    /* doc rule 31 */
                  />
                  <div className="payq-note">
                    <Icon name={icons.chat} size="sm" />
                    <span>{isolate(r.note)}</span>
                  </div>
                </Glass>
              )}

                </>
              )}
              {tab === 'docs' && (
                <>
              {/* Documents are handled the same as for projects and entities: `DocFile` with a
                  thumbnail, so the reviewer can tell the license is a scanned image straight from
                  the row before opening it. */}
              <Glass id="rg-docs">
                <Head
                  title="المستندات"
                  meta={
                    <span className="sub">
                      <Num>{r.docs.length}</Num> {nounAfter(r.docs.length, { one: "مرفوع", few: "مرفوعة", many: "مرفوعًا" })} · المطلوب للتصنيف{' '}
                      <Num>{REG_DOCS.filter((d) => docRequired(d, r.type)).length}</Num>
                    </span>
                  }
                />
                {/* Note: the document list is now a single implementation (UA-22). There used to be
                    a 3-column grid with names truncated at 131px (even "...pdf" got cut) plus a
                    separate list for missing ones, and a third layout for the same role next to the
                    `/entities/:id/docs` table and the closing rows. Now `DocList` matches all of
                    them exactly: uploaded items with a thumbnail, missing ones with a reserved slot
                    tagged "required/optional". Uploaded items come first. */}
                <DocList
                  label="مستندات طلب التسجيل وحالتها"
                  rows={[...REG_DOCS].sort((a, b) => Number(r.docs.includes(b.key)) - Number(r.docs.includes(a.key)))
                    .map((d) => ({
                      name: r.files?.[d.key]?.name ?? `${d.label}.pdf`,
                      uploaded: r.docs.includes(d.key),
                      required: docRequired(d, r.type),
                      meta: docRequired(d, r.type) ? 'إلزامي لهذا التصنيف' : 'اختياري',
                      /* Client 24 Oct · an uploaded document is replaced · a missing one uploaded by the reviewer */
                      action: canEdit ? <UploadButton label={`${r.docs.includes(d.key) ? 'استبدال' : 'ارفع'} ${d.label}`} text={r.docs.includes(d.key) ? 'استبدال' : 'ارفع'}
                        onPick={(fl) => saveEdit([{ key: `file:${d.key}`, label: d.label, from: r.files?.[d.key]?.name ?? (r.docs.includes(d.key) ? `${d.label}.pdf` : ''), to: fl.name }], '')} /> : undefined,
                    }))}
                />
              </Glass>

              {r.banks.length > 0 && (
                <Glass>
                  <Head title="وثائق الحسابات البنكية" meta={<span className="sub"><Num>{r.banks.length}</Num> حساب</span>} />
                  <DocList
                    label="وثائق الحسابات البنكية"
                    rows={r.banks.map((b) => ({ name: b.doc || `${BANK_DOC_LABEL}.pdf`, uploaded: Boolean(b.doc), required: true, meta: `${b.bankName} · ${b.bankHolder}` }))}
                  />
                </Glass>
              )}
                </>
              )}
              {tab === 'log' && (
                <>
              {/* The path and the log · in the main column, the end column is the assistant's alone */}

              {/* 2.4.3 · 2.4.15 · every action kept · a second return never overwrites the first */}
              <Glass>
                <Head title="سجل الطلب" meta={<span className="sub"><Num>{regHistory(r).length}</Num> إجراء · الإصدار <Num>{r.version ?? 1}</Num></span>} />
                <ul className="lg">
                  {[...regHistory(r)].reverse().map((ev, i) => (
                    <li className="lgi" key={`${ev.at}-${i}`}>
                      <span className={`lgdot ${ev.kind === 'approve' ? 't-ok' : ev.kind === 'reject' ? 't-no' : ev.kind === 'return' ? 't-ret' : 't-mute'}`} />
                      <div className="lghead">
                        <span className="lgact">{ev.action}</span>
                        <span className="pc-sp" />
                        <span className="lgtime sub"><DateText>{ev.at.slice(0, 10)}</DateText> · <Num>{ev.at.slice(11, 16) || '09:00'}</Num></span>
                      </div>
                      <div className="lgby"><span className="lgwho"><Person name={ev.by} size="md" quiet={false} /></span></div>
                      {ev.fields && (
                        <div className="lgfields">
                          {ev.fields.map((f) => (
                            <div className="lgf" key={f.k}><span className="lgf-k">{f.k}</span><span className="lgf-v">{f.v}</span></div>
                          ))}
                        </div>
                      )}
                      {ev.note && <p className="lgnote">{isolate(ev.note)}</p>}
                    </li>
                  ))}
                </ul>
              </Glass>

                </>
              )}
            </div>

            <AssistantAside
              title="مراجعة طلب التسجيل"
              suggest={open && (mayApprove || mayReturn) ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
              cta="راجع الطلب"
              empty="لا مانع من الاعتماد · الترخيص غير مكرَّر والمستندات مكتملة وسارية."
              readings={[
                ...(clash ? [{ id: 'rg-clash', kind: 'flag' as const, label: 'ترخيص مكرَّر', text: `رقم الترخيص مسجَّل لـ «${clash.name}» بنفس التصنيف.`, src: /* doc rule 8 */ '' }] : []),
                ...(missingDocs.length ? [{ id: 'rg-docs', kind: 'flag' as const, label: 'مستندات ناقصة', metric: { value: String(missingDocs.length), unit: 'مستند' }, text: missingDocs.map((d) => d.label).join(' · '), src: /* doc rule 4 */ '' }] : []),
                ...(stale.length ? [{ id: 'rg-stale', kind: 'flag' as const, label: 'وثيقة منتهية', text: stale.map((k) => REG_DOCS.find((d) => d.key === k)?.label ?? k).join(' · '), src: 'عند التقديم' }] : []),
                /* Cross · spelling and illogical data, the documents read against the form, patterns
                   across entities and an advisory acceptance score */
                ...registrationAi(r, missingDocs.length),
              ]}
            />
          </div>
        </div>

        {/* === Documents === */}
        <div className="decdock">
          <div className="chrome decbar payact">
            {taken ? (
              <>
                <div className="rowf gp-3">
                  <Icon name={icons.check} size="md" className="ok-ink" />
                  <span className="decsent">
                    سُجّل القرار: <b>{OUT_SAY[taken]}</b>
                    {Object.values(bankNo).some(Boolean) && <><span className="decsep" />حسابات مرفوضة: <Num>{Object.values(bankNo).filter(Boolean).length}</Num></>}
                  </span>
                </div>
                {taken === 'approve' && r.entityId && (
                  <Link className="btn btn-p" to={ROUTES.entity(r.entityId)}>
                    <Icon name={icons.entity} size="sm" />
                    افتح ملف الجهة
                  </Link>
                )}
                <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>صندوق الطلبات</button>
              </>
            ) : !open ? (
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  {r.state === 'draft'
                    ? <>الطلب <b>مسودة عند الجهة</b> · لم يصل إلى المراجعة بعد{/* doc rule 12 */}</>
                    : r.state === 'completion'
                      ? <>الطلب <b>عند الجهة للاستكمال</b> · تُتاح القرارات عند إعادة إرساله</>
                      : <>الطلب <b>{REG_STATE_SAY[r.state]}</b> · اتُّخذ القرار ولا إجراء بعده{r.entityId && <> · <Link className="lnk" to={ROUTES.entity(r.entityId)}>ملف الجهة</Link></>}</>}
                </span>
              </div>
            ) : !mayReturn && !mayApprove ? (
              /* 2.1.desc-2 · 2.4.16 · the decision belongs to a role, not to whoever opened the screen */
              <div className="rowf gp-3 payact-w">
                <span className="decsent">قرار الطلب لـ<b>{deciders}</b> · تعرض هذه الشاشة الطلب لك للاطلاع</span>
              </div>
            ) : (
              <>
                <div className="rowf gp-3 payact-w">
                  <Person name={me} size="lg" quiet={false} />
                  <span className="decsent">
                    قرارك في طلب <b>{r.name}</b>
                    <span className="decsep" />
                    {r.type}
                  </span>
                </div>

                {/* Client 23 Oct · the decision first · return and reject then ask their reason in a
                    popup fed by the entity settings · the approve button states what stops it */}
                <div className="payact-g">
                <div className="rowf gp-2">
                  {mayReturn && (
                    <button
                      className="btn btn-2"
                      title={`يُعاد إلى الجهة مع السبب${flag.length ? ` · ويُفتح لها ${flag.map(fieldLabel).join('، ')}` : ''}`}
                      onClick={() => setAsk('return')}
                    >
                      إعادة للاستكمال
                    </button>
                  )}
                  {mayApprove && (
                    <button className="btn btn-d" title={/* doc rule 28 */ 'يُؤرشف بسببه'} onClick={() => setAsk('reject')}>
                      رفض وإيقاف
                    </button>
                  )}
                  {mayApprove && (
                    <button
                      className="btn btn-p"
                      title={nStop ? 'يفتح ما يمنع الاعتماد' : /* doc rule 2 */ 'تُنشأ الجهة وملفها ويُرسل اسم المستخدم'}
                      onClick={() => { if (blocked || noBank) { setStopOpen(true); return } decideRegistration(r.id, 'approve', '', bankNo, me); setTaken('approve') }}
                    >
                      اعتماد وتفعيل
                    </button>
                  )}
                </div>
                {mayApprove && nStop > 0 && (
                  <button type="button" className="lnk" onClick={() => setStopOpen(true)}>ما يمنع الاعتماد · <Num>{nStop}</Num> {nounAfter(nStop, STOP_NOUN)}</button>
                )}
                </div>
              </>
            )}
          </div>
        </div>
        {stopOpen && (
          <Modal wide title={`ما يمنع الاعتماد · ${r.name}`} icon={icons.alert} onClose={() => setStopOpen(false)}
            foot={<>
              {open && mayApprove && (
                <button type="button" className="btn btn-p" disabled={blocked || noBank} title={nStop ? 'عالج ما يمنع الاعتماد أولًا' : undefined}
                  onClick={() => { setStopOpen(false); decideRegistration(r.id, 'approve', '', bankNo, me); setTaken('approve') }}>اعتماد وتفعيل</button>
              )}
              <button type="button" className="btn btn-2" onClick={() => setStopOpen(false)}>إغلاق</button>
            </>}>
                {nStop > 0 ? (
                  <>
                    <p className="sub cnote">{open ? 'الطلب متوقف للأسباب أدناه' : 'كان الطلب متوقفًا للأسباب أدناه'}</p>
                    <ul className="blockers mt-2">
                      {stops.map((b, k) => (
                        <li key={k}>
                          <Icon name={icons.alert} size="sm" />
                          <span>{b.head && <><b>{b.head}</b> · </>}{b.text}</span>
                          {b.why && <span className="payq-r">{b.why}</span>}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="sub cnote">{decided ? 'لم يكن على الطلب مانع عند القرار.' : 'اكتملت الفحوص · لا شيء يمنع الاعتماد.'}</p>
                )}
                {/* v3 · 2.4.6 · legible and readable · the reviewer's own check, kept beside the blockers ·
                    the size warning is a hint, the reading is the check */}
                <label className="rowf gp-2 mt-3">
                  <input type="checkbox" checked={legible} disabled={!open} onChange={(x) => setLegible(x.target.checked)} />
                  <span>
                    راجعتُ الوثائق النظامية وهي واضحة ومقروءة
                    {warnFiles.length > 0 && <> · <span className="bad">{warnFiles.map(([k, f]) => `${REG_DOCS.find((d) => d.key === k)?.label ?? k}: ${f.warn}`).join(' · ')}</span></>}
                  </span>
                </label>
                {(() => {
                  const passed = [
                    ...(!clash ? [<>رقم الترخيص <Mono>{r.licenseNo}</Mono> غير مكرَّر في هذا التصنيف</>] : []),
                    ...(!badIban.length ? ['كل الحسابات المقبولة آيبانها صحيح'] : []),
                    ...(!missingDocs.length ? ['كل المستندات الإلزامية لهذا التصنيف مرفوعة'] : []),
                    ...(!stale.length ? ['الترخيص وقرار تكليف المجلس ساريان'] : []),
                    ...(!dups.length ? ['الاسم والبريد والجوال والآيبان غير مكرّرة'] : []),
                    ...(!badFormat.length ? ['صيغ الحقول صحيحة'] : []),
                  ]
                  if (!passed.length) return null
                  return (
                    <details className="mt-3" open={nStop === 0}>
                      <summary className="lnk">تحقّق بالفعل · <Num>{passed.length}</Num></summary>
                      <ul className="payq-ck mt-2">
                        {passed.map((x, k) => (
                          <li key={k} className="ok">
                            <Icon name={icons.check} size="sm" />
                            <span>{x}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )
                })()}
                {/* Batch 8 · the wording notes and the governance claim · for the reviewer's eye, never a blocker */}
                {(() => {
                  const found = REG_STAGES.flatMap((st) => st.fields ?? []).filter((f) => f.kind === 'text')
                    .flatMap((f) => textIssues(String((r as unknown as Record<string, unknown>)[f.key] ?? '')).map((x) => `${f.label}: ${x.say}${x.fixed !== undefined ? ` (المقترح «${x.fixed}»)` : ''}`))
                  return (
                    <>
                      <p className="lb mt-3">للعلم · لا تمنع الاعتماد</p>
                      <ul className="payq-ck mt-1">
                        <li className={found.length ? 'no' : 'ok'}>
                          <Icon name={found.length ? icons.info : icons.check} size="sm" />
                          <span>{found.length ? <>ملاحظات الصياغة: {found.join(' · ')}</> : 'لا أخطاء إملائية ولا تنسيقية في النصوص'}</span>
                        </li>
                        <li className="ok">
                          <Icon name={icons.info} size="sm" />
                          <span>
                            درجة الحوكمة{' '}
                            {r.governanceClaim > 0
                              ? <><span className="num">{r.governanceClaim}</span> · <b>إقرار الجهة</b></>
                              : <>أُقرّت بصفر</>}
                          </span>
                        </li>
                      </ul>
                    </>
                  )
                })()}
          </Modal>
        )}
        {editing && (
          <EditModal
            title={editing === 'def' ? 'تعديل التعريف' : editing === 'contact' ? 'تعديل الاتصال والأشخاص' : 'تعديل الحساب البنكي'}
            fields={editFields(editing)}
            onClose={() => setEditing(null)}
            onSave={(changes, _v, reason) => saveEdit(changes, reason)}
          />
        )}
        {ask && (
          <ReasonDialog
            kind={ask === 'return' ? 'regReturn' : 'regReject'}
            title={ask === 'return' ? 'إعادة الطلب للاستكمال' : 'رفض الطلب وإيقافه'}
            subject={ask === 'return'
              ? `${r.name}${flag.length ? ` · يُفتح لها ${flag.length} ${nounAfter(flag.length, { one: 'حقل', few: 'حقول', many: 'حقلًا' })}` : ''}`
              : r.name}
            confirm={ask === 'return' ? 'أعد للاستكمال' : 'ارفض وأوقف'}
            tone={ask === 'return' ? 'btn-p' : 'btn-d'}
            onConfirm={pick}
            onClose={() => setAsk(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}
