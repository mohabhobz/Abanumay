import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, CopyId, Glass, Head, Icon, icons, Mono, Num, Person, Steps, Tag, DockWhy,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { Background } from '@/components/shell'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useFillHeight } from '@/hooks/useFillHeight'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isSignedIn } from '@/data/session'
import Logo from '@/assets/LogoColor'
import { entityRows } from '@/data/mock/entities'
import {
  FIRST_FORM_STAGE, FORM_STAGES, REG_DOCS, REG_STAGES, REG_TERMS, bankIssues,
  citiesOf, docRequired, emptyBank, licenseClash, regAccount, type RegBank,
  REG_TONE,
} from '@/data/mock/registration'
import { regReadings, stageAdvice, stepState } from '@/data/mock/regPortal'
import { Field } from './Field'
import { BankRows } from './BankRows'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'
import { HeroSuccess } from '@/components/soul'

/* New entity registration request - entity screen.

   Note: this screen creates a request, not an entity. Rule 2 states no account is created before
   approval, so there is no "create entity" here, and at the end of the flow the screen explicitly
   states the account hasn't been created yet. This isn't a wording detail: an entity that believes
   it's registered keeps waiting for an email that isn't coming.

   === Five tabs, not one page ===

   Rule 25 requires the form to be split into logical stages, and the `/reg/add` page in the live
   system already does this with vertical tabs. The split here matches, with one difference: the
   bank account tab comes from rule 11 (core and banking data in one request), not from the live
   system, which defers banking to a separate action with its own two screens and separate approval.

   === Rule 4 is a checklist, not an error message ===

   "All mandatory data and documents before submission" - and the checklist, shown before the
   button, states what's missing instead of the entity clicking and waiting for an error. A counter
   on each tab shows how many items are missing there, so gaps are visible without opening every
   tab.

   === And required documents change by category ===

   Three documents are mandatory for commercial entities only, so changing a value on the first tab
   can change what's required on the last tab - the checklist updates live, not only on submit. */

/** Journey stages - the last one belongs to the institution, not the entity, and that's noted next to it. */
type Phase = 'terms' | 'form' | 'otp' | 'sent'

const PHASES: Phase[] = ['terms', 'form', 'otp', 'sent']

/**
 * Verification code length - five digits.
 *
 * Note: this number was corrected to match the client's screens - it had been written as 6 in four
 * places here (the hint line, the button condition, `maxLength`, and the schema line), while the
 * client's modal uses five digits.
 *
 * Note: written once on purpose - duplicating the number across four places is how a button that
 * enables at five ends up with a field that accepts six.
 */
export const OTP_LEN = 5

