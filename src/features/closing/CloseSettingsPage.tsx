import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Num, Tabs, Tag, Nil } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { CLOSE_DOCS, CLOSE_LIMIT, CLOSE_STAGES, closeRows } from '@/data/mock/closing'
import type { CloseStage } from '@/types/domain'
import { NOUN, nounAfter } from '@/lib/format'

/* Closing settings - same layout as plan settings, exactly.

   Note: this module sits under the module, its settings, and its reports.

   Two different kinds live here, and mixing them hides the difference:
   - supporting documents - master data - and marking one required actually blocks submission (rules
   3 and 4), so the column states required or supporting.
   - stage limits - a business rule - the number changes behavior: a request past its limit shows up
   under "overdue".

   Note: all these numbers are assumptions, and the screen says so. The spec measures "average
   project closing duration" (indicator 1) and sets no limit for any individual stage - this is an
   open question for the institution.

   Note: the "uploaded in" column isn't decorative. A document with no use in any request means
   either it was added and never requested, or every entity skips it - and the number says so
   without anyone counting. */

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

  /** How many requests actually uploaded this document. */
  const usage = (key: string) =>
    closeRows.filter((c) => c.report.docs.includes(key)).length

  /** How many requests currently sit at this stage. */
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
                المستندات التي يطلبها التقرير الختامي · وحدود المحطات التي
                تحدّد متى يُعدّ الطلب متأخرًا
              </p>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
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
                meta={<span className="sub"><Num>{CLOSE_DOCS.length}</Num> {nounAfter(CLOSE_DOCS.length, NOUN.doc)}</span>}
              />
              <p className="sub cnote">
                تُلزم القاعدة <span className="num">3</span> بإرفاق المستندات الداعمة
                قبل إرسال التقرير، وتسمح القاعدة <span className="num">5</span> بإرسال
                المواد الإعلامية والفيديوهات <b>روابط تخزين سحابي معتمدة</b>
                بدل رفعها · فهي عادةً أكبر من أي حدّ رفع.
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
                            ? <Tag tone="mute">إلزامي · قاعدة 4</Tag>
                            : <span className="sub">داعم</span>}
                        </td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> {nounAfter(n, NOUN.request)}</>
                            : <span className="sub">لم يُرفع</span>}
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
                meta={<Tag tone="warn">لم تحدّد الوثيقة مدة</Tag>}
              />
              {/* Note: this sentence is what separates "a number we agreed on" from "a number we put in so the
   screen would work." */}
              <p className="sub cnote">
                تقيس BPD-011 متوسط مدة الإغلاق (مؤشر <span className="num">1</span>)
                ولا تضع حدًّا لأي محطة · هذه الأرقام مؤقتة ليكون لوصف «متأخّر»
                معنى في النموذج، وتحتاج إلى تأكيد المؤسسة (السؤال س-18).
              </p>
              <table className="tbl">
                <colgroup><col /><col /><col /><col /><col /></colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">المحطة</span></th>
                    <th><span className="th-t">الدورة</span></th>
                    <th><span className="th-t">المسؤول</span></th>
                    <th className="n"><span className="th-t">الحدّ بالأيام</span></th>
                    <th className="n"><span className="th-t">الطلبات فيها الآن</span></th>
                  </tr>
                </thead>
                <tbody>
                  {CLOSE_STAGES.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      {/* Note: cycle is a column here because the same stage name repeats across both cycles - rule 17. */}
                      <td>
                        <span className="sub">
                          {s.cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}
                        </span>
                      </td>
                      <td>{s.who || <Nil />}</td>
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
                تُتخطّى محطة الاتصال المؤسسي إذا خلت الاتفاقية من التزام نشر
                إعلامي (القاعدة <span className="num">9</span>) · فيُحسب حدّها على
                الطلبات التي تمرّ بها فقط.
              </p>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
