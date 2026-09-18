import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { EVIDENCE_KINDS, PLAN_LIMIT, PLAN_STAGES, planRows } from '@/data/mock/plans'
import type { PlanStage } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   إعدادات الخطط · د-1 و د-3

   ⚠️ **الموديول تحته الموديول وإعداداته وتقاريره** · ده طلب مظفر
   بالنص: «الميزانية عندي تحتها كونفيجريشن وتقارير والميزانية
   نفسها · والمشاريع نفس الحاجة · والجهات نفس الحاجة».

   وفيه نوعان مختلفان هنا، وخلطهم بيخفي الفرق:

     **أنواع الشواهد** · ماستر داتا (د-3) · أي قائمة منسدلة في
       السيستم مكانها الإعدادات، والنوع الجديد بيبان في كل خطة.
     **حدود المراحل** · قاعدة عمل · الرقم بيغيّر **سلوك**: خطة
       عدّت حدّها بتطلع في «المتأخّر» وبتدخل تقرير التصعيد.

   ⚠️ **وكل الأرقام دي افتراضات، والشاشة بتقولها.** الوثيقة ما
   دّتش مدة لأي محطة في BPD-012 · زي «القيمة المستهدفة» الفاضية
   في مؤشرات الصرف بالظبط. عرضها كأنها متّفق عليها بيخلّي اللي
   بعدنا يبني عليها.

   ⚠️ **وعمود «مستعمَل في» مش زينة.** نوع شاهد مالوش استعمال معناه
   إما إنه اتضاف وما حدّش عرفه، أو إنه اتشال من الخطط وفضل في
   القايمة · والرقم بيقول كده من غير ما حد يعدّ.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'evidence', label: 'أنواع الشواهد' },
  { slug: 'limits', label: 'حدود المراحل' },
] as const

export default function PlanSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  /** كام نشاط بيطلب النوع ده · الاستعمال الحقيقي لا العدد المعرَّف */
  const usage = (kind: string) =>
    planRows.reduce(
      (s, p) => s + p.phases.reduce(
        (x, ph) => x + ph.activities.filter((a) => a.needs.includes(kind)).length, 0,
      ), 0,
    )

  /** كام خطة واقفة في المحطة دي دلوقتي */
  const atStage = (k: PlanStage) => planRows.filter((p) => p.stage === k).length

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الخطط')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الخطط</h1>
              <p className="sub mt-1">
                أنواع الشواهد اللي الأنشطة بتطلبها · وحدود المحطات اللي
                بتحدّد إمتى الخطة تتقال عليها متأخّرة
              </p>
            </div>
            <Tag tone="warn">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'evidence' ? (
            <Glass className="tblcard">
              <Head
                title="أنواع الشواهد"
                meta={<span className="sub"><Num>{EVIDENCE_KINDS.length}</Num> نوعًا</span>}
              />
              <p className="sub cnote">
                النشاط بيطلب نوعًا أو أكتر من دول، والجهة ما تقدرش تقول إن
                النشاط خلص قبل ما ترفعهم · ودي اللي بتخلّي مراجعة مشرف المنح
                ممكنة أصلًا (القاعدة <span className="num">14</span>).
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">النوع</span></th>
                    <th className="n"><span className="th-t">مستعمَل في</span></th>
                    <th><span className="th-t">ملاحظة</span></th>
                  </tr>
                </thead>
                <tbody>
                  {EVIDENCE_KINDS.map((k) => {
                    const n = usage(k)
                    return (
                      <tr key={k}>
                        <td>{k}</td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> نشاطًا</>
                            : <span className="sub">لا شيء</span>}
                        </td>
                        <td>
                          {n === 0
                            ? <span className="sub">معرَّف وما حدّش طلبه في خطة</span>
                            : <span className="sub">·</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Glass>
          ) : (
            <Glass className="tblcard">
              <Head
                title="حدود المحطات"
                meta={<Tag tone="warn">الوثيقة ما حدّدتش مدة</Tag>}
              />
              {/* ⚠️ الجملة دي هي اللي بتفرّق بين «رقم اتّفقنا عليه»
                  و«رقم حطّيناه عشان الشاشة تشتغل» · والتاني لازم
                  يفضل موسومًا لحدّ ما المؤسسة تحسمه */}
              <p className="sub cnote">
                BPD-012 ما دّاش مدة لأي محطة · الأرقام دي مؤقتة عشان
                «متأخّرة» يبقى لها معنى في النموذج، ومحتاجة تتأكد مع
                المؤسسة زي سقوف الاعتماد بالظبط.
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المحطة</span></th>
                    <th><span className="th-t">عند مين</span></th>
                    <th className="n"><span className="th-t">الحدّ بالأيام</span></th>
                    <th className="n"><span className="th-t">واقف فيها الآن</span></th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_STAGES.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      <td>{s.who || <span className="sub">·</span>}</td>
                      <td className="n">
                        {PLAN_LIMIT[s.key] > 0
                          ? <span className="num">{Math.round(PLAN_LIMIT[s.key] / 24)}</span>
                          /* ⚠️ «بلا حدّ» لا صفر · التنفيذ مدته من
                             الخطة نفسها لا من إعداد، والصفر هنا كان
                             هيتقري «لازم تخلص النهاردة» */
                          : <span className="sub">بلا حدّ</span>}
                      </td>
                      <td className="n">
                        {atStage(s.key) > 0
                          ? <span className="num">{atStage(s.key)}</span>
                          : <span className="sub">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sub cnote">
                مدة التنفيذ نفسها مش إعدادًا · هي من تواريخ المراحل في
                النسخة المرجعية لكل خطة، والتأخير بيتقاس عليها.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
