import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BackTo, Empty, Glass, Head, Icon, icons, Money, Mono, Num, Riyal, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import {
  KIND_NOTE, KIND_SAY, childrenOf, docTitle, fiscalYears,
  flatten, fundSources, hasChildren, levelOf, outlineOf, pathOf, rootOf, sumChildren,
  treeIssues, yearById, yearSourceTaken,
  type BudgetDoc, type BudgetNode, type LineKind,
} from '@/data/mock/budgetTree'
import { allBudgets, budgetDocOf } from '@/data/mock/chain'

/* ═══════════════════════════════════════════════════════════
   الميزانية · إنشاء وتحرير · شاشة واحدة

   ⚠️ **الشاشة قسمان، وده مبدأ بيتكرّر في السيستم كله:** ترويسة
   فيها البيانات اللي بتعرّف الريكورد، وتحتها **البنود**. مظفر
   وصفه كقاعدة عامة لكل شاشة فيها تفاصيل، وهو نفس تركيب أمر الصرف
   وجدول دفعات الاتفاقية.

   ⚠️ **والترويسة قفل على البنود مش مجرد حقول فوقها.** الجذر بياخد
   مبلغ الميزانية من الترويسة أوتوماتيك، فتغيير المبلغ فوق بيخلّي
   كل المجاميع تحت غلط لحظتها — والقواعد بتقول ده صريحًا بدل ما
   تسيب المستخدم يكتشفه عند الإرسال.

   ═══ ليه القواعد **معروضة** لا مفروضة ═══

   مظفر كان واضحًا: «خلّي الأوبشنز موجودة عنده يختار، يجيب له رسالة
   خطأ» · يعني ما نحجبش «فرعي» عن أول بند، نسيبه يختار ونقول له
   الغلط فين وليه. الحجب بيخلّي المستخدم ما يتعلّمش الهيكل، والرسالة
   بتعلّمه · والقايمة اللي جنب الشجرة بتعرض كل الملاحظات مع مصدر
   كل قاعدة.

   ⚠️ **والكلام ده كان مكتوب هنا والكود تحته بيعمل عكسه.** أول
   نسخة كانت بتخفي حقلَي «نوع البند» و«تابع لبند» تمامًا لما الشجرة
   فاضية، وبتكتب `kind: 'main'` من غير ما تبصّ لاختيار المستخدم،
   وزرار الشاشة الفاضية كان اسمه «أضف البند الجذر» · أمر لا اختيار.
   يعني المبدأ كان معلَّقًا في الترويسة والتنفيذ بيخالفه على بُعد
   مية سطر · **مبدأ مكتوب بلا فحص بيفضل نيّة**، زي قاعدة الشرطة
   الطويلة بالظبط. الاختيار دلوقتي مفتوح من أول بند، والقاعدة في
   `rootRule` بتتقال في المودال قبل الحفظ.
   ═══════════════════════════════════════════════════════════ */

type Draft = Omit<BudgetDoc, 'id'> & { id?: string }

/** أرقام بفواصل في حقل إدخال · `type=number` ما بيفصلش الآلاف،
    والرقم اللي بالملايين من غير فواصل بيتقري غلط بالعين */
const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

const BLANK: Draft = {
  yearId: '',
  sourceCode: '',
  from: '',
  to: '',
  total: 0,
  state: 'draft',
  nodes: [],
}

