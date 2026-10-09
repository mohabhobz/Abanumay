import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DateText, FieldSelect, Glass, Head, Icon, icons, KV, Money, MoneyField, Num, Person, Tag,
} from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { isolate, pct } from '@/lib/format'
import type { ProjectRow } from '@/types/domain'
import { CRITERIA, GROUP_SAY, studyScore, type Criterion } from '@/data/intake/criteria'
import { domainBudget, fitOf, similarProjects } from '@/data/intake/insight'
import { consultantByKey, consultantsFor } from '@/data/intake/consultants'
import {
  adviceCode, flowOf, forwardBlockers, referConsultant, referralOpen, saveStudy, type Recommendation, type Study } from '@/data/intake/flow'
import { FundingPlanCard } from '@/features/budget/FundingPlan'
import { PRIORITY_SAY, PRIORITY_TONE, priorityLog, priorityOf, setPriority, usePriority, type Priority } from '@/data/intake/priority'

/* «الدراسة» · the supervisor's study of a project (3.2.11–3.2.16, 3.2.19, 3.4.25).

   The form is the study itself, not a note about it: each criterion from settings scored 1–5 with
   its weight, the technical and administrative findings, the recommendation and its reasons. Beside
   it, what the study is measured against — the domain's budget, the fit signals and similar
   projects — and the consultant, when one is asked.

   Editing belongs to the supervisor while the project sits at his seat; everyone else reads the
   same study. Saving records it on the timeline; forwarding it is the decision bar's job, so the
   study can be saved and revised before it goes anywhere. */

const SCALE = [1, 2, 3, 4, 5] as const
const GROUPS: Criterion['group'][] = ['فني', 'مالي', 'إداري']

export function StudyTab({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  const f = flowOf(row.id)
  const blank: Omit<Study, 'at' | 'version' | 'field'> = {
    scores: {}, technical: '', admin: '', recommendation: '', amount: row.amountRequested, justification: '', by: me,
  }
  const [d, setD] = useState(() => (f.study ? { ...f.study, by: me } : blank))
  const [msg, setMsg] = useState('')

  const score = studyScore(d.scores)
  const blockers = forwardBlockers(row.id)

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => { setD((x) => ({ ...x, [k]: v })); setMsg('') }

  const save = () => {
    saveStudy(row.id, { ...d, by: me })
    setMsg(isolate(`حُفظت الدراسة · الدرجة ${studyScore(d.scores)} من 100`))
  }

  return (
    <>
      {f.returnNote && (
        <Glass>
          <Head title="أعاده مدير المنح" meta={<Tag tone="warn">للتحديث</Tag>} />
          <p className="sub cnote">{f.returnNote}</p>
          <p className="sub cnote">{f.returnStudied
            ? 'حُدّثت الدراسة وسُجّل إصدارها الجديد · أعد الإرسال لمدير المنح من شريط القرار.'
            : 'حدّث الدراسة واحفظها، ثم أعد الإحالة من شريط القرار · يُسجَّل إصدار جديد ويبقى السابق في السجل.'}</p>
        </Glass>
      )}

      <Glass>
        <Head
          title="نموذج الدراسة"
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
            {g !== 'مالي' && <label className="regf regf-w">
              <span className="lb">ملاحظات الدراسة {GROUP_SAY[g].study}</span>
              <span className="fld fld-a">
                <textarea
                  rows={3}
                  value={g === 'فني' ? d.technical : d.admin}
                  disabled={!editable}
                  onChange={(e) => set(g === 'فني' ? 'technical' : 'admin', e.target.value)}
                  aria-label={`ملاحظات الدراسة ${g}`}
                />
              </span>
            </label>}
          </div>
        ))}
      </Glass>

      <Glass>
        <Head title="التوصية" meta={<Tag tone="mute">استشارية · لا اعتماد ولا صرف</Tag>} />
        <div className="cfgchips" role="radiogroup" aria-label="التوصية">
          {(['approve', 'reject'] as Recommendation[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={d.recommendation === r}
              className={`cfgchip${d.recommendation === r ? ' on' : ''}`}
              disabled={!editable}
              onClick={() => set('recommendation', r)}
            >
              {r === 'approve' ? 'توصية بالموافقة' : 'توصية بالاعتذار'}
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
        </div>
        {editable && (
          <div className="regfoot">
            <span className="decsent">{msg || (blockers.length ? `قبل الإحالة: ${blockers[0]}` : 'جاهزة للإحالة من شريط القرار')}</span>
            <span className="pc-sp" />
            <button type="button" className="btn btn-p" onClick={save}>احفظ الدراسة</button>
          </div>
        )}
      </Glass>

      {/* 3.2.14 · 3.2.15 · the supervisor decides the project's financial term in the study */}
      <FundingPlanCard row={row} amount={d.recommendation === 'approve' ? d.amount : row.amountRequested} editable={editable} me={me} />

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
                <Tag tone="mute">{s.recommendation === 'approve' ? 'موافقة' : s.recommendation === 'reject' ? 'اعتذار' : 'بلا توصية'}</Tag>
              </li>
            ))}
          </ul>
        </Glass>
      )}
    </>
  )
}

/** The side column of the study tab · budget, the assistant's reading, the consultant */
export function StudyAside({ row, me, editable }: { row: ProjectRow; me: string; editable: boolean }) {
  const f = flowOf(row.id)
  const budget = domainBudget(row)
  const fit = fitOf(row)
  const similar = similarProjects(row)
  const options = consultantsFor(row.field)
  const ref = f.referral
  const refC = ref ? consultantByKey(ref.consultant) : undefined
  const [pick, setPick] = useState(options[0]?.key ?? '')
  const asked = f.study?.recommendation === 'approve' ? f.study.amount : row.amountRequested

  return (
    <>
      <PriorityCard row={row} me={me} editable={editable} />
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

      <Glass>
        <Head title="قراءة المساعد" meta={<Tag tone={fit.score >= 70 ? 'ok' : 'warn'}>التوافق {pct(fit.score)}</Tag>} />
        <ul className="payq-ck">
          {fit.signals.map((s) => (
            <li key={s.text} className={s.tone === 'ok' ? 'ok' : 'no'}>
              <Icon name={s.tone === 'ok' ? icons.check : icons.alert} size="sm" />
              <span>{s.text}</span>
            </li>
          ))}
        </ul>
        <h3 className="stdy-h mt-3">مشاريع مشابهة</h3>
        <ul className="stdy-sim">
          {similar.map((p) => (
            <li key={p.id}>
              <Link className="tlink trim1" to={ROUTES.project(p.id)}>{p.name}</Link>
              <span className="sub">{p.entityName} · <Money>{p.amountGranted || p.amountRequested}</Money> · {p.statusGroup}</span>
            </li>
          ))}
          {similar.length === 0 && <li className="sub">لا مشاريع في الهدف نفسه بعد.</li>}
        </ul>
        <p className="sub cnote">قراءة مساندة · لا تقرّر ولا تُلزم.</p>
      </Glass>

      <Glass>
        <Head
          title="رأي المستشار"
          meta={ref ? (ref.opinion ? <Tag tone="ok">{ref.verdict}</Tag> : referralOpen(ref) ? <Tag tone="warn">بانتظار الرأي</Tag> : <Tag tone="mute">انتهت المدة</Tag>) : <Tag tone="mute">اختياري</Tag>}
        />
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
      </Glass>
    </>
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
