import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, Mono, Pager, Riyal, SearchBox, Segments, Select, Tag, Toggle,
  ViewToggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import { ENTITY_DOCS_TOTAL, fixtures, query, type EntityQuery } from '@/data/repository'
import {
  ACTIVATIONS, CITIES_BY_REGION, ENTITY_TYPES, GOVERNANCE, LICENSORS, REGIONS,
} from '@/data/mock/taxonomy'
import { ROUTES } from '@/app/routes'
import { QuickRead } from '@/components/assistant'
import { readEntities } from '@/data/readings'
import { EntityCard } from './EntityCard'
import { activationTone, governanceTone } from '@/lib/tone'

const KEYS = [
  'q', 'activation', 'type', 'licensor', 'region', 'city', 'governance',
  'docs', 'running', 'sort', 'page', 'view', 'adv',
] as const

type Params = Record<(typeof KEYS)[number], string | undefined>

const PAGE_SIZE = 12

const NOT_FILTERS: (keyof Params)[] = [
  'q', 'sort', 'page', 'view', 'adv', 'activation', 'docs', 'running',
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
  const { values: v, set, replace, clear, activeCount } = useQueryParams<Params>(KEYS)

  /* زي المشاريع: الجدول محتاج عرض ما بيتوفرش على الموبايل */
  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const page = Math.max(1, Number(v.page) || 1)
  const advOpen = v.adv === '1'

  const q: EntityQuery = useMemo(
    () => ({
      search: v.q,
      activation: v.activation,
      type: v.type,
      licensor: v.licensor,
      region: v.region,
      city: v.city,
      governance: v.governance,
      docsIncomplete: v.docs === '1',
      hasRunning: v.running === '1',
      sort: (v.sort as EntityQuery['sort']) ?? 'granted',
      page,
      pageSize: PAGE_SIZE,
    }),
    [v, page],
  )

  const result = query.entities(q)
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

  const cityOptions = v.region ? (CITIES_BY_REGION[v.region] ?? []) : []

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

  const chips = (
    [
      ['activation', 'التفعيل'], ['type', 'النوع'], ['licensor', 'المرخِّص'], ['region', 'المنطقة'],
      ['city', 'المدينة'], ['governance', 'الحوكمة'],
    ] as [keyof Params, string][]
  )
    .filter(([k]) => v[k])
    .map(([k, label]) => ({ k, label, value: v[k] as string }))

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
              <Select
                value={v.activation}
                all={`كل حالات التفعيل (${result.total})`}
                options={ACTIVATIONS.filter((a) => counts[a]).map((a) => ({
                  value: a,
                  label: `${a} (${counts[a]})`,
                }))}
                onChange={(x) => set({ activation: x })}
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
              <span className="ftool-sp" />
              {!mobile && (
                <ViewToggle view={view} onChange={(x) => set({ view: x === 'cards' ? undefined : x })} />
              )}
            </div>

            {advOpen && (
              <div className="fgrid">
                <Select label="نوع الجهة" value={v.type} options={ENTITY_TYPES} onChange={(x) => set({ type: x })} />
                <Select label="الجهة المرخِّصة" value={v.licensor} options={LICENSORS} onChange={(x) => set({ licensor: x })} />
                <Select label="المنطقة" value={v.region} options={REGIONS} onChange={(x) => set({ region: x, city: undefined })} />
                <Select label="المدينة" value={v.city} options={cityOptions} onChange={(x) => set({ city: x })} disabled={!v.region} all={v.region ? 'الكل' : 'اختر المنطقة أولًا'} />
                <Select label="درجة الحوكمة" value={v.governance} options={GOVERNANCE} onChange={(x) => set({ governance: x })} />
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
            <Glass style={{ padding: '.4rem' }}>
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>الترخيص</th>
                      <th>الجهة</th>
                      <th>النوع</th>
                      <th>المنطقة</th>
                      <th>التفعيل</th>
                      <th>الحوكمة</th>
                      <th className="n">المستندات</th>
                      <th className="n">تشغيل</th>
                      <th className="n">إجمالي الممنوح</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((e) => (
                      <tr key={e.id}>
                        <td><Mono>{e.licenseNo}</Mono></td>
                        <td><Link className="tlink" to={ROUTES.entity(e.id)}>{e.name}</Link></td>
                        <td className="sub">{e.type}</td>
                        <td className="sub">{e.region}</td>
                        <td><Tag tone={activationTone(e.activation)}>{e.activation}</Tag></td>
                        <td><Tag tone={governanceTone(e.governance)}>{e.governance}</Tag></td>
                        <td className={`n num${e.docsUploaded < ENTITY_DOCS_TOTAL ? ' over' : ''}`}>
                          {e.docsUploaded}/{ENTITY_DOCS_TOTAL}
                        </td>
                        <td className="n num">{e.projectsRunning}</td>
                        <td className="n num">{nf.format(e.grantedTotal)} <Riyal /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}

          <Pager
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPage={(p) => set({ page: String(p) })}
          />
        </div>
      </div>
    </AppLayout>
  )
}
