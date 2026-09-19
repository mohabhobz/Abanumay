import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { CLOSE_DOCS, CLOSE_LIMIT, CLOSE_STAGES, closeRows } from '@/data/mock/closing'
import type { CloseStage } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   إعدادات الإغلاق · نفس شكل إعدادات الخطط بالحرف

   ⚠️ **الموديول تحته الموديول وإعداداته وتقاريره** · طلب مظفر.

   وفيه نوعان مختلفان هنا، وخلطهم بيخفي الفرق:

     **المستندات الداعمة** · ماستر داتا · والإلزامي منها بيمنع
       الإرسال فعلًا (قاعدة 3 و4)، فالعمود بيقول إلزامي ولا داعم.
     **حدود المحطات** · قاعدة عمل · الرقم بيغيّر **سلوك**: طلب
       عدّى حدّه بيطلع في «المتأخّر».

   ⚠️ **وكل الأرقام دي افتراضات، والشاشة بتقولها.** الوثيقة بتقيس
   «متوسط مدة إغلاق المشروع» (مؤشر 1) وما بتحطّش حدًّا لأي محطة ·
   والسؤال س-18 مفتوح عند المؤسسة.

   ⚠️ **وعمود «مرفوع في» مش زينة.** مستند مالوش استعمال في أي
   طلب معناه إما إنه اتضاف وما حدّش طلبه، أو إن الجهات كلها
   بتتخطّاه · والرقم بيقول كده من غير ما حد يعدّ.
   ═══════════════════════════════════════════════════════════ */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'docs', label: 'المستندات الداعمة' },
  { slug: 'limits', label: 'حدود المحطات' },
] as const

export default function CloseSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  /** كام طلب رافع المستند ده فعلًا */
  const usage = (key: string) =>
    closeRows.filter((c) => c.report.docs.includes(key)).length

  /** كام طلب واقف في المحطة دي دلوقتي */
  const atStage = (k: CloseStage) => closeRows.filter((c) => c.stage === k).length

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الإغلاق')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الإغلاق</h1>
              <p className="sub mt-1">
                المستندات اللي التقرير الختامي بيطلبها · وحدود المحطات اللي
                بتحدّد إمتى الطلب يتقال عليه متأخّر
              </p>
            </div>
            <Tag tone="warn">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'docs' ? (
            <Glass className="tblcard">
              <Head
                title="المستندات الداعمة"
                meta={<span className="sub"><Num>{CLOSE_DOCS.length}</Num> مستندًا</span>}
              />
              <p className="sub cnote">
                القاعدة <span className="num">3</span> بتلزم إرفاق المستندات الداعمة
                قبل إرسال التقرير، والقاعدة <span className="num">5</span> بتسمح إن
                المواد الإعلامية والفيديوهات تتبعت <b>روابط تخزين سحابي معتمدة</b>
                بدل الرفع · وهي عادةً أكبر من أي حدّ رفع.
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المستند</span></th>
                    <th><span className="th-t">إلزامي</span></th>
                    <th className="n"><span className="th-t">مرفوع في</span></th>
                  </tr>
                </thead>
                <tbody>
                  {CLOSE_DOCS.map((d) => {
                    const n = usage(d.key)
                    return (
                      <tr key={d.key}>
                        <td>{d.label}</td>
                        <td>
                          {d.req
                            ? <Tag tone="ret">إلزامي · قاعدة 4</Tag>
                            : <span className="sub">داعم</span>}
                        </td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> طلب</>
                            : <span className="sub">لا شيء</span>}
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
                  و«رقم حطّيناه عشان الشاشة تشتغل» */}
              <p className="sub cnote">
                BPD-011 بتقيس متوسط مدة الإغلاق (مؤشر <span className="num">1</span>)
                وما بتحطّش حدًّا لأي محطة · الأرقام دي مؤقتة عشان «متأخّر» يبقى له
                معنى في النموذج، ومحتاجة تتأكد مع المؤسسة (السؤال س-18).
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المحطة</span></th>
                    <th><span className="th-t">الدورة</span></th>
                    <th><span className="th-t">عند مين</span></th>
                    <th className="n"><span className="th-t">الحدّ بالأيام</span></th>
                    <th className="n"><span className="th-t">واقف فيها الآن</span></th>
                  </tr>
                </thead>
                <tbody>
                  {CLOSE_STAGES.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      {/* ⚠️ الدورة عمود هنا لأن نفس اسم المحطة بيتكرّر
                          في الاتنين · قاعدة 17 */}
                      <td>
                        <span className="sub">
                          {s.cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}
                        </span>
                      </td>
                      <td>{s.who || <span className="sub">·</span>}</td>
                      <td className="n">
                        {CLOSE_LIMIT[s.key] > 0
                          ? <span className="num">{Math.round(CLOSE_LIMIT[s.key] / 24)}</span>
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
                محطة الاتصال المؤسسي بتتخطّى لمّا الاتفاقية مفيهاش التزام نشر
                إعلامي (القاعدة <span className="num">9</span>) · فحدّها بيتحسب على
                الطلبات اللي بتعدّي منها وحدها.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
