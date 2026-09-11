import { Glass, Money, Num } from '@/components/ui'
import { nf } from '@/lib/format'
import { CYCLES, plan2026, type PlanNode } from '@/data/budgetPlan'

/**
 * رسوم الميزانية · **الرسوم اللي في `reports1_1` و`reports1_5`، مرسومة
 * بالداتا الحقيقية**.
 *
 * قبل كده كانت مخططات فاضية بأعمدة عشوائية «بتقول شكل الرسم لا قيمه».
 * وده كان قرارًا غلط: الشاشة اللي بتقول «فيه رسم هنا» من غير ما ترسمه
 * ما بتفرقش عن سطر مكتوب، والعميل بيسأل · بحق · طب فين الرسم.
 *
 * ═══ الشكل اتغيّر عن النظام العامل عن قصد ═══
 *
 * «المصاريف السنوية حسب المجال» في النظام أعمدة **رأسية** على ٣٩ هدفًا،
 * فالأسماء العربية بتتكتب رأسية متداخلة وما تتقريش · الرقم موجود
 * والعرض بيمنعه. هنا أعمدة **أفقية**: الاسم بيتكتب أفقيًا زي ما يتقري،
 * والطول هو المقياس.
 *
 * ═══ الألوان ═══
 *
 * التلات طبقات مش فئات مستقلة · دي **أجزاء من كل**: المنصرف جزء من
 * الملتزم، والملتزم جزء من المخصص. فاللون درجات من نفس اللون مع
 * محايد للباقي، مش لوحة فئوية. الفرق بينهم من الإضاءة لا من الصبغة،
 * فبيفضل مقروءًا لعمى الألوان، ومعاه مفتاح وقيم مكتوبة.
 */

const SERIES = [
  { key: 'spent', label: 'المصروف', cls: 'a' },
  { key: 'unpaid', label: 'ملتزم لم يُصرف', cls: 'b' },
  { key: 'free', label: 'غير ملتزم', cls: 'c' },
] as const

interface Part { label: string; alloc: number; spent: number; unpaid: number; free: number }

const partsOf = (n: PlanNode): Part => {
  const spent = n.spent ?? 0
  /* الملتزم اللي لسه ما اتصرفش = المعتمد − المصروف. لو المعتمد مش
     معروف بناخد المحجوز، وده أضيق لكنه ما بيجمعش رقمًا مرتين. */
  const unpaid = Math.max(0, (n.approved ?? spent + (n.reserved ?? 0)) - spent)
  return { label: n.label, alloc: n.alloc, spent, unpaid, free: Math.max(0, n.alloc - spent - unpaid) }
}

/** كل المجالات الاتناشر تحت المسارين */
const fields2026: PlanNode[] =
  (plan2026.children ?? []).flatMap((t) => t.children ?? [])

/* ═══════════════════ ١ · نسبة المصروف ═══════════════════ */

/**
 * رقم واحد · **مش رسمًا**.
 *
 * «نسبة المصروف من الميزانية السنوية» قيمة واحدة، والقيمة الواحدة
 * بلاطة رقم بمقياس، لا شريط في إطار رسم. النظام بيرسمها شريطًا
 * مخطّطًا بعرض الشاشة عشان يملا مكانًا.
 */
export function SpendGauge({
  title = 'نسبة المصروف من الميزانية السنوية',
  value, of, note,
}: { title?: string; value: number; of: number; note?: string }) {
  const pct = of ? Math.round((value / of) * 100) : 0
  return (
    <Glass className="chq">
      <span className="chq-t">{title}</span>
      <span className="chq-v"><b className="num">{pct}%</b></span>
      <span className="chq-m" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
      <span className="chq-s mut">
        <Money sm>{value}</Money> من <Money sm>{of}</Money>
        {note ? ` · ${note}` : ''}
      </span>
    </Glass>
  )
}

/* ═══════════════════ ٢ · المصاريف حسب المجال ═══════════════════ */

