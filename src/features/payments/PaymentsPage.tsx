import { useEffect, useMemo, useState } from 'react'
import { usePayments } from '@/data/payments/store'
import { useRole } from '@/hooks/useRole'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, GroupPicker, Num, SearchBox, Segments, Select, Stat,
  Toggle, ViewToggle,
  Riyal,
} from '@/components/ui'
import { countOf, nf, NOUN, nounAfter, pct, REQUEST_NOUN } from '@/lib/format'
import { PageActions } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useStickyGroup } from '@/hooks/useStickyGroup'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { QuickRead } from '@/components/assistant'
import {
  DataTable, countLeaves, groupChain, groupTree, orderCols, readCols, sheetOf, writeCols,
} from '@/components/table'
import { ExportMenu } from '@/components/export'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { readPayments } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import {
  BANK_STATES, PAY_STATES, PAY_TARGET_DAYS, payBlocked, payHeat, payKpi, payRequests,
} from '@/data/mock/disbursements'
import type { PayRequest, PayState } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { RequestCard } from './RequestCard'
import { COLS, GROUPS } from './columns'

const KEYS = ['q', 'state', 'heat', 'owner', 'entity', 'bank', 'hold', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Disbursement inbox.

   This screen isn't a "payments list" - it's a decision inbox: 72 requests across four stages, each
   with an owner. It answers one question: what's on my desk, and why?

   === Layout: the same list contract, no exceptions ===

   Two-column header (title right, reading text opposite) -> indicators -> tabs -> toolbar ->
   results. Same switcher as projects and entities: table and cards, because the screen answers two
   questions, not one. The card states why this item is on your desk, with all four conditions in
   view; the table shows the shape of the whole queue - comparing amounts, dates, and supervisors,
   and exporting them.

   Every element here comes from the system library, not written for this screen alone: `Segments`
   for the tabs, `Glass.ftoolbar` for the toolbar, `MultiSelect` for filters, `DataTable` for the
   table, `Empty` for the empty state, `Face` for the supervisor. A screen that invents its own
   composition looks foreign even with matching colors.

   === What the spec covers, and what's logged as a question ===

   Built on the spec: four stages ending at the transfer (steps 17-18), and five request statuses
   sourced from the spec's own steps. The live system has seven departments plus two post-transfer
   documents (receipt voucher and ledger entry) and automatic branching on two conditions - these
   differences are all logged as numbered notes elsewhere, along with the design impact of each
   possible answer.

   One thing departs from the spec's letter by decision: bank account status is shown next to every
   request. The spec doesn't mention it among the disbursement rules, but its second output states
   "disburse the payment to the approved bank account", and the live system's only named return
   reason is "return the disbursement authorization with a note on banking details." So this
   prevents a documented error, not a guess. */

const HEATS = [
  { value: 'late', label: 'متأخر عن مدة المرحلة' },
  { value: 'stuck', label: 'متعثر · تجاوز الضعف' },
]

/* What's above doesn't count toward the "advanced filters" badge - the badge counts only what's
   hidden, otherwise it would count something the user already sees in front of them. */
const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'state', 'heat', 'hold']

/* The `entity` param carries entity ids (`?entity=755`), so a link from the entity page scopes the
   inbox to that entity's requests only. Names are still accepted for links made before ids. */
const inEntities = (r: PayRequest, picked: string[]) =>
  !picked.length || picked.includes(r.entityId) || picked.includes(r.entityName)

const entityLabel = (idOrName: string) => entityById(idOrName)?.name ?? idOrName

/* Sections a link can land on (`/payments?entity=755#pay-open`): `pay-kpi` the indicators,
   `list` the toolbar with its active filters, and the two stage anchors below. */
const STAGE_ANCHORS = ['pay-open', 'pay-paid']

