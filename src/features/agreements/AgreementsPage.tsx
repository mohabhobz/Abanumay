import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, GroupPicker, Num, SearchBox, Segments, Select, Stat,
  Toggle, ViewToggle,
  Riyal,
} from '@/components/ui'
import { countOf, nf, NOUN, nounAfter, pct } from '@/lib/format'
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
import { readAgreements } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import {
  AGREEMENT_STAGES, agrBlocked, agrHeat, agrKpi, agreements,
} from '@/data/mock/agreements'
import { useAgreements } from '@/data/agreements/store'
import type { AgreementRow, AgreementStage } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { AgreementCard } from './AgreementCard'
import { COLS, GROUPS } from './columns'

const KEYS = ['q', 'stage', 'heat', 'owner', 'kind', 'hold', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* Agreements inbox.

   Note: an agreement is its own workflow, not a project tab. Rule 23 states this directly, and rule
   25 explains its effect: moving an agreement through its stages does not change the project's
   status - the project stays at "agreement setup" until final approval. So an agreement can be with
   the executive director while its project still shows "agreement setup", and both are true.

   That's what makes this module an inbox: a supervisor with nine agreements across four different
   stages can't track them by going through project pages one by one.

   Layout follows the same list contract: title -> quick read -> the four document indicators ->
   stage chips -> toolbar -> table or cards. Every element comes from the library; nothing is built
   specifically for this screen.

   Note on a difference from the current live system: the live system has seven agreement sections,
   including an "agreement approval (finance section)" stage that doesn't appear in the flow at all,
   and which goes directly from grants manager to executive director. Logged here along with other
   differences. */

const HEATS = [
  { value: 'late', label: 'متأخرة عن مدة المرحلة' },
  { value: 'stuck', label: 'متعثرة · تجاوزت الضعف' },
]

const KINDS = ['إلكترونية', 'ورقية']

/* The above isn't counted in the advanced-filters count. */
const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'stage', 'heat', 'hold']

