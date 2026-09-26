import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, GroupPicker, Icon, MultiSelect, Num, SearchBox, Segments, Stat,
  Toggle, ViewToggle, icons,
} from '@/components/ui'
import { countOf, NOUN, nounAfter, pct } from '@/lib/format'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useStickyGroup } from '@/hooks/useStickyGroup'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { QuickRead } from '@/components/assistant'
import {
  DataTable, countLeaves, groupChain, groupTree, orderCols, readCols, sheetOf, writeCols,
} from '@/components/table'
import { ExportMenu } from '@/components/export'
import { PageActions } from '@/components/shell'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { readPlans } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import {
  PLAN_STAGES, lateActivities, planKpi, planRows, waitingReview,
} from '@/data/mock/plans'
import type { PlanRow, PlanStage } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { PlanCard } from './PlanCard'
import { COLS, GROUPS } from './columns'

const KEYS = ['q', 'stage', 'owner', 'wait', 'late', 'entity', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Plans inbox - the most significant gap found in the audit.

   Note: a plan is an independent process, not a project tab - same logic as agreements exactly.
   This applies the core idea: the system treats a project as a single unit, when a plan moving
   through its stages doesn't change the project's status, and a supervisor with seven plans whose
   activities await review can't track them one project page at a time.

   Note: the screen is built on one question: what's on my desk? That's why the default order is by
   queue (pending activities) rather than date, and "awaiting my review" is a visible tab, not an
   advanced filter. An inbox sorted by date makes the supervisor go looking for their own work.

   === Layout: the same list contract ===
   Title -> quick read -> four stats -> stage tabs -> toolbar -> table or cards. Every element from
   the library, no composition written just for this screen. */

/* What's above doesn't count toward the advanced-filters badge. */
const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'stage', 'wait', 'late']

