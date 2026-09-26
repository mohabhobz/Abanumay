import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, Money, MultiSelect, GroupPicker, Num, Pager, PAGE_SIZES, Person, SearchBox,
  Segments, Select, Tag, Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useStickyGroup } from '@/hooks/useStickyGroup'
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
import { COLS, GROUPS } from './columns'
import {
  DataTable, countLeaves, groupChain, groupTree, orderCols, readCols, sheetOf, writeCols,
} from '@/components/table'
import { nf, NOUN, nounAfter, plural, units } from '@/lib/format'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, GRANT_METHODS, OWNERS,
  REGIONS, STAGES, STATUS_GROUPS, SUPPORT_STATUS, TAGS, TRACKS, YEARS,
} from '@/data/mock/taxonomy'
import { QuickRead } from '@/components/assistant'
import { BulkBar, PageActions } from '@/components/shell'
import { implementerName, portfolios } from '@/data/mock/implementer'
import { readProjects } from '@/data/readings'
import { ProjectCard } from './ProjectCard'


/* These keys are the URL contract: every filter on the screen has a key here, and
   the same name is sent to the server as a query string once wired up. */
const KEYS = [
  'q', 'status', 'stage', 'year', 'track', 'field', 'goal', 'region', 'city',
  'tag', 'method', 'support', 'owner', 'unowned', 'overdue', 'shared', 'impact',
  'sort', 'page', 'size', 'view', 'adv', 'group',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = PAGE_SIZES[0]

/* Search, status, and the visible toggles have their own place above, so they
   don't count toward the "advanced filters" badge — that counter reflects only
   what's hidden. */
const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'size', 'view', 'adv', 'group', 'status', 'unowned', 'overdue',
]

/** Saved views — the questions a reviewer asks every day. */
const VIEWS: { key: string; label: string; patch: Partial<Params> }[] = [
  { key: 'all', label: 'كل المشاريع', patch: {} },
  { key: 'mine', label: 'ما ينتظر قراري', patch: { owner: 'عمر قاسم', status: 'في الدراسة' } },
  { key: 'overdue', label: 'متأخر عن الحد', patch: { overdue: '1' } },
  { key: 'unowned', label: 'بلا مالك', patch: { unowned: '1' } },
]

/* Role actions valid to run as a bulk batch. Anything not listed here needs a
   per-project target (assigning a specific reviewer, reverting to a level), and
   running it in bulk would just be guessing. */
const BULK_OF: Record<string, BulkDecision> = {
  'توصية بالموافقة': 'approve',
  'اعتماد': 'approve',
  'طلب استكمال': 'complete',
  'توصية بالرفض': 'decline',
  'اعتذار': 'decline',
  'رفع للجنة التنفيذية': 'escalate',
  'رفع لمجلس الأمناء': 'escalate',
}

