import { useState, type ReactNode } from 'react'
import { Button, DateText, Glass, Head, Icon, KV, Num, Person, icons } from '@/components/ui'
import { isolate, nf, pct, unitAfter, withUnit } from '@/lib/format'
import { evalScore } from '@/data/closing/store'
import type { ProjectEval } from '@/types/domain'

/* Client 28 Oct · one evaluator's evaluation, read · a record that opens and closes · closed it reads
   who evaluated, when, and the score · «تفاصيل التقييم» opens the questions, the indicators and the
   lessons, and closes them again, so three evaluations stay a short screen */

export function EvalSummary({ title, ev, meta, by, at, empty, children }: {
  title: string
  ev?: ProjectEval
  meta?: ReactNode
  by?: string
  /** The day it was written */
  at?: string
  /** What reads when this seat hasn't evaluated yet */
  empty?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const score = ev ? evalScore(ev) : null
  return (
    <Glass className="evrec">
      <Head title={title} meta={meta} />
      {ev && (
        <div className="evrec-h">
          {by && <span className="evrec-i"><span className="sub">المقيِّم</span><Person name={by} /></span>}
          {at && <span className="evrec-i"><span className="sub">تاريخ التقييم</span><DateText>{at}</DateText></span>}
          <span className="evrec-i"><span className="sub">حساب التقييم</span>{score === null ? <span className="sub">لم يُحدَّد</span> : <b><Num>{score}</Num> <span className="sub">من 100</span></b>}</span>
          <span className="pc-sp" />
          <Button plain type="button" className="lgmore" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
            <Icon name={open ? icons.chevronUp : icons.chevronDown} size="sm" />
            {open ? 'أخفِ التفاصيل' : 'تفاصيل التقييم'}
          </Button>
        </div>
      )}
      {ev ? open && (
        <KV
          rows={[
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
      ) : <p className="sub evrec-h">{empty ?? 'لم يقيّم بعد.'}</p>}
      {children}
    </Glass>
  )
}
