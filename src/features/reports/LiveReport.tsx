import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Empty, Glass, Head, Icon, icons, Mono, Money, Num, Tag,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import { LIVE_SPECS, specByKey, type LiveCol, type LiveSpec } from '@/data/liveReports'
import { budgetTree, liveRows, type BudgetNode, type LiveRow } from '@/data/mock/liveRows'
import { CYCLES } from '@/data/budgetPlan'
import { FieldSpend, PlanCoverage, SpendGauge, YearSpend } from '@/features/budget/BudgetCharts'

/**
 * شاشة تقرير واحد من الكتالوج.
 *
 * الصفحة دي **بتوصف الشاشة الحقيقية وبتشغّلها في نفس الوقت**:
 *
 *  · فوق: السؤال اللي بتجاوب عليه، ومسارها في النظام، وعدد صفوفها هناك.
 *  · بعده: الفلاتر زي ما هي — بعدد خياراتها الحقيقي مكتوبًا على كل واحد،
 *    لأن «٩٧ خيارًا في قائمة واحدة» هي المشكلة نفسها ولازم تتشاف.
 *  · وبعده: الجدول بأعمدته الحقيقية وصفوف بشكلها.
 *  · والميزانية استثناء: شجرة بأربع مستويات بدل جدول واحد.
 *
 * وأي ملاحظة لقيناها في الشاشة الحقيقية مكتوبة في مكانها، مش مخبّاية
 * في مستند جنب — العميل بيفتح الشاشة فيلاقي اللي إحنا شفناه.
 */
export default function LiveReport() {
  const { key = '' } = useParams<{ key: string }>()
  const spec = specByKey(key)

  if (!spec) {
    return (
      <AppLayout assistantContext={assistFor.page('التقارير')}>
        <div className="viewstack"><div className="screen col">
          <Glass>
            <Empty
              title="شاشة غير معروفة."
              note="ارجع للكتالوج واختر تقريرًا منه."
              actions={<Link className="btn btn-2" to={ROUTES.reportTab('catalog')}>كتالوج التقارير</Link>}
            />
          </Glass>
        </div></div>
      </AppLayout>
    )
  }

  return (
    <AppLayout assistantContext={assistFor.page(spec.title)}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <Link to={ROUTES.reports} className="lb">التقارير</Link>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <Link to={ROUTES.reportTab('catalog')} className="lb">الكتالوج</Link>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="now">{spec.title}</span>
          </nav>

          <header>
            <div>
              <h1 className="ptitle">{spec.title}</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <code className="mono">control/{spec.path}</code>
                {spec.rowsLive !== null && (
                  <> · <span className="num">{nf.format(spec.rowsLive)}</span> صفًّا في النظام العامل</>
                )}
                {spec.flaw && <> · <Tag tone="no">{spec.flaw}</Tag></>}
              </p>
            </div>
          </header>

          <Glass className="lrq">
            <p className="lrq-q">{spec.question !== '—' ? spec.question : spec.what}</p>
            {spec.question !== '—' && <p className="mut lrq-w">{spec.what}</p>}
          </Glass>

          {spec.finding && (
            <Glass className="lrfind">
              <span className="badge badge-30"><Icon path={icons.insight} size={16} /></span>
              <p>{spec.finding}</p>
            </Glass>
          )}

          {spec.filters.length > 0 && <Filters spec={spec} />}

          {spec.charts.length > 0 && <Charts spec={spec} />}

          {spec.key === 'budget' ? <BudgetTree /> : <Rows spec={spec} />}

          <Nav spec={spec} />
        </div>
      </div>
    </AppLayout>
  )
}

/* ═══════════════════ الفلاتر ═══════════════════ */

/**
 * الفلاتر معروضة **بعدد خياراتها**.
 *
 * ده مش تزويقًا: «الهدف — ٩٧ خيارًا» في قائمة منسدلة واحدة بلا بحث
 * هي أكبر مشكلة في شاشات النظام، والرقم لازم يبان جنب الفلتر عشان
 * العميل يشوف السبب لا الشكوى.
 */
