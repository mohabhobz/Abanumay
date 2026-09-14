import { useMemo } from 'react'
import { Glass, Head, Icon, icons, Num, Riyal, SearchBox, Segments, Select, Stat, Toggle } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { pct } from '@/lib/format'
import { assistFor } from '@/data/mock/assistant'
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
  { key: '', label: 'الكل' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
]

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

  /** عدّاد كل مرحلة جوّه النطاق الحالي، مش على الكل */
  const counts = useMemo(() => {
    const base = payRequests.filter((r) => {
      if (v.heat && payHeat(r) !== v.heat) return false
      if (v.owner && r.owner !== v.owner) return false
      if (v.hold === '1' && !payBlocked(r)) return false
      return true
    })
    const m = new Map<PayState, number>()
    for (const r of base) m.set(r.state, (m.get(r.state) ?? 0) + 1)
    return m
  }, [v.heat, v.owner, v.hold])

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
          <header className="phead phead-g2">
            <div className="pmain">
              <h1 className="ptitle">الصرف</h1>
              <p className="sub pay-sub">
                طلبات صرف الدفعات · أربع مراحل من إنشاء الجهة للطلب حتى تنفيذ
                التحويل، وكل طلب بيقول أي قاعدة واقفة قصاده.
              </p>
            </div>

            {/* الترويسة كانت فيها سُلّم بالمراحل الأربعة، واتشال:
                شريط المراحل تحت بيقول نفس التركيب **ومعاه عدّاد**،
                والسُّلّم كل محطاته `todo` فبيتقري «مفيش حاجة خلصت»
                لا «دي بنية الإجراء». تركيب واحد يتقال مرة واحدة. */}
          </header>

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

          {/* التصعيد (9.5 بند 3) بيطلب «تقرير شامل بالمتأخرة
              والمتعثرة» · هو مش تقرير منفصل، هو فلتر على نفس الصندوق،
              فالمشرف ما بيسيبش مكان القرار عشان يشوف المتأخر */}
          {(k.late > 0 || k.stuck > 0) && (
            <div className="payban">
              <Icon name={icons.alert} size={16} />
              <span>
                <b><Num>{k.stuck}</Num></b> متعثر و<b><Num>{k.late}</Num></b> متأخر
                عن مدة المرحلة.
              </span>
              <span className="pc-sp" />
              <button
                /* `btn-p` لا `btn-1` · مفيش كلاس اسمه `btn-1` في
                   السيستم، فالزرار كان بيقع على `.btn` العريان
                   وقت التفعيل · جرد الأزرار في `uiaudit` هو اللي
                   وَرّى الاسم المخترع. */
                className={`btn btn-sm ${v.heat === 'stuck' ? 'btn-p' : 'btn-2'}`}
                onClick={() => set({ heat: v.heat === 'stuck' ? undefined : 'stuck' })}
              >
                اعرض المتعثر
              </button>
            </div>
          )}

          <div className="ftool">
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
                  people
                  options={OWNERS as unknown as string[]}
                  onChange={(x) => set({ owner: x })}
                />
                <Segments
                  items={HEATS}
                  active={v.heat ?? ''}
                  onChange={(x) => set({ heat: x })}
                />
                <Toggle
                  label="الموقوف بشرط"
                  on={v.hold === '1'}
                  onChange={(on) => set({ hold: on ? '1' : undefined })}
                />
              </div>
              <div className="ftool-a">
                {activeCount([]) > 0 && (
                  <button className="btn btn-2 btn-sm" onClick={clear}>
                    مسح الفلاتر
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* شرائح المراحل · كل واحدة بعدّادها، فالمشرف يعرف فين
              الضغط قبل ما يفتح */}
          <div className="payst">
            <button
              className={`payst-i${!v.state ? ' on' : ''}`}
              onClick={() => set({ state: undefined })}
            >
              <span className="payst-n num">{rows.length}</span>
              <span className="payst-l">الكل</span>
            </button>
            {PAY_STATES.map((s) => (
              <button
                key={s.key}
                className={`payst-i${v.state === s.key ? ' on' : ''}`}
                onClick={() => set({ state: v.state === s.key ? undefined : s.key })}
              >
                <span className="payst-n num">{counts.get(s.key) ?? 0}</span>
                <span className="payst-l">{s.label}</span>
                <span className="payst-w sub">{s.who || 'مكتملة'}</span>
              </button>
            ))}
          </div>

          {sorted.length === 0 ? (
            <Glass>
              <Head title="لا توجد طلبات" meta="بالفلاتر الحالية" />
              <p className="sub" style={{ margin: 0 }}>
                جرّب تمسح الفلاتر، أو شوف مرحلة تانية من الشرائح فوق.
              </p>
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