export default function AgreementsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const ver = useAgreements()
  const k = agrKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('agreements', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('agreements', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const rows = useMemo(() => {
    void ver
    const needle = v.q?.trim()
    const stages = readList(v.stage)
    const owners = readList(v.owner)
    const kinds = readList(v.kind)
    return agreements.filter((a) => {
      if (stages.length && !stages.includes(a.stage)) return false
      if (v.heat && agrHeat(a) !== v.heat) return false
      if (owners.length && !owners.includes(a.owner)) return false
      if (kinds.length && !kinds.includes(a.kind)) return false
      if (v.hold === '1' && !agrBlocked(a)) return false
      if (needle) {
        const hay = `${a.id} ${a.projectName} ${a.entityName} ${a.projectId} ${a.template}`
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [v, ver])

  /* Longest-waiting sits at top - the inbox sorts by risk, not by date. */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.hoursInStage - a.hoursInStage),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readAgreements(rows, filtered), [rows, filtered])

  /** Count for each stage within the current scope. */
  const counts = useMemo(() => {
    void ver
    const needle = v.q?.trim()
    const owners = readList(v.owner)
    const kinds = readList(v.kind)
    const base = agreements.filter((a) => {
      if (v.heat && agrHeat(a) !== v.heat) return false
      if (owners.length && !owners.includes(a.owner)) return false
      if (kinds.length && !kinds.includes(a.kind)) return false
      if (v.hold === '1' && !agrBlocked(a)) return false
      if (needle && !`${a.id} ${a.projectName} ${a.entityName} ${a.projectId} ${a.template}`.includes(needle))
        return false
      return true
    })
    const m = new Map<AgreementStage, number>()
    for (const a of base) m.set(a.stage, (m.get(a.stage) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.heat, v.owner, v.kind, v.hold, v.q, ver])

  /* Grouping persists with the session instead of resetting on every logout. */
  useStickyGroup('agreements', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const cardGroups = useMemo(() => {
    const pickStages = readList(v.stage)
    const list = pickStages.length
      ? AGREEMENT_STAGES.filter((s) => pickStages.includes(s.key))
      : AGREEMENT_STAGES
    return list
      .map((s) => ({ key: s.key, rows: sorted.filter((a) => a.stage === s.key) }))
      .filter((g) => g.rows.length > 0)
  }, [sorted, v.stage])

  const sheet: Sheet = useMemo(() => {
    /* Note: the sheet is built in `sheetOf`, not here. Five screens used to write the same three
       lines by hand; once grouping became a pipeline, all five would have needed the same change
       five times, and a missed one would end up out of sync with its own screen. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pickRows = selected.size ? sorted.filter((a) => selected.has(a.id)) : sorted
    const parts = sheetOf(pickRows, shown, group, (n: number) => countOf(n, NOUN.agreement))
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-agreements-${stamp}`, title: 'الاتفاقيات', ...parts }
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
    [['stage', 'المرحلة'], ['owner', 'المشرف'], ['kind', 'النوع']] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text: key === 'stage'
        ? AGREEMENT_STAGES.find((s) => s.key === value)?.label ?? value
        : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('الاتفاقيات')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الاتفاقيات</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> {nounAfter(rows.length, NOUN.agreement)} من{' '}
                <span className="num">{agreements.length}</span> في هذا النموذج ·{' '}
                <span className="num">{k.open}</span> تحت الإعداد و
                <span className="num">{k.active}</span> سارية ·{' '}
                <span className="num">{k.blocked}</span> موقوفة عن الاعتماد
              </p>
            </div>

            {/* Note: no `PageActions` here, deliberately. The contract says creation belongs in the
                header - it doesn't say every screen needs a create action. Agreements aren't
                created from the inbox: they're generated per project, so their entry point is the
                agreement tab on the project page. The inbox answers "what's pending", not "create a
                new agreement". This line exists so a future change doesn't add a button "for
                consistency" and break the actual rule. */}
          </header>

          <QuickRead
            variant="bar"
            title="قراءة سريعة للاتفاقيات"
            readings={readings}
            empty="لا توجد اتفاقية موقوفة عن الاعتماد في النطاق الحالي · وسّع الفلتر لعرض المزيد."
          />

          {/* Note: these four are the document's four indicators, not four arbitrary numbers - the
              "target value" column is empty for all of them, so the number shown is a value, not a
              status. */}
          <div className="stats4">
            <Stat
              label="متوسط مدة إعداد الاتفاقية"
              value={k.prepDays === null ? '—' : <Num>{k.prepDays}</Num>}
              unit={k.prepDays === null ? undefined : 'يومًا'}
              note={/* doc KPI 1 */ "من فتح الاتفاقية حتى سريانها"}
            />
            <Stat
              label="المنجزة ضمن المدة المستهدفة"
              value={k.inTarget === null ? '—' : <Num>{pct(k.inTarget)}</Num>}
              note={/* doc KPI 2 */ `${countOf(k.target, NOUN.day)} · مجموع مدد المراحل`}
              bar={k.inTarget === null ? undefined : { w: `${k.inTarget}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة دورة الاعتماد"
              value={k.cycleDays === null ? '—' : <Num>{k.cycleDays}</Num>}
              unit={k.cycleDays === null ? undefined : 'يومًا'}
              note={/* doc KPI 3 */ "من الإرسال حتى اكتمال الاعتمادات"}
            />
            <Stat
              label="المعادة للتعديل"
              value={k.returnedPct === null ? '—' : <Num>{pct(k.returnedPct)}</Num>}
              note={/* doc KPI 4 */ "كل إعادة دورة اعتماد كاملة"}
              bar={k.returnedPct === null ? undefined : { w: `${k.returnedPct}%`, c: 'var(--warn)' }}
            />
          </div>

          <Segments
            active={readList(v.stage).length === 1 ? readList(v.stage)[0] : ''}
            onChange={(x) => set({ stage: writeList(x ? [x] : []) })}
            items={[
              { key: '', label: 'كل المراحل', count: counts.total },
              ...AGREEMENT_STAGES.map((s) => ({
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
                  placeholder="ابحث برقم الاتفاقية أو المشروع أو الجهة…"
                />
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
                  label="الموقوفة عن الاعتماد"
                  on={v.hold === '1'}
                  onChange={(on) => set({ hold: on ? '1' : undefined })}
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
                {/* Note: grouping is a display control, not a filter - it belongs in the view
                    corner. As the last filter row it used to drop to its own line once the bar
                    wrapped (see `PlansPage`). */}
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
                  note={`${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${countOf(selected.size || sorted.length, NOUN.agreement)}`}
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
                    label="نوع الاتفاقية"
                    values={readList(v.kind)}
                    all="الكل"
                    options={KINDS}
                    onChange={(x) => set({ kind: writeList(x) })}
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
                    الموقوفة عن الاعتماد
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
                title="لا توجد اتفاقيات بهذه الفلاتر."
                note="وسّع النطاق، أو اختر مرحلة أخرى من الشرائح أعلاه."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
                <DataTable
                  rows={sorted}
                  all={COLS}
                  table="agreements"
                  cols={cols}
                  onCols={setCols}
                  id={(a) => a.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(a) => navigate(ROUTES.agreement(a.id))}
                  group={grouped ? group : undefined}
                  count={(n) => countOf(n, NOUN.agreement)}
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
            cardGroups.map((g) => {
              const meta = AGREEMENT_STAGES.find((s) => s.key === g.key)
              return (
                <section className="paygrp" key={g.key}>
                  <div className="paygrp-h">
                    <h2>{meta?.label ?? 'ملغاة'}</h2>
                    <span className="sub">
                      {meta?.who ? `عند ${meta.who}` : 'سارية'} ·{' '}
                      <span className="num">{g.rows.length}</span> {nounAfter(g.rows.length, NOUN.agreement)}
                      {/* doc · steps meta.steps */}
                    </span>
                  </div>
                  <div className="paygrid">
                    {g.rows.map((a: AgreementRow) => (
                      <AgreementCard key={a.id} a={a} />
                    ))}
                  </div>
                </section>
              )
            })
          )}

          {/* Rule 25 is stated on screen, not only in a comment - it's the most confusing case: an
              agreement "awaiting executive director" while its project still shows "agreement
              setup". */}
          <p className="sub tcen">
            مرحلة الاتفاقية لا تغيّر حالة المشروع · يبقى «إعداد الاتفاقية» حتى
            اعتمادها النهائي{/* doc rule 25 */}.
            وإجمالي قيمة الاتفاقيات تحت الإعداد{' '}
            <span className="num">{nf.format(k.openSum)}</span> <Riyal />.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
