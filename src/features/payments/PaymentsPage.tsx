import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, Num, Riyal, SearchBox, Segments, Select, Stat,
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
import { readPayments } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import { BANK_STATES, PAY_STATES, payBlocked, payHeat, payKpi, payRequests } from '@/data/mock/disbursements'
import type { PayRequest, PayState } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { RequestCard } from './RequestCard'
import { COLS, GROUPS, groupByKey } from './columns'

const KEYS = ['q', 'state', 'heat', 'owner', 'entity', 'bank', 'hold', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   صندوق الصرف · BPD-009

   الشاشة دي مش «قائمة دفعات». دي **صندوق قرارات**: 72 طلبًا في
   أربع مراحل، وكل مرحلة ليها صاحب. والسؤال اللي بتجاوبه واحد:
   **إيه اللي واقف عندي، وليه؟**

   ═══ الشكل: نفس عقد القوائم، بلا استثناء ═══

   ترويسة بعمودين (العنوان يمين والقراءة قصاده) → المؤشرات →
   الشرائح → شريط الأدوات → النتيجة. ونفس المبدّل اللي في المشاريع
   والجهات: **جدول وكروت**، لأن الشاشة بتجاوب سؤالين مش واحد.
   الكارت بيقول «ليه ده واقف» بالشروط الأربعة قدامك، والجدول بيقول
   «شكل الطابور كله» · تقارن مبالغ وتواريخ ومشرفين وتصدّرهم.

   وكل عنصر هنا من مكتبة السيستم لا مكتوب للشاشة دي: `Segments`
   للشرائح، `Glass.ftoolbar` للأدوات، `MultiSelect` للفلاتر،
   `DataTable` للجدول، `Empty` للفراغ، `Face` للمشرف. الشاشة اللي
   بتخترع تركيبها بتبان غريبة حتى لو ألوانها مضبوطة.

   ═══ اللي اتعمل بالوثيقة، واللي اتسجّل ملاحظة ═══

   بنينا على `BPD-009`: أربع مراحل تنتهي عند التحويل (خطوة 17–18)،
   وخمس حالات للطلب مصدرها خطوات الوثيقة نفسها. النظام العامل فيه
   **سبعة أقسام** ومستندان بعد التحويل (سند القبض والقيد) وتفريع
   آلي بشرطين · الفروق دي كلها مسجَّلة نوتس مرقّمة في
   `DISBURSEMENT_MODULE_BRIEF.md` (الجزء ب) ومعاها الأثر التصميمي
   لكل احتمال في ردّ العميل.

   وحاجة واحدة خرجت عن حرف الوثيقة بقرار: **حالة الحساب البنكي**
   معروضة جنب كل طلب. الوثيقة ما ذكرتهاش في قواعد الصرف، بس مخرجها
   التاني بيقول «صرف الدفعة إلى **الحساب البنكي المعتمد**»، والنظام
   العامل سبب الإعادة الوحيد المسمّى فيه هو «إعادة إذن الصرف بملاحظة
   البيانات البنكية». فده منع خطأ مكتوب، لا اجتهاد.
   ═══════════════════════════════════════════════════════════ */

const HEATS = [
  { value: 'late', label: 'متأخر عن مدة المرحلة' },
  { value: 'stuck', label: 'متعثر · تجاوز الضعف' },
]

/* اللي فوق مش بيتحسب في عدّاد «الفلاتر المتقدمة» · العدّاد بيقول
   اللي **مخفي** بس، وإلا بيعدّ حاجة المستخدم شايفها قدامه */
const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'state', 'heat', 'hold']