export function FieldSpend({ nodes = fields2026 }: { nodes?: PlanNode[] }) {
  const parts = nodes.map(partsOf).sort((a, b) => b.alloc - a.alloc)
  const max = Math.max(...parts.map((p) => p.alloc), 1)

  return (
    <Glass className="chb">
      <span className="chb-h">
        <span className="chb-t">المصاريف السنوية حسب المجال</span>
        <span className="chb-k">
          {SERIES.map((s) => (
            <span key={s.key}><i className={s.cls} />{s.label}</span>
          ))}
        </span>
      </span>

      <div className="chb-rows">
        {parts.map((p) => (
          <div className="chb-r" key={p.label}>
            <span className="chb-lb" title={p.label}>{p.label}</span>
            <span className="chb-tr" style={{ width: `${(p.alloc / max) * 100}%` }}>
              {SERIES.map((s) => {
                const v = p[s.key]
                if (v <= 0) return null
                return (
                  <i
                    key={s.key}
                    className={s.cls}
                    style={{ width: `${(v / p.alloc) * 100}%` }}
                    title={`${p.label} · ${s.label}`}
                  />
                )
              })}
            </span>
            <span className="chb-v num">
              <Money sm>{p.spent}</Money>
              <small className="sub"> من <Money sm>{p.alloc}</Money></small>
            </span>
          </div>
        ))}
      </div>

      <p className="mut chb-n">
        النظام العامل بيرسم ده أعمدةً رأسيةً على <Num>39</Num> هدفًا، فالأسماء
        بتطلع مقلوبة ومتداخلة. الأعمدة الأفقية بتخلّي الاسم يتقري والطول هو المقياس.
      </p>
    </Glass>
  )
}

/* ═══════════════════ ٣ · المصاريف السنوية ═══════════════════ */

/**
 * التغيّر عبر الزمن · خمس دورات بأسماء قصيرة، فالأعمدة الرأسية
 * تصحّ هنا: المحور فيه خمس علامات وأسماؤها بتتكتب أفقيًا تحتها.
 */
/**
 * المصاريف السنوية · **خطّان لا أعمدة**.
 *
 * الأعمدة المزدوجة كانت بتحطّ عمودين ملزوقين لكل سنة، فالعين بتقرا
 * **عشر كتل** وبتدوّر مين مع مين. والسؤال هنا مش «قدّ إيه في
 * ٢٠٢٤؟» · هو **«المصروف بيمشي مع المخصص ولا بيعدّيه؟»**، وده
 * سؤال عن **اتجاه**، والاتجاه بيتقري من خطّ لا من كتلة.
 *
 * والخطّ بيمشي مع اتجاه القراءة: الأقدم يمين والأحدث شمال، زي
 * النصّ العربي بالظبط · فالعين بتقرا الزمن وهي ماشية طبيعي.
 *
 * ═══ التوهّج ═══
 *
 * التوهّج **نسخة مغبّشة من الخطّ نفسه تحته**، لا مساحة مملوءة تحت
 * الخطّ. الفرق مش تجميلي: المساحة المملوءة بتقول «المجموع تحت
 * المنحنى»، وده معنى ما ينفعش يتقال عن **سقف**. لما كان الاتنين
 * مساحتين، التداخل كان بيطلع كتلة رمادية متّسخة بتاكل نص الرسم.
 * النسخة المغبّشة بتخلّي التداخل **ضوءًا** لا طَمْيًا، والخطّ يفضل
 * هو الحدّ.
 *
 * ═══ الوقف مش نقطة على الخطّ ═══
 *
 * `CYCLES` فيها خمس دورات، بس مش خمس سنين: أربعة للمؤسسة
 * (٢٠٢٦…٢٠٢٣) وواحدة **للوقف** واقفة على ٢٠٢٣. لو وصّلناهم بخطّ
 * واحد، الرسم بيقول إن ٢٠٢٣-الوقف خطوة زمنية بعد ٢٠٢٣-المؤسسة
 * وإن المصروف نزل من ٨٤٧ ألف لصفر · وده **ما حصلش**؛ دول جهتان
 * في نفس السنة. فالخطّ للمؤسسة وحدها، والوقف سطر مستقل تحته.
 */

/** إحداثيات الرسم · الـviewBox قريب من المقاس الحقيقي فالسُمك يفضل طبيعيًّا */
const CH = { w: 680, h: 190, top: 26, bottom: 40, side: 34 }

