import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, Pager, PAGE_SIZES, SearchBox, Segments, Select,
  Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { fixtures, query, type ProjectQuery, type ProjectSort } from '@/data/repository'
import { applyDecision, assignOwner, type BulkDecision } from '@/data/mock/projects'
import { useRole } from '@/hooks/useRole'
import { ROUTES } from '@/app/routes'
import { exportPng, exportXlsx, printArea, type Sheet } from '@/lib/export'
import { COLS, GROUPS, groupByKey } from './columns'
import {
  DataTable, aggregate, orderCols, readCols, splitGroups, writeCols,
} from '@/components/table'
import { units } from '@/lib/format'
import { PrintSheet } from './PrintSheet'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, GRANT_METHODS, OWNERS,
  REGIONS, STAGES, STATUS_GROUPS, SUPPORT_STATUS, TAGS, TRACKS, YEARS,
} from '@/data/mock/taxonomy'
import { QuickRead } from '@/components/assistant'
import { readProjects } from '@/data/readings'
import { ProjectCard } from './ProjectCard'


/* المفاتيح دي هي عقد الـURL: أي فلتر في الشاشة له مفتاح هنا،
   ونفس الاسم هيتبعت للسيرفر كـquery string وقت الربط. */
const KEYS = [
  'q', 'status', 'stage', 'year', 'track', 'field', 'goal', 'region', 'city',
  'tag', 'method', 'support', 'owner', 'unowned', 'overdue', 'shared', 'impact',
  'sort', 'page', 'size', 'view', 'adv', 'group',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = PAGE_SIZES[0]

/* البحث والحالة والتبديلات الظاهرة ليها مكانها فوق، فما تتحسبش في
   عدّاد «الفلاتر المتقدمة» — العدّاد بيقول اللي مخفي بس. */
const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'size', 'view', 'adv', 'group', 'status', 'unowned', 'overdue',
]

/** اللقطات المحفوظة — الأسئلة اللي المشرف بيسألها كل يوم */
const VIEWS: { key: string; label: string; patch: Partial<Params> }[] = [
  { key: 'all', label: 'كل المشاريع', patch: {} },
  { key: 'mine', label: 'ما ينتظر قراري', patch: { owner: 'عمر قاسم', status: 'في الدراسة' } },
  { key: 'overdue', label: 'متأخر عن الحد', patch: { overdue: '1' } },
  { key: 'unowned', label: 'بلا مالك', patch: { unowned: '1' } },
]

/* إجراءات الدور اللي يصحّ تنفيذها على دفعة. اللي مش هنا محتاج هدفًا
   لكل مشروع (تحويل لمشرف بعينه، إعادة لمستوى)، وتنفيذه جماعيًا
   بيبقى تخمينًا. */
const BULK_OF: Record<string, BulkDecision> = {
  'توصية بالموافقة': 'approve',
  'اعتماد': 'approve',
  'طلب استكمال': 'complete',
  'توصية بالرفض': 'decline',
  'اعتذار': 'decline',
  'رفع للجنة التنفيذية': 'escalate',
  'رفع لمجلس الأمناء': 'escalate',
}

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
 * النظام الحالي بيرمي 4,929 صفًّا في جدول واحد بـ62 عمودًا و14 فلترًا
 * مفرودة فوق بعض. الشاشة دي بتقلب الترتيب: اللقطات المحفوظة أولًا
 * (اللي بينتظر قرارك · المتأخر · بلا مالك)، وبعدها الحالة كشرائح
 * بعدّادها، والفلاتر الباقية مطوية ومعاها عدّاد. والحالة المعروضة هي
 * القسم الإجرائي الفعلي مش المجموعة الخماسية.
 */
