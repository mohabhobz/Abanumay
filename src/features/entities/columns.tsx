import { activationSay } from '@/data/shared/decisions'
import { Link } from 'react-router-dom'
import { Mono, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { entityCode, nf } from '@/lib/format'
import { activationTone } from '@/lib/tone'
import { ENTITY_DOCS_TOTAL } from '@/data/repository'
import type { EntityRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Entities table columns.

   Same contract as projects: one definition feeds the table, totals, export, and grouping. The live
   system's partner report has 16 columns, and all of them are here - nine shown by default and the
   rest available from the column picker. */

export type Col = TCol<EntityRow>

export const COLS: Col[] = [
  {
    /* The partner code (PAR-<registration year>-<serial>) - the entity's identity in lists, the
       entity page header, and search. */
    key: 'code',
    w: 150,
    label: 'كود الجهة',
    fixed: true,
    cell: (e) => <Mono>{entityCode(e.id, e.registeredAt)}</Mono>,
    text: (e) => entityCode(e.id, e.registeredAt),
  },
  {
    key: 'license',
    w: 130,
    label: 'الترخيص',
    fixed: true,
    cell: (e) => <Mono>{e.licenseNo}</Mono>,
    text: (e) => e.licenseNo,
  },
  {
    key: 'name',
    w: 212,
    label: 'الجهة',
    fixed: true,
    cell: (e) => <Link to={ROUTES.entity(e.id)} className="tlink">{e.name}</Link>,
    text: (e) => e.name,
  },
  { key: 'type', w: 124, label: 'تصنيف الجهة', def: true, cell: (e) => <span className="sub">{e.type}</span>, text: (e) => e.type },
  { key: 'licensor', w: 160, label: 'الجهة المرخِّصة', cell: (e) => <span className="sub">{e.licensor}</span>, text: (e) => e.licensor },
  { key: 'region', w: 98, label: 'المنطقة', def: true, cell: (e) => <span className="sub">{e.region}</span>, text: (e) => e.region },
  { key: 'city', w: 98, label: 'المدينة', cell: (e) => <span className="sub">{e.city}</span>, text: (e) => e.city },
  {
    key: 'activation',
    w: 116,
    label: 'التفعيل',
    def: true,
    cell: (e) => <Tag tone={activationTone(e.activation)}>{activationSay(e.activation)}</Tag>,
    text: (e) => activationSay(e.activation),
  },
  {
    key: 'governance',
    w: 106,
    label: 'الحوكمة',
    def: true,
    /* Governance is a rating, not a status - text - and the only colored tag in the row is
       activation status. */
    cell: (e) => <span>{e.governance}</span>,
    text: (e) => e.governance,
  },
  {
    key: 'docs',
    w: 104,
    label: 'المستندات',
    def: true,
    n: true,
    /* The "missing" figure is colored: an incomplete entity file is what blocks an agreement, so it
       needs to be visible by scanning the table, not by opening the row. */
    cell: (e) => (
      <span className={e.docsUploaded < ENTITY_DOCS_TOTAL ? 'over' : undefined}>
        {e.docsUploaded}/{ENTITY_DOCS_TOTAL}
      </span>
    ),
    text: (e) => `${e.docsUploaded}/${ENTITY_DOCS_TOTAL}`,
    /* The cell holds both a percentage and a total, centered - "average" alone would lose the
       denominator, so the word states it. */
    value: (e) => e.docsUploaded,
    agg: 'avg',
    aggSay: `متوسط المرفوع من ${ENTITY_DOCS_TOTAL}`,
  },
  { key: 'approved', w: 92, label: 'معتمدة', n: true, cell: (e) => e.projectsApproved, text: (e) => String(e.projectsApproved), value: (e) => e.projectsApproved, agg: 'sum' },
  { key: 'running', w: 110, label: 'تحت التشغيل', def: true, n: true, cell: (e) => e.projectsRunning, text: (e) => String(e.projectsRunning), value: (e) => e.projectsRunning, agg: 'sum' },
  { key: 'completed', w: 92, label: 'مكتملة', n: true, cell: (e) => e.projectsCompleted, text: (e) => String(e.projectsCompleted), value: (e) => e.projectsCompleted, agg: 'sum' },
  {
    key: 'stalled',
    w: 92,
    label: 'متعثّرة',
    n: true,
    cell: (e) => (e.projectsStalled > 0 ? <span className="over">{e.projectsStalled}</span> : <span className="sub">0</span>),
    text: (e) => String(e.projectsStalled),
    value: (e) => e.projectsStalled,
    agg: 'sum',
  },
  { key: 'declined', w: 104, label: 'معتذر عنها', n: true, cell: (e) => e.projectsDeclined, text: (e) => String(e.projectsDeclined), value: (e) => e.projectsDeclined, agg: 'sum' },
  {
    key: 'granted',
    w: 126,
    label: 'إجمالي الممنوح',
    def: true,
    n: true,
    cell: (e) => nf.format(e.grantedTotal),
    text: (e) => String(e.grantedTotal),
    value: (e) => e.grantedTotal,
    agg: 'sum',
    money: true,
  },
  {
    key: 'year',
    w: 126,
    label: 'ممنوح هذه السنة',
    n: true,
    cell: (e) => nf.format(e.grantedThisYear),
    text: (e) => String(e.grantedThisYear),
    value: (e) => e.grantedThisYear,
    agg: 'sum',
    money: true,
  },
  {
    key: 'disb',
    w: 110,
    label: 'تحت الصرف',
    n: true,
    cell: (e) => nf.format(e.inDisbursement),
    text: (e) => String(e.inDisbursement),
    value: (e) => e.inDisbursement,
    agg: 'sum',
    money: true,
  },
  { key: 'registered', w: 112, label: 'تاريخ التسجيل', cell: (e) => <span className="sub num">{e.registeredAt}</span>, text: (e) => e.registeredAt },
  { key: 'mobile', w: 120, label: 'الجوال', cell: (e) => <span className="sub num">{e.mobile}</span>, text: (e) => e.mobile },
  { key: 'email', w: 170, label: 'البريد الإلكتروني', cell: (e) => <span className="sub">{e.email}</span>, text: (e) => e.email },
]

export const GROUPS: GroupBy<EntityRow>[] = [
  { key: 'region', label: 'المنطقة', of: (e) => e.region },
  { key: 'city', label: 'المدينة', of: (e) => e.city },
  { key: 'type', label: 'تصنيف الجهة', of: (e) => e.type },
  { key: 'licensor', label: 'الجهة المرخِّصة', of: (e) => e.licensor },
  { key: 'activation', label: 'التفعيل', of: (e) => activationSay(e.activation) },
  { key: 'governance', label: 'الحوكمة', of: (e) => e.governance },
]

export const groupByKey = (key: string | undefined): GroupBy<EntityRow> | undefined =>
  GROUPS.find((g) => g.key === key)
