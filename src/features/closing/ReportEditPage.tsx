import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, Num, Tag } from '@/components/ui'
import { DocList, type DocRow } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import {
  CLOSE_DOCS, closeById, evalApproved, reportBlockers, reportGap,
} from '@/data/mock/closing'

/* ═══════════════════════════════════════════════════════════
   محرّر التقرير الختامي · الجهة بتكتبه

   ⚠️ **الأربعة الإلزامية مسمّيين في القاعدة 4 بالحرف**: «عدد
   المستفيدين الفعلي، والميزانية الفعلية، ومدة التنفيذ، وأبرز
   المخرجات والنتائج المحققة» · فهم مش اختيارات، والنجمة عليهم
   بتقول كده.

   ⚠️ **وكل حقل جنبه المعتمد.** ده الفرق الوحيد بين المحرّر ده
   وأي فورم في السيستم: الجهة وهي بتكتب «٧٨٠» شايفة إن المعتمد
   «١٠٠٠» · فبتكتب التفسير في «التحديات» من نفسها بدل ما المراجع
   يرجّعها عشان يسأل. الرقم اللي مالوش مرجع بيتكتب بلا وعي.

   ⚠️ **وبعد الإغلاق النهائي الصفحة بتتقفل** · قاعدة 21: أي تعديل
   بعد الإغلاق بيحتاج إجراء جديد · فمفيش حقول، فيه عرض.

   ⚠️ **ومفيش جدول مرفقات مكتوب هنا** · `DocList` هو الشكل الواحد،
   و`tools/onedoc.mjs` بيمنع غيره. الدرس اتكرّر مرة بعد ما
   الفاحص اتكتب (`.ptl-short`)، فمكتوب هنا صراحةً.
   ═══════════════════════════════════════════════════════════ */

