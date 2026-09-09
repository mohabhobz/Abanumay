import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, PAGE_SIZES, Pager, SearchBox, Segments, Select,
  Toggle, ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import {
  FilterCustomizer, SavedViews, readFilterOrder, writeFilterOrder, type FilterDef,
} from '@/components/filters'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { units } from '@/lib/format'
import { fixtures, query, type EntityQuery } from '@/data/repository'
import {
  ACTIVATIONS, CITIES_BY_REGION, ENTITY_TYPES, GOVERNANCE, LICENSORS, REGIONS,
} from '@/data/mock/taxonomy'
import { ROUTES } from '@/app/routes'
import { QuickRead } from '@/components/assistant'
import { readEntities } from '@/data/readings'
import { EntityCard } from './EntityCard'
import { COLS, GROUPS, groupByKey } from './columns'
import { DataTable, aggregate, orderCols, readCols, splitGroups, writeCols } from '@/components/table'
import { exportPng, exportXlsx, printArea, type Sheet } from '@/lib/export'
import { PrintSheet } from '@/features/projects/list/PrintSheet'

const KEYS = [
  'q', 'activation', 'type', 'licensor', 'region', 'city', 'governance',
  'docs', 'running', 'sort', 'page', 'size', 'view', 'adv', 'group',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = PAGE_SIZES[0]

/** ترتيب الفلاتر الافتراضي — نفس ترتيب `FILTER_DEFS` جوّه الكومبوننت */
const FILTER_KEYS = ['type', 'licensor', 'region', 'city', 'governance']

const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'size', 'view', 'adv', 'group', 'activation', 'docs', 'running',
]

/** اللقطات المحفوظة — الأسئلة اللي بتوقف الشغل فعلًا */
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
 * الجهات.
 *
 * الفلاتر هنا مش نسخة من فلاتر النظام: هي الأسئلة اللي بتوقف الشغل
 * فعلًا — مين معلّق؟ مين ملفه ناقص؟ مين شغّال معانا دلوقتي؟
 * والباقي (النوع · المرخِّص · الحوكمة · المنطقة) مطوي خلف عدّاد.
 */
export default function EntitiesListPage() {
  const { values: v, set, replace, clear, activeCount, snapshot, applyQuery } =
    useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const [cols, setCols] = useState<string[]>(() => readCols('entities', COLS))
  const [custom, setCustom] = useState(false)
  const [fOrder, setFOrder] = useState<string[]>(() => readFilterOrder('entities', FILTER_KEYS))

  useEffect(() => writeFilterOrder('entities', fOrder), [fOrder])
  const [exportOpen, setExportOpen] = useState(false)
  const exportBox = useRef<HTMLDivElement>(null)

  useEffect(() => writeCols('entities', cols), [cols])

  useEffect(() => {
    if (!exportOpen) return
    const away = (e: PointerEvent) => {
      if (!exportBox.current?.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [exportOpen])

  /* زي المشاريع: الجدول محتاج عرض ما بيتوفرش على الموبايل */
  const mobile = useIsMobile()
  /* زي المشاريع: الجدول ديفولت، والكروت اختيار، والموبايل كروت دايمًا */
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

  /* زي المشاريع: التجميع بيلغي الترقيم لأن المجموعة المقطوعة على
     صفحتين إجمالياتها كذّابة. */
  const group = groupByKey(v.group)
  const grouped = Boolean(group)

  const result = query.entities(grouped ? { ...q, page: 1, pageSize: 9999 } : q)
  const all = fixtures.entities

  /** عدّاد التفعيل جوّه النطاق الحالي — بيغذّي قائمة «كل الحالات» */
  const counts = useMemo(() => {
    const base = query.entities({ ...q, activation: undefined, page: 1, pageSize: 9999 }).rows
    const out: Record<string, number> = {}
    for (const e of base) out[e.activation] = (out[e.activation] ?? 0) + 1
    return out
  }, [q])

  /** عدّاد اللقطات مطلق — اللقطة مبدّل نطاق مش فلتر جوّه النطاق */
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

  /* نطاق التصدير: نتيجة الفلتر كاملة لا صفحة العرض */
  const allFiltered = useMemo(
    () => query.entities({ ...q, page: 1, pageSize: 9999 }).rows,
    [q],
  )

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group || c.key !== group.key)
    const head = [...(group ? [group.label] : []), ...shown.map((c) => c.label)]
    const body = allFiltered.map((e) => [
      ...(group ? [group.of(e)] : []),
      ...shown.map((c) => c.text(e)),
    ])
    const totals = [
      ...(group ? [''] : []),
      ...shown.map((c, i) => {
        const t = aggregate(c, allFiltered)
        return t !== null ? String(t) : i === 0 ? units.entity(allFiltered.length) : ''
      }),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-entities-${stamp}`, title: 'الجهات', headers: head, rows: body, totals }
  }, [cols, allFiltered, group])

  const exportNote = `نتيجة الفلتر الحالي · ${units.entity(allFiltered.length)}`

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
    [['docs', 'ملف ناقص'], ['running', 'لها مشاريع تشغيل']] as [keyof Params, string][]
  ).filter(([k]) => v[k] === '1')

  return (
    <AppLayout assistantContext={assistFor.page('الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          <nav className="crumb" aria-label="مسار التنقّل">
            <span className="now">الجهات</span>
          </nav>

          <header>
            <div>
              <h1 className="ptitle">الجهات</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{result.total}</span> نتيجة من{' '}
                <span className="num">{all.length}</span> جهة في هذا النموذج ·{' '}
                <span className="num">3,272</span> في النظام العامل
              </p>
            </div>
          </header>

          {/* ═══ اللقطات المحفوظة — صفّ واحد ═══ */}
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
              <Toggle label="لها مشاريع تشغيل" on={v.running === '1'} onChange={(on) => set({ running: on ? '1' : undefined })} />
              <button
                className={`fchip${advOpen ? ' on' : ''}`}
                onClick={() => set({ adv: advOpen ? undefined : '1' })}
                aria-expanded={advOpen}
              >
                <Icon path={icons.filter} size={15} />
                فلاتر متقدمة
                {activeCount(NOT_FILTERS) > 0 && <b className="num">{activeCount(NOT_FILTERS)}</b>}
              </button>
              {view === 'table' && (
                <Select
                  icon={icons.rows}
                  value={v.group}
                  all="بلا تجميع"
                  options={GROUPS.map((g) => ({ value: g.key, label: `تجميع حسب ${g.label}` }))}
                  onChange={(x) => set({ group: x, page: undefined })}
                />
              )}

              <SavedViews table="entities" current={snapshot()} onApply={applyQuery} />

              <div className="fexp" ref={exportBox}>
                <button
                  className={`fchip${exportOpen ? ' on' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  onClick={() => setExportOpen((x) => !x)}
                >
                  <Icon path={icons.down} size={15} />
                  تصدير
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
                <ViewToggle view={view} onChange={(x) => set({ view: x === 'table' ? undefined : x })} />
              )}
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
                    <Icon path={icons.gear} size={13} />
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

          <QuickRead variant="bar" title="قراءة سريعة للقائمة" readings={readings} />

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
            <Glass className="tblcard" style={{ padding: '.4rem' }}>
              <DataTable
                rows={result.rows}
                all={COLS}
                cols={cols}
                onCols={setCols}
                id={(e) => e.id}
                onOpen={(e) => navigate(ROUTES.entity(e.id))}
                group={group}
                count={units.entity}
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

          <PrintSheet sheet={sheet} note={exportNote} />
        </div>
      </div>
    </AppLayout>
  )
}
