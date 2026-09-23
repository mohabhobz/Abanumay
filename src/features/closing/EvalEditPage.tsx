import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackTo, Empty, FieldSelect, Glass, Head, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, MISSING_ITEM, nounAfter } from '@/lib/format'
import { canStartEval, closeById, evalApproved, evalBlockers } from '@/data/mock/closing'

/* ═══════════════════════════════════════════════════════════
   محرّر تقييم المشروع · **مشرف المنح بيكتبه لا الجهة**

   ⚠️ **ودي مش تفصيلة أدوار.** التقرير الختامي إقرار من المنفِّذ،
   والتقييم **حكم من المموِّل** · فاللي بيقرا الاتنين لازم يعرف
   مين قال إيه. ولذلك الصفحة دي بعين المؤسسة وحدها.

   ⚠️ **وما بتتفتحش قبل اعتماد المدير التنفيذي** · قاعدة 6 ·
   والشاشة بتقول السبب لا بتقول «غير متاح».

   ⚠️ **والمؤشرات مستهدفها جنبها** · نفس مبدأ محرّر التقرير:
   الرقم اللي مالوش مرجع بيتكتب بلا وعي.

   ⚠️ **والتقدير استرشادي** · قاعدة 13 · فالحقل مكتوب جنبه إنه
   دعم للقرار لا قرار.
   ═══════════════════════════════════════════════════════════ */

const SCORES = [
  { value: '1', label: '1 · لم يحقق أهدافه' },
  { value: '2', label: '2 · حقق جزءًا محدودًا' },
  { value: '3', label: '3 · حقق أهدافه الأساسية' },
  { value: '4', label: '4 · حقق أهدافه وزيادة' },
  { value: '5', label: '5 · تجاوز المستهدف بوضوح' },
]

