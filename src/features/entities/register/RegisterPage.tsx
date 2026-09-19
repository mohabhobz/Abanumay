import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BackTo, CopyId, Glass, Head, Icon, icons, Mono, Num, Person, Steps, Tag,
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
  REG_DOCS, REG_STAGES, REG_TERMS, bankIssues, citiesOf, docRequired,
  emptyBank, licenseClash, type RegBank,
} from '@/data/mock/registration'
import { regReadings, stageAdvice, stepState } from '@/data/mock/regPortal'
import { Field } from './Field'
import { BankRows } from './BankRows'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'

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

/**
 * طول رمز التحقّق · **خمس خانات**.
 *
 * ⚠️ **الرقم من شاشات العميل (١٩ سبتمبر)** · كان مكتوبًا ٦ عندنا
 * في أربع أماكن (السطر الإرشادي · شرط الزرار · `maxLength` ·
 * وسطر النموذج)، ومودال العميل خمس خانات.
 *
 * ⚠️ **ومكتوب مرة واحدة عن قصد** · الرقم المكرّر في أربع أماكن
 * بيخلّي زرارًا بيتفتح على خمسة وحقلًا بيقبل ستة.
 */
export const OTP_LEN = 5

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
  /* ن-1 · الحسابات · واحد فاضي من الأول عشان الشاشة ما تبدأش
     بحالة فاضية المستخدم لازم يضغط زرارًا عشان يخرج منها */
  const [banks, setBanks] = useState<RegBank[]>([emptyBank(1)])
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
      /* ⚠️ محطة البنك نواقصها **محسوبة من الصفوف لا من الحقول**:
         مالهاش `fields` أصلًا، ولو فضلت على الحساب العام كانت
         هتطلع «مكتمل» وهي فاضية · نفس مرض «قاعدة ملهاش فحص». */
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

  /* قاعدة 8 · رقم الترخيص ما يتكررش · والقاعدة 9 بتستثني لو
     التصنيف مختلف، فالتحقّق بياخد الاتنين مع بعض */
  const clash = useMemo(
    () => (val.licenseNo && type ? licenseClash(val.licenseNo, type, entityRows) : null),
    [val.licenseNo, type],
  )

  /* ن-3 · نصيحة المحطة اللي إنت فيها · بتتحسب من نفس الأرقام
     اللي الوسم بيعدّها، فما ينفعش يختلفوا */
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

  /* ⚠️ **وتأكيد كلمة المرور مانع برضو، ومش في `shortBy`.** الحقلان
     مليانين، فالعدّاد بيقول «مكتمل» · والطلب ما ينفعش يتبعت
     وكلمتا المرور مختلفتان. فالمانع بيتقرا من النصيحة نفسها. */
  const canSend = missing.length === 0 && !clash && advice.blocking.length === 0

  /* ⚠️ **الستيبر بيحتاج تقدّمًا بالزرار كمان، مش بالضغط عليه بس.**
     الضغط على خطوة بعيدة قفزة · والملء الطبيعي خطوة ورا خطوة،
     والإيد بتفضل على الرصيف حيث الزرار. فالتنقّل بطريقتين:
     الشريط للقفز، والرصيف للتقدّم. */
  /* الكارت اللازق بياخد ارتفاعه من مكانه الفعلي · قبل اللزق قصير
     ومحتواه ظاهر، وكل ما تنزل بيكبر لحد ما يملا الشاشة */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })

  const at = REG_STAGES.findIndex((x) => x.key === tab)
  const first = at <= 0
  const last = at >= REG_STAGES.length - 1
  const go = (d: -1 | 1) => {
    const next = REG_STAGES[at + d]
    if (next) setTab(next.key)
  }

  /**
   * «تعديل» جنب الرقم في مودال التحقّق.
   *
   * ⚠️ **بيرجّع للمحطة ويفوكس الحقل** · الرجوع للفورم وحده كان
   * بيسيب الجهة تدوّر على الحقل في تسع حقول، والفوكس هو اللي
   * بيخلّي الزرار يعمل الحاجة اللي اسمه بيوعد بها.
   */
  const editMobile = () => {
    const field = REG_STAGES.find((x) => x.fields.some((f) => f.key === 'clerkMobile'))
    set({ step: undefined, tab: field && field.key !== REG_STAGES[0].key ? field.key : undefined })
    /* الفوكس بعد ما الشاشة ترسم المحطة الجديدة · قبلها الحقل
       ما بيكونش موجود في الصفحة أصلًا */
    requestAnimationFrame(() => {
      const el = document.getElementById('rf-clerkMobile')
      if (el instanceof HTMLInputElement) { el.focus(); el.select() }
    })
  }



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
  /* ═══ جملة الحالة والمخارج · مرّة واحدة، ومكانها بيتغيّر ═══

     ⚠️ **الرصيف مش للجهة.** رصيف القرار في السيستم ده شريط عايم
     فوق شاشة داخلية، جنبه زرار المساعد، وبيفترض إن اللي قدامه
     موظّف بياخد قرارات في صندوق شغل. والجهة اللي بتملا نموذج تسجيل
     مش في شغل ولا عندها صندوق · هي في **فورم**، والفورم مخارجه
     جوّاه في آخره زي أي فورم على الويب.

     فالمخارج واحدة والمكان بيتغيّر: جوّه الكارت للجاي من برّه،
     وعلى الرصيف للداخل من جوّه (مسؤول النظام بيسجّل جهة شريكة
     مباشرةً · قاعدة 32). */
  const line = (
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
      {phase === 'otp' && <>اكتب الرمز المرسَل للجوال · <Num>{OTP_LEN}</Num> أرقام</>}
      {phase === 'sent' && <>رقم الطلب في هذا النموذج <b>REQ-2026-947142</b></>}

    </span>
  )

  const nav = (
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
          {/* ⚠️ **«حفظ كمسودة» للداخل من جوّه وحده.**
              قاعدة 12 بتقول إن الطلب يتحفظ مسودة ويتكمّل بعدين ·
              والمسودة لازم تتحفظ **على حساب** عشان صاحبها يرجع
              لها. والجهة الجديدة **مالهاش حساب** — دي القاعدة 2
              نفسها. فالزرار للجهة كان بيوعد بحاجة مفيش لها مكان
              ترجع منه، ونموذج `/reg/add` في النظام العامل مفيهوش
              حفظ أصلًا.

              الفجوة دي مسجَّلة: لو المؤسسة عايزة الجهة تحفظ
              وترجع، محتاج تعريف قبل الاعتماد (رابط بالبريد أو
              رمز) — سؤال لعمر. */}
          {inside && (
            <button className="btn btn-2" onClick={() => setDraft(true)}>
              حفظ كمسودة
            </button>
          )}

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
          disabled={otp.length !== OTP_LEN}
          title={otp.length === OTP_LEN ? 'تأكيد الرمز' : `الرمز ${OTP_LEN} أرقام`}
          onClick={() => setPhase('sent')}
        >
          تأكيد الرمز
        </button>
      )}

      {/* المخرج الأخير بيتغيّر بالمكان: صندوق الطلبات شاشة داخلية،
          والجهة مالهاش فيه · بترجع لباب الدخول تستنّى بياناتها */}
      {phase === 'sent' && (
        inside
          ? <button className="btn btn-2" onClick={() => navigate(ROUTES.entityRequests)}>
              افتح صندوق الطلبات
            </button>
          : <button className="btn btn-2" onClick={() => navigate(ROUTES.login)}>
              رجوع لصفحة الدخول
            </button>
      )}
    </div>
  )

  /** مخارج جوّه الكارت · للجاي من برّه وحده */
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
                  {foot}
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
                    /* ⚠️ «مفيش ناقص» مش «خلصت» · شوف `stepState` */
                    items={REG_STAGES.map((st, i) => ({
                      label: st.label,
                      state: stepState(
                        i,
                        REG_STAGES.findIndex((x) => x.key === tab),
                        shortBy[st.key].length,
                      ),
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

                          {/* ⚠️ **تحذير الرفع القانوني · من شاشات
                              العميل (١٩ سبتمبر)** بنصّه: «يمنع منعًا
                              باتًا تحميل بيانات الشركة أو أي ملفات
                              محظورة أخرى».

                              ⚠️ **وهو سطر لا وسم أحمر ولا شريط
                              جانبي.** القاعدة اللي العميل كرّرها
                              تلات مرات: الأحمر مؤشّر **خطر** ·
                              والتحذير اللي بيتلوّن أحمر قبل ما حد
                              يغلط بيخلّي الأحمر ما يعنيش حاجة لمّا
                              يحصل غلط فعلًا. */}
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
                  {/* ⚠️ **«تعديل» جنب الرقم · من شاشات العميل** ·
                      الجهة اللي كتبت رقمًا غلط كانت لازم تلغي
                      الإرسال وترجع للفورم وتدوّر على الحقل. وهنا
                      الزرار **بيعمل حاجة فعلًا**: بيرجّع لمحطة
                      الاتصال ويفوكس الحقل نفسه · نفس درس «اكتب أول
                      رسالة» اللي العميل مسكه: زرار ما بيعملش حاجة
                      أسوأ من زرار مش موجود. */}
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
                    تُقبل · التحقّق الفعلي عند الباك اند.
                  </p>
                  {foot}
                </Glass>
              )}

              {phase === 'sent' && (
                <Glass>
                  <Head title="أُرسل الطلب" meta={<Tag tone="ok">قيد المراجعة</Tag>} />
                  {/* ⚠️ **الرقم المرجعي وزرار نسخه · من شاشات
                      العميل (١٩ سبتمبر)** · الصيغة عندهم
                      `REQ-2026-947124` لا `RG-1039`، وجنبها أيقونة
                      نسخ. والجهة محتاجة الرقم ده لمّا تتكلّم مع
                      المؤسسة، وأربعة عشر حرفًا بتتنقل بالعين ومعاها
                      غلط. */}
                  <p className="sub cnote">
                    رقمك المرجعي <CopyId>REQ-2026-947142</CopyId> · احتفظ بيه، وهو
                    اللي بتتابع بيه حالة طلبك.
                  </p>
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
                  {foot}
                </Glass>
              )}
            </div>

            {/* ═══ العمود الجانبي · كارت واحد لازق ═══
                ⚠️ **كان تلات كروت واتشالوا بقرار العميل:** «مسار
                الطلب» كان بيعيد الستيبر اللي فوق بشكل تاني، و«ما
                ينقص قبل الإرسال» كان بيعدّ من غير ما يقول ليه،
                و«الحساب البنكي» كان شرحًا مرجعيًّا مالوش علاقة
                بالخطوة اللي المستخدم واقف فيها. تلاتة بيجاوبوا نفس
                السؤال بتلات لغات · والمستخدم بيقرا واحدًا.

                وكارت **واحد** هو اللي بيخلّي اللزق يشتغل: عمود بكذا
                كارت لازق بياخد تمريرًا جوّه تمرير. */}
            <div className="col aiside" ref={aside}>
              {/* ⚠️ **نفس كارت تحليلات المشروع والجهة بالحرف.**
                  كان كارتًا مكتوبًا لهذه الشاشة وحدها بقايمة ونبرة
                  خاصّين بيه · فالمستخدم بيشوف «مساعد أبانمي» بشكلين
                  حسب هو فين. و`ReadingBlock` مكتوب فوقه إنه **الراسم
                  الوحيد للقراءة في السيستم**، ونفس الغلطة اللي
                  التعليق ده متكتوب عشانها وقعت تاني.

                  و«راجع طلبي» بالطلب لا تلقائيًا: القراءة بتتحسب
                  لمّا المستخدم يطلبها، وبعدها بتفضل محسوبة ·
                  والكارت المقفول بيعرض أهمّ سطر من غير ضغطة. */}
              {phase === 'form' && (
                <AnalysisCard
                  title="مراجعة مساعد أبانمي"
                  cta="راجع طلبي"
                  empty="الخطوة دي مفيهاش مانع · كمّل للّي بعدها."
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

        {/* الدوك · المخارج بتتغيّر بالمحطة، ومفيش مخرج معطَّل بلا سبب */}
        {/* الرصيف للداخل من جوّه وحده · شوف الشرح فوق عند `line`.
            ⚠️ وحشوه بيسيب مكانًا على الشمال لزرار «اسأل أبانمي»
            العايم، والزرار ده جوّه `AppLayout` وحده. */}
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