export default function PaymentsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const ver = usePayments()
  const { role } = useRole()
  const k = payKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('payments', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('payments', cols), [cols])

  /* The table on mobile compresses each column until every cell wraps its words into a column - the
     card is the mobile row. Here the card is also the desktop default, unlike projects: the queue
     is 72 requests, not 4,929, and a decision needs its reason in view. The table is for comparison
     and export. */
  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const rows = useMemo(() => {
    const needle = v.q?.trim()
    const states = readList(v.state)
    const owners = readList(v.owner)
    const entities = readList(v.entity)
    const banks = readList(v.bank)
    return payRequests.filter((r) => {
      if (states.length && !states.includes(r.state)) return false
      if (v.heat && payHeat(r) !== v.heat) return false
      if (owners.length && !owners.includes(r.owner)) return false
      if (!inEntities(r, entities)) return false
      if (banks.length && !banks.includes(r.bank.active ? 'معتمد' : 'معطَّل')) return false
      if (v.hold === '1' && !payBlocked(r)) return false
      if (needle) {
        const hay = `${r.id} ${r.projectName} ${r.entityName} ${r.projectId}`
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, ver])

  /* Most at-risk first - the inbox sorts by risk, not date, because the question is "what's stuck",
     not "what's new". */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.hoursInState - a.hoursInState),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readPayments(rows, filtered), [rows, filtered])

  /* The indicators and the title line follow the current scope: scoped to one entity, they
     describe that entity's requests only. The "late" shortcut keeps the whole inbox (`k`), since
     it opens a separate report. */
  const ks = useMemo(() => payKpi(rows), [rows])
  const pickedEntities = readList(v.entity)
  const scopeEntity = pickedEntities.length === 1 ? entityLabel(pickedEntities[0]) : undefined

  /* A hash target with no section of its own (say, an entity with no paid request yet) lands on
     the results instead, so the arrival is never silent. */
  const hashId = decodeURIComponent(useLocation().hash.replace(/^#/, ''))

  /** Count per stage within the current scope, not the whole set. */
  const counts = useMemo(() => {
    const needle = v.q?.trim()
    const owners = readList(v.owner)
    const entities = readList(v.entity)
    const banks = readList(v.bank)
    const base = payRequests.filter((r) => {
      if (v.heat && payHeat(r) !== v.heat) return false
      if (owners.length && !owners.includes(r.owner)) return false
      if (!inEntities(r, entities)) return false
      if (banks.length && !banks.includes(r.bank.active ? 'معتمد' : 'معطَّل')) return false
      if (v.hold === '1' && !payBlocked(r)) return false
      if (needle && !`${r.id} ${r.projectName} ${r.entityName} ${r.projectId}`.includes(needle))
        return false
      return true
    })
    const m = new Map<PayState, number>()
    for (const r of base) m.set(r.state, (m.get(r.state) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.heat, v.owner, v.entity, v.bank, v.hold, v.q])

  /** Entities that actually have requests - a filter shouldn't show an option with no results. */
  const entityOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of payRequests) seen.set(r.entityId, r.entityName)
    return [...seen]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ar'))
  }, [])

  /* Grouping persists with the session instead of resetting on every sign-out. */
  useStickyGroup('payments', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  /* Grouping in the cards is always by stage - the inbox reads by stage, and a tab narrows scope
     rather than canceling the grouping. */
  const cardGroups = useMemo(() => {
    const pick = readList(v.state)
    const list = pick.length ? PAY_STATES.filter((s) => pick.includes(s.key)) : PAY_STATES
    return list
      .map((s) => ({ key: s.key, rows: sorted.filter((r) => r.state === s.key) }))
      .filter((g) => g.rows.length > 0)
  }, [sorted, v.state])

  /* A link aimed at a stage this scope has none of lands on a short note that says so. */
  const cardMissing = (() => {
    if (hashId !== 'pay-paid' && hashId !== 'pay-open') return undefined
    const has = cardGroups.some((g) =>
      hashId === 'pay-paid' ? g.key === 'paid' : g.key !== 'paid' && g.key !== 'closed')
    return has ? undefined : hashId
  })()

  const sheet: Sheet = useMemo(() => {
    /* Note: the sheet is built in `sheetOf`, not here. Five screens used to write the same three
       lines by hand, and once the totals became a chain, all five would have needed the same edit
       five times - and whichever gets missed ends up mismatched with its own screen. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pick = selected.size ? sorted.filter((r) => selected.has(r.id)) : sorted
    const parts = sheetOf(pick, shown, group, (n: number) => `${countOf(n, NOUN.request)}`)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-payments-${stamp}`, title: 'الصرف', ...parts }
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
    [
      ['state', 'المرحلة'], ['owner', 'المشرف'], ['entity', 'الجهة'], ['bank', 'الحساب'],
    ] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text:
        key === 'state' ? PAY_STATES.find((s) => s.key === value)?.label ?? value
        : key === 'entity' ? entityLabel(value)
        : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('الصرف')}>
      <div className="viewstack">
        <div className="screen col">
          {/* Note: this is a list header, not a details header. It used to be `phead phead-g2` with
              the reading text in the second column - that's the entity and project detail-page
              header. The result: the reading text got squeezed to half width and truncated with an
              ellipsis, while the same reading text on projects and entities takes the full line and
              reads to the end. */}
          <header>
            <div>
              <h1 className="ptitle">الصرف</h1>
              <p className="sub mt-1">
                {scopeEntity && <>طلبات «<b>{scopeEntity}</b>» · </>}
                <span className="num">{rows.length}</span> {nounAfter(rows.length, REQUEST_NOUN)} من{' '}
                <span className="num">{payRequests.length}</span> في هذا النموذج ·{' '}
                <span className="num">{ks.open}</span> مفتوح بقيمة{' '}
                <span className="num">{nf.format(ks.openSum)}</span> <Riyal /> ·{' '}
                <span className="num">{ks.blocked}</span> منها موقوف بشرط
              </p>
            </div>

            {/* Step 2 - request creation. Late items are screen 6, the report the escalation
                mechanism (9.5) calls for - not a filter on this inbox. */}
            <PageActions
              secondary={[
                ...(k.late + k.stuck > 0 ? [{ label: 'المتأخر', to: ROUTES.paymentsLate, icon: 'alert' as const, count: k.late + k.stuck }] : []),
                ...(role.key === 'finance' || role.key === 'admin' ? [{ label: 'دفعات النظام السابق', to: ROUTES.paymentsLegacy, icon: 'upload' as const }] : []),
              ]}
              create={{ label: role.key === 'supervisor' ? 'إذن صرف جديد' : 'طلب صرف جديد', to: ROUTES.paymentNew() }}
            />
          </header>

          {/* === Quick read ===
              Its own row right after the title and before the toolbar - the same position exactly
              as on `/projects` and `/entities`. It's a page-level reading, so it comes before the
              toolbar rather than between it and the results, and it takes the full line since its
              sentence reads to the end. */}
          <QuickRead
            variant="bar"
            title="قراءة سريعة للصندوق"
            readings={readings}
            empty="لا يوجد طلب صرف موقوف أو متأخر في النطاق الحالي. وسّع الفلتر لعرض المزيد."
          />

          {/* Note: these four cards are the spec's own four indicators (9.8), not four cards chosen
              freely. Two of them used to be indicators and two were inbox size (open requests and
              their value) - meaning two of the process's own indicators were missing, with their
              spot taken by numbers already readable from the title line. Size moved back to the
              title line, and the four are now the actual four.

              The "target value" column is empty in the spec for all four - so the number displays
              as a value, not a status, and isn't colored success or failure until the institution
              provides targets. */}
          <div className="stats4" id="pay-kpi">
            <Stat
              label="متوسط مدة معالجة الطلب"
              value={<Num>{ks.avgDays}</Num>}
              unit="يومًا"
              note={/* doc KPI 1 */ "المستهدف بانتظار المؤسسة"}
            />
            <Stat
              label="المنجزة ضمن المدة المستهدفة"
              value={<Num>{pct(ks.inTarget)}</Num>}
              note={/* doc KPI 2 */ `المدة المؤقتة ${countOf(PAY_TARGET_DAYS, NOUN.day)}`}
              bar={{ w: `${ks.inTarget}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة تنفيذ الصرف المالي"
              value={<Num>{ks.financeDays}</Num>}
              unit="يومًا"
              note={/* doc KPI 3 */ "من اعتماد مدير المنح حتى التحويل"}
            />
            <Stat
              label="الالتزام بجدول الدفعات"
              value={<Num>{pct(ks.onSchedule)}</Num>}
              note={/* doc KPI 4 */ "المستهدف بانتظار المؤسسة"}
              bar={{ w: `${ks.onSchedule}%`, c: 'var(--lime)' }}
            />
          </div>

          {/* Stage tabs - same tab row as other inboxes, each tab counted within the current scope. */}
          <Segments
            active={readList(v.state).length === 1 ? readList(v.state)[0] : ''}
            onChange={(x) => set({ state: writeList(x ? [x] : []) })}
            items={[
              { key: '', label: 'كل المراحل', count: counts.total },
              ...PAY_STATES.map((s) => ({
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
                  placeholder="ابحث برقم الطلب أو المشروع أو الجهة…"
                />
                {/* `people` is what renders the avatar in the list - the same avatar used in the
                    card and the table column, so it's one person across all three places. */}
                <MultiSelect
                  icon={icons.users}
                  values={readList(v.owner)}
                  all={`كل المشرفين (${OWNERS.length})`}
                  people
                  options={OWNERS as unknown as string[]}
                  onChange={(x) => set({ owner: writeList(x) })}
                />
                <Select
                  icon={icons.clock}
                  value={v.heat}
                  all="كل المدد"
                  options={HEATS}
                  onChange={(x) => set({ heat: x })}
                />
                <Toggle
                  label="الموقوف بشرط"
                  on={v.hold === '1'}
                  onChange={(on) => set({ hold: on ? '1' : undefined })}
                />
                {/* The rest collapses behind a counter - same rule as projects and entities:
                    whatever gets filtered daily stays visible, the rest sits behind a button. A row
                    wrapping to two lines means a filter dropped below and broke its own order. */}
                <button
                  className={`fchip${advOpen ? ' on' : ''}`}
                  onClick={() => set({ adv: advOpen ? undefined : '1' })}
                  aria-expanded={advOpen}
                >
                  <Icon name={icons.filter} size="sm" />
                  فلاتر متقدمة
                  {activeCount(NOT_FILTERS) > 0 && (
                    <b className="num">{activeCount(NOT_FILTERS)}</b>
                  )}
                </button>
                
              </div>

              {/* Non-filter tools - a fixed group at the end of the row, so filters wrap within
                  their own group and the switcher doesn't jump around. */}
              {/* Note: "new disbursement request" and "late" used to be here and moved to the
                  header. This whole toolbar operates on the displayed result: search, filter,
                  group, export, and view switch. Creation isn't one of those - it adds to the inbox
                  and has nothing to do with what's currently filtered, and "late" is a separate
                  inbox, not another view of the same one. Since both sit in the header on entities
                  and budget, they belong there here too (the `PageActions` contract). */}
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
                <div className="fgrid-i">
                  <MultiSelect
                    label="الجهة"
                    values={readList(v.entity)}
                    all={`كل الجهات (${entityOptions.length})`}
                    options={entityOptions}
                    onChange={(x) => set({ entity: writeList(x) })}
                  />
                </div>
                <div className="fgrid-i">
                  <MultiSelect
                    label="الحساب البنكي"
                    values={readList(v.bank)}
                    all="كل الحسابات"
                    options={BANK_STATES}
                    onChange={(x) => set({ bank: writeList(x) })}
                  />
                </div>
              </div>
            )}

            {(chips.length > 0 || v.heat || v.hold === '1') && (
              <div className="factive">
                {chips.map((c) => (
                  <button
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
                  </button>
                ))}
                {v.heat && (
                  <button className="fpill" onClick={() => set({ heat: undefined })}>
                    <span className="sub">المدة:</span>{' '}
                    {HEATS.find((h) => h.value === v.heat)?.label}
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
                {v.hold === '1' && (
                  <button className="fpill" onClick={() => set({ hold: undefined })}>
                    الموقوف بشرط
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {sorted.length === 0 ? (
            <Glass id={STAGE_ANCHORS.includes(hashId) ? hashId : undefined}>
              <Empty
                title="لا توجد طلبات بهذه الفلاتر."
                note="وسّع النطاق، أو اختر مرحلة أخرى من الشرائح أعلاه."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard" id={STAGE_ANCHORS.includes(hashId) ? hashId : undefined}>
                <DataTable
                  rows={sorted}
                  all={COLS}
                  table="payments"
                  cols={cols}
                  onCols={setCols}
                  id={(r) => r.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(r) => navigate(ROUTES.payment(r.id))}
                  group={grouped ? group : undefined}
                  count={(n) => `${countOf(n, NOUN.request)}`}
                />
              </Glass>
              {grouped && (
                <p className="sub tcen">
                  التجميع يعرض كل النتائج ·{' '}
                  <span className="num">{countLeaves(groupTree(sorted, group))}</span> مجموعات ·{' '}
                  <button className="lnk" onClick={() => set({ group: undefined })}>
                    إلغاء التجميع
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
            {cardGroups.map((g) => {
              const meta = PAY_STATES.find((s) => s.key === g.key)
              /* The first open stage carries `pay-open`, the paid group `pay-paid`. */
              const firstOpen = cardGroups.find((x) => x.key !== 'paid' && x.key !== 'closed')
              const anchor =
                g.key === 'paid' ? 'pay-paid' : g === firstOpen ? 'pay-open' : undefined
              return (
                <section className="paygrp" key={g.key} id={anchor}>
                  <div className="paygrp-h">
                    <h2>{meta?.label ?? 'مغلقة'}</h2>
                    <span className="sub">
                      {meta?.who ? `عند ${meta.who}` : 'مكتملة'} ·{' '}
                      <span className="num">{g.rows.length}</span> {nounAfter(g.rows.length, NOUN.request)}
                      {/* doc · steps meta.steps */}
                    </span>
                  </div>
                  <div className="paygrid">
                    {g.rows.map((r: PayRequest) => (
                      <RequestCard key={r.id} r={r} />
                    ))}
                  </div>
                </section>
              )
            })}
            {cardMissing && (
              <Glass id={cardMissing}>
                <Empty
                  title={
                    cardMissing === 'pay-paid'
                      ? 'لا يوجد طلب مصروف في النطاق الحالي.'
                      : 'لا يوجد طلب مفتوح في النطاق الحالي.'
                  }
                  note={
                    scopeEntity
                      ? 'الصندوق يعرض طلبات هذه الدورة فقط · المبالغ المصروفة سابقًا محسوبة في ملف الجهة.'
                      : 'اختر مرحلة أخرى من الشرائح أعلاه.'
                  }
                />
              </Glass>
            )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
