import type { ReactNode } from 'react'
import { Empty, Glass, Head, KV, Person } from '@/components/ui'
import { isolate, nf, pct, unitAfter, withUnit } from '@/lib/format'
import { evalScore } from '@/data/closing/store'
import type { ProjectEval } from '@/types/domain'

/* Client 28 Oct · one evaluator's evaluation, read · the same rows the closing page showed for the
   supervisor's, now for each of the three seats under its own title */

export function EvalSummary({ title, ev, meta, by, empty, children }: {
  title: string
  ev?: ProjectEval
  meta?: ReactNode
  by?: string
  /** What reads when this seat hasn't evaluated yet */
  empty?: string
  children?: ReactNode
}) {
  return (
    <Glass>
      <Head title={title} meta={meta} />
      {ev ? (
        <KV
          rows={[
            ...(by ? [{ k: 'المقيِّم', v: <Person name={by} /> }] : []),
            ...ev.indicators.map((i) => ({
              k: `${i.name} · المستهدف ${withUnit(i.target, i.unit)}`,
              v: i.actual === null
                ? <span className="sub">بلا قيمة متحقّقة</span>
                : <span className={i.actual < i.target ? 'bad' : undefined}>
                  <span className="num">{i.unit === '%' ? pct(i.actual) : nf.format(i.actual)}</span>
                  {i.unit !== '%' && <span className="sub"> {unitAfter(i.actual, i.unit)}</span>}
                </span>,
            })),
            ...(ev.criteria ?? []).map((k) => ({
              k: k.points ? k.label : `${k.label} · الوزن ${nf.format(k.weight)}`,
              v: k.rating === null ? <span className="sub">لم يُقيَّم</span> : <><span className="num">{k.rating}</span><span className="sub"> من {k.points ? nf.format(k.weight) : 5}</span></>,
            })),
            /* the questions, then their sum · the old system's order */
            {
              k: ev.criteria?.some((x) => x.points) ? 'حساب التقييم' : ev.criteria?.length ? 'الدرجة الموزونة' : 'التقدير العام · استرشادي',
              v: evalScore(ev) === null
                ? <span className="sub">لم يُحدَّد</span>
                : <><span className="num">{evalScore(ev)}</span><span className="sub"> من 100</span></>,
            },
            ...(ev.impact ? [{ k: 'الأثر المرصود', v: <>{isolate(ev.impact)}</> }] : []),
            ...(ev.lessons ? [{ k: 'الدروس المستفادة', v: <>{isolate(ev.lessons)}</> }] : []),
          ]}
        />
      ) : <Empty title={empty ?? 'لم يقيّم بعد.'} />}
      {children}
    </Glass>
  )
}
