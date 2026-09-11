import { useEffect, useRef, useState, useMemo } from 'react'
import { Glass, Head, Icon, icons, Money, Num, Select, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { Segments } from '@/components/ui/filters'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import {
  CYCLES, PLAN_LEVELS, chain, childSum, cycleById, imbalances, leaves,
  nodeAt, parentCount, type Imbalance, type PlanNode,
} from '@/data/budgetPlan'
import { FieldSpend, PlanCoverage, SpendGauge, YearSpend } from './BudgetCharts'

/**
 * الميزانية.
 *
 * النظام العامل بيخزّن شجرة التخصيص في أربع شاشات متتالية، وكل شاشة
 * بتطبع **مجموع أبنائها** في آخر صف بينما **مخصص الأب مكتوب في
 * الشاشة اللي قبلها**. فالرقمان ما بيتقابلوش، ومحدش شاف إن عشرة بنود
 * من أربعتاشر ما بتتوازنش.
 *
 * فالموديول ده مبنيّ على قلب الترتيب:
 *
 *  · **فحص التوازن أول حاجة** · قبل الشجرة، لا بعدها. الرقم اللي
 *    بيغيّر قرارًا يتقال في أول سطر.
 *  · **الشجرة بمستوى واحد ومسار فتات** · التنقّل جوّه الشاشة، والأعمدة
 *    واحدة في كل المستويات (النظام بيقلّلها من ست لتلاتة في آخر مستوى).
 *  · **عمودان للعين لا لقاعدة البيانات** · «مجموع الأبناء» و«الفرق»
 *    جنب «المخصص»، فالخلل يبان في الصف نفسه.
 *  · **مبدّل بين التخصيص والاستهلاك** · نفس الشجرة، سؤالان.
 */
export default function BudgetPage() {
  const [cycleId, setCycleId] = useState(CYCLES[0].id)
  const [path, setPath] = useState<string[]>([])
  const [view, setView] = useState<'alloc' | 'use'>('alloc')

  const cycle = cycleById(cycleId)
  const root = cycle.tree

  const gaps = useMemo(() => (root ? imbalances(root) : []), [root])
  const parents = useMemo(() => (root ? parentCount(root) : 0), [root])
  const goals = useMemo(() => (root ? leaves(root) : []), [root])

  const here = root ? nodeAt(root, path) : undefined
  const rows = here?.children ?? []
  const crumb = root ? chain(root, path) : []

  /**
   * القفز من فحص التوازن للشجرة.
   *
   * الضغطة كانت **بتشتغل** فعلًا · المسار بيتغيّر والشجرة بتفتح على
   * البند · بس الشجرة تحت بـ٢١٤٢px، يعني شاشتين تحت اللي المستخدم
   * شايفه. فالنتيجة عنده: «دوست وما حصلش حاجة».
   *
   * فالقفزة بقت تنقل العين معاها: تمرير للشجرة ونبضة قصيرة على
   * السكشن عشان تقول «أهي، وصلت هنا».
   */
  const tree = useRef<HTMLDivElement>(null)
  const [landed, setLanded] = useState(0)

  const goTo = (p: string[], jump = false) => {
    setPath(p)
    if (jump) setLanded((n) => n + 1)
  }

  useEffect(() => {
    if (!landed) return
    const el = tree.current
    if (!el) return
    const soft = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.classList.add('land')
    /* التمرير بعد الرسم: عدد صفوف الشجرة بيتغيّر مع القفزة، ولو
       مرّرنا قبل ما الصفوف تتحسب بنقيس على ارتفاع قديم. */
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: soft ? 'smooth' : 'auto', block: 'start' })
      })
    })
    const id = setTimeout(() => el.classList.remove('land'), 1600)
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(id) }
  }, [landed])

  return (
    <AppLayout assistantContext={assistFor.page('الميزانية')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الميزانية</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                التخصيص على أربع مستويات، الدورة والمسار والمجال والهدف، ومعه ما استُهلك منه
              </p>
            </div>
            {/* مبدّل الدورة مش فلتر: الدورة **دايمًا** مختارة، فمفيش
                خيار «الكل» · `allowEmpty={false}`. كان `select`
                أصلية بحجّة إن `Select` العامّة بتضيف خيارًا فاضيًا؛
                دلوقتي القيد خاصية لا سبب لنمط تاني. */}
            <Select
              icon={icons.budget}
              value={cycleId}
              allowEmpty={false}
              options={CYCLES.map((c) => ({
                value: c.id,
                label: c.active ? `${c.label}، مفعَّلة` : c.label,
              }))}
              onChange={(v) => { if (v) { setCycleId(v); setPath([]) } }}
            />
          </header>

          <Summary cycle={cycle} goals={goals.length} />

          {root ? (
            <>
              <Balance gaps={gaps} parents={parents} onGo={(p) => goTo(p, true)} root={root} />

              <section className="rpsec">
                <Head title="الصورة الكاملة" meta="نفس رسوم النظام العامل، بالداتا الحقيقية" />
                <div className="chgrid">
                  <SpendGauge value={cycle.spent} of={cycle.alloc} />
                  <YearSpend />
                </div>
                <FieldSpend />
                <PlanCoverage />
              </section>

              <Tree
                sectionRef={tree}
                root={root}
                here={here}
                rows={rows}
                crumb={crumb}
                path={path}
                view={view}
                onView={setView}
                onGo={goTo}
                cycleLabel={cycle.label}
              />
            </>
          ) : (
            <Glass className="bgclosed">
              <Icon name={icons.lock} size={22} />
              <div>
                <b>الدورة دي مقفولة.</b>
                <p className="sub">
                  شجرة التخصيص الكاملة متاحة للدورة المفعَّلة فقط
                  (<span className="num">2026</span> · المؤسسة). للدورات السابقة عندنا
                  الإجماليات اللي فوق، وهي اللي النظام بيعرضها.
                </p>
              </div>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

/* ═══════════════════ شريط الدورة ═══════════════════ */

function Summary({ cycle, goals }: { cycle: ReturnType<typeof cycleById>; goals: number }) {
  const over = cycle.alloc - cycle.approved < 0
  const usePct = cycle.alloc ? Math.round((cycle.spent / cycle.alloc) * 100) : 0
  const commitPct = cycle.alloc ? Math.round((cycle.approved / cycle.alloc) * 100) : 0

  return (
    <Glass className="bgsum">
      <div className="bgsum-g">
        <Cell k="المخصص" v={cycle.alloc} />
        <Cell k="المعتمد" v={cycle.approved} tone={over ? 'no' : undefined} />
        <Cell k="المحجوز" v={cycle.reserved} />
        <Cell k="المنصرف" v={cycle.spent} />
        <Cell k="المتبقي" v={cycle.alloc - cycle.approved} tone={over ? 'no' : 'ok'} />
      </div>

      {/* شريط واحد بثلاث طبقات: المنصرف داخل المعتمد داخل المخصص.
          الطبقات مش أشرطة منفصلة عشان ما نجمعش رقمًا مرتين. */}
      <div className="bgbar" aria-hidden="true">
        <i className="commit" style={{ width: `${Math.min(100, commitPct)}%` }} />
        <i className="spend" style={{ width: `${Math.min(100, usePct)}%` }} />
      </div>
      <div className="bgbar-k mut">
        <span><b className="dot spend" /> منصرف <span className="num">{usePct}%</span></span>
        <span><b className="dot commit" /> معتمد <span className="num">{commitPct}%</span></span>
        {goals > 0 && <span><span className="num">{goals}</span> هدفًا في الشجرة</span>}
        {over && <Tag tone="no">المعتمد فوق المخصص</Tag>}
      </div>
    </Glass>
  )
}

function Cell({ k, v, tone }: { k: string; v: number; tone?: 'ok' | 'no' }) {
  return (
    <div className="bgsum-c">
      <span className="sub">{k}</span>
      <b className={tone === 'no' ? 'bad' : undefined}><Money sm>{v}</Money></b>
    </div>
  )
}

/* ═══════════════════ فحص التوازن ═══════════════════ */

/**
 * أول سكشن في الصفحة عن قصد.
 *
 * الرقم ده ما بيظهرش في النظام العامل أصلًا، وهو أول حاجة المدير
 * المالي هيسأل عنها. حطّه تحت الشجرة معناه إنه مش هيتشاف.
 */
/** الأول بيبان، والباقي بضغطة · حائط من إحدى عشرة صفًّا بنفس الشكل
    بيتحوّل لخلفية، وبيدفع الشجرة شاشتين تحت. */
const TOP = 5

function Balance({
  gaps, parents, onGo, root,
}: {
  gaps: Imbalance[]
  parents: number
  onGo: (p: string[]) => void
  root: PlanNode
}) {
  const [all, setAll] = useState(false)
  const shown = all ? gaps : gaps.slice(0, TOP)
  const total = gaps.reduce((s, x) => s + Math.abs(x.gap), 0)

  if (gaps.length === 0) {
    return (
      <Glass className="bgok">
        <Icon name={icons.check} size={18} />
        <span>الشجرة متوازنة، مجموع أبناء كل بند يساوي مخصصه.</span>
      </Glass>
    )
  }

  return (
    <section className="rpsec">
      <Head
        title="فحص التوازن"
        meta={`${gaps.length} من ${parents} بندًا لا يتوازن`}
      />

      <Glass className="bgchk">
        <p className="bgchk-l">
          مجموع ما خُصِّص للأبناء <b>لا يساوي</b> مخصص الأب في{' '}
          <b className="bad"><Num>{gaps.length}</Num></b> بندًا من <Num>{parents}</Num>،
          بفارق تراكمي <b className="bad"><Money sm>{total}</Money></b>.
        </p>
        <p className="mut bgchk-n">
          في النظام العامل مخصص الأب في شاشة ومجموع أبنائه في الشاشة اللي بعدها،
          فالرقمان ما بيتقابلوش. هنا بيتحسبوا على الشجرة كلها مرة واحدة.
        </p>

        <p className="mut bgchk-h">اضغط أي بند تنزل عليه في الشجرة تحت.</p>

        <ul className="bglist">
            {shown.map((x) => (
              <li key={x.path.join('/') || 'root'}>
                <button className="bglist-i" onClick={() => onGo(x.path)}>
                  <span className="bglist-lv sub">{PLAN_LEVELS[x.level]}</span>
                  <span className="bglist-t">{x.label || root.label}</span>
                  {/* التسمية بعرض ثابت والرقم بعدها · في RTL الرقم
                      بيمتدّ للشمال وحرفه الأخير ملزوق في التسمية،
                      فالخانات بتقع فوق بعضها والآحاد بتتراصّ. قبل
                      كده كان الاتنين نصًّا واحدًا بعرض متغيّر، فكل
                      صفّ بيبدأ في مكان مختلف والمقارنة بتتعب. */}
                  <span className="bglist-v mut">
                    <span className="sub">مخصص</span>
                    <Money sm>{x.alloc}</Money>
                  </span>
                  <span className="bglist-v mut">
                    <span className="sub">أبناؤه</span>
                    <Money sm>{x.childSum}</Money>
                  </span>
                  {/* نفس شارات النظام لا شارة جديدة: التونات متعايرة
                      مرة واحدة في `.tag`، وأي بديل هنا بيفتح ملفًا تانيًا
                      للفحص في التلات ثيمات. */}
                  <span className="bglist-g">
                    <Tag tone={x.gap > 0 ? 'no' : 'warn'}>
                      {x.gap > 0 ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(x.gap)}</Money>
                    </Tag>
                  </span>
                  <Icon name={icons.chevron} size={14} />
                </button>
              </li>
            ))}
        </ul>

        {gaps.length > TOP && (
          <button className="btn btn-2 btn-sm bgchk-t" onClick={() => setAll((x) => !x)}>
            <Icon name={all ? icons.chevronUp : icons.chevronDown} size={15} />
            {all ? 'أقصر قائمة' : `المزيد (${gaps.length - TOP})`}
          </button>
        )}
      </Glass>
    </section>
  )
}

/* ═══════════════════ الشجرة ═══════════════════ */

function Tree({
  sectionRef, root, here, rows, crumb, path, view, onView, onGo, cycleLabel,
}: {
  sectionRef: React.RefObject<HTMLDivElement | null>
  root: PlanNode
  here: PlanNode | undefined
  rows: PlanNode[]
  crumb: PlanNode[]
  path: string[]
  view: 'alloc' | 'use'
  onView: (v: 'alloc' | 'use') => void
  onGo: (p: string[]) => void
  cycleLabel: string
}) {
  const level = path.length
  const leaf = rows.length === 0

  const sheet: Sheet = useMemo(() => ({
    file: `abanumay-budget-${path.join('-') || 'root'}`,
    title: `الميزانية · ${[cycleLabel, ...crumb.map((c) => c.label)].join(' ← ')}`,
    headers: view === 'alloc'
      ? ['البند', 'المخصص', 'مجموع الأبناء', 'الفرق', 'خطة الإنجاز', 'المالك']
      : ['البند', 'المخصص', 'المحجوز', 'المنصرف', 'المتبقي', 'نسبة الاستهلاك'],
    rows: rows.map((n) => {
      if (view === 'alloc') {
        const sum = n.children?.length ? childSum(n) : 0
        return [
          n.label, String(n.alloc),
          n.children?.length ? String(sum) : '',
          n.children?.length ? String(sum - n.alloc) : '',
          `${n.plan}%`, n.owner ?? '',
        ]
      }
      const used = (n.reserved ?? 0) + (n.spent ?? 0)
      return [
        n.label, String(n.alloc), String(n.reserved ?? 0), String(n.spent ?? 0),
        String(n.alloc - used), n.alloc ? `${Math.round((used / n.alloc) * 100)}%` : '0%',
      ]
    }),
    totals: [
      'الإجمالي',
      String(rows.reduce((s, n) => s + n.alloc, 0)),
      ...(view === 'alloc'
        ? [String(rows.reduce((s, n) => s + (n.children?.length ? childSum(n) : 0), 0)), '', '', '']
        : [
          String(rows.reduce((s, n) => s + (n.reserved ?? 0), 0)),
          String(rows.reduce((s, n) => s + (n.spent ?? 0), 0)),
          '', '',
        ]),
    ],
  }), [rows, view, path, crumb, cycleLabel])

  return (
    <section className="rpsec bgtree" ref={sectionRef}>
      <Head
        title="شجرة التخصيص"
        meta={`المستوى ${level + 1} من 4 · ${PLAN_LEVELS[Math.min(level + 1, 3)]}`}
      />

      <div className="lrbc">
        <button className={`lrbc-i${level === 0 ? ' on' : ''}`} onClick={() => onGo([])}>
          {root.label}
        </button>
        {crumb.map((n, i) => (
          <span key={n.id} className="lrbc-s">
            <Icon name={icons.chevron} size={14} />
            <button
              className={`lrbc-i${i === crumb.length - 1 ? ' on' : ''}`}
              onClick={() => onGo(path.slice(0, i + 1))}
            >
              {n.label}
            </button>
          </span>
        ))}
      </div>

      {leaf ? (
        <Glass className="bgleaf">
          <div>
            <b>{here?.label}</b>
            <p className="sub">آخر مستوى في الشجرة، الهدف ما تحتهوش تقسيم.</p>
          </div>
          <div className="bgleaf-v">
            <span><span className="sub">المخصص</span> <Money sm>{here?.alloc ?? 0}</Money></span>
            <span><span className="sub">المحجوز</span> <Money sm>{here?.reserved ?? 0}</Money></span>
            <span><span className="sub">المنصرف</span> <Money sm>{here?.spent ?? 0}</Money></span>
          </div>
        </Glass>
      ) : (
        <>
          <div className="ftool-r">
            <div className="ftool-f">
              {/* مبدّل السؤال: «خصّصنا كام» ولا «استهلكنا كام».
                  كان ماركب مكتوبًا بالإيد هنا · نسخة تانية من نفس
                  الكمبوننت بارتفاع ٣٠ بدل ٣١، وما كانتش هتاخد أي
                  تحسين يحصل في الأصل. بقى `Segments` زي كل مكان. */}
              <Segments
                items={[{ key: 'alloc', label: 'التخصيص' }, { key: 'use', label: 'الاستهلاك' }]}
                active={view}
                onChange={(k) => onView((k ?? 'alloc') as typeof view)}
              />
              <span className="sub"><span className="num">{rows.length}</span> بندًا</span>
            </div>
            <div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div>
          </div>

          <Glass className="tblcard">
            <div className="tblwrap">
              <div className="tblock">
                {view === 'alloc'
                  ? <AllocTable rows={rows} path={path} onGo={onGo} parent={here} />
                  : <UseTable rows={rows} path={path} onGo={onGo} />}
              </div>
            </div>
          </Glass>
        </>
      )}
    </section>
  )
}

/**
 * قاع الجدول بيقارن **مجموع الأبناء بمخصص الأب**.
 *
 * لما تقفز هنا من فحص التوازن، الجدول بيعرض أبناء البند · ومخصص
 * البند نفسه في المستوى اللي فوق، يعني برّه الشاشة. فالفرق اللي
 * جيت عشانه ما بيبانش عند وصولك. القاع دلوقتي بيحطّ الرقمين تحت
 * بعض ويحسب الفرق، فالسبب موجود في نقطة الهبوط.
 */
function AllocTable({
  rows, path, onGo, parent,
}: { rows: PlanNode[]; path: string[]; onGo: (p: string[]) => void; parent?: PlanNode }) {
  const total = rows.reduce((s, n) => s + n.alloc, 0)
  const gap = parent ? total - parent.alloc : 0
  return (
    <table className="tbl">
      <colgroup>
        <col style={{ width: 260 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 130 }} />
      </colgroup>
      <thead>
        <tr>
          <th>البند</th>
          <th className="n">المخصص</th>
          <th className="n">مجموع الأبناء</th>
          <th className="n">الفرق</th>
          <th className="n">خطة الإنجاز</th>
          <th>المالك</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => {
          const kids = n.children?.length ?? 0
          const sum = kids ? childSum(n) : null
          const gap = sum === null ? 0 : sum - n.alloc
          return (
            <tr
              key={n.id}
              className={kids ? 'clk' : undefined}
              onClick={() => kids && onGo([...path, n.id])}
            >
              <td title={n.label}>
                {kids ? <Icon name={icons.chevron} size={13} /> : null}{' '}{n.label}
              </td>
              <td className="n num">
                {n.alloc === 0 ? <Tag tone="warn">بلا مخصص</Tag> : <Money sm>{n.alloc}</Money>}
              </td>
              <td className="n num">{sum === null ? <span className="sub"> </span> : <Money sm>{sum}</Money>}</td>
              <td className={`n num${gap !== 0 ? ' bad' : ''}`}>
                {sum === null ? <span className="sub"> </span>
                  : gap === 0 ? <Tag tone="ok">متوازن</Tag>
                  : <>{gap > 0 ? '+' : '−'}<Money sm>{Math.abs(gap)}</Money></>}
              </td>
              <td className="n num">
                {n.plan === 0 ? <Tag tone="warn">خارج الخطة</Tag> : `${n.plan}%`}
              </td>
              <td title={n.owner ?? ''}>{n.owner ?? <span className="sub"> </span>}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>مجموع الأبناء</td>
          <td className="n num"><Money sm>{total}</Money></td>
          <td className="n num mut">مخصص {parent?.label ?? 'الإجمالي'}</td>
          <td className="n num"><Money sm>{parent?.alloc ?? 0}</Money></td>
          <td className="n" colSpan={2}>
            {parent && (gap === 0
              ? <Tag tone="ok">متوازن</Tag>
              : <Tag tone={gap > 0 ? 'no' : 'warn'}>
                  {gap > 0 ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(gap)}</Money>
                </Tag>)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function UseTable({ rows, path, onGo }: { rows: PlanNode[]; path: string[]; onGo: (p: string[]) => void }) {
  return (
    <table className="tbl">
      <colgroup>
        <col style={{ width: 260 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 130 }} />
        <col style={{ width: 150 }} />
      </colgroup>
      <thead>
        <tr>
          <th>البند</th>
          <th className="n">المخصص</th>
          <th className="n">المحجوز</th>
          <th className="n">المنصرف</th>
          <th className="n">المتبقي</th>
          <th>نسبة الاستهلاك</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((n) => {
          const kids = n.children?.length ?? 0
          const used = (n.reserved ?? 0) + (n.spent ?? 0)
          const left = n.alloc - used
          const pct = n.alloc ? Math.round((used / n.alloc) * 100) : 0
          const tight = n.alloc > 0 && pct >= 95
          return (
            <tr
              key={n.id}
              className={kids ? 'clk' : undefined}
              onClick={() => kids && onGo([...path, n.id])}
            >
              <td title={n.label}>
                {kids ? <Icon name={icons.chevron} size={13} /> : null}{' '}{n.label}
              </td>
              <td className="n num"><Money sm>{n.alloc}</Money></td>
              <td className="n num"><Money sm>{n.reserved ?? 0}</Money></td>
              <td className="n num"><Money sm>{n.spent ?? 0}</Money></td>
              <td className={`n num${left < 0 ? ' bad' : ''}`}><Money sm>{left}</Money></td>
              <td>
                <span className="bgpct">
                  <span className="bgpct-t">
                    <i className={tight ? 'no' : pct >= 80 ? 'warn' : 'ok'}
                      style={{ width: `${Math.min(100, Math.max(1, pct))}%` }} />
                  </span>
                  <b className="num">{pct}%</b>
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr>
          <td>الإجمالي</td>
          <td className="n num"><Money sm>{rows.reduce((s, n) => s + n.alloc, 0)}</Money></td>
          <td className="n num"><Money sm>{rows.reduce((s, n) => s + (n.reserved ?? 0), 0)}</Money></td>
          <td className="n num"><Money sm>{rows.reduce((s, n) => s + (n.spent ?? 0), 0)}</Money></td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  )
}