export default function BudgetDocPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const existing = id ? budgetDocOf(id) : undefined
  const missing = Boolean(id) && !existing

  const [doc, setDoc] = useState<Draft>(() => (existing ? { ...existing } : { ...BLANK }))
  const [shut, setShut] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [under, setUnder] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  /* حقول المودال */
  const [nLabel, setNLabel] = useState('')
  const [nKind, setNKind] = useState<LineKind>('main')
  const [nAmount, setNAmount] = useState('')
  const [nParent, setNParent] = useState('')
  /** رسالة القاعدة اللي وقفت الإضافة · بتتقال في المودال لا بعد الحفظ */
  const [blocked, setBlocked] = useState('')

  const nodes = doc.nodes
  const root = rootOf(nodes)
  const issues = useMemo(
    () => (doc.yearId ? treeIssues({ ...doc, id: doc.id ?? 'new' }) : []),
    [doc],
  )

  /* (سنة + مصدر) ما يتكرروش · قاعدة الترويسة الوحيدة */
  const clash = useMemo(
    () =>
      doc.yearId && doc.sourceCode
        /* التحقّق على **كل** الميزانيات لا على الفكستشر وحده ·
           غير كده (سنة + مصدر) تعدّي وهي مكرّرة مع ميزانية مولَّدة */
        ? yearSourceTaken(allBudgets, doc.yearId, doc.sourceCode, doc.id)
        : undefined,
    [doc.yearId, doc.sourceCode, doc.id],
  )

  const headReady =
    Boolean(doc.yearId) && Boolean(doc.sourceCode) && doc.total > 0 && !clash
  const canSubmit = headReady && issues.length === 0 && nodes.length > 0

  const rows = useMemo(() => flatten(nodes, null, shut), [nodes, shut])

  const toggle = (nid: string) =>
    setShut((s) => {
      const next = new Set(s)
      if (next.has(nid)) next.delete(nid)
      else next.add(nid)
      return next
    })

  /** فتح المودال · الأب متحدَّد سلفًا لو جه من زرار داخل صفّ */
  const openAdd = (parentId: string | null) => {
    setUnder(parentId)
    setNParent(parentId ?? '')
    setNLabel('')
    setNAmount('')
    /* ⚠️ النوع الافتراضي **مش استنتاج**: المستخدم بيقدر يغيّره،
       والقواعد بتقول له لو غلط. الافتراضي بيوفّر خطوة لا أكتر. */
    setNKind(parentId === null ? 'main' : 'sub')
    setBlocked('')
    setOpen(true)
  }

  /**
   * ⚠️ **الكونديشن ده هو ج-15، والكود كان بيعمل عكسه بالظبط.**
   *
   * مظفر قال بالنص: «خلّي الأوبشنز موجودة عنده يختار، يجيب له رسالة
   * خطأ». والمبدأ ده كان **مكتوب في ترويسة الملف ده نفسه** · وتحته
   * الكود بيخفي حقلَي النوع والأب على أول بند، وبيكتب `kind: 'main'`
   * من غير ما يبصّ لاختيار المستخدم. يعني الملف كان بيناقض نفسه.
   *
   * دلوقتي الاختيار مفتوح من أول بند، والقاعدة بتتقال **قبل** الحفظ
   * لا بعده: الرسالة بتظهر في المودال وزرار الإضافة بيتقفل بسببها
   * مكتوبًا · فالمستخدم بيتعلّم الهيكل بدل ما الشاشة تخبّيه عنه.
   */
  const rootRule = (kind: LineKind, parentId: string | null): string => {
    if (nodes.length > 0) {
      /* فرعي تحت فرعي ممنوع (قاعدة 4)، والفرعي لازم له أب (ج-12) */
      if (kind === 'sub' && !parentId) return 'البند الفرعي لازم يكون تابعًا لبند · اختار الأب.'
      const up = parentId ? nodes.find((x) => x.id === parentId) : undefined
      if (kind === 'sub' && up?.kind === 'sub') return 'ما ينفعش بند فرعي تحت بند فرعي.'
      return ''
    }
    /* أول بند · هو جذر الميزانية وبياخد مبلغها كاملًا (ج-10) */
    if (kind === 'sub') {
      return 'أول بند هو جذر الميزانية، فنوعه رئيسي · البنود الفرعية بتتحط تحته بعد كده.'
    }
    if (parentId) return 'مفيش بنود قبله يتبعها · أول بند بيبقى بلا أب.'
    return ''
  }

  const addNode = () => {
    const parentId = nParent || null
    const stop = rootRule(nKind, parentId)
    if (stop) { setBlocked(stop); return }

    const amount = Number(nAmount) || 0
    const root = parentId === null
    const node: BudgetNode = {
      id: `n-${Date.now()}`,
      label: nLabel.trim(),
      kind: nKind,
      parentId,
      /* الجذر بياخد مبلغ الميزانية من الترويسة لا من المستخدم */
      allocated: root ? doc.total : amount,
      available: root ? doc.total : amount,
      active: true,
    }
    setDoc((d) => ({ ...d, nodes: [...d.nodes, node] }))
    setOpen(false)
  }

  const removeNode = (nid: string) => {
    /* شيل البند وكل نسله · وده مش «حذف» من السجل، دي مسودة لسه
       ما اتبعتتش · والحذف بعد الإرسال ممنوع بالمتعلقات */
    const kill = new Set<string>([nid])
    let grew = true
    while (grew) {
      grew = false
      for (const x of nodes) {
        if (x.parentId && kill.has(x.parentId) && !kill.has(x.id)) {
          kill.add(x.id)
          grew = true
        }
      }
    }
    setDoc((d) => ({ ...d, nodes: d.nodes.filter((x) => !kill.has(x.id)) }))
  }

  const setAmount = (nid: string, value: number) =>
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((x) =>
        x.id === nid ? { ...x, allocated: value, available: value } : x,
      ),
    }))

  const setTotal = (value: number) =>
    setDoc((d) => ({
      ...d,
      total: value,
      /* الجذر بيتحرّك مع الترويسة · لو ساب قيمته القديمة بيبقى
         الغلط في مكانين والقايمة بتشتكي مرتين من سبب واحد */
      nodes: d.nodes.map((x) =>
        x.parentId === null ? { ...x, allocated: value, available: value } : x,
      ),
    }))

  if (missing) {
    return (
      <AppLayout assistantContext={assistFor.page('الميزانية')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />
            <Glass>
              <Empty
                title="الميزانية غير موجودة."
                note="يمكن يكون الرابط قديم · والميزانيات لا تُحذف طالما عليها مشاريع."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>
                    ارجع للميزانية
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const title = existing ? docTitle(existing) : 'ميزانية جديدة'
  /* الآباء المتاحون · الفرعي ما يتحطّش تحت فرعي (قاعدة 4) */
  const parents = nodes.filter((x) => !(nKind === 'sub' && x.kind === 'sub'))

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack hasdock">
        {/* ⚠️ من غير `hasg2` هنا · الكلاس ده بيدّي العمود الأول من
            الشبكة مسافة لزق سفلية، وهي صح لما الشبكة آخر حاجة في
            الصفحة. هنا الشجرة تحتها، فالمسافة بتتحوّل لفراغ ميت بين
            كارت البيانات والجدول. */}
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                الميزانية تتعرّف بـ<b>سنة مالية + مصدر تمويل</b> · والبنود شجرة،
                والصرف بيحصل على آخرها
              </p>
            </div>
            <Tag tone={doc.state === 'draft' ? 'mute' : 'ok'}>
              {doc.state === 'draft' ? 'مسودة' : 'مرسَلة'}
            </Tag>
          </header>

          <div className="g2">
            <div className="col">
              {/* ═══ القسم الأول · الترويسة ═══ */}
              <Glass>
                <Head
                  title="بيانات الميزانية"
                  meta={<span className="sub">القسم الأول · وبيقفل على البنود تحته</span>}
                />
                <div className="regfields">
                  <label className="regf">
                    <span className="lb">السنة المالية<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <select
                        value={doc.yearId}
                        onChange={(e) => {
                          const y = yearById(e.target.value)
                          setDoc((d) => ({
                            ...d,
                            yearId: e.target.value,
                            from: y?.from ?? d.from,
                            to: y?.to ?? d.to,
                          }))
                        }}
                        aria-label="السنة المالية"
                      >
                        <option value="">اختر</option>
                        {fiscalYears.map((y) => (
                          <option key={y.id} value={y.id}>{y.name}</option>
                        ))}
                      </select>
                    </span>
                    {/* ⚠️ السنة بتجيب مداها معاها · التاريخان تحت
                        بيتملوا لوحدهم وبيفضلوا قابلين للتعديل، لأن
                        ميزانية ربع سنة داخل السنة المالية واردة */}
                    <span className="sub regf-h">تُعرَّف في الإعدادات، وبتجيب مداها معاها</span>
                  </label>

                  <label className="regf">
                    <span className="lb">مصدر التمويل<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <select
                        value={doc.sourceCode}
                        onChange={(e) => setDoc((d) => ({ ...d, sourceCode: e.target.value }))}
                        aria-label="مصدر التمويل"
                      >
                        <option value="">اختر</option>
                        {fundSources.map((s) => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">من تاريخ</span>
                    <span className="fld">
                      <input
                        type="date"
                        value={doc.from}
                        onChange={(e) => setDoc((d) => ({ ...d, from: e.target.value }))}
                        aria-label="من تاريخ"
                      />
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">إلى تاريخ</span>
                    <span className="fld">
                      <input
                        type="date"
                        value={doc.to}
                        onChange={(e) => setDoc((d) => ({ ...d, to: e.target.value }))}
                        aria-label="إلى تاريخ"
                      />
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">المبلغ الإجمالي<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={doc.total ? nf.format(doc.total) : ''}
                        onChange={(e) => setTotal(digits(e.target.value))}
                        aria-label="المبلغ الإجمالي"
                      />
                      <Riyal />
                    </span>
                    <span className="sub regf-h">الجذر بياخده كاملًا</span>
                  </label>
                </div>

                {/* قاعدة الترويسة · التحقّق في الحقل لا بعد الإرسال */}
                {clash && (
                  <p className="bad cnote">
                    <b>{yearById(doc.yearId)?.name}</b> لها ميزانية بنفس المصدر بالفعل
                    (<Mono>{clash.id}</Mono>) · السنة ومصدر التمويل ما يتكرروش مع بعض.
                    نفس السنة بمصدر تاني تمام.
                  </p>
                )}
              </Glass>

            </div>

            <div className="col">
              {/* ═══ القواعد · معروضة لا مفروضة ═══ */}
              <Glass>
                <Head
                  title="ما يمنع الإرسال"
                  meta={
                    issues.length
                      ? <Tag tone="warn"><Num>{issues.length}</Num> ملاحظة</Tag>
                      : <Tag tone="ok">الشجرة سليمة</Tag>
                  }
                />
                {issues.length === 0 ? (
                  <p className="sub cnote">
                    كل أب يساوي مجموع أبنائه، وكل بند في مكانه · الشجرة جاهزة للإرسال.
                  </p>
                ) : (
                  <ul className="btree-iss">
                    {issues.map((i, k) => (
                      <li key={k}>
                        <Icon name={icons.alert} size={14} />
                        <span>{i.text}</span>
                        <span className="payq-r">{i.why}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Glass>

              <Glass>
                <Head title="ازاي الشجرة بتتبني" />
                <p className="sub cnote">
                  الجذر بياخد مبلغ الميزانية كاملًا · وتحته <b>رئيسي</b> (مسار ثم
                  مجال) · وآخر الشجرة <b>فرعي</b> وهو الهدف.
                </p>
                <p className="sub cnote">
                  ومجموع الأبناء يساوي مخصص الأب في كل مستوى · فتغيير رقم في
                  الآخر بيطلع لفوق لحد الجذر.
                </p>
                {/* ⚠️ الجملة دي هي أهم حاجة في الشاشة · وهي اللي
                    بتفسّر ليه بند رقمه صحيح ومع ذلك ما ينفعش يتصرف
                    منه */}
                <p className="sub cnote">
                  <b>الحجز والصرف على البنود الفرعية وحدها</b> · اللي فوقها للتقارير،
                  فالبند اللي تحته بنود ما يتصرفش منه مباشرةً.
                </p>
                <p className="sub cnote">
                  والمستويات مفتوحة · تلاتة أو خمسة، طالما كل بند تابع لبند أعلى منه.
                </p>
              </Glass>
            </div>
          </div>

          {/* ⚠️ **الشجرة برّه الشبكة عن قصد.** كانت جوّه العمود
              الرئيسي فبتاخد ثلثي العرض، والعمود الأول (اسم البند)
              بيتقصّ من أول مستوى تالت — «مسار التعليم» بتبقى «١ م…».
              وجدول فيه إزاحة بعمق بيحتاج عرض الصفحة كلها، مش عمودًا
              جنب كارت. */}
              <Glass className="tblcard">
                <Head
                  title="بنود الميزانية"
                  meta={
                    <span className="sub">
                      <Num>{nodes.length}</Num> بند · الحجز والصرف على البنود الفرعية
                    </span>
                  }
                />

                {nodes.length === 0 ? (
                  <Empty
                    title="الشجرة فاضية."
                    note={
                      headReady
                        ? 'اختار نوع البند في المودال · وأول بند بياخد المبلغ الإجمالي كاملًا.'
                        : 'اكمل بيانات الميزانية فوق الأول · أول بند بياخد مبلغها.'
                    }
                    actions={
                      /* ⚠️ «أضف بند» لا «أضف البند الجذر» · العنوان
                         التاني كان بيقول إن في اختيار واحد، وهو مش صح:
                         الاختيار مفتوح والقاعدة هي اللي بتحكم (ج-15) */
                      <button
                        className="btn btn-p"
                        disabled={!headReady}
                        title={headReady ? 'أضف بند للشجرة' : 'اكمل الترويسة أولًا'}
                        onClick={() => openAdd(null)}
                      >
                        <Icon name={icons.plus} size={16} />
                        أضف بند
                      </button>
                    }
                  />
                ) : (
                  <>
                    <div className="btree">
                      <div className="btree-h">
                        <span>البند</span>
                        <span>مستوى البند</span>
                        <span className="tnum">المبلغ المخصص</span>
                        <span className="tnum">المبلغ المتاح</span>
                        <span>الحالة</span>
                        <span />
                      </div>

                      {rows.map((x) => {
                        const kids = hasChildren(nodes, x.id)
                        const lvl = levelOf(nodes, x.id)
                        const bad = issues.some((i) => i.nodeId === x.id)
                        const out = outlineOf(nodes, x.id)
                        return (
                          <div
                            key={x.id}
                            className={`btree-r${bad ? ' no' : ''}${x.active ? '' : ' off'}`}
                          >
                            {/* الإزاحة بكلاس لا بمتغيّر سطري · والعمق
                                اللي أعمق من ستة بياخد آخر درجة، لأن
                                العين مش بتفرّق بعدها */}
                            <span className={`btree-n l${Math.min(lvl, 6)}`}>
                              {kids ? (
                                <button
                                  className="btree-x"
                                  onClick={() => toggle(x.id)}
                                  aria-label={shut.has(x.id) ? 'افتح' : 'اطوِ'}
                                  aria-expanded={!shut.has(x.id)}
                                >
                                  <Icon
                                    name={shut.has(x.id) ? icons.chevronBack : icons.chevronDown}
                                    size={14}
                                  />
                                </button>
                              ) : (
                                <span className="btree-x" />
                              )}
                              {/* ⚠️ المجلّد والورقة مش زينة: الورقة هي
                                  اللي عليها الحجز والصرف، والمجلّد
                                  للتقارير · الفرق ده بيتقري من الأيقونة
                                  قبل ما المستخدم يجرّب ويتقفل عليه */}
                              <Icon name={kids ? icons.folder : icons.doc} size={15} />
                              {out && <span className="btree-o num">{out}</span>}
                              <span className="btree-l">{x.label}</span>
                            </span>

                            <span>
                              <Tag tone={x.kind === 'sub' ? 'ret' : 'mute'}>
                                {KIND_SAY[x.kind]} · <Num>{lvl}</Num>
                              </Tag>
                            </span>

                            <span className="tnum">
                              {/* الجذر رقمه من الترويسة، وأي بند له أبناء
                                 رقمه لازم يساوي مجموعهم · فالتعديل هنا
                                 للورق وللآباء مع تحقّق مكتوب */}
                              {x.parentId === null ? (
                                <span className="num">{nf.format(x.allocated)}</span>
                              ) : (
                                <input
                                  className="btree-a num"
                                  type="text"
                                  inputMode="numeric"
                                  value={x.allocated ? nf.format(x.allocated) : ''}
                                  onChange={(e) => setAmount(x.id, digits(e.target.value))}
                                  aria-label={`مخصص ${x.label}`}
                                />
                              )}
                            </span>

                            <span className="tnum num">
                              {x.active ? nf.format(x.available) : '·'}
                            </span>

                            <span>
                              <Tag tone={x.active ? 'ok' : 'mute'}>
                                {x.active ? 'نشط' : 'غير نشط'}
                              </Tag>
                            </span>

                            <span className="btree-act">
                              {/* الفرعي آخر الشجرة · فمفيش «أضف تحته» */}
                              {x.kind === 'main' && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={`أضف بندًا تحت ${x.label}`}
                                  onClick={() => openAdd(x.id)}
                                >
                                  <Icon name={icons.plus} size={14} />
                                </button>
                              )}
                              {x.parentId !== null && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={kids ? 'يشيل البند وكل ما تحته' : 'شيل البند'}
                                  onClick={() => removeNode(x.id)}
                                >
                                  <Icon name={icons.close} size={14} />
                                </button>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {root && (
                      <p className="sub cnote">
                        مجموع أبناء الجذر <Mono>{nf.format(sumChildren(nodes, root.id))}</Mono> ومخصصه{' '}
                        <Mono>{nf.format(root.allocated)}</Mono> ·{' '}
                        {sumChildren(nodes, root.id) === root.allocated
                          ? 'متوازن'
                          : 'الفرق لازم يتقفل قبل الإرسال'}
                      </p>
                    )}
                  </>
                )}
              </Glass>
        </div>

        {/* ═══ الرصيف · حفظ وإرسال ═══ */}
        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>اتبعتت · الحالة <b>مرسَلة</b></>
                  : doc.state === 'draft' && doc.id
                    ? <>اتحفظت <b>كمسودة</b> · تقدر تكمّلها في أي وقت</>
                    : <>
                        {headReady && root
                          ? <>الإجمالي <Money>{doc.total}</Money></>
                          : 'اكمل السنة ومصدر التمويل والمبلغ'}
                        {issues.length > 0 && (
                          <>
                            <span className="decsep" />
                            <span className="sub"><Num>{issues.length}</Num> ملاحظة على الشجرة</span>
                          </>
                        )}
                      </>}
              </span>
            </div>

            <div className="rowf gp-2">
              {!sent && (
                <>
                  <button
                    className="btn btn-2"
                    disabled={!headReady}
                    title={headReady ? 'احفظ كمسودة' : 'اكمل الترويسة أولًا'}
                    onClick={() => setDoc((d) => ({ ...d, id: d.id ?? 'BG-NEW', state: 'draft' }))}
                  >
                    حفظ
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!canSubmit}
                    title={
                      clash
                        ? 'السنة ومصدر التمويل مكرّرين'
                        : !headReady
                          ? 'اكمل بيانات الميزانية'
                          : issues.length
                            ? `${issues.length} ملاحظة على الشجرة`
                            : 'إرسال الميزانية'
                    }
                    onClick={() => setSent(true)}
                  >
                    إرسال
                  </button>
                </>
              )}
              {sent && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>
                  ارجع للميزانية
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ إضافة بند · مودال ═══
          ⚠️ **مودال لا صفّ فاضي في الجدول.** الصفّ الفاضي بيخلّي
          الشجرة تتحرّك تحت إيد المستخدم وهو بيكتب، والبند اللي لسه
          ما اتسمّاش بياخد مكانًا في الترقيم. المودال بيخلّي البند
          يدخل الشجرة **مكتملًا**. */}
      {open && (
        <div className="bmask" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="chrome modal"
            role="dialog"
            aria-modal="true"
            aria-label="إضافة بند"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <Icon name={icons.plus} size={18} />
              <b>إضافة بند</b>
              <span className="pc-sp" />
              {under && <span className="sub trim1">تحت {pathOf(nodes, under)}</span>}
            </div>

            <div className="mb col">
              <label className="regf">
                <span className="lb">اسم البند</span>
                <span className="fld">
                  <input
                    value={nLabel}
                    onChange={(e) => setNLabel(e.target.value)}
                    placeholder="مسار التعليم"
                    aria-label="اسم البند"
                  />
                </span>
              </label>

              {/* ⚠️ **الحقول دي كانت مخفية على أول بند، ودي كانت
                  المخالفة.** «خلّي الأوبشنز موجودة عنده يختار» معناها
                  إن الاختيار بيفضل معروضًا حتى وهو غلط · الرسالة تحت
                  هي اللي بتقول الغلط، مش غياب الحقل (ج-15). */}
              <>
                  <label className="regf">
                    <span className="lb">نوع البند</span>
                    <span className="fld">
                      <select
                        value={nKind}
                        onChange={(e) => {
                          const k = e.target.value as LineKind
                          setNKind(k)
                          setBlocked(rootRule(k, nParent || null))
                        }}
                        aria-label="نوع البند"
                      >
                        <option value="main">رئيسي</option>
                        <option value="sub">فرعي</option>
                      </select>
                    </span>
                    <span className="sub regf-h">{KIND_NOTE[nKind]}</span>
                  </label>

                  {/* ⚠️ الأب بمساره الكامل · «مجال التعليم» لوحدها مش
                      عنوان، ممكن تكون تحت مسارين مختلفين */}
                  <label className="regf">
                    <span className="lb">تابع لبند</span>
                    <span className="fld">
                      <select
                        value={nParent}
                        onChange={(e) => {
                          setNParent(e.target.value)
                          setBlocked(rootRule(nKind, e.target.value || null))
                        }}
                        aria-label="تابع لبند"
                      >
                        <option value="">بلا · بند جذر</option>
                        {parents.map((p) => (
                          <option key={p.id} value={p.id}>{pathOf(nodes, p.id)}</option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">المبلغ المخصص</span>
                    <span className="fld">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={nAmount ? nf.format(Number(nAmount)) : ''}
                        onChange={(e) => setNAmount(String(digits(e.target.value) || ''))}
                        aria-label="المبلغ المخصص"
                      />
                      <Riyal />
                    </span>
                    {nParent && (
                      <span className="sub regf-h">
                        المتبقّي في «{nodes.find((x) => x.id === nParent)?.label}»{' '}
                        <span className="num">
                          {nf.format(
                            (nodes.find((x) => x.id === nParent)?.allocated ?? 0) -
                              sumChildren(nodes, nParent),
                          )}
                        </span>
                      </span>
                    )}
                  </label>
              </>

              {/* القاعدة بتتقال في مكان القرار · مش توست بعد الضغط
                  ولا رسالة بتظهر لما الشاشة تتبعت */}
              {blocked
                ? <p className="bad cnote">{blocked}</p>
                : nodes.length === 0 && (
                  <p className="sub cnote">
                    أول بند هو <b>جذر الشجرة</b> · بياخد المبلغ الإجمالي{' '}
                    <span className="num">{nf.format(doc.total)}</span> كاملًا،
                    والبنود اللي بعده بتتحط تحته.
                  </p>
                )}
            </div>

            <div className="mf">
              <button
                className="btn btn-p"
                disabled={!nLabel.trim() || Boolean(blocked)}
                title={
                  blocked || (nLabel.trim() ? 'أضف البند' : 'اكتب اسم البند')
                }
                onClick={addNode}
              >
                إضافة
              </button>
              <button className="btn btn-2" onClick={() => setOpen(false)}>إلغاء</button>
              <span className="pc-sp" />
              <span className="sub">
                {childrenOf(nodes, nParent || null).length > 0 && (
                  <>تحته <Num>{childrenOf(nodes, nParent || null).length}</Num> بند</>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
