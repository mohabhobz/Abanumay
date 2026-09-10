import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Glass, Icon, icons, Num, SearchBox, Segments, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { LIVE_SPECS, catalogTotals, type LiveSpec } from '@/data/liveReports'

/**
 * كتالوج التقارير — **كل شاشة في النظام العامل، بكل اللي فيها**.
 *
 * الطلب كان: «مينفعش نشتغل على حاجة والمعلومات فيها ناقصة». فده
 * المكان اللي بيثبت إن مفيش حاجة ناقصة: الـ١٣ شاشة كلهم هنا، وكل
 * واحدة بتتفتح على أعمدتها الحقيقية وفلاترها ورسومها وصفوف بشكلها.
 *
 * والترتيب مقصود: الشاشة الشغّالة الأول، وبعدها اللي فورم بلا نتيجة،
 * وآخر حاجة الفاضية. عشان اللي بيتفرّج يشوف الحيّ قبل الميت.
 */

type Filter = 'all' | 'live' | 'form' | 'empty'

const stateOf = (s: LiveSpec): Exclude<Filter, 'all'> =>
  s.flaw ? 'empty' : s.rowsLive === null ? 'form' : 'live'

const STATE_TAG: Record<Exclude<Filter, 'all'>, { label: string; tone: 'ok' | 'warn' | 'no' }> = {
  live: { label: 'جدول جاهز', tone: 'ok' },
  form: { label: 'فورم قبل النتيجة', tone: 'warn' },
  empty: { label: 'فاضية في النظام', tone: 'no' },
}

const ORDER: Record<string, number> = { live: 0, form: 1, empty: 2 }

export function Catalog() {
  const [q, setQ] = useState('')
  const [state, setState] = useState<Filter>('all')

  const list = useMemo(() => {
    const t = q.trim()
    return LIVE_SPECS
      .filter((s) => state === 'all' || stateOf(s) === state)
      .filter((s) => !t || s.title.includes(t) || s.path.includes(t) ||
        s.question.includes(t) || s.cols.some((c) => c.label.includes(t)))
      .sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || (b.rowsLive ?? 0) - (a.rowsLive ?? 0))
  }, [q, state])

  return (
    <>
      {/* الرقم اللي بيلخّص الموديول كله — بيتحسب من الكتالوج لا مكتوبًا */}
      <Glass className="catsum">
        <div className="catsum-g">
          <Stat n={catalogTotals.screens} k="شاشة تقرير" />
          <Stat n={catalogTotals.cols} k="عمودًا موصوفًا" />
          <Stat n={catalogTotals.filters} k="فلترًا" />
          <Stat n={catalogTotals.charts} k="رسمًا" />
          <Stat n={catalogTotals.rows} k="صفًّا في الشاشات" big />
        </div>
        <p className="mut rpsec-n" style={{ marginTop: '.7rem' }}>
          كل شاشة تقرير في النظام العامل موصوفة هنا بالكامل: أعمدتها بأسمائها،
          وفلاترها بعدد خياراتها، ورسومها، ومستويات التعمّق لو فيها. اضغط أي
          شاشة تشوف جدولها بأعمدته الحقيقية — <b>القيم في الصفوف تجريبية</b>،
          والأعمدة والفلاتر منقولة كما هي.
        </p>
      </Glass>

      <div className="ftool-r">
        <div className="ftool-f">
          <SearchBox value={q} onChange={setQ} placeholder="ابحث باسم التقرير أو عمود فيه…" />
          <Segments
            active={state === 'all' ? undefined : state}
            onChange={(v) => setState((v as Filter) ?? 'all')}
            items={[
              { key: 'live', label: 'جداول جاهزة', count: LIVE_SPECS.filter((s) => stateOf(s) === 'live').length },
              { key: 'form', label: 'فورم قبل النتيجة', count: LIVE_SPECS.filter((s) => stateOf(s) === 'form').length },
              { key: 'empty', label: 'فاضية', count: catalogTotals.broken },
            ]}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <Glass><Empty title="لا شاشة بهذا الوصف." note="جرّب اسمًا آخر أو امسح البحث." /></Glass>
      ) : (
        <div className="catg">
          {list.map((s) => <Card key={s.key} s={s} />)}
        </div>
      )}
    </>
  )
}

function Stat({ n, k, big }: { n: number; k: string; big?: boolean }) {
  return (
    <div className={`catsum-s${big ? ' big' : ''}`}>
      <b className="num">{nf.format(n)}</b>
      <span className="sub">{k}</span>
    </div>
  )
}

function Card({ s }: { s: LiveSpec }) {
  const st = stateOf(s)
  const tag = STATE_TAG[st]

  return (
    <Link to={ROUTES.liveReport(s.key)} className="catc glass">
      <span className="catc-h">
        <span className="catc-i"><Icon path={icons[s.icon]} size={17} /></span>
        <span className="catc-t">{s.title}</span>
        <Tag tone={tag.tone}>{tag.label}</Tag>
      </span>

      <code className="mono catc-p">control/{s.path}</code>

      <p className="catc-q">{s.question}</p>
      <p className="catc-w mut">{s.what}</p>

      {/* العدّادات هي اللي بتقول «الشاشة دي فيها إيه» في نظرة */}
      <span className="catc-n">
        <b><Num>{s.cols.length}</Num> عمودًا</b>
        {s.filters.length > 0 && <b><Num>{s.filters.length}</Num> فلترًا</b>}
        {s.charts.length > 0 && <b><Num>{s.charts.length}</Num> رسمًا</b>}
        {s.drill && <b><Num>{s.drill.length}</Num> مستويات</b>}
        {s.rowsLive !== null && (
          <span className="sub"><Num>{s.rowsLive}</Num> صفًّا في النظام</span>
        )}
      </span>

      {s.finding && <span className="catc-f">{s.finding}</span>}
    </Link>
  )
}
