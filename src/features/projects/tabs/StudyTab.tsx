import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DateText, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Money, MoneyField, Num, Person, Switch, Tag,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { NOUN, isolate, nounAfter, pct, projectCode } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { CRITERIA, GROUP_SAY, studyScore, type Criterion } from '@/data/intake/criteria'
import { domainBudget, fitOf, similarProjects } from '@/data/intake/insight'
import { consultantByKey, consultantsFor } from '@/data/intake/consultants'
import {
  adviceCode, flowOf, forwardBlockers, referConsultant, referralOpen, saveStudy, type Recommendation, type Study } from '@/data/intake/flow'
import { FundingPlanCard } from '@/features/budget/FundingPlan'
import { fixtures } from '@/data/repository'
import { PRIORITY_SAY, PRIORITY_TONE, priorityLog, priorityOf, setPriority, usePriority, type Priority } from '@/data/intake/priority'
import { OTHER, REJECT_REASONS } from '@/data/intake/reasons'
import { isStrategic } from '@/data/partners/store'
import { OutputsEditor } from '../OutputsEditor'
import { orgOutputsOf, outputLine, saveOrgOutputs, useFlow, type Output } from '@/data/intake/flow'
import { useRole } from '@/hooks/useRole'
import { holderOf } from '@/data/holders'
import { CYCLE } from '@/data/intake/cycle'
import { assignSupervisor } from '@/data/intake/flow'
import { blankExclusions, excludedBy, exclusionsOf } from '@/data/intake/exclusion'
import { addCondition, appFlowOf, useApprovals } from '@/data/approvals/store'
import { useBudget } from '@/data/budget/store'

/* «الدراسة» · the supervisor's study of a project (3.2.11–3.2.16, 3.2.19, 3.4.25).

   The form is the study itself, not a note about it: each criterion from settings scored 1–5 with
   its weight, the technical and administrative findings, the recommendation and its reasons. Beside
   it, what the study is measured against — the domain's budget, the fit signals and similar
   projects — and the consultant, when one is asked.

   Editing belongs to the supervisor while the project sits at his seat; everyone else reads the
   same study. Saving records it on the timeline; forwarding it is the decision bar's job, so the
   study can be saved and revised before it goes anywhere. */

const SCALE = [1, 2, 3, 4, 5] as const
/* Meeting 20 Oct · the three project types the study can set */
const CLASSES: { value: NonNullable<Study['classification']>; label: string; hint: string }[] = [
  { value: 'مشروع عادي', label: 'مشروع عادي', hint: 'يمر بالاعتماد والاتفاقية والخطة الاختيارية' },
  { value: 'مشروع لجهة خارجية', label: 'مشروع لجهة خارجية', hint: 'بلا خطة ولا اتفاقية · يُغلق مباشرة بعد سداد دفعاته' },
  { value: 'محفظة', label: 'مشروع محفظة', hint: 'تُفعَّل المحفظة بعد الاعتماد · خطتها إلزامية' },
]
const GROUPS: Criterion['group'][] = ['فني', 'مالي', 'إداري']

/* Client 21 Oct (#21) · one notes field for the study · a study saved before carries technical and
   administrative notes · they read into the one field, each under its old heading */
const notesOf = (s?: Study): string => {
  if (!s) return ''
  if (s.notes !== undefined) return s.notes
  return [s.technical && `الدراسة الفنية: ${s.technical}`, s.admin && `الدراسة الإدارية: ${s.admin}`].filter(Boolean).join('\n')
}

/* Client 21 Oct (#19) · the study reads top to bottom in the order the supervisor works it:
   the project's definition · the exclusion criteria · the study criteria · the financial plan ·
   the domain's budget and the priority · the assistant's reading · the recommendation · the
   foundation's outputs last. Everything that used to sit in a side block is in this one column. */