function Filters({ spec }: { spec: LiveSpec }) {
  const heavy = spec.filters.filter((f) => (f.count ?? 0) >= 20).length
  return (
    <section className="rpsec">
      <Head
        title="فلاتر الشاشة في النظام"
        meta={`${spec.filters.length} فلترًا${heavy ? ` · ${heavy} منها قائمة طويلة` : ''}`}
      />
      <div className="lrf">
        {spec.filters.map((f) => (
          <span key={f.label} className={`lrf-i${(f.count ?? 0) >= 50 ? ' long' : ''}`}>
            <Icon
              path={f.kind === 'date' ? icons.clock : f.kind === 'text' ? icons.search : icons.filter}
              size={14}
            />
            <b>{f.label}</b>
            {f.count !== undefined && (
              <span className="sub"><span className="num">{f.count}</span> خيارًا</span>
            )}
            {f.kind === 'date' && <span className="sub">تاريخ</span>}
            {f.kind === 'text' && <span className="sub">بحث نصّي</span>}
          </span>
        ))}
      </div>
      {heavy > 0 && (
        <p className="mut rpsec-n">
          القوائم الطويلة معلّمة: في النظام العامل هي <b>منسدلة بلا بحث</b>، فاللي
          بيدوّر على هدف بعينه بيقلّب 97 سطرًا بالإيد. عندنا نفس الفلتر ببحث داخله.
        </p>
      )}
    </section>
  )
}

/* ═══════════════════ الرسوم ═══════════════════ */

function Charts({ spec }: { spec: LiveSpec }) {
  return (
    <section className="rpsec">
      <Head title="رسوم الشاشة" meta={`${spec.charts.length} رسمًا في النظام`} />
      {spec.charts.map((c) => (
        <RealChart key={c.title} title={c.title} />
      ))}
    </section>
  )
}

/**
 * الرسوم مرسومة بالداتا الحقيقية، لا مخططات فاضية.
 *
 * أول نسخة كانت بترسم أعمدة عشوائية «بتقول شكل الرسم لا قيمه» — وده
 * كان قرارًا غلط: شاشة بتقول «فيه رسم هنا» من غير ما ترسمه ما بتفرقش
 * عن سطر مكتوب. الرسوم التلاتة في `reports1_1` والأربعة في `reports1_5`
 * كلها بتتغذّى من نفس شجرة التخصيص، فكلها اترسمت.
 */
function RealChart({ title }: { title: string }) {
  const c2026 = CYCLES[0]
  if (title.includes('نسبة المصروف')) {
    return <SpendGauge title={title} value={c2026.spent} of={c2026.alloc} />
  }
  if (title.includes('حسب المجال') && title.includes('المصاريف')) return <FieldSpend />
  if (title === 'المصاريف السنوية') return <YearSpend />
  if (title.includes('الإنجاز')) return <PlanCoverage />
  return null
}

/* ═══════════════════ الجدول ═══════════════════ */

function cellOf(v: string | number | undefined, c: LiveCol) {
  if (v === undefined || v === '') return <span className="sub">—</span>
  if (c.kind === 'money' && typeof v === 'number') return <Money>{v}</Money>
  if (c.kind === 'num' && typeof v === 'number') return <Num>{v}</Num>
  if (c.kind === 'id') return <Mono>{String(v)}</Mono>
  if (c.kind === 'date') return <Mono>{String(v)}</Mono>
  if (c.kind === 'pct') return <span className="num">{String(v)}</span>
  if (c.kind === 'file') return <span className="lrfile"><Icon path={icons.clip} size={13} />{String(v)}</span>
  if (c.kind === 'link') return <span className="lnk">{String(v)}</span>
  return String(v)
}

