import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, GroupPicker, Num, SearchBox, Segments, Select, Stat,
  Toggle, ViewToggle,
} from '@/components/ui'
import { pct } from '@/lib/format'
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
import { readClosings } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import {
  CLOSE_STAGES, CLOSE_TARGET_DAYS, closeKpi, closeLate, closeRows, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow, CloseStage } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { CloseCard } from './CloseCard'
import { COLS, GROUPS } from './columns'

const KEYS = ['q', 'stage', 'cycle', 'owner', 'late', 'short', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   صندوق الإغلاق · BPD-011

   ⚠️ **الإغلاق إجراء مستقل، مش تاب في المشروع** · والقاعدة 16
   بتقولها أوضح من أي قاعدة في السيستم: انتقال التقرير الختامي بين
   مراحل المراجعة **ما بيأثّرش على حالة المشروع**، وإنها بتفضل
   «تحت التنفيذ» لحدّ ما التلاتة يكتملوا (قاعدة 8 و18). يعني تقرير
   عند المدير التنفيذي ومشروعه مكتوب عليه «تحت التنفيذ»، والاتنين
   صح.

   ⚠️ **والشرائح هنا دورتان لا سلّم واحد** · قاعدة 17: التقرير
   والتقييم دورتا اعتماد مستقلتان بسجلّين منفصلين. فالشرائح بتفصل
   الاتنين، والكارت بيقول إحنا في أي دورة قبل أي حاجة تانية.

   ═══ الشكل: نفس عقد القوائم ═══

   عنوان → قراءة سريعة → مؤشرات الوثيقة الأربعة → شرائح المحطات →
   شريط الأدوات → جدول أو كروت. كل عنصر من المكتبة.

   ⚠️ **ومفيش `PageActions`** · نفس سبب الاتفاقيات بالحرف: طلب
   التقرير الختامي بيتولد **لمشروع** بعد ما قاعدة 1 و2 يتحققوا،
   فمدخله تاب «الإغلاق» في صفحة المشروع. الصندوق بيجاوب «إيه اللي
   واقف عندي».
   ═══════════════════════════════════════════════════════════ */

const CYCLES = [
  { value: 'report', label: 'التقرير الختامي' },
  { value: 'eval', label: 'تقييم المشروع' },
]

const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'stage', 'late', 'short']

/** الدورة اللي المحطة دي فيها · مكتوبة في `CLOSE_STAGES` */
const cycleOf = (s: CloseStage): string =>
  CLOSE_STAGES.find((x) => x.key === s)?.cycle ?? 'report'

