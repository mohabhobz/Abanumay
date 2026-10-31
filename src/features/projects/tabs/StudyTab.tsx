import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FormField, FieldBox, Button, DateText, FieldSelect, Glass, Head, KV, Mono, Money, MoneyField, Num, Person, Switch, Tag,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, pct, projectCode } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { critMax, criteriaFor, studyScore, type Criterion } from '@/data/intake/criteria'
import { fieldsOf, type StudyField, type StudySection } from '@/data/intake/studyFields'
import { maqasidResult, pctOf, suggestMaqasid, suggestWaqf, waqfResult } from '@/data/intake/alignment'
import { MaqasidCard, WaqfCard } from './StudyAlign'
import { stampNow } from '@/data/clock'
import { domainBudget } from '@/data/intake/insight'
import { consultantByKey, consultantsFor } from '@/data/intake/consultants'
import {
  adviceCode, flowOf, forwardBlockers, referConsultant, referralOpen, saveStudy, type Study } from '@/data/intake/flow'
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
import { TransferModal } from '@/features/projects/TransferModal'
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

/* Meeting 20 Oct · the three project types the study can set */
const CLASSES: { value: NonNullable<Study['classification']>; label: string; hint: string }[] = [
  { value: 'مشروع عادي', label: 'مشروع عادي', hint: 'يمر بالاعتماد والاتفاقية والخطة الاختيارية' },
  { value: 'مشروع لجهة خارجية', label: 'مشروع لجهة خارجية', hint: 'بلا خطة ولا اتفاقية · يُغلق مباشرة بعد سداد دفعاته' },
  { value: 'محفظة', label: 'مشروع محفظة', hint: 'تُفعَّل المحفظة بعد الاعتماد · خطتها إلزامية' },
]

/* Client 21 Oct (#21) · one notes field for the study · a study saved before carries technical and
   administrative notes · they read into the one field, each under its old heading */
const notesOf = (s?: Study): string => {
  if (!s) return ''
  if (s.notes !== undefined) return s.notes
  return [s.technical && `الدراسة الفنية: ${s.technical}`, s.admin && `الدراسة الإدارية: ${s.admin}`].filter(Boolean).join('\n')
}

/* Client 21 Oct (#19) · client 27 Oct · the study reads top to bottom: the recommendation first (the
   study's result, with the priority) · the project's definition · the exclusion criteria · the study
   criteria · the financial plan · the goal's budget · the foundation's outputs last. */