/**
 * منحنى ناعم **بلا تجاوز** · مونوتون (Fritsch–Carlson).
 *
 * الكاردينال البسيط بيتجاوز بين نقطتين متباعدتين: من ٤٧M لـ١M
 * كان بينزل **تحت الصفر** قبل ما يطلع · يعني الرسم بيقول قيمة
 * سالبة ما حصلتش. المونوتون بيحسب الميل عند كل نقطة ويحدّه، فالخطّ
 * بيفضل بين قيمتَي النقطتين اللي هو واصل بينهم.
 *
 * وبيرجّع **دالة تقييم** كمان لا مسارًا بس · عشان منطقة التجاوز
 * تتحسب بالعيّنات لا بقناع SVG.
 */
const spline = (pts: { x: number; y: number }[]) => {
  const n = pts.length
  /* النقط بتيجي من اليمين للشمال (x بينقص)، والحساب عايزها صاعدة */
  const p = pts[0].x > pts[n - 1].x ? [...pts].reverse() : [...pts]
  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i] }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  /* حدّ الميل · شرط عدم التجاوز */
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b)
    if (h > 3) { t[i] = (3 / h) * a * m[i]; t[i + 1] = (3 / h) * b * m[i] }
  }

  let d = `M${p[0].x} ${p[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${(p[i].x + h).toFixed(2)} ${(p[i].y + t[i] * h).toFixed(2)}`
      + ` ${(p[i + 1].x - h).toFixed(2)} ${(p[i + 1].y - t[i + 1] * h).toFixed(2)}`
      + ` ${p[i + 1].x} ${p[i + 1].y.toFixed(2)}`
  }

  /** قيمة y عند أي x · هيرميت على القطعة اللي فيها x */
  const at = (x: number): number => {
    let i = 0
    while (i < n - 2 && x > p[i + 1].x) i++
    const h = dx[i], u = Math.min(1, Math.max(0, (x - p[i].x) / h)), u2 = u * u, u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * p[i].y + (u3 - 2 * u2 + u) * h * t[i]
      + (-2 * u3 + 3 * u2) * p[i + 1].y + (u3 - u2) * h * t[i + 1]
  }
  return { d, at }
}