function Rows({ spec }: { spec: LiveSpec }) {
  const rows = useMemo(() => liveRows(spec, 24), [spec])

  if (spec.cols.length === 0) {
    return (
      <Glass>
        <Empty
          title="الشاشة دي فاضية في النظام العامل."
          note="اتفتحت وما فيهاش جدول ولا فلاتر ولا رسوم — اسمها في القائمة وبس. مكتوبة هنا عشان الجرد يفضل كاملًا، ولأنها بند في قائمة المطالب للباك اند."
        />
      </Glass>
    )
  }

  const sheet: Sheet = {
    file: `abanumay-${spec.path}`,
    title: spec.title,
    headers: spec.cols.map((c) => c.label),
    rows: rows.map((r) => spec.cols.map((c) => String(r[c.key] ?? ''))),
  }

  const only = spec.cols.filter((c) => c.only)

  return (
    <section className="rpsec">
      <Head
        title="الجدول بأعمدته"
        meta={`${spec.cols.length} عمودًا · عيّنة ${rows.length} صفًّا`}
      />

      {only.length > 0 && (
        <p className="mut rpsec-n">
          الأعمدة المعلّمة <b>ما فيش زيها في أي شاشة تانية</b>:{' '}
          {only.map((c) => c.label).join(' · ')}. يعني الرقم ده موجود في مكان
          واحد بس في النظام كله.
        </p>
      )}

      <div className="ftool-r">
        <div className="ftool-f">
          <span className="sub">
            القيم تجريبية · الأعمدة منقولة من <code className="mono">control/{spec.path}</code>
          </span>
        </div>
        <div className="ftool-a"><ExportMenu sheet={sheet} note={`${spec.title} · عيّنة ${rows.length} صفًّا`} /></div>
      </div>

      <Glass className="tblcard">
        <div className="tblwrap">
          <div className="tblock">
            <table className="tbl">
              <colgroup>
                {spec.cols.map((c) => <col key={c.key} style={{ width: c.w ?? 130 }} />)}
              </colgroup>
              <thead>
                <tr>
                  {spec.cols.map((c) => (
                    <th key={c.key} className={c.kind === 'num' || c.kind === 'money' || c.kind === 'pct' ? 'n' : undefined}>
                      {/* نفس غلاف `DataTable`: من غيره عنوان العمود
                          الطويل بيتقصّ بلا نقط — «مدة التنفيذ الفعلي»
                          كانت بتتقطع في نص الكلمة. */}
                      <span className="th-t">{c.label}</span>
                      {c.only && <span className="lronly" title="عمود لا مثيل له في شاشة أخرى">•</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => <Row key={i} r={r} cols={spec.cols} />)}
              </tbody>
            </table>
          </div>
        </div>
      </Glass>
    </section>
  )
}

function Row({ r, cols }: { r: LiveRow; cols: LiveCol[] }) {
  return (
    <tr>
      {cols.map((c) => (
        <td
          key={c.key}
          className={c.kind === 'num' || c.kind === 'money' || c.kind === 'pct' ? 'n num' : undefined}
          title={String(r[c.key] ?? '')}
        >
          {cellOf(r[c.key], c)}
        </td>
      ))}
    </tr>
  )
}

/* ═══════════════════ شجرة الميزانية ═══════════════════ */

/**
 * الميزانية شجرة لا جدول.
 *
 * النظام العامل بيعمل الشجرة دي بأربع صفحات متتالية: تضغط «عرض»
 * فتروح لصفحة تانية، وترجع بزرار المتصفح. وأول ما تنزل للمستوى
 * الرابع الأعمدة بتقلّ من ست لتلاتة من غير سبب.
 *
 * هنا مستوى واحد بمسار فتات فوقه: التنقّل جوّه نفس الشاشة، والأعمدة
 * واحدة في كل المستويات.
 */
function BudgetTree() {
  const [path, setPath] = useState<BudgetNode[]>([])
  const list = path.length === 0 ? budgetTree : (path[path.length - 1].children ?? [])
  const leaf = list.length === 0

  const rows = leaf ? [] : list
  const sheet: Sheet = {
    file: `abanumay-budget-${path.map((n) => n.id).join('-') || 'root'}`,
    title: `الميزانية · ${path.map((n) => n.label).join(' ← ') || 'كل الدورات'}`,
    headers: ['البند', 'الميزانية', 'المعتمد', 'المحجوز', 'المنصرف', 'المتبقي', 'نسبة المتبقي'],
    rows: rows.map((n) => [
      n.label, String(n.budget), String(n.approved), String(n.reserved),
      String(n.spent), String(n.left), `${n.leftPct}%`,
    ]),
    totals: rows.length > 1 ? [
      'الإجمالي',
      String(rows.reduce((s, n) => s + n.budget, 0)),
      String(rows.reduce((s, n) => s + n.approved, 0)),
      String(rows.reduce((s, n) => s + n.reserved, 0)),
      String(rows.reduce((s, n) => s + n.spent, 0)),
      String(rows.reduce((s, n) => s + n.left, 0)),
      '',
    ] : undefined,
  }

  const LEVELS = ['السنة × مصدر التمويل', 'المسار', 'المجال', 'الهدف']

  return (
    <section className="rpsec">
      <Head
        title="شجرة الميزانية"
        meta={`المستوى ${path.length + 1} من 4 · ${LEVELS[Math.min(path.length, 3)]}`}
      />

      {/* مسار الفتات: التنقّل جوّه الشاشة لا بصفحات متتالية */}
      <div className="lrbc">
        <button className={`lrbc-i${path.length === 0 ? ' on' : ''}`} onClick={() => setPath([])}>
          كل الدورات
        </button>
        {path.map((n, i) => (
          <span key={n.id} className="lrbc-s">
            <Icon path={icons.chevron} size={14} />
            <button
              className={`lrbc-i${i === path.length - 1 ? ' on' : ''}`}
              onClick={() => setPath(path.slice(0, i + 1))}
            >
              {n.label}
            </button>
          </span>
        ))}
      </div>

      {leaf ? (
        <Glass><Empty title="آخر مستوى في الشجرة." note="الهدف ما تحتهوش تقسيم — ارجع لمستوى أعلى من المسار فوق." /></Glass>
      ) : (
        <>
          <div className="ftool-r">
            <div className="ftool-f">
              <span className="sub">
                <span className="num">{rows.length}</span> بندًا ·{' '}
                الإجماليات محسوبة من الدورات الخمس الحقيقية
              </span>
            </div>
            <div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div>
          </div>

          <Glass className="tblcard">
            <div className="tblwrap">
              <div className="tblock">
                <table className="tbl">
                  <colgroup>
                    <col style={{ width: 240 }} />
                    {Array.from({ length: 5 }, (_, i) => <col key={i} style={{ width: 130 }} />)}
                    <col style={{ width: 110 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>البند</th>
                      <th className="n">الميزانية</th>
                      <th className="n">المعتمد</th>
                      <th className="n">المحجوز</th>
                      <th className="n">المنصرف</th>
                      <th className="n">المتبقي</th>
                      <th className="n">نسبة المتبقي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((n) => {
                      const over = n.left < 0
                      const tight = !over && n.leftPct > 0 && n.leftPct < 5
                      return (
                        <tr
                          key={n.id}
                          className={n.children?.length ? 'clk' : undefined}
                          onClick={() => n.children?.length && setPath([...path, n])}
                        >
                          <td title={n.label}>
                            {n.children?.length ? <Icon path={icons.chevron} size={13} /> : null}
                            {' '}{n.label}
                          </td>
                          <td className="n num"><Money sm>{n.budget}</Money></td>
                          <td className="n num"><Money sm>{n.approved}</Money></td>
                          <td className="n num"><Money sm>{n.reserved}</Money></td>
                          <td className="n num"><Money sm>{n.spent}</Money></td>
                          <td className={`n num${over ? ' bad' : ''}`}><Money sm>{n.left}</Money></td>
                          <td className="n num">
                            {over ? <Tag tone="no">فوق السقف</Tag>
                              : tight ? <Tag tone="warn">{n.leftPct}%</Tag>
                              : `${n.leftPct}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Glass>

          <p className="mut rpsec-n">
            <b>المتبقي = الميزانية − المعتمد.</b> الصف اللي بالسالب معناه اعتماد فوق
            السقف: حصل فعلًا في <span className="num">2024</span> و
            <span className="num">2025</span>. والنظام العامل بيعرض الرقم ده في خلية
            جدول عادية بلا أي تنبيه، ومفيش شاشة بتقول لمدير المنح إنه بيعدّي السقف
            <b> وقت</b> الاعتماد.
          </p>
        </>
      )}
    </section>
  )
}

/* ═══════════════════ التالي والسابق ═══════════════════ */

function Nav({ spec }: { spec: LiveSpec }) {
  const i = LIVE_SPECS.findIndex((s) => s.key === spec.key)
  const prev = LIVE_SPECS[i - 1]
  const next = LIVE_SPECS[i + 1]
  return (
    <nav className="lrnav">
      {prev ? (
        <Link to={ROUTES.liveReport(prev.key)} className="btn btn-2 btn-sm">
          <Icon path={icons.chevronBack} size={15} />
          {prev.title}
        </Link>
      ) : <span />}
      <Link to={ROUTES.reportTab('catalog')} className="btn btn-2 btn-sm">كل الشاشات</Link>
      {next ? (
        <Link to={ROUTES.liveReport(next.key)} className="btn btn-2 btn-sm">
          {next.title}
          <Icon path={icons.chevron} size={15} />
        </Link>
      ) : <span />}
    </nav>
  )
}
