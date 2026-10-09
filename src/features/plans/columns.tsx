import { Link } from 'react-router-dom'
import { DateText, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { NOUN, nounAfter, pct, ver } from '@/lib/format'
import {
  PLAN_TONE, planClaimed, planDone, planPlanned, planSpi, planStageLabel,
  lateActivities, waitingReview,
} from '@/data/mock/plans'
import { stuckActivities } from '@/data/plans/store'
import type { PlanRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Plans inbox columns - same contract as projects, agreements, and disbursement.

   Note: three columns here aren't information, they're the supervisor's daily question:

   - "Completed" states what's been reviewed and accepted, not what the entity claimed.
   - "Awaiting review" states their own work queue - the column that makes the inbox a tool, not
   just a display.
   - "Schedule" compares completed against planned-as-of-today (SPI).

   Without separating the first from the second, the completion percentage becomes the entity's own
   self-declaration, and the institution closes a project on word alone. */

export type Col = TCol<PlanRow>

export const COLS: Col[] = [
  {
    key: 'id',
    w: 112,
    label: 'رقم الخطة',
    fixed: true,
    cell: (p) => <Link to={ROUTES.plan(p.id)} className="tlink"><Mono>{p.id}</Mono></Link>,
    text: (p) => p.id,
  },
  {
    key: 'project',
    w: 214,
    label: 'المشروع',
    fixed: true,
    cell: (p) => <Link to={ROUTES.project(p.projectId)} className="tlink">{p.projectName}</Link>,
    text: (p) => p.projectName,
  },
  {
    key: 'entity',
    w: 168,
    label: 'الجهة',
    def: true,
    cell: (p) => <Link to={ROUTES.entity(p.entityId)} className="tlink">{p.entityName}</Link>,
    text: (p) => p.entityName,
  },
  {
    key: 'stage',
    w: 148,
    label: 'حالة الخطة',
    def: true,
    cell: (p) => <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>,
    text: (p) => planStageLabel(p.stage),
  },
  {
    key: 'done',
    w: 132,
    label: 'المنجَز المقبول',
    def: true,
    n: true,
    /* Note: the two numbers sit side by side on purpose. Accepted is what counts, declared is what
       the entity said - and the gap between them is exactly the work awaiting review. Showing only
       one hides the question. */
    cell: (p) => {
      const d = planDone(p)
      const c = planClaimed(p)
      return (
        <span>
          {pct(d)}
          {c > d && <span className="sub"> · مُعلَن {pct(c)}</span>}
        </span>
      )
    },
    text: (p) => `${planDone(p)}%`,
    value: (p) => planDone(p),
    agg: 'avg',
    aggPct: true,
    aggSay: 'في المتوسط',
  },
  {
    key: 'planned',
    w: 118,
    label: 'المخطَّط لليوم',
    n: true,
    cell: (p) => <span>{pct(planPlanned(p))}</span>,
    text: (p) => `${planPlanned(p)}%`,
    value: (p) => planPlanned(p),
    agg: 'avg',
    aggPct: true,
    aggSay: 'في المتوسط',
  },
  {
    key: 'spi',
    w: 112,
    label: 'أداء الجدول',
    def: true,
    n: true,
    /* SPI = completed / planned - exactly 1 means on schedule. */
    cell: (p) => {
      const v = planSpi(p)
      if (v === null) return <span className="sub">لم يبدأ</span>
      return (
        <span className={v < 0.8 ? 'over' : undefined}>
          <span className="num">{v.toFixed(2)}</span>
        </span>
      )
    },
    text: (p) => { const v = planSpi(p); return v === null ? 'لم يبدأ' : v.toFixed(2) },
    /* Note: `null`, not `0` - "not started" isn't zero performance, it's the absence of a
       measurement. */
    value: (p) => planSpi(p),
    agg: 'avg',
    aggSay: 'متوسط المقيس',
  },
  {
    key: 'waiting',
    w: 132,
    label: 'بانتظار المراجعة',
    def: true,
    n: true,
    /* The supervisor's work queue - zero is dimmed so nonzero values stand out. */
    cell: (p) => {
      const n = waitingReview(p).length
      return n > 0
        ? <b><Num>{n}</Num> {nounAfter(n, NOUN.activity)}</b>
        : <span className="sub">0</span>
    },
    text: (p) => String(waitingReview(p).length),
    value: (p) => waitingReview(p).length,
    agg: 'sum',
    aggSay: 'نشاطًا بانتظار المراجعة',
  },
  {
    key: 'late',
    w: 118,
    label: 'متأخّر',
    n: true,
    cell: (p) => {
      const n = lateActivities(p).length
      return n > 0 ? <span className="over">{n}</span> : <span className="sub">0</span>
    },
    text: (p) => String(lateActivities(p).length),
    value: (p) => lateActivities(p).length,
    agg: 'sum',
    aggSay: 'نشاطًا متأخّرًا',
  },
  /* Batch 7 · plans#26 · stuck activities get their own column beside the late ones · the filter
     existed, the column didn't */
  {
    key: 'stuck',
    w: 118,
    label: 'متعثّر',
    n: true,
    cell: (p) => {
      const n = stuckActivities(p).length
      return n > 0 ? <span className="over">{n}</span> : <span className="sub">0</span>
    },
    text: (p) => String(stuckActivities(p).length),
    value: (p) => stuckActivities(p).length,
    agg: 'sum',
    aggSay: 'نشاطًا متعثّرًا',
  },
  {
    key: 'baseline',
    w: 122,
    label: 'النسخة المرجعية',
    /* Note: zero means "not approved", not "version zero" - and the word states this, since a zero
       in a version column reads as a data error. */
    cell: (p) => (p.baseline > 0
      ? <span><Num>{ver(p.baseline)}</Num></span>
      : <span className="sub">لم تُعتمد</span>),
    text: (p) => (p.baseline > 0 ? `V${p.baseline}` : 'لم تُعتمد'),
  },
  {
    key: 'phases',
    w: 100,
    label: 'المراحل',
    n: true,
    cell: (p) => <span className="num">{p.phases.length}</span>,
    text: (p) => String(p.phases.length),
    value: (p) => p.phases.length,
    agg: 'sum',
  },
  {
    key: 'owner',
    w: 160,
    label: 'مشرف المنح',
    cell: (p) => <Person name={p.owner} />,
    text: (p) => p.owner,
  },
  {
    key: 'drafter',
    w: 140,
    label: 'كاتب المسودة',
    /* Note: the spec states the entity is the one who writes it - the supervisor can draft on their
       behalf when the entity can't. The column documents who actually did it, because "the entity
       wrote it" and "it was written on their behalf" aren't the same thing in review. */
    cell: (p) => (p.drafter === 'entity'
      ? <span className="sub">الجهة</span>
      : <Tag tone="mute">المشرف بالنيابة</Tag>),
    text: (p) => (p.drafter === 'entity' ? 'الجهة' : 'المشرف بالنيابة'),
  },
  {
    key: 'openedAt',
    w: 118,
    label: 'تاريخ الفتح',
    cell: (p) => <DateText>{p.openedAt}</DateText>,
    text: (p) => p.openedAt,
  },
  {
    key: 'baselineAt',
    w: 124,
    label: 'تاريخ الاعتماد',
    cell: (p) => (p.baselineAt
      ? <DateText>{p.baselineAt}</DateText>
      : <span className="sub">لم تُعتمد</span>),
    text: (p) => p.baselineAt ?? 'لم تُعتمد',
  },
]

export const GROUPS: GroupBy<PlanRow>[] = [
  { key: 'stage', label: 'حالة الخطة', of: (p) => planStageLabel(p.stage) },
  { key: 'entity', label: 'الجهة', of: (p) => p.entityName },
  { key: 'owner', label: 'مشرف المنح', of: (p) => p.owner },
]

export const groupByKey = (k: string | undefined): GroupBy<PlanRow> | undefined =>
  GROUPS.find((g) => g.key === k)
