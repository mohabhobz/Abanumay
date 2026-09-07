import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, Pager, SearchBox, Segments, Select, Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { assistFor } from '@/data/mock/assistant'
import { fixtures, query, type ProjectQuery, type ProjectSort } from '@/data/repository'
import { assignOwner } from '@/data/mock/projects'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, GRANT_METHODS, OWNERS,
  REGIONS, STAGES, STATUS_GROUPS, SUPPORT_STATUS, TAGS, TRACKS, YEARS,
} from '@/data/mock/taxonomy'
import { ProjectCard } from './ProjectCard'
import { ProjectsTable } from './ProjectsTable'

/* المفاتيح دي هي عقد الـURL: أي فلتر في الشاشة له مفتاح هنا،
   ونفس الاسم هيتبعت للسيرفر كـquery string وقت الربط. */
const KEYS = [
  'q', 'status', 'stage', 'year', 'track', 'field', 'goal', 'region', 'city',
  'tag', 'method', 'support', 'owner', 'unowned', 'overdue', 'shared', 'impact',
  'sort', 'page', 'view', 'adv',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = 12

/* البحث والحالة والتبديلات الظاهرة ليها مكانها فوق، فما تتحسبش في
   عدّاد «الفلاتر المتقدمة» — العدّاد بيقول اللي مخفي بس. */
const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'view', 'adv', 'status', 'unowned', 'overdue',
]

/** اللقطات المحفوظة — الأسئلة اللي المشرف بيسألها كل يوم */
const VIEWS: { key: string; label: string; patch: Partial<Params> }[] = [
  { key: 'all', label: 'كل المشاريع', patch: {} },
  { key: 'mine', label: 'ما ينتظر قراري', patch: { owner: 'عمر قاسم', status: 'في الدراسة' } },
  { key: 'overdue', label: 'متأخر عن الحد', patch: { overdue: '1' } },
  { key: 'unowned', label: 'بلا مالك', patch: { unowned: '1' } },
]

const SORTS: { key: ProjectSort; label: string }[] = [
  { key: 'waiting', label: 'الأطول انتظارًا' },
  { key: 'newest', label: 'الأحدث تقديمًا' },
  { key: 'amount', label: 'الأكبر مبلغًا' },
  { key: 'weight', label: 'الأعلى وزنًا' },
  { key: 'name', label: 'الاسم' },
]

/**
 * كل المشاريع.
 *
 * النظام الحالي بيرمي ٤٬٩٢٩ صفًّا في جدول واحد بـ٦٢ عمودًا و١٤ فلترًا
 * مفرودة فوق بعض. الشاشة دي بتقلب الترتيب: اللقطات المحفوظة أولًا
 * (اللي بينتظر قرارك · المتأخر · بلا مالك)، وبعدها الحالة كشرائح
 * بعدّادها، والفلاتر الباقية مطوية ومعاها عدّاد. والحالة المعروضة هي
 * القسم الإجرائي الفعلي مش المجموعة الخماسية.
 */
