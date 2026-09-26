import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag, Nil } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import { PAY_LIMIT, payHeat, payStateLabel } from '@/data/mock/disbursements'
import type { PayRequest } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Disbursement table columns.

   Same contract as projects and entities: one definition feeds the table, totals, export, and
   grouping - so a column added here reaches Excel and the chart with no extra work.

   The card and table answer two different questions, which is why both exist: the card states why
   this item is on your desk, with all four conditions in view; the table states the shape of the
   whole queue - comparing amounts, dates and supervisors in one column, and exporting them. That's
   why the conditions column here is a number (3 of 4) rather than a list: the table says something
   is pending, the card says which one. */

import { HEAT_TONE } from '@/lib/tone'
export type Col = TCol<PayRequest>

const HEAT_SAY = { ok: 'في المدة', late: 'متأخر', stuck: 'متعثر' } as const

/**
 * Delay start date - the day the request crossed its stage's threshold. Computed backward: today
 * minus (dwell time minus the threshold) - empty if the request is still within its window.
 */
const lateSince = (r: PayRequest): string | null => {
  const lim = PAY_LIMIT[r.state]
  if (!lim || r.hoursInState <= lim) return null
  const d = new Date()
  d.setDate(d.getDate() - Math.round((r.hoursInState - lim) / 24))
  return d.toISOString().slice(0, 10)
}

const okCount = (r: PayRequest) => r.checks.filter((c) => c.ok).length + (r.bank.active ? 1 : 0)
const allCount = (r: PayRequest) => r.checks.length + 1

export const COLS: Col[] = [
  {
    key: 'id',
    w: 130,
    label: 'رقم الطلب',
    fixed: true,
    cell: (r) => <Link to={ROUTES.payment(r.id)} className="tlink"><Mono>{r.id}</Mono></Link>,
    text: (r) => r.id,
  },
  {
    key: 'project',
    w: 190,
    label: 'المشروع',
    fixed: true,
    cell: (r) => <Link to={ROUTES.project(r.projectId)} className="tlink">{r.projectName}</Link>,
    text: (r) => r.projectName,
  },
  {
    key: 'entity',
    w: 150,
    label: 'الجهة',
    def: true,
    cell: (r) => <Link to={ROUTES.entity(r.entityId)} className="tlink">{r.entityName}</Link>,
    text: (r) => r.entityName,
  },
  {
    key: 'pay',
    w: 76,
    label: 'الدفعة',
    def: true,
    cell: (r) => <span className="num">{r.no}/{r.of}</span>,
    text: (r) => `${r.no}/${r.of}`,
  },
  {
    key: 'asked',
    w: 112,
    label: 'المطلوب',
    n: true,
    def: true,
    money: true,
    cell: (r) => <span className="num">{nf.format(r.asked)}</span>,
    text: (r) => nf.format(r.asked),
    value: (r) => r.asked,
    agg: 'sum',
  },
  {
    key: 'due',
    w: 124,
    label: 'الدفعة المعتمدة',
    n: true,
    money: true,
    cell: (r) => <span className="num">{nf.format(r.due)}</span>,
    text: (r) => nf.format(r.due),
    value: (r) => r.due,
    agg: 'sum',
  },
  {
    key: 'dueAt',
    w: 106,
    label: 'الاستحقاق',
    def: true,
    cell: (r) => <DateText>{r.dueAt}</DateText>,
    text: (r) => r.dueAt,
  },
  {
    key: 'state',
    w: 150,
    label: 'المرحلة',
    def: true,
    cell: (r) => <span className="sub">{payStateLabel(r.state)}</span>,
    text: (r) => payStateLabel(r.state),
  },
  {
    key: 'heat',
    w: 92,
    label: 'المدة',
    def: true,
    cell: (r) => {
      const h = payHeat(r)
      return h === 'ok'
        ? <span className="sub"><span className="num">{Math.round(r.hoursInState / 24)}</span> {nounAfter(Math.round(r.hoursInState / 24), NOUN.day)}</span>
        : <Tag tone={HEAT_TONE[h]}>{HEAT_SAY[h]}</Tag>
    },
    text: (r) => (payHeat(r) === 'ok' ? `${countOf(Math.round(r.hoursInState / 24), NOUN.day)}` : HEAT_SAY[payHeat(r)]),
    /* Same treatment as agreements - the cell is a day count or a word, so the unit is stated in
       the middle. */
    value: (r) => Math.round(r.hoursInState / 24),
    agg: 'avg',
    aggSay: 'يومًا في المتوسط',
  },
  {
    /* The escalation mechanism (9.5, clause 3) calls for "a comprehensive report of late and
       stalled requests: current stage, delay start date, day count, responsible party". The other
       three columns already existed and the fourth was missing - so the report isn't a separate
       screen, it's this table filtered to late items. */
    key: 'lateSince',
    w: 118,
    label: 'بدء التأخير',
    cell: (r) => {
      const since = lateSince(r)
      return since ? <DateText>{since}</DateText> : <Nil />
    },
    text: (r) => lateSince(r) ?? '',
  },
  {
    key: 'checks',
    w: 88,
    label: 'الشروط',
    def: true,
    n: true,
    cell: (r) => {
      const ok = okCount(r)
      const all = allCount(r)
      return ok === all
        ? <span className="num">{ok}/{all}</span>
        : <b className="num bad">{ok}/{all}</b>
    },
    text: (r) => `${okCount(r)}/${allCount(r)}`,
  },
  {
    key: 'owner',
    w: 132,
    label: 'المشرف',
    def: true,
    /* `Person` is the same one used in the card and the supervisor filter - the person renders the
       same way in all three places, from a single component, not three. */
    cell: (r) => <Person name={r.owner} />,
    text: (r) => r.owner,
  },
  {
    key: 'bank',
    w: 170,
    label: 'الحساب المعتمد',
    cell: (r) => (
      <span className={r.bank.active ? 'sub' : 'bad'}>
        {r.bank.name}{r.bank.active ? '' : ' · غير نشط'}
      </span>
    ),
    text: (r) => `${r.bank.name}${r.bank.active ? '' : ' · غير نشط'}`,
  },
  {
    key: 'condition',
    w: 220,
    label: 'شرط الدفعة',
    cell: (r) => <span className="sub">{r.condition ?? 'بلا شرط'}</span>,
    text: (r) => r.condition ?? 'بلا شرط',
  },
  {
    key: 'paidAt',
    w: 118,
    label: 'تاريخ التحويل',
    cell: (r) => (r.paidAt ? <DateText>{r.paidAt}</DateText> : <Nil />),
    text: (r) => r.paidAt ?? '',
  },
]

export const GROUPS: GroupBy<PayRequest>[] = [
  { key: 'state', label: 'المرحلة', of: (r) => payStateLabel(r.state) },
  { key: 'owner', label: 'المشرف', of: (r) => r.owner },
  { key: 'entity', label: 'الجهة', of: (r) => r.entityName },
]

export const groupByKey = (k?: string): GroupBy<PayRequest> | undefined =>
  GROUPS.find((g) => g.key === k)
