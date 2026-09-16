import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, Glass, Head, Icon, icons, Mono, Num, Person, Steps, Tag, type StepItem,
} from '@/components/ui'
import { DocFile } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { Background } from '@/components/shell'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { isSignedIn } from '@/data/session'
import Logo from '@/assets/LogoColor'
import { entityRows } from '@/data/mock/entities'
import {
  BANKS, REG_DOCS, REG_STAGES, REG_TERMS, citiesOf, docRequired, licenseClash,
  type RegField,
} from '@/data/mock/registration'

/* ═══════════════════════════════════════════════════════════
   طلب تسجيل جهة جديدة · BPD-002 · شاشة الجهة

   ⚠️ **الشاشة دي بتعمل طلبًا لا جهة.** القاعدة 2 بتقول إن الحساب
   ما بيتعملش قبل الاعتماد · فمفيش «إنشاء جهة» هنا، وفي آخر
   الرحلة الشاشة بتقول بالحرف إن الحساب لسه ما اتعملش. ده مش
   تفصيلة تحريرية: الجهة اللي فاكرة إنها اتسجّلت بتفضل مستنية
   بريدًا مش جاي.

   ═══ خمسة تبويبات لا صفحة واحدة ═══

   قاعدة 25 بتقول إن الفورم بيتقسّم لمراحل منطقية، وصفحة
   `/reg/add` في النظام العامل عاملة كده فعلًا (فيها "Vertical
   Tabs"). والتقسيم هنا نفسه مع فرق واحد: **تبويب الحساب البنكي**
   جاي من قاعدة 11 (البيانات الأساسية والبنكية في طلب واحد) لا من
   النظام · النظام بيأجّل البنك لإجراء تاني بشاشتين واعتماد منفصل.
   الفرق مسجَّل في البريف (نوتة ن-4).

   ═══ قاعدة 4 قائمة تحقّق لا رسالة خطأ ═══

   «كل البيانات والمستندات الإلزامية قبل الإرسال» · والقائمة
   **قبل** الزرار بتقول الناقص فين، بدل ما الجهة تضغط وتتنطر لها
   رسالة. والعدّاد على كل تبويب بيقول ناقص كام فيه، فالناقص
   بيتشاف من غير ما التبويبات تتفتح واحدًا واحدًا.

   ═══ والمستندات الإلزامية بتتغيّر بالتصنيف ═══

   تلات مستندات إلزامية للجهات التجارية وحدها. يعني تغيير قيمة
   في التبويب الأول بيغيّر المطلوب في التبويب الأخير · فالقائمة
   بتتحدّث لحظتها لا عند الإرسال.
   ═══════════════════════════════════════════════════════════ */

/** محطات الرحلة · الأخيرة بتخصّ المؤسسة لا الجهة، ومكتوب ده جنبها */
type Phase = 'terms' | 'form' | 'otp' | 'sent'

const PHASES: Phase[] = ['terms', 'form', 'otp', 'sent']

