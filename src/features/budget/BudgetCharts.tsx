import { Glass, Money, Num } from '@/components/ui'
import { CYCLES, plan2026, type PlanNode } from '@/data/budgetPlan'

/**
 * رسوم الميزانية — **الرسوم اللي في `reports1_1` و`reports1_5`، مرسومة
 * بالداتا الحقيقية**.
 *
 * قبل كده كانت مخططات فاضية بأعمدة عشوائية «بتقول شكل الرسم لا قيمه».
 * وده كان قرارًا غلط: الشاشة اللي بتقول «فيه رسم هنا» من غير ما ترسمه
 * ما بتفرقش عن سطر مكتوب، والعميل بيسأل — بحق — طب فين الرسم.
 *
 * ═══ الشكل اتغيّر عن النظام العامل عن قصد ═══
 *
 * «المصاريف السنوية حسب المجال» في النظام أعمدة **رأسية** على ٣٩ هدفًا،
 * فالأسماء العربية بتتكتب رأسية متداخلة وما تتقريش — الرقم موجود
 * والعرض بيمنعه. هنا أعمدة **أفقية**: الاسم بيتكتب أفقيًا زي ما يتقري،
 * والطول هو المقياس.
 *
 * ═══ الألوان ═══
 *
 * التلات طبقات مش فئات مستقلة — دي **أجزاء من كل**: المنصرف جزء من
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
 * رقم واحد — **مش رسمًا**.
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
      <span className="chq-s sub">
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

      <p className="sub chb-n">
        النظام العامل بيرسم ده أعمدةً رأسيةً على <Num>39</Num> هدفًا، فالأسماء
        بتطلع مقلوبة ومتداخلة. الأعمدة الأفقية بتخلّي الاسم يتقري والطول هو المقياس.
      </p>
    </Glass>
  )
}

/* ═══════════════════ ٣ · المصاريف السنوية ═══════════════════ */

/**
 * التغيّر عبر الزمن — خمس دورات بأسماء قصيرة، فالأعمدة الرأسية
 * تصحّ هنا: المحور فيه خمس علامات وأسماؤها بتتكتب أفقيًا تحتها.
 */
export function YearSpend() {
  const rows = [...CYCLES].reverse()
  const max = Math.max(...rows.map((c) => Math.max(c.alloc, c.spent)), 1)

  return (
    <Glass className="chy">
      <span className="chb-h">
        <span className="chb-t">المصاريف السنوية</span>
        <span className="chb-k">
          <span><i className="a" />المصروف</span>
          <span><i className="c" />المخصص</span>
        </span>
      </span>

      <div className="chy-plot">
        {rows.map((c) => {
          const over = c.spent > c.alloc
          return (
            <div className="chy-col" key={c.id}>
              <span className="chy-v num"><Money sm>{c.spent}</Money></span>
              <span className="chy-bars">
                <i className="c" style={{ height: `${(c.alloc / max) * 100}%` }} title={`${c.label} · المخصص`} />
                <i className={`a${over ? ' over' : ''}`} style={{ height: `${(c.spent / max) * 100}%` }} title={`${c.label} · المصروف`} />
              </span>
              <span className="chy-lb">{c.label.replace(' · ', '\n')}</span>
            </div>
          )
        })}
      </div>

      <p className="sub chb-n">
        عمود المصروف اللي بيعدّي عمود المخصص معناه صرف فوق السقف — حصل في
        <span className="num"> 2024</span> و<span className="num">2025</span>.
      </p>
    </Glass>
  )
}

/* ═══════════════════ ٤ · خطة الإنجاز ═══════════════════ */

/**
 * «خطة الإنجاز» حقل في محرّر التخصيص (`num`) قيمته ١٠٠ لكل بند —
 * إلا **الدعوة** و**الحج ورمضان**: صفر. يعني تسعة مليون ونص برّه
 * حساب الإنجاز الإستراتيجي بلا أي إشارة في الشاشة.
 *
 * ⚠️ الرسم ده بيعرض **الحقل المخزَّن**، مش نسبة الإنجاز المحسوبة
 * اللي النظام بيطلعها في `reports1_7` — ما قدرناش نقرا معادلتها.
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

      <p className="sub chb-n">
        <b><Money sm>{total - inPlan}</Money></b> من <Money sm>{total}</Money> برّه
        حساب الإنجاز: {out.map((n) => n.label).join(' و')} خطة إنجازهم <span className="num">0</span>{' '}
        وباقي المجالات <span className="num">100</span>. مفيش إشارة لده في الشاشة.
      </p>
    </Glass>
  )
}
