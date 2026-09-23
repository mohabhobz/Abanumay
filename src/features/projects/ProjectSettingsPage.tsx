import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Money, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { pct as sayPct } from '@/lib/format'
import {
  APPROVAL_MATRIX, MONEY_LIMITS, approverFor, projectsUnder,
} from '@/data/mock/settings'

/* ═══════════════════════════════════════════════════════════
   إعدادات المشاريع والصرف · د-2

   ⚠️ **دي قواعد عمل لا ماستر داتا.** الفرق إن الرقم هنا بيغيّر
   **سلوك** إجراء لا محتوى قايمة: تغيير سقف مشرف المنح بيحوّل
   مشاريع من طاولة لطاولة تانية فورًا.

   ⚠️ **وكل الأرقام دي افتراضات.** إجراء الصرف بيقول إن المدد
   والسقوف «من الإعدادات» من غير ما يدّي قيمة واحدة · زي «القيمة
   المستهدفة» الفاضية في المؤشرات. فالشاشة بتوسمها **افتراضًا**
   بدل ما تعرضها كأنها متّفق عليها · واللي بيقراها بيعرف إنها
   محتاجة تتأكد (س-1 في بريف بنية الموديول).

   ⚠️ **وعمود «مشاريع تحته» مش زينة.** هو اللي بيكشف سقفًا غلط:
   لو مجلس الإدارة طلع تحته نص المشاريع، يبقى السقف اللي تحته
   واطي · والرقم بيقول كده من غير ما حد يحسب.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'approval', label: 'مصفوفة الاعتماد' },
  { slug: 'limits', label: 'الحدود المالية والزمنية' },
] as const

/** مبلغ بيتجرَّب على المصفوفة · بيخلّي القاعدة تتقري بدل ما تتشرح */
const TRY = 750_000

export default function ProjectSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  const [probe, setProbe] = useState(String(TRY))
  const amount = Number(probe.replace(/[^\d]/g, '')) || 0
  const who = approverFor(amount)

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات المشاريع والصرف')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات المشاريع والصرف</h1>
              <p className="sub mt-1">
                الأرقام التي تحدّد صاحب الاعتماد ومتى يُعدّ الإجراء متأخّرًا ·
                وكلها تغيّر سلوك الإجراء لا محتوى قائمة
              </p>
            </div>
            <Tag tone="warn">قيم افتراضية</Tag>
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })} />

          {tab === 'approval' ? (
            <>
              {/* ⚠️ القاعدة بتتقري بالتجربة لا بالشرح · المشرف
                  بيكتب مبلغًا وبيشوف مين هيعتمده، بدل ما يقرا
                  أربع صفوف ويحسبها في دماغه */}
              <Glass>
                <Head
                  title="جرّب المبلغ"
                  meta={<span className="sub">تُقرأ القاعدة من الأسفل إلى الأعلى</span>}
                />
                <div className="cfgrow">
                  <label className="regf cfgwide">
                    <span className="lb">مبلغ المشروع</span>
                    <span className="fld">
                      <input
                        className="num"
                        inputMode="numeric"
                        value={probe}
                        onChange={(e) => setProbe(e.target.value)}
                        aria-label="مبلغ المشروع"
                      />
                    </span>
                  </label>
                </div>
                <p className="sub cnote">
                  مبلغ <Money>{amount}</Money> يعتمده <b>{who.role}</b> ·
                  صاحب القرار هو أول مستوى حدّه المالي أكبر من المبلغ.
                </p>
              </Glass>

              <Glass className="tblcard">
                <Head
                  title="المصفوفة"
                  meta={<span className="sub"><Num>{APPROVAL_MATRIX.length}</Num> مستويات</span>}
                />
                <ul className="cfglist">
                  {APPROVAL_MATRIX.map((r) => {
                    const on = r.key === who.key
                    return (
                      <li key={r.key} className={on ? 'on' : ''}>
                        <b>{r.role}</b>
                        <span className="sub">
                          {r.upTo === null
                            ? 'فما فوق · بلا حدّ مالي'
                            : <>حتى <Money>{r.upTo}</Money></>}
                        </span>
                        <span className="pc-sp" />
                        {on && <Tag tone="mute">يعتمد المبلغ المجرَّب</Tag>}
                        <Tag tone="mute"><Num>{projectsUnder(r)}</Num> مشروعًا تحته</Tag>
                      </li>
                    )
                  })}
                </ul>
                <p className="sub cnote">
                  هذه الأرقام <b>افتراضات</b> · تنصّ الوثيقة على أن السقوف «من
                  الإعدادات» دون أن تحدّد قيمة، والمؤسسة هي التي تحسمها.
                </p>
              </Glass>
            </>
          ) : (
            <Glass className="tblcard">
              <Head
                title="الحدود"
                meta={<span className="sub"><Num>{MONEY_LIMITS.length}</Num> حدود</span>}
              />
              {/* ⚠️ الوحدة في الاسم لا في الرقم · الرقم بيفضل رقمًا
                  عشان يتفرز ويتحسب، والوحدة بتتقال جنبه */}
              <ul className="cfglist">
                {MONEY_LIMITS.map((l) => (
                  <li key={l.key}>
                    <b>{l.label}</b>
                    <span className="sub trim1">{l.where}</span>
                    <span className="pc-sp" />
                    {l.assumed && <Tag tone="warn">افتراضي</Tag>}
                    <span className="num">
                      {l.unit === 'ريال'
                        ? <Money>{l.value}</Money>
                        : l.unit === '%'
                          ? <span className="num">{sayPct(l.value)}</span>
                          : <><Num>{l.value}</Num> {l.unit}</>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="sub cnote">
                كل رقم هنا يظهر في إجراء · والعمود الثاني يبيّن موضعه
                بالتحديد، ليعرف من يغيّره أثر التغيير.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