export function StudyTab({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  const f = flowOf(row.id)
  const blank: Omit<Study, 'at' | 'version' | 'field'> = {
    scores: {}, technical: '', admin: '', recommendation: '', amount: row.amountRequested, justification: '', by: me,
    exclusions: blankExclusions(), notes: '', fields: { days: row.durationDays ?? 0, reach: row.beneficiaries ?? 0 },
  }
  /* Client 30 Oct · a study without the two reference sections starts from the assistant's drafts */
  const [d, setD] = useState(() => {
    const base = f.study ? { ...f.study, by: me, exclusions: exclusionsOf(f.study.exclusions), notes: notesOf(f.study) } : blank
    return { ...base, fields: base.fields ?? blank.fields, maqasid: base.maqasid ?? suggestMaqasid(row), waqf: base.waqf ?? suggestWaqf(row) }
  })
  const [msg, setMsg] = useState('')

  const score = studyScore(d.scores)
  const blockers = forwardBlockers(row.id)
  const excluded = excludedBy(d.exclusions)
  const asked = d.recommendation === 'approve' ? d.amount : row.amountRequested

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((x) => ({ ...x, [k]: v })); setMsg('') }

  const save = () => {
    /* the one notes field is also written to `technical`, so readers of the old shape keep it ·
       the two reference sections are the supervisor's from now on, with his name and the day */
    const day = stampNow().slice(0, 10)
    saveStudy(row.id, { ...d, technical: d.notes ?? '', admin: '', by: me,
      maqasid: { ...d.maqasid, drafted: false, by: me, at: day }, waqf: { ...d.waqf, drafted: false, by: me, at: day } })
    setMsg(isolate(`حُفظت الدراسة · الدرجة ${studyScore(d.scores)} من 100`))
  }

  const fieldRow = (x: StudyField) => {
    const v = d.fields?.[x.key]
    const setF = (val: string | number | boolean) => set('fields', { ...(d.fields ?? {}), [x.key]: val })
    if (x.when && d.fields?.[x.when] !== true) return null
    if (x.kind === 'yesno') return (
      <li key={x.key}>
        <span className="stdy-l">{x.label}</span>
        <span className="pc-sp" />
        <YesNo label={x.label} value={typeof v === 'boolean' ? v : undefined} disabled={!editable} onChange={setF} />
      </li>
    )
    return (
      <li key={x.key} className="stdy-in">
        <span className="stdy-l">{x.label}</span>
        <span className="pc-sp" />
        {x.kind === 'money'
          ? <MoneyField value={Number(v) || 0} label={x.label} disabled={!editable} onChange={(n) => setF(Number(n) || 0)} />
          : x.kind === 'long'
            ? <FieldBox area><textarea rows={2} value={String(v ?? '')} disabled={!editable} aria-label={x.label} onChange={(e) => setF(e.target.value)} /></FieldBox>
            : <FieldBox><input className={x.kind === 'number' ? 'num' : undefined} inputMode={x.kind === 'number' ? 'numeric' : undefined} value={String(v ?? '')} disabled={!editable} aria-label={x.label}
                onChange={(e) => setF(x.kind === 'number' ? Number(e.target.value.replace(/\D/g, '')) || 0 : e.target.value)} /></FieldBox>}
      </li>
    )
  }
  const fieldList = (section: StudySection) => <ul className="stdy-list">{fieldsOf(section).map(fieldRow)}</ul>

  /* the points questions · four in the project section, the entity's experience in its own */
  const crit = criteriaFor(d.scores)
  const critRow = (c: Criterion) => (
    <li key={c.key} className="stdy-in">
      <span className="stdy-l">{c.label} <span className="sub">({c.points ? <><Num>{c.weight}</Num> {c.weight > 10 ? 'نقطة' : 'نقاط'}</> : <>الوزن {pct(c.weight)}</>})</span></span>
      <span className="pc-sp" />
      <FieldBox className="stdy-pts">
        <input className="num" inputMode="numeric" value={d.scores[c.key] ?? ''} disabled={!editable} aria-label={c.label} placeholder={`من ${critMax(c)}`}
          onChange={(e) => { const x = e.target.value.replace(/\D/g, ''); const next = { ...d.scores }; if (x === '') delete next[c.key]; else next[c.key] = Math.min(Number(x), critMax(c)); set('scores', next) }} />
      </FieldBox>
    </li>
  )
  const subtotal = (list: Criterion[]) => list.reduce((a, c) => a + Math.min(d.scores[c.key] ?? 0, critMax(c)), 0)
  const projCrit = crit.filter((c) => c.group !== 'إداري')
  const entCrit = crit.filter((c) => c.group === 'إداري')
  const mq = maqasidResult(d.maqasid)
  const wq = waqfResult(d.waqf)

  return (
    <>
      {f.returnNote && (
        <Glass>
          <Head title="أعاده مدير المنح" meta={<Tag tone="warn">للتحديث</Tag>} />
          <p className="sub cnote">{f.returnNote}</p>
        </Glass>
      )}

      {/* Client 30 Oct (Mozaffar) · the study is six sections · the old system's four (the project, the
          entity, the media coverage, the support decision), then the link to the shari'a objectives and
          to the endowment deed · the points questions sit in the first two, the score totals them */}
      <div className="stdy-sum">
        <span><span className="sub">درجة الدراسة</span><b><Num>{score}</Num> <span className="sub">من 100</span></b></span>
        <span><span className="sub">الارتباط بمقاصد الشريعة</span><Tag tone={mq.final >= 0.8 ? 'ok' : mq.final >= 0.6 ? 'teal' : 'warn'}>{pct(pctOf(mq.final))} · {mq.cls}</Tag></span>
        <span><span className="sub">الارتباط بصك الوقفية</span><Tag tone={wq.final >= 0.8 ? 'ok' : wq.final >= 0.6 ? 'teal' : 'warn'}>{pct(pctOf(wq.final))} · {wq.cls}</Tag></span>
        {!editable && <span className="sub">{f.study ? <>دراسة <Person name={f.study.by} /> · الإصدار <Num>{f.study.version}</Num> · <DateText>{f.study.at}</DateText></> : 'لم تُسجَّل دراسة بعد.'}</span>}
      </div>

      {/* 1 · the project */}
      <Glass>
        <Head title="بيانات المشروع" meta={<span className="rowf gp-2"><Mono>{projectCode(row.id, row.year)}</Mono><Tag tone="mute"><Num>{subtotal(projCrit)}</Num> من <Num>{projCrit.reduce((a, c) => a + critMax(c), 0)}</Num></Tag></span>} />
        <KV
          rows={[
            { k: 'المشروع', v: <b>{row.name}</b> },
            { k: 'السنة', v: <Num>{row.year.slice(0, 4)}</Num> },
            { k: 'المسار', v: row.track },
            { k: 'المجال', v: row.field },
            { k: 'الهدف', v: row.goal },
            { k: 'المنطقة', v: `${row.region}${row.city ? ` · ${row.city}` : ''}` },
            { k: 'المبلغ المطلوب', v: <Money>{row.amountRequested}</Money> },
          ]}
        />
        <OwnerRow row={row} />
        {fieldList('project')}
        <ul className="stdy-list">{projCrit.map(critRow)}</ul>
        {/* #20 · the exclusion criteria · any «نعم» excludes the project */}
        <h3 className="stdy-h">معايير الاستبعاد {excluded.length ? <Tag tone="no">منطبق <Num>{excluded.length}</Num> · يُقترح الرفض</Tag> : <Tag tone="ok">لا معيار منطبق</Tag>}</h3>
        <ul className="stdy-list stdy-ex">
          {(d.exclusions ?? []).map((x, i) => (
            <li key={x.key}>
              <span className="stdy-l">{x.label}</span>
              <span className="pc-sp" />
              <YesNo label={x.label} value={x.yes} disabled={!editable} onChange={(v) => set('exclusions', (d.exclusions ?? []).map((y, j) => (j === i ? { ...y, yes: v } : y)))} />
            </li>
          ))}
        </ul>
      </Glass>

      {/* 2 · the entity */}
      <Glass>
        <Head title="الجهة المنفذة" meta={entCrit.length ? <Tag tone="mute"><Num>{subtotal(entCrit)}</Num> من <Num>{entCrit.reduce((a, c) => a + critMax(c), 0)}</Num></Tag> : undefined} />
        <KV rows={[{ k: 'الجهة', v: <Link className="tlink" to={ROUTES.entity(row.entityId)}>{row.entityName}</Link> }]} />
        <ul className="stdy-list">{entCrit.map(critRow)}</ul>
        {fieldList('entity')}
      </Glass>

      {/* 3 · the media coverage */}
      <Glass>
        <Head title="التغطية الإعلامية" />
        {fieldList('media')}
      </Glass>

      {/* 4 · the support decision · the recommendation itself is taken from the decision bar */}
      <Glass>
        <Head title="قرار دعم المشروع" meta={<Tag tone={score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'mute'}>درجة الدراسة <Num>{score}</Num> من <Num>{100}</Num></Tag>} />
        <p className="stdy-rec">
          <span className="lb">رأي مشرف المنح</span>
          {f.study?.recommendation === 'approve' ? <Tag tone="ok">دعم المشروع</Tag>
            : f.study?.recommendation === 'reject' ? <Tag tone="no">عدم دعم المشروع</Tag>
            : <span className="sub">يُسجَّل من شريط القرار</span>}
        </p>
        <ul className="stdy-list">{fieldsOf('decision').filter((x) => x.key !== 'tags').map(fieldRow)}</ul>
        <div className="regfields mt-3">
          {d.recommendation !== 'reject' && (
            <FormField label="مبلغ الدعم">
              <MoneyField value={d.amount} label="مبلغ الدعم" disabled={!editable} onChange={(v) => set('amount', Math.min(row.amountRequested, Number(v) || 0))} />
            </FormField>
          )}
          {/* v3 · 3.2.19 · 3.4.25 · the reason from the settings list, or «أخرى» with its text */}
          {d.recommendation === 'reject' && (
            <FormField label="سبب التوصية بالرفض" required>
              <FieldSelect value={d.rejectReason ?? ''} label="سبب التوصية بالرفض" placeholder="اختر السبب" disabled={!editable}
                options={[...REJECT_REASONS, OTHER].map((x) => ({ value: x, label: x }))} onChange={(v) => set('rejectReason', v)} />
            </FormField>
          )}
          {d.recommendation === 'reject' && d.rejectReason === OTHER && (
            <FormField label="السبب" required>
              <FieldBox><input value={d.rejectOther ?? ''} disabled={!editable} aria-label="سبب آخر" onChange={(e) => set('rejectOther', e.target.value)} /></FieldBox>
            </FormField>
          )}
          <PriorityField row={row} me={me} editable={editable} />
          {/* v3 · 3.2.17 · meeting 20 Oct · the supervisor classifies the project during the study */}
          <FormField label="تصنيف المشروع">
            <FieldSelect value={d.classification ?? 'مشروع عادي'} label="تصنيف المشروع" disabled={!editable}
              options={CLASSES.map((x) => ({ value: x.value, label: x.label }))}
              onChange={(v) => set('classification', v as NonNullable<Study['classification']>)} />
            {d.classification === 'محفظة' && !isStrategic(row.entityId) && <span className="sub regf-h">الجهة ليست شريكًا استراتيجيًا بعد</span>}
          </FormField>
          <FormField label="ملخص فكرة المشروع ورأي مشرف المنح" required wide>
            <FieldBox area>
              <textarea rows={4} value={d.justification} disabled={!editable} onChange={(e) => set('justification', e.target.value)}
                aria-label="ملخص فكرة المشروع ورأي مشرف المنح" placeholder="فكرة المشروع ولماذا هذه التوصية · تظهر لمدير المنح كما هي" />
            </FieldBox>
          </FormField>
          <FormField label="الوسوم" wide>
            <FieldBox><input value={String(d.fields?.tags ?? '')} disabled={!editable} aria-label="الوسوم" placeholder="افصل بين الوسوم بفاصلة"
              onChange={(e) => set('fields', { ...(d.fields ?? {}), tags: e.target.value })} /></FieldBox>
          </FormField>
          {/* #21 · the study's notes in one place */}
          <FormField label="ملاحظات الدراسة" wide>
            <FieldBox area>
              <textarea rows={2} value={d.notes ?? ''} disabled={!editable} onChange={(e) => set('notes', e.target.value)} aria-label="ملاحظات الدراسة" />
            </FieldBox>
          </FormField>
          {/* #25 · the supervisor writes the special conditions in the study · every approver reads them */}
          <ConditionsField row={row} me={me} editable={editable} />
          {/* Meeting 20 Oct · the consultant is an option of the study, not a fixed block */}
          <div className="regf-w">
            <Switch label="يحتاج رأي مستشار" on={Boolean(d.needsConsultant || f.referral)} disabled={!editable || Boolean(f.referral)}
              lockNote={f.referral ? 'أُحيل المشروع إلى مستشار' : undefined} onChange={(v) => set('needsConsultant', v)} />
            {(d.needsConsultant || f.referral) && <ConsultantPick row={row} me={me} editable={editable} />}
          </div>
        </div>
        {/* #18 · the project's outputs · the foundation's copy, edited here */}
        <h3 className="stdy-h">مخرجات المشروع</h3>
        <OrgOutputsBlock row={row} />
      </Glass>

      {/* 5 · 6 · the two references · drafted by the assistant, reviewed by the supervisor */}
      <MaqasidCard row={row} value={d.maqasid} editable={editable} onChange={(m) => set('maqasid', m)} />
      <WaqfCard row={row} value={d.waqf} editable={editable} onChange={(w) => set('waqf', w)} />

      {editable && (
        <div className="regfoot stdy-save">
          <span className="decsent">{msg || (blockers.length ? `قبل الإحالة: ${blockers[0]}` : 'جاهزة للإحالة من شريط القرار')}</span>
          <span className="pc-sp" />
          <Button type="button" variant="p" onClick={save}>احفظ الدراسة</Button>
        </div>
      )}

      {/* 3.2.14 · 3.2.15 · the supervisor decides the project's financial term in the study */}
      <FundingPlanCard row={row} amount={asked} editable={editable} me={me} />
      <DomainBudgetCard row={row} asked={asked} />

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

/** A yes/no pair as two chips · the study's questions and its exclusion criteria */
function YesNo({ label, value, disabled, onChange }: { label: string; value?: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="stdy-yn" role="radiogroup" aria-label={label}>
      {[true, false].map((v) => (
        <Button plain key={String(v)} type="button" role="radio" aria-checked={value === v} className={`cfgchip${value === v ? ' on' : ''}`} disabled={disabled} onClick={() => onChange(v)}>
          {v ? 'نعم' : 'لا'}
        </Button>
      ))}
    </span>
  )
}

/** Client 27 Oct · the budget the request draws on · the project's money comes from its goal's line,
    so the card names the whole path (track · field · goal) and reads the goal's figures */
function DomainBudgetCard({ row, asked }: { row: ProjectRow; asked: number }) {
  useBudget()
  const budget = domainBudget(row)
  const money = budget?.goal?.money
  return (
    <Glass>
      <Head title="ميزانية الهدف" />
      <KV
        rows={[
          { k: 'المسار', v: row.track },
          { k: 'المجال', v: row.field },
          { k: 'الهدف', v: row.goal },
          ...(money ? [
            { k: 'المخصص', v: <Money>{money.allocated}</Money> },
            { k: 'المحجوز والمصروف', v: <Money>{money.held + money.paid}</Money> },
            { k: 'المتاح الآن', v: <b><Money>{money.available}</Money></b> },
            { k: 'بعد هذا الطلب', v: money.available - asked >= 0 ? <Money>{money.available - asked}</Money> : <Tag tone="warn">يتجاوز المتاح</Tag> },
          ] : []),
        ]}
      />
      {!money && <p className="sub cnote">لا بند للهدف «{row.goal}» في ميزانية السنة المعتمدة.</p>}
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
    <FormField label="الشروط الخاصة · اختياري" wide as="div">
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
          <FieldBox><input value={text} onChange={(e) => setText(e.target.value)} aria-label="شرط خاص" placeholder="مثال: تقديم خطاب التزام الشريك المنفذ" /></FieldBox>
          <FieldSelect value={when} label="يُستوفى قبل" onChange={(v) => setWhen(v as 'agreement' | 'firstPay')}
            options={[{ value: 'agreement', label: 'قبل توقيع الاتفاقية' }, { value: 'firstPay', label: 'قبل صرف الدفعة الأولى' }]} />
          <Button type="button" variant="2" className="cfgadd" disabled={!text.trim()} onClick={() => { addCondition(row.id, text.trim(), when, me); setText('') }}>أضف الشرط</Button>
        </div>
      )}
      {!editable && list.length === 0 && <span className="sub">لا شروط خاصة.</span>}
    </FormField>
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
            <Link className="tlink" to={ROUTES.advice(row.id)}>شاشة المستشار</Link> · رمز الوصول المرسل له <b className="num">{adviceCode(row.id, ref)}</b>
          </p>
        </>
      ) : editable ? (
        options.length ? (
          <>
            <div className="cfgrow">
              <FieldSelect value={pick} label="المستشار" options={options.map((c) => ({ value: c.key, label: `${c.name} · ${c.accessDays} أيام` }))} onChange={setPick} />
              <Button
                type="button"
                variant="2" className="cfgadd"
                disabled={!pick || !f.study?.recommendation}
                title={!f.study?.recommendation ? 'سجّل التوصية في الدراسة أولًا' : undefined}
                onClick={() => referConsultant(row.id, pick, me)}
              >
                أحِل إلى المستشار
              </Button>
            </div>
          </>
        ) : (
          <p className="sub cnote">لا مستشار مرتبط بمجال «{row.field}».</p>
        )
      ) : (
        <p className="sub cnote">لم يُطلب رأي مستشار.</p>
      )}
    </div>
  )
}