/** Default filter order — matches the `FILTER_DEFS` order inside the component. */
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
 * All projects.
 *
 * The system dumps 4,929 rows into a single table with 62 columns and 14 filters
 * laid out flat. This screen flips that order: saved views first (waiting on your
 * decision, overdue, unassigned), then status as counted chips, then the rest of
 * the filters collapsed behind a counter. The status shown is the actual workflow
 * stage, not the five-way group.
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
  /* Last bulk decision plus its undo. The bar stays visible until the user dismisses
     it, so undo isn't racing a timer. */
  const [lastBulk, setLastBulk] = useState<{ text: string; undo: () => void } | null>(null)

  useEffect(() => writeCols('projects', cols), [cols])

  /* On mobile, the table squeezes every column until each cell wraps into a column
     of words — it stops being a table and becomes a grid of words. The card is the
     mobile row. */
  const mobile = useIsMobile()
  /* Table is the default view and cards are opt-in, because the table shows ten
     rows at once versus three for cards. Mobile is a fixed exception: at 390px the
     table squeezes every column until each cell wraps into a column of words — it
     stops being a table and becomes a grid of words. */
  const view = mobile ? 'cards' : v.view === 'cards' ? 'cards' : 'table'
  const page = Math.max(1, Number(v.page) || 1)
  const advOpen = v.adv === '1'

  /* Page size lives in the URL like the filters: sharing a link should show the
     same page with the same row count. */
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

  /* Grouping disables pagination: a group split across two pages would show false
     totals, and anyone grouping is asking for the full picture anyway. This is a
     temporary front-end limitation — once the backend does the grouping, it can
     return numbered groups with correct totals and this constraint goes away. */
  /* Grouping persists with the session instead of resetting on every sign-out. */
  useStickyGroup('projects', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const result = query.projects(grouped ? { ...q, page: 1, pageSize: 9999 } : q)
  const counts = query.projectStatusCounts(q)
  const total = fixtures.projects.length

  /* Each view's counter is absolute, because a view switches scope rather than
     filtering within one: "Unassigned 8" must stay 8 even while standing on a
     different view. */
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

  /* Domains, goals, and cities cascade like the rest of the system: choosing a
     track determines the available domains, and the domain determines the goals.
     If a parent changes, its child resets. */
  const tracks = readList(v.track)
  const fields = readList(v.field)
  const regions = readList(v.region)

  /* With multi-select, a child filter takes the union of its parents: selecting
     two tracks should show domains from both. Duplicates are removed so a domain
     shared by two tracks isn't listed twice. */
  const uniq = (xs: string[]) => [...new Set(xs)]

  /* When a parent changes, the child isn't cleared entirely — only the selections
     that fall out of scope are removed. A user who picked "Education" and then
     adds another track shouldn't lose that selection. */
  const keep = (chosen: string[], allowed: string[]) =>
    writeList(chosen.filter((x) => allowed.includes(x)))
  const fieldOptions = tracks.length
    ? uniq(tracks.flatMap((t) => FIELDS_BY_TRACK[t] ?? []))
    : uniq(Object.values(FIELDS_BY_TRACK).flat())
  const goalOptions = uniq(fields.flatMap((f) => GOALS_BY_FIELD[f] ?? []))
  const cityOptions = uniq(regions.flatMap((r) => CITIES_BY_REGION[r] ?? []))

  /* The active view is the one whose keys all match. If the user adds an extra
     filter on top, the chip stays selected — they're still within the same scope. */
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

  /* Add and remove, not replace: with grouping, a checkbox applies only to its own
     group, and selections in other groups aren't cleared. */
  const selectAll = (on: boolean, ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  /* Export scope is the current selection if any, otherwise the full filtered
     result — never just the visible page. Someone exporting wants the complete
     answer, not the first 25 rows. */
  const allFiltered = useMemo(
    () => query.projects({ ...q, page: 1, pageSize: 9999 }).rows,
    [q],
  )
  const exportRows = selected.size
    ? allFiltered.filter((r) => selected.has(r.id))
    : allFiltered

  const sheet: Sheet = useMemo(() => {
    /* The sheet is built in `sheetOf`, not here. Five screens used to hand-write the
       same three lines, and once grouping became a chain, all five would need the
       identical change — and any one that's missed ends up with a file that doesn't
       match its screen. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const parts = sheetOf(exportRows, shown, group, units.project)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-projects-${stamp}`, title: 'المشاريع', ...parts }
  }, [cols, exportRows, group])

  const exportNote = `${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${units.project(exportRows.length)}`

  /* Batch amount — the same figure as the decision bar on the project page, just
     summed. A decision on six projects isn't the same as a decision on six
     million, and the bar needs to say both before any button is pressed. */
  const selectedAmount = useMemo(
    () => allFiltered.reduce((s, r) => (selected.has(r.id) ? s + r.amountRequested : s), 0),
    [allFiltered, selected],
  )

  /* "6 projects selected" — the number lives in the badge and the label in the
     sentence, so this string has no number in it. */
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
    setLastBulk({ text: `${label}، ${units.project(ids.length)}`, undo })
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

  /* These figures are computed from the same rows shown on screen, so they can
     never contradict them. */
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

  /* Chips for active filters — each one can be removed individually. */
  /* Filters as data, not hand-laid-out JSX: customization needs to reorder and
     hide them, which isn't possible when they're hardcoded into the grid. */
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
    owner: <MultiSelect label="المالك" people values={readList(v.owner)} options={OWNERS} onChange={(x) => set({ owner: writeList(x) })} />,
  }

  const chips = (
    [
      ['status', 'الحالة'], ['stage', 'القسم'], ['year', 'السنة'], ['track', 'المسار'], ['field', 'المجال'],
      ['goal', 'الهدف'], ['region', 'المنطقة'], ['city', 'المدينة'], ['tag', 'الوسم'],
      ['method', 'الأسلوب'], ['support', 'الدعم'], ['owner', 'المالك'],
    ] as [keyof Params, string][]
  )
    /* One chip per value, not per filter: someone with three regions selected wants
       to remove just one without losing the other two. */
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
          <header>
            <div>
              <h1 className="ptitle">المشاريع</h1>
              <p className="sub mt-1">
                <span className="num">{result.total}</span> نتيجة من{' '}
                <span className="num">{total}</span> {nounAfter(total, NOUN.project)} في هذا النموذج ·{' '}
                <span className="num">4,929</span> في النظام الحالي
              </p>
            </div>

            {/* This was the only screen with no create action. It's the largest module in
                the system, holding 4,929 projects, yet there was no way to add one — only
                "Settings" in the corner implied this screen is read-only.

                Project settings are business rules, not master data: the caps inside them
                move projects from one table to another, so its entry point lives here, where
                changing it shows who's affected. */}
            <PageActions
              settings={ROUTES.projectSettings}
              create={{ label: 'مشروع جديد', to: ROUTES.projectNew }}
            />
          </header>

          {/* Quick read sits right after the title, not after the filters: it's a summary
              of the page, and a summary belongs before the tools, not wedged between them
              and the results. In the middle, it used to interrupt the path between a
              filter and what it returned — no one reads a summary line mid-filter. */}
          {/* Implementing-partner portfolios — deliberately not rows in the table. A
              portfolio is a parent entity holding projects, not a project itself: putting
              it in the list would throw off the count and expose it to filters that don't
              apply to it. It's shown here instead as a bar signaling "another kind of work
              exists" without polluting the list. */}
          {portfolios.length > 0 && (
            <Glass className="pfbar">
              <div className="pfbar-h">
                <Tag tone="mute">شريك منفّذ</Tag>
                <b>محافظ</b>
                <span className="sub">
                  خارج قائمة المشاريع · كيان أب تندرج تحته مشاريع، ولا اتفاقية له
                </span>
                <span className="pc-sp" />
                <span className="sub"><Num>{portfolios.length}</Num> محفظة</span>
              </div>
              <ul className="cfglist">
                {portfolios.map((p) => (
                  <li key={p.id}>
                    <b>{p.name}</b>
                    <span className="sub">{implementerName(p.entityId)}</span>
                    <span className="pc-sp" />
                    <span className="num">{nf.format(p.total)}</span>
                    <Tag tone="mute"><Num>{p.items.length}</Num> {nounAfter(p.items.length, NOUN.project)}</Tag>
                    <Link className="btn btn-2 btn-sm" to={ROUTES.portfolio(p.id)}>
                      افتح المحفظة
                      <Icon name={icons.chevron} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Glass>
          )}

          <QuickRead
            variant="bar"
            title="قراءة سريعة للقائمة"
            readings={readings}
            empty="لا توجد في النطاق الحالي مشاريع متجاوزة للحدّ أو بلا مالك · وسّع الفلتر لعرض المزيد."
          />

          {/* Saved views — a single row, and the primary axis: "what's on me today?" */}
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

          {/* Toolbar. */}
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
                <Icon name={icons.filter} size="sm" />
                فلاتر متقدمة
                {activeCount(NOT_FILTERS) > 0 && <b className="num">{activeCount(NOT_FILTERS)}</b>}
              </button>
              {/* Grouping is a different question from filtering: filtering reduces rows,
                  grouping reorganizes them into sub-tables with their own totals. */}
              

              </div>

              {/* Non-filter tools — a fixed group at the end of the row. They used to sit in
                  the same flex row as the filters, so whenever a filter grew or disappeared
                  the row would wrap and the view switcher would jump to another line and
                  shift horizontally. Now filters wrap within their own group, and the tools
                  stay put no matter what changes beside them. */}
              <div className="ftool-a">
                {/* Grouping is a view control, not a filter — it belongs in the view corner. It
                    used to be the last item in the filter row, so it would drop to its own line
                    alone as soon as the bar wrapped (see `PlansPage`). */}
                {view === 'table' && (
                <GroupPicker
                  icon={icons.rows}
                  value={v.group}
                  options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                  onChange={(x) => set({ group: x, page: undefined })}
                />
              )}
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
                    <Icon name={icons.gear} size="sm" />
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
                    <span className="sub">{c.label}:</span>{' '}
                    {c.k === 'owner' ? <Person name={c.value} quiet={false} /> : c.value}
                    <Icon name={icons.close} size="sm" />
                  </button>
                ))}
                {flags.map(([k, label]) => (
                  <button key={k as string} className="fpill" onClick={() => set({ [k]: undefined } as Partial<Params>)}>
                    {label}
                    <Icon name={icons.close} size="sm" />
                  </button>
                ))}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {/* Result of the last bulk decision — an inline line, not a floating bar: this
              is a confirmation read once and dismissed, and a floating bar would keep
              taking up space in front of the content after the decision is done. */}
          {lastBulk && (
            <Glass className="bulk done">
              <Icon name={icons.check} size="sm" />
              <span>{lastBulk.text}</span>
              <span className="pc-sp" />
              <button
                className="btn btn-2 btn-sm"
                onClick={() => { lastBulk.undo(); setLastBulk(null); bump((n) => n + 1) }}
              >
                <Icon name={icons.redo} size="sm" />
                تراجع
              </button>
              <button className="btn btn-2 btn-sm" onClick={() => setLastBulk(null)}>إغلاق</button>
            </Glass>
          )}

          {/* Results. */}
          {result.total === 0 ? (
            <Glass>
              <Empty
                title="لا توجد مشاريع بهذه الفلاتر."
                note="وسّع النطاق أو امسح الفلاتر الحالية."
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
                group={grouped ? group : undefined}
                count={units.project}
              />
            </Glass>
          )}

          {grouped ? (
            <p className="sub" style={{ textAlign: 'center' }}>
              التجميع يعرض كل النتائج بلا ترقيم ·{' '}
              <span className="num">{countLeaves(groupTree(result.rows, group))}</span> مجموعات ·{' '}
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

          {/* The print version now lives inside `ExportMenu` — the three export formats
              and the sheet move together. */}

          <p className="sub" style={{ textAlign: 'center', marginTop: 'var(--sp-3)' }}>
            البيانات هنا تجريبية بتوزيع يحاكي النظام الفعلي ·{' '}
            <Link to="/entities" className="lnk">انتقل إلى الجهات</Link>
          </p>
        </div>

        {/* Bulk action bar — exists because 1,253 projects in the system are
            unassigned, and assigning them one by one isn't practical. It deliberately
            mirrors the decision bar's look: same moment, same outcomes, same location. */}
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
            {/* A decision on the whole batch. The actions are the same role actions as on
                the project page, minus anything that needs a per-project target. */}
            {bulkActions.map((a) => (
              <button
                key={a.label}
                className={`btn btn-sm ${a.kind}`}
                onClick={() => runBulk(BULK_OF[a.label], a.label)}
              >
                {a.label}
              </button>
            ))}

            <Select
              value={bulkOwner}
              all="اختر المالك…"
              people
              options={OWNERS}
              onChange={setBulkOwner}
            />
            <button className="btn btn-p btn-sm" disabled={!bulkOwner} onClick={applyBulk}>
              أسند المالك
            </button>
          </BulkBar>
        )}
      </div>
    </AppLayout>
  )
}
