import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ButtonLink, FormField, FieldBox, Button, BackTo, Empty, FieldSelect, Glass, Head, Num, StepArc, Tabs, Tag, type GateStep } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, MISSING_ITEM, nounAfter, pct, unitAfter } from '@/lib/format'
import { canStartEval, closeById, evalApproved, evalBlockers } from '@/data/mock/closing'
import { evalCriteriaNow, evalScore, saveEvalReview, saveEvaluation, useClosing } from '@/data/closing/store'
import { evalOf, mySeat, seatsOf } from '@/data/closing/evalSeats'
import { EvalSummary } from './EvalSummary'
import { LogTab } from '@/features/projects/tabs'
import { recordLog } from '@/features/shared/recordLog'
import { closeOutcome } from '@/data/shared/outcome'
import { useIsMobile } from '@/hooks/useMediaQuery'
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
  const { user, role } = useRole()
  const mobile = useIsMobile()
  useClosing()
  const c = closeById(id)
  /* Client 28 Oct · each seat writes its own evaluation at its stage · an approver starts from the
     evaluation before his, so he adjusts it rather than retyping it */
  const seat = c ? mySeat(c, role.key) : undefined
  const seats = c ? seatsOf(c) : []
  const prev = c && seat ? [...seats.slice(0, seats.indexOf(seat) + 1)].reverse().map((s) => evalOf(c, s.who)).find(Boolean) : c?.evaluation
  const start = prev ?? c?.evaluation
  const [view, setView] = useState('evals')

  const [impact, setImpact] = useState(start?.impact ?? '')
  const [lessons, setLessons] = useState(start?.lessons ?? '')
  const [score, setScore] = useState(start?.score?.toString() ?? '')
  const [rates, setRates] = useState<string[]>(start?.criteria?.map((x) => x.rating?.toString() ?? '') ?? [])
  const [vals, setVals] = useState<string[]>(
    start?.indicators.map((i) => i.actual?.toString() ?? '') ?? [],
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

  /* Written by the seat whose stage it is · everyone else reads */
  const closed = evalApproved(c) || !seat
  const missing = seat?.who === 'supervisor' ? evalBlockers(c) : []
  const ev = start ?? c.evaluation
  /* Client 28 Oct · the same questions in every evaluation · an older one without them takes today's */
  const crit = ev.criteria?.length ? ev.criteria : evalCriteriaNow().map((x) => ({ ...x, rating: null }))

  /* Client 28 Oct · the evaluation's approval path as the arc · supervisor, manager, executive */
  const done = c.stage === 'closed'
  const at = done ? seats.length : Math.max(0, seats.findIndex((x) => x.stage === c.stage))
  const steps: GateStep[] = seats.map((x, i) => ({
    label: x.seat,
    title: x.title,
    cap: x.cap,
    state: i < at ? 'done' : i === at ? 'now' : 'pending',
    lines: [evalOf(c, x.who) ? <>قيّم · الدرجة <b>{evalScore(evalOf(c, x.who)) ?? '—'}</b> من 100</> : 'لم يقيّم بعد', i > at ? 'يبدأ بعد اكتمال المرحلة السابقة' : null],
    src: 'المصدر: سجل التقييم',
  }))
  const readOf = (x: (typeof seats)[number]) => {
    const e = evalOf(c, x.who)
    const ahead = !done && seats.indexOf(x) > at
    return <EvalSummary key={x.who} title={x.title} ev={e} by={e?.by ?? (x.who === 'supervisor' ? c.owner : undefined)}
      meta={e ? <Tag tone="ok">قيّم</Tag> : <Tag tone="mute">{ahead ? 'لم يصل إليه' : 'لم يقيّم'}</Tag>}
      empty={ahead ? `يقيّم ${x.seat} حين يصل إليه التقييم.` : `لم يسجّل ${x.seat} تقييمه.`} />
  }
  const holder = done ? { k: 'اكتمل مسار التقييم', t: 'معتمَد' } : { k: 'صاحب التقييم الآن', t: seats[at]?.seat ?? '—' }

  return (
    <AppLayout assistantContext={assistFor.page(`تقييم ${c.projectName}`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="صفحة الإغلاق" onClick={() => navigate(ROUTES.closing(c.id))} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">تقييم المشروع · {c.projectName}</h1>
              {closed && (
                <p className="sub mt-1">
                  {evalApproved(c) ? /* doc rule 21 */ 'اكتمل الإغلاق · الصفحة للقراءة فقط' : 'التقييم في الاعتماد'}
                </p>
              )}
              {/* Status as text, not a colored tag - the page header isn't a card's status field. */}
              <div className="mt-2">
                {closed
                  ? <Tag tone="mute">{evalApproved(c) ? 'معتمَد' : 'للقراءة'}</Tag>
                  : <span className="sub">{missing.length > 0
                    ? <>قبل الإرسال: <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</>
                    : seat?.who === 'supervisor' ? 'جاهز للإرسال' : 'سجّل تقييمك ثم اعتمد من صفحة الإغلاق'}</span>}
              </div>
            </div>
            <div className="pgates">
              <StepArc steps={steps} compact={mobile} aria={`مسار اعتماد التقييم، ${holder.t}`} holderKey={holder.k} holder={holder.t}
                outcome={closeOutcome(c.stage)} />
            </div>
          </header>

          <Tabs items={[
            { slug: 'evals', label: 'التقييمات', count: seats.filter((x) => evalOf(c, x.who)).length || undefined },
            { slug: 'log', label: 'سجل التقييم', count: c.evalAudit?.length || undefined },
          ]} active={view} onChange={setView} />

          {view === 'log' && <LogTab title="سجل التقييم" entityName={c.entityName}
            events={recordLog(`ev-${c.id}`, 'دورة تقييم المشروع', [...(c.evalAudit ?? [])].sort((x, y) => x.at.localeCompare(y.at)))} />}

          {view === 'evals' && <>

          {/* the seats before the reader's own · their evaluations under their own titles, in path order */}
          {(seat ? seats.slice(0, seats.indexOf(seat)) : seats).map(readOf)}

          {seat && <>
          <h2 className="ev-seat">{seat.title}</h2>
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

          {/* v3 · 10.4.31 · client 28 Oct · the old system's questions, each out of its own points, asked of
              every evaluator · the sum is the score out of 100 · a low score doesn't stop the closing */}
          <Glass>
            <Head title="أسئلة التقييم" meta={<span className="sub">حساب التقييم <Num>{evalScore({ ...ev, criteria: crit.map((x, i) => ({ ...x, rating: rates[i] ? Number(rates[i]) : null })) }) ?? '—'}</Num> من 100</span>} />
            {/* one question a row, its points beside it · the old system's sheet */}
            <div className="evq">
              {crit.map((x, i) => (
                <FormField key={x.key} className="evq-r" label={x.points ? <>{x.label} · <Num>{x.weight}</Num> {x.weight > 10 ? 'نقطة' : 'نقاط'}</> : <>{x.label} · الوزن <Num>{x.weight}</Num></>} required>
                  {x.points ? (
                    <FieldBox>
                      <input inputMode="numeric" className="num" value={rates[i] ?? ''} aria-label={x.label} placeholder={`من ${x.weight}`}
                        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); const v = d === '' ? '' : String(Math.min(Number(d), x.weight)); setRates((r) => { const n = [...r]; n[i] = v; return n }) }} />
                    </FieldBox>
                  ) : (
                    <FieldSelect value={rates[i] ?? ''} options={SCORES} onChange={(v) => setRates((r) => { const n = [...r]; n[i] = v; return n })} label={x.label} placeholder="اختر من 5" />
                  )}
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

            {!crit.length && <FormField label="التقدير العام" required>
              <FieldSelect
                value={score}
                options={SCORES}
                onChange={setScore}
                label="التقدير العام"
                placeholder="اختر تقديرًا من 5"
              />
            </FormField>}
          </Glass>

          {!closed && (
            <div className="act-a">
              <Button
                type="button"
                variant="p"
                onClick={() => {
                  const next = {
                    indicators: ev.indicators.map((i, n) => ({ ...i, actual: vals[n] ? Number(vals[n]) : null })),
                    impact, lessons, score: score ? Number(score) : null,
                    ...(crit.length ? { criteria: crit.map((x, i) => ({ ...x, rating: rates[i] ? Number(rates[i]) : null })) } : {}),
                  }
                  if (seat?.who === 'supervisor') saveEvaluation(c.id, next, user.name)
                  else if (seat) saveEvalReview(c.id, seat.who, next, user.name)
                  navigate(ROUTES.closing(c.id))
                }}
              >
                احفظ وارجع إلى الطلب
              </Button>
              <ButtonLink variant="2" to={ROUTES.closing(c.id)}>إلغاء</ButtonLink>
            </div>
          )}
          </>}
          {/* and the seats after it */}
          {seat && seats.slice(seats.indexOf(seat) + 1).map(readOf)}
          </>}

        </div>
      </div>
    </AppLayout>
  )
}
