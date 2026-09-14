import { useMemo } from 'react'
import {
  Empty, Glass, Icon, icons, Num, Riyal, SearchBox, Segments, Select, Stat, Toggle,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { QuickRead } from '@/components/assistant'
import { assistFor } from '@/data/mock/assistant'
import { readPayments } from '@/data/readings'
import { OWNERS } from '@/data/mock/taxonomy'
import {
  PAY_STATES, payBlocked, payHeat, payKpi, payRequests,
} from '@/data/mock/disbursements'
import type { PayRequest, PayState } from '@/types/domain'
import { RequestCard } from './RequestCard'

const KEYS = ['q', 'state', 'heat', 'owner', 'hold'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

/* ═══════════════════════════════════════════════════════════
   صندوق الصرف · BPD-009

   الشاشة دي مش «قائمة دفعات». دي **صندوق قرارات**: 72 طلبًا في
   أربع مراحل، وكل مرحلة ليها صاحب. فالتجميع بالمرحلة لا بالمشروع،
   والسؤال اللي الشاشة بتجاوبه واحد: **إيه اللي واقف عندي، وليه؟**

   والحجم هو اللي حسم الشكل. النظام العامل فيه ٣١ طلبًا عند المشرف
   و١٠ عند المالية و٣٠ عند الجهة · مش آلاف الصفوف. عند الحجم ده
   الصفّ بيخفي السبب والكارت بيوَرّيه، وده اللي خلّى كل كارت يحمل
   الشروط الأربعة اللي الوثيقة بتمنع الانتقال عليها.

   ═══ ترتيب الشاشة · نفس ترتيب كل قائمة في السيستم ═══

   عنوان بسيط → قراءة سريعة → شرائح النطاق → شريط الفلاتر → النتيجة.
   الشاشة دي كانت خارجة عن الترتيب ده في أربع حاجات، وكلها اتصلّحت:

     · ترويسة `phead phead-g2` · دي ترويسة **صفحة تفاصيل** (عمودين،
       الشمال فيها رسم). القائمة ترويستها `<header>` بسيطة، والعنوان
       تحته سطر واحد بالعدد.
     · المساعد ما كانش موجود خالص · كل قائمة في السيستم لها
       `QuickRead` بعد العنوان مباشرة، وهو اللي بيقول **السبب** مش
       العدد. `readPayments` بتحسبه من نفس الصفوف المعروضة.
     · الفلاتر كانت في `<div className="ftool">` · كلاس **مش موجود
       في الـCSS أصلًا**، فالشريط كان بيقع على ستايل افتراضي. الصح
       `<Glass className="ftoolbar">` بنفس `ftool-r/f/a`.
     · الشرائح كانت جدول مخصّص (`.payst`) بأربع أعمدة وعدّادات وأسماء
       أصحاب · تركيب اتكتب من الصفر بينما `Segments` بيعمله بعدّاده.
       واتشال معاه البانر: التصعيد بقى قراءة ليها طريق، لا رقم أصم.

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

const NOT_FILTERS: (keyof Params)[] = ['q', 'state']

export default function PaymentsPage() {
  const { values: v, set, clear, activeCount } = useQueryParams<Params>(KEYS)
  const k = payKpi()

  const rows = useMemo(() => {
    const needle = v.q?.trim()
    return payRequests.filter((r) => {
      if (v.state && r.state !== v.state) return false
      if (v.heat && payHeat(r) !== v.heat) return false
      if (v.owner && r.owner !== v.owner) return false
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

  const filtered = activeCount([]) > 0
  const readings = useMemo(() => readPayments(rows, filtered), [rows, filtered])

  /** عدّاد كل مرحلة جوّه النطاق الحالي، مش على الكل */
  const counts = useMemo(() => {
    const needle = v.q?.trim()
    const base = payRequests.filter((r) => {
      if (v.heat && payHeat(r) !== v.heat) return false
      if (v.owner && r.owner !== v.owner) return false
      if (v.hold === '1' && !payBlocked(r)) return false
      if (needle && !`${r.id} ${r.projectName} ${r.entityName} ${r.projectId}`.includes(needle))
        return false
      return true
    })
    const m = new Map<PayState, number>()
    for (const r of base) m.set(r.state, (m.get(r.state) ?? 0) + 1)
    return { m, total: base.length }
  }, [v.heat, v.owner, v.hold, v.q])

  const groups = v.state
    ? [{ key: v.state as PayState, rows: sorted }]
    : PAY_STATES.map((s) => ({
        key: s.key,
        rows: sorted.filter((r) => r.state === s.key),
      })).filter((g) => g.rows.length > 0)

  return (
    <AppLayout assistantContext={assistFor.page('الصرف')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الصرف</h1>
              <p className="sub" style={{ marginTop: '.3rem' }}>
                <span className="num">{rows.length}</span> طلب من{' '}
                <span className="num">{payRequests.length}</span> في هذا النموذج ·{' '}
                أربع مراحل من إنشاء الجهة للطلب حتى تنفيذ التحويل
              </p>
            </div>
          </header>

          {/* القراءة قبل الأدوات · هي قراءة **للصفحة**، فمكانها بعد
              العنوان لا بين الفلتر واللي رجع منه */}
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
            {/* مؤشر 4 في الوثيقة · نفس الملاحظة */}
            <Stat
              label="الالتزام بجدول الدفعات"
              value={<><Num>{k.onSchedule}</Num>%</>}
              note="المستهدف: بانتظار المؤسسة"
              bar={{ w: `${k.onSchedule}%`, c: 'var(--lime)' }}
            />
          </div>

          {/* شرائح المراحل · نفس صفّ اللقطات في باقي القوائم، وكل
              شريحة بعدّادها جوّه النطاق الحالي */}
          <Segments
            active={v.state ?? ''}
            onChange={(x) => set({ state: x })}
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
                <Select
                  icon={icons.users}
                  value={v.owner}
                  all="كل المشرفين"
                  options={OWNERS as unknown as string[]}
                  onChange={(x) => set({ owner: x })}
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
              </div>
            </div>

            {activeCount(NOT_FILTERS) > 0 && (
              <div className="factive">
                {v.heat && (
                  <button className="fpill" onClick={() => set({ heat: undefined })}>
                    <span className="sub">المدة:</span>{' '}
                    {HEATS.find((h) => h.value === v.heat)?.label}
                    <Icon name={icons.close} size={13} />
                  </button>
                )}
                {v.owner && (
                  <button className="fpill" onClick={() => set({ owner: undefined })}>
                    <span className="sub">المشرف:</span> {v.owner}
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
          ) : (
            groups.map((g) => {
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
                      <RequestCard key={r.id} r={r} showState={Boolean(v.state)} />
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