export default function ReportEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const c = closeById(id)

  const [ben, setBen] = useState(c?.report.beneficiaries?.toString() ?? '')
  const [budget, setBudget] = useState(c?.report.budget?.toString() ?? '')
  const [days, setDays] = useState(c?.report.days?.toString() ?? '')
  const [outcomes, setOutcomes] = useState(c?.report.outcomes ?? '')
  const [risks, setRisks] = useState(c?.report.risks ?? '')
  const [link, setLink] = useState('')

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('تقرير غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                note="ارجع لصندوق الإغلاق واختر واحدًا."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.closings)}>
                    صندوق الإغلاق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const closed = evalApproved(c)
  const gaps = reportGap(c)
  const planBen = gaps.find((g) => g.key === 'ben')?.planned ?? 0
  const planBudget = gaps.find((g) => g.key === 'budget')?.planned ?? 0
  const missing = reportBlockers(c)

  const docRows: DocRow[] = CLOSE_DOCS.map((d) => ({
    name: `${d.label}.pdf`,
    meta: d.req ? 'مستند إلزامي · قاعدة 4' : 'مستند داعم · قاعدة 5',
    uploaded: c.report.docs.includes(d.key),
    required: d.req,
    action: !c.report.docs.includes(d.key) && !closed
      ? <button className="btn btn-2 btn-sm">ارفع</button>
      : undefined,
  }))

  return (
    <AppLayout assistantContext={assistFor.page(`تقرير ${c.projectName} الختامي`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="صفحة الإغلاق" onClick={() => navigate(ROUTES.closing(c.id))} />

          <header>
            <div>
              <h1 className="ptitle">التقرير الختامي · {c.projectName}</h1>
              <p className="sub mt-1">
                {closed
                  ? 'الإغلاق اكتمل · الصفحة للقراءة، وأي تعديل بعده بيحتاج إجراءً جديدًا (قاعدة 21)'
                  : <>القاعدة <span className="num">4</span> بتحدّد أربع بيانات كحدّ
                    أدنى · وكل واحد فيهم جنبه المعتمد عشان الفرق يبان وإنت بتكتب</>}
              </p>
            </div>
            {closed
              ? <Tag tone="ok">مغلق · للقراءة</Tag>
              : missing.length > 0
                ? <Tag tone="no"><Num>{missing.length}</Num> بند ناقص</Tag>
                : <Tag tone="ok">الحدّ الأدنى مكتمل</Tag>}
          </header>

          <Glass>
            <Head
              title="التنفيذ الفعلي"
              meta={<Tag tone="ret">قاعدة <Num>4</Num></Tag>}
            />

            <div className="regfields">
              <label className="regf">
                <span className="lb">
                  عدد المستفيدين الفعلي<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <span className="fld">
                  <input
                    inputMode="numeric"
                    value={ben}
                    disabled={closed}
                    onChange={(e) => setBen(e.target.value.replace(/\D/g, ''))}
                    aria-label="عدد المستفيدين الفعلي"
                    placeholder="0"
                  />
                </span>
                <span className="sub regf-h">
                  المعتمد في المشروع <span className="num">{nf.format(planBen)}</span> مستفيد
                </span>
              </label>

              <label className="regf">
                <span className="lb">
                  الميزانية الفعلية<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <span className="fld">
                  <input
                    inputMode="numeric"
                    value={budget}
                    disabled={closed}
                    onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
                    aria-label="الميزانية الفعلية"
                    placeholder="0"
                  />
                </span>
                <span className="sub regf-h">
                  قيمة المنحة <span className="num">{nf.format(planBudget)}</span> ريال
                </span>
              </label>

              <label className="regf">
                <span className="lb">
                  مدة التنفيذ الفعلية<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <span className="fld">
                  <input
                    inputMode="numeric"
                    value={days}
                    disabled={closed}
                    onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
                    aria-label="مدة التنفيذ الفعلية بالأيام"
                    placeholder="0"
                  />
                </span>
                <span className="sub regf-h">بالأيام · من بداية التنفيذ لنهايته</span>
              </label>
            </div>
          </Glass>

          <Glass>
            <Head title="المخرجات والتحديات" />

            <label className="regf">
              <span className="lb">
                أبرز المخرجات والنتائج المحققة<b className="regf-r" aria-label="إلزامي">*</b>
              </span>
              <span className="fld">
                <textarea
                  rows={4}
                  value={outcomes}
                  disabled={closed}
                  onChange={(e) => setOutcomes(e.target.value)}
                  aria-label="أبرز المخرجات والنتائج المحققة"
                  placeholder="اتنفّذت 42 جلسة من 48 · وخدمت 780 مستفيدًا في ستة مراكز"
                />
              </span>
              <span className="sub regf-h">
                دي رابع بيانات القاعدة <span className="num">4</span> · والمراجع
                بيقارنها بأهداف المشروع في الاتفاقية والخطة
              </span>
            </label>

            {/* ⚠️ **التحديات مش إلزامية، وهي أهم حقل في الصفحة.**
                القاعدة 4 ما بتطلبهاش · لكن الفرق بين المعتمد والفعلي
                لو ما اتفسّرش بيرجع سؤالًا من المراجع، والدورة بتلفّ
                مرة زيادة. فالسطر تحت الحقل بيقول ده صراحةً. */}
            <label className="regf">
              <span className="lb">التحديات والانحرافات</span>
              <span className="fld">
                <textarea
                  rows={3}
                  value={risks}
                  disabled={closed}
                  onChange={(e) => setRisks(e.target.value)}
                  aria-label="التحديات والانحرافات"
                  placeholder="تأخّر التوريد شهرًا في المرحلة التانية"
                />
              </span>
              <span className="sub regf-h">
                اختياري · بس أي فرق عن المعتمد بلا تفسير بيرجع سؤالًا من المراجعة،
                والإعادة بتخلّي إصدارًا جديدًا (قاعدة <span className="num">19</span>)
              </span>
            </label>
          </Glass>

          <Glass>
            <Head
              title="المستندات الداعمة"
              meta={
                <span className="sub">
                  <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
                </span>
              }
            />
            <DocList rows={docRows} label="المستندات الداعمة للتقرير الختامي وحالتها" />

            {/* ⚠️ الرابط السحابي **نوع تاني من المرفق لا بديل عنه** ·
                قاعدة 5 بتسمّي Google Drive بالنصّ، والسبب عملي */}
            <label className="regf">
              <span className="lb">رابط تخزين سحابي</span>
              <span className="fld">
                <input
                  value={link}
                  disabled={closed}
                  onChange={(e) => setLink(e.target.value)}
                  aria-label="رابط تخزين سحابي"
                  placeholder="https://drive.google.com/..."
                />
              </span>
              <span className="sub regf-h">
                القاعدة <span className="num">5</span> بتسمح بالمواد الإعلامية
                والفيديوهات كروابط تخزين معتمدة · وهي عادةً أكبر من أي حدّ رفع
              </span>
            </label>
          </Glass>

          {!closed && (
            <div className="act-a">
              <Link className="btn btn-p" to={ROUTES.closing(c.id)}>
                احفظ وارجع للطلب
              </Link>
              <Link className="btn btn-2" to={ROUTES.closing(c.id)}>إلغاء</Link>
            </div>
          )}

          <p className="sub tcen">
            الحفظ ما بيبعتش · الإرسال للمراجعة من صفحة الطلب، والقاعدة{' '}
            <span className="num">3</span> بتمنعه قبل اكتمال البيانات والمستندات.
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
