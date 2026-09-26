import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, Money, MultiSelect, GroupPicker, PAGE_SIZES, Pager, SearchBox, Segments,
  Select, Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useStickyGroup } from '@/hooks/useStickyGroup'
import {
  FilterCustomizer, SavedViews, readFilterOrder, writeFilterOrder, type FilterDef,
} from '@/components/filters'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { NOUN, nounAfter, plural, units } from '@/lib/format'
import { fixtures, query, type EntityQuery } from '@/data/repository'
import {
  ACTIVATIONS, CITIES_BY_REGION, ENTITY_TYPES, GOVERNANCE, LICENSORS, REGIONS,
} from '@/data/mock/taxonomy'
import { ROUTES } from '@/app/routes'
import { ENTITY_CREATE_LABEL } from './labels'
import { QuickRead } from '@/components/assistant'
import { BulkBar, PageActions } from '@/components/shell'
import { readEntities } from '@/data/readings'
import { regKpi } from '@/data/mock/registration'
import { EntityCard } from './EntityCard'
import { COLS, GROUPS } from './columns'
import {
  DataTable, countLeaves, groupChain, groupTree, orderCols, readCols, sheetOf, writeCols,
} from '@/components/table'
import { exportPng, exportXlsx, printArea, type Sheet } from '@/lib/export'
import { ExportMenu } from '@/components/export'

const KEYS = [
  'q', 'activation', 'type', 'licensor', 'region', 'city', 'governance',
  'docs', 'running', 'sort', 'page', 'size', 'view', 'adv', 'group',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = PAGE_SIZES[0]

/** Default filter order - matches `FILTER_DEFS`'s order inside the component. */
const FILTER_KEYS = ['type', 'licensor', 'region', 'city', 'governance']

const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'size', 'view', 'adv', 'group', 'activation', 'docs', 'running',
]

/** Saved views - the questions that actually block work. */
const VIEWS: { key: string; label: string; patch: Partial<Params> }[] = [
  { key: 'all', label: 'كل الجهات', patch: {} },
  { key: 'new', label: 'بانتظار التفعيل', patch: { activation: 'معلق (جديد)' } },
  { key: 'held', label: 'موقوفة', patch: { activation: 'معلق (موقوف)' } },
  { key: 'docs', label: 'ملفها ناقص', patch: { docs: '1' } },
]

const SORTS = [
  { key: 'granted', label: 'الأكثر دعمًا' },
  { key: 'projects', label: 'الأكثر مشاريع' },
  { key: 'newest', label: 'الأحدث تسجيلًا' },
  { key: 'name', label: 'الاسم' },
] as const

/**
 * Entities.
 *
 * The filters here aren't a copy of system filters: they're the questions that actually block work
 * - who's pending? whose file is incomplete? who's active with us right now? Everything else (type,
 * licensor, governance, region) is tucked behind a counter.
 */