export function YearSpend() {
  /* الأقدم أول الصفّ · وفي RTL أول الصفّ يمين، فالزمن بيمشي مع
     اتجاه القراءة.
     ودورة الوقف بتتشال من الخطّ: هي مش سنة تانية، هي جهة تانية في
     نفس السنة · تحت في سطرها. */
  const rows = [...CYCLES].filter((c) => !c.activeWaqf).reverse()
  const waqf = CYCLES.find((c) => c.activeWaqf)
  const max = Math.max(...rows.map((c) => Math.max(c.alloc, c.spent)), 1)
  const { w, h, top, bottom, side } = CH
  const plotH = h - top - bottom
  const stepX = (w - side * 2) / (rows.length - 1)
  /* أول نقطة على اليمين: المحور مقلوب يدويًّا لأن SVG مالوش اتجاه */
  const X = (i: number) => w - side - i * stepX
  const Y = (v: number) => top + plotH * (1 - v / max)

  const pAlloc = rows.map((c, i) => ({ x: X(i), y: Y(c.alloc) }))
  const pSpent = rows.map((c, i) => ({ x: X(i), y: Y(c.spent) }))

  const sAlloc = spline(pAlloc)
  const sSpent = spline(pSpent)
  const overYears = rows.filter((c) => c.spent > c.alloc).map((c) => c.label.split(' ')[0])

  /* منطقة التجاوز · **محسوبة بالعيّنات لا بقناع**.
     القناع بيطرح مساحة من مساحة، والنتيجة بتشمل كل اللي تحت
     الخطّين لا اللي بينهم. هنا بنقيس عند كل عيّنة: لو المصروف فوق
     المخصص (y أصغر) نبدأ مقطعًا ونقفله أول ما ينزل تحته · فاللي
     بيتلوّن هو **الفرق** بالظبط. */
  const SAMPLES = 160
  const x0 = Math.min(pAlloc[0].x, pAlloc[pAlloc.length - 1].x)
  const x1 = Math.max(pAlloc[0].x, pAlloc[pAlloc.length - 1].x)
  const overBands: string[] = []
  let run: { x: number; a: number; s: number }[] = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map((q) => `${q.x.toFixed(1)} ${q.s.toFixed(1)}`).join(' L')
      const bot = [...run].reverse().map((q) => `${q.x.toFixed(1)} ${q.a.toFixed(1)}`).join(' L')
      overBands.push(`M${top} L${bot} Z`)
    }
    run = []
  }
  for (let i = 0; i <= SAMPLES; i++) {
    const x = x0 + ((x1 - x0) * i) / SAMPLES
    const av = sAlloc.at(x), sv = sSpent.at(x)
    if (sv < av - 0.15) run.push({ x, a: av, s: sv })
    else flush()
  }
  flush()

  return (
    <Glass className="chy">
      <span className="chb-h">
        <span className="chb-t">المصاريف السنوية</span>
        {/* المفتاح بيرسم **اللي مرسوم**: خطّ متّصل وخطّ منقّط، لا
            مربّعين. المربّع بيقول «كتلة» والرسم فيه خطوط · والمنقّط
            في المفتاح هو المنقّط في الرسم. والتجاوز لون بيقول «فيه
            مشكلة»، فمكانه في المفتاح لا في الهامش وحده. */}
        <span className="chb-k">
          <span><i className="ln a" />المصروف</span>
          <span><i className="ln c" />المخصص</span>
          <span><i className="ov" />فوق السقف</span>
        </span>
      </span>

      <svg
        className="chy-svg"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`المصروف مقابل المخصص عبر ${rows.length} دورات`}
      >
        <defs>
          {/* التوهّج · تغبيش على نسخة من الخطّ نفسه. التداخل بين
              التوهّجين بيطلع ضوءًا مش طَمْيًا، والخطّ فوقه يفضل حادًّا */}
          <filter id="chyG" x="-8%" y="-30%" width="116%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>

        {/* خطوط الشبكة · تلاتة بس، والقيم على الطرف */}
        {[0, 0.5, 1].map((f) => (
          <line key={f} className="chy-grid"
            x1={side} x2={w - side} y1={top + plotH * f} y2={top + plotH * f} />
        ))}

        {/* **مساحة واحدة مملوءة في الرسم كله، ومعناها التجاوز.**
            كان تحت كل خطّ مساحة متدرّجة كمان، فبقى في تلات مساحات
            والعين ما بتعرفش أنهي واحدة اللي بتقول حاجة. التوهّج
            بيدّي الوزن، والمملوء الوحيد بيبقى هو الخبر.
            والحساب بالعيّنات: عند كل عيّنة لو المصروف فوق المخصص
            نفتح مقطعًا ونقفله أول ما ينزل · فاللي بيتلوّن هو الفرق. */}
        {overBands.map((d, i) => <path key={i} className="chy-over" d={d} />)}

        <g filter="url(#chyG)" aria-hidden="true">
          <path className="chy-glow c" d={sAlloc.d} />
          <path className="chy-glow a" d={sSpent.d} />
        </g>

        <path className="chy-line c" d={sAlloc.d} />
        <path className="chy-line a" d={sSpent.d} />

        {rows.map((c, i) => (
          <g key={c.id}>
            <circle className="chy-dot c" cx={X(i)} cy={Y(c.alloc)} r="3" />
            <circle className={`chy-dot a${c.spent > c.alloc ? ' over' : ''}`}
              cx={X(i)} cy={Y(c.spent)} r="4" />
            {/* الرقم رقم **المصروف**، فمكانه فوق نقطة المصروف لا فوق
                أعلى الخطّين · كان بيتحطّ فوق نقطة المخصص في ٢٠٢٦
                فيتقري كأنه قيمتها */}
            <text className="chy-val" x={X(i)} y={Math.max(12, Y(c.spent) - 11)}>
              {nf.format(Math.round(c.spent / 1_000_000))}M
            </text>
            {/* رقم المخصص بيتكتب **بس لما الخطّين يبعدوا** · لما
                يكونوا ملزوقين الرقمين بيتراكبوا والرقم التاني ما
                بيضيفش، والفرق نفسه هو الخبر لا القيمتين. عند ٢٠٢٦
                الفرق ٢٩ مليون فالسقف لازم يتقال. */}
            {Math.abs(Y(c.alloc) - Y(c.spent)) > 18 && (
              <text className="chy-val c" x={X(i)}
                y={Y(c.alloc) < Y(c.spent) ? Math.max(11, Y(c.alloc) - 9) : Y(c.alloc) + 16}>
                {nf.format(Math.round(c.alloc / 1_000_000))}M
              </text>
            )}
            <text className="chy-x" x={X(i)} y={h - 16}>{c.label.split(' · ')[0]}</text>
            <text className="chy-x2" x={X(i)} y={h - 4}>{c.label.split(' · ')[1]}</text>
          </g>
        ))}
      </svg>

      {/* الوقف · مش نقطة على الخطّ، فله سطره */}
      {waqf && (
        <span className="chy-side">
          <span className="chy-side-t">الوقف</span>
          <span className="chy-side-v">
            دورة <span className="num">{waqf.label.split(' · ')[0]}</span> · مخصص{' '}
            <Money sm>{waqf.alloc}</Money> · مصروف <Money sm>{waqf.spent}</Money>
          </span>
        </span>
      )}

      <p className="mut chb-n">
        المنطقة الملوّنة بين الخطّين معناها صرف فوق السقف، حصل في{' '}
        {overYears.map((y, i) => (
          <span key={y}>
            {i > 0 && ' و'}
            <span className="num">{y}</span>
          </span>
        ))}. والوقف خارج الخطّ لأنه جهة تانية في نفس السنة، لا سنة تالية.
      </p>
    </Glass>
  )
}

