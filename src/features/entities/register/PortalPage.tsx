import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CopyId, DateText, Glass, Head, Icon, KV, Mono, Num, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { DocList, UploadButton } from '@/components/docs'
import { Thread } from '@/components/thread'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
import { useQueryParams } from '@/hooks/useQueryParams'
import { NOUN, nounAfter, readDate } from '@/lib/format'
import {
  BANK_DOC_LABEL, REG_STATE_SAY, REG_TONE, regMissingDocs, regRequestById,
} from '@/data/mock/registration'
import { portalViewOf, regThread } from '@/data/mock/regPortal'
import { planStageLabel, plansOfEntity, waitingReview } from '@/data/mock/plans'

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
  const { values } = useQueryParams(['req'])
  const r = regRequestById(values.req ?? DEFAULT_REQ) ?? regRequestById(DEFAULT_REQ)!

  const view = portalViewOf(r.state)
  /* The entity's plans - read from the `entityId` created after approval. */
  const plans = r.entityId ? plansOfEntity(r.entityId) : []
  const missing = regMissingDocs(r)

  /* Note: upload here needs to actually do something, and so does submit after it. "Upload" and
     "resubmit" used to be buttons with no action - and this is the one thing the entity came to the
     portal for. Now every uploaded document is marked with its file name, the button enables once
     nothing is missing, and submitting actually moves the application to "under review" on screen. */
  const [up, setUp] = useState<Record<string, string>>({})
  const [resent, setResent] = useState(false)
  const short = missing.filter((d) => !up[d.key])

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
      : r.state === 'draft' || r.state === 'completion'
        ? 0
        : r.state === 'review' ? 1 : 2
    return order.indexOf(k) < at ? 'done' : order.indexOf(k) === at ? 'now' : 'todo'
  }

  /* Note: no `note` in the stepper. The horizontal bar answers one question: where are you and how
     far along - a second line under every stage turns it into a paragraph, and that text already
     lives below the bar. Same rule applied to the registration stepper. */
  /* Note: the decision made is a result, not an ongoing stage - approved (check) or rejected (x).
     `at = 2` used to keep "decision" as the current stage even after rejection. */
  const outcome: StepItem['state'] | null =
    resent ? null : r.state === 'approved' ? 'done' : r.state === 'rejected' ? 'no' : null
  const steps: StepItem[] = [
    { label: 'تجهيز الطلب', state: done('draft') },
    { label: 'مراجعة المؤسسة', state: done('review') },
    { label: r.state === 'rejected' && !resent ? 'القرار · مرفوض' : 'القرار', state: outcome ?? done('decided') },
  ]

  const thread = regThread(r.state, r.name)

  /* Note: no reel and no internal assistant - exactly like the registration screen. Whoever opens
     this is an entity with no system account, and a reel featuring "projects" and "budget" promises
     things that aren't theirs - the first click would have dropped them onto a login screen with no
     explanation why. The shared shell matches `RegisterPage`, so the entity sees the same
     surroundings it registered from. */
  const body = (
      <div className="viewstack">
        <div className="screen col">
          <div className="regtop">
            <Logo className="mark mark-38" />
            <div>
              <b>منح أبانمي</b>
              <span className="sub">بوّابة الجهة · طلبك أنت</span>
            </div>
            <span className="pc-sp" />
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
              <h1 className="ptitle">{r.name}</h1>
              <p className="sub mt-1">
                طلب تسجيل <CopyId>{r.id}</CopyId> · أُرسل في{' '}
                <DateText>{r.submittedAt}</DateText>
              </p>
            </div>
          </header>

          {/* Note: the stepper sits in its own section, like the rest of the system. It used to
              live inside the application card here, while every other screen (portal registration,
              internal registration, and the plan page) treats it as its own `regsteps` card above
              the content - the same element in two different places. */}
          <Glass className="regsteps">
            <Steps items={steps} flow="stepper" />
          </Glass>

          <div className="g2">
            {/* Right - application card
                Everything the entity needs in one card: what the institution said, what's missing,
                and a submit button, in that order. */}
            <div className="col">
              <Glass className="ptl-req">
                <Head
                  title="طلبك"
                  /* The tag follows submission - without it the card says "awaiting completion"
                     while the stepper above it says "review". */
                  meta={resent
                    ? <Tag tone={REG_TONE.review}>{REG_STATE_SAY.review}</Tag>
                    : <Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag>}
                />

                {!resent && <p className="sub cnote">{view.say}</p>}

                {/* Review outcome - what the institution said, verbatim */}
                {r.note && (
                  <div className={`ptl-res${r.state === 'rejected' ? ' no' : ''}`}>
                    <Icon name={icons.alert} size="sm" />
                    <div>
                      <b>{r.state === 'rejected' ? 'سبب الرفض' : 'ما طلبته المؤسسة'}</b>
                      <p>{r.note}</p>
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
                    أُرسل <DateText>{r.submittedAt}</DateText>
                    {' · '}<Mono>{r.id}</Mono>
                  </span>
                  {view.act && !resent && (
                    <button
                      className="btn btn-p"
                      disabled={view.editable && short.length > 0}
                      title={view.editable && short.length > 0
                        ? 'ارفع المستندات الناقصة أولًا'
                        : undefined}
                      onClick={() => {
                        if (r.state === 'approved') navigate(ROUTES.entity(r.entityId ?? '755'))
                        else setResent(true)
                      }}
                    >
                      <Icon name={r.state === 'approved' ? icons.entity : icons.send} size="sm" />
                      {r.state === 'approved' ? view.act : 'أعد إرسال الطلب'}
                    </button>
                  )}
                </footer>
              </Glass>

              <Glass>
                <Head title="بيانات الطلب" meta={<span className="sub">كما أرسلتها الجهة</span>} />
                <KV
                  rows={[
                    { k: 'التصنيف', v: r.type },
                    { k: 'جهة الإشراف الفني', v: r.licensor },
                    { k: 'المنطقة', v: `${r.region} · ${r.city}` },
                    { k: 'رقم الترخيص', v: <Mono>{r.licenseNo}</Mono> },
                    {
                      k: 'بريد الحساب',
                      v: <a className="tlink" href={`mailto:${r.acctEmail}`}><Mono>{r.acctEmail}</Mono></a>,
                    },
                    { k: 'المستندات المرفوعة', v: <><Num>{r.docs.length}</Num> {nounAfter(r.docs.length, NOUN.doc)}</> },
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
                  meta={<span className="sub"><Num>{r.banks.length}</Num> حساب</span>}
                />
                {/* Note: the bank certificate is a `DocList` row like any attachment. `DocFile`
                    used to stand alone inside the account column - and `.dfile-b`'s padding is
                    built for a table row (44px thumbnail + padding = row height), so outside a
                    table that padding adds to the space above and below it, leaving the row loose
                    and unlike its counterpart on the project page (which the client has seen). */}
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

              {/* Entity plans - rule 12.
                  Note: this only appears after approval. Before that, the entity has no projects at
                  all, so it has no plans - and an empty card labeled "your plans" on a screen still
                  awaiting a decision implies something is missing, when really it just hasn't
                  started. */}
              {r.state === 'approved' && plans.length > 0 && (
                <Glass>
                  <Head
                    title="خطط مشاريعك"
                    meta={<span className="sub"><Num>{plans.length}</Num> {nounAfter(plans.length, NOUN.plan)}</span>}
                  />
                  {/* Note: this sentence is what prevents the biggest misunderstanding in this
                      module: "uploaded the evidence" isn't "counted as complete". */}
                  <p className="sub cnote">
                    ترفع الجهة الشواهد وتُبلغ باكتمال النشاط · ويُحتسب الإنجاز بعد
                    مراجعة مشرف المنح وقبوله (القاعدة <span className="num">14</span>).
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
            </div>

            {/* Left - correspondence
                Note: the exact same `Thread` as the project page - whatever's stuck with the entity
                gets resolved with a word, not a form, and the channel is the natural place for a
                question. */}
            <div className="col">
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
                  entityName={r.name}
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
          </div>

          <p className="sub tcen cnote">
            ليس طلبك؟{' '}
            <Link className="lnk" to={ROUTES.entityRegister}>ابدأ طلب تسجيل جديد</Link>
            {' · '}
            {readDate(r.submittedAt)}
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
