import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Empty, Glass, Icon, icons, MultiSelect, GroupPicker, Num, SearchBox, Segments, Select, Stat,
  Toggle, ViewToggle,
} from '@/components/ui'
import { nf, pct } from '@/lib/format'
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
  AGREEMENT_STAGES, AGR_TARGET_DAYS, agrBlocked, agrHeat, agrKpi, agreements,
} from '@/data/mock/agreements'
import type { AgreementRow, AgreementStage } from '@/types/domain'
import type { Sheet } from '@/lib/export'
import { AgreementCard } from './AgreementCard'
import { COLS, GROUPS } from './columns'

const KEYS = ['q', 'stage', 'heat', 'owner', 'kind', 'hold', 'view', 'group', 'adv'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   صندوق الاتفاقيات · BPD-008

   ⚠️ **الاتفاقية إجراء مستقل، مش تاب في المشروع.** القاعدة 23
   بتقولها صريحة، والـ25 بتشرح أثرها: انتقال الاتفاقية بين مراحلها
   ما بيغيّرش حالة المشروع · المشروع بيفضل «إعداد الاتفاقية» لحدّ
   الاعتماد النهائي. يعني اتفاقية عند المدير التنفيذي ومشروعها لسّه
   مكتوب عليه «إعداد الاتفاقية»، والاتنين صح ولا واحد فيهم بيكدب.

   وده اللي بيخلّي الموديول ده صندوقًا: المشرف اللي عنده تسع
   اتفاقيات في أربع مراحل مختلفة ما يقدرش يتابعهم من صفحات المشاريع
   واحدة واحدة.

   ═══ الشكل: نفس عقد القوائم ═══

   عنوان → قراءة سريعة → مؤشرات الوثيقة الأربعة → شرائح المراحل →
   شريط الأدوات → جدول أو كروت. كل عنصر من المكتبة، ولا تركيب
   مكتوب للشاشة دي.

   ═══ الفرق عن النظام العامل · نوتة ═══

   النظام العامل فيه سبعة أقسام للاتفاقية، وفيها **اعتماد الإتفاقية
   (القسم المالي)** — محطة اعتماد مش موجودة في مخطط الوثيقة خالص،
   واللي بيعدّي من مدير المنح للمدير التنفيذي مباشرة. مسجَّل نوتة
   مع باقي الفروق.
   ═══════════════════════════════════════════════════════════ */

const HEATS = [
  { value: 'late', label: 'متأخرة عن مدة المرحلة' },
  { value: 'stuck', label: 'متعثرة · تجاوزت الضعف' },
]

const KINDS = ['إلكترونية', 'ورقية']

/* اللي فوق مش بيتحسب في عدّاد الفلاتر المتقدمة */
const NOT_FILTERS: (keyof Params)[] = ['q', 'view', 'group', 'adv', 'stage', 'heat', 'hold']

export default function AgreementsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const navigate = useNavigate()
  const k = agrKpi()
  const [cols, setCols] = useState<string[]>(() => readCols('agreements', COLS))
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => writeCols('agreements', cols), [cols])

  const mobile = useIsMobile()
  const view = mobile ? 'cards' : v.view === 'table' ? 'table' : 'cards'
  const advOpen = v.adv === '1'

  const rows = useMemo(() => {
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
  }, [v])

  /* الأطول وقوفًا فوق · الصندوق بيترتّب بالخطر لا بالتاريخ */
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.hoursInStage - a.hoursInStage),
    [rows],
  )

  const filtered = activeCount(['view', 'group', 'adv']) > 0
  const readings = useMemo(() => readAgreements(rows, filtered), [rows, filtered])

  /** عدّاد كل مرحلة جوّه النطاق الحالي */
  const counts = useMemo(() => {
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
  }, [v.heat, v.owner, v.kind, v.hold, v.q])

  /* ي-13 · التجميع بيفضل مع الجلسة بدل ما يضيع مع كل خروج */
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
    /* ⚠️ **الورقة مبنيّة في `sheetOf` لا هنا.** خمس شاشات كانت
       بتكتب نفس التلات سطور بإيدها · وأول ما التجميع بقى سلسلة،
       الخمسة كانوا هيحتاجوا نفس التعديل خمس مرات، واللي يتنسي
       بيطلع ملفًا مختلفًا عن شاشته. */
    const shown = orderCols(COLS, cols).filter((c) => !group.some((g) => g.key === c.key))
    const pickRows = selected.size ? sorted.filter((a) => selected.has(a.id)) : sorted
    const parts = sheetOf(pickRows, shown, group, (n: number) => `${n} اتفاقية`)
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
                <span className="num">{rows.length}</span> اتفاقية من{' '}
                <span className="num">{agreements.length}</span> في هذا النموذج ·{' '}
                <span className="num">{k.open}</span> تحت الإعداد و
                <span className="num">{k.active}</span> سارية ·{' '}
                <span className="num">{k.blocked}</span> موقوفة عن الاعتماد
              </p>
            </div>

            {/* ⚠️ **مفيش `PageActions` هنا عن قصد، لا سهوًا.**
                العقد بيقول إن الإنشاء مكانه الترويسة · وهو ما بيقولش
                إن كل شاشة لازم يكون فيها إنشاء. الاتفاقية ما بتتعملش
                من الصندوق: هي بتتولد **لمشروع**، فمدخلها تاب
                «الاتفاقية» في صفحة المشروع. الصندوق بيجاوب «إيه اللي
                واقف عندي» لا «اعمل اتفاقية جديدة».
                والسطر ده مكتوب عشان اللي جاي ما يضيفش زرارًا
                «للاتّساق» ويكسر القاعدة الحقيقية. */}
          </header>

          <QuickRead
            variant="bar"
            title="قراءة سريعة للاتفاقيات"
            readings={readings}
            empty="مفيش اتفاقية موقوفة عن الاعتماد في النطاق الحالي · وسّع الفلتر تشوف أكتر."
          />

          {/* ⚠️ الأربعة دي هي مؤشرات الوثيقة الأربعة (9.7)، لا أربعة
              أرقام مختارة · وعمود «القيمة المستهدفة» فاضي فيها كلها،
              فالرقم بيتعرض قيمةً لا حالةً. */}
          <div className="stats4">
            <Stat
              label="متوسط مدة إعداد الاتفاقية"
              value={<Num>{k.prepDays}</Num>}
              unit="يومًا"
              note="مؤشر 1 · المستهدف بانتظار المؤسسة"
            />
            <Stat
              label="المنجزة ضمن المدة المستهدفة"
              value={<Num>{pct(k.inTarget)}</Num>}
              note={`مؤشر 2 · المدة المؤقتة ${AGR_TARGET_DAYS} يومًا`}
              bar={{ w: `${k.inTarget}%`, c: 'var(--teal)' }}
            />
            <Stat
              label="متوسط مدة دورة الاعتماد"
              value={<Num>{k.cycleDays}</Num>}
              unit="يومًا"
              note="مؤشر 3 · من الإرسال حتى اكتمال الاعتمادات"
            />
            <Stat
              label="المعادة للتعديل"
              value={<Num>{pct(k.returnedPct)}</Num>}
              note="مؤشر 4 · كل إعادة دورة اعتماد كاملة"
              bar={{ w: `${k.returnedPct}%`, c: 'var(--warn)' }}
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

          <Glass className="ftoolbar">
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
                  <Icon name={icons.filter} size={15} />
                  فلاتر متقدمة
                  {activeCount(NOT_FILTERS) > 0 && (
                    <b className="num">{activeCount(NOT_FILTERS)}</b>
                  )}
                </button>
                {view === 'table' && (
                  <GroupPicker
                    icon={icons.rows}
                    value={v.group}
                    options={GROUPS.map((g) => ({ value: g.key, label: g.label }))}
                    onChange={(x) => set({ group: x })}
                  />
                )}
              </div>

              <div className="ftool-a">
                <ExportMenu
                  sheet={sheet}
                  note={`${selected.size ? 'الصفوف المحدَّدة' : 'نتيجة الفلتر الحالي'} · ${selected.size || sorted.length} اتفاقية`}
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
                    الموقوفة عن الاعتماد
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
                title="لا توجد اتفاقيات بهذه الفلاتر."
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
                  table="agreements"
                  cols={cols}
                  onCols={setCols}
                  id={(a) => a.id}
                  selected={selected}
                  onSelect={toggleOne}
                  onSelectAll={selectAll}
                  onOpen={(a) => navigate(ROUTES.agreement(a.id))}
                  group={grouped ? group : undefined}
                  count={(n) => `${n} اتفاقية`}
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
                      {meta?.who ? `عند ${meta.who}` : 'مفعّلة'} ·{' '}
                      <span className="num">{g.rows.length}</span> اتفاقية ·{' '}
                      خطوات <span className="num">{meta?.steps}</span> في الوثيقة
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

          {/* ⚠️ القاعدة 25 مكتوبة في الشاشة لا في التعليق بس · هي
              أكتر حاجة بتلخبط لما تشوف اتفاقية «بانتظار المدير
              التنفيذي» ومشروعها مكتوب عليه «إعداد الاتفاقية». */}
          <p className="sub tcen">
            مرحلة الاتفاقية لا تغيّر حالة المشروع · يبقى «إعداد الاتفاقية» حتى
            اعتمادها النهائي، والقاعدة <span className="num">25</span> في الوثيقة.
            وإجمالي قيمة الاتفاقيات تحت الإعداد{' '}
            <span className="num">{nf.format(k.openSum)}</span> ريال.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
