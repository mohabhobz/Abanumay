import { useMemo, useState } from 'react'
import { Glass, Head, Money, Num, Select } from '@/components/ui'
import { nf, pct } from '@/lib/format'
import { projectRows } from '@/data/mock/projects'
import { PERIODS } from '@/data/reportDefs'
import { type Sheet } from '@/lib/export'
import { ExportMenu } from '@/components/export'
import type { ProjectRow } from '@/types/domain'
import { days } from '@/lib/tone'

/**
 * التقرير المُشكَّل.
 *
 * اللوحة بتجاوب على الأسئلة المعروفة. ده للسؤال اللي مش فيها:
 * **بُعد × مقياس**، والجدول والأعمدة بيتغيّروا مع الاختيار.
 *
 * ليه أداة واحدة بدل شاشة لكل سؤال؟ لأن النظام العامل جرّب العكس ·
 * أربعتاشر شاشة، كل واحدة بفلاترها · والنتيجة إن السؤال اللي مش
 * متوقَّع في التصميم ما لهوش مكان أصلًا، فبيروح Excel. الأداة دي
 * بتغطّي التوليفات كلها (٧ أبعاد × ٦ مقاييس = ٤٢ تقريرًا) بشاشة
 * واحدة يتعلّمها المستخدم مرة.
 */

type Dim = { key: string; label: string; of: (p: ProjectRow) => string }
type Measure = {
  key: string
  label: string
  /** القيمة من صف واحد */
  of: (p: ProjectRow) => number
  /** جمع ولا متوسط */
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

  /* نطاق التصدير مكتوب فوق القايمة: التقرير المُشكَّل بيصدّر اللي
     على الشاشة بالظبط · نفس البُعد والمقياس والفترة. */
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
      {/* الجملة فوق بتتغيّر مع الاختيار: المستخدم بيقرا سؤاله مكتوبًا
          قبل ما يشوف إجابته، فيتأكد إنه سأل اللي قصده. */}
      <Glass className="rbld">
        <span className="rbld-q">
          <span className="sub">أعرض</span>
          <Select
            value={meaKey}
            all={MEASURES[0].label}
            options={MEASURES.map((m) => ({ value: m.key, label: m.label }))}
            onChange={(v) => setMea(v ?? 'count')}
          />
          <span className="sub">حسب</span>
          <Select
            value={dimKey}
            all={DIMS[0].label}
            options={DIMS.map((d) => ({ value: d.key, label: d.label }))}
            onChange={(v) => setDim(v ?? 'region')}
          />
          <span className="sub">في</span>
          <Select
            value={period}
            all={PERIODS[0].label}
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

        {/* الأعمدة الأفقية لا الرأسية: أسماء الأبعاد عربية وطويلة
            («رعاية مشاريع التعليم ذات التأثير») ومحدش بيقرا اسمًا
            مقلوبًا تحت عمود. */}
        <div className="rbar">
          {rows.map((r) => (
            <div className="rbar-r" key={r.k}>
              <span className="rbar-k" title={r.k}>{r.k}</span>
              <span className="rbar-t">
                <i style={{ width: `${Math.max(2, Math.round((r.v / max) * 100))}%` }} />
              </span>
              <span className="rbar-v num">
                {mea.money ? <Money>{r.v}</Money> : nf.format(r.v)}
                {mea.unit && <small className="sub"> {mea.unit}</small>}
              </span>
              <span className="rbar-s mut num">{total ? pct(Math.round((r.v / total) * 100)) : 'لا يوجد'}</span>
              <span className="rbar-n mut">
                <span className="num">{r.n}</span> مشروعًا
              </span>
            </div>
          ))}
        </div>
      </Glass>
    </>
  )
}