export default function EntitiesListPage() {
  const { values: v, set, replace, clear, activeCount, snapshot, applyQuery } =
    useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const [cols, setCols] = useState<string[]>(() => readCols('entities', COLS))
  const [custom, setCustom] = useState(false)
  const [fOrder, setFOrder] = useState<string[]>(() => readFilterOrder('entities', FILTER_KEYS))

  useEffect(() => writeFilterOrder('entities', fOrder), [fOrder])
  /* Selection here scopes an export, not a decision: an entity has no "approve" or "reject" applied
     in bulk - activating or suspending one is a decision made in its own file. So the bar states
     the selection and exports it, nothing more. */
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('entities', cols), [cols])

  /* Same as projects: the table needs width that isn't available on mobile. */
  const mobile = useIsMobile()
  /* Same as projects: table is the default, cards are optional, and mobile is always cards. */
  const view = mobile ? 'cards' : v.view === 'cards' ? 'cards' : 'table'
  const page = Math.max(1, Number(v.page) || 1)
  const advOpen = v.adv === '1'

  const size = Math.min(500, Math.max(1, Number(v.size) || PAGE_SIZE))

  const q: EntityQuery = useMemo(
    () => ({
      search: v.q,
      activation: readList(v.activation),
      type: readList(v.type),
      licensor: readList(v.licensor),
      region: readList(v.region),
      city: readList(v.city),
      governance: readList(v.governance),
      docsIncomplete: v.docs === '1',
      hasRunning: v.running === '1',
      sort: (v.sort as EntityQuery['sort']) ?? 'granted',
      page,
      pageSize: size,
    }),
    [v, page, size],
  )

  /* Same as projects: grouping disables pagination, since a group split across two pages gives
     misleading totals. */
  /* Grouping persists with the session instead of resetting on every logout. */
  useStickyGroup('entities', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const result = query.entities(grouped ? { ...q, page: 1, pageSize: 9999 } : q)
  const all = fixtures.entities
  /* Open-requests counter - shown on the registration-requests button. */
  const reg = regKpi()

  /** Activation counter within the current scope - feeds the "all statuses" list. */
  const counts = useMemo(() => {
    const base = query.entities({ ...q, activation: undefined, page: 1, pageSize: 9999 }).rows
    const out: Record<string, number> = {}
    for (const e of base) out[e.activation] = (out[e.activation] ?? 0) + 1
    return out
  }, [q])

  /** The saved-views counter is absolute - a view switches scope rather than filtering within one. */
  const viewCounts = useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((x) => [
          x.key,
          query.entities({
            activation: x.patch.activation,
            docsIncomplete: x.patch.docs === '1',
            pageSize: 1,
          }).total,
        ]),
      ) as Record<string, number>,
    [],
  )

  const activeView =
    VIEWS.find(
      (x) =>
        x.key !== 'all' &&
        Object.entries(x.patch).every(([k, val]) => v[k as keyof Params] === val),
    )?.key ?? 'all'

  const regions = readList(v.region)
  const uniq = (xs: string[]) => [...new Set(xs)]
  const cityOptions = uniq(regions.flatMap((r) => CITIES_BY_REGION[r] ?? []))
  const keep = (chosen: string[], allowed: string[]) =>
    writeList(chosen.filter((x) => allowed.includes(x)))

  const readings = useMemo(
    () =>
      readEntities(
        all,
        query.entities({ ...q, page: 1, pageSize: 9999 }).rows,
        activeCount(['sort', 'page', 'view', 'adv']) > 0 || Boolean(v.q),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, all],
  )

  /* Export scope: the full filtered result, not the visible page - unless the user has marked rows,
     in which case the selection is what's meant. */
  const allFiltered = useMemo(
    () => query.entities({ ...q, page: 1, pageSize: 9999 }).rows,
    [q],
  )
  const exportRows = selected.size
    ? allFiltered.filter((e) => selected.has(e.id))
    : allFiltered

  const sheet: Sheet = useMemo(() => {
    /* Note: the sheet is built in `sheetOf`, not here. Five screens used to write the same three
       lines by hand; once grouping became a pipeline, all five would have needed the same change
       five times, and a missed one would end up out of sync with its own screen. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const parts = sheetOf(exportRows, shown, group, units.entity)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-entities-${stamp}`, title: 'الجهات', ...parts }
  }, [cols, exportRows, group])

  const exportNote = `${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${units.entity(exportRows.length)}`

  const toggleOne = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  /* Add and remove, not replace: with grouping on, the bar only concerns its own group, and
     selections in another group stay untouched. */
  const selectAll = (on: boolean, ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const selectedGranted = useMemo(
    () => allFiltered.reduce((sum, e) => (selected.has(e.id) ? sum + e.grantedTotal : sum), 0),
    [allFiltered, selected],
  )

  const selectedNoun = plural(selected.size, {
    one: 'جهة محدَّدة',
    two: 'جهتان محدَّدتان',
    few: () => 'جهات محدَّدة',
    many: () => 'جهة محدَّدة',
  })

  const FILTER_DEFS: FilterDef[] = [
    { key: 'type', label: 'نوع الجهة' },
    { key: 'licensor', label: 'الجهة المرخِّصة' },
    { key: 'region', label: 'المنطقة' },
    { key: 'city', label: 'المدينة' },
    { key: 'governance', label: 'درجة الحوكمة' },
  ]

  const FILTERS: Record<string, ReactNode> = {
    type: <MultiSelect label="نوع الجهة" values={readList(v.type)} options={ENTITY_TYPES} onChange={(x) => set({ type: writeList(x) })} />,
    licensor: <MultiSelect label="الجهة المرخِّصة" values={readList(v.licensor)} options={LICENSORS} onChange={(x) => set({ licensor: writeList(x) })} />,
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
    governance: <MultiSelect label="درجة الحوكمة" values={readList(v.governance)} options={GOVERNANCE} onChange={(x) => set({ governance: writeList(x) })} />,
  }

  const chips = (
    [
      ['activation', 'التفعيل'], ['type', 'النوع'], ['licensor', 'المرخِّص'], ['region', 'المنطقة'],
      ['city', 'المدينة'], ['governance', 'الحوكمة'],
    ] as [keyof Params, string][]
  )
    .flatMap(([k, label]) => readList(v[k]).map((value) => ({ k, label, value })))

  const flags = (
    [['docs', 'ملف ناقص'], ['running', 'لها مشاريع تحت التشغيل']] as [keyof Params, string][]
  ).filter(([k]) => v[k] === '1')

  return (
    <AppLayout assistantContext={assistFor.entities()}>
      <div className={`viewstack${selected.size > 0 ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الجهات</h1>
              <p className="sub mt-1">
                <span className="num">{result.total}</span> نتيجة من{' '}
                <span className="num">{all.length}</span> {nounAfter(all.length, NOUN.entity)} في هذا النموذج ·{' '}
                <span className="num">3,272</span> في النظام العامل
              </p>
            </div>

            {/* Registration entry point.
                Note: these two buttons aren't the same action, which is exactly why both exist.
                "Register a new entity" opens the entity's own form (a public portal outside login
                in the live system), and "registration requests" opens our review role. What
                separates them is that a request isn't an entity, so the two can't lead to the same
                screen. */}
            {/* Note: the order isn't this screen's choice - it's a contract defined once in
                `PageActions`: settings -> secondary -> create, in the corner. Entities happened to
                be the closest screen to that contract already, and everything else was aligned to
                match it. */}
            <PageActions
              settings={ROUTES.entitySettings}
              secondary={[{
                label: 'طلبات التسجيل', to: ROUTES.entityRequests,
                icon: 'doc', count: reg.open,
              }]}
              /* Note: this button leads to direct registration, not the entity portal - whoever's
                 using this is a grants supervisor inside the system registering a partner they
                 manage themselves (rule 32). The entity portal's entry point is the login screen,
                 since its owner has no account yet. */
              create={{ label: ENTITY_CREATE_LABEL, to: ROUTES.entityNew }}
            />
          </header>

          {/* Quick read.
              Placed right after the title, not after the filters: this is a reading of the page,
              and a reading comes before the tools, not between a filter and its result. It used to
              sit between a filter and what it returned, and no one reads a summary line while still
              holding a filter. */}
          <QuickRead
            variant="bar"
            title="قراءة سريعة للقائمة"
            readings={readings}
            empty="ملفات الجهات في النطاق الحالي مكتملة وتراخيصها سارية · وسّع الفلتر لعرض المزيد."
          />

          {/* Saved views - one row */}
          <Segments
            active={activeView}
            onChange={(k) => {
              const next = VIEWS.find((x) => x.key === k) ?? VIEWS[0]
              replace({ ...next.patch, view: v.view })
            }}
            items={VIEWS.map((x) => ({ key: x.key, label: x.label, count: viewCounts[x.key] }))}
          />

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
              <SearchBox
                value={v.q ?? ''}
                onChange={(x) => set({ q: x })}
                placeholder="ابحث باسم الجهة أو رقم الترخيص…"
              />
              <MultiSelect
                values={readList(v.activation)}
                all={`كل حالات التفعيل (${result.total})`}
                options={ACTIVATIONS.filter((a) => counts[a]).map((a) => ({
                  value: a,
                  label: `${a} (${counts[a]})`,
                }))}
                onChange={(x) => set({ activation: writeList(x) })}
              />
              <Select
                icon={icons.sort}
                value={v.sort ?? 'granted'}
                all={SORTS[0].label}
                options={SORTS.slice(1).map((x) => ({ value: x.key, label: x.label }))}
                onChange={(x) => set({ sort: x })}
              />
              <Toggle label="لها مشاريع تحت التشغيل" on={v.running === '1'} onChange={(on) => set({ running: on ? '1' : undefined })} />
              <button
                className={`fchip${advOpen ? ' on' : ''}`}
                onClick={() => set({ adv: advOpen ? undefined : '1' })}
                aria-expanded={advOpen}
              >
                <Icon name={icons.filter} size="sm" />
                فلاتر متقدمة
                {activeCount(NOT_FILTERS) > 0 && <b className="num">{activeCount(NOT_FILTERS)}</b>}
              </button>
              

              </div>

              {/* Tools that aren't filters - a fixed group at the end of the row. These used to
                  share the same flexible row as the filters, so as soon as one filter grew or
                  disappeared, the row wrapped and the view switcher jumped to a new line and
                  shifted horizontally. Filters now wrap within their own group, and the tools stay
                  put no matter what changes next to them. */}
              <div className="ftool-a">
                {/* Note: grouping is a display control, not a filter - it belongs in the view
                    corner. As the last filter row it used to drop to its own line once the bar
                    wrapped (see `PlansPage`). */}
                {view === 'table' && (
                <GroupPicker
                  icon={icons.rows}
                  value={v.group}
                  options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                  onChange={(x) => set({ group: x, page: undefined })}
                />
              )}
              <SavedViews table="entities" current={snapshot()} onApply={applyQuery} />

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
                      set({ [c.k]: writeList(readList(v[c.k]).filter((x) => x !== c.value)) } as Partial<Params>)
                    }
                  >
                    <span className="sub">{c.label}:</span> {c.value}
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

          {result.total === 0 ? (
            <Glass>
              <Empty
                title="لا توجد جهات بهذه الفلاتر."
                note="جرّب توسيع النطاق أو امسح الفلاتر الحالية."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'cards' ? (
            <div className="elist">
              {result.rows.map((e) => <EntityCard key={e.id} row={e} />)}
            </div>
          ) : (
            <Glass className="tblcard">
              <DataTable
                rows={result.rows}
                all={COLS}
                table="entities"
                cols={cols}
                onCols={setCols}
                id={(e) => e.id}
                selected={selected}
                onSelect={toggleOne}
                onSelectAll={selectAll}
                onOpen={(e) => navigate(ROUTES.entity(e.id))}
                group={grouped ? group : undefined}
                count={units.entity}
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

        </div>

        {/* Same toolbar as projects, with entity-specific actions: export only. */}
        {selected.size > 0 && (
          <BulkBar
            count={selected.size}
            onClear={() => setSelected(new Set())}
            sentence={
              <>
                {selectedNoun}
                <span className="decsep" />
                الدعم التراكمي <Money>{selectedGranted}</Money>
              </>
            }
          >
            <button className="btn btn-2 btn-sm" onClick={() => exportXlsx(sheet)}>
              <Icon name={icons.export} size="sm" />
              إكسل
            </button>
            <button className="btn btn-2 btn-sm" onClick={() => setTimeout(printArea, 60)}>
              PDF
            </button>
            <button className="btn btn-2 btn-sm" onClick={() => exportPng(sheet)}>
              صورة
            </button>
          </BulkBar>
        )}
      </div>
    </AppLayout>
  )
}
