import { useEffect, useMemo, useState } from 'react'
import { regTrends } from '@/data/shared/ai'
import { useNavigate } from 'react-router-dom'
import { ButtonLink, Button, StatRow,
  DateField, DateText, Empty, Glass, Icon, icons, GroupPicker, MultiSelect, Num, SearchBox, Segments, Stat,
  Toggle, ViewToggle,
} from '@/components/ui'
import { countOf, NOUN, nounAfter, pct, REQUEST_NOUN } from '@/lib/format'
import { AppLayout } from '@/app/layout/AppLayout'
import { Crumbs } from '@/components/shell'
import { ENTITY_CREATE_LABEL } from '../labels'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useStickyGroup } from '@/hooks/useStickyGroup'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { QuickRead } from '@/components/assistant'
import {
  DataTable, countLeaves, groupChain, groupTree, orderCols, readCols, sheetOf, writeCols, readSort, writeSort, nextSort, sortRows,
} from '@/components/table'
import { ExportMenu } from '@/components/export'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { readRegRequests } from '@/data/readings'
import { ENTITY_TYPES } from '@/data/mock/taxonomy'
import {
  REG_STATES, REG_STATE_SAY, regKpi, regMissingDocs, regRows, type RegRequest as RegRow, type RegState,
} from '@/data/mock/registration'
import type { Sheet } from '@/lib/export'
import { RegCard } from './RegCard'
import { COLS, GROUPS } from './columns'
import { OUTCOME_PICK_SAY, outcomeMatches, outcomeOptions, regOutcome, type OutcomePick } from '@/data/shared/outcome'
import { useEntityFlow } from '@/data/entities/store'

const KEYS = ['q', 'state', 'type', 'region', 'city', 'lic', 'from', 'to', 'short', 'res', 'view', 'group', 'adv', 'ord'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Registration request inbox.

   Note: this inbox isn't "new entities". Rule 2 states no account is created before approval, so
   what's in the inbox are requests from parties outside the institution, and the entity is
   generated at the end of the chain, not the start. That difference is the whole reason this screen
   exists separately: the entities page shows a record, this one shows a review role.

   === Six inboxes in the live system, tabs here ===

   The system distributes requests across `dept_accept_all`, `_new`, `_edit`, `_reject`, `_stopped`
   and `_notaccept` - six sidebar entries for the same table with a different filter. The spec has a
   single status with five values (rule 26), so the tabs are the inboxes.

   Note: `dept_accept_edit` isn't one of these. It's most likely update requests for an existing
   entity's data - i.e. the other sub-process (19 steps), not registration. Logged as an open
   question, and not built here. */

const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'state', 'short']

/* Client 23 Oct · the inbox filters like the projects list · region, city, technical-oversight
   authority and the submission date, alongside classification and the short-file toggle. One
   predicate for the rows and the tab counts, so a count never disagrees with its list. */
const passes = (r: RegRow, v: Params, skipRes = false): boolean => {
  /* Client sheet 24 Oct (#95) · the request's outcome */
  if (!skipRes && !outcomeMatches(regOutcome(r.state), readList(v.res))) return false
  const needle = v.q?.trim()
  const types = readList(v.type)
  const regions = readList(v.region)
  const cities = readList(v.city)
  const lics = readList(v.lic)
  if (types.length && !types.includes(r.type)) return false
  if (regions.length && !regions.includes(r.region)) return false
  if (cities.length && !cities.includes(r.city)) return false
  if (lics.length && !lics.includes(r.licensor)) return false
  if (v.from && r.submittedAt < v.from) return false
  if (v.to && r.submittedAt > v.to) return false
  if (v.short === '1' && regMissingDocs(r).length === 0) return false
  if (needle && !`${r.id} ${r.name} ${r.licenseNo} ${r.clerkName}`.includes(needle)) return false
  return true
}