export function StudyTab({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  const f = flowOf(row.id)
  const blank: Omit<Study, 'at' | 'version' | 'field'> = {
    scores: {}, technical: '', admin: '', recommendation: '', amount: row.amountRequested, justification: '', by: me,
    exclusions: blankExclusions(), notes: '',
  }
  const [d, setD] = useState(() => (f.study ? { ...f.study, by: me, exclusions: exclusionsOf(f.study.exclusions), notes: notesOf(f.study) } : blank))
  const [msg, setMsg] = useState('')

  const score = studyScore(d.scores)
  const blockers = forwardBlockers(row.id)
  const excluded = excludedBy(d.exclusions)
  const asked = d.recommendation === 'approve' ? d.amount : row.amountRequested

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((x) => ({ ...x, [k]: v })); setMsg('') }

  const save = () => {
    /* the one notes field is also written to `technical`, so readers of the old shape keep it */
    saveStudy(row.id, { ...d, technical: d.notes ?? '', admin: '', by: me })
    setMsg(isolate(`حُفظت الدراسة · الدرجة ${studyScore(d.scores)} من 100`))
  }

  return (
    <>
      <DefinitionCard row={row} />
      {f.returnNote && (
        <Glass>
          <Head title="أعاده مدير المنح" meta={<Tag tone="warn">للتحديث</Tag>} />
          <p className="sub cnote">{f.returnNote}</p>
          <p className="sub cnote">{f.returnStudied
            ? 'حُدّثت الدراسة وسُجّل إصدارها الجديد · أعد الإرسال لمدير المنح من شريط القرار.'
            : 'حدّث الدراسة واحفظها، ثم أعد الإحالة من شريط القرار · يُسجَّل إصدار جديد ويبقى السابق في السجل.'}</p>
        </Glass>
      )}

      {/* #20 · answered before the scores · any «نعم» excludes the project */}
      <Glass>
        <Head
          title="معايير الاستبعاد"
          meta={excluded.length ? <Tag tone="no">منطبق <Num>{excluded.length}</Num> · يُقترح الرفض</Tag> : <Tag tone="ok">لا معيار منطبق</Tag>}
        />
        <ul className="stdy-list stdy-ex">
          {(d.exclusions ?? []).map((x, i) => (
            <li key={x.key}>
              <span className="stdy-l">{x.label}</span>
              <span className="pc-sp" />
              <span className="stdy-yn" role="radiogroup" aria-label={x.label}>
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={x.yes === v}
                    className={`cfgchip${x.yes === v ? ' on' : ''}`}
                    disabled={!editable}
                    onClick={() => set('exclusions', (d.exclusions ?? []).map((y, j) => (j === i ? { ...y, yes: v } : y)))}
                  >
                    {v ? 'نعم' : 'لا'}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="sub cnote">
          {excluded.length
            ? 'المشروع مستبعد بمعيار منطبق · لا توصية بالموافقة، والتوصية المقترحة الرفض مع ذكر السبب.'
            : isolate('أسئلة نعم أو لا من «معايير الاستبعاد» في الإعدادات · تُحفظ مع الدراسة كما هي.')}
        </p>
      </Glass>

      <Glass>
        <Head
          title="معايير الدراسة"
          meta={<Tag tone={score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'mute'}><Num>{score}</Num> من <Num>{100}</Num></Tag>}
        />
        <p className="sub cnote">
          {editable
            ? isolate('قيّم كل معيار من 1 إلى 5 · الأوزان من «معايير التقييم» في الإعدادات.')
            : f.study ? <>دراسة <Person name={f.study.by} /> · الإصدار <Num>{f.study.version}</Num> · <DateText>{f.study.at}</DateText></> : 'لم تُسجَّل دراسة بعد.'}
        </p>
        {GROUPS.map((g) => (
          <div key={g} className="stdy-g">
            <h3 className="stdy-h">الدراسة {GROUP_SAY[g].study}</h3>
            <ul className="stdy-list">
              {CRITERIA.list.filter((c) => c.group === g).map((c) => (
                <li key={c.key}>
                  <span className="stdy-l">{c.label}</span>
                  <span className="sub">{pct(c.weight)}</span>
                  <span className="pc-sp" />
                  <span className="stdy-scale" role="radiogroup" aria-label={c.label}>
                    {SCALE.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={d.scores[c.key] === n}
                        className={`cfgchip${d.scores[c.key] === n ? ' on' : ''}`}
                        disabled={!editable}
                        onClick={() => set('scores', { ...d.scores, [c.key]: n })}
                      >
                        <span className="num">{n}</span>
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {/* #21 · the study's notes in one place */}
        <label className="regf regf-w">
          <span className="lb">ملاحظات الدراسة</span>
          <span className="fld fld-a">
            <textarea
              rows={3}
              value={d.notes ?? ''}
              disabled={!editable}
              onChange={(e) => set('notes', e.target.value)}
              aria-label="ملاحظات الدراسة"
              placeholder="الملاحظات الفنية والمالية والإدارية · في مكان واحد"
            />
          </span>
        </label>
      </Glass>

      {/* 3.2.14 · 3.2.15 · the supervisor decides the project's financial term in the study */}
      <FundingPlanCard row={row} amount={asked} editable={editable} me={me} />

      <div className="g2-in">
        <DomainBudgetCard row={row} asked={asked} />
        <PriorityCard row={row} me={me} editable={editable} />
      </div>

      <AssistReadingCard row={row} />

      <Glass>
        <Head title="التوصية" meta={<Tag tone="mute">استشارية · لا اعتماد ولا صرف</Tag>} />
        {/* #22 · the budget beside the recommendation · no scrolling back up to the domain's card */}
        <BudgetStrip row={row} asked={asked} />
        <div className="cfgchips mt-3" role="radiogroup" aria-label="التوصية">
          {(['approve', 'reject'] as Recommendation[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={d.recommendation === r}
              className={`cfgchip${d.recommendation === r ? ' on' : ''}`}
              disabled={!editable || (r === 'approve' && excluded.length > 0 && d.recommendation !== 'approve')}
              title={r === 'approve' && excluded.length ? 'معيار استبعاد منطبق' : undefined}
              onClick={() => set('recommendation', r)}
            >
              {r === 'approve' ? 'توصية بالموافقة' : 'توصية بالرفض'}
            </button>
          ))}
        </div>
        <div className="regfields mt-3">
          {d.recommendation === 'approve' && (
            <label className="regf">
              <span className="lb">المبلغ الموصى به</span>
              <MoneyField
                value={d.amount}
                label="المبلغ الموصى به"
                disabled={!editable}
                onChange={(v) => set('amount', Math.min(row.amountRequested, Number(v) || 0))}
              />
              <span className="sub regf-h">حتى المبلغ المطلوب <Money>{row.amountRequested}</Money></span>
            </label>
          )}
          {/* v3 · 3.2.19 · 3.4.25 · the reason from the settings list, or «أخرى» with its text */}
          {d.recommendation === 'reject' && (
            <label className="regf">
              <span className="lb">سبب التوصية بالرفض<b className="regf-r" aria-label="إلزامي">*</b></span>
              <FieldSelect value={d.rejectReason ?? ''} label="سبب التوصية بالرفض" placeholder="اختر السبب" disabled={!editable}
                options={[...REJECT_REASONS, OTHER].map((x) => ({ value: x, label: x }))} onChange={(v) => set('rejectReason', v)} />
            </label>
          )}
          {d.recommendation === 'reject' && d.rejectReason === OTHER && (
            <label className="regf">
              <span className="lb">السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld"><input value={d.rejectOther ?? ''} disabled={!editable} aria-label="سبب آخر" onChange={(e) => set('rejectOther', e.target.value)} /></span>
            </label>
          )}
          {/* v3 · 3.2.17 · meeting 20 Oct · the supervisor classifies the project during the study ·
              regular, for an external party, or a portfolio (a portfolio takes its path after approval) */}
          <label className="regf">
            <span className="lb">تصنيف المشروع</span>
            <FieldSelect value={d.classification ?? 'مشروع عادي'} label="تصنيف المشروع" disabled={!editable}
              options={CLASSES.map((x) => ({ value: x.value, label: x.label }))}
              onChange={(v) => set('classification', v as NonNullable<Study['classification']>)} />
            <span className="sub regf-h">{CLASSES.find((x) => x.value === (d.classification ?? 'مشروع عادي'))?.hint}{d.classification === 'محفظة' && !isStrategic(row.entityId) ? ' · الجهة ليست شريكًا استراتيجيًا بعد' : ''}</span>
          </label>
          <label className="regf regf-w">
            <span className="lb">المبررات<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld fld-a">
              <textarea
                rows={3}
                value={d.justification}
                disabled={!editable}
                onChange={(e) => set('justification', e.target.value)}
                aria-label="مبررات التوصية"
                placeholder="لماذا هذه التوصية · تظهر لمدير المنح كما هي"
              />
            </span>
          </label>
          {/* #25 · the supervisor writes the special conditions in the study · every approver reads them */}
          <ConditionsField row={row} me={me} editable={editable} />
          {/* Meeting 20 Oct · the consultant is an option of the study, not a fixed block */}
          <div className="regf-w">
            <Switch
              label="يحتاج رأي مستشار"
              note="اختياري · يُختار المستشار من قائمة مستشاري المجال"
              on={Boolean(d.needsConsultant || f.referral)}
              disabled={!editable || Boolean(f.referral)}
              lockNote={f.referral ? 'أُحيل المشروع إلى مستشار' : undefined}
              onChange={(v) => set('needsConsultant', v)}
            />
            {(d.needsConsultant || f.referral) && <ConsultantPick row={row} me={me} editable={editable} />}
          </div>
        </div>
        {editable && (
          <div className="regfoot">
            <span className="decsent">{msg || (blockers.length ? `قبل الإحالة: ${blockers[0]}` : 'جاهزة للإحالة من شريط القرار')}</span>
            <span className="pc-sp" />
            <button type="button" className="btn btn-p" onClick={save}>احفظ الدراسة</button>
          </div>
        )}
      </Glass>

      {/* #18 · the foundation's outputs close the study · edited here only */}
      <OrgOutputsCard row={row} />

      {f.pastStudies.length > 0 && (
        <Glass>
          <Head title="دراسات سابقة" meta={<span className="sub"><Num>{f.pastStudies.length}</Num> قبل التحويل</span>} />
          <ul className="cfglist">
            {f.pastStudies.map((s, i) => (
              <li key={i}>
                <Person name={s.by} />
                <span className="sub">{s.field} · <DateText>{s.at}</DateText></span>
                <span className="pc-sp" />
                <Tag tone="mute"><Num>{studyScore(s.scores)}</Num> من <Num>{100}</Num></Tag>
                <Tag tone="mute">{s.recommendation === 'approve' ? 'موافقة' : s.recommendation === 'reject' ? 'رفض' : 'بلا توصية'}</Tag>
              </li>
            ))}
          </ul>
        </Glass>
      )}
    </>
  )
}

/** #19 · the study opens on what is being studied · the identity, the ask and its owner */
function DefinitionCard({ row }: { row: ProjectRow }) {
  return (
    <Glass>
      <Head title="تعريف المشروع" meta={<Mono>{projectCode(row.id, row.year)}</Mono>} />
      <KV
        rows={[
          { k: 'المشروع', v: <b>{row.name}</b> },
          { k: 'الجهة', v: <Link className="tlink" to={ROUTES.entity(row.entityId)}>{row.entityName}</Link> },
          { k: 'المسار · المجال · الهدف', v: `${row.track} · ${row.field} · ${row.goal}` },
          { k: 'المنطقة', v: `${row.region}${row.city ? ` · ${row.city}` : ''}` },
          { k: 'المبلغ المطلوب', v: <Money>{row.amountRequested}</Money> },
          { k: 'المدة · المستفيدون', v: <><Num>{row.durationDays}</Num> {nounAfter(row.durationDays, NOUN.day)} · <Num>{row.beneficiaries}</Num> {nounAfter(row.beneficiaries, NOUN.beneficiary)}</> },
        ]}
      />
      <OwnerRow row={row} />
    </Glass>
  )
}

/** #22 · the four budget figures as one compact row · shown beside the recommendation */
function BudgetStrip({ row, asked }: { row: ProjectRow; asked: number }) {
  useBudget()
  const budget = domainBudget(row)
  if (!budget) return <p className="sub cnote">لا بند لمجال «{row.field}» في ميزانية السنة المعتمدة.</p>
  const after = budget.money.available - asked
  return (
    <dl className="stdy-bud" aria-label="ميزانية المجال">
      <div><dt>المخصص</dt><dd><Money>{budget.money.allocated}</Money></dd></div>
      <div><dt>المعتمد</dt><dd><Money>{budget.money.held + budget.money.paid}</Money></dd></div>
      <div><dt>المتاح الآن</dt><dd><Money>{budget.money.available}</Money></dd></div>
      <div className={after < 0 ? 'bad' : undefined}><dt>بعد هذه التوصية</dt><dd>{after >= 0 ? <Money>{after}</Money> : <Tag tone="warn">يتجاوز المتاح</Tag>}</dd></div>
    </dl>
  )
}

/** The domain's budget · the line the request draws on */
function DomainBudgetCard({ row, asked }: { row: ProjectRow; asked: number }) {
  useBudget()
  const budget = domainBudget(row)
  return (
    <Glass>
      <Head title="ميزانية المجال" meta={<span className="sub">{budget?.label ?? row.field}</span>} />
      {budget ? (
        <>
          <KV
            rows={[
              { k: 'المخصص', v: <Money>{budget.money.allocated}</Money> },
              { k: 'المحجوز والمصروف', v: <Money>{budget.money.held + budget.money.paid}</Money> },
              { k: 'المتاح الآن', v: <b><Money>{budget.money.available}</Money></b> },
              { k: 'بعد هذا الطلب', v: budget.money.available - asked >= 0 ? <Money>{budget.money.available - asked}</Money> : <Tag tone="warn">يتجاوز المتاح</Tag> },
            ]}
          />
          {budget.goal && <p className="sub cnote">بند الهدف «{budget.goal.label}» متاح فيه <Money>{budget.goal.money.available}</Money></p>}
        </>
      ) : (
        <p className="sub cnote">لا بند لهذا المجال في ميزانية السنة المعتمدة.</p>
      )}
    </Glass>
  )
}

/** The assistant's reading · the fit signals and similar projects · a support, not a decision */
function AssistReadingCard({ row }: { row: ProjectRow }) {
  const fit = fitOf(row)
  const similar = similarProjects(row)
  return (
    <Glass>
      <Head title="قراءة المساعد" meta={<Tag tone={fit.score >= 70 ? 'ok' : 'warn'}>التوافق {pct(fit.score)}</Tag>} />
      <div className="stdy-read">
        <ul className="payq-ck">
          {fit.signals.map((s) => (
            <li key={s.text} className={s.tone === 'ok' ? 'ok' : 'no'}>
              <Icon name={s.tone === 'ok' ? icons.check : icons.alert} size="sm" />
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
        <div>
          <h3 className="stdy-h">مشاريع مشابهة</h3>
          <ul className="stdy-sim">
            {similar.map((p) => (
              <li key={p.id}>
                <Link className="tlink trim1" to={ROUTES.project(p.id)}>{p.name}</Link>
                <span className="sub">{p.entityName} · <Money>{p.amountGranted || p.amountRequested}</Money> · {p.statusGroup}</span>
              </li>
            ))}
            {similar.length === 0 && <li className="sub">لا مشاريع في الهدف نفسه بعد.</li>}
          </ul>
        </div>
      </div>
      <p className="sub cnote">قراءة مساندة · لا تقرّر ولا تُلزم.</p>
    </Glass>
  )
}

/** #25 · the special conditions on the decision · written in the study, read in the approval tab */
function ConditionsField({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  useApprovals()
  const list = appFlowOf(row.id).conditions
  const [text, setText] = useState('')
  const [when, setWhen] = useState<'agreement' | 'firstPay'>('agreement')
  return (
    <div className="regf regf-w">
      <span className="lb">الشروط الخاصة · اختياري</span>
      {list.length > 0 && (
        <ul className="stdy-cond">
          {list.map((c) => (
            <li key={c.id}>
              <b>{c.text}</b>
              <span className="sub">قبل {c.when === 'agreement' ? 'توقيع الاتفاقية' : 'صرف الدفعة الأولى'} · <Person name={c.by} /></span>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="cfgrow">
          <span className="fld"><input value={text} onChange={(e) => setText(e.target.value)} aria-label="شرط خاص" placeholder="مثال: تقديم خطاب التزام الشريك المنفذ" /></span>
          <FieldSelect value={when} label="يُستوفى قبل" onChange={(v) => setWhen(v as 'agreement' | 'firstPay')}
            options={[{ value: 'agreement', label: 'قبل توقيع الاتفاقية' }, { value: 'firstPay', label: 'قبل صرف الدفعة الأولى' }]} />
          <button type="button" className="btn btn-2 cfgadd" disabled={!text.trim()} onClick={() => { addCondition(row.id, text.trim(), when, me); setText('') }}>أضف الشرط</button>
        </div>
      )}
      {!editable && list.length === 0 && <span className="sub">لا شروط خاصة.</span>}
      <span className="sub regf-h">تظهر لكل من يعتمد المشروع في تبويب الاعتماد · ويُتحقق من استيفائها قبل موعدها.</span>
    </div>
  )
}

/** The consultant under the study's option · the referral status once sent, the pick before it */
function ConsultantPick({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  useFlow()
  const f = flowOf(row.id)
  const options = consultantsFor(row.field)
  const ref = f.referral
  const refC = ref ? consultantByKey(ref.consultant) : undefined
  const [pick, setPick] = useState(options[0]?.key ?? '')
  return (
    <div className="mt-2">
      {ref && <p className="sub cnote">
        رأي المستشار {(ref.opinion ? <Tag tone="ok">{ref.verdict}</Tag> : referralOpen(ref) ? <Tag tone="warn">بانتظار الرأي</Tag> : <Tag tone="mute">انتهت المدة</Tag>)}
      </p>}
      {ref ? (
        <>
          <p className="sub cnote">
            <Person name={refC?.name ?? ref.consultant} /> · وصول حتى <DateText>{ref.expiresAt}</DateText>
          </p>
          {ref.opinion && <p className="cnote">{ref.opinion}</p>}
          <p className="sub cnote">
            <Link className="tlink" to={ROUTES.advice(row.id)}>شاشة المستشار</Link> · رمز الوصول المرسل له <b className="num">{adviceCode(row.id, ref)}</b> · الرأي استشاري غير ملزم.
          </p>
        </>
      ) : editable ? (
        options.length ? (
          <>
            <p className="sub cnote">تُحال إليه بعد تسجيل التوصية، ويرى المشروع وحده خلال مدة وصوله.</p>
            <div className="cfgrow">
              <FieldSelect value={pick} label="المستشار" options={options.map((c) => ({ value: c.key, label: `${c.name} · ${c.accessDays} أيام` }))} onChange={setPick} />
              <button
                type="button"
                className="btn btn-2 cfgadd"
                disabled={!pick || !f.study?.recommendation}
                title={!f.study?.recommendation ? 'سجّل التوصية في الدراسة أولًا' : undefined}
                onClick={() => referConsultant(row.id, pick, me)}
              >
                أحِل إلى المستشار
              </button>
            </div>
          </>
        ) : (
          <p className="sub cnote">لا مستشار مرتبط بمجال «{row.field}» · يُضاف من إعدادات المستشارين.</p>
        )
      ) : (
        <p className="sub cnote">لم يُطلب رأي مستشار.</p>
      )}
    </div>
  )
}

/** Batch 8 · the request's priority · set by hand or computed, by the foundation's decision */
function PriorityCard({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  usePriority()
  const pr = priorityOf(row.id)
  const [level, setLevel] = useState<Priority>(pr.level ?? 'medium')
  const [why, setWhy] = useState('')
  const [bad, setBad] = useState('')
  const log = priorityLog(row.id)
  return (
    <Glass>
      <Head title="الأولوية" meta={pr.level ? <Tag tone={PRIORITY_TONE[pr.level]}>{pr.say}</Tag> : <span className="sub">{pr.say}</span>} />
      <p className="sub cnote">{pr.basis} · {pr.mode === 'manual' ? 'تُحدَّد يدويًا' : 'محسوبة من الدراسة'} حسب <Link className="lnk" to={ROUTES.decisions}>قرار المؤسسة</Link></p>
      {pr.mode === 'manual' && editable && (
        <div className="apv-row mt-2">
          <FieldSelect label="الأولوية" value={level} options={(Object.keys(PRIORITY_SAY) as Priority[]).map((k) => ({ value: k, label: PRIORITY_SAY[k] }))} onChange={(v) => setLevel(v as Priority)} />
          <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="سبب الأولوية" placeholder="السبب" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = setPriority(row.id, level, why, me); setBad(out[0] ?? ''); if (!out.length) setWhy('') }}>حدّد الأولوية</button>
          {bad && <span className="bad" role="alert">{bad}</span>}
        </div>
      )}
      {log.length > 1 && <p className="sub cnote">تغيّرت <Num>{log.length}</Num> مرات · السابقة {PRIORITY_SAY[log.at(-2)!.level]}</p>}
    </Glass>
  )
}

/* v3 · 3.2.13 · 3.4.44 · 3.4.45 · the foundation's outputs · a copy of the entity's made when the
   study starts · the supervisor studying it and the grants manager holding it edit, add and remove ·
   every change is logged · the entity's stay as sent, readable beside them */
function OrgOutputsCard({ row }: { row: ProjectRow }) {
  useFlow()
  const { role, user } = useRole()
  const f = flowOf(row.id)
  const holder = holderOf(row)
  const can = (role.key === 'supervisor' && holder === 'supervisor' && (row.owner === user.name || Boolean(user.behalf))) || (role.key === 'grants-manager' && holder === 'manager')
  const [edit, setEdit] = useState(false)
  /* #18 · before the study copies them, the outputs are the project data's · the entity's request,
     else the outputs the data tab reads for a seeded project */
  const base = (): Output[] => {
    const own = orgOutputsOf(row.id)
    return own.length ? own : fixtures.project.outputs.map((text) => ({ text, indicator: '', target: '' }))
  }
  const [d, setD] = useState<Output[]>(base)
  const [bad, setBad] = useState<string[]>([])
  const org = base()
  const mine = f.entityOutputs ?? []
  return (
    <Glass>
      <Head title="المخرجات" meta={f.orgOutputs ? <Tag tone="teal">مخرجات المؤسسة · المرجع المعتمد</Tag> : <Tag tone="mute">تُنسخ من بيانات المشروع عند بدء الدراسة</Tag>} />
      {edit ? (
        <>
          <OutputsEditor list={d} onChange={setD} />
          <div className="apv-row mt-3">
            <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = saveOrgOutputs(row.id, d, user.name, role.key); setBad(out); if (!out.length) setEdit(false) }}>احفظ المخرجات</button>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => { setD(base()); setEdit(false); setBad([]) }}>تراجع</button>
          </div>
          {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
        </>
      ) : (
        <>
          {org.length ? <ul className="outs-ro">{org.map((o, i) => <li key={i}>{outputLine(o)}</li>)}</ul> : <p className="sub cnote">لا مخرجات بعد.</p>}
          {can && <button type="button" className="btn btn-2 btn-sm mt-2" onClick={() => { setD(base()); setEdit(true) }}>عدّل المخرجات</button>}
        </>
      )}
      {mine.length > 0 && (
        <details className="mt-2">
          <summary className="lnk">مخرجات الجهة كما قدّمتها · للقراءة فقط</summary>
          <ul className="outs-ro mt-1">{mine.map((o, i) => <li key={i} className="sub">{outputLine(o)}</li>)}</ul>
        </details>
      )}
      <p className="sub cnote">مخرجات المؤسسة تُعدَّل هنا فقط، وهي المرجع في الاعتماد والاتفاقية والمتابعة والتقييم · ومخرجات الجهة تبقى كما قدّمتها · ويُسجَّل كل تعديل في السجل.</p>
    </Glass>
  )
}

/* Meeting 20 Oct · the project's owner is part of the study, not of the entity's data · the
   supervisor who studies it owns it · the grants manager can hand it to another supervisor of the
   same domain */
function OwnerRow({ row }: { row: ProjectRow }) {
  useFlow()
  const { role, user } = useRole()
  const sups = CYCLE.domains[row.field]?.supervisors ?? []
  const [pick, setPick] = useState('')
  const can = role.key === 'grants-manager' && !row.archived
  return (
    <div className="stdy-own mt-3">
      <div className="rowf gp-2">
        <span className="lb">مالك المشروع</span>
        {row.owner ? <Person name={row.owner} /> : <Tag tone="warn">غير مُسنَد</Tag>}
        <span className="sub">مشرف المنح المسؤول · يدرس المشروع ويتابعه حتى إغلاقه</span>
      </div>
      {can && sups.length > 0 && (
        <div className="apv-row mt-2">
          <FieldSelect value={pick} label="مشرف المجال" placeholder="أسند إلى مشرف"
            options={sups.filter((x) => x !== row.owner).map((x) => ({ value: x, label: x }))} onChange={setPick} />
          <button type="button" className="btn btn-2 btn-sm" disabled={!pick} onClick={() => { assignSupervisor(row.id, pick, user.name); setPick('') }}>أسند</button>
        </div>
      )}
    </div>
  )
}
