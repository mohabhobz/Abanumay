import { Link } from 'react-router-dom'
import { Mono, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf, projectCode } from '@/lib/format'
import { days, groupTone } from '@/lib/tone'
import { stagePressure } from '@/data/repository'
import type { ProjectRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   تعريف أعمدة جدول المشاريع — مصدر واحد لأربع حاجات.

   الجدول والإجماليات والتصدير والتجميع كلهم بيقرأوا من هنا. لو كل
   واحد فيهم عرّف أعمدته لوحده، أول عمود يتزوّد هيظهر في واحد ويغيب
   عن التلاتة، والتصدير هيطلع مختلفًا عن اللي على الشاشة — وده أسوأ
   من غياب التصدير أصلًا.

   ولكل عمود `text` جنب `cell`: الخلية فيها روابط وشارات، والملف
   المصدَّر محتاج نصًّا صافيًا. الاتنين جنب بعض عشان ما يفرقوش.
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<ProjectRow>

export const COLS: Col[] = [
  {
    key: 'code',
    w: 132,
    label: 'الكود',
    fixed: true,
    cell: (r) => <Mono>{projectCode(r.id, r.year)}</Mono>,
    text: (r) => projectCode(r.id, r.year),
  },
  {
    key: 'name',
    w: 198,
    label: 'المشروع',
    fixed: true,
    cell: (r) => <Link to={ROUTES.project(r.id)} className="tlink">{r.name}</Link>,
    text: (r) => r.name,
  },
  {
    key: 'entity',
    w: 142,
    label: 'الجهة',
    def: true,
    cell: (r) => <Link to={ROUTES.entity(r.entityId)} className="tlink sub">{r.entityName}</Link>,
    text: (r) => r.entityName,
  },
  { key: 'region', w: 88, label: 'المنطقة', def: true, cell: (r) => <span className="sub">{r.region}</span>, text: (r) => r.region },
  { key: 'city', w: 88, label: 'المدينة', cell: (r) => <span className="sub">{r.city}</span>, text: (r) => r.city },
  { key: 'track', w: 100, label: 'المسار', cell: (r) => r.track, text: (r) => r.track },
  { key: 'field', w: 108, label: 'المجال', cell: (r) => r.field, text: (r) => r.field },
  { key: 'goal', w: 140, label: 'الهدف', cell: (r) => <span className="sub">{r.goal}</span>, text: (r) => r.goal },
  { key: 'stage', w: 118, label: 'القسم الإجرائي', def: true, cell: (r) => r.stage, text: (r) => r.stage },
  {
    key: 'dur',
    w: 62,
    label: 'المدة',
    def: true,
    n: true,
    /* النقطة جنب الرقم هي كل الفرق: من غيرها المستخدم لازم يحسب
       المكوث مقابل الحدّ في دماغه لكل صف. */
    cell: (r) => (
      <>
        {r.stageLimit > 0 ? days(r.hoursInStage) : '—'}
        {stagePressure(r) > 1 && <span className="dotmark" title="فوق الحدّ" />}
      </>
    ),
    text: (r) => (r.stageLimit > 0 ? String(Math.round(r.hoursInStage / 24)) : '—'),
    value: (r) => Math.round(r.hoursInStage / 24),
    agg: 'avg',
  },
  {
    key: 'requested',
    w: 108,
    label: 'المبلغ المطلوب',
    def: true,
    n: true,
    cell: (r) => nf.format(r.amountRequested),
    text: (r) => String(r.amountRequested),
    value: (r) => r.amountRequested,
    agg: 'sum',
    money: true,
  },
  {
    key: 'granted',
    w: 96,
    label: 'المعتمد',
    def: true,
    n: true,
    cell: (r) => (r.amountGranted > 0 ? nf.format(r.amountGranted) : <span className="sub">—</span>),
    text: (r) => (r.amountGranted > 0 ? String(r.amountGranted) : ''),
    value: (r) => r.amountGranted,
    agg: 'sum',
    money: true,
  },
  {
    key: 'spent',
    w: 96,
    label: 'المصروف',
    n: true,
    cell: (r) => (r.amountSpent > 0 ? nf.format(r.amountSpent) : <span className="sub">—</span>),
    text: (r) => (r.amountSpent > 0 ? String(r.amountSpent) : ''),
    value: (r) => r.amountSpent,
    agg: 'sum',
    money: true,
  },
  { key: 'weight', w: 56, label: 'الوزن', def: true, n: true, cell: (r) => r.weight, text: (r) => String(r.weight), value: (r) => r.weight, agg: 'avg' },
  { key: 'score', w: 66, label: 'التقييم', n: true, cell: (r) => r.score, text: (r) => String(r.score), value: (r) => r.score, agg: 'avg' },
  {
    key: 'benef',
    w: 96,
    label: 'المستفيدون',
    n: true,
    cell: (r) => nf.format(r.beneficiaries),
    text: (r) => String(r.beneficiaries),
    value: (r) => r.beneficiaries,
    agg: 'sum',
  },
  { key: 'owner', w: 88, label: 'المالك', def: true, cell: (r) => <span className="sub">{r.owner ?? '—'}</span>, text: (r) => r.owner ?? '' },
  {
    key: 'status',
    w: 96,
    label: 'الحالة',
    def: true,
    cell: (r) => <Tag tone={groupTone(r.statusGroup)}>{r.statusGroup}</Tag>,
    text: (r) => r.statusGroup,
  },
  { key: 'method', w: 110, label: 'أسلوب المنح', cell: (r) => <span className="sub">{r.grantMethod}</span>, text: (r) => r.grantMethod },
  { key: 'support', w: 108, label: 'حالة الدعم', cell: (r) => r.supportStatus ?? <span className="sub">—</span>, text: (r) => r.supportStatus ?? '' },
  { key: 'submitted', w: 108, label: 'تاريخ التقديم', cell: (r) => <span className="sub num">{r.submittedAt}</span>, text: (r) => r.submittedAt },
  { key: 'year', w: 112, label: 'السنة والمصدر', cell: (r) => <span className="sub num">{r.year}</span>, text: (r) => r.year },
]

/* ═══════════════════ التجميع ═══════════════════ */

export const GROUPS: GroupBy<ProjectRow>[] = [
  { key: 'region', label: 'المنطقة', of: (r) => r.region },
  { key: 'city', label: 'المدينة', of: (r) => r.city },
  { key: 'track', label: 'المسار', of: (r) => r.track },
  { key: 'field', label: 'المجال', of: (r) => r.field },
  { key: 'stage', label: 'القسم الإجرائي', of: (r) => r.stage },
  { key: 'status', label: 'الحالة', of: (r) => r.statusGroup },
  { key: 'owner', label: 'المالك', of: (r) => r.owner ?? 'بلا مالك' },
  { key: 'entity', label: 'الجهة', of: (r) => r.entityName },
  { key: 'year', label: 'السنة والمصدر', of: (r) => r.year },
]

export const groupByKey = (key: string | undefined): GroupBy<ProjectRow> | undefined =>
  GROUPS.find((g) => g.key === key)