export default function ProjectsListPage() {
  const { values: v, set, replace, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const { role } = useRole()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOwner, setBulkOwner] = useState<string | undefined>()
  const [, bump] = useState(0)
  const [cols, setCols] = useState<string[]>(() => readCols('projects', COLS))
  /* آخر قرار مجمّع + تراجعه. الشريط بيفضل ظاهر لحد ما المستخدم
     يقفله، فالتراجع مش سباق مع مؤقّت. */
  const [lastBulk, setLastBulk] = useState<{ text: string; undo: () => void } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const exportBox = useRef<HTMLDivElement>(null)

  useEffect(() => writeCols('projects', cols), [cols])

  useEffect(() => {
    if (!exportOpen) return
    const away = (e: PointerEvent) => {
      if (!exportBox.current?.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [exportOpen])

  /* الجدول على الموبايل بيضغط كل عمود لحد ما كل خلية تتلف عمودًا
     من الكلمات — مش جدول، شبكة كلمات. الكارت هو صف الموبايل. */
  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const page = Math.max(1, Number(v.page) || 1)
  const advOpen = v.adv === '1'

  /* حجم الصفحة في الـURL زي الفلاتر: اللي بيبعت الرابط لزميله عايزه
     يشوف نفس الصفحة بنفس عدد صفوفها. */
  const size = Math.min(500, Math.max(1, Number(v.size) || PAGE_SIZE))

  const q: ProjectQuery = useMemo(
    () => ({
      search: v.q,
      status: readList(v.status),
      stage: readList(v.stage),
      year: readList(v.year),
      track: readList(v.track),
      field: readList(v.field),
      goal: readList(v.goal),
      region: readList(v.region),
      city: readList(v.city),
      tag: readList(v.tag),
      grantMethod: readList(v.method),
      supportStatus: readList(v.support),
      owner: readList(v.owner),
      unowned: v.unowned === '1',
      overdue: v.overdue === '1',
      shared: v.shared === '1',
      impact: v.impact === '1',
      sort: (v.sort as ProjectSort) ?? 'waiting',
      page,
      pageSize: size,
    }),
    [v, page, size],
  )

  /* التجميع بيلغي الترقيم: المجموعة المقطوعة على صفحتين إجمالياتها
     كذّابة، والمستخدم اللي بيجمّع بيسأل عن الصورة كاملة أصلًا.
     ده قرار واجهة مؤقت — لما الباك اند يجمّع، بيرجّع المجموعات
     مرقّمة بإجمالياتها وبيتشال القيد ده. */
  const group = groupByKey(v.group)
  const grouped = Boolean(group)

  const result = query.projects(grouped ? { ...q, page: 1, pageSize: 9999 } : q)
  const counts = query.projectStatusCounts(q)
  const total = fixtures.projects.length

  /* عدّاد كل لقطة مطلق، لأن اللقطة مبدّل نطاق مش فلتر جوّه النطاق:
     «بلا مالك 8» لازم تفضل 8 حتى وإنت واقف على لقطة تانية. */
  const viewCounts = useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((x) => [
          x.key,
          query.projects({
            owner: x.patch.owner,
            status: x.patch.status,
            unowned: x.patch.unowned === '1',
            overdue: x.patch.overdue === '1',
            pageSize: 1,
          }).total,
        ]),
      ) as Record<string, number>,
    [],
  )

  /* المجالات والأهداف والمدن متسلسلة زي النظام: اختيار المسار بيحدّد
     المجالات المتاحة، والمجال بيحدّد الأهداف. لو الأب اتغيّر، الابن يتصفّر. */
  const tracks = readList(v.track)
  const fields = readList(v.field)
  const regions = readList(v.region)

  /* مع الاختيار المتعدد، ابن الفلتر بياخد **اتحاد** آبائه: اللي مختار
     مسارين لازم يشوف مجالات الاتنين. والتكرار بيتشال عشان المجال
     الواحد ما يتكتبش مرتين لو تابع لمسارين. */
  const uniq = (xs: string[]) => [...new Set(xs)]

  /* لما الأب يتغيّر، الابن ما يتصفّرش كله — بيتشال منه اللي بقى
     خارج النطاق بس. المستخدم اللي مختار «التعليم» وزوّد مسارًا
     تانيًا ما يستاهلش يفقد اختياره. */
  const keep = (chosen: string[], allowed: string[]) =>
    writeList(chosen.filter((x) => allowed.includes(x)))
  const fieldOptions = tracks.length
    ? uniq(tracks.flatMap((t) => FIELDS_BY_TRACK[t] ?? []))
    : uniq(Object.values(FIELDS_BY_TRACK).flat())
  const goalOptions = uniq(fields.flatMap((f) => GOALS_BY_FIELD[f] ?? []))
  const cityOptions = uniq(regions.flatMap((r) => CITIES_BY_REGION[r] ?? []))

  /* اللقطة النشطة = اللي كل مفاتيحها مطابقة. لو المستخدم زوّد فلترًا
     فوقها، الشريحة تفضل مختارة — هو لسه جوّه نفس النطاق. */
  const activeView =
    VIEWS.find(
      (x) =>
        x.key !== 'all' &&
        Object.entries(x.patch).every(([k, val]) => v[k as keyof Params] === val),
    )?.key ?? 'all'

  const toggleOne = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const selectAll = (on: boolean) =>
    setSelected(on ? new Set(result.rows.map((r) => r.id)) : new Set())

  /* نطاق التصدير: المحدَّد لو فيه تحديد، وإلا كل نتيجة الفلتر —
     لا صفحة العرض. اللي بيصدّر عايز الإجابة كاملة مش أول 25 صفًّا. */
  const allFiltered = useMemo(
    () => query.projects({ ...q, page: 1, pageSize: 9999 }).rows,
    [q],
  )
  const exportRows = selected.size
    ? allFiltered.filter((r) => selected.has(r.id))
    : allFiltered

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group || c.key !== group.key)
    const head = [...(group ? [group.label] : []), ...shown.map((c) => c.label)]
    const body = exportRows.map((r) => [
      ...(group ? [group.of(r)] : []),
      ...shown.map((c) => c.text(r)),
    ])
    /* صف الإجماليات بنفس منطق الشاشة — لو اختلفوا، المستخدم هيصدّق
       الملف ويشك في الشاشة. */
    const totals = [
      ...(group ? [''] : []),
      ...shown.map((c, i) => {
        const t = aggregate(c, exportRows)
        return t !== null ? String(t) : i === 0 ? units.project(exportRows.length) : ''
      }),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-projects-${stamp}`, title: 'المشاريع', headers: head, rows: body, totals }
  }, [cols, exportRows, group])

  const exportNote = `${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${units.project(exportRows.length)}`

  const runBulk = (decision: BulkDecision, label: string) => {
    if (selected.size === 0) return
    const ids = [...selected]
    const undo = applyDecision(ids, decision)
    setLastBulk({ text: `${label} — ${units.project(ids.length)}`, undo })
    setSelected(new Set())
    bump((n) => n + 1)
  }

  const bulkActions = role.actions.filter((a) => BULK_OF[a.label])

  const applyBulk = () => {
    if (!bulkOwner || selected.size === 0) return
    assignOwner([...selected], bulkOwner)
    setSelected(new Set())
    setBulkOwner(undefined)
    bump((n) => n + 1)
  }

  /* القراءات محسوبة من نفس الصفوف المعروضة، فما تقدرش تتعارض معاها */
  const readings = useMemo(
    () =>
      readProjects({
        all: fixtures.projects,
        filtered: query.projects({ ...q, page: 1, pageSize: 9999 }).rows,
        isFiltered: activeCount(['sort', 'page', 'view', 'adv']) > 0 || Boolean(v.q),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  )

  /* شرائح الفلاتر الشغّالة — كل واحدة تتشال لوحدها */
  const chips = (
    [
      ['status', 'الحالة'], ['stage', 'القسم'], ['year', 'السنة'], ['track', 'المسار'], ['field', 'المجال'],
      ['goal', 'الهدف'], ['region', 'المنطقة'], ['city', 'المدينة'], ['tag', 'الوسم'],
      ['method', 'الأسلوب'], ['support', 'الدعم'], ['owner', 'المالك'],
    ] as [keyof Params, string][]
  )
    /* شريحة لكل **قيمة** لا لكل فلتر: اللي مختار ثلاث مناطق عايز
       يشيل واحدة منهم من غير ما يفقد الاتنين التانيين. */
    .flatMap(([k, label]) =>
      readList(v[k]).map((value) => ({ k, label, value })),
    )

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

          <header>
            <div>
              <h1 className="ptitle">المشاريع</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{result.total}</span> نتيجة من{' '}
                <span className="num">{total}</span> مشروعًا في هذا النموذج ·{' '}
                <span className="num">4,929</span> في النظام العامل
              </p>
            </div>
          </header>

          {/* ═══ اللقطات المحفوظة — صفّ واحد، وهي المحور الأساسي:
              «إيه اللي عليّ النهارده؟» ═══ */}
          <Segments
            active={activeView}
            onChange={(k) => {
              const next = VIEWS.find((x) => x.key === k) ?? VIEWS[0]
              replace({ ...next.patch, view: v.view })
            }}
            items={VIEWS.map((x) => ({
              key: x.key,
              label: x.label,
              count: viewCounts[x.key],
            }))}
          />

          {/* ═══ شريط الأدوات ═══ */}
          <Glass className="ftoolbar">
            <div className="ftool-r">
              <SearchBox
                value={v.q ?? ''}
                onChange={(x) => set({ q: x })}
                placeholder="ابحث برقم المشروع أو اسمه أو اسم الجهة…"
              />
              <MultiSelect
                values={readList(v.status)}
                all={`كل الحالات (${result.total})`}
                options={STATUS_GROUPS.filter((g) => counts[g]).map((g) => ({
                  value: g,
                  label: `${g} (${counts[g]})`,
                }))}
                onChange={(x) => set({ status: writeList(x) })}
              />
              <Select
                icon={icons.sort}
                value={v.sort ?? 'waiting'}
                all={SORTS[0].label}
                options={SORTS.slice(1).map((x) => ({ value: x.key, label: x.label }))}
                onChange={(x) => set({ sort: x })}
              />
              <button
                className={`fchip${advOpen ? ' on' : ''}`}
                onClick={() => set({ adv: advOpen ? undefined : '1' })}
                aria-expanded={advOpen}
              >
                <Icon path={icons.filter} size={15} />
                فلاتر متقدمة
                {activeCount(NOT_FILTERS) > 0 && <b className="num">{activeCount(NOT_FILTERS)}</b>}
              </button>
              {/* التجميع سؤال مختلف عن الفلتر: الفلتر بيقلّل الصفوف،
                  والتجميع بيعيد ترتيبها لجداول بإجمالياتها. */}
              {view === 'table' && (
                <Select
                  icon={icons.rows}
                  value={v.group}
                  all="بلا تجميع"
                  options={GROUPS.map((g) => ({ value: g.key, label: `تجميع حسب ${g.label}` }))}
                  onChange={(x) => set({ group: x, page: undefined })}
                />
              )}

              <div className="fexp" ref={exportBox}>
                <button
                  className={`fchip${exportOpen ? ' on' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  onClick={() => setExportOpen((x) => !x)}
                >
                  <Icon path={icons.down} size={15} />
                  تصدير
                  {selected.size > 0 && <b className="num">{selected.size}</b>}
                </button>

                {exportOpen && (
                  <div className="fmenu fexp-m">
                    <div className="fexp-s sub">{exportNote}</div>
                    <button className="fopt" onClick={() => { setExportOpen(false); exportXlsx(sheet) }}>
                      <span className="fopt-t">Excel · xlsx</span>
                    </button>
                    <button className="fopt" onClick={() => { setExportOpen(false); setTimeout(printArea, 60) }}>
                      <span className="fopt-t">PDF · عبر الطباعة</span>
                    </button>
                    <button className="fopt" onClick={() => { setExportOpen(false); exportPng(sheet) }}>
                      <span className="fopt-t">صورة · png</span>
                    </button>
                  </div>
                )}
              </div>

              <span className="ftool-sp" />
              {!mobile && (
                <ViewToggle view={view} onChange={(x) => set({ view: x === 'cards' ? undefined : x })} />
              )}
            </div>

            {advOpen && (
              <div className="fgrid">
                {/* كل فلتر متعدد الاختيار. والابن بيتصفّر لما الأب يتغيّر،
                    وإلا فضل في الـURL مجال مش تابع لأي مسار مختار. */}
                <MultiSelect label="السنة والمصدر" values={readList(v.year)} options={YEARS.map((y) => y.id)} onChange={(x) => set({ year: writeList(x) })} />
                <MultiSelect label="القسم الإجرائي" values={readList(v.stage)} options={STAGES.map((s) => s.stage)} onChange={(x) => set({ stage: writeList(x) })} />
                <MultiSelect label="المسار" values={tracks} options={TRACKS} onChange={(x) => {
                  const nextFields = x.length ? uniq(x.flatMap((t) => FIELDS_BY_TRACK[t] ?? [])) : uniq(Object.values(FIELDS_BY_TRACK).flat())
                  const field = keep(fields, nextFields)
                  const nextGoals = uniq(readList(field).flatMap((f) => GOALS_BY_FIELD[f] ?? []))
                  set({ track: writeList(x), field, goal: keep(readList(v.goal), nextGoals) })
                }} />
                <MultiSelect label="المجال" values={fields} options={fieldOptions} onChange={(x) =>
                  set({
                    field: writeList(x),
                    goal: keep(readList(v.goal), uniq(x.flatMap((f) => GOALS_BY_FIELD[f] ?? []))),
                  })
                } />
                <MultiSelect label="الهدف" values={readList(v.goal)} options={goalOptions} onChange={(x) => set({ goal: writeList(x) })} disabled={fields.length === 0} all={fields.length ? 'الكل' : 'اختر المجال أولًا'} />
                <MultiSelect label="المنطقة" values={regions} options={REGIONS} onChange={(x) =>
                  set({
                    region: writeList(x),
                    city: keep(readList(v.city), uniq(x.flatMap((r) => CITIES_BY_REGION[r] ?? []))),
                  })
                } />
                <MultiSelect label="المدينة" values={readList(v.city)} options={cityOptions} onChange={(x) => set({ city: writeList(x) })} disabled={regions.length === 0} all={regions.length ? 'الكل' : 'اختر المنطقة أولًا'} />
                <MultiSelect label="الوسم" values={readList(v.tag)} options={TAGS} onChange={(x) => set({ tag: writeList(x) })} />
                <MultiSelect label="أسلوب المنح" values={readList(v.method)} options={GRANT_METHODS} onChange={(x) => set({ method: writeList(x) })} />
                <MultiSelect label="حالة الدعم" values={readList(v.support)} options={SUPPORT_STATUS} onChange={(x) => set({ support: writeList(x) })} />
                <MultiSelect label="المالك" values={readList(v.owner)} options={OWNERS} onChange={(x) => set({ owner: writeList(x) })} />
                <div className="fgrid-t">
                  <Toggle label="تمويل مشترك" on={v.shared === '1'} onChange={(on) => set({ shared: on ? '1' : undefined })} />
                  <Toggle label="مشروع أثر" on={v.impact === '1'} onChange={(on) => set({ impact: on ? '1' : undefined })} />
                </div>
              </div>
            )}

            {(chips.length > 0 || flags.length > 0) && (
              <div className="factive">
                {chips.map((c) => (
                  <button
                    key={`${c.k as string}:${c.value}`}
                    className="fpill"
                    onClick={() =>
                      set({
                        [c.k]: writeList(readList(v[c.k]).filter((x) => x !== c.value)),
                      } as Partial<Params>)
                    }
                  >
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

          {/* ═══ القراءة السريعة — نفس فكرة صفحة المشروع، بس هنا
              بتتكلم عن الشريحة المعروضة وبتتغيّر مع الفلتر ═══ */}
          <QuickRead
            variant="bar"
            title="قراءة سريعة للقائمة"
            readings={readings}
          />

          {/* ═══ شريط التحديد الجماعي ═══
              موجود لأن 1,253 مشروعًا في النظام بلا مالك، وإسنادهم
              واحدًا واحدًا مستحيل عمليًا. */}
          {lastBulk && (
            <Glass className="bulk done">
              <Icon path={icons.check} size={16} />
              <span>{lastBulk.text}</span>
              <span className="pc-sp" />
              <button
                className="btn btn-2 btn-sm"
                onClick={() => { lastBulk.undo(); setLastBulk(null); bump((n) => n + 1) }}
              >
                <Icon path={icons.redo} size={15} />
                تراجع
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setLastBulk(null)}>إغلاق</button>
            </Glass>
          )}

          {selected.size > 0 && (
            <Glass className="bulk">
              <span>
                محدَّد <span className="num">{selected.size}</span> مشروعًا
              </span>

              {/* قرار على الدفعة كلها. الإجراءات هي إجراءات الدور
                  نفسها اللي في صفحة المشروع، ناقص اللي محتاج هدفًا
                  لكل مشروع. */}
              {bulkActions.map((a) => (
                <button
                  key={a.label}
                  className={`btn btn-sm ${a.kind}`}
                  onClick={() => runBulk(BULK_OF[a.label], a.label)}
                >
                  {a.label}
                </button>
              ))}

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
              <button className="btn btn-p btn-sm" disabled={!bulkOwner} onClick={applyBulk}>
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
            <Glass className="tblcard" style={{ padding: '.4rem' }}>
              <DataTable
                rows={result.rows}
                all={COLS}
                cols={cols}
                onCols={setCols}
                id={(r) => r.id}
                selected={selected}
                onSelect={toggleOne}
                onSelectAll={selectAll}
                onOpen={(r) => navigate(ROUTES.project(r.id))}
                group={group}
                count={units.project}
              />
            </Glass>
          )}

          {grouped ? (
            <p className="sub" style={{ textAlign: 'center' }}>
              التجميع يعرض كل النتائج بلا ترقيم ·{' '}
              <span className="num">{splitGroups(result.rows, group!).length}</span> مجموعات ·{' '}
              <button className="lnk" onClick={() => set({ group: undefined })}>إلغاء التجميع</button>
            </p>
          ) : (
            <Pager
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onPage={(p) => set({ page: String(p) })}
              onPageSize={(n) => set({ size: n === PAGE_SIZE ? undefined : String(n), page: undefined })}
            />
          )}

          {/* نسخة الطباعة: مخفية على الشاشة، وهي اللي بتطلع في الـPDF */}
          <PrintSheet sheet={sheet} note={exportNote} />

          <p className="sub" style={{ textAlign: 'center', marginTop: '.4rem' }}>
            البيانات هنا تجريبية بتوزيع النظام الحقيقي ·{' '}
            <Link to="/entities" className="lnk">انتقل إلى الجهات</Link>
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
