import { useState } from 'react'
import { readTemplate } from '@/data/shared/ai'
import { MISSING_ITEM, NOUN, nounAfter } from '@/lib/format'
import { useNavigate } from 'react-router-dom'
import {
  CheckMark, BackTo, Blockers, DateText, FieldSelect, Glass, Head, Icon, KV, Money, Num, Steps, Tag, icons, type StepItem, DockWhy, blockerCount,
} from '@/components/ui'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { blockerReadings } from '@/features/shared/blockerReadings'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import {
  KINDS, TEMPLATES, projectById, projectOptions,
  scheduleTotal, seedSchedule, toPayments, type DraftPay,
} from '@/data/mock/agreementNew'
import type { AgreementKind, PayDoc } from '@/types/domain'
import { readRole, roleByKey } from '@/data/roles'
import { appFlowOf, payPlanOf } from '@/data/approvals/store'
import { useBudget } from '@/data/budget/store'
import {
  agrIssues, agrReview, agreementText, createAgreement, nextAgreementId, reservedOf, templateClauses, windowOf, type Clause,
} from '@/data/agreements/store'
import { ScheduleEditor } from './ScheduleEditor'
import { AgreementTextCard, AnnexesCard, ClausesCard, ReviewCard } from './parts'

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
  { key: 'sched', label: 'جدول الدفعات', note: 'جزء من الاتفاقية لا ملحق بها · ويلزم أن يطابق مجموعه قيمة المنحة وأن تقع تواريخه في مدة التنفيذ' },
  { key: 'terms', label: 'البنود والملاحق', note: 'البنود والشروط والالتزامات وآلية المتابعة · وشروط قرار الاعتماد مدرجة تلقائيًّا' },
  { key: 'text', label: 'النص والمراجعة', note: 'نص الاتفاقية ببيانات المشروع · ومراجعة المساعد الاسترشادية' },
]

/** The template's clauses plus the approval's special conditions · the starting terms */
const startClauses = (projectId: string): Clause[] => {
  const p = projectById(projectId)
  if (!p) return []
  const st = Math.random().toString(36).slice(2, 7)
  return [
    ...templateClauses(p, st),
    ...appFlowOf(projectId).conditions.map((c, i) => ({ id: `cl-${st}-c${i}`, kind: 'condition' as const, source: 'approval' as const, title: c.when === 'agreement' ? 'شرط قبل توقيع الاتفاقية' : 'شرط قبل الدفعة الأولى', body: c.text })),
  ]
}

const today = () => new Date().toISOString().slice(0, 10)