/** Batch 8 · the request's priority · set by hand or computed, by the foundation's decision ·
    client 27 Oct · a field of the recommendation, not a card of its own */
function PriorityField({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  usePriority()
  const pr = priorityOf(row.id)
  const [level, setLevel] = useState<Priority>(pr.level ?? 'medium')
  const [why, setWhy] = useState('')
  const [bad, setBad] = useState('')
  const log = priorityLog(row.id)
  return (
    <FormField label="الأولوية" wide as="div" after={<span className="stdy-pr">{pr.level ? <Tag tone={PRIORITY_TONE[pr.level]}>{pr.say}</Tag> : <span className="sub">{pr.say}</span>}</span>}>
      {pr.level && <span className="sub regf-h">{pr.basis}</span>}
      {pr.mode === 'manual' && editable && (
        <div className="apv-row">
          <FieldSelect label="الأولوية" value={level} options={(Object.keys(PRIORITY_SAY) as Priority[]).map((k) => ({ value: k, label: PRIORITY_SAY[k] }))} onChange={(v) => setLevel(v as Priority)} />
          <FieldBox><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="سبب الأولوية" placeholder="السبب" /></FieldBox>
          <Button type="button" variant="2" size="sm" onClick={() => { const out = setPriority(row.id, level, why, me); setBad(out[0] ?? ''); if (!out.length) setWhy('') }}>حدّد الأولوية</Button>
        </div>
      )}
      {bad && <span className="bad regf-h" role="alert">{bad}</span>}
      {log.length > 1 && <span className="sub regf-h">تغيّرت <Num>{log.length}</Num> مرات · السابقة {PRIORITY_SAY[log.at(-2)!.level]}</span>}
    </FormField>
  )
}

/* v3 · 3.2.13 · 3.4.44 · 3.4.45 · the foundation's outputs · a copy of the entity's made when the
   study starts · the supervisor studying it and the grants manager holding it edit, add and remove ·
   every change is logged · the entity's stay as sent, readable beside them */
function OrgOutputsBlock({ row }: { row: ProjectRow }) {
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
    <div className="stdy-outs">
      {f.orgOutputs && <Tag tone="teal">مخرجات المؤسسة</Tag>}
      {edit ? (
        <>
          <OutputsEditor list={d} onChange={setD} />
          <div className="apv-row mt-3">
            <Button type="button" variant="p" size="sm" onClick={() => { const out = saveOrgOutputs(row.id, d, user.name, role.key); setBad(out); if (!out.length) setEdit(false) }}>احفظ المخرجات</Button>
            <Button type="button" variant="2" size="sm" onClick={() => { setD(base()); setEdit(false); setBad([]) }}>تراجع</Button>
          </div>
          {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
        </>
      ) : (
        <>
          {org.length ? <ul className="outs-ro">{org.map((o, i) => <li key={i}>{outputLine(o)}</li>)}</ul> : <p className="sub cnote">لا مخرجات بعد.</p>}
          {can && <Button type="button" variant="2" size="sm" className="mt-2" onClick={() => { setD(base()); setEdit(true) }}>عدّل المخرجات</Button>}
        </>
      )}
      {mine.length > 0 && (
        <details className="mt-2">
          <summary className="lnk">مخرجات الجهة كما قدّمتها</summary>
          <ul className="outs-ro mt-1">{mine.map((o, i) => <li key={i} className="sub">{outputLine(o)}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

/* Meeting 20 Oct · the project's owner is part of the study, not of the entity's data · the
   supervisor who studies it owns it.
   Client sheet 24 Oct (#90) · one path to change the supervisor, the same rule everywhere: a supervisor
   of the same domain, a mandatory reason, logged before → after («تعديل مشرف المنح») · the card opens the
   project's transfer dialog in its supervisor mode (`reownProject` decides who may) instead of a second,
   looser assignment of its own. */
function OwnerRow({ row }: { row: ProjectRow }) {
  useFlow()
  const { role, user } = useRole()
  const [open, setOpen] = useState(false)
  const sups = CYCLE.domains[row.field]?.supervisors ?? []
  const studying = row.stage === 'دراسة المشروع' && (row.holder ?? 'supervisor') === 'supervisor'
  const can = !row.archived && sups.length > 0 && (role.key === 'grants-manager' || (role.key === 'supervisor' && studying && (row.owner === user.name || Boolean(user.behalf))))
  return (
    <div className="stdy-own mt-3">
      <div className="rowf gp-2">
        <span className="lb">مالك المشروع</span>
        {row.owner ? <Person name={row.owner} /> : <Tag tone="warn">غير مُسنَد</Tag>}
        {can && (
          <Button type="button" variant="2" size="sm" onClick={() => setOpen(true)}>
            {row.owner ? 'عدّل المشرف' : 'أسند إلى مشرف'}
          </Button>
        )}
      </div>
      {open && <TransferModal row={row} me={user.name} mode="owner" onClose={() => setOpen(false)} />}
    </div>
  )
}