export default function ClosingPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const k = closeKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('closings', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('closings', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const match = (c: CloseRow, skipStage = false): boolean => {
    const needle = v.q?.trim()
    const stages = readList(v.stage)
    const owners = readList(v.owner)
    if (!skipStage && stages.length && !stages.includes(c.stage)) return false
    if (v.cycle && cycleOf(c.stage) !== v.cycle) return false
    if (owners.length && !owners.includes(c.owner)) return false
    if (v.late === '1' && !closeLate(c)) return false
    if (v.short === '1' && reportBlockers(c).length === 0) return false
    if (needle) {
      const hay = `${c.id} ${c.projectName} ${c.entityName} ${c.projectId}`
      if (!hay.includes(needle)) return false
    }
    return true
  }

  const rows = useMemo(() => closeRows.filter((c) => match(c)), [v])

  /* الأطول وقوفًا فوق · الصندوق بيترتّب بالخطر لا بالتاريخ */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.hoursInStage - a.hoursInStage),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readClosings(rows, filtered), [rows, filtered])

  const counts = useMemo(() => {
    const base = closeRows.filter((c) => match(c, true))
    const m = new Map<CloseStage, number>()
    for (const c of base) m.set(c.stage, (m.get(c.stage) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.cycle, v.owner, v.late, v.short, v.q])

  useStickyGroup('closings', v.group, (x) => set({ group: x }))

  const group = groupChain(v.group, GROUPS)
  const grouped = group.length > 0

  const cardGroups = useMemo(() => {
    const pick = readList(v.stage)
    const list = pick.length ? CLOSE_STAGES.filter((s) => pick.includes(s.key)) : CLOSE_STAGES
    return list
      .map((s) => ({ key: s.key, rows: sorted.filter((c) => c.stage === s.key) }))
      .filter((g) => g.rows.length > 0)
  }, [sorted, v.stage])

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pickRows = selected.size ? sorted.filter((c) => selected.has(c.id)) : sorted
    const parts = sheetOf(pickRows, shown, group, (n: number) => `${n} طلب إغلاق`)
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-closings-${stamp}`, title: 'إغلاق المشاريع', ...parts }
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
    [['stage', 'المحطة'], ['owner', 'المشرف']] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text: key === 'stage'
        ? CLOSE_STAGES.find((s) => s.key === value)?.label ?? value
        : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('إغلاق المشاريع')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">إغلاق المشاريع</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> طلب من{' '}
                <span className="num">{closeRows.length}</span> في هذا النموذج ·{' '}
                <span className="num">{k.open}</span> تحت الإجراء و
                <span className="num">{k.closed}</span> مغلق ·{' '}
                <span className="num">{k.late}</span> متأخر عن حدّ محطته
              </p>
            </div>
          </header>

          <QuickRead
            variant="bar"
            title="قراءة سريعة للإغلاق"
            readings={readings}
            empty="مفيش طلب إغلاق واقف في النطاق الحالي · وسّع الفلتر تشوف أكتر."
          />

          {/* مؤشرات الوثيقة الأربعة · 11.7 · لا أربعة أرقام مختارة */}
          <div className="stats4">
            <Stat
              label="متوسط مدة إغلاق المشروع"
              value={<Num>{k.avg}</Num>}
              unit="يومًا"
              note="مؤشر 1 · من فتح الطلب حتى الإغلاق النهائي"
            />
            <Stat
              label="المغلقة ضمن المدة المستهدفة"
              value={<Num>{pct(k.inTimePct)}</Num>}
              note={`مؤشر 2 · المدة المؤقتة ${CLOSE_TARGET_DAYS} يومًا`}
              bar={{ w: `${k.inTimePct}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة إعداد التقرير"
              value={<Num>{k.prepDays}</Num>}
              unit="يومًا"
              note="مؤشر 3 · من فتح الطلب حتى إرسال الجهة"
            />
            <Stat
              label="المغلقة بعد استكمال المتطلبات"
              value={<Num>{pct(k.fullPct)}</Num>}
              note="مؤشر 4 · قاعدة 8 و18"
              bar={{ w: `${k.fullPct}%`, c: 'var(--ok)' }}
            />
          </div>

          <Segments
            active={readList(v.stage).length === 1 ? readList(v.stage)[0] : ''}
            onChange={(x) => set({ stage: writeList(x ? [x] : []) })}
            items={[
              { key: '', label: 'كل المحطات', count: counts.total },
              ...CLOSE_STAGES.map((s) => ({
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
                  placeholder="ابحث برقم الطلب أو المشروع أو الجهة…"
                />
                <MultiSelect
                  icon={icons.users}
                  values={readList(v.owner)}
                  all={`كل المشرفين (${OWNERS.length})`}
                  people
                  options={OWNERS as unknown as string[]}
                  onChange={(x) => set({ owner: writeList(x) })}
                />
                {/* ⚠️ الدورة فلتر أساسي لا متقدّم · قاعدة 17 */}
                <Select
                  icon={icons.rows}
                  value={v.cycle}
                  all="الدورتان"
                  options={CYCLES}
                  onChange={(x) => set({ cycle: x })}
                />
                <Toggle
                  label="الناقص"
                  on={v.short === '1'}
                  onChange={(on) => set({ short: on ? '1' : undefined })}
                />
                <button
                  className={`fchip${advOpen ? ' on' : ''}`}
                  onClick={() => set({ adv: advOpen ? undefined : '1' })}
                  aria-expanded={advOpen}
                >
                  <Icon name={icons.filter} size={15} />
                  فلاتر متقدمة
                  {activeCount(NOT_FILTERS) > 0 && (
                    <b className="num">{activeCount(NOT_FILTERS)}</b>
                  )}
                </button>
              </div>

              <div className="ftool-a">
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
                  note={`${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${selected.size || sorted.length} طلب`}
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
                  <Toggle
                    label="المتأخر عن حدّ المحطة"
                    on={v.late === '1'}
                    onChange={(on) => set({ late: on ? '1' : undefined })}
                  />
                </div>
              </div>
            )}

            {(chips.length > 0 || v.cycle || v.late === '1' || v.short === '1') && (
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
                    <Icon name={icons.close} size={13} />
                  </button>
                ))}
                {v.cycle && (
                  <button className="fpill" onClick={() => set({ cycle: undefined })}>
                    <span className="sub">الدورة:</span>{' '}
                    {CYCLES.find((c) => c.value === v.cycle)?.label}
                    <Icon name={icons.close} size={13} />
                  </button>
                )}
                {v.short === '1' && (
                  <button className="fpill" onClick={() => set({ short: undefined })}>
                    الناقص
                    <Icon name={icons.close} size={13} />
                  </button>
                )}
                {v.late === '1' && (
                  <button className="fpill" onClick={() => set({ late: undefined })}>
                    المتأخر عن حدّ المحطة
                    <Icon name={icons.close} size={13} />
                  </button>
                )}
                <button className="fclear" onClick={clear}>مسح الكل</button>
              </div>
            )}
          </Glass>

          {sorted.length === 0 ? (
            <Glass>
              <Empty
                title="لا توجد طلبات إغلاق بهذه الفلاتر."
                note="جرّب توسيع النطاق، أو اختر محطة تانية من الشرائح فوق."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
                <DataTable
                  rows={sorted}
                  all={COLS}
                  table="closings"
                  cols={cols}
                  onCols={setCols}
                  id={(c) => c.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(c) => navigate(ROUTES.closing(c.id))}
                  group={grouped ? group : undefined}
                  count={(n) => `${n} طلب`}
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
              const meta = CLOSE_STAGES.find((s) => s.key === g.key)
              return (
                <section className="paygrp" key={g.key}>
                  <div className="paygrp-h">
                    <h2>{meta?.label ?? g.key}</h2>
                    <span className="sub">
                      {meta?.who ? `عند ${meta.who}` : 'مكتمل'} ·{' '}
                      <span className="num">{g.rows.length}</span> طلب · {meta?.note}
                    </span>
                  </div>
                  <div className="paygrid">
                    {g.rows.map((c: CloseRow) => (
                      <CloseCard key={c.id} c={c} />
                    ))}
                  </div>
                </section>
              )
            })
          )}

          {/* ⚠️ قاعدة 16 مكتوبة في الشاشة لا في التعليق بس · هي أكتر
              حاجة بتلخبط لما تشوف تقريرًا «عند المدير التنفيذي»
              ومشروعه مكتوب عليه «تحت التنفيذ». */}
          <p className="sub tcen">
            محطة الإغلاق لا تغيّر حالة المشروع · يبقى «تحت التنفيذ» حتى يكتمل
            اعتماد التقرير والتقييم والمتطلبات المالية والإدارية معًا · القاعدة{' '}
            <span className="num">16</span> و<span className="num">18</span> في الوثيقة.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
