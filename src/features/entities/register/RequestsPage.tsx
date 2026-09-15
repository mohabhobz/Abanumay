import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, Num, SearchBox, Segments, Select, Stat,
  Toggle, ViewToggle,
} from '@/components/ui'
import { pct } from '@/lib/format'
import { AppLayout } from '@/app/layout/AppLayout'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { QuickRead } from '@/components/assistant'
import { DataTable, aggregate, orderCols, readCols, splitGroups, writeCols } from '@/components/table'
import { ExportMenu } from '@/components/export'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { readRegRequests } from '@/data/readings'
import { ENTITY_TYPES } from '@/data/mock/taxonomy'
import {
  REG_STATES, REG_STATE_SAY, regKpi, regMissingDocs, regRows, type RegState,
} from '@/data/mock/registration'
import type { Sheet } from '@/lib/export'
import { RegCard } from './RegCard'
import { COLS, GROUPS, groupByKey } from './columns'

const KEYS = ['q', 'state', 'type', 'region', 'short', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   صندوق طلبات التسجيل · BPD-002

   ⚠️ **الصندوق ده مش «الجهات الجديدة».** القاعدة 2 بتقول إن
   الحساب ما بيتعملش قبل الاعتماد · فاللي في الصندوق **طلبات** من
   أطراف برّه المؤسسة، والجهة بتتولد في آخر السلسلة لا أولها.
   والفرق ده هو سبب وجود شاشة منفصلة أصلًا: صفحة الجهات بتعرض
   سجلًا، ودي بتعرض **دور مراجعة**.

   ═══ ستة صناديق في النظام العامل، شرائح هنا ═══

   النظام موزّع الطلبات على `dept_accept_all` و`_new` و`_edit`
   و`_reject` و`_stopped` و`_notaccept` · ستة مداخل في القايمة
   الجانبية لنفس الجدول بفلتر مختلف. والوثيقة عندها **حالة واحدة
   بخمس قيم** (قاعدة 26)، فالشرائح هي الصناديق.

   ⚠️ **و`dept_accept_edit` مش من دول.** الأغلب إنه طلبات تحديث
   بيانات جهة قائمة · يعني الإجراء الفرعي التاني (19 خطوة) لا
   التسجيل. مسجَّل سؤالًا في البريف (نوتة ن-5) ومش مبني هنا.
   ═══════════════════════════════════════════════════════════ */

const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'state', 'short']