export default function PlansPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const k = planKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('plans', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('plans', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const entities = useMemo(
    () => [...new Set(planRows.map((p) => p.entityName))].sort(),
    [],
  )

  const match = (p: PlanRow, skipStage = false) => {
    const needle = v.q?.trim()
    const stages = readList(v.stage)
    const owners = readList(v.owner)
    const ents = readList(v.entity)
    if (!skipStage && stages.length && !stages.includes(p.stage)) return false
    if (owners.length && !owners.includes(p.owner)) return false
    if (ents.length && !ents.includes(p.entityName)) return false
    if (v.wait === '1' && waitingReview(p).length === 0) return false
    if (v.late === '1' && lateActivities(p).length === 0) return false
    if (needle && !`${p.id} ${p.projectName} ${p.entityName} ${p.projectId}`.includes(needle)) {
      return false
    }
    return true
  }

  const rows = useMemo(() => planRows.filter((p) => match(p)), [v])

  /* Note: order is by queue, not date. A plan with five activities awaiting acceptance is today's
   work - date sorts by age, an entirely different question. After the queue comes late items, then
   dwell time. */
  const sorted = useMemo(
    () => [...rows].sort((a, b) =>
      waitingReview(b).length - waitingReview(a).length
      || lateActivities(b).length - lateActivities(a).length
      || b.hoursInStage - a.hoursInStage),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readPlans(rows, filtered), [rows, filtered])

  /** Count per stage within the current scope, excluding the stage filter itself. */
  const counts = useMemo(() => {
    const base = planRows.filter((p) => match(p, true))
    const m = new Map<PlanStage, number>()
    for (const p of base) m.set(p.stage, (m.get(p.stage) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.owner, v.entity, v.wait, v.late, v.q])

  useStickyGroup('plans', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pickRows = selected.size ? sorted.filter((p) => selected.has(p.id)) : sorted
    const parts = sheetOf(pickRows, shown, group, (n: number) => `${countOf(n, NOUN.plan)}`)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-plans-${stamp}`, title: 'خطط المشاريع', ...parts }
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
    [['stage', 'المرحلة'], ['owner', 'المشرف'], ['entity', 'الجهة']] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text: key === 'stage'
        ? PLAN_STAGES.find((s) => s.key === value)?.label ?? value
        : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('خطط المشاريع')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">خطط المشاريع</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.plan)} من{' '}
                <span className="num">{planKpi().total}</span> في هذا النموذج ·{' '}
                <span className="num">{k.live}</span> قيد التنفيذ و
                <span className="num">{k.open}</span> في دورة الاعتماد ·{' '}
                <span className="num">{k.waiting}</span> {nounAfter(k.waiting, NOUN.activity)} بانتظار المراجعة
              </p>
            </div>

            {/* Note: only settings sits in the corner - there's no "new plan". The `PageActions` contract says
   creation belongs in the header - it doesn't say every screen must have a creation action. A plan
   is generated for a project already decided to require one, so its entry point is the "plan" tab
   on the project page. The inbox answers "what's on my desk", not "make a new plan". This line is
   written so whoever comes next doesn't add a button "for consistency" and break the actual rule.
   */}
            <PageActions settings={ROUTES.planSettings} />
          </header>

          <QuickRead
            variant="bar"
            title="قراءة سريعة للخطط"
            readings={readings}
            empty="لا توجد في النطاق الحالي أنشطة بانتظار المراجعة أو متأخّرة · وسّع الفلتر لعرض المزيد."
          />

          {/* Note: the spec has no indicators for this module - these four are derived from its own rules, and
   logged elsewhere as placeholders, the same way the disbursement indicators have an empty target.
   */}
          <div className="stats4">
            <Stat
              label="أنشطة بانتظار مراجعتك"
              value={<Num>{k.waiting}</Num>}
              unit="نشاطًا"
              note="قاعدة 14 · لا تُحتسب إنجازًا قبل القبول"
            />
            <Stat
              label="الخطط الملتزمة بجدولها"
              value={<Num>{pct(k.onTrackPct)}</Num>}
              note="أداء الجدول ≥ 0.95 · مشتق من BPD-012"
              bar={{ w: `${k.onTrackPct}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="الأنشطة المتأخّرة"
              value={<Num>{pct(k.latePct)}</Num>}
              note={`${k.late} من ${countOf(k.acts, NOUN.activity)} · مقاسة على النسخة المرجعية`}
              bar={{ w: `${k.latePct}%`, c: 'var(--warn)' }}
            />
            <Stat
              label="متوسط مدة اعتماد الخطة"
              value={<Num>{k.approveDays}</Num>}
              unit="يومًا"
              note="من فتح الخطة حتى تثبيت النسخة المرجعية"
            />
          </div>

          <Segments
            active={readList(v.stage).length === 1 ? readList(v.stage)[0] : ''}
            onChange={(x) => set({ stage: writeList(x ? [x] : []) })}
            items={[
              { key: '', label: 'كل الخطط', count: counts.total },
              ...PLAN_STAGES.map((s) => ({
                key: s.key,
                label: s.label,
                count: counts.m.get(s.key) ?? 0,
              })),
            ]}
          />

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox
                  value={v.q ?? ''}
                  onChange={(x) => set({ q: x || undefined })}
                  placeholder="ابحث برقم الخطة أو المشروع أو الجهة…"
                />
                <MultiSelect
                  icon={icons.users}
                  values={readList(v.owner)}
                  all={`كل المشرفين (${OWNERS.length})`}
                  people
                  options={OWNERS as unknown as string[]}
                  onChange={(x) => set({ owner: writeList(x) })}
                />
                {/* Note: these two are visible tabs, not advanced filters - they're the supervisor's daily question,
   and a daily question shouldn't hide behind a button. */}
                <Toggle
                  label="بانتظار مراجعتي"
                  on={v.wait === '1'}
                  onChange={(on) => set({ wait: on ? '1' : undefined })}
                />
                <Toggle
                  label="بها نشاط متأخّر"
                  on={v.late === '1'}
                  onChange={(on) => set({ late: on ? '1' : undefined })}
                />
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

              <div className="ftool-a">
                {/* Note: grouping is a display control, not a filter - it changes the table's shape, not its rows,
   so it belongs in the display corner next to the cards/table switch. It used to be the last item
   in the filter row, so as soon as the bar wrapped (a narrower screen) it dropped alone to a second
   line at the screen's edge - an orphaned tab hanging under the row, which is what the client saw.
   */}
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
                  note={`${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${countOf(selected.size || sorted.length, NOUN.plan)}`}
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
                    values={readList(v.entity)}
                    all={`كل الجهات (${entities.length})`}
                    options={entities}
                    onChange={(x) => set({ entity: writeList(x) })}
                  />
                </div>
              </div>
            )}

            {(chips.length > 0 || v.wait === '1' || v.late === '1') && (
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
                {v.wait === '1' && (
                  <button className="fpill" onClick={() => set({ wait: undefined })}>
                    بانتظار مراجعتي
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
                {v.late === '1' && (
                  <button className="fpill" onClick={() => set({ late: undefined })}>
                    بها نشاط متأخّر
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {sorted.length === 0 ? (
            <Glass>
              <Empty
                title="لا توجد خطط بهذه الفلاتر."
                note="وسّع النطاق، أو اختر مرحلة أخرى من الشرائح في الأعلى."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
                <DataTable
                  rows={sorted}
                  all={COLS}
                  table="plans"
                  cols={cols}
                  onCols={setCols}
                  id={(p) => p.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(p) => navigate(ROUTES.plan(p.id))}
                  group={grouped ? group : undefined}
                  count={(n) => `${countOf(n, NOUN.plan)}`}
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
            /* Note: a single grid - the tabs above are the filter, and splitting it below draws the same
   grouping twice over the same data. */
            <div className="paygrid">
              {sorted.map((p) => <PlanCard key={p.id} p={p} />)}
            </div>
          )}

          {/* Note: the two rules that cause confusion are documented on the screen, not only in a comment -
   exactly like rule 25 on agreements. */}
          <p className="sub tcen">
            مرحلة الخطة لا تغيّر حالة المشروع · فهما إجراءان مستقلان يسيران بالتوازي
            مع الاتفاقية. والنشاط لا يُحتسب إنجازًا إلا بعد قبول مشرف المنح
            (القاعدة <span className="num">14</span>) ·{' '}
            <span className="num">{k.closable}</span> {nounAfter(k.closable, NOUN.project)} اكتملت خطته وصار
            مؤهَّلًا للإغلاق.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