export default function EvalEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const c = closeById(id)

  const [impact, setImpact] = useState(c?.evaluation?.impact ?? '')
  const [lessons, setLessons] = useState(c?.evaluation?.lessons ?? '')
  const [score, setScore] = useState(c?.evaluation?.score?.toString() ?? '')
  const [vals, setVals] = useState<string[]>(
    c?.evaluation?.indicators.map((i) => i.actual?.toString() ?? '') ?? [],
  )

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('تقييم غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                note="ارجع إلى صندوق الإغلاق واختر طلبًا منه."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.closings)}>
                    العودة إلى صندوق الإغلاق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* ⚠️ **الغياب بيتقال مع سببه** · «غير متاح» بيخلّي المشرف يدوّر
     على صلاحية ناقصة، والسبب الحقيقي قاعدة في الوثيقة. */
  if (!c.evaluation) {
    return (
      <AppLayout assistantContext={assistFor.page(`تقييم ${c.projectName}`)}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="صفحة الإغلاق" onClick={() => navigate(ROUTES.closing(c.id))} />
            <Glass>
              <Head title="لم يبدأ تقييم المشروع بعد" meta={<Tag tone="mute">قاعدة <Num>6</Num></Tag>} />
              <Empty
                title={canStartEval(c)
                  ? 'اعتُمد التقرير · يمكن بدء التقييم الآن.'
                  : 'لا يبدأ التقييم قبل اعتماد المدير التنفيذي للتقرير الختامي.'}
                note={canStartEval(c)
                  ? 'ابدأه من رصيف صفحة الطلب · يُعدّه مشرف المنح، ودورته سجلّ منفصل (قاعدة 17).'
                  : 'تربط القاعدة 6 بدء التقييم باعتماد المدير التنفيذي تحديدًا، لا باعتماد المشرف ولا المدير.'}
                actions={
                  <Link className="btn btn-p" to={ROUTES.closing(c.id)}>افتح الطلب</Link>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const closed = evalApproved(c)
  const missing = evalBlockers(c)
  const ev = c.evaluation

  return (
    <AppLayout assistantContext={assistFor.page(`تقييم ${c.projectName}`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="صفحة الإغلاق" onClick={() => navigate(ROUTES.closing(c.id))} />

          <header>
            <div>
              <h1 className="ptitle">تقييم المشروع · {c.projectName}</h1>
              <p className="sub mt-1">
                {closed
                  ? 'اكتمل الإغلاق · الصفحة للقراءة فقط (قاعدة 21)'
                  : <>يُعدّه مشرف المنح بعد اعتماد التقرير الختامي · ودورة اعتماده
                    مستقلّة بسجلّ منفصل (القاعدة <span className="num">17</span>)</>}
              </p>
            </div>
            {closed
              ? <Tag tone="ok">معتمَد</Tag>
              : missing.length > 0
                ? <Tag tone="no"><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</Tag>
                : <Tag tone="ok">جاهز للإرسال</Tag>}
          </header>

          <Glass>
            <Head
              title="مؤشرات الأداء"
              meta={<span className="sub"><Num>{ev.indicators.length}</Num> مؤشرات</span>}
            />
            {/* ⚠️ **س-17 مفتوح**: المؤشرات دي قايمة ثابتة للمؤسسة ولا
                لكل مشروع مؤشراته من خطته؟ الوثيقة ما بتقولش · واللي
                هنا مأخوذ من مستهدفات المشروع لحدّ ما العميل يحسمها. */}
            <p className="sub cnote">
              المستهدف بجانب كل مؤشر · والمتحقّق الذي يُكتب هنا هو ما تُبنى عليه
              المقارنة. وهذه المؤشرات مأخوذة من مستهدفات المشروع إلى أن تحدّد
              المؤسسة قائمتها (السؤال س-17).
            </p>

            <div className="regfields">
              {ev.indicators.map((i, n) => (
                <label className="regf" key={i.name}>
                  <span className="lb">
                    {i.name}<b className="regf-r" aria-label="إلزامي">*</b>
                  </span>
                  <span className="fld">
                    <input
                      inputMode="numeric"
                      value={vals[n] ?? ''}
                      disabled={closed}
                      onChange={(e) => setVals((x) => {
                        const next = [...x]
                        next[n] = e.target.value.replace(/\D/g, '')
                        return next
                      })}
                      aria-label={`المتحقّق في ${i.name}`}
                      placeholder="0"
                    />
                  </span>
                  <span className="sub regf-h">
                    المستهدف <span className="num">{nf.format(i.target)}</span> {i.unit}
                  </span>
                </label>
              ))}
            </div>
          </Glass>

          <Glass>
            <Head title="الأثر والدروس" />

            <label className="regf">
              <span className="lb">
                الأثر المرصود<b className="regf-r" aria-label="إلزامي">*</b>
              </span>
              <span className="fld">
                <textarea
                  rows={3}
                  value={impact}
                  disabled={closed}
                  onChange={(e) => setImpact(e.target.value)}
                  aria-label="الأثر المرصود"
                  placeholder="أربع جمعيات من خمس أصبحت لديها خطة مالية معتمدة"
                />
              </span>
              <span className="sub regf-h">
                الأثر ليس تكرارًا للمخرجات · المخرج «36 ورشة»، والأثر «ما تغيّر بعدها»
              </span>
            </label>

            {/* ⚠️ **الدروس المستفادة مدخل لمشاريع بعده لا خانة
                ختامية.** دي أكتر حاجة بتتكتب صوريًّا في التقارير ·
                والسطر تحتها بيقول فين بتروح. */}
            <label className="regf">
              <span className="lb">
                الدروس المستفادة<b className="regf-r" aria-label="إلزامي">*</b>
              </span>
              <span className="fld">
                <textarea
                  rows={3}
                  value={lessons}
                  disabled={closed}
                  onChange={(e) => setLessons(e.target.value)}
                  aria-label="الدروس المستفادة"
                  placeholder="ربط الصرف بمراحل الترخيص قلّل التأخير إلى شهر بدل ثلاثة"
                />
              </span>
              <span className="sub regf-h">
                تُقرأ عند دراسة مشروع مشابه لهذه الجهة أو لغيرها · فما يُكتب هنا
                يُرجع إليه في الدراسات اللاحقة
              </span>
            </label>

            <label className="regf">
              <span className="lb">
                التقدير العام<b className="regf-r" aria-label="إلزامي">*</b>
              </span>
              <FieldSelect
                value={score}
                options={SCORES}
                onChange={setScore}
                label="التقدير العام"
                placeholder="اختر تقديرًا من 5"
              />
              <span className="sub regf-h">
                استرشادي · تنص القاعدة <span className="num">13</span> على أن مخرجات
                التحليل دعم للمراجعة لا بديل عن اعتماد أصحاب الصلاحية
              </span>
            </label>
          </Glass>

          {!closed && (
            <div className="act-a">
              <Link className="btn btn-p" to={ROUTES.closing(c.id)}>
                احفظ وارجع إلى الطلب
              </Link>
              <Link className="btn btn-2" to={ROUTES.closing(c.id)}>إلغاء</Link>
            </div>
          )}

          <p className="sub tcen">
            الحفظ لا يُرسل التقييم · الإرسال إلى مدير المنح من صفحة الطلب، ودورة اعتماد
            التقييم منفصلة عن دورة التقرير (القاعدة <span className="num">17</span>).
          </p>
        </div>
      </div>
    </AppLayout>
  )
}
