import { useMemo, useState } from 'react'
import { Glass, Head, Money, Num, Select } from '@/components/ui'
import { nf, NOUN, nounAfter, pct, unitAfter } from '@/lib/format'
import { projectRows } from '@/data/mock/projects'
import { PERIODS } from '@/data/reportDefs'
import { type Sheet } from '@/lib/export'
import { ExportMenu } from '@/components/export'
import type { ProjectRow } from '@/types/domain'
import { days } from '@/lib/tone'

/**
 * Report builder.
 *
 * The dashboard answers known questions. This is for the question that
 * isn't among them: dimension × metric, with the table and columns
 * changing as you pick. Why one tool instead of a screen per question?
 * Because the current system tried the opposite — fourteen screens, each
 * with its own filters — and the result was that any question not
 * anticipated in the design had no home at all, so it went to Excel. This
 * tool covers every combination (7 dimensions × 6 metrics = 42 reports) in
 * one screen the user learns once.
 */

type Dim = { key: string; label: string; of: (p: ProjectRow) => string }
type Measure = {
  key: string
  label: string
  /** Value from a single row. */
  of: (p: ProjectRow) => number
  /** Sum or average. */
  agg: 'sum' | 'avg'
  money?: boolean
  unit?: string
}

const DIMS: Dim[] = [
  { key: 'region', label: 'المنطقة', of: (p) => p.region },
  { key: 'track', label: 'المسار', of: (p) => p.track },
  { key: 'field', label: 'المجال', of: (p) => p.field },
  { key: 'goal', label: 'الهدف', of: (p) => p.goal },
  { key: 'entity', label: 'الجهة', of: (p) => p.entityName },
  { key: 'owner', label: 'مالك المشروع', of: (p) => p.owner ?? 'بلا مالك' },
  { key: 'status', label: 'الحالة', of: (p) => p.statusGroup },
  { key: 'stage', label: 'القسم الإجرائي', of: (p) => p.stage },
]

const MEASURES: Measure[] = [
  { key: 'count', label: 'عدد المشاريع', of: () => 1, agg: 'sum' },
  { key: 'granted', label: 'المبلغ المعتمد', of: (p) => p.amountGranted, agg: 'sum', money: true },
  { key: 'requested', label: 'المبلغ المطلوب', of: (p) => p.amountRequested, agg: 'sum', money: true },
  { key: 'spent', label: 'المصروف', of: (p) => p.amountSpent, agg: 'sum', money: true },
  { key: 'benef', label: 'المستفيدون', of: (p) => p.beneficiaries, agg: 'sum' },
  { key: 'stay', label: 'متوسط المكوث', of: (p) => days(p.hoursInStage), agg: 'avg', unit: 'يومًا' },
]

export function Builder() {
  const [period, setPeriod] = useState<string>(PERIODS[0].id)
  const [dimKey, setDim] = useState('region')
  const [meaKey, setMea] = useState('granted')

  const dim = DIMS.find((d) => d.key === dimKey) ?? DIMS[0]
  const mea = MEASURES.find((m) => m.key === meaKey) ?? MEASURES[0]

  const rows = useMemo(() => {
    const src = projectRows.filter((p) => p.year === period)
    const by = new Map<string, { n: number; total: number }>()
    for (const p of src) {
      const k = dim.of(p) || 'بلا قيمة'
      const g = by.get(k) ?? { n: 0, total: 0 }
      g.n += 1
      g.total += mea.of(p)
      by.set(k, g)
    }
    return [...by.entries()]
      .map(([k, g]) => ({ k, n: g.n, v: mea.agg === 'avg' ? Math.round(g.total / g.n) : g.total }))
      .sort((a, b) => b.v - a.v)
  }, [period, dim, mea])

  const max = rows.length ? rows[0].v || 1 : 1
  const total = rows.reduce((s, r) => s + r.v, 0)

  /* Export scope is written above the list: the report builder exports
     exactly what's on screen — the same dimension, metric, and period. */
  const note = `${mea.label} حسب ${dim.label} · ${PERIODS.find((p) => p.id === period)?.label ?? ''}`

  const sheet: Sheet = {
    file: `abanumay-${dim.key}-${mea.key}-${period}`,
    title: `${mea.label} حسب ${dim.label}`,
    headers: [dim.label, 'مشاريع', mea.label, 'الحصة'],
    rows: rows.map((r) => [
      r.k,
      String(r.n),
      String(r.v),
      total ? `${Math.round((r.v / total) * 100)}%` : '0%',
    ]),
  }

  return (
    <>
      {/* The sentence above updates with the selection: the user reads their
         question stated back before seeing its answer, confirming they asked
         what they meant to. */}
      <Glass className="rbld">
        <span className="rbld-q">
          <span className="sub">اعرض</span>
          {/* `allowEmpty={false}`, not `all` — the metric is always selected, so an
             "all" option used to show the first metric's name above the list while
             it also appeared below as a choice — "Number of Projects" twice in one list. */}
          <Select
            value={meaKey}
            allowEmpty={false}
            options={MEASURES.map((m) => ({ value: m.key, label: m.label }))}
            onChange={(v) => setMea(v ?? 'count')}
          />
          <span className="sub">حسب</span>
          <Select
            value={dimKey}
            allowEmpty={false}
            options={DIMS.map((d) => ({ value: d.key, label: d.label }))}
            onChange={(v) => setDim(v ?? 'region')}
          />
          <span className="sub">في</span>
          <Select
            value={period}
            allowEmpty={false}
            options={PERIODS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(v) => setPeriod(v ?? PERIODS[0].id)}
          />
          <span className="pc-sp" />
          <ExportMenu sheet={sheet} note={note} />
        </span>
      </Glass>

      <Glass>
        <Head
          title={`${mea.label} حسب ${dim.label}`}
          meta={
            <>
              <span className="num">{nf.format(rows.length)}</span> قيمة ·{' '}
              {mea.agg === 'sum' ? 'الإجمالي' : 'المتوسط العام'}{' '}
              {mea.money ? <Money>{mea.agg === 'sum' ? total : Math.round(total / (rows.length || 1))}</Money>
                : <Num>{mea.agg === 'sum' ? total : Math.round(total / (rows.length || 1))}</Num>}
            </>
          }
        />

        {/* Horizontal bars, not vertical: dimension names are long Arabic phrases
           ("Sponsoring high-impact education projects"), and nobody reads a
           rotated label under a column. */}
        <div className="rbar">
          {rows.map((r) => (
            <div className="rbar-r" key={r.k}>
              <span className="rbar-k" title={r.k}>{r.k}</span>
              <span className="rbar-t">
                <i style={{ width: `${Math.max(2, Math.round((r.v / max) * 100))}%` }} />
              </span>
              <span className="rbar-v">
                {mea.money ? <Money>{r.v}</Money> : nf.format(r.v)}
                {mea.unit && <small className="sub"> {unitAfter(r.v, mea.unit)}</small>}
              </span>
              <span className="rbar-s mut">{total ? <span className="num">{pct(Math.round((r.v / total) * 100))}</span> : 'لا يوجد'}</span>
              <span className="rbar-n mut">
                <span className="num">{r.n}</span> {nounAfter(r.n, NOUN.project)}
              </span>
            </div>
          ))}
        </div>
      </Glass>
    </>
  )
}
