import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, Money, MultiSelect, Pager, PAGE_SIZES, SearchBox, Segments,
  Select, Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import {
  FilterCustomizer, SavedViews, readFilterOrder, writeFilterOrder, type FilterDef,
} from '@/components/filters'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { fixtures, query, type ProjectQuery, type ProjectSort } from '@/data/repository'
import { applyDecision, assignOwner, type BulkDecision } from '@/data/mock/projects'
import { useRole } from '@/hooks/useRole'
import { ROUTES } from '@/app/routes'
import { type Sheet } from '@/lib/export'
import { ExportMenu } from '@/components/export'
import { COLS, GROUPS, groupByKey } from './columns'
import {
  DataTable, aggregate, orderCols, readCols, splitGroups, writeCols,
} from '@/components/table'
import { plural, units } from '@/lib/format'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, GRANT_METHODS, OWNERS,
  REGIONS, STAGES, STATUS_GROUPS, SUPPORT_STATUS, TAGS, TRACKS, YEARS,
} from '@/data/mock/taxonomy'
import { QuickRead } from '@/components/assistant'
import { BulkBar } from '@/components/shell'
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

/** ترتيب الفلاتر الافتراضي — نفس ترتيب `FILTER_DEFS` جوّه الكومبوننت */
const FILTER_KEYS = [
  'year', 'stage', 'track', 'field', 'goal', 'region', 'city', 'tag', 'method', 'support', 'owner',
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
 * النظام الحالي بيرمي 4,929 صفًّا في جدول واحد بـ62 عمودًا و14 فلترًا
 * مفرودة فوق بعض. الشاشة دي بتقلب الترتيب: اللقطات المحفوظة أولًا
 * (اللي بينتظر قرارك · المتأخر · بلا مالك)، وبعدها الحالة كشرائح
 * بعدّادها، والفلاتر الباقية مطوية ومعاها عدّاد. والحالة المعروضة هي
 * القسم الإجرائي الفعلي مش المجموعة الخماسية.
 */
export default function ProjectsListPage() {
  const { values: v, set, replace, clear, activeCount, snapshot, applyQuery } =
    useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const { role } = useRole()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOwner, setBulkOwner] = useState<string | undefined>()
  const [, bump] = useState(0)
  const [cols, setCols] = useState<string[]>(() => readCols('projects', COLS))
  const [custom, setCustom] = useState(false)
  const [fOrder, setFOrder] = useState<string[]>(() =>
    readFilterOrder('projects', FILTER_KEYS),
  )

  useEffect(() => writeFilterOrder('projects', fOrder), [fOrder])
  /* آخر قرار مجمّع + تراجعه. الشريط بيفضل ظاهر لحد ما المستخدم
     يقفله، فالتراجع مش سباق مع مؤقّت. */
  const [lastBulk, setLastBulk] = useState<{ text: string; undo: () => void } | null>(null)

  useEffect(() => writeCols('projects', cols), [cols])

  /* الجدول على الموبايل بيضغط كل عمود لحد ما كل خلية تتلف عمودًا
     من الكلمات — مش جدول، شبكة كلمات. الكارت هو صف الموبايل. */
  const mobile = useIsMobile()
  /* الجدول هو الديفولت والكروت اختيار — الكلاينت طلب كده، والسبب
     إن الجدول بيوري عشرة صفوف مرة واحدة والكارت بيوري تلاتة.
     الموبايل استثناء ثابت: الجدول على 390px بيضغط كل عمود لحد ما
     كل خلية تلفّ عمودًا من الكلمات — مش جدول، شبكة كلمات. */
  const view = mobile ? 'cards' : v.view === 'cards' ? 'cards' : 'table'
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

  /* ضمّ وطرح لا استبدال: مع التجميع الصندوق بيخصّ مجموعته وحدها،
     واللي متحدَّد في مجموعة تانية ما يتشالش. */
  const selectAll = (on: boolean, ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

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

  /* مبلغ الدفعة — نفس رقم شريط القرار في صفحة المشروع، بس مجموعًا.
     القرار على ستة مشاريع مش زي القرار على ستة ملايين، والشريط
     لازم يقول الاتنين قبل ما تتضغط الأزرار. */
  const selectedAmount = useMemo(
    () => allFiltered.reduce((s, r) => (selected.has(r.id) ? s + r.amountRequested : s), 0),
    [allFiltered, selected],
  )

  /* «6 مشاريع محدَّدة» — الرقم في الشارة والاسم في الجملة، فالصيغة
     هنا من غير رقم. */
  const selectedNoun = plural(selected.size, {
    one: 'مشروع محدَّد',
    two: 'مشروعان محدَّدان',
    few: () => 'مشاريع محدَّدة',
    many: () => 'مشروعًا محدَّدًا',
  })

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
  /* الفلاتر كبيانات لا JSX مرصوص: التخصيص محتاج يرتّبهم ويخفيهم،
     وده مستحيل وهم مكتوبين بالإيد في الشبكة. */
  const FILTER_DEFS: FilterDef[] = [
    { key: 'year', label: 'السنة والمصدر' },
    { key: 'stage', label: 'القسم الإجرائي' },
    { key: 'track', label: 'المسار' },
    { key: 'field', label: 'المجال' },
    { key: 'goal', label: 'الهدف' },
    { key: 'region', label: 'المنطقة' },
    { key: 'city', label: 'المدينة' },
    { key: 'tag', label: 'الوسم' },
    { key: 'method', label: 'أسلوب المنح' },
    { key: 'support', label: 'حالة الدعم' },
    { key: 'owner', label: 'المالك' },
  ]

  const FILTERS: Record<string, ReactNode> = {
    year: <MultiSelect label="السنة والمصدر" values={readList(v.year)} options={YEARS.map((y) => y.id)} onChange={(x) => set({ year: writeList(x) })} />,
    stage: <MultiSelect label="القسم الإجرائي" values={readList(v.stage)} options={STAGES.map((x) => x.stage)} onChange={(x) => set({ stage: writeList(x) })} />,
    track: (
      <MultiSelect
        label="المسار"
        values={tracks}
        options={TRACKS}
        onChange={(x) => {
          const nextFields = x.length ? uniq(x.flatMap((t) => FIELDS_BY_TRACK[t] ?? [])) : uniq(Object.values(FIELDS_BY_TRACK).flat())
          const field = keep(fields, nextFields)
          const nextGoals = uniq(readList(field).flatMap((f) => GOALS_BY_FIELD[f] ?? []))
          set({ track: writeList(x), field, goal: keep(readList(v.goal), nextGoals) })
        }}
      />
    ),
    field: (
      <MultiSelect
        label="المجال"
        values={fields}
        options={fieldOptions}
        onChange={(x) =>
          set({ field: writeList(x), goal: keep(readList(v.goal), uniq(x.flatMap((f) => GOALS_BY_FIELD[f] ?? []))) })
        }
      />
    ),
    goal: <MultiSelect label="الهدف" values={readList(v.goal)} options={goalOptions} onChange={(x) => set({ goal: writeList(x) })} disabled={fields.length === 0} all={fields.length ? 'الكل' : 'اختر المجال أولًا'} />,
    region: (
      <MultiSelect
        label="المنطقة"
        values={regions}
        options={REGIONS}
        onChange={(x) =>
          set({ region: writeList(x), city: keep(readList(v.city), uniq(x.flatMap((r) => CITIES_BY_REGION[r] ?? []))) })
        }
      />
    ),
    city: <MultiSelect label="المدينة" values={readList(v.city)} options={cityOptions} onChange={(x) => set({ city: writeList(x) })} disabled={regions.length === 0} all={regions.length ? 'الكل' : 'اختر المنطقة أولًا'} />,
    tag: <MultiSelect label="الوسم" values={readList(v.tag)} options={TAGS} onChange={(x) => set({ tag: writeList(x) })} />,
    method: <MultiSelect label="أسلوب المنح" values={readList(v.method)} options={GRANT_METHODS} onChange={(x) => set({ method: writeList(x) })} />,
    support: <MultiSelect label="حالة الدعم" values={readList(v.support)} options={SUPPORT_STATUS} onChange={(x) => set({ support: writeList(x) })} />,
    owner: <MultiSelect label="المالك" values={readList(v.owner)} options={OWNERS} onChange={(x) => set({ owner: writeList(x) })} />,
  }

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
    <AppLayout assistantContext={assistFor.projects()}>
      <div className={`viewstack${selected.size > 0 ? ' hasdock' : ''}`}>
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

          {/* ═══ القراءة السريعة ═══
              مكانها بعد العنوان مباشرة لا بعد الفلاتر: هي **قراءة
              للصفحة**، والقراءة بتيجي قبل الأدوات لا بينها وبين
              النتيجة. في النص كانت بتقطع الطريق بين الفلتر واللي
              رجع منه، ومحدّش بيقرا سطرًا وهو ماسك فلتر. */}
          <QuickRead
            variant="bar"
            title="قراءة سريعة للقائمة"
            readings={readings}
          />

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
              <div className="ftool-f">
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
                <Icon name={icons.filter} size={15} />
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

              </div>

              {/* الأدوات اللي مش فلاتر — مجموعة ثابتة في آخر الصفّ.
                  قبل كده كانت في نفس الصفّ المرن مع الفلاتر، فأول ما
                  فلتر يكبر أو يختفي الصفّ بيلفّ ومبدّل الفيو بينطّ
                  لسطر تاني ويتحرّك أفقيًا. دلوقتي الفلاتر بتلفّ جوّه
                  مجموعتها، والأدوات مكانها ثابت مهما اتغيّر اللي جنبها. */}
              <div className="ftool-a">
              <SavedViews table="projects" current={snapshot()} onApply={applyQuery} />

              <ExportMenu sheet={sheet} note={exportNote} count={selected.size} />

              {!mobile && (
                <ViewToggle view={view} onChange={(x) => set({ view: x === 'table' ? undefined : x })} />
              )}
              </div>
            </div>

            {advOpen && (custom ? (
              <FilterCustomizer
                all={FILTER_DEFS}
                visible={fOrder}
                onChange={setFOrder}
                onClose={() => setCustom(false)}
              />
            ) : (
              <>
                <div className="fgrid">
                  {fOrder.map((k) => (
                    <div key={k} className="fgrid-i">{FILTERS[k]}</div>
                  ))}
                  <div className="fgrid-t">
                    <Toggle label="تمويل مشترك" on={v.shared === '1'} onChange={(on) => set({ shared: on ? '1' : undefined })} />
                    <Toggle label="مشروع أثر" on={v.impact === '1'} onChange={(on) => set({ impact: on ? '1' : undefined })} />
                  </div>
                </div>
                <div className="fgrid-x">
                  <button className="fclear" onClick={() => setCustom(true)}>
                    <Icon name={icons.gear} size={13} />
                    تخصيص الفلاتر
                  </button>
                </div>
              </>
            ))}

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
                    <Icon name={icons.close} size={13} />
                  </button>
                ))}
                {flags.map(([k, label]) => (
                  <button key={k as string} className="fpill" onClick={() => set({ [k]: undefined } as Partial<Params>)}>
                    {label}
                    <Icon name={icons.close} size={13} />
                  </button>
                ))}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {/* نتيجة آخر قرار مجمّع — سطر جوّه الصفحة لا شريط عايم:
              ده تأكيد بيتقرا مرة وبيتقفل، والعايم بياخد مكانًا قدام
              المحتوى بعد ما القرار خلص. */}
          {lastBulk && (
            <Glass className="bulk done">
              <Icon name={icons.check} size={16} />
              <span>{lastBulk.text}</span>
              <span className="pc-sp" />
              <button
                className="btn btn-2 btn-sm"
                onClick={() => { lastBulk.undo(); setLastBulk(null); bump((n) => n + 1) }}
              >
                <Icon name={icons.redo} size={15} />
                تراجع
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setLastBulk(null)}>إغلاق</button>
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
            <Glass className="tblcard">
              <DataTable
                rows={result.rows}
                all={COLS}
                table="projects"
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

          {/* نسخة الطباعة جوّه `ExportMenu` دلوقتي — المخارج التلاتة
              والورقة بيتحرّكوا مع بعض. */}

          <p className="sub" style={{ textAlign: 'center', marginTop: '.4rem' }}>
            البيانات هنا تجريبية بتوزيع النظام الحقيقي ·{' '}
            <Link to="/entities" className="lnk">انتقل إلى الجهات</Link>
          </p>
        </div>

        {/* ═══ شريط الإجراء المجمّع ═══
            موجود لأن 1,253 مشروعًا في النظام بلا مالك، وإسنادهم
            واحدًا واحدًا مستحيل عمليًا. وشكله شكل شريط القرار عمدًا:
            نفس اللحظة، نفس المخارج، نفس المكان. */}
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            sentence={
              <>
                {selectedNoun}
                <span className="decsep" />
                المطلوب <Money>{selectedAmount}</Money>
              </>
            }
          >
            {/* قرار على الدفعة كلها. الإجراءات هي إجراءات الدور نفسها
                اللي في صفحة المشروع، ناقص اللي محتاج هدفًا لكل مشروع. */}
            {bulkActions.map((a) => (
              <button
                key={a.label}
                className={`btn btn-sm ${a.kind}`}
                onClick={() => runBulk(BULK_OF[a.label], a.label)}
              >
                {a.label}
              </button>
            ))}

            <label className="fsel">
              <span className="fsel-b">
                <select
                  value={bulkOwner ?? ''}
                  onChange={(e) => setBulkOwner(e.target.value || undefined)}
                >
                  <option value="">اختر المالك…</option>
                  {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <Icon name={icons.chevronDown} size={15} />
              </span>
            </label>
            <button className="btn btn-p btn-sm" disabled={!bulkOwner} onClick={applyBulk}>
              إسناد
            </button>
          </BulkBar>
        )}
      </div>
    </AppLayout>
  )
}
