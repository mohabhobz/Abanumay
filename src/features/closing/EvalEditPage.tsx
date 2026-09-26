import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackTo, Empty, FieldSelect, Glass, Head, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, MISSING_ITEM, nounAfter, pct, unitAfter } from '@/lib/format'
import { canStartEval, closeById, evalApproved, evalBlockers } from '@/data/mock/closing'

/* Project evaluation editor - written by the grants supervisor, not the entity.

   Note: this isn't a matter of roles alone. The final report is an assertion from the implementer,
   and the evaluation is a judgment from the funder - so whoever reads both needs to know who said
   what. That's why this page is institution-only.

   Note: it doesn't open before executive-director approval - rule 6 - and the screen states the
   reason rather than saying "unavailable".

   Note: indicators show their target next to them - same principle as the report editor: a number
   with no reference gets written carelessly.

   Note: the score is advisory - rule 13 - so the field states next to it that it supports a
   decision, not that it is one. */

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

  /* Note: absence is stated with its reason - "unavailable" makes the supervisor go looking for a
   missing permission, when the real reason is a rule in the spec. */
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
            {/* Status as text, not a colored tag - the page header isn't a card's status field. Counted the same
   way as "not blocking". */}
            {closed
              ? <Tag tone="mute">معتمَد</Tag>
              : <span className="sub">{missing.length > 0
                ? <>قبل الإرسال: <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</>
                : 'جاهز للإرسال'}</span>}
          </header>

          <Glass>
            <Head
              title="مؤشرات الأداء"
              meta={<span className="sub"><Num>{ev.indicators.length}</Num> مؤشرات</span>}
            />
            {/* Note: open question - are these indicators a fixed list for the institution, or does each project
   have its own from its plan? The spec doesn't say. What's here is drawn from the project's targets
   until the client decides. */}
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
                    المستهدف <span className="num">{i.unit === '%' ? pct(i.target) : nf.format(i.target)}</span>{i.unit !== '%' && <> {unitAfter(i.target, i.unit)}</>}
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

            {/* Note: lessons learned feed into later projects, not a closing checkbox. This is the field most
   often filled in as a formality in reports, and the line beneath it states where it actually goes.
   */}
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
