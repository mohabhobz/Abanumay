import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag, Nil } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import {
  CLOSE_TONE, closeCycle, closeLate, closeStageLabel, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Closing table columns - same contract as projects, agreements, and plans.

   Note: the "cycle" column isn't a category, it's what prevents confusion. Rule 17 states that the
   report and the evaluation are independent approval cycles, meaning "with the grants manager"
   happens twice in one request's life and means two different things. If the table showed only the
   stage, a manager would read a name that doesn't say whether they're reviewing the entity's report
   or their own supervisor's evaluation.

   Note: the "missing" column is a check, not information - like "payment schedule" in agreements:
   rule 4 sets four required fields and rule 10 blocks submission without them, so the blocker shows
   in the inbox instead of requiring a supervisor to open every request to find out. */

export type Col = TCol<CloseRow>

const CYCLE_SAY = { report: 'التقرير الختامي', eval: 'تقييم المشروع' } as const

export const COLS: Col[] = [
  {
    key: 'id',
    w: 112,
    label: 'رقم الطلب',
    fixed: true,
    cell: (c) => <Link to={ROUTES.closing(c.id)} className="tlink"><Mono>{c.id}</Mono></Link>,
    text: (c) => c.id,
  },
  {
    key: 'project',
    w: 200,
    label: 'المشروع',
    fixed: true,
    cell: (c) => <Link to={ROUTES.project(c.projectId)} className="tlink">{c.projectName}</Link>,
    text: (c) => c.projectName,
  },
  {
    key: 'entity',
    w: 168,
    label: 'الجهة',
    def: true,
    cell: (c) => <Link to={ROUTES.entity(c.entityId)} className="tlink">{c.entityName}</Link>,
    text: (c) => c.entityName,
  },
  {
    key: 'cycle',
    w: 124,
    label: 'الدورة',
    def: true,
    cell: (c) => <span className="sub">{CYCLE_SAY[closeCycle(c)]}</span>,
    text: (c) => CYCLE_SAY[closeCycle(c)],
  },
  {
    key: 'stage',
    w: 182,
    label: 'المحطة',
    def: true,
    cell: (c) => <Tag tone={CLOSE_TONE[c.stage]}>{closeStageLabel(c.stage)}</Tag>,
    text: (c) => closeStageLabel(c.stage),
  },
  {
    key: 'missing',
    w: 132,
    label: 'الناقص',
    def: true,
    /* Rules 4 and 10 - the minimum required data and attachments. */
    cell: (c) => {
      const n = reportBlockers(c).length
      return n === 0
        ? <span className="sub">مكتمل</span>
        : <b><span className="num">{n}</span> {nounAfter(n, NOUN.line)}</b>
    },
    text: (c) => {
      const n = reportBlockers(c).length
      return n === 0 ? 'مكتمل' : `${countOf(n, NOUN.line)}`
    },
    value: (c) => reportBlockers(c).length,
    agg: 'sum',
    aggSay: 'بندًا ناقصًا',
  },
  {
    key: 'beneficiaries',
    w: 120,
    label: 'المستفيدون الفعليون',
    n: true,
    def: true,
    cell: (c) => (c.report.beneficiaries === null
      ? <Nil />
      : <span className="num">{nf.format(c.report.beneficiaries)}</span>),
    text: (c) => (c.report.beneficiaries === null ? '' : nf.format(c.report.beneficiaries)),
    value: (c) => c.report.beneficiaries ?? 0,
    agg: 'sum',
  },
  {
    key: 'budget',
    w: 126,
    label: 'الميزانية الفعلية',
    n: true,
    def: true,
    money: true,
    cell: (c) => (c.report.budget === null
      ? <Nil />
      : <span className="num">{nf.format(c.report.budget)}</span>),
    text: (c) => (c.report.budget === null ? '' : nf.format(c.report.budget)),
    value: (c) => c.report.budget ?? 0,
    agg: 'sum',
  },
  {
    key: 'age',
    w: 100,
    label: 'المدة',
    def: true,
    cell: (c) => {
      const days = Math.round(c.hoursInStage / 24)
      return closeLate(c)
        ? <b>متأخر</b>
        : <span className="sub"><span className="num">{days}</span> {nounAfter(days, NOUN.day)}</span>
    },
    text: (c) => (closeLate(c) ? 'متأخر' : `${countOf(Math.round(c.hoursInStage / 24), NOUN.day)}`),
    /* Same lesson as the duration column in agreements: one row shows a number, another shows a word -
   the middle needs to say its unit. */
    value: (c) => Math.round(c.hoursInStage / 24),
    agg: 'avg',
    aggSay: 'يومًا في المتوسط',
  },
  {
    key: 'version',
    w: 84,
    label: 'الإصدار',
    n: true,
    /* Rules 15 and 19 - a second version is evidence a return happened. */
    cell: (c) => <span className="num">{c.versions.length}</span>,
    text: (c) => String(c.versions.length),
  },
  {
    key: 'media',
    w: 128,
    label: 'النشر الإعلامي',
    /* Rule 9 - the institutional-communications stage, "when it was required". */
    cell: (c) => <span className="sub">{c.mediaRequired ? 'مطلوب' : 'لا ينطبق'}</span>,
    text: (c) => (c.mediaRequired ? 'مطلوب' : 'لا ينطبق'),
  },
  {
    key: 'owner',
    w: 132,
    label: 'المشرف',
    def: true,
    cell: (c) => <Person name={c.owner} />,
    text: (c) => c.owner,
  },
  {
    key: 'openedAt',
    w: 112,
    label: 'تاريخ فتح الطلب',
    cell: (c) => <DateText>{c.openedAt}</DateText>,
    text: (c) => c.openedAt,
  },
  {
    key: 'closedAt',
    w: 112,
    label: 'تاريخ الإغلاق',
    cell: (c) => (c.closedAt ? <DateText>{c.closedAt}</DateText> : <Nil />),
    text: (c) => c.closedAt ?? '',
  },
]

export const GROUPS: GroupBy<CloseRow>[] = [
  { key: 'stage', label: 'المحطة', of: (c) => closeStageLabel(c.stage) },
  { key: 'cycle', label: 'الدورة', of: (c) => CYCLE_SAY[closeCycle(c)] },
  { key: 'owner', label: 'المشرف', of: (c) => c.owner },
  { key: 'entity', label: 'الجهة', of: (c) => c.entityName },
]

export const groupByKey = (k?: string): GroupBy<CloseRow> | undefined =>
  GROUPS.find((g) => g.key === k)