export default function PaymentsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const k = payKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('payments', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('payments', cols), [cols])

  /* الجدول على الموبايل بيضغط كل عمود لحد ما كل خلية تلفّ عمودًا من
     الكلمات · الكارت هو صف الموبايل. وهنا الكارت هو الديفولت كمان
     على الديسكتوب، عكس المشاريع: الطابور ٧٢ طلبًا لا ٤٩٢٩، والقرار
     محتاج سببه قدامه. الجدول للمقارنة والتصدير. */
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
      if (entities.length && !entities.includes(r.entityName)) return false
      if (banks.length && !banks.includes(r.bank.active ? 'معتمد' : 'معطَّل')) return false
      if (v.hold === '1' && !payBlocked(r)) return false
      if (needle) {
        const hay = `${r.id} ${r.projectName} ${r.entityName} ${r.projectId}`
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [v])

  /* الأكثر تعثّرًا فوق · الصندوق بيترتّب بالخطر لا بالتاريخ، لأن
     السؤال «إيه اللي واقف» لا «إيه اللي جديد» */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.hoursInState - a.hoursInState),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readPayments(rows, filtered), [rows, filtered])

  /** عدّاد كل مرحلة جوّه النطاق الحالي، مش على الكل */
  const counts = useMemo(() => {
    const needle = v.q?.trim()
    const owners = readList(v.owner)
    const entities = readList(v.entity)
    const banks = readList(v.bank)
    const base = payRequests.filter((r) => {
      if (v.heat && payHeat(r) !== v.heat) return false
      if (owners.length && !owners.includes(r.owner)) return false
      if (entities.length && !entities.includes(r.entityName)) return false
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

  /** الجهات اللي ليها طلبات فعلًا · فلتر ما بيعرضش خيارًا بلا نتيجة */
  const entityOptions = useMemo(
    () => [...new Set(payRequests.map((r) => r.entityName))].sort((a, b) => a.localeCompare(b, 'ar')),
    [],
  )

  const group = groupByKey(v.group)
  const grouped = Boolean(group)

  /* التجميع في الكروت بالمرحلة دايمًا · الصندوق بيتقري بالمرحلة،
     والشريحة بتضيّق النطاق مش بتلغي التجميع */
  const cardGroups = useMemo(() => {
    const pick = readList(v.state)
    const list = pick.length ? PAY_STATES.filter((s) => pick.includes(s.key)) : PAY_STATES
    return list
      .map((s) => ({ key: s.key, rows: sorted.filter((r) => r.state === s.key) }))
      .filter((g) => g.rows.length > 0)
  }, [sorted, v.state])

  const sheet: Sheet = useMemo(() => {
    const shown = orderCols(COLS, cols).filter((c) => !group || c.key !== group.key)
    const pick = selected.size ? sorted.filter((r) => selected.has(r.id)) : sorted
    const head = [...(group ? [group.label] : []), ...shown.map((c) => c.label)]
    const body = pick.map((r) => [
      ...(group ? [group.of(r)] : []),
      ...shown.map((c) => c.text(r)),
    ])
    const totals = [
      ...(group ? [''] : []),
      ...shown.map((c, i) => {
        const t = aggregate(c, pick)
        return t !== null ? String(t) : i === 0 ? `${pick.length} طلب` : ''
      }),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return { file: `abanumay-payments-${stamp}`, title: 'الصرف', headers: head, rows: body, totals }
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
      text: key === 'state' ? PAY_STATES.find((s) => s.key === value)?.label ?? value : value,
    })),
  )

  return (
    <AppLayout assistantContext={assistFor.page('الصرف')}>
      <div className="viewstack">
        <div className="screen col">
          {/* ⚠️ **ترويسة قائمة، مش ترويسة تفاصيل.** كانت
              `phead phead-g2` والقراءة جوّاها في العمود التاني —
              ودي ترويسة **صفحة الجهة والمشروع**، يعني صفحة تفاصيل.
              والنتيجة إن القراءة بتتزنق في نص العرض فسطرها بيتقصّ
              بنقط، بينما نفس القراءة في المشاريع والجهات بتاخد
              السطر كامل وتتقري لآخرها.
              القائمة ترويستها `<header>` بسيطة، والقراءة **صفّ
              مستقل تحتها** — زي `/projects` و`/entities` بالحرف. */}
          <header>
            <div>
              <h1 className="ptitle">الصرف</h1>
              <p className="sub mt-1">
                <span className="num">{rows.length}</span> طلب من{' '}
                <span className="num">{payRequests.length}</span> في هذا النموذج ·{' '}
                أربع مراحل من إنشاء الجهة للطلب حتى تنفيذ التحويل
              </p>
            </div>
          </header>

          {/* ═══ القراءة السريعة ═══
              مكانها بعد العنوان مباشرة لا بعد الفلاتر: هي **قراءة
              للصفحة**، والقراءة بتيجي قبل الأدوات لا بينها وبين
              النتيجة. */}
          <QuickRead variant="bar" title="قراءة سريعة للصندوق" readings={readings} />

          <div className="stats4">
            <Stat
              label="طلبات مفتوحة"
              value={<Num>{k.open}</Num>}
              note={`${k.blocked} منها موقوف بشرط`}
              bar={{ w: `${Math.round((k.blocked / k.open) * 100)}%`, c: 'var(--warn)' }}
            />
            <Stat
              label="قيمة الطلبات المفتوحة"
              value={<Num>{k.openSum}</Num>}
              unit={<Riyal />}
              note="بانتظار اعتماد أو تحويل"
            />
            {/* مؤشر 1 في الوثيقة · والقيمة المستهدفة **فاضية** في
                الوثيقة، فالرقم بيتعرض قيمةً ولا بيتلوّن حالةً */}
            <Stat
              label="متوسط مدة المعالجة"
              value={<Num>{k.avgDays}</Num>}
              unit="يومًا"
              note="المستهدف: بانتظار المؤسسة"
            />
            {/* مؤشر 4 في الوثيقة · نفس الملاحظة.
                وعلامة النسبة **جوّه** الرقم لا جنبه: `<Num>` بتعزل
                الرقم وحده، فالـ`%` اللي برّه الجزيرة بتفضل محايدة
                وموضعها بيتحدّد بجيرانها لا برقمها. */}
            <Stat
              label="الالتزام بجدول الدفعات"
              value={<Num>{pct(k.onSchedule)}</Num>}
              note="المستهدف: بانتظار المؤسسة"
              bar={{ w: `${k.onSchedule}%`, c: 'var(--lime)' }}
            />
          </div>

          {/* شرائح المراحل · نفس صفّ اللقطات في باقي القوائم، وكل
              شريحة بعدّادها جوّه النطاق الحالي */}
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

          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <SearchBox
                  value={v.q ?? ''}
                  onChange={(x) => set({ q: x || undefined })}
                  placeholder="ابحث برقم الطلب أو المشروع أو الجهة…"
                />
                {/* `people` هي اللي بتنزّل الوش في القائمة · نفس الوش
                    اللي في الكارت وفي عمود الجدول، فالشخص واحد في
                    التلات أماكن */}
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
                {/* الباقي مطوي ومعاه عدّاد · نفس قاعدة المشاريع
                    والجهات: اللي بيتفلتر بيه كل يوم فوق، والباقي
                    خلف الزرار. الصفّ اللي بيلفّ سطرين معناه إن
                    فلترًا نزل تحت وباظ ترتيبه. */}
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

              {/* الأدوات اللي مش فلاتر · مجموعة ثابتة في آخر الصفّ،
                  فالفلاتر بتلفّ جوّه مجموعتها والمبدّل ما بينطّش */}
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
                    <Icon name={icons.close} size={13} />
                  </button>
                ))}
                {v.heat && (
                  <button className="fpill" onClick={() => set({ heat: undefined })}>
                    <span className="sub">المدة:</span>{' '}
                    {HEATS.find((h) => h.value === v.heat)?.label}
                    <Icon name={icons.close} size={13} />
                  </button>
                )}
                {v.hold === '1' && (
                  <button className="fpill" onClick={() => set({ hold: undefined })}>
                    الموقوف بشرط
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
                note="جرّب توسيع النطاق، أو اختر مرحلة تانية من الشرائح فوق."
                actions={<button className="btn btn-2" onClick={clear}>مسح الفلاتر</button>}
              />
            </Glass>
          ) : view === 'table' ? (
            <>
              <Glass className="tblcard">
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
              const meta = PAY_STATES.find((s) => s.key === g.key)
              return (
                <section className="paygrp" key={g.key}>
                  <div className="paygrp-h">
                    <h2>{meta?.label ?? 'مغلقة'}</h2>
                    <span className="sub">
                      {meta?.who ? `عند ${meta.who}` : 'مكتملة'} ·{' '}
                      <span className="num">{g.rows.length}</span> طلب ·{' '}
                      خطوات <span className="num">{meta?.steps}</span> في الوثيقة
                    </span>
                  </div>
                  <div className="paygrid">
                    {g.rows.map((r: PayRequest) => (
                      <RequestCard key={r.id} r={r} />
                    ))}
                  </div>
                </section>
              )
            })
          )}
        </div>
      </div>
    </AppLayout>
  )
}
