import { Link } from 'react-router-dom'
import { Mono, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf, projectCode } from '@/lib/format'
import { days, groupTone } from '@/lib/tone'
import { stagePressure } from '@/data/repository'
import type { ProjectRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Project table column definitions — a single source for four consumers.

   The table, totals, export, and grouping all read from here. If each defined
   its own columns, a newly added column would show up in one and be missing
   from the other three, and the export would end up different from what's on
   screen — worse than not exporting at all.

   Every column also has `text` alongside `cell`: the cell holds links and
   badges, while the exported file needs plain text. The two live side by side
   so they can't drift apart. */

export type Col = TCol<ProjectRow>

/** Portfolio rows open their portfolio page; every other row opens the project page. */
export const isPortfolio = (r: ProjectRow): boolean => r.type === 'محفظة'

export const rowHref = (r: ProjectRow): string =>
  isPortfolio(r) ? ROUTES.portfolio(r.portfolioId ?? r.id) : ROUTES.project(r.id)

/** Display code · a portfolio keeps its own code, a project gets `PRJ-YYYY-NNNNN`. */
export const rowCode = (r: ProjectRow): string =>
  isPortfolio(r) ? (r.portfolioId ?? r.id).toUpperCase() : projectCode(r.id, r.year)

/* Default columns add up to 1246px, so all default columns fit within the card
   view's 1440px screen (1252px). It used to be 1338px, making the table wider
   than its card by 86px, with "Status" — the last and most important column —
   hidden behind the sticky columns button. What got trimmed: the numbers,
   weight, duration, and owner columns. */
export const COLS: Col[] = [
  {
    key: 'code',
    w: 132,
    label: 'الكود',
    fixed: true,
    cell: (r) => <Mono>{rowCode(r)}</Mono>,
    text: (r) => rowCode(r),
  },
  {
    key: 'name',
    w: 154,
    label: 'المشروع',
    fixed: true,
    cell: (r) => <Link to={rowHref(r)} className="tlink">{r.name}</Link>,
    text: (r) => r.name,
  },
  {
    key: 'entity',
    w: 118,
    label: 'الجهة',
    def: true,
    /* An implementing partner has no entity file, so its name stays plain text. */
    cell: (r) =>
      isPortfolio(r)
        ? <span className="sub">{r.entityName}</span>
        : <Link to={ROUTES.entity(r.entityId)} className="tlink sub">{r.entityName}</Link>,
    text: (r) => r.entityName,
  },
  {
    key: 'type',
    w: 108,
    label: 'نوع المشروع',
    cell: (r) => <span className="sub">{r.type ?? 'مشروع عادي'}</span>,
    text: (r) => r.type ?? 'مشروع عادي',
  },
  { key: 'region', w: 84, label: 'المنطقة', def: true, cell: (r) => <span className="sub">{r.region}</span>, text: (r) => r.region },
  { key: 'city', w: 88, label: 'المدينة', cell: (r) => <span className="sub">{r.city}</span>, text: (r) => r.city },
  { key: 'track', w: 100, label: 'المسار', cell: (r) => r.track, text: (r) => r.track },
  { key: 'field', w: 108, label: 'المجال', cell: (r) => r.field, text: (r) => r.field },
  { key: 'goal', w: 140, label: 'الهدف', cell: (r) => <span className="sub">{r.goal}</span>, text: (r) => r.goal },
  { key: 'stage', w: 100, label: 'القسم الإجرائي', def: true, cell: (r) => r.stage, text: (r) => r.stage },
  {
    key: 'dur',
    w: 72,
    label: 'المدة',
    def: true,
    n: true,
    /* The dot next to the number makes all the difference: without it, the user
       would have to mentally compute time-in-stage against the threshold for every row. */
    cell: (r) => (
      <>
        {r.stageLimit > 0 ? days(r.hoursInStage) : 'بلا حدّ'}
        {stagePressure(r) > 1 && <span className="dotmark" title="تجاوز الحدّ" />}
      </>
    ),
    text: (r) => (r.stageLimit > 0 ? String(Math.round(r.hoursInStage / 24)) : 'بلا حدّ'),
    /* "No limit" in the cell means a duration exists with no cap — it's still
       computed, and the unit still states what it's measuring. */
    value: (r) => Math.round(r.hoursInStage / 24),
    agg: 'avg',
    aggSay: 'يومًا في المتوسط',
  },
  {
    key: 'requested',
    w: 104,
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
    w: 100,
    label: 'المعتمد',
    def: true,
    n: true,
    cell: (r) => (r.amountGranted > 0 ? nf.format(r.amountGranted) : <span className="sub"> </span>),
    text: (r) => (r.amountGranted > 0 ? String(r.amountGranted) : ''),
    value: (r) => r.amountGranted,
    agg: 'sum',
    money: true,
  },
  {
    key: 'spent',
    w: 100,
    label: 'المصروف',
    n: true,
    cell: (r) => (r.amountSpent > 0 ? nf.format(r.amountSpent) : <span className="sub"> </span>),
    text: (r) => (r.amountSpent > 0 ? String(r.amountSpent) : ''),
    value: (r) => r.amountSpent,
    agg: 'sum',
    money: true,
  },
  { key: 'weight', w: 60, label: 'الوزن', def: true, n: true, cell: (r) => r.weight, text: (r) => String(r.weight), value: (r) => r.weight, agg: 'avg' },
  { key: 'score', w: 60, label: 'التقييم', n: true, cell: (r) => r.score, text: (r) => String(r.score), value: (r) => r.score, agg: 'avg' },
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
  /* The column grew from 88 to 148 when the avatar was added inside the cell. 88px
     was sized for text alone and already truncated a name like "Ahmed
     Abdellatif"; with the avatar (28 + an 8px gap) it now truncates at the first
     word — "Azzam …" — the avatar preserves identity, but the name becomes useless. */
  { key: 'owner', w: 128, label: 'المالك', def: true, cell: (r) => <Person name={r.owner} />, text: (r) => r.owner ?? '' },
  {
    key: 'status',
    /* 112, not 96 — the difference surfaced once the check was unified. "In
       Progress" is a 75px label, and the column was 96px minus 24px of cell
       padding (2×12) = 72px, so the label was being truncated at a 1440px
       viewport width. */
    w: 112,
    label: 'الحالة',
    def: true,
    cell: (r) => <Tag tone={groupTone(r.statusGroup)}>{r.statusGroup}</Tag>,
    text: (r) => r.statusGroup,
  },
  { key: 'method', w: 110, label: 'أسلوب المنح', cell: (r) => <span className="sub">{r.grantMethod}</span>, text: (r) => r.grantMethod },
  { key: 'support', w: 108, label: 'حالة الدعم', cell: (r) => r.supportStatus ?? <span className="sub"> </span>, text: (r) => r.supportStatus ?? '' },
  { key: 'submitted', w: 108, label: 'تاريخ التقديم', cell: (r) => <span className="sub num">{r.submittedAt}</span>, text: (r) => r.submittedAt },
  { key: 'year', w: 112, label: 'السنة والمصدر', cell: (r) => <span className="sub num">{r.year}</span>, text: (r) => r.year },
]

/* Grouping */

export const GROUPS: GroupBy<ProjectRow>[] = [
  { key: 'type', label: 'نوع المشروع', of: (r) => r.type ?? 'مشروع عادي' },
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
