import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, FieldSelect, Glass, Head, Icon, KV, Money, Num, Steps, Tag, icons, type StepItem,
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

/* ═══════════════════════════════════════════════════════════
   إعداد الاتفاقية · BPD-008 · هـ-4

   ⚠️ **الشاشة دي مخرجها مسودة لا اتفاقية.** المحطات الأربع في
   المخطط هي: مشرف المنح (إعداد) ← مدير المنح (مراجعة) ← المدير
   التنفيذي (اعتماد) ← الجهة (توقيع). الشاشة دي **المحطة الأولى
   وحدها**، ومخرجها بيدخل الصندوق في مرحلة «مسودة».

   ⚠️ **ومفيش مخرج «إرسال للجهة» هنا** · قاعدة 13 بتمنع الإرسال
   للجهة قبل اكتمال اعتمادات المؤسسة، فالزرار ده مش موجود في
   الشاشة أصلًا لا معطَّل. الزرار المعطَّل بيقول «تقدر لو…»،
   والقاعدة بتقول «ما تقدرش من هنا».

   ⚠️ **وتلات حاجات بتتقفل عند الإنشاء وما بتتغيّرش:** المشروع
   (قاعدة 2) والنوع (قاعدة 3) والنموذج (قاعدة 4) · وتغييرهم بعد
   كده معناه **إصدار جديد**. الشاشة بتقول ده وقت الاختيار لا بعده.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab', 'project'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const STAGES = [
  { key: 'project', label: 'المشروع', note: 'المشروع المعتمد اللي الاتفاقية بتتعمل له · واحد بالظبط' },
  { key: 'form', label: 'النموذج والتوقيع', note: 'النوع والنموذج وممثل الجهة · بيتقفلوا عند الإنشاء' },
  { key: 'sched', label: 'جدول الدفعات', note: 'جزء من الاتفاقية لا ملحق بيها · والمجموع لازم يطابق المنحة' },
]

const today = () => new Date().toISOString().slice(0, 10)

export default function AgreementNewPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : STAGES[0].key
  const setTab = (x: string) => set({ tab: x === STAGES[0].key ? undefined : x })

  /* المشروع بييجي من الرابط لمّا الشاشة تتفتح من تاب الاتفاقية في
     صفحة المشروع · وده المدخل الطبيعي */
  const projectId = v.project ?? ''
  const project = projectById(projectId)
  const amount = project?.amountGranted ?? 0
  /* المحجوز في الميزانية · خطوة 11 بتطابق القيمة بيه.
     ⚠️ في النموذج ده هما متساويان لأن الحجز بيتعمل بالمعتمد ·
     لما الباك اند ييجي، ده بيبقى حقلًا مستقلًا فعلًا. */
  const reserved = amount

  const [template, setTemplate] = useState('')
  const [kind, setKind] = useState<AgreementKind | ''>('')
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  /* ⚠️ **الزرع لازم يشتغل على المشروع الجاي من الرابط كمان.**
     أول نسخة كانت بتزرع الجدول في `pickProject` وبس · والمدخل
     الطبيعي للشاشة هو `?project=` من تاب الاتفاقية في صفحة
     المشروع، يعني الـ`onChange` عمره ما بيشتغل · فالمستخدم كان
     بيوصل لمحطة الجدول ويلاقيها فاضية. */
  const [rows, setRows] = useState<DraftPay[]>(
    () => (project ? seedSchedule(project.amountGranted, today()) : []),
  )
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)

  /** أول ما مشروع يتختار، الجدول بيتزرع · نقطة بداية تتعدّل */
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

  /* ⚠️ **الملاحظة بتخصّ محطة، فالوسم لازم يعرفها.**
     أول نسخة كانت بتحسب «مكتمل» من الحقول الناقصة وحدها · فمحطة
     الجدول كانت بتقول «مكتمل» فوق، وتحتها بالظبط «مجموع الدفعات
     ناقص ١٬٠٢٤٬٠٠٠». تناقض على نفس الشاشة. */
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

  /* المحطات الأربع · والشاشة دي الأولى وحدها */
  const steps: StepItem[] = [
    { label: 'إعداد', note: 'مشرف المنح · هنا', state: sent ? 'done' : 'now' },
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
                المحطة الأولى من <span className="num">4</span> · مخرجها <b>مسودة</b>،
                والإرسال للجهة ما بيحصلش إلا بعد اعتماد المؤسسة
              </p>
            </div>
            <Tag tone={missing.length || issues.length ? 'warn' : 'ok'}>
              {missing.length || issues.length
                ? <><Num>{missing.length + issues.length}</Num> قبل الإرسال</>
                : 'جاهزة'}
            </Tag>
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
                  ? <Tag tone="warn"><Num>{shortOf(tab)}</Num> ناقص</Tag>
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
                    {/* ⚠️ غير المؤهَّل **بيفضل في القايمة ومعاه سببه** ·
                        اختفاؤه بيخلّي المستخدم يدوّر على مشروع مش
                        لاقيه ويفتكر إنه اتمسح (نفس درس ج-15) */}
                    <FieldSelect
                      value={projectId}
                      onChange={pickProject}
                      label="المشروع"
                      placeholder="اختار"
                      options={projectOptions().map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.blocked ? ` · ${p.blocked}` : ''}`,
                      }))}
                    />
                    <span className="sub regf-h">
                      مشروع واحد بالظبط · قاعدة <span className="num">2</span>
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
                {/* ⚠️ النوع بيتقفل عند الإنشاء (قاعدة 3) · والسطر ده
                    بيتقال وقت الاختيار عشان المشرف يعرف إنه بياخد
                    قرارًا لا بيملا خانة */}
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
                            {kind === k.key && <Icon name={icons.check} size={12} />}
                          </span>
                          <b>{k.label}</b>
                          <span className="sub trim1">· {k.note}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="sub cnote">
                  النوع بيتحدّد عند الإنشاء و<b>ما يتغيّرش</b> بعدها إلا بإصدار
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
                      placeholder="اختار"
                    />
                    <span className="sub regf-h">
                      بيتحدّد بمصدر التمويل وحجم المنحة والظهور الإعلامي · قاعدة{' '}
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
                      صفته<b className="regf-r" aria-label="إلزامي">*</b>
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
                : <p className="sub cnote">اختار المشروع الأول · قيمة المنحة هي اللي الجدول بيتطابق معاها.</p>
            )}

            {/* القواعد بتتقال في محطتها لا في رسالة بعد الإرسال */}
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
                  title={first ? 'دي أول خطوة' : `ارجع لـ${STAGES[at - 1].label}`}
                  onClick={() => go(-1)}
                >
                  <Icon name={icons.chevronBack} size={15} />
                  السابق
                </button>
                {!last && (
                  <button
                    className="btn btn-p"
                    title={`كمّل في ${STAGES[at + 1].label}`}
                    onClick={() => go(1)}
                  >
                    التالي
                    <Icon name={icons.chevron} size={15} />
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
                {/* قاعدة 25 · والسطر ده بيمنع توقّعًا غلط من أول شاشة */}
                <p className="sub cnote">
                  انتقال الاتفاقية بين محطاتها <b>ما بيغيّرش حالة المشروع</b> ·
                  قاعدة <span className="num">25</span>.
                </p>
              </Glass>
            </div>

            <div className="col">
              {(missing.length > 0 || issues.length > 0) && (
                <Glass>
                  <Head
                    title="ما يمنع الإرسال"
                    meta={<Tag tone="warn"><Num>{missing.length + issues.length}</Num></Tag>}
                  />
                  <ul className="regmiss">
                    {STAGES.filter((s) => shortBy[s.key].length).map((s) => (
                      <li key={s.key}>
                        <b>{s.label}</b>
                        <span className="sub"> · {shortBy[s.key].join(' · ')}</span>
                      </li>
                    ))}
                    {issues.map((i) => (
                      <li key={i.key}>
                        <b>{i.rule}</b>
                        <span className="sub"> · {i.say}</span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              )}
            </div>
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>اتبعتت · <b>بانتظار مدير المنح</b></>
                  : <>
                      {project
                        ? <>قيمة المنحة <b><Money>{amount}</Money></b></>
                        : 'اختار المشروع الأول'}
                      {rows.length > 0 && (
                        <>
                          <span className="decsep" />
                          <Num>{rows.length}</Num> دفعات بمجموع{' '}
                          <Money>{scheduleTotal(rows)}</Money>
                        </>
                      )}
                      {saved && <><span className="decsep" />اتحفظت كمسودة</>}
                    </>}
              </span>
            </div>
            <div className="rowf gp-2">
              {!sent ? (
                <>
                  <button
                    className="btn btn-2"
                    disabled={!projectId}
                    title={projectId ? 'احفظ كمسودة' : 'اختار المشروع الأول'}
                    onClick={() => setSaved(true)}
                  >
                    حفظ كمسودة
                  </button>
                  {/* ⚠️ «إرسال للجهة» **مش موجود هنا** · قاعدة 13
                      بتمنعه قبل اعتمادات المؤسسة، والمخرج الوحيد من
                      المحطة دي هو الإحالة لمدير المنح */}
                  <button
                    className="btn btn-p"
                    disabled={!canSend}
                    title={
                      missing.length
                        ? `ناقص ${missing.length}`
                        : issues.length
                          ? issues[0].say
                          : 'أحِل الاتفاقية لمدير المنح'
                    }
                    onClick={() => setSent(true)}
                  >
                    إحالة لمدير المنح
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