/* ═══════════════════ ٤ · خطة الإنجاز ═══════════════════ */

/**
 * «خطة الإنجاز» حقل في محرّر التخصيص (`num`) قيمته ١٠٠ لكل بند ·
 * إلا **الدعوة** و**الحج ورمضان**: صفر. يعني تسعة مليون ونص برّه
 * حساب الإنجاز الإستراتيجي بلا أي إشارة في الشاشة.
 *
 * ⚠️ الرسم ده بيعرض **الحقل المخزَّن**، مش نسبة الإنجاز المحسوبة
 * اللي النظام بيطلعها في `reports1_7` · ما قدرناش نقرا معادلتها.
 */
export function PlanCoverage({ nodes = fields2026 }: { nodes?: PlanNode[] }) {
  const total = nodes.reduce((s, n) => s + n.alloc, 0)
  const inPlan = nodes.filter((n) => n.plan > 0).reduce((s, n) => s + n.alloc, 0)
  const out = nodes.filter((n) => n.plan === 0)

  return (
    <Glass className="chb">
      <span className="chb-h">
        <span className="chb-t">خطة الإنجاز المعلَنة لكل مجال</span>
        <span className="chb-k">
          <span><i className="a" />ضمن الخطة</span>
          <span><i className="c" />خارجها</span>
        </span>
      </span>

      <div className="chb-rows">
        {[...nodes].sort((a, b) => b.alloc - a.alloc).map((n) => (
          <div className="chb-r" key={n.id}>
            <span className="chb-lb" title={n.label}>{n.label}</span>
            <span className="chb-tr" style={{ width: '100%' }}>
              <i
                className={n.plan > 0 ? 'a' : 'c'}
                style={{ width: `${Math.max(2, n.plan)}%` }}
                title={`${n.label} · خطة الإنجاز ${n.plan}%`}
              />
            </span>
            <span className="chb-v num">{n.plan}%</span>
          </div>
        ))}
      </div>

      <p className="mut chb-n">
        <b><Money sm>{total - inPlan}</Money></b> من <Money sm>{total}</Money> برّه
        حساب الإنجاز: {out.map((n) => n.label).join(' و')} خطة إنجازهم <span className="num">0</span>{' '}
        وباقي المجالات <span className="num">100</span>. مفيش إشارة لده في الشاشة.
      </p>
    </Glass>
  )
}
