import { useMemo, useState } from 'react'
import { MISSING_ITEM, NOUN, nounAfter } from '@/lib/format'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, Blockers, FieldSelect, Glass, Head, Icon, KV, Money, Num, Steps, Tag, icons, type StepItem, DockWhy, blockerCount,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import {
  KINDS, TEMPLATES, agreementIssues, projectById, projectOptions,
  scheduleTotal, seedSchedule, type DraftPay,
} from '@/data/mock/agreementNew'
import type { AgreementKind } from '@/types/domain'
import { ScheduleEditor } from './ScheduleEditor'

/* Agreement setup screen.

   Note: this screen produces a draft, not an agreement. The four stages are: grants supervisor
   (setup) -> grants manager (review) -> executive director (approval) -> entity (signing). This is
   stage one only; its output enters the queue as "draft".

   Note: there is no "send to entity" action here. Rule 13 blocks sending to the entity before
   institutional approvals are complete, so the button isn't present at all, not even disabled. A
   disabled button implies "you could if...", while the rule says "you can't from here".

   Note: three fields lock at creation and never change afterward: project (rule 2), type (rule 3),
   and template (rule 4). Changing them later means a new version. This is stated at selection time,
   not after. */

const KEYS = ['tab', 'project'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const STAGES = [
  { key: 'project', label: 'المشروع', note: 'المشروع المعتمد الذي تُعدّ له الاتفاقية · مشروع واحد فقط' },
  { key: 'form', label: 'النموذج والتوقيع', note: 'النوع والنموذج وممثل الجهة · تُثبَّت عند الإنشاء' },
  { key: 'sched', label: 'جدول الدفعات', note: 'جزء من الاتفاقية لا ملحق بها · ويلزم أن يطابق مجموعه قيمة المنحة' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function AgreementNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  /* Project comes from the URL when the screen opens from the agreement tab on the project page - the
   normal entry point. */
  const projectId = v.project ?? ''
  const project = projectById(projectId)
  const amount = project?.amountGranted ?? 0
  /* Reserved amount in the budget - step 11 matches the value against it.
     Note: in this version they are equal because the reservation is made at the approved amount;
     once the backend arrives, this becomes a genuinely independent field. */
  const reserved = amount

  const [template, setTemplate] = useState('')
  const [kind, setKind] = useState<AgreementKind | ''>('')
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  /* Note: seeding must also work for a project coming from the URL. The first version only seeded the
   table in `pickProject`, but the normal entry point for this screen is `?project=` from the
   agreement tab on the project page, so `onChange` never fires - users would land on the table
   stage and find it empty. */
  const [rows, setRows] = useState<DraftPay[]>(
    () => (project ? seedSchedule(project.amountGranted, today()) : []),
  )
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)

  /** Once a project is selected, the table is seeded - an editable starting point. */
  const pickProject = (id: string) => {
    set({ project: id || undefined })
    const p = projectById(id)
    setRows(p ? seedSchedule(p.amountGranted, today()) : [])
  }

  const issues = useMemo(
    () => (projectId
      ? agreementIssues({ projectId, template, kind, signerName, signerTitle, rows, amount, reserved })
      : []),
    [projectId, template, kind, signerName, signerTitle, rows, amount, reserved],
  )

  const shortBy: Record<string, string[]> = {
    project: projectId ? [] : ['المشروع'],
    form: [
      ...(template ? [] : ['النموذج']),
      ...(kind ? [] : ['نوع الاتفاقية']),
      ...(signerName.trim() ? [] : ['اسم الموقّع']),
      ...(signerTitle.trim() ? [] : ['صفة الموقّع']),
    ],
    sched: rows.length === 0 ? ['جدول الدفعات'] : [],
  }
  const missing = Object.values(shortBy).flat()
  const canSend = missing.length === 0 && issues.length === 0
  /* Single count shared by the card and the doc. */
  const blocks = [
    ...STAGES.filter((s) => shortBy[s.key].length)
      .map((s) => ({ head: s.label, text: shortBy[s.key].join(' · '), n: shortBy[s.key].length })),
    ...issues.map((i) => ({ head: i.rule, text: i.say })),
  ]

  /* Note: the note belongs to a stage, so the tag must identify it. The first version computed
   "complete" from missing fields alone, so the table stage would say "complete" at the top and,
   right below it, "payment total short by 1,024,000" - a contradiction on the same screen. */
  const stageIssue: Record<string, string[]> = {
    project: ['project', 'reserved'],
    form: ['template', 'kind', 'signer'],
    sched: ['sum', 'empty', 'req', 'order'],
  }
  const issuesIn = (key: string) => issues.filter((i) => stageIssue[key].includes(i.key))
  const shortOf = (key: string) => shortBy[key].length + issuesIn(key).length

  const at = STAGES.findIndex((x) => x.key === tab)
  const stage = STAGES[at]
  const first = at <= 0
  const last = at >= STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = STAGES[at + d]
    if (next) setTab(next.key)
  }

  /* The four stages - this screen is the first only. */
  const steps: StepItem[] = [
    { label: 'إعداد', note: 'مشرف المنح · المحطة الحالية', state: sent ? 'done' : 'now' },
    { label: 'مراجعة', note: 'مدير المنح', state: sent ? 'now' : 'todo' },
    { label: 'اعتماد نهائي', note: 'المدير التنفيذي', state: 'todo' },
    { label: 'توقيع', note: 'الجهة المستفيدة', state: 'todo' },
  ]

  return (
    <AppLayout assistantContext={assistFor.page('إعداد اتفاقية')}>
      <div className="viewstack hasdock">
        <div className="screen col">
          <BackTo
            label={project ? project.name : 'الاتفاقيات'}
            onClick={() => navigate(project ? ROUTES.projectTab(project.id, 'agreement') : ROUTES.agreements)}
          />

          <header>
            <div>
              <h1 className="ptitle">إعداد اتفاقية</h1>
              <p className="sub mt-1">
                المحطة الأولى من <span className="num">4</span> · ينتج عنها <b>مسودة</b>،
                ولا تُرسل إلى الجهة إلا بعد اعتماد المؤسسة
              </p>
            </div>
            {/* Count tag removed from the page header - the single count lives in the doc. */}
          </header>

          <Glass className="regsteps">
            <Steps
              flow="stepper"
              onPick={(i) => setTab(STAGES[i].key)}
              items={STAGES.map((st) => ({
                label: st.label,
                state: st.key === tab ? 'now' : shortOf(st.key) === 0 ? 'done' : 'todo',
              }))}
            />
          </Glass>

          <Glass>
            <Head
              title={stage.label}
              meta={
                shortOf(tab)
                  ? <Tag tone="warn"><Num>{shortOf(tab)}</Num> {nounAfter(shortOf(tab), MISSING_ITEM)}</Tag>
                  : <Tag tone="ok">مكتمل</Tag>
              }
            />
            <p className="sub cnote">{stage.note}</p>

            {tab === 'project' && (
              <>
                <div className="regfields">
                  <label className="regf regf-w">
                    <span className="lb">
                      المشروع<b className="regf-r" aria-label="إلزامي">*</b>
                    </span>
                    {/* Note: an ineligible project stays in the list with its reason shown - hiding it would make users
   search for a project they can't find and assume it was deleted. */}
                    <FieldSelect
                      value={projectId}
                      onChange={pickProject}
                      label="المشروع"
                      placeholder="اختر المشروع"
                      options={projectOptions().map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.blocked ? ` · ${p.blocked}` : ''}`,
                      }))}
                    />
                    <span className="sub regf-h">
                      مشروع واحد فقط · قاعدة <span className="num">2</span>
                    </span>
                  </label>
                </div>

                {project && (
                  <KV
                    rows={[
                      { k: 'الجهة المستفيدة', v: project.entityName },
                      { k: 'المسار والمجال', v: `${project.track} · ${project.field}` },
                      { k: 'قيمة المنحة', v: <Money>{amount}</Money> },
                      {
                        k: 'المحجوز في الميزانية',
                        v: (
                          <span className="kvpair">
                            <Money>{reserved}</Money>
                            {amount === reserved
                              ? <Tag tone="ok">مطابق</Tag>
                              : <Tag tone="warn">غير مطابق</Tag>}
                          </span>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            )}

            {tab === 'form' && (
              <>
                {/* Note: type locks at creation (rule 3); this line is shown at selection time so the supervisor
   knows they're making a decision, not just filling a field. */}
                <ul className="pkinds">
                  {KINDS.map((k) => (
                    <li key={k.key}>
                      <label className={`pkind${kind === k.key ? ' on' : ''}`}>
                        <input
                          type="radio"
                          name="agkind"
                          checked={kind === k.key}
                          onChange={() => setKind(k.key)}
                        />
                        <span className="pkind-h">
                          <span className="pkind-r" aria-hidden="true">
                            {kind === k.key && <Icon name={icons.check} size="sm" />}
                          </span>
                          <b>{k.label}</b>
                          <span className="sub trim1">· {k.note}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  يُحدَّد النوع عند الإنشاء و<b>لا يتغيّر</b> بعد ذلك إلا بإصدار
                  جديد · قاعدة <span className="num">3</span>.
                </p>

                <div className="regfields">
                  <label className="regf regf-w">
                    <span className="lb">
                      النموذج المعتمد<b className="regf-r" aria-label="إلزامي">*</b>
                    </span>
                    <FieldSelect
                      value={template}
                      options={TEMPLATES}
                      onChange={setTemplate}
                      label="النموذج المعتمد"
                      placeholder="اختر النموذج"
                    />
                    <span className="sub regf-h">
                      يُحدَّد بحسب مصدر التمويل وحجم المنحة والظهور الإعلامي · قاعدة{' '}
                      <span className="num">4</span>
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">
                      اسم الموقّع<b className="regf-r" aria-label="إلزامي">*</b>
                    </span>
                    <span className="fld">
                      <input
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        aria-label="اسم الموقّع"
                      />
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">
                      صفة الموقّع<b className="regf-r" aria-label="إلزامي">*</b>
                    </span>
                    <span className="fld">
                      <input
                        value={signerTitle}
                        onChange={(e) => setSignerTitle(e.target.value)}
                        placeholder="المدير التنفيذي للجمعية"
                        aria-label="صفة الموقّع"
                      />
                    </span>
                    <span className="sub regf-h">ممثل الجهة المخوّل بالتوقيع · مدخل في الوثيقة</span>
                  </label>
                </div>
              </>
            )}

            {tab === 'sched' && (
              project
                ? <ScheduleEditor rows={rows} amount={amount} onChange={setRows} />
                : <p className="sub cnote">اختر المشروع أولًا · يُطابَق الجدول مع قيمة المنحة.</p>
            )}

            {/* Rules are stated at their own stage, not in a message after submission. */}
            {issuesIn(tab).map((i) => (
              <p key={i.key} className="bad cnote">
                {i.say} <span className="sub">· {i.rule}</span>
              </p>
            ))}

            <div className="regfoot">
              <span className="decsent">
                الخطوة <b><Num>{at + 1}</Num> من <Num>{STAGES.length}</Num></b>
                <span className="decsep" />
                {stage.label}
              </span>
              <span className="pc-sp" />
              <div className="rowf gp-2">
                <button
                  className="btn btn-2"
                  disabled={first}
                  title={first ? 'هذه الخطوة الأولى' : `ارجع إلى ${STAGES[at - 1].label}`}
                  onClick={() => go(-1)}
                >
                  <Icon name={icons.chevronBack} size="sm" />
                  السابق
                </button>
                {!last && (
                  <button
                    className="btn btn-p"
                    title={`انتقل إلى ${STAGES[at + 1].label}`}
                    onClick={() => go(1)}
                  >
                    التالي
                    <Icon name={icons.chevron} size="sm" />
                  </button>
                )}
              </div>
            </div>
          </Glass>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="محطات الاتفاقية" meta={<span className="sub">أربع محطات</span>} />
                <Steps items={steps} flow="ladder" />
                {/* Rule 25 - this line prevents a wrong assumption from the first screen. */}
                <p className="sub cnote">
                  انتقال الاتفاقية بين محطاتها <b>لا يغيّر حالة المشروع</b> ·
                  قاعدة <span className="num">25</span>.
                </p>
              </Glass>
            </div>

            <div className="col">
              <Blockers
                items={blocks}
                ready="كل الخطوات مكتملة · الاتفاقية جاهزة للإرسال إلى مدير المنح."
              />
            </div>
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>أُرسلت · <b>بانتظار مدير المنح</b></>
                  : <>
                      {project
                        ? <>قيمة المنحة <b><Money>{amount}</Money></b></>
                        : 'اختر المشروع أولًا'}
                      {rows.length > 0 && (
                        <>
                          <span className="decsep" />
                          <Num>{rows.length}</Num> {nounAfter(rows.length, NOUN.payment)} بمجموع{' '}
                          <Money>{scheduleTotal(rows)}</Money>
                        </>
                      )}
                      {saved && <><span className="decsep" />حُفظت المسودة</>}
                      <DockWhy n={blockerCount(blocks)} />
                    </>}
              </span>
            </div>
            <div className="rowf gp-2">
              {!sent ? (
                <>
                  <button
                    className="btn btn-2"
                    disabled={!projectId}
                    title={projectId ? 'احفظ الاتفاقية مسودةً' : 'اختر المشروع أولًا'}
                    onClick={() => setSaved(true)}
                  >
                    احفظ المسودة
                  </button>
                  {/* Note: "send to entity" is not available here - rule 13 blocks it before institutional approvals
   are complete; the only action from this stage is referral to the grants manager. */}
                  <button
                    className="btn btn-p"
                    disabled={!canSend}
                    title={
                      missing.length
                        ? `بنود ناقصة: ${missing.length}`
                        : issues.length
                          ? issues[0].say
                          : 'أرسل الاتفاقية إلى مدير المنح'
                    }
                    onClick={() => setSent(true)}
                  >
                    أرسل إلى مدير المنح
                  </button>
                </>
              ) : (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.agreements)}>
                  افتح الصندوق
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
