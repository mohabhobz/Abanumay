import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HEAT_TONE } from '@/lib/tone'
import {
  BackTo, DateText, Empty, Glass, Head, Icon, icons, KV, Money, Mono, Num, Person, Riyal,
  StepArc, Tag, type GateStep,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf, NOUN, nounAfter, readDate } from '@/lib/format'
import {
  AGR_LIMIT, AGREEMENT_STAGES, agrHeat, agrPaymentsBalance, agrReserveGap, agrStageWho,
  agreementById,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'
import { AgrActionDock, agrActionsFor } from './AgrActionDock'
import { ScheduleEditor, asDraft } from './ScheduleEditor'
import { EditableCard } from '@/features/shared/EditableCard'

/* A single agreement - the four approval stages in the document's flow.

   Note: one screen serves four stages. The flow defines four paths - grants supervisor, grants
   manager, executive director, beneficiary entity - and all four see the same agreement, same
   terms, same schedule, same log. What differs is the available actions, defined solely in
   `agrActionsFor`.

   Note: "return" does not have a single path. This is the most important detail here:
     Step 14 - grants manager return      -> grants supervisor
     Step 18 - executive director return  -> grants manager, not the supervisor
     Step 22 - entity return              -> grants supervisor, not the director
   Three different destinations. "Go back one step" would be wrong for two of them.

   What this screen must guarantee:
   Rule 5 - retrieved data can only be changed on the original project
   Rule 7 - the payment schedule is part of the agreement, not an attachment
   Rule 8 - payments must sum to the grant amount, and percentages to 100%
   Step 11 - agreement value equals the amount reserved in the budget
   Rule 11 - once logged, an entry can't be deleted or edited
   Rule 13 - sending to the entity is blocked until institutional approvals are complete
   Rule 16 - the signed paper copy must be attached before activation
   Rule 17 - no edits after signing; an edit becomes a new version
   Rule 20 - a notification on every transition
   Rule 21 - AI output is advisory only
   Rule 24 - multiple versions, one active
   Rule 25 - the agreement's stage does not change the project's status */

/** The four stages users see, per the flow. */
const LADDER: { key: string; label: string; note: string; cap: string; steps: number[] }[] = [
  { key: 'draft', label: 'إعداد الاتفاقية', note: 'مشرف المنح', cap: 'الإعداد', steps: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { key: 'manager', label: 'مراجعة مدير المنح', note: 'مدير المنح', cap: 'المراجعة', steps: [12, 13] },
  { key: 'executive', label: 'اعتماد المدير التنفيذي', note: 'المدير التنفيذي', cap: 'الاعتماد', steps: [16, 17] },
  { key: 'entity', label: 'توقيع الجهة', note: 'الجهة المستفيدة', cap: 'التوقيع', steps: [20, 21] },
]

/** Which stage the agreement is at; a returned agreement goes back to whoever sent it back. */
const NOW_AT: Record<string, string> = {
  draft: 'draft',
  returned: 'draft',
  manager: 'manager',
  executive: 'executive',
  entity: 'entity',
  active: '',
  cancelled: '',
}

/** The agreement's own stages as fan steps - same chart as the project header. */
function ladderFor(a: AgreementRow): GateStep[] {
  const now = NOW_AT[a.stage]
  const done = new Set(a.log.map((e) => e.step))
  const days = Math.round(a.hoursInStage / 24)
  const limit = AGR_LIMIT[a.stage]
  return LADDER.map((s): GateStep => {
    const last = a.log.find((e) => e.step === s.steps[s.steps.length - 1])
    const range = `${s.steps[0]}–${s.steps[s.steps.length - 1]}`
    if (s.key === now) {
      return {
        label: s.note,
        title: s.label,
        cap: s.cap,
        state: 'now',
        lines: [
          <><Person name={a.owner} quiet={false} /> · مفتوح منذ <b>{days}</b> {nounAfter(days, NOUN.day)}</>,
          limit > 0
            ? <><b>{nf.format(a.hoursInStage)}</b> ساعة مقابل حدّ <b>{nf.format(limit)}</b></>
            : null,
        ],
        src: 'المصدر: سجل التدقيق',
      }
    }
    if (s.steps.every((n) => done.has(n))) {
      return {
        label: s.note,
        title: s.label,
        cap: s.cap,
        state: 'done',
        lines: [
          last ? <>{last.who} · <DateText>{last.at}</DateText></> : null,
          last ? isolate(last.what) : null,
        ],
        src: 'المصدر: سجل التدقيق',
      }
    }
    return {
      label: s.note,
      title: s.label,
      cap: s.cap,
      state: 'pending',
      lines: [
        'تبدأ بعد اكتمال المرحلة السابقة',
        <>الخطوات <span className="num">{isolate(range)}</span> في الوثيقة</>,
      ],
      src: 'المصدر: مسار الاتفاقية',
    }
  })
}

export default function AgreementPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const mobile = useIsMobile()
  const a = agreementById(id)
  const [note, setNote] = useState('')
  const [taken, setTaken] = useState<string | null>(null)

  const ladder = useMemo(() => (a ? ladderFor(a) : []), [a])

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
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.agreements)}>
                    ارجع إلى الصندوق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const heat = agrHeat(a)
  const days = Math.round(a.hoursInStage / 24)
  const limitDays = Math.round(AGR_LIMIT[a.stage] / 24)
  const meta = AGREEMENT_STAGES.find((s) => s.key === a.stage)
  const balance = agrPaymentsBalance(a)
  const gap = agrReserveGap(a)
  const actions = agrActionsFor(role.key, a.stage)

  /* The hollow center names who holds the decision now; a finished or cancelled agreement has none. */
  const nowAt = ladder.findIndex((s) => s.state === 'now')
  const holder: { k: string; t: string; rest: React.ReactNode[] } =
    a.stage === 'active'
      ? {
          k: 'اكتمل مسار الاعتماد',
          t: 'الاتفاقية سارية',
          rest: [a.activeAt ? <>فُعّلت في <DateText>{a.activeAt}</DateText></> : null],
        }
      : a.stage === 'cancelled'
        ? { k: 'توقّف مسار الاعتماد', t: 'الاتفاقية ملغاة', rest: [] }
        : {
            k: 'صاحب القرار الآن',
            t: agrStageWho(a.stage),
            rest: [
              <>المرحلة <b className="num">{nowAt + 1}</b> من <b className="num">{LADDER.length}</b> · {meta?.label}</>,
              a.stage === 'returned' ? 'أُعيدت للتعديل، وتعود إلى مشرف المنح' : null,
            ],
          }

  return (
    <AppLayout assistantContext={assistFor.page(`اتفاقية ${a.id}`, a.projectName)}>
      <div className={`viewstack${actions.length > 0 ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label="الاتفاقيات" onClick={() => navigate(ROUTES.agreements)} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{a.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{a.id}</Mono> · {a.entityName} · {a.kind}
                {a.version > 1 && <> · الإصدار <span className="num">{a.version}</span></>}
              </p>

              <div className="pamt">
                <div className="lb">قيمة المنحة</div>
                <div className="v"><Money sm>{a.amount}</Money></div>
                <div className="sub">
                  {/* Step 11 - a mismatch with the reserved amount blocks submission for approval. */}
                  {gap === 0
                    ? <>مطابقة للمخصص المحجوز في الميزانية · على <Num>{a.payments.length}</Num> {nounAfter(a.payments.length, NOUN.payment)}</>
                    : <span className="bad">
                        المحجوز <Mono>{nf.format(a.reserved)}</Mono> · فرق{' '}
                        <Mono>{nf.format(Math.abs(gap))}</Mono> يمنع الإرسال للاعتماد
                      </span>}
                </div>
              </div>
            </div>

            {/* Same fan as the project header, driven by the agreement's own stages. */}
            <div className="pgates">
              <StepArc
                steps={ladder}
                compact={mobile}
                aria={`مسار اعتماد الاتفاقية، ${holder.t}`}
                holderKey={holder.k}
                holder={holder.t}
                rest={holder.rest}
              />
            </div>
          </header>

          <div className="prow">
            <Tag tone={heat === 'ok' ? 'mute' : HEAT_TONE[heat]}>
              {meta?.label ?? 'ملغاة'}
            </Tag>
            {a.stage !== 'active' && (
              <span className="sub">
                عند {agrStageWho(a.stage)} منذ <Num>{days}</Num> {nounAfter(days, NOUN.day)}
                {limitDays > 0 && <> · حدّ المرحلة <Num>{limitDays}</Num> {nounAfter(limitDays, NOUN.day)}</>}
              </span>
            )}
            {a.stage === 'active' && a.activeAt && (
              <span className="sub">فُعّلت في <DateText>{a.activeAt}</DateText></span>
            )}
            <span className="pc-sp" />
            <Person name={a.owner} />
            <Link className="btn btn-2 btn-sm" to={ROUTES.project(a.projectId)}>
              <Icon name={icons.doc} size="sm" />
              المشروع
            </Link>
          </div>

          {/* Note: rule 25 is stated on screen because it's the most confusing part: an agreement
              can be "awaiting executive director" while its project still shows "agreement setup" -
              and both are correct. */}
          {a.stage !== 'active' && (
            <p className="sub cnote tcen">
              مرحلة الاتفاقية لا تغيّر حالة المشروع · يبقى «إعداد الاتفاقية» حتى
              الاعتماد النهائي، وفق القاعدة <span className="num">25</span> في الوثيقة.
            </p>
          )}

          <div className="g2">
            <div className="col">
              {/* Payment schedule - rule 7: part of the agreement, not an attachment to it. */}
              <Glass className="tblcard">
                <Head
                  title="جدول صرف الدفعات"
                  meta={
                    balance.balanced
                      ? <Tag tone="ok">متوازن</Tag>
                      : <Tag tone="no">غير متوازن · قاعدة 8</Tag>
                  }
                />
                {/* Note: same component as the draft builder, in `readOnly`. Previously there was a
                    third table (`.agrpay`) with its own validation, so the same payment schedule
                    had three different shapes across three screens, and a fix in one never reached
                    the others. */}
                <ScheduleEditor rows={asDraft(a.payments)} amount={a.amount} readOnly />
              </Glass>

              {/* AI output, tagged per rule 21. */}
              {a.ai && (
                <Glass>
                  <Head title="تحليل الذكاء الاصطناعي" meta={<Tag tone="mute">استرشادي</Tag>} />
                  <div className="payq-ai">
                    <Icon name={icons.spark} size="sm" />
                    <span>{a.ai}</span>
                  </div>
                  <p className="sub cnote">
                    يقترح الذكاء الاصطناعي النموذج ويعبّئ المسودة ويكتشف التعارض
                    والنقص في البنود (البند 9.5) · وتنص القاعدة 21 على أن مخرجاته
                    <b> أدوات دعم</b> ولا تُعتمد الاتفاقية بناءً عليها وحدها.
                  </p>
                </Glass>
              )}

              {/* Return note - rule 10 requires stating a reason. */}
              {a.note && (
                <Glass>
                  <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">بانتظار الاستكمال</Tag>} />
                  <div className="payq-note">
                    <Icon name={icons.chat} size="sm" />
                    <span>{isolate(a.note)}</span>
                  </div>
                </Glass>
              )}

              {/* Attachments and annexes - rule 18 ties them to the project and budget. */}
              <Glass>
                <Head
                  title="الاتفاقية وملاحقها"
                  meta={<span className="sub"><Num>{a.docs.length}</Num> {nounAfter(a.docs.length, NOUN.doc)}</span>}
                />
                <div className="docgrid">
                  {a.docs.map((d) => (
                    <DocFile key={d.name} name={d.name} meta={readDate(d.at)} />
                  ))}
                </div>
              </Glass>

              {/* Audit log - rule 22, and rule 11: entries can't be deleted or edited. */}
              <Glass>
                <Head
                  title="سجل التدقيق"
                  meta={<span className="sub">كل انتقال مع رقم خطوته في الوثيقة</span>}
                />
                <ol className="paylog">
                  {[...a.log].reverse().map((e, i) => (
                    <li key={`${e.step}-${i}`}>
                      <span className="paylog-s num">{e.step}</span>
                      <div className="paylog-b">
                        <div className="paylog-t">{e.what}</div>
                        <div className="sub">
                          {e.who}
                          {e.role !== e.who && <> · {e.role}</>}
                          <span className="pc-dot" />
                          <DateText>{e.at}</DateText>
                          {/* Rule 24 - the version is part of the log because prior approvals are
                              preserved through a return. */}
                          {e.version > 1 && (
                            <>
                              <span className="pc-dot" />
                              الإصدار <span className="num">{e.version}</span>
                            </>
                          )}
                        </div>
                        {e.note && <div className="paylog-n">{isolate(e.note)}</div>}
                        {e.notified && (
                          <div className="paylog-i sub">
                            <Icon name={icons.send} size="sm" />
                            إشعار · {e.notified}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </Glass>
            </div>

            <div className="col">
              <EditableCard module="agreement" state={a.stage} label={meta?.label} />
              {/* Template and type - rules 3 and 4. */}
              <Glass>
                <Head
                  title="النموذج والنوع"
                  meta={<span className="sub">قواعد 3 · 4</span>}
                />
                <KV
                  rows={[
                    { k: 'نوع الاتفاقية', v: a.kind },
                    { k: 'النموذج المعتمد', v: a.template },
                    { k: 'الإصدار', v: <><Num>{a.version}</Num> · إصدار واحد ساري</> },
                    { k: 'بدء الإعداد', v: <DateText>{a.openedAt}</DateText> },
                  ]}
                />
                <p className="sub cnote">
                  تُثبّت القاعدة 3 النوع عند الإنشاء · تغييره بعد بدء دورة الاعتماد
                  يستلزم <b>إصدارًا جديدًا</b>.
                </p>
              </Glass>

              {/* Project and entity - rule 5: retrieved, not editable here. */}
              <Glass>
                <Head title="البيانات المسترجعة" meta={<span className="sub">قاعدة 5</span>} />
                <KV
                  rows={[
                    /* Any relationship that has its own page becomes a link. */
                    {
                      k: 'المشروع',
                      v: <Link className="tlink" to={ROUTES.project(a.projectId)}><Mono>{a.projectId}</Mono></Link>,
                    },
                    {
                      k: 'الجهة المستفيدة',
                      v: <Link className="tlink" to={ROUTES.entity(a.entityId)}>{a.entityName}</Link>,
                    },
                    { k: 'ممثل الجهة', v: a.signer.name },
                    { k: 'صفة الممثل', v: a.signer.title },
                    { k: 'المخصص المحجوز', v: <><Num>{a.reserved}</Num> <Riyal /></> },
                  ]}
                />
                <p className="sub cnote">
                  يسترجعها النظام من المشروع والجهة والميزانية · وتُعدَّل في
                  <b> المشروع الأصلي</b> لا هنا، وفق القاعدة 5 في الوثيقة.
                </p>
              </Glass>

              {/* Rules 13 and 16 - what blocks sending to the entity and activation. */}
              <Glass>
                <Head title="شروط التفعيل" meta={<span className="sub">قواعد 13 · 16 · 19</span>} />
                <ul className="payq-ck">
                  <li className={balance.balanced ? 'ok' : 'no'}>
                    <Icon name={balance.balanced ? icons.check : icons.alert} size="sm" />
                    <span>جدول الدفعات متوازن</span>
                    <span className="payq-r">قاعدة <Num>8</Num></span>
                  </li>
                  <li className={gap === 0 ? 'ok' : 'no'}>
                    <Icon name={gap === 0 ? icons.check : icons.alert} size="sm" />
                    <span>مطابقة للمخصص المحجوز</span>
                    <span className="payq-r">خطوة <Num>11</Num></span>
                  </li>
                  <li className={a.docs.length > 0 ? 'ok' : 'no'}>
                    <Icon name={a.docs.length > 0 ? icons.check : icons.alert} size="sm" />
                    <span>المرفقات والملاحق مكتملة</span>
                    <span className="payq-r">قاعدة <Num>9</Num></span>
                  </li>
                  {a.kind === 'ورقية' && (
                    <li className={a.stage === 'active' ? 'ok' : 'no'}>
                      <Icon name={a.stage === 'active' ? icons.check : icons.alert} size="sm" />
                      <span>النسخة الورقية الموقّعة مرفقة</span>
                      <span className="payq-r">قاعدة <Num>16</Num></span>
                    </li>
                  )}
                </ul>
                <p className="sub cnote">
                  تمنع القاعدة 19 التفعيل وتمكين طلبات الصرف قبل اكتمال جميع
                  الاعتمادات والتوقيعات واعتماد النسخة النهائية.
                </p>
              </Glass>
            </div>
          </div>
        </div>

        {actions.length > 0 && (
          <AgrActionDock
            user={user}
            agreement={a}
            actions={actions}
            note={note}
            onNote={setNote}
            taken={taken}
            onTake={setTaken}
          />
        )}
      </div>
    </AppLayout>
  )
}