export default function ProjectsListPage() {
  const { values: v, set, replace, clear, activeCount } = useQueryParams<Params>(KEYS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOwner, setBulkOwner] = useState<string | undefined>()
  const [, bump] = useState(0)

  const view = v.view === 'table' ? 'table' : 'cards'
  const page = Math.max(1, Number(v.page) || 1)
  const advOpen = v.adv === '1'

  const q: ProjectQuery = useMemo(
    () => ({
      search: v.q,
      status: v.status,
      stage: v.stage,
      year: v.year,
      track: v.track,
      field: v.field,
      goal: v.goal,
      region: v.region,
      city: v.city,
      tag: v.tag,
      grantMethod: v.method,
      supportStatus: v.support,
      owner: v.owner,
      unowned: v.unowned === '1',
      overdue: v.overdue === '1',
      shared: v.shared === '1',
      impact: v.impact === '1',
      sort: (v.sort as ProjectSort) ?? 'waiting',
      page,
      pageSize: PAGE_SIZE,
    }),
    [v, page],
  )

  const result = query.projects(q)
  const counts = query.projectStatusCounts(q)
  const total = fixtures.projects.length

  /* المجالات والأهداف والمدن متسلسلة زي النظام: اختيار المسار بيحدّد
     المجالات المتاحة، والمجال بيحدّد الأهداف. لو الأب اتغيّر، الابن يتصفّر. */
  const fieldOptions = v.track ? (FIELDS_BY_TRACK[v.track] ?? []) : Object.values(FIELDS_BY_TRACK).flat()
  const goalOptions = v.field ? (GOALS_BY_FIELD[v.field] ?? []) : []
  const cityOptions = v.region ? (CITIES_BY_REGION[v.region] ?? []) : []

  const activeView =
    VIEWS.find((x) =>
      x.key !== 'all' &&
      Object.entries(x.patch).every(([k, val]) => v[k as keyof Params] === val),
    )?.key ?? (activeCount(['q', 'sort', 'page', 'view', 'adv']) === 0 && !v.status ? 'all' : '')

  const toggleOne = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const selectAll = (on: boolean) =>
    setSelected(on ? new Set(result.rows.map((r) => r.id)) : new Set())

  const applyBulk = () => {
    if (!bulkOwner || selected.size === 0) return
    assignOwner([...selected], bulkOwner)
    setSelected(new Set())
    setBulkOwner(undefined)
    bump((n) => n + 1)
  }

  /* شرائح الفلاتر الشغّالة — كل واحدة تتشال لوحدها */
  const chips = (
    [
      ['stage', 'القسم'], ['year', 'السنة'], ['track', 'المسار'], ['field', 'المجال'],
      ['goal', 'الهدف'], ['region', 'المنطقة'], ['city', 'المدينة'], ['tag', 'الوسم'],
      ['method', 'الأسلوب'], ['support', 'الدعم'], ['owner', 'المالك'],
    ] as [keyof Params, string][]
  )
    .filter(([k]) => v[k])
    .map(([k, label]) => ({ k, label, value: v[k] as string }))

  const flags = (
    [
      ['unowned', 'بلا مالك'], ['overdue', 'متأخر عن الحد'],
      ['shared', 'تمويل مشترك'], ['impact', 'مشروع أثر'],
    ] as [keyof Params, string][]
  ).filter(([k]) => v[k] === '1')

  return (
    <AppLayout assistantContext={assistFor.page('المشاريع')}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">المشاريع</span>
          </nav>

          <header className="lhead-row">
            <div>
              <h1 className="ptitle">المشاريع</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{result.total}</span> نتيجة من{' '}
                <span className="num">{total}</span> مشروعًا في هذا النموذج ·{' '}
                <span className="num">4,929</span> في النظام العامل
              </p>
            </div>
            <div className="lhead-a">
              <label className="fsel">
                <span className="fsel-l">الترتيب</span>
                <span className="fsel-b">
                  <select
                    value={v.sort ?? 'waiting'}
                    onChange={(e) => set({ sort: e.target.value })}
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <Icon path={icons.chevronDown} size={15} />
                </span>
              </label>
              <ViewToggle view={view} onChange={(x) => set({ view: x === 'cards' ? undefined : x })} />
            </div>
          </header>

          {/* ═══ اللقطات المحفوظة ═══ */}
          <div className="views">
            {VIEWS.map((x) => (
              <button
                key={x.key}
                className={`vw${activeView === x.key ? ' on' : ''}`}
                onClick={() => replace({ ...x.patch, view: v.view })}
              >
                {x.label}
              </button>
            ))}
          </div>

          {/* ═══ شرائح الحالة بعدّادها ═══ */}
          <Segments
            active={v.status}
            onChange={(k) => set({ status: k })}
            items={[
              { key: '', label: 'الكل', count: Object.values(counts).reduce((a, b) => a + b, 0) },
              ...STATUS_GROUPS.map((g) => ({ key: g, label: g, count: counts[g] ?? 0 })),
            ]}
          />

          {/* ═══ شريط الأدوات ═══ */}
          <Glass className="ftoolbar">
            <div className="ftool-r">
              <SearchBox
                value={v.q ?? ''}
                onChange={(x) => set({ q: x })}
                placeholder="ابحث برقم المشروع أو اسمه أو اسم الجهة…"
              />
              <Toggle label="متأخر عن الحد" on={v.overdue === '1'} onChange={(on) => set({ overdue: on ? '1' : undefined })} />
              <Toggle label="بلا مالك" on={v.unowned === '1'} onChange={(on) => set({ unowned: on ? '1' : undefined })} />
              <button
                className={`fchip${advOpen ? ' on' : ''}`}
                onClick={() => set({ adv: advOpen ? undefined : '1' })}
                aria-expanded={advOpen}
              >
                <Icon path={icons.filter} size={15} />
                فلاتر متقدمة
                {activeCount(NOT_FILTERS) > 0 && <b className="num">{activeCount(NOT_FILTERS)}</b>}
              </button>
            </div>

            {advOpen && (
              <div className="fgrid">
                <Select label="السنة والمصدر" value={v.year} options={YEARS.map((y) => y.id)} onChange={(x) => set({ year: x })} />
                <Select label="القسم الإجرائي" value={v.stage} options={STAGES.map((s) => s.stage)} onChange={(x) => set({ stage: x })} />
                <Select label="المسار" value={v.track} options={TRACKS} onChange={(x) => set({ track: x, field: undefined, goal: undefined })} />
                <Select label="المجال" value={v.field} options={fieldOptions} onChange={(x) => set({ field: x, goal: undefined })} />
                <Select label="الهدف" value={v.goal} options={goalOptions} onChange={(x) => set({ goal: x })} disabled={!v.field} all={v.field ? 'الكل' : 'اختر المجال أولًا'} />
                <Select label="المنطقة" value={v.region} options={REGIONS} onChange={(x) => set({ region: x, city: undefined })} />
                <Select label="المدينة" value={v.city} options={cityOptions} onChange={(x) => set({ city: x })} disabled={!v.region} all={v.region ? 'الكل' : 'اختر المنطقة أولًا'} />
                <Select label="الوسم" value={v.tag} options={TAGS} onChange={(x) => set({ tag: x })} />
                <Select label="أسلوب المنح" value={v.method} options={GRANT_METHODS} onChange={(x) => set({ method: x })} />
                <Select label="حالة الدعم" value={v.support} options={SUPPORT_STATUS} onChange={(x) => set({ support: x })} />
                <Select label="المالك" value={v.owner} options={OWNERS} onChange={(x) => set({ owner: x })} />
                <div className="fgrid-t">
                  <Toggle label="تمويل مشترك" on={v.shared === '1'} onChange={(on) => set({ shared: on ? '1' : undefined })} />
                  <Toggle label="مشروع أثر" on={v.impact === '1'} onChange={(on) => set({ impact: on ? '1' : undefined })} />
                </div>
              </div>
            )}

            {(chips.length > 0 || flags.length > 0) && (
              <div className="factive">
                {chips.map((c) => (
                  <button key={c.k as string} className="fpill" onClick={() => set({ [c.k]: undefined } as Partial<Params>)}>
                    <span className="sub">{c.label}:</span> {c.value}
                    <Icon path={icons.close} size={13} />
                  </button>
                ))}
                {flags.map(([k, label]) => (
                  <button key={k as string} className="fpill" onClick={() => set({ [k]: undefined } as Partial<Params>)}>
                    {label}
                    <Icon path={icons.close} size={13} />
                  </button>
                ))}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {/* ═══ شريط التحديد الجماعي ═══
              موجود لأن ١٬٢٥٣ مشروعًا في النظام بلا مالك، وإسنادهم
              واحدًا واحدًا مستحيل عمليًا. */}
          {selected.size > 0 && (
            <Glass className="bulk">
              <span>
                محدَّد <span className="num">{selected.size}</span> مشروعًا
              </span>
              <span className="pc-sp" />
              <label className="fsel">
                <span className="fsel-b">
                  <select value={bulkOwner ?? ''} onChange={(e) => setBulkOwner(e.target.value || undefined)}>
                    <option value="">اختر المالك…</option>
                    {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <Icon path={icons.chevronDown} size={15} />
                </span>
              </label>
              <button className="btn btn-3 btn-sm" disabled={!bulkOwner} onClick={applyBulk}>
                إسناد
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </button>
            </Glass>
          )}

          {/* ═══ النتائج ═══ */}
          {result.total === 0 ? (
            <Glass>
              <Empty
                title="لا توجد مشاريع بهذه الفلاتر."
                note="جرّب توسيع النطاق أو امسح الفلاتر الحالية."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'cards' ? (
            <div className="plist">
              {result.rows.map((r) => (
                <ProjectCard key={r.id} row={r} selected={selected.has(r.id)} onSelect={toggleOne} />
              ))}
            </div>
          ) : (
            <Glass style={{ padding: '.4rem' }}>
              <ProjectsTable
                rows={result.rows}
                selected={selected}
                onSelect={toggleOne}
                onSelectAll={selectAll}
              />
            </Glass>
          )}

          <Pager
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPage={(p) => set({ page: String(p) })}
          />

          <p className="sub" style={{ textAlign: 'center', marginTop: '.4rem' }}>
            البيانات هنا تجريبية بتوزيع النظام الحقيقي ·{' '}
            <Link to="/entities" className="lnk">انتقل إلى الجهات</Link>
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