const KEYS = ['step', 'tab', 'up'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const EMPTY: Record<string, string> = {}

/* Note: the stage lives in the URL, not only in state. The first version used `useState`, so
   `/entities/register` in the audit always rendered the terms gate - the five tabs, fields and
   documents never rendered, so every check tool returned green while never having seen the form. An
   unused-CSS check is where it surfaced: eight classes were flagged as "never appearing in the DOM"
   while actually in use.

   This is the same family of bug that has repeated here twice before (a "not found" screen
   bypassing the audit, and a nonexistent class that still worked) - the tool measuring the wrong
   thing returns green. So the stage now lives in the URL, and the audit visits each stage by its
   path. */

export default function RegisterPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const phase: Phase = PHASES.includes(v.step as Phase) ? (v.step as Phase) : 'terms'
  const setPhase = (x: Phase) => set({ step: x === 'terms' ? undefined : x })
  const [agreed, setAgreed] = useState(false)
  /* Note: the form starts at the second step - "entity account" has its own screen (`own`) and isn't
   shown here, so the default is the first step that's actually filled in, not the first stage of
   the journey. */
  const tab = FORM_STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : FIRST_FORM_STAGE
  const setTab = (x: string) => set({ tab: x === FIRST_FORM_STAGE ? undefined : x })
  const [val, setVal] = useState<Record<string, string>>(EMPTY)

  /* Note: the uploaded file is in the URL, and the selected file is in state. The key in `?up=`
   exists so the "after upload" state remains a screen with a URL - shareable, restorable on
   refresh, and visitable by the audit. The file the user actually picked (its name and size) lives
   in state, since it isn't put in a URL and doesn't survive a refresh - so the screen shows its
   name when present, and a placeholder document name when the key came from the URL. */
  const docs = useMemo(() => new Set(readList(v.up)), [v.up])
  const [files, setFiles] = useState<Record<string, { name: string; size: number }>>({})
  /* Note 1: accounts - one empty by default so the screen doesn't start in an empty state; the user
   must click a button to leave it. */
  const [banks, setBanks] = useState<RegBank[]>([emptyBank(1)])
  const [otp, setOtp] = useState('')
  const [draft, setDraft] = useState(false)

  const type = val.type ?? ''

  const setField = (k: string, x: string) =>
    setVal((s) => {
      const next = { ...s, [k]: x }
      /* City belongs to a region - changing the region drops a city that doesn't belong to it, instead of
   leaving the request inconsistent. */
      if (k === 'region' && next.city && !citiesOf(x).includes(next.city)) next.city = ''
      return next
    })

  /** Upload a document - takes the actual file if the user picked one. */
  const upload = (k: string, f?: File) => {
    if (f) setFiles((s) => ({ ...s, [k]: { name: f.name, size: f.size } }))
    set({ up: writeList([...new Set([...readList(v.up), k])]) })
  }

  /** Remove an uploaded file - not a deletion from a record; this is still a draft that hasn't been
 * submitted. */
  const clearDoc = (k: string) => {
    setFiles((s) => {
      const next = { ...s }
      delete next[k]
      return next
    })
    set({ up: writeList(readList(v.up).filter((x) => x !== k)) })
  }

  /** Missing items per tab - rule 4, with documents counted by category. */
  const shortBy = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const s of FORM_STAGES) {
      /* Note: the bank stage's missing-item count is computed from rows, not fields - it has no `fields`
   at all, and if left on the generic account logic it would show "complete" while empty - the same
   failure as a rule with no check. */
      out[s.key] =
        s.key === 'docs'
          ? REG_DOCS.filter((d) => docRequired(d, type) && !docs.has(d.key)).map((d) => d.label)
          : s.key === 'bank'
            ? bankIssues(banks).map((b) => b.say)
            : s.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)
    }
    return out
  }, [val, docs, type, banks])

  const missing = Object.values(shortBy).flat()

  /* Rule 8: license number must not repeat, and rule 9 excepts a different category - so the check
   considers both together. */
  const clash = useMemo(
    () => (val.licenseNo && type ? licenseClash(val.licenseNo, type, entityRows) : null),
    [val.licenseNo, type],
  )

  /* Note 3: the hint for the current stage is computed from the same numbers the badge counts, so
   they can't disagree. */
  const advice = useMemo(
    () => stageAdvice(
      tab,
      val,
      tab === 'bank' ? [] : shortBy[tab] ?? [],
      tab === 'bank' ? shortBy.bank ?? [] : [],
      Object.entries(files).map(([key, f]) => ({ key, name: f.name })),
    ),
    [tab, val, shortBy, files],
  )

  /* Note: password confirmation also blocks submission, and isn't part of `shortBy`. Both fields are
   filled, so the counter reads "complete" - but the request can't be sent while the two passwords
   differ. The blocker is read from the hint itself. */
  const canSend = missing.length === 0 && !clash && advice.blocking.length === 0

  /* Note: the stepper needs progress via the button too, not just by clicking it. Clicking a distant
   step is a jump, while normal filling goes step by step, with the hand staying near the button on
   the dock. So navigation works two ways: the bar for jumping, the dock for progressing. */
  /* The sticky card takes its height from its actual position - short with visible content before it
   sticks, and it grows as you scroll down until it fills the screen. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })

  const at = FORM_STAGES.findIndex((x) => x.key === tab)
  const first = at <= 0
  const last = at >= FORM_STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = FORM_STAGES[at + d]
    if (next) setTab(next.key)
  }

  /**
   * "Edit" next to the number in the verification modal.
   *
   * Note: it returns to the stage and focuses the field - returning to the form alone left the
   * entity searching for the field among nine fields, and the focus is what makes the button do
   * what its label promises.
   */
  const editMobile = () => {
    const field = FORM_STAGES.find((x) => x.fields.some((f) => f.key === 'clerkMobile'))
    set({ step: undefined, tab: field && field.key !== FIRST_FORM_STAGE ? field.key : undefined })
    /* Focus after the screen renders the new stage - before that, the field doesn't exist on the page yet. */
    requestAnimationFrame(() => {
      const el = document.getElementById('rf-clerkMobile')
      if (el instanceof HTMLInputElement) { el.focus(); el.select() }
    })
  }



  /* Note: this screen is public, and rule 2 is why. The request's owner is an entity that has no
   account - that's the definition of the process itself: no account before approval. Putting it
   behind the login gate would mean it could only be opened by someone already registered - meaning
   it couldn't be opened by the very party it's built for. That's why its route sits outside
   `RequireAuth`, and its real entry point is the "register a new entity" button on the login screen
   (matching `/reg` in the live system exactly).

     Someone entering from inside (a system admin, for example) sees it through their own view and
     returns to the entities list - so the shell changes with the session, while the content stays
     the same. */
  const inside = isSignedIn()

  /* Note: `hasdock` and `hasg2` aren't decoration - they're what makes the content end above the dock
   instead of scrolling under it. The dock is translucent and blurs what's behind it, and that blur
   is only visible when the page background is behind it - a white card scrolling under it makes the
   gradient invisible entirely, so the bar would cut across content with a hard edge. Same contract
   as the project, request, and agreement pages exactly. */
  /* === Status message and exits - once, and its position changes ===

     Note: the dock isn't for the entity. This system's decision dock is a bar floating above an
     internal screen, with the assistant button next to it, and it assumes whoever's in front of it
     is an employee handling decisions in a work queue. An entity filling out a registration form
     isn't at work and has no queue - they're in a form, and a form's exits live inside it at the
     end, like any web form.

     So the exits are the same, only the position changes: inside the card for someone coming from
     outside, and on the dock for someone inside (a system admin registering a partner entity
     directly - rule 32). */
  const line = (
    <span className="decsent">
      {phase === 'terms' && <>اقرأ الضوابط الخمسة وأقرّ بها قبل فتح النموذج</>}
      {phase === 'form' && (
        draft
          ? <>حُفظ الطلب <b>مسودةً</b> · القاعدة <Num>12</Num>، ويمكن إكماله في أي وقت</>
          : <>
              {/* Note: the count runs over the whole journey, not the form alone - the entity has already passed
   the account stage, so starting the count at "1 of 5" here tells them that step didn't count. */}
              الخطوة <b><Num>{at + 2}</Num> من <Num>{REG_STAGES.length}</Num></b>
              <span className="decsep" />
              {FORM_STAGES[at].label}
              <DockWhy n={missing.length} />
            </>
      )}
      {phase === 'otp' && <>أدخل الرمز المرسَل إلى الجوال · <Num>{OTP_LEN}</Num> أرقام</>}
      {phase === 'sent' && <>رقم الطلب في هذا النموذج <b>REQ-2026-947142</b></>}

    </span>
  )

  const nav = (
    <div className="rowf gp-2">
      {phase === 'terms' && (
        <button
          className="btn btn-p"
          disabled={!agreed}
          title={agreed ? 'تابع إلى إنشاء حساب الجهة' : 'أقرّ بالضوابط أولًا'}
          /* Note: the guardrails lead to the account screen, not the form - the account is the gate, and the
   form sits behind it, so the order is: guardrails -> account -> form. */
          onClick={() => navigate(ROUTES.entityRegisterAccount)}
        >
          تابع إلى إنشاء الحساب
        </button>
      )}

      {phase === 'form' && (
        <>
          {/* Note: "save as draft" is for someone signed in only. Rule 12 allows a request to be saved as a
   draft and completed later, but a draft must be saved against an account so its owner can return
   to it. A new entity has no account - that's rule 2 itself. So the button would have promised the
   entity something with nowhere to return to, and the live `/reg/add` form has no save option at
   all.

             This gap is noted: if the institution wants entities to save and return, that needs
             pre-approval identification (an email link or code) - an open question. */}
          {inside && (
            <button className="btn btn-2" onClick={() => setDraft(true)}>
              احفظ مسودة
            </button>
          )}

          {/* Note: "Previous" is present and disabled on the first step, not hidden - a button that appears
   and disappears makes "Next"'s position jump between steps, forcing the hand to search for it each
   time. */}
          <button
            className="btn btn-2"
            disabled={first}
            title={first ? 'هذه أول خطوة' : `ارجع إلى ${FORM_STAGES[at - 1].label}`}
            onClick={() => go(-1)}
          >
            {/* In RTL, the chevron points right - `chevronBack` draws it. */}
            <Icon name={icons.chevronBack} size="sm" />
            السابق
          </button>

          {/* Note: "Next" doesn't lock on missing fields. Rule 4 blocks submission on gaps, not navigation,
   and the entity fills the form over multiple visits and comes back. Only submission locks, and the
   reason is stated. */}
          {!last ? (
            <button
              className="btn btn-p"
              title={`انتقل إلى ${FORM_STAGES[at + 1].label}`}
              onClick={() => go(1)}
            >
              التالي
              <Icon name={icons.chevron} size="sm" />
            </button>
          ) : (
            <button
              className="btn btn-p"
              disabled={!canSend}
              title={
                clash
                  ? 'رقم الترخيص مكرّر · قاعدة 8'
                  : missing.length
                    ? `ينقص ${missing.length} من الحقول الإلزامية · قاعدة 4`
                    : 'أرسل الطلب للمراجعة'
              }
              onClick={() => setPhase('otp')}
            >
              أرسل الطلب
            </button>
          )}
        </>
      )}

      {phase === 'otp' && (
        <button
          className="btn btn-p"
          disabled={otp.length !== OTP_LEN}
          title={otp.length === OTP_LEN ? 'أكّد الرمز' : `الرمز ${OTP_LEN} أرقام`}
          onClick={() => setPhase('sent')}
        >
          أكّد الرمز
        </button>
      )}

      {/* The final exit changes by context: the request inbox is an internal screen the entity has no
   access to - they return to the login page to await their credentials. */}
      {phase === 'sent' && (
        inside
          ? <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>
              افتح صندوق الطلبات
            </button>
          : <button className="btn btn-2" onClick={() => navigate(ROUTES.login)}>
              العودة إلى صفحة الدخول
            </button>
      )}
    </div>
  )

  /** Exits inside the card - for someone coming from outside only. */
  const foot = inside ? null : (
    <div className="regfoot">
      {line}
      <span className="pc-sp" />
      {nav}
    </div>
  )

  const body = (
    <div className={`viewstack${inside ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          {inside ? (
            <BackTo label="الجهات" onClick={() => navigate(ROUTES.entities)} />
          ) : (
            <div className="regtop">
              <Logo className="mark mark-38" />
              <div>
                <b>منح أبانمي</b>
                <span className="sub">مؤسسة سليمان أبانمي الأهلية</span>
              </div>
              <span className="pc-sp" />
              <button className="btn btn-2 btn-sm" onClick={() => navigate(ROUTES.login)}>
                لديك حساب؟ سجّل الدخول
              </button>
            </div>
          )}

          <header>
            <div>
              <h1 className="ptitle">طلب تسجيل جهة جديدة</h1>
              <p className="sub mt-1">
                ما يُقدَّم هنا <b>طلب</b> لا حساب · وتُنشأ الجهة بعد اعتماد
                مسؤول النظام وحده (قاعدة <span className="num">2</span>)
              </p>
            </div>
            {/* The count badge in the page header was removed - a single count now lives in the dock. */}
          </header>

          <div className="g2">
            <div className="col">
              {phase === 'terms' && (
                <Glass>
                  <Head
                    title="ضوابط قبول الجهة"
                    meta={<span className="sub">من بوّابة التسجيل في النظام العامل</span>}
                  />
                  <ul className="regterms">
                    {REG_TERMS.map((t, i) => (
                      <li key={t}>
                        <span className="regterms-n num">{i + 1}</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="regck">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>أقرّ بأن الجهة مستوفية للضوابط الخمسة أعلاه</span>
                  </label>
                  {/* Note: these guardrails aren't in the spec - they come from the live system, and they're here
   because they're an eligibility filter that saves the entity twenty minutes on a form that's
   headed for rejection. */}
                  <p className="sub cnote">
                    الضوابط مأخوذة من صفحة «ضوابط قبول الجهة» في النظام العامل ·
                    والوثيقة تبدأ خطواتها الـ<span className="num">17</span> من تعبئة
                    النموذج مباشرة، فوجود هذه المحطة فرق مسجَّل للمراجعة.
                  </p>
                  {foot}
                </Glass>
              )}

              {phase === 'form' && (
                <>
                  {/* Note: these are steps, not tabs, and the difference isn't naming. A tab just says "where you are"
   and any order is fine - these steps are genuinely sequential: the category chosen in the first
   one determines the mandatory documents in the last, and the bank can't be entered before we know
   who the entity is. So the bar became a stepper: a number per step, replaced with a checkmark once
   complete. */}
                  {/* Note: the stepper sits inside a card rather than bare on the background. The tabs that used to
   occupy this spot were bare, and the new bar has dim text (a step not yet started) - and `--t3`
   dropped to 3.77 directly on the page gradient. The card provides a known surface like every other
   block in the system, so the dim text reads correctly the way it does inside any card. */}
                  <Glass className="regsteps">
                  <Steps
                    flow="stepper"
                    /* Note: clicking a stage with its own screen does nothing - that screen has already been passed,
   and returning to it would mean creating another account. The click is ignored rather than leading
   to a step that doesn't exist in this form. */
                    onPick={(i) => {
                      const st = REG_STAGES[i]
                      if (!st.own) setTab(st.key)
                    }}
                    /* Note: the missing-field count was removed from under the name. It used to appear three times on
   the same screen: under each step, in the card header badge, and in the dock message - with a
   "what's missing" list next to it naming the fields. The stepper answers one question - where are
   you and how far have you gotten - and status is conveyed by the dot alone (number / check /
   amber) with no second line. */
                    /* Note: "nothing missing" isn't "done" - see `stepState`. */
                    /* Note: the account stage is always marked "done" - not by assumption, but because reaching the
   form is only possible after it: its screen is the gate, and anyone here has already passed it.
   Removing it from the bar would make the entity think the journey is five steps when it's six. */
                    items={REG_STAGES.map((st, i) => ({
                      label: st.label,
                      state: st.own ? 'done' : stepState(
                        i,
                        REG_STAGES.findIndex((x) => x.key === tab),
                        shortBy[st.key]?.length ?? 0,
                      ),
                    }))}
                  />
                  </Glass>

                  {/* Note: the request is saved against an account, and the entity needs to see that. The account
   screen has already passed, and this line is the only trace of it left in the form - without it
   the entity would ask "why did I create this account". */}
                  {regAccount.email && (
                    <p className="sub tcen">
                      يُحفظ الطلب على <Mono>{regAccount.email}</Mono> · يمكن تركه
                      والعودة إليه، وتصل إليه الإشعارات.
                    </p>
                  )}

                  {FORM_STAGES.filter((s) => s.key === tab).map((s) => (
                    <Glass key={s.key}>
                      <Head
                        title={s.label}
                        meta={
                          shortBy[s.key].length
                            ? <Tag tone="warn"><Num>{shortBy[s.key].length}</Num> ناقص</Tag>
                            : <Tag tone="ok">مكتمل</Tag>
                        }
                      />
                      <p className="sub cnote">{s.note}</p>

                      {s.key === 'docs' ? (
                        <>
                          {/* Note: who uploads? The entity itself - specifically the data-entry person named in the "contact
   and people" step, the same person who'll receive the username after approval. So this line isn't
   decorative header text: it tells the entity the documents are their responsibility, and that the
   name they entered above is the one recorded with every file in the audit log (rule 30). */}
                          <div className="regwho">
                            {val.clerkName ? (
                              <>
                                <Person name={val.clerkName} quiet={false} />
                                <span className="sub">
                                  مدخل بيانات الجهة · هو من يرفع، واسمه يُسجَّل مع كل ملف
                                  في سجل التدقيق (قاعدة <span className="num">30</span>)
                                </span>
                              </>
                            ) : (
                              <>
                                <Icon name={icons.users} size="sm" />
                                <span className="sub">
                                  المستندات ترفعها <b>الجهة نفسها</b> · اكتب اسم مدخل
                                  البيانات في خطوة «الاتصال والأشخاص» ليُسجَّل مع كل ملف.
                                </span>
                              </>
                            )}
                          </div>

                          {/* Note: the legal upload warning matches the client's required wording: "Uploading company data or
   any other prohibited files is strictly forbidden."

                             Note: and it's a plain line, not a red badge or side banner. The rule
                             repeated here: red signals danger, and a warning colored red before
                             anyone has made a mistake makes red mean nothing once a mistake
                             actually happens. */}
                          <p className="sub cnote">
                            يمنع منعًا باتًا رفع بيانات الشركة أو أي ملفات محظورة
                            أخرى · والملفات المرفوعة تُسجَّل باسم مدخل البيانات في سجل
                            التدقيق (قاعدة <span className="num">30</span>).
                          </p>

                          <ul className="regdocs">
                            {REG_DOCS.map((d) => {
                              const need = docRequired(d, type)
                              const on = docs.has(d.key)
                              const picked = files[d.key]
                              return (
                                <li key={d.key} className={on ? 'ok' : need ? 'no' : ''}>
                                  <div className="regdoc-h">
                                    <span className="regdocs-l">{d.label}</span>
                                    <span className="pc-sp" />
                                    {/* Note: type is a fixed badge and status is a separate one - "required" used to turn green once
   uploaded, so the same "required" document read amber on one screen and green on another. */}
                                    {on && <Tag tone="ok">مرفوع</Tag>}
                                    {/* Type is a neutral badge - the only colored element in the row is upload status. */}
                                    {need
                                      ? <Tag tone="mute">
                                          {d.reqFor ? `إلزامي للتصنيف ${d.reqFor[0]}` : 'إلزامي'}
                                        </Tag>
                                      : <Tag tone="mute">اختياري</Tag>}
                                  </div>

                                  {on ? (
                                    /* A sample after upload - the same `DocFile` used for projects, entities and agreements, with a
   thumbnail, so the reviewer knows the file type before opening it, and the entity sees what they
   uploaded exactly as the reviewer will. */
                                    <div className="regdoc-up">
                                      <DocFile
                                        name={picked?.name ?? `${d.label}.pdf`}
                                        meta={
                                          picked
                                            ? `${(picked.size / 1024 / 1024).toFixed(2)} م.ب · بانتظار الإرسال`
                                            : 'عيّنة · بانتظار الإرسال'
                                        }
                                        block
                                        download={false}
                                      />
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => clearDoc(d.key)}
                                      >
                                        <Icon name={icons.close} size="sm" />
                                        أزل الملف
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="regdrop">
                                      <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.gif"
                                        onChange={(e) => upload(d.key, e.target.files?.[0])}
                                      />
                                      <Icon name={icons.upload} size="sm" />
                                      <span>اسحب الملف هنا أو اضغط لاختياره</span>
                                      <span className="pc-sp" />
                                      {/* File formats and size limit taken verbatim from the live system. */}
                                      <span className="sub regdocs-m">
                                        PDF أو JPG أو PNG · حتى{' '}
                                        <span className="num">{d.maxMb}</span> م.ب
                                      </span>
                                    </label>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </>
                      ) : s.key === 'bank' ? (
                        <BankRows banks={banks} onChange={setBanks} />
                      ) : (
                        <div className="regfields">
                          {s.fields.map((f) => (
                            <Field
                              key={f.key}
                              f={f}
                              value={val[f.key] ?? ''}
                              parent={f.dependsOn ? val[f.dependsOn] ?? '' : ''}
                              onChange={(x) => setField(f.key, x)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Rules 8 and 9 - validated in the field, not after submission, and the message states which entity
   it conflicts with. */}
                      {s.key === 'id' && clash && (
                        <p className="bad cnote">
                          رقم الترخيص <Mono>{val.licenseNo}</Mono> مسجَّل لـ
                          «{clash.name}» بنفس التصنيف · القاعدة{' '}
                          <span className="num">8</span> تمنع التكرار، والقاعدة{' '}
                          <span className="num">9</span> تستثنيه إذا اختلف التصنيف.
                        </p>
                      )}

                      {s.key === 'docs' && (
                        <p className="sub cnote">
                          الإلزام يتغيّر بتصنيف الجهة · التصنيف الحالي{' '}
                          {type ? <b>{type}</b> : <span className="bad">لم يُختر بعد</span>}،
                          والمطلوب{' '}
                          <span className="num">
                            {REG_DOCS.filter((d) => docRequired(d, type)).length}
                          </span>{' '}
                          من <span className="num">{REG_DOCS.length}</span>.
                        </p>
                      )}
                      {foot}
                    </Glass>
                  ))}
                </>
              )}

              {phase === 'otp' && (
                <Glass>
                  <Head
                    title="تحقّق من جوال مدخل البيانات"
                    meta={<span className="sub">قاعدة 19</span>}
                  />
                  {/* Note: the "Edit" button next to the number matches the client's screens. An entity that typed a
   wrong number used to have to cancel submission, go back to the form, and search for the field.
   Here the button actually does something: it returns to the contact stage and focuses that same
   field - the same lesson the client held onto: a button that does nothing is worse than no button
   at all. */}
                  <p className="sub cnote">
                    أُرسل رمز لمرة واحدة إلى{' '}
                    <Mono>{val.clerkMobile || '9665XXXXXXXX'}</Mono>
                    {' · '}
                    <button className="lnk" onClick={editMobile}>تعديل</button>
                    {' · '}
                    وهو نفس الرقم الذي ستصل إليه بيانات الدخول بعد الاعتماد.
                  </p>
                  <label className="payamt">
                    <span className="lb">رمز التحقّق</span>
                    <input
                      inputMode="numeric"
                      value={otp}
                      maxLength={OTP_LEN}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      aria-label="رمز التحقّق"
                    />
                  </label>
                  <p className="sub cnote">
                    في هذا النموذج أي <span className="num">{OTP_LEN}</span> أرقام
                    تُقبل · والتحقّق الفعلي يجري على الخادم.
                  </p>
                  {foot}
                </Glass>
              )}

              {phase === 'sent' && (
                <Glass>
                  <Head title="أُرسل الطلب" meta={<Tag tone={REG_TONE.review}>قيد المراجعة</Tag>} />
                  {/* Note: the reference number and its copy button match the client's screens. Their format is
   `REQ-2026-947124`, not `RG-1039`, with a copy icon next to it. The entity needs this number when
   contacting the institution, and a fourteen-character string is easy for the eye to mistype. */}
                  <p className="sub cnote">
                    رقمك المرجعي <CopyId>REQ-2026-947142</CopyId> · احتفظ به، فبه
                    تُتابَع حالة الطلب.
                  </p>
                  <ul className="payq-ck regsent">
                    <li className="ok">
                      <Icon name={icons.check} size="sm" />
                      <span>وصل الطلب إلى مسؤول النظام، وحالته «قيد المراجعة»</span>
                      <span className="payq-r">قاعدة <Num>26</Num></span>
                    </li>
                    <li className="ok">
                      <Icon name={icons.check} size="sm" />
                      <span>سُجّل الطلب في سجل التدقيق بوقته ومُدخله</span>
                      <span className="payq-r">قاعدة <Num>30</Num></span>
                    </li>
                    <li className="no">
                      <Icon name={icons.alert} size="sm" />
                      <span>
                        <b>لم يُنشأ حساب بعد</b> · اسم المستخدم يصل بعد الاعتماد وحده
                      </span>
                      <span className="payq-r">قاعدة <Num>2</Num></span>
                    </li>
                  </ul>
                  <p className="sub cnote">
                    السطر الأخير مكتوب عمدًا: الجهة التي تظن أنها سُجّلت تبقى
                    بانتظار بريد لن يصل، ثم تتصل لتسأل.
                  </p>
                  {foot}
                </Glass>
              )}
            </div>

            {/* === Side column - one sticky card ===
               Note: there used to be three cards, removed at the client's decision: "request path"
               duplicated the stepper above in a second form, "missing before submission" counted
               items without saying why, and "bank account" was reference text unrelated to
               whichever step the user was on. All three answered the same question in three
               different ways, and the user reads only one.

               A single card is what makes the sticky behavior work: a column with several sticky
               cards creates scroll-inside-scroll. */}
            <div className="col aiside" ref={aside}>
              {/* "Seed planted" success state (spirit, motion 3) - in what used to be empty text; the primary
   status badge stays in the card as-is. */}
              {phase === 'sent' && <div className="hero-slot"><HeroSuccess /></div>}
              {/* Note: identical to the project and entity analytics card. It used to be a card written for this
   screen alone, with its own list and tone, so the user saw "Abanumay assistant" in two different
   shapes depending on where they were. `ReadingBlock` is documented as the only reading renderer in
   the system, and this comment exists because the same mistake happened again.

                 And "review my request" runs on request, not automatically: the reading is computed
                 when the user asks for it, and stays cached after - the closed card shows the
                 single most important line with no click needed. */}
              {phase === 'form' && (
                <AnalysisCard
                  title="مراجعة مساعد أبانمي"
                  cta="راجع طلبي"
                  empty="لا يوجد مانع في هذه الخطوة · انتقل إلى الخطوة التالية."
                  ask={inside}
                  onAsk={() => window.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                  )}
                  readings={regReadings(
                    tab,
                    REG_STAGES.map((st) => ({
                      key: st.key, label: st.label, short: shortBy[st.key] ?? [],
                    })),
                    advice,
                    setTab,
                  )}
                />
              )}
            </div>
          </div>
        </div>

        {/* The dock - exits change by stage, and no exit is disabled without a reason. */}
        {/* The dock is for someone signed in only - see the note above at `line`.
           Note: its padding leaves room on the left for the floating "Ask Abanumay" button, which
           lives inside `AppLayout` alone. */}
        {inside && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">{line}</div>
              {nav}
            </div>
          </div>
        )}
      </div>
  )

  /* The background and shell use the same components - the only difference is the rail and assistant
   aren't present, since they have no meaning for someone without an account. */
  return inside ? (
    <AppLayout assistantContext={assistFor.page('تسجيل جهة جديدة')}>{body}</AppLayout>
  ) : (
    <>
      <Background />
      <div className="app">
        <div className="shell">{body}</div>
      </div>
    </>
  )
}
