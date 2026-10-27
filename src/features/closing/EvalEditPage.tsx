import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ButtonLink, FormField, FieldBox, Button, BackTo, Empty, FieldSelect, Glass, Head, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, MISSING_ITEM, nounAfter, pct, unitAfter } from '@/lib/format'
import { canStartEval, closeById, evalApproved, evalBlockers } from '@/data/mock/closing'
import { evalScore, saveEvaluation, useClosing } from '@/data/closing/store'
import { useRole } from '@/hooks/useRole'
import { orgOutputsOf, outputLine } from '@/data/intake/flow'

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
  const { user } = useRole()
  useClosing()
  const c = closeById(id)

  const [impact, setImpact] = useState(c?.evaluation?.impact ?? '')
  const [lessons, setLessons] = useState(c?.evaluation?.lessons ?? '')
  const [score, setScore] = useState(c?.evaluation?.score?.toString() ?? '')
  const [rates, setRates] = useState<string[]>(c?.evaluation?.criteria?.map((x) => x.rating?.toString() ?? '') ?? [])
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
                actions={
                  <Button variant="2" onClick={() => navigate(ROUTES.closings)}>
                    العودة إلى صندوق الإغلاق
                  </Button>
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
              <Head title="لم يبدأ تقييم المشروع بعد" /* doc rule 6 */ />
              <Empty
                title={canStartEval(c)
                  ? 'اعتُمد التقرير · يمكن بدء التقييم الآن.'
                  : 'لم يُعتمد التقرير الختامي بعد.'}
                actions={
                  <ButtonLink variant="p" to={ROUTES.closing(c.id)}>افتح الطلب</ButtonLink>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* Written while it's with the supervisor · in approval or after closing it reads */
  const closed = evalApproved(c) || c.stage !== 'evalDraft'
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
              {closed && (
                <p className="sub mt-1">
                  {evalApproved(c) ? /* doc rule 21 */ 'اكتمل الإغلاق · الصفحة للقراءة فقط' : 'التقييم في الاعتماد'}
                </p>
              )}
            </div>
            {/* Status as text, not a colored tag - the page header isn't a card's status field.
                Counted the same way as "not blocking". */}
            {closed
              ? <Tag tone="mute">{evalApproved(c) ? 'معتمَد' : 'للقراءة'}</Tag>
              : <span className="sub">{missing.length > 0
                ? <>قبل الإرسال: <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</>
                : 'جاهز للإرسال'}</span>}
          </header>

          {/* v3 · 3.4.45 · the evaluation reads against the foundation's outputs · the project's reference */}
          {orgOutputsOf(c.projectId).length > 0 && (
            <Glass>
              <Head title="مخرجات المؤسسة المعتمدة" />
              <ul className="outs-ro">{orgOutputsOf(c.projectId).map((o, i) => <li key={i}>{outputLine(o)}</li>)}</ul>
            </Glass>
          )}

          <Glass>
            <Head
              title="مؤشرات الأداء"
              meta={<span className="sub"><Num>{ev.indicators.length}</Num> مؤشرات</span>}
            />
            {/* Note: open question - are these indicators a fixed list for the institution, or does
                each project have its own from its plan? The spec doesn't say. What's here is drawn
                from the project's targets until the client decides. */}

            <div className="regfields">
              {ev.indicators.map((i, n) => (
                <FormField key={i.name} label={<>
                    {i.name}</>} required>
                  <FieldBox>
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
                  </FieldBox>
                  <span className="sub regf-h">
                    المستهدف <span className="num">{i.unit === '%' ? pct(i.target) : nf.format(i.target)}</span>{i.unit !== '%' && <> {unitAfter(i.target, i.unit)}</>}
                  </span>
                </FormField>
              ))}
            </div>
          </Glass>

          <Glass>
            <Head title="الأثر والدروس" />

            <FormField label="الأثر المرصود" required>
              <FieldBox>
                <textarea
                  rows={3}
                  value={impact}
                  disabled={closed}
                  onChange={(e) => setImpact(e.target.value)}
                  aria-label="الأثر المرصود"
                  placeholder="أربع جمعيات من خمس أصبحت لديها خطة مالية معتمدة"
                />
              </FieldBox>
            </FormField>

            <FormField label="الدروس المستفادة" required>
              <FieldBox>
                <textarea
                  rows={3}
                  value={lessons}
                  disabled={closed}
                  onChange={(e) => setLessons(e.target.value)}
                  aria-label="الدروس المستفادة"
                  placeholder="ربط الصرف بمراحل الترخيص قلّل التأخير إلى شهر بدل ثلاثة"
                />
              </FieldBox>
            </FormField>

            {!ev.criteria?.length && <FormField label="التقدير العام" required>
              <FieldSelect
                value={score}
                options={SCORES}
                onChange={setScore}
                label="التقدير العام"
                placeholder="اختر تقديرًا من 5"
              />
            </FormField>}
          </Glass>

          {/* v3 · 10.4.31 · the questions and weights set by the authority · a score out of 100 · a low
              score doesn't stop the closing */}
          {(ev.criteria?.length ?? 0) > 0 && (
            <Glass>
              <Head title="أسئلة التقييم وأوزانها" meta={<span className="sub">الدرجة <Num>{evalScore({ ...ev, criteria: ev.criteria!.map((x, i) => ({ ...x, rating: rates[i] ? Number(rates[i]) : null })) }) ?? '—'}</Num> من 100</span>} />
              <div className="regfields">
                {ev.criteria!.map((x, i) => (
                  <FormField key={x.key} label={<>{x.label} · الوزن <Num>{x.weight}</Num></>} required>
                    <FieldSelect value={rates[i] ?? ''} options={SCORES} onChange={(v) => setRates((r) => { const n = [...r]; n[i] = v; return n })} label={x.label} placeholder="اختر من 5" />
                  </FormField>
                ))}
              </div>
            </Glass>
          )}

          {!closed && (
            <div className="act-a">
              <Button
                type="button"
                variant="p"
                onClick={() => {
                  saveEvaluation(c.id, {
                    indicators: ev.indicators.map((i, n) => ({ ...i, actual: vals[n] ? Number(vals[n]) : null })),
                    impact, lessons, score: score ? Number(score) : null,
                    ...(ev.criteria ? { criteria: ev.criteria.map((x, i) => ({ ...x, rating: rates[i] ? Number(rates[i]) : null })) } : {}),
                  }, user.name)
                  navigate(ROUTES.closing(c.id))
                }}
              >
                احفظ وارجع إلى الطلب
              </Button>
              <ButtonLink variant="2" to={ROUTES.closing(c.id)}>إلغاء</ButtonLink>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