export default function AgreementNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  /* Project comes from the URL when the screen opens from the agreement tab on the project page -
     the normal entry point. */
  const projectId = v.project ?? ''
  const project = projectById(projectId)
  const opt = projectOptions().find((o) => o.id === projectId)
  useBudget()
  const amount = project?.amountGranted ?? 0
  /* Step 11 · the agreement value against the amount actually held · the funding link's final hold */
  const reserved = project ? reservedOf({ projectId, reserved: amount }) : 0
  const me = roleByKey(readRole()).name
  const navigateTo = useNavigate()

  const [template, setTemplate] = useState('')
  const [kind, setKind] = useState<AgreementKind | ''>('')
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [rows, setRows] = useState<DraftPay[]>(
    () => (project ? seedSchedule(project.amountGranted, windowOf(project.id).from ?? today(), payPlanOf(project.id)?.count, payPlanOf(project.id)?.note) : []),
  )
  const [clauses, setClauses] = useState<Clause[]>(() => startClauses(projectId))
  const [docs, setDocs] = useState<PayDoc[]>([])
  const [paperCopy, setPaperCopy] = useState('')
  const [said, setSaid] = useState<string[]>([])

  /** Once a project is selected, the table and the terms are seeded - an editable starting point. */
  const pickProject = (id: string) => {
    set({ project: id || undefined })
    const p = projectById(id)
    setRows(p ? seedSchedule(p.amountGranted, windowOf(id).from ?? today(), payPlanOf(id)?.count, payPlanOf(id)?.note) : [])
    setClauses(startClauses(id))
  }

  const draft = {
    projectId, kind, template: kind === 'ورقية' ? 'نسخة ورقية · خارج النماذج' : template,
    signer: { name: signerName, title: signerTitle }, amount, reserved,
    payments: rows, clauses, docs, paperCopy,
  }
  /* Computed on each render · a handful of checks over a small draft */
  const issues = projectId ? [
    ...(opt?.blocked ? [{ key: 'project', say: `«${opt.name}» ${opt.blocked}.`, rule: /* doc 8.2.1 */ '' }] : []),
    ...agrIssues(draft),
  ] : []
  const hints = projectId ? agrReview(draft) : []
  const text = projectId ? agreementText(draft) : []

  const make = (send: boolean) => {
    const id = nextAgreementId()
    const out = createAgreement({
      row: { id, projectId, kind: kind as AgreementKind, template: draft.template, payments: toPayments(rows, amount), signer: draft.signer, docs: paperCopy ? [{ name: paperCopy, kind: 'ورقية', at: today(), size: '—' }, ...docs] : docs },
      clauses, paperCopy: paperCopy || undefined, send, replaces: opt?.additional,
    }, me)
    if (out.length) { setSaid(out); return }
    navigateTo(ROUTES.agreement(id))
  }

  const shortBy: Record<string, string[]> = {
    project: projectId ? [] : ['المشروع'],
    terms: [],
    text: [],
    form: [
      ...(kind === 'ورقية' ? (paperCopy ? [] : ['نسخة الاتفاقية الورقية']) : template ? [] : ['النموذج']),
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
    ...issues.map((i) => ({ head: 'قبل الإرسال', text: i.say })),
  ]

  /* Note: the note belongs to a stage, so the tag must identify it. The first version computed
     "complete" from missing fields alone, so the table stage would say "complete" at the top and,
     right below it, "payment total short by 1,024,000" - a contradiction on the same screen. */
  const stageIssue: Record<string, string[]> = {
    project: ['project', 'reserved'],
    form: ['template', 'kind', 'signer', 'paper'],
    sched: ['sum', 'empty', 'req', 'order', 'late', 'early'],
    terms: ['cl-obligation', 'cl-followup', 'cond', 'annex'],
    text: [],
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
    { label: 'إعداد', note: 'مشرف المنح · المحطة الحالية', state: 'now' },
    { label: 'مراجعة', note: 'مدير المنح', state: 'todo' },
    { label: 'اعتماد نهائي', note: 'المدير التنفيذي', state: 'todo' },
    { label: 'توقيع', note: 'الجهة المستفيدة', state: 'todo' },
    { label: 'اعتماد وسريان', note: 'ممثل المؤسسة', state: 'todo' },
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
                المحطة الأولى من <span className="num">5</span> · ينتج عنها <b>مسودة</b>،
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
                    {/* Note: an ineligible project stays in the list with its reason shown - hiding
                        it would make users search for a project they can't find and assume it was
                        deleted. */}
                    <FieldSelect
                      value={projectId}
                      onChange={pickProject}
                      label="المشروع"
                      placeholder="اختر المشروع"
                      options={projectOptions().filter((p) => p.blocked !== 'ليس في مرحلة إعداد الاتفاقية' || p.id === projectId).map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.blocked ? ` · ${p.blocked}` : p.additional ? ` · اتفاقية إضافية لـ ${p.additional}` : ''}`,
                      }))}
                    />
                    <span className="sub regf-h">
                      مشروع واحد فقط{/* doc rule 2 */}
                    </span>
                  </label>
                </div>

                {opt?.additional && (
                  <p className="sub cnote">
                    للمشروع اتفاقية سارية <b>{opt.additional}</b> · هذه اتفاقية إضافية تحلّ محلها عند سريانها، فتبقى اتفاقية سارية واحدة.
                  {/* doc 8.4.25 */}</p>
                )}
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
                {/* Note: type locks at creation (rule 3); this line is shown at selection time so
                    the supervisor knows they're making a decision, not just filling a field. */}
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
                            {kind === k.key && <CheckMark />}
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
                  جديد{/* doc rule 3 */}.
                </p>

                <div className="regfields">
                  {kind === 'ورقية' ? (
                    /* 8.2.30 · a paper agreement isn't built on a template · its copy is uploaded */
                    <div className="regf regf-w">
                      <span className="lb">
                        نسخة الاتفاقية الورقية<b className="regf-r" aria-label="إلزامي">*</b>
                      </span>
                      <span className="apv-row">
                        <label className="btn btn-2 btn-sm">
                          <Icon name={icons.upload} size="sm" />{paperCopy ? 'استبدل النسخة' : 'ارفع النسخة'}
                          <input className="vis-h" type="file" accept=".pdf,.doc,.docx" aria-label="نسخة الاتفاقية الورقية" onChange={(e) => { const x = e.target.files?.[0]; if (x) setPaperCopy(x.name); e.target.value = '' }} />
                        </label>
                        {paperCopy ? <Tag tone="ok">{paperCopy}</Tag> : <span className="sub">لا نسخة بعد</span>}
                      </span>
                      <span className="sub regf-h">تُعدّ خارج النماذج وتُرفع هنا · ثم تُرفع النسخة الموقّعة عند وصولها{/* doc 8.4.16 */}</span>
                    </div>
                  ) : (
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
                      يُحدَّد بحسب مصدر التمويل وحجم المنحة والظهور الإعلامي{/* doc rule 4 */}
                    </span>
                  </label>
                  )}

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
                ? <>
                    <ScheduleEditor rows={rows} amount={amount} onChange={setRows} />
                    {windowOf(projectId).from && <p className="sub cnote">مدة التنفيذ في الخطة من <DateText>{windowOf(projectId).from!}</DateText> إلى <DateText>{windowOf(projectId).to ?? ''}</DateText> · تقع الدفعات داخلها.</p>}
                  </>
                : <p className="sub cnote">اختر المشروع أولًا · يُطابَق الجدول مع قيمة المنحة.</p>
            )}

            {tab === 'terms' && !project && <p className="sub cnote">اختر المشروع أولًا · تُدرج بنود النموذج وشروط قرار الاعتماد تلقائيًّا.</p>}
            {tab === 'text' && !project && <p className="sub cnote">اختر المشروع أولًا · يُعرض النص ببيانات المشروع.</p>}

            {/* Rules are stated at their own stage, not in a message after submission. */}
            {issuesIn(tab).map((i) => (
              <p key={i.key} className="bad cnote">
                {i.say}
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

          {tab === 'terms' && project && (
            <>
              <ClausesCard clauses={clauses} onChange={setClauses} />
              <AnnexesCard docs={docs} onChange={setDocs} title="الملاحق" />
            </>
          )}
          {tab === 'text' && project && (
            <>
              <AgreementTextCard parts={text} note="البيانات مسترجعة من المشروع والجهة والميزانية والخطة · وتُعدَّل في مصدرها لا هنا." />
              <ReviewCard hints={hints} onAdd={(c) => setClauses((xs) => [...xs, c])} onTemplate={kind === 'إلكترونية' ? setTemplate : undefined} />
            </>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="محطات الاتفاقية" meta={<span className="sub">خمس محطات</span>} />
                <Steps items={steps} flow="ladder" />
                {/* Rule 25 - this line prevents a wrong assumption from the first screen. */}
                <p className="sub cnote">
                  انتقال الاتفاقية بين محطاتها <b>لا يغيّر حالة المشروع</b>{/* doc rule 25 */}.
                </p>
              </Glass>
              <Blockers
                items={blocks}
                ready="كل الخطوات مكتملة · الاتفاقية جاهزة للإرسال إلى مدير المنح."
              />
            </div>

            {/* The end column is the assistant's alone · it reads what blocks sending */}
            <AssistantAside
              title="مراجعة الاتفاقية"
              cta="راجع الاتفاقية"
              empty="كل الخطوات مكتملة · الاتفاقية جاهزة للإرسال إلى مدير المنح."
              readings={[...(project ? [readTemplate(project, template || undefined)] : []), ...blockerReadings(blocks, 'يمنع الإرسال')]}
            />
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
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
                {said.length > 0 && <><span className="decsep" /><span className="bad">{said[0]}</span></>}
                <DockWhy n={blockerCount(blocks)} />
              </span>
            </div>
            <div className="rowf gp-2">
              <button
                className="btn btn-2"
                disabled={!projectId || !kind || Boolean(opt?.blocked)}
                title={!projectId ? 'اختر المشروع أولًا' : !kind ? 'حدّد نوع الاتفاقية' : opt?.blocked || 'احفظ الاتفاقية مسودةً وأكمِلها لاحقًا'}
                onClick={() => make(false)}
              >
                احفظ المسودة
              </button>
              {/* Note: "send to entity" is not available here - rule 13 blocks it before
                  institutional approvals are complete; the only action from this stage is
                  referral to the grants manager. */}
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
                onClick={() => make(true)}
              >
                أرسل إلى مدير المنح
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