export default function RequestsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const ver = useEntityFlow()
  const k = regKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('reg-requests', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('reg-requests', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const rows = useMemo(() => {
    void ver /* the rows are mutable · a flow action re-reads them */
    const states = readList(v.state)
    return regRows.filter((r) => (!states.length || states.includes(r.state)) && passes(r, v))
  }, [v, ver])
  /* The filter without its outcome pick · the «النتيجة» options count over it */
  const resBase = useMemo(() => {
    void ver
    const states = readList(v.state)
    return regRows.filter((r) => (!states.length || states.includes(r.state)) && passes(r, v, true))
  }, [v, ver])

  /* Oldest submission first - the inbox is a review role, and a review role goes by date · a click
     on a column header re-orders by that column instead (2.4.23) */
  const ord = readSort(v.ord)
  const sorted = useMemo(
    () => sortRows([...rows].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)), COLS, ord),
    [rows, ord],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => [...readRegRequests(rows, filtered), ...regTrends()], [rows, filtered])

  /** Count per status within the current scope - excluding the status filter itself. */
  const counts = useMemo(() => {
    void ver
    const base = regRows.filter((r) => passes(r, v))
    const m = new Map<RegState, number>()
    for (const r of base) m.set(r.state, (m.get(r.state) ?? 0) + 1)
    return { m, total: base.length }
  }, [v, ver])

  /* Grouping persists with the session instead of resetting on every sign-out. */
  useStickyGroup('reg-requests', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const sheet: Sheet = useMemo(() => {
    /* Note: the sheet is built in `sheetOf`, not here. Five screens used to write the same three
       lines by hand, and once the totals became a chain, all five would have needed the same edit
       five times - and whichever gets missed ends up mismatched with its own screen. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pickRows = selected.size ? sorted.filter((r) => selected.has(r.id)) : sorted
    const parts = sheetOf(pickRows, shown, group, (n: number) => `${countOf(n, NOUN.request)}`)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-registration-${stamp}`, title: 'طلبات تسجيل الجهات', ...parts }
  }, [cols, sorted, selected, group])

  const toggleOne = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const selectAll = (on: boolean, ids: string[]) =>
    setSelected((s) => {
      const next = new Set(s)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const chips = (
    [['state', 'الحالة'], ['type', 'التصنيف'], ['region', 'المنطقة'], ['city', 'المدينة'], ['lic', 'جهة الإشراف'], ['res', 'النتيجة']] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text: key === 'state' ? REG_STATE_SAY[value as RegState] ?? value : key === 'res' ? OUTCOME_PICK_SAY[value as OutcomePick] ?? value : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('طلبات تسجيل الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          {/* Note: this page is a child of "Entities" (opened from the "Registration requests"
              button there) - it used to have no breadcrumb, so users had no way back except the
              rail. Same `Crumbs` as the entity and review pages. */}
          <Crumbs items={[{ label: 'الجهات', to: ROUTES.entities }, { label: 'طلبات التسجيل' }]} />
          <header>
            <div>
              <h1 className="ptitle">طلبات تسجيل الجهات</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> {nounAfter(rows.length, REQUEST_NOUN)} من{' '}
                <span className="num">{regRows.length}</span> ·{' '}
                <span className="num">{k.open}</span> تحت المراجعة
              </p>
            </div>
            {/* Note: same action, name, and destination as on "Entities". Here it was "Register a
                new entity" leading to the general entity form, and there "New entity registration"
                leading to direct registration - two buttons for the same intent, with different
                names and destinations. Whoever's here is staff, so the destination is direct
                registration (rule 32), and the name is an imperative, per the writing guide. */}
            <ButtonLink variant="p" to={ROUTES.entityNew}>
              <Icon name={icons.plus} size="sm" />
              {ENTITY_CREATE_LABEL}
            </ButtonLink>
          </header>

          <QuickRead
            variant="bar"
            title="قراءة سريعة للطلبات"
            readings={readings}
            empty="ملفات الطلبات في النطاق الحالي مكتملة، ولا يوجد طلب متوقف."
          />

          {/* Note: these four come from the process's six indicators - the remaining two (request
              count and rejection rate) appear in the title and closing line, so they aren't
              repeated as cards. */}
          <StatRow title="مؤشرات طلبات التسجيل">
            <Stat
              label="نسبة الطلبات المعتمدة"
              value={<Num>{pct(k.approvedPct)}</Num>}
              hint="من الطلبات المرسَلة، لا المسودات"
              bar={{ w: `${k.approvedPct}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة المراجعة"
              value={<Num>{k.avgDays}</Num>}
              unit="أيام"
            />
            <Stat
              label="المعادة للاستكمال"
              value={<Num>{pct(k.backPct)}</Num>}
              bar={{ w: `${k.backPct}%`, c: 'var(--warn)' }}
            />
            <Stat
              label="اكتمال ملفات المستندات"
              value={<Num>{pct(k.filePct)}</Num>}
              bar={{ w: `${k.filePct}%`, c: 'var(--ch-1)' }}
            />
          </StatRow>

          <Segments
            active={readList(v.state).length === 1 ? readList(v.state)[0] : ''}
            onChange={(x) => set({ state: writeList(x ? [x] : []) })}
            items={[
              { key: '', label: 'كل الطلبات', count: counts.total },
              ...REG_STATES.map((s) => ({
                key: s.key,
                label: s.label,
                count: counts.m.get(s.key) ?? 0,
              })),
            ]}
          />

          {/* `#list` is where the quick read's links land (filter + scroll). */}
          <Glass className="ftoolbar" id="list">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox
                  value={v.q ?? ''}
                  onChange={(x) => set({ q: x || undefined })}
                  placeholder="ابحث برقم الطلب أو اسم الجهة أو رقم الترخيص…"
                />
                {/* Note: no `label` - the rule is documented at `.fsel-b`: a dropdown inside the
                    toolbar takes the tab's visual shape so the whole row reads as one language,
                    with no heading above it. This screen was the only one sending a heading, so
                    this field ran longer than its neighbors with a heading floating above the row -
                    and the name is already in `all` ("All categories"). */}
                <MultiSelect
                  values={readList(v.type)}
                  all={`كل التصنيفات (${ENTITY_TYPES.length})`}
                  options={ENTITY_TYPES as unknown as string[]}
                  onChange={(x) => set({ type: writeList(x) })}
                />
                <Toggle
                  label="ملفها ناقص"
                  on={v.short === '1'}
                  onChange={(on) => set({ short: on ? '1' : undefined })}
                />
                <Button plain
                  className={`fchip${advOpen ? ' on' : ''}`}
                  onClick={() => set({ adv: advOpen ? undefined : '1' })}
                  aria-expanded={advOpen}
                >
                  <Icon name={icons.filter} size="sm" />
                  فلاتر متقدمة
                  {activeCount(NOT_FILTERS) > 0 && (
                    <b className="num">{activeCount(NOT_FILTERS)}</b>
                  )}
                </Button>
              </div>

              <div className="ftool-a">
                {/* Note: grouping is a display control, not a filter - it belongs in the display
                    corner; it used to be the filter row's last item, so it dropped to its own line
                    as soon as the bar wrapped (see `PlansPage`). */}
                {view === 'table' && (
                <GroupPicker
                  icon={icons.rows}
                  value={v.group}
                  options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                  onChange={(x) => set({ group: x })}
                />
                )}
                <ExportMenu
                  sheet={sheet}
                  note={`${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${countOf(selected.size || sorted.length, NOUN.request)}`}
                  count={selected.size}
                />
                {!mobile && (
                  <ViewToggle
                    view={view}
                    onChange={(x) => set({ view: x === 'cards' ? undefined : x })}
                  />
                )}
              </div>
            </div>

            {advOpen && (
              <div className="fgrid">
                {/* Client sheet 24 Oct (#95) · مكتمل / مرفوض / ملغي, or still under way */}
                <div className="fgrid-i">
                  <MultiSelect
                    label="النتيجة"
                    values={readList(v.res)}
                    all="كل النتائج"
                    options={outcomeOptions(resBase, (r) => regOutcome(r.state))}
                    onChange={(x) => set({ res: writeList(x) })}
                  />
                </div>
                <div className="fgrid-i">
                  <MultiSelect
                    label="المنطقة"
                    values={readList(v.region)}
                    all="الكل"
                    options={[...new Set(regRows.map((r) => r.region))]}
                    onChange={(x) => {
                      /* a city outside the picked regions drops with them */
                      const keep = readList(v.city).filter((c) => !x.length || regRows.some((r) => r.city === c && x.includes(r.region)))
                      set({ region: writeList(x), city: writeList(keep) })
                    }}
                  />
                </div>
                <div className="fgrid-i">
                  <MultiSelect
                    label="المدينة"
                    values={readList(v.city)}
                    all="الكل"
                    options={[...new Set(regRows.filter((r) => !readList(v.region).length || readList(v.region).includes(r.region)).map((r) => r.city))]}
                    onChange={(x) => set({ city: writeList(x) })}
                  />
                </div>
                <div className="fgrid-i">
                  <MultiSelect
                    label="جهة الإشراف الفني"
                    values={readList(v.lic)}
                    all="الكل"
                    options={[...new Set(regRows.map((r) => r.licensor))]}
                    onChange={(x) => set({ lic: writeList(x) })}
                  />
                </div>
                <div className="fgrid-i">
                  <span className="fsel">
                    <span className="fsel-l">أُرسل من</span>
                    <DateField value={v.from ?? ''} max={v.to} label="أُرسل من" onChange={(x) => set({ from: x || undefined })} />
                  </span>
                </div>
                <div className="fgrid-i">
                  <span className="fsel">
                    <span className="fsel-l">أُرسل حتى</span>
                    <DateField value={v.to ?? ''} min={v.from} label="أُرسل حتى" end onChange={(x) => set({ to: x || undefined })} />
                  </span>
                </div>
              </div>
            )}

            {(chips.length > 0 || v.short === '1' || v.from || v.to) && (
              <div className="factive">
                {chips.map((c) => (
                  <Button plain
                    key={`${c.key as string}:${c.value}`}
                    className="fpill"
                    onClick={() =>
                      set({
                        [c.key]: writeList(readList(v[c.key]).filter((x) => x !== c.value)),
                      } as Partial<Params>)
                    }
                  >
                    <span className="sub">{c.label}:</span> {c.text}
                    <Icon name={icons.close} size="sm" />
                  </Button>
                ))}
                {(v.from || v.to) && (
                  <Button plain className="fpill" onClick={() => set({ from: undefined, to: undefined })}>
                    <span className="sub">تاريخ الإرسال:</span> {v.from ? <DateText>{v.from}</DateText> : '…'} – {v.to ? <DateText>{v.to}</DateText> : '…'}
                    <Icon name={icons.close} size="sm" />
                  </Button>
                )}
                {v.short === '1' && (
                  <Button plain className="fpill" onClick={() => set({ short: undefined })}>
                    ملفها ناقص
                    <Icon name={icons.close} size="sm" />
                  </Button>
                )}
                <Button plain className="fclear" onClick={clear}>مسح الكل</Button>
              </div>
            )}
          </Glass>

          {sorted.length === 0 ? (
            <Glass>
              <Empty
                title="لا توجد طلبات بهذه الفلاتر."
                actions={<Button variant="2" onClick={clear}>مسح الفلاتر</Button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
                <DataTable
                  rows={sorted}
                  sort={ord}
                  onSort={(k) => set({ ord: writeSort(nextSort(ord, k)) })}
                  all={COLS}
                  table="reg-requests"
                  cols={cols}
                  onCols={setCols}
                  id={(r) => r.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(r) => navigate(ROUTES.entityRequest(r.id))}
                  group={grouped ? group : undefined}
                  count={(n) => `${countOf(n, NOUN.request)}`}
                />
              </Glass>
              {grouped && (
                <p className="sub tcen">
                  <span className="num">{countLeaves(groupTree(sorted, group))}</span> مجموعات ·{' '}
                  <Button plain className="lnk" onClick={() => set({ group: undefined })}>
                    إلغاء التجميع
                  </Button>
                </p>
              )}
            </>
          ) : (
            /* Note: a single grid - the tabs above are the filter. Cards used to be split with a
               header per status, and the tabs above filter and count by the same statuses - so the
               split was drawing the same grouping twice over the same data: the user clicks "Under
               review" and finds a single section titled "Under review". And on "All requests" it
               turned one list into five lists with no shared order. */
            <div className="paygrid">
              {sorted.map((r) => (
                <RegCard key={r.id} r={r} />
              ))}
            </div>
          )}

          <p className="sub tcen">
            <span className="num">{k.total}</span> {nounAfter(k.total, NOUN.sentRequest)}،
            منها <span className="num">{pct(k.rejectedPct)}</span> مرفوضة.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
