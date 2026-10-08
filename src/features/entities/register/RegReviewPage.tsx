import { ibanValid } from '@/lib/iban'
import { useMemo, useState } from 'react'
import { registrationAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Num, Person, Steps, Tag,
  type StepItem,
} from '@/components/ui'
import { DocFile, DocList } from '@/components/docs'
import { Crumbs } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nounAfter } from '@/lib/format'
import { entityRows } from '@/data/mock/entities'
import {
  BANK_DOC_LABEL, BANK_REJECTS, REG_DOCS, REG_STATES, REG_STATE_SAY, REG_STATE_WHO,
  docRequired, licenseClash, partnerKind, regMissingDocs, regRequestById,
} from '@/data/mock/registration'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { EditableCard } from '@/features/shared/EditableCard'
import { canDecide, decideRegistration, fieldLabel, regHistory, returnRegistration, useEntityFlow } from '@/data/entities/store'
import { duplicates, expiredDocs, formatIssue } from '@/data/entities/validate'
import { readRole, roleByKey } from '@/data/roles'
import { REG_STAGES } from '@/data/mock/registration'
import { ENTITY_RULES } from '@/data/entities/rules'

/* Registration request review - system admin's screen.

   Note: the reviewer is reviewing a declaration, not a record. Every value on this screen was
   entered by the entity about itself through a public portal, so the governance level is tagged
   "entity declaration", and the license number is verified in front of the reviewer, not after the
   decision. What the reviewer needs isn't "what is the data" but "what hasn't been verified".

   Three outcomes, plus a fourth for the bank:

     Approve and activate  - the entity is generated here and the username is sent
     Return for completion - goes back to the entity with a note (rule 26)
     Reject and suspend    - archived with a reason (rules 28 and 31)

   The admin note is required for the latter two - the live system enforces it on "approve and
   activate" and "reject and suspend", and rule 31 requires writing the reason for suspension or
   approval withdrawal.

   Note: bank account approval is separate - the system has two bank screens and seven coded
   rejection reasons, so the bank makes its own decision even when tied to the same request (rule
   11).

   Note: there is no delete button. Rule 28: deletion is never allowed, only archive or deactivate.
   This absence is documented on the screen because an absence doesn't explain itself. */

type Outcome = 'approve' | 'return' | 'reject'

const OUT_SAY: Record<Outcome, string> = {
  approve: 'اعتماد وتفعيل · أُنشئت الجهة وأُرسل اسم المستخدم',
  return: 'إعادة للاستكمال · أُعيد الطلب إلى الجهة مع الملاحظة',
  reject: 'رفض وإيقاف · أُرشف الطلب بسببه',
}