export default function RequestsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const k = regKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('reg-requests', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('reg-requests', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const rows = useMemo(() => {
    const needle = v.q?.trim()
    const states = readList(v.state)
    const types = readList(v.type)
    const regions = readList(v.region)
    return regRows.filter((r) => {
      if (states.length && !states.includes(r.state)) return false
      if (types.length && !types.includes(r.type)) return false
      if (regions.length && !regions.includes(r.region)) return false
      if (v.short === '1' && regMissingDocs(r).length === 0) return false
      if (needle && !`${r.id} ${r.name} ${r.licenseNo} ${r.clerkName}`.includes(needle)) return false
      return true
    })
  }, [v])

  /* الأقدم إرسالًا فوق · الصندوق دور مراجعة، والدور بالتاريخ */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readRegRequests(rows, filtered), [rows, filtered])

  /** عدّاد كل حالة جوّه النطاق الحالي · بلا فلتر الحالة نفسه */
  const counts = useMemo(() => {
    const needle = v.q?.trim()
    const types = readList(v.type)
    const regions = readList(v.region)
    const base = regRows.filter((r) => {
      if (types.length && !types.includes(r.type)) return false
      if (regions.length && !regions.includes(r.region)) return false
      if (v.short === '1' && regMissingDocs(r).length === 0) return false
      if (needle && !`${r.id} ${r.name} ${r.licenseNo} ${r.clerkName}`.includes(needle)) return false
      return true
    })
    const m = new Map<RegState, number>()
    for (const r of base) m.set(r.state, (m.get(r.state) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.type, v.region, v.short, v.q])

  const group = groupByKey(v.group)
  const grouped = Boolean(group)

  const cardGroups = useMemo(() => {
    const pick = readList(v.state)
    const list = pick.length ? REG_STATES.filter((s) => pick.includes(s.key)) : REG_STATES
    return list
      .map((s) => ({ key: s.key, rows: sorted.filter((r) => r.state === s.key) }))
      .filter((g) => g.rows.length > 0)
  }, [sorted, v.state])

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group || c.key !== group.key)
    const pickRows = selected.size ? sorted.filter((r) => selected.has(r.id)) : sorted
    const head = [...(group ? [group.label] : []), ...shown.map((c) => c.label)]
    const body = pickRows.map((r) => [
      ...(group ? [group.of(r)] : []),
      ...shown.map((c) => c.text(r)),
    ])
    const totals = [
      ...(group ? [''] : []),
      ...shown.map((c, i) => {
        const t = aggregate(c, pickRows)
        return t !== null ? String(t) : i === 0 ? `${pickRows.length} طلب` : ''
      }),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return {
      file: `abanumay-registration-${stamp}`,
      title: 'طلبات تسجيل الجهات',
      headers: head,
      rows: body,
      totals,
    }
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
    [['state', 'الحالة'], ['type', 'التصنيف'], ['region', 'المنطقة']] as [keyof Params, string][]
  ).flatMap(([key, label]) =>
    readList(v[key]).map((value) => ({
      key,
      label,
      value,
      text: key === 'state' ? REG_STATE_SAY[value as RegState] ?? value : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('طلبات تسجيل الجهات')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">طلبات تسجيل الجهات</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> طلب من{' '}
                <span className="num">{regRows.length}</span> في هذا النموذج ·{' '}
                <span className="num">{k.open}</span> قيد المراجعة · والجهة لا تُنشأ
                إلا بعد الاعتماد (قاعدة <span className="num">2</span>)
              </p>
            </div>
            <Link className="btn btn-p" to={ROUTES.entityRegister}>
              <Icon name={icons.plus} size={16} />
              تسجيل جهة جديدة
            </Link>
          </header>

          <QuickRead variant="bar" title="قراءة سريعة للطلبات" readings={readings} />

          {/* ⚠️ الأربعة دي من مؤشرات الإجراء الستة · والاتنين
              الباقيين (عدد الطلبات ونسبة المرفوضة) مكتوبين في
              العنوان وفي السطر الأخير، فما اتكرروش كبطاقات. */}
          <div className="stats4">
            <Stat
              label="نسبة الطلبات المعتمدة"
              value={<Num>{pct(k.approvedPct)}</Num>}
              note="مؤشر 2 · من المرسَل لا من المسودات"
              bar={{ w: `${k.approvedPct}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة المراجعة"
              value={<Num>{k.avgDays}</Num>}
              unit="أيام"
              note="مؤشر 4 · من الإرسال حتى القرار"
            />
            <Stat
              label="المعادة للاستكمال"
              value={<Num>{pct(k.backPct)}</Num>}
              note="مؤشر 5 · وقوف نواقص لا رفض"
              bar={{ w: `${k.backPct}%`, c: 'var(--warn)' }}
            />
            <Stat
              label="اكتمال ملفات المستندات"
              value={<Num>{pct(k.filePct)}</Num>}
              note="مؤشر 6 · المرفوع من الإلزامي لكل تصنيف"
              bar={{ w: `${k.filePct}%`, c: 'var(--ch-1)' }}
            />
          </div>

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

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox
                  value={v.q ?? ''}
                  onChange={(x) => set({ q: x || undefined })}
                  placeholder="ابحث برقم الطلب أو اسم الجهة أو رقم الترخيص…"
                />
                <MultiSelect
                  label="تصنيف الجهة"
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
                {view === 'table' && (
                  <Select
                    icon={icons.rows}
                    value={v.group}
                    all="بلا تجميع"
                    options={GROUPS.map((g) => ({ value: g.key, label: `تجميع حسب ${g.label}` }))}
                    onChange={(x) => set({ group: x })}
                  />
                )}
              </div>

              <div className="ftool-a">
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
                  <MultiSelect
                    label="المنطقة"
                    values={readList(v.region)}
                    all="الكل"
                    options={[...new Set(regRows.map((r) => r.region))]}
                    onChange={(x) => set({ region: writeList(x) })}
                  />
                </div>
              </div>
            )}

            {(chips.length > 0 || v.short === '1') && (
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
                {v.short === '1' && (
                  <button className="fpill" onClick={() => set({ short: undefined })}>
                    ملفها ناقص
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
                title="لا توجد طلبات بهذه الفلاتر."
                note="جرّب توسيع النطاق، أو اختر حالة تانية من الشرائح فوق."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
                <DataTable
                  rows={sorted}
                  all={COLS}
                  table="reg-requests"
                  cols={cols}
                  onCols={setCols}
                  id={(r) => r.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(r) => navigate(ROUTES.entityRequest(r.id))}
                  group={group}
                  count={(n) => `${n} طلب`}
                />
              </Glass>
              {grouped && (
                <p className="sub tcen">
                  التجميع يعرض كل النتائج ·{' '}
                  <span className="num">{splitGroups(sorted, group!).length}</span> مجموعات ·{' '}
                  <button className="lnk" onClick={() => set({ group: undefined })}>
                    إلغاء التجميع
                  </button>
                </p>
              )}
            </>
          ) : (
            cardGroups.map((g) => {
              const meta = REG_STATES.find((s) => s.key === g.key)
              return (
                <section className="paygrp" key={g.key}>
                  <div className="paygrp-h">
                    <h2>{meta?.label}</h2>
                    <span className="sub">
                      {meta?.who} · <span className="num">{g.rows.length}</span> طلب
                    </span>
                  </div>
                  <div className="paygrid">
                    {g.rows.map((r) => (
                      <RegCard key={r.id} r={r} />
                    ))}
                  </div>
                </section>
              )
            })
          )}

          {/* ⚠️ القاعدتان 28 و29 مكتوبتان في الشاشة لأنهما بيفسّروا
              **غياب** زرار · والغياب ما بيشرحش نفسه. */}
          <p className="sub tcen">
            لا يُحذف طلب ولا جهة · المرفوض يُؤرشف بسببه والقائم يُعطَّل
            (القاعدتان <span className="num">28</span> و<span className="num">29</span>) ·{' '}
            <span className="num">{k.total}</span> طلبًا مرسَلًا في هذا النموذج،
            منها <span className="num">{pct(k.rejectedPct)}</span> مرفوضة.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