const KEYS = ['step', 'tab', 'up'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const EMPTY: Record<string, string> = {}

/* ⚠️ **المحطة في الرابط لا في الستيت وحده.**
   أول نسخة كانت `useState`، والنتيجة إن `/entities/register` في
   الجرد بيرسم بوّابة الشروط دايمًا · التبويبات الخمسة والحقول
   والمستندات ما بيترسموش ولا مرة، فكل الأدوات بترجع خضرا وهي
   **ما شافتش الفورم**. و`deadcss` هو اللي بان فيه: تمن كلاسات
   جديدة اتسجّلت «ما ظهرتش في الـDOM» وهي مستعملة فعلًا.

   ودي نفس عيلة الغلط اللي اتكرّرت هنا مرتين قبل كده (شاشة «غير
   موجود» بتعدّي من الجرد، وكلاس مش موجود بيشتغل) · الأداة اللي
   بتقيس الحاجة الغلط بترجع خضرا. فالمحطة بقت في الرابط، والجرد
   بيزور كل محطة بمسارها. */

export default function RegisterPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const phase: Phase = PHASES.includes(v.step as Phase) ? (v.step as Phase) : 'terms'
  const setPhase = (x: Phase) => set({ step: x === 'terms' ? undefined : x })
  const [agreed, setAgreed] = useState(false)
  const tab = REG_STAGES.some((s) => s.key === v.tab) ? (v.tab as string) : REG_STAGES[0].key
  const setTab = (x: string) => set({ tab: x === REG_STAGES[0].key ? undefined : x })
  const [val, setVal] = useState<Record<string, string>>(EMPTY)

  /* ⚠️ **المرفوع في الرابط، والملف المختار في الستيت.**
     المفاتيح في `?up=` عشان حالة «بعد الرفع» تبقى شاشة ليها عنوان
     — تتشارك، وترجع بالريفرش، **والجرد يقدر يزورها**. والملف اللي
     المستخدم اختاره فعلًا (اسمه وحجمه) في الستيت، لأنه مش بيتحطّ
     في رابط ولا بيعيش بعد الريفرش · فالشاشة بتعرض اسمه لو موجود،
     وتعرض عيّنة باسم المستند لو المفتاح جه من الرابط. */
  const docs = useMemo(() => new Set(readList(v.up)), [v.up])
  const [files, setFiles] = useState<Record<string, { name: string; size: number }>>({})
  const [otp, setOtp] = useState('')
  const [draft, setDraft] = useState(false)

  const type = val.type ?? ''

  const setField = (k: string, x: string) =>
    setVal((s) => {
      const next = { ...s, [k]: x }
      /* المدينة تابعة للمنطقة · تغيير المنطقة بيسقط مدينة مش
         تابعة لها، بدل ما يسيبها متناقضة في الطلب */
      if (k === 'region' && next.city && !citiesOf(x).includes(next.city)) next.city = ''
      return next
    })

  /** رفع مستند · بياخد الملف الحقيقي لو المستخدم اختار واحدًا */
  const upload = (k: string, f?: File) => {
    if (f) setFiles((s) => ({ ...s, [k]: { name: f.name, size: f.size } }))
    set({ up: writeList([...new Set([...readList(v.up), k])]) })
  }

  /** إزالة المرفوع · مش حذفًا من سجل، دي مسودة لسه ما اتبعتتش */
  const clearDoc = (k: string) => {
    setFiles((s) => {
      const next = { ...s }
      delete next[k]
      return next
    })
    set({ up: writeList(readList(v.up).filter((x) => x !== k)) })
  }

  /** الناقص في كل تبويب · قاعدة 4، والمستندات بتتحسب بالتصنيف */
  const shortBy = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const s of REG_STAGES) {
      out[s.key] =
        s.key === 'docs'
          ? REG_DOCS.filter((d) => docRequired(d, type) && !docs.has(d.key)).map((d) => d.label)
          : s.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)
    }
    return out
  }, [val, docs, type])

  const missing = Object.values(shortBy).flat()

  /* قاعدة 8 · رقم الترخيص ما يتكررش · والقاعدة 9 بتستثني لو
     التصنيف مختلف، فالتحقّق بياخد الاتنين مع بعض */
  const clash = useMemo(
    () => (val.licenseNo && type ? licenseClash(val.licenseNo, type, entityRows) : null),
    [val.licenseNo, type],
  )

  const canSend = missing.length === 0 && !clash

  /* ⚠️ **الستيبر بيحتاج تقدّمًا بالزرار كمان، مش بالضغط عليه بس.**
     الضغط على خطوة بعيدة قفزة · والملء الطبيعي خطوة ورا خطوة،
     والإيد بتفضل على الرصيف حيث الزرار. فالتنقّل بطريقتين:
     الشريط للقفز، والرصيف للتقدّم. */
  const at = REG_STAGES.findIndex((x) => x.key === tab)
  const first = at <= 0
  const last = at >= REG_STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = REG_STAGES[at + d]
    if (next) setTab(next.key)
  }

  const steps: StepItem[] = [
    {
      label: 'ضوابط القبول',
      note: 'خمسة شروط قبل فتح النموذج',
      state: phase === 'terms' ? 'now' : 'done',
    },
    {
      label: 'تعبئة الطلب',
      note: 'خمسة تبويبات · قاعدة 25',
      state: phase === 'terms' ? 'todo' : phase === 'form' ? 'now' : 'done',
    },
    {
      label: 'تحقّق من جوال مدخل البيانات',
      note: 'رمز لمرة واحدة · قاعدة 19',
      state: phase === 'otp' ? 'now' : phase === 'sent' ? 'done' : 'todo',
    },
    {
      label: 'مراجعة مسؤول النظام',
      note: 'اعتماد · إعادة للاستكمال · رفض',
      state: phase === 'sent' ? 'now' : 'todo',
    },
    {
      label: 'إنشاء حساب الجهة',
      note: 'بعد الاعتماد وحده · قاعدة 2',
      state: 'todo',
    },
  ]

  /* ⚠️ **الشاشة دي عامة، والقاعدة 2 هي السبب.**
     صاحب الطلب جهة **مالهاش حساب** — ده تعريف الإجراء نفسه: مفيش
     حساب قبل الاعتماد. فحطّها ورا بوّابة الدخول معناه إنها ما
     تُفتحش إلا من واحد مسجَّل · يعني ما تُفتحش من اللي هي مبنية
     له. عشان كده مسارها برّه `RequireAuth`، ومدخلها الحقيقي زرار
     «تسجيل جهة جديدة» في شاشة الدخول (زي `/reg` في النظام
     العامل بالظبط).

     والداخل من جوّه (مسؤول النظام مثلًا) بيشوفها بريلها وبرجوعها
     للجهات · فالغلاف بيتغيّر بالجلسة، والمحتوى واحد. */
  const inside = isSignedIn()

  /* ⚠️ `hasdock` و`hasg2` مش تزويق · همّ اللي بيخلّوا المحتوى
     **يخلص فوق الرصيف** بدل ما يفضل ماشي تحته. الرصيف شفّاف
     وبيضبّب اللي وراه، والتضبيب ده بيبان لما يكون وراه أرضية
     الصفحة · لكن كارت أبيض ماشي تحته بيخلّي التدرّج غير مرئي
     تمامًا، فالشريط بيقع على المحتوى بحدّ حادّ. نفس العقد اللي في
     صفحة المشروع وصفحة الطلب وصفحة الاتفاقية بالظبط. */
  const body = (
    <div className="viewstack hasdock">
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
                لديك حساب؟ تسجيل الدخول
              </button>
            </div>
          )}

          <header>
            <div>
              <h1 className="ptitle">طلب تسجيل جهة جديدة</h1>
              <p className="sub mt-1">
                اللي بيتعمل هنا <b>طلب</b> لا حساب · الجهة تُنشأ بعد اعتماد
                مسؤول النظام وحده (قاعدة <span className="num">2</span>)
              </p>
            </div>
            {phase === 'form' && (
              <Tag tone={missing.length ? 'warn' : 'ok'}>
                {missing.length
                  ? <><Num>{missing.length}</Num> حقلًا ناقصًا</>
                  : 'مكتمل'}
              </Tag>
            )}
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
                  {/* ⚠️ الضوابط دي **مش في الوثيقة** · هي من النظام
                      العامل، وموجودة هنا لأنها فلتر أهلية بيوفّر على
                      الجهة عشرين دقيقة في نموذج مصيره الرفض. النوتة
                      ن-1 في البريف. */}
                  <p className="sub cnote">
                    الضوابط من صفحة «ضوابط قبول الجهة» في النظام العامل ·
                    الوثيقة تبدأ خطواتها الـ<span className="num">17</span> من تعبئة
                    النموذج مباشرة، فوجود المحطة دي فرق مسجَّل للمراجعة.
                  </p>
                </Glass>
              )}

              {phase === 'form' && (
                <>
                  {/* ⚠️ **دي خطوات لا تبويبات، والفرق مش تسمية.**
                      التبويب بيقول «فين إنت» وبس، وأي ترتيب فيه
                      مقبول · الخطوات هنا **متسلسلة فعلًا**: التصنيف
                      في الأولى بيحدّد المستندات الإلزامية في
                      الأخيرة، والبنك ما ينفعش يتراجع قبل ما نعرف
                      الجهة مين. فالشريط بقى ستيبر: رقم لكل خطوة،
                      وأول ما تكتمل الرقم بيتبدّل بعلامة صح. */}
                  {/* ⚠️ الستيبر جوّه كارت لا عريان على الخلفية.
                      التبويبات اللي كانت مكانه كانت عريانة، والشريط
                      الجديد فيه نصّ خافت (خطوة لسه ما بدأتش) ·
                      و`--t3` على تدرّج الصفحة مباشرةً نزل **3.77**.
                      الكارت بيدّي أرضية معروفة زي كل بلوك تاني في
                      السيستم، فالنصّ الخافت بيرجع يعدّي زي ما بيعدّي
                      جوّه أي كارت. */}
                  <Glass className="regsteps">
                  <Steps
                    flow="stepper"
                    onPick={(i) => setTab(REG_STAGES[i].key)}
                    /* ⚠️ **الرقم الناقص اتشال من تحت الاسم.**
                       كان مكتوبًا تلات مرات في نفس الشاشة: تحت كل
                       خطوة، وفي وسم ترويسة الكارت، وفي جملة الرصيف
                       — وقايمة «ما ينقص» جنبها بتقول الحقول بالاسم.
                       والستيبر بيجاوب سؤالًا واحدًا: **إنت فين
                       ووصلت لفين** · والحالة بتتقال بالنقطة (رقم /
                       صح / كهرماني) من غير سطر تاني. */
                    items={REG_STAGES.map((st) => ({
                      label: st.label,
                      state: st.key === tab
                        ? 'now'
                        : shortBy[st.key].length === 0 ? 'done' : 'todo',
                    }))}
                  />
                  </Glass>

                  {REG_STAGES.filter((s) => s.key === tab).map((s) => (
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
                          {/* ⚠️ **مين بيرفع؟** الجهة نفسها — وتحديدًا
                              مدخل البيانات اللي اسمه في خطوة
                              «الاتصال والأشخاص»، وهو نفسه اللي
                              هيوصله اسم المستخدم بعد الاعتماد
                              (خطوة 15). فالسطر ده مش ترويسة زينة:
                              هو بيقول للجهة إن المستندات مسؤوليتها
                              هي، وإن الاسم اللي كتبته فوق هو اللي
                              هيتسجّل مع كل ملف في سجل التدقيق
                              (قاعدة 30). */}
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
                                <Icon name={icons.users} size={16} />
                                <span className="sub">
                                  المستندات ترفعها <b>الجهة نفسها</b> · اكتب اسم مدخل
                                  البيانات في خطوة «الاتصال والأشخاص» ليُسجَّل مع كل ملف.
                                </span>
                              </>
                            )}
                          </div>

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
                                    {need
                                      ? <Tag tone={on ? 'ok' : 'warn'}>
                                          {d.reqFor ? `إلزامي للتصنيف ${d.reqFor[0]}` : 'إلزامي'}
                                        </Tag>
                                      : <Tag tone="mute">اختياري</Tag>}
                                  </div>

                                  {on ? (
                                    /* عيّنة بعد الرفع · نفس `DocFile`
                                       اللي في المشاريع والجهات
                                       والاتفاقيات، بثامبنيله · فالمراجع
                                       بيعرف نوع الملف قبل ما يفتحه،
                                       والجهة بتشوف اللي رفعته زي ما
                                       هيشوفه هو بالظبط */
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
                                        <Icon name={icons.close} size={14} />
                                        إزالة
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="regdrop">
                                      <input
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png,.gif"
                                        onChange={(e) => upload(d.key, e.target.files?.[0])}
                                      />
                                      <Icon name={icons.upload} size={16} />
                                      <span>اسحب الملف هنا أو اضغط للاختيار</span>
                                      <span className="pc-sp" />
                                      {/* الصيغ والحدّ من النظام العامل حرفيًا */}
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

                      {/* قاعدة 8 و9 · التحقّق في الحقل لا بعد الإرسال،
                          والرسالة بتقول **بأي جهة** اتعارض */}
                      {s.key === 'id' && clash && (
                        <p className="bad cnote">
                          رقم الترخيص <Mono>{val.licenseNo}</Mono> مسجَّل لـ
                          «{clash.name}» بنفس التصنيف · القاعدة{' '}
                          <span className="num">8</span> تمنع التكرار، والقاعدة{' '}
                          <span className="num">9</span> تستثنيه لو التصنيف مختلف.
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
                  <p className="sub cnote">
                    أُرسل رمز لمرة واحدة إلى{' '}
                    <Mono>{val.clerkMobile || '9665XXXXXXXX'}</Mono> · وهو نفس الرقم
                    الذي ستصل إليه بيانات الدخول بعد الاعتماد.
                  </p>
                  <label className="payamt">
                    <span className="lb">رمز التحقّق</span>
                    <input
                      inputMode="numeric"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      aria-label="رمز التحقّق"
                    />
                  </label>
                  <p className="sub cnote">
                    في هذا النموذج أي <span className="num">6</span> أرقام تُقبل ·
                    التحقّق الفعلي عند الباك اند.
                  </p>
                </Glass>
              )}

              {phase === 'sent' && (
                <Glass>
                  <Head title="أُرسل الطلب" meta={<Tag tone="ok">قيد المراجعة</Tag>} />
                  <ul className="payq-ck regsent">
                    <li className="ok">
                      <Icon name={icons.check} size={13} />
                      <span>وصل الطلب لمسؤول النظام، وحالته «قيد المراجعة»</span>
                      <span className="payq-r">قاعدة <Num>26</Num></span>
                    </li>
                    <li className="ok">
                      <Icon name={icons.check} size={13} />
                      <span>سُجّل الطلب في سجل التدقيق بوقته ومُدخله</span>
                      <span className="payq-r">قاعدة <Num>30</Num></span>
                    </li>
                    <li className="no">
                      <Icon name={icons.alert} size={13} />
                      <span>
                        <b>لم يُنشأ حساب بعد</b> · اسم المستخدم يصل بعد الاعتماد وحده
                      </span>
                      <span className="payq-r">قاعدة <Num>2</Num></span>
                    </li>
                  </ul>
                  <p className="sub cnote">
                    السطر الأخير مكتوب عمدًا: الجهة اللي تفتكر إنها اتسجّلت
                    بتفضل مستنية بريدًا مش جاي، وبعدين تتصل تسأل.
                  </p>
                </Glass>
              )}
            </div>

            <div className="col">
              <Glass>
                <Head title="مسار الطلب" meta={<span className="sub">خمس محطات</span>} />
                <Steps items={steps} flow="ladder" />
              </Glass>

              {phase === 'form' && (
                <Glass>
                  <Head
                    title="ما ينقص قبل الإرسال"
                    meta={
                      missing.length
                        ? <Tag tone="warn"><Num>{missing.length}</Num> عنصرًا</Tag>
                        : <Tag tone="ok">مكتمل</Tag>
                    }
                  />
                  {missing.length === 0 ? (
                    <p className="sub cnote">
                      كل الحقول والمستندات الإلزامية للتصنيف الحالي مكتملة ·
                      القاعدة <span className="num">4</span> مستوفاة.
                    </p>
                  ) : (
                    /* ⚠️ اسم الخطوة هنا **عنوان مجموعة لا رابط.**
                       كان زرارًا بكلاس `.lnk` · فبيتلوّن ويتخطّ تحته
                       عند المرور، ووعد التخطيط ده إن فيه وجهة. والتنقّل
                       موجود فوق في الستيبر أصلًا، فالزرار كان بيقول
                       نفس الكلام مرتين بشكلين · والقايمة دي **قراءة**:
                       بتجاوب «ناقص إيه وفين»، مش بتنقل. */
                    <ul className="regmiss">
                      {REG_STAGES.filter((s) => shortBy[s.key].length).map((s) => (
                        <li key={s.key}>
                          <b>{s.label}</b>
                          <span className="sub"> · {shortBy[s.key].join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Glass>
              )}

              {phase === 'form' && (
                <Glass>
                  <Head title="الحساب البنكي" meta={<Tag tone="ret">فرق عن النظام</Tag>} />
                  <p className="sub cnote">
                    القاعدة <span className="num">11</span> بتسجّل البيانات الأساسية
                    والبنكية في طلب <b>واحد</b>، والنظام العامل بيأجّل البنك لإجراء
                    تاني باعتماد منفصل وسبعة أسباب رفض مكوَّدة. اللي مبني هنا:
                    إدخال واحد، واعتماد بنكي منفصل في شاشة المراجعة.
                  </p>
                  <p className="sub cnote">
                    أسماء البنوك قائمة مقفولة ·{' '}
                    <span className="num">{BANKS.length}</span> بنكًا (قاعدة{' '}
                    <span className="num">27</span>) لا حقل نصّ، عشان الاسم ما يتكتبش
                    بعشر صيغ.
                  </p>
                </Glass>
              )}
            </div>
          </div>
        </div>

        {/* الدوك · المخارج بتتغيّر بالمحطة، ومفيش مخرج معطَّل بلا سبب */}
        {/* ⚠️ الرصيف بيسيب مكانًا على الشمال لزرار «اسأل أبانمي»
            العايم · والزرار ده جوّه `AppLayout` وحده. فبرّه الجلسة
            المكان ده بيفضل فاضيًا والشريط بيبان مقصوصًا، عشان كده
            بياخد العرض كامل. */}
        <div className={`decdock${inside ? '' : ' wide'}`}>
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {phase === 'terms' && <>اقرأ الضوابط الخمسة وأقرّ بها قبل فتح النموذج</>}
                {phase === 'form' && (
                  draft
                    ? <>اتحفظت <b>كمسودة</b> · القاعدة <Num>12</Num>، وتقدر تكمّلها في أي وقت</>
                    : <>
                        الخطوة <b><Num>{at + 1}</Num> من <Num>{REG_STAGES.length}</Num></b>
                        <span className="decsep" />
                        {REG_STAGES[at].label}
                        {missing.length > 0 && (
                          <>
                            <span className="decsep" />
                            <span className="sub">ناقص <Num>{missing.length}</Num> قبل الإرسال</span>
                          </>
                        )}
                      </>
                )}
                {phase === 'otp' && <>اكتب الرمز المرسَل للجوال · <Num>6</Num> أرقام</>}
                {phase === 'sent' && <>رقم الطلب في هذا النموذج <b>RG-1042</b></>}
              </span>
            </div>

            <div className="rowf gp-2">
              {phase === 'terms' && (
                <button
                  className="btn btn-p"
                  disabled={!agreed}
                  title={agreed ? 'افتح النموذج' : 'أقرّ بالضوابط أولًا'}
                  onClick={() => setPhase('form')}
                >
                  موافقة ومتابعة
                </button>
              )}

              {phase === 'form' && (
                <>
                  {/* قاعدة 12 · الحفظ كمسودة مخرج مستقل، ومتاح دايمًا ·
                      الجهة اللي ناقصها مستند بتسيب الشغل وترجع له */}
                  <button className="btn btn-2" onClick={() => setDraft(true)}>
                    حفظ كمسودة
                  </button>

                  {/* ⚠️ «السابق» **موجود ومعطَّل** في أول خطوة لا
                      مخفي · الزرار اللي بيظهر ويختفي بيخلّي مكان
                      «التالي» يتنطّ بين الخطوات، والإيد بتدوّر عليه
                      كل مرة. */}
                  <button
                    className="btn btn-2"
                    disabled={first}
                    title={first ? 'دي أول خطوة' : `ارجع لـ${REG_STAGES[at - 1].label}`}
                    onClick={() => go(-1)}
                  >
                    {/* في RTL «لورا» يمين · `chevronBack` هو اللي بيرسمها */}
                    <Icon name={icons.chevronBack} size={15} />
                    السابق
                  </button>

                  {/* ⚠️ **«التالي» ما بيتقفلش على النواقص.** قاعدة 4
                      بتمنع **الإرسال** عند النقص لا التنقّل · والجهة
                      بتملا على مرّات وبترجع. اللي بيتقفل هو الإرسال
                      وحده، وسببه مكتوب. */}
                  {!last ? (
                    <button
                      className="btn btn-p"
                      title={`كمّل في ${REG_STAGES[at + 1].label}`}
                      onClick={() => go(1)}
                    >
                      التالي
                      <Icon name={icons.chevron} size={15} />
                    </button>
                  ) : (
                    <button
                      className="btn btn-p"
                      disabled={!canSend}
                      title={
                        clash
                          ? 'رقم الترخيص مكرّر · قاعدة 8'
                          : missing.length
                            ? `ناقص ${missing.length} من الإلزامي · قاعدة 4`
                            : 'إرسال الطلب للمراجعة'
                      }
                      onClick={() => setPhase('otp')}
                    >
                      إرسال الطلب
                    </button>
                  )}
                </>
              )}

              {phase === 'otp' && (
                <button
                  className="btn btn-p"
                  disabled={otp.length !== 6}
                  title={otp.length === 6 ? 'تأكيد الرمز' : 'الرمز 6 أرقام'}
                  onClick={() => setPhase('sent')}
                >
                  تأكيد الرمز
                </button>
              )}

              {phase === 'sent' && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>
                  افتح صندوق الطلبات
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
  )

  /* الخلفية والقشرة من نفس المكوّنات · الفرق الوحيد إن الريل
     والمساعد مش موجودين، لأن مالهمش معنى لواحد مالوش حساب */
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

/**
 * حقل واحد.
 *
 * القيم المقفولة `select` والباقي `input` · وأسماء البنوك تحديدًا
 * مقفولة بقاعدة 27 عشان الاسم ما يتكتبش بعشر صيغ فيبقى الفرز
 * مستحيل. والتلميحات المكتوبة هنا منقولة من النظام العامل حرفيًا.
 */
function Field({
  f, value, parent, onChange,
}: {
  f: RegField
  value: string
  parent: string
  onChange: (x: string) => void
}) {
  const options = f.dependsOn ? citiesOf(parent) : f.options ?? []
  const locked = Boolean(f.dependsOn) && !parent

  return (
    <label className="regf">
      <span className="lb">
        {f.label}
        {f.req && <b className="regf-r" aria-label="إلزامي">*</b>}
      </span>
      {/* ⚠️ `.fld` مش كلاس شكلي · هو **التحكّم الموجود** للحقول في
          السيستم، ومسجَّل في `ctlaudit` فحلقة تركيزه بتتفحص مع
          البحث والفلاتر. حقل مكتوب للشاشة دي كان هيبقى الركن
          السادس لنفس الشيء، وبحلقة تركيز مختلفة. */}
      <span className={`fld${locked ? ' off' : ''}`}>
        {f.kind === 'select' ? (
          <select
            value={value}
            disabled={locked}
            onChange={(e) => onChange(e.target.value)}
            aria-label={f.label}
          >
            <option value="">{locked ? 'اختر المنطقة أولًا' : 'اختر'}</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            type={f.kind === 'date' ? 'date' : f.kind === 'number' ? 'number' : 'text'}
            inputMode={f.kind === 'tel' || f.kind === 'number' ? 'numeric' : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={f.label}
          />
        )}
      </span>
      {f.hint && <span className="sub regf-h">{f.hint}</span>}
    </label>
  )
}