export default function RegReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  useEntityFlow()
  const r = id ? regRequestById(id) : undefined
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<Outcome | null>(null)
  /* One decision per account (2.2.15) · '' accepted, otherwise one of the coded reasons */
  const [bankNo, setBankNo] = useState<Record<string, string>>({})
  /* The fields a return flags · the entity may edit these and only these (2.2.14) */
  const [flag, setFlag] = useState<string[]>([])
  const role = readRole()
  const me = roleByKey(role).name
  const mayApprove = canDecide('approve', role)
  const mayReturn = canDecide('return', role)
  const deciders = ENTITY_RULES.approveBy.map((k) => roleByKey(k).title).join(' أو ')

  /* A wrong request ID is not the same as an empty request - same lesson learned on the
     disbursement screen: a screen that renders fine on `undefined` still looks "healthy", so every
     check tool returns green while measuring the wrong screen. */
  const missingDocs = useMemo(() => (r ? regMissingDocs(r) : []), [r])
  const clash = useMemo(
    () => (r ? licenseClash(r.licenseNo, r.type, entityRows.filter((e) => e.id !== r.entityId)) : null),
    [r],
  )
  /* What the request carries that a person must look at (2.4.5 · 2.4.6 · 2.4.10) */
  const dups = useMemo(() => (r && r.state !== 'approved' ? duplicates(r, r.banks, { exceptReq: r.id }) : []), [r])
  const stale = useMemo(() => (r ? expiredDocs({ licenseEndsAt: r.licenseEndsAt, boardEndsAt: r.boardEndsAt }, r.docs) : []), [r])
  const badFormat = useMemo(() => (r
    ? REG_STAGES.flatMap((st) => st.fields).map((f) => ({ f, e: formatIssue(f.key, f.kind, String((r as unknown as Record<string, unknown>)[f.key] ?? '')) }))
      .filter((x) => x.e && !/X/.test(String((r as unknown as Record<string, unknown>)[x.f.key] ?? '')))
    : []), [r])
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
                note="ربما أُرشف الطلب أو أن الرابط قديم · علمًا بأن الطلبات لا تُحذف (قاعدة 28)."
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
  const blocked = missingDocs.length > 0 || Boolean(clash) || stale.length > 0 || badIban.length > 0

  const steps: StepItem[] = [
    { label: 'تعبئة الجهة وإرسالها', at: <DateText>{r.submittedAt}</DateText>, state: 'done' },
    {
      label: 'تحقّق الجوال · قاعدة 19',
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
      label: 'إنشاء حساب الجهة · قاعدة 2',
      note: r.entityId ? `الجهة ${r.entityId}` : 'بعد الاعتماد وحده',
      /* A rejected entity never gets an account created - this stage is skipped, not pending. */
      state: r.entityId ? 'done' : r.state === 'rejected' ? 'skip' : 'todo',
    },
  ]

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

          <header>
            <div>
              <h1 className="ptitle">{r.name}</h1>
              <p className="sub mt-1">
                <Mono>{r.id}</Mono> · {r.type} · {REG_STATE_WHO[r.state]}
              </p>
            </div>
            <Tag tone="mute">{REG_STATE_SAY[r.state]}</Tag>
          </header>

          <div className="g2">
            <div className="col">
              {/* Note: the verification card sits above the data on purpose - the reviewer needs
                  "what hasn't been verified" before "what the data is". */}
              <Glass>
                <Head
                  title="ما يمنع الاعتماد"
                  meta={blocked ? <Tag tone="no">موقوف</Tag> : <Tag tone="ok">لا مانع</Tag>}
                />
                <ul className="payq-ck">
                  <li className={clash ? 'no' : 'ok'}>
                    <Icon name={clash ? icons.alert : icons.check} size="sm" />
                    <span>
                      {clash
                        ? <>رقم الترخيص مسجَّل لـ «{clash.name}» بنفس التصنيف</>
                        : <>رقم الترخيص <Mono>{r.licenseNo}</Mono> غير مكرَّر في هذا التصنيف</>}
                    </span>
                    <span className="payq-r">قاعدة <Num>8</Num></span>
                  </li>
                  <li className={badIban.length ? 'no' : 'ok'}>
                    <Icon name={badIban.length ? icons.alert : icons.check} size="sm" />
                    <span>
                      {badIban.length
                        ? <>آيبان غير صحيح في <Num>{badIban.length}</Num> {badIban.length > 1 ? 'حسابات' : 'حساب'} مقبول · ارفض الحساب أو أعد الطلب لتصحيحه</>
                        : 'كل الحسابات المقبولة آيبانها صحيح'}
                    </span>
                    <span className="payq-r">2.4.6</span>
                  </li>
                  <li className={missingDocs.length ? 'no' : 'ok'}>
                    <Icon name={missingDocs.length ? icons.alert : icons.check} size="sm" />
                    <span>
                      {missingDocs.length
                        ? <>ينقص <Num>{missingDocs.length}</Num>: {missingDocs.map((d) => d.label).join(' · ')}</>
                        : 'كل المستندات الإلزامية لهذا التصنيف مرفوعة'}
                    </span>
                    <span className="payq-r">قاعدة <Num>4</Num></span>
                  </li>
                  <li className={stale.length ? 'no' : 'ok'}>
                    <Icon name={stale.length ? icons.alert : icons.check} size="sm" />
                    <span>{stale.length
                      ? <>وثيقة منتهية عند التقديم: {stale.map((k) => REG_DOCS.find((d) => d.key === k)?.label).join(' · ')}</>
                      : 'الترخيص وقرار تكليف المجلس ساريان'}</span>
                    <span className="payq-r">قاعدة <Num>5</Num></span>
                  </li>
                  <li className={dups.length ? 'no' : 'ok'}>
                    <Icon name={dups.length ? icons.alert : icons.check} size="sm" />
                    <span>{dups.length
                      ? <>بيانات مكرّرة: {dups.map((d) => `${d.label} مع «${d.who}»`).join(' · ')}</>
                      : 'الاسم والبريد والجوال والآيبان غير مكرّرة'}</span>
                    <span className="payq-r">قاعدة <Num>10</Num></span>
                  </li>
                  {(badFormat.length > 0 || warnFiles.length > 0) && (
                    <li className="no">
                      <Icon name={icons.alert} size="sm" />
                      <span>
                        {badFormat.map((x) => `${x.f.label}: ${x.e}`).join(' · ')}
                        {badFormat.length > 0 && warnFiles.length > 0 && ' · '}
                        {warnFiles.map(([k, f]) => `${REG_DOCS.find((d) => d.key === k)?.label ?? k}: ${f.warn}`).join(' · ')}
                      </span>
                      <span className="payq-r">قاعدة <Num>6</Num></span>
                    </li>
                  )}
                  <li className={r.governanceClaim > 0 ? 'ok' : 'no'}>
                    <Icon name={r.governanceClaim > 0 ? icons.check : icons.alert} size="sm" />
                    <span>
                      درجة الحوكمة{' '}
                      {r.governanceClaim > 0
                        ? <><span className="num">{r.governanceClaim}</span> · <b>إقرار الجهة</b> لا تقييم المؤسسة</>
                        : <>أُقرّت بصفر · النظام يطلب ذلك عند عدم إجراء التقييم</>}
                    </span>
                    <span className="payq-r">نوتة ن-<Num>2</Num></span>
                  </li>
                </ul>
              </Glass>

              <Glass>
                <Head title="التعريف" meta="كما أقرّت به الجهة" />
                <KV
                  rows={[
                    { k: 'اسم الجهة', v: r.name },
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
                        <span className="kvpair">
                          <DateText>{r.boardEndsAt}</DateText>
                          <Tag tone="mute">قاعدة 18 في إجراء التحديث</Tag>
                        </span>
                      ),
                    },
                  ]}
                />
              </Glass>

              <Glass>
                <Head title="الاتصال والأشخاص" meta="مدخل البيانات يصله اسم المستخدم" />
                <KV
                  rows={[
                    { k: 'جوال الجهة', v: <Mono>{r.mobile}</Mono> },
                    /* K-2: email is an actionable field, not text to copy by hand - and it's the
                       most common action taken during a request review. */
                    {
                      k: 'البريد الإلكتروني',
                      v: <a className="tlink" href={`mailto:${r.email}`}><Mono>{r.email}</Mono></a>,
                    },
                    { k: 'المدير التنفيذي', v: <Person name={r.directorName} quiet={false} /> },
                    { k: 'مدخل البيانات', v: <Person name={r.clerkName} quiet={false} /> },
                    { k: 'جوال مدخل البيانات', v: <Mono>{r.clerkMobile}</Mono> },
                    {
                      k: 'بريد مدخل البيانات',
                      v: <a className="tlink" href={`mailto:${r.clerkEmail}`}><Mono>{r.clerkEmail}</Mono></a>,
                    },
                  ]}
                />
              </Glass>

              {/* Documents are handled the same as for projects and entities: `DocFile` with a
                  thumbnail, so the reviewer can tell the license is a scanned image straight from
                  the row before opening it. */}
              <Glass>
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
                      name: `${d.label}.pdf`,
                      uploaded: r.docs.includes(d.key),
                      required: docRequired(d, r.type),
                      meta: docRequired(d, r.type) ? 'إلزامي لهذا التصنيف' : 'اختياري',
                    }))}
                />
              </Glass>

              {/* The path and the log · in the main column, the end column is the assistant's alone */}
              <Glass>
                <Head title="مسار الطلب" meta={<span className="sub">قاعدة 30 · سجل التدقيق</span>} />
                <Steps items={steps} flow="ladder" />
              </Glass>

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
                      <div className="lgby"><span className="lgwho">{ev.by}</span></div>
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
              <EditableCard module="registration" state={r.state} label={REG_STATES.find((x) => x.key === r.state)?.label} />

              {/* Bank account - a separate decision even though it's entered together. */}
              <Glass>
                <Head
                  title="الحسابات البنكية"
                  meta={<>
                    <span className="sub"><Num>{r.banks.length}</Num> حساب</span>
                    {' '}<Tag tone="mute">اعتماد منفصل</Tag>
                  </>}
                />
                {/* Note: one account per beneficiary purpose (H-5), so the review is a list, not a
                    row. Each account's supporting document sits next to it rather than in the
                    general document pile: the reviewer compares the IBAN against the document, and
                    an unordered pile of documents would make them search. */}
                <ul className="rgbanks">
                  {r.banks.map((b, i) => (
                    <li key={b.id}>
                      <span className="rgbank-n num">{i + 1}</span>
                      <div className="rgbank-b">
                        <div className="rgbank-t">
                          <b>{b.bankName}</b>
                          <span className="sub">· {b.bankHolder}</span>
                        </div>
                        <div className="sub"><Mono>{b.iban}</Mono></div>
                        {b.doc
                          ? <DocFile name={b.doc} meta={BANK_DOC_LABEL} />
                          : <span className="bad">{BANK_DOC_LABEL} ناقصة</span>}
                        {open && mayApprove && (
                          <label className="regf mt-2">
                            <span className="lb">قرار الحساب</span>
                            <FieldSelect
                              value={bankNo[b.id] ?? ''}
                              options={[{ value: '', label: 'الحساب مقبول' }, ...BANK_REJECTS.map((x) => ({ value: x, label: `مرفوض · ${x}` }))]}
                              onChange={(x) => setBankNo((m) => ({ ...m, [b.id]: x }))}
                              label={`قرار الحساب ${i + 1}`}
                            />
                          </label>
                        )}
                        {r.bankDecisions && b.id in r.bankDecisions && (
                          <Tag tone={r.bankDecisions[b.id] ? 'no' : 'ok'}>{r.bankDecisions[b.id] ? `مرفوض · ${r.bankDecisions[b.id]}` : 'مقبول'}</Tag>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  هذه الأسباب السبعة مُرمَّزة في النظام العامل · ويُتّخذ قرار الحساب
                  مستقلًا حتى لو أُدخل في الطلب نفسه (قاعدة{' '}
                  <span className="num">11</span>).
                </p>
              </Glass>

              {/* 2.2.14 · a return names the fields the entity may change · only those open on its portal */}
              {open && mayReturn && (
                <Glass>
                  <Head title="عند الإعادة للاستكمال" meta={<span className="sub"><Num>{flag.length}</Num> حقول محدّدة</span>} />
                  <p className="sub cnote">اختر الحقول التي على الجهة تعديلها · تُفتح لها وحدها في بوابتها مع ملاحظتك، والمستندات الناقصة تُرفع هناك دائمًا.</p>
                  <ul className="cfgchips">
                    {REG_STAGES.flatMap((st) => st.fields).map((f) => (
                      <li key={f.key}>
                        <button
                          type="button"
                          className={`cfgchip${flag.includes(f.key) ? ' on' : ''}`}
                          aria-pressed={flag.includes(f.key)}
                          onClick={() => setFlag((x) => (x.includes(f.key) ? x.filter((y) => y !== f.key) : [...x, f.key]))}
                        >
                          {f.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}

              {r.note && (
                <Glass>
                  <Head
                    title={r.state === 'rejected' ? 'سبب الرفض' : 'ملاحظة الاستكمال'}
                    meta={<Tag tone={r.state === 'rejected' ? 'no' : 'ret'}>قاعدة 31</Tag>}
                  />
                  <div className="payq-note">
                    <Icon name={icons.chat} size="sm" />
                    <span>{isolate(r.note)}</span>
                  </div>
                </Glass>
              )}

              <Glass>
                <Head title="ما لا يوجد في هذه الشاشة" />
                <p className="sub cnote">
                  لا يوجد زر حذف · القاعدة <span className="num">28</span> تمنع الحذف
                  نهائيًا، والمرفوض يُؤرشف والقائم يُعطَّل. والمؤرشف يظهر لمسؤول
                  النظام وحده في <Link className="lnk" to={ROUTES.entityArchive}>أرشيف الجهات</Link>{' '}
                  (القاعدة <span className="num">29</span>).
                </p>
              </Glass>
            </div>

            <AssistantAside
              title="مراجعة طلب التسجيل"
              cta="راجع الطلب"
              empty="لا مانع من الاعتماد · الترخيص غير مكرَّر والمستندات مكتملة وسارية."
              readings={[
                ...(clash ? [{ id: 'rg-clash', kind: 'flag' as const, label: 'ترخيص مكرَّر', text: `رقم الترخيص مسجَّل لـ «${clash.name}» بنفس التصنيف.`, src: 'قاعدة 8' }] : []),
                ...(missingDocs.length ? [{ id: 'rg-docs', kind: 'flag' as const, label: 'مستندات ناقصة', metric: { value: String(missingDocs.length), unit: 'مستند' }, text: missingDocs.map((d) => d.label).join(' · '), src: 'قاعدة 4' }] : []),
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
                    ? <>الطلب <b>مسودة عند الجهة</b> · لم يصل إلى المراجعة بعد (قاعدة <Num>12</Num>)</>
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

                {/* Admin note - required on return-for-revision and rejection - the live system
                    enforces it, and rule 31 requires it. */}
                <div className="payact-g">
                <label className="payact-n">
                  <span className="vis-h">الملاحظة الإدارية</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="الملاحظة الإدارية · إلزامية للإعادة والرفض"
                  />
                </label>

                <div className="rowf gp-2">
                  {mayReturn && (
                    <button
                      className="btn btn-2"
                      data-needs-note=""
                      disabled={!note.trim()}
                      title={note.trim() ? `يُعاد إلى الجهة مع الملاحظة${flag.length ? ` · ويُفتح لها ${flag.map(fieldLabel).join('، ')}` : ''}` : 'اكتب الملاحظة الإدارية أولًا'}
                      onClick={() => { returnRegistration(r.id, note.trim(), flag, me); setTaken('return') }}
                    >
                      إعادة للاستكمال
                    </button>
                  )}
                  {mayApprove && (
                    <button
                      className="btn btn-d"
                      data-needs-note=""
                      disabled={!note.trim()}
                      title={note.trim() ? 'يُؤرشف بسببه · قاعدة 28' : 'اكتب سبب الرفض أولًا'}
                      onClick={() => { decideRegistration(r.id, 'reject', note.trim(), bankNo, me); setTaken('reject') }}
                    >
                      رفض وإيقاف
                    </button>
                  )}
                  {mayApprove && (
                    <button
                      className="btn btn-p"
                      disabled={blocked || r.banks.every((b) => bankNo[b.id])}
                      title={
                        blocked
                          ? 'نواقص تمنع الاعتماد · القواعد 4 و5 و8 · وصحة الآيبان'
                          : r.banks.every((b) => bankNo[b.id])
                            ? 'لا حساب بنكيًا مقبولًا · يلزم حساب واحد على الأقل'
                            : 'تُنشأ الجهة وملفها ويُرسل اسم المستخدم · قاعدة 2'
                      }
                      onClick={() => { decideRegistration(r.id, 'approve', note.trim(), bankNo, me); setTaken('approve') }}
                    >
                      اعتماد وتفعيل
                    </button>
                  )}
                </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
