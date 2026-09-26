import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag, Nil } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { countOf, nf, NOUN, nounAfter } from '@/lib/format'
import {
  agrHeat, agrPaymentsBalance, agrReserveGap, agrStageLabel,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Agreements table columns - same contract as projects, entities, and disbursements.

   Two columns here aren't information, they're checks: "payment schedule" reports whether it
   balances (rule 8), and "allocated" reports whether it differs from the reserved amount (step 11).
   These two are what block submission for approval, so the table surfaces them in a column instead
   of requiring the supervisor to open every agreement to find out. */

import { HEAT_TONE } from '@/lib/tone'
export type Col = TCol<AgreementRow>

const HEAT_SAY = { ok: 'في المدة', late: 'متأخرة', stuck: 'متعثرة' } as const

export const COLS: Col[] = [
  {
    key: 'id',
    w: 126,
    label: 'رقم الاتفاقية',
    fixed: true,
    cell: (a) => <Link to={ROUTES.agreement(a.id)} className="tlink"><Mono>{a.id}</Mono></Link>,
    text: (a) => a.id,
  },
  {
    key: 'project',
    w: 200,
    label: 'المشروع',
    fixed: true,
    cell: (a) => <Link to={ROUTES.project(a.projectId)} className="tlink">{a.projectName}</Link>,
    text: (a) => a.projectName,
  },
  {
    key: 'entity',
    w: 156,
    label: 'الجهة',
    def: true,
    cell: (a) => <Link to={ROUTES.entity(a.entityId)} className="tlink">{a.entityName}</Link>,
    text: (a) => a.entityName,
  },
  {
    key: 'kind',
    w: 90,
    label: 'النوع',
    def: true,
    cell: (a) => <span className="sub">{a.kind}</span>,
    text: (a) => a.kind,
  },
  {
    key: 'amount',
    w: 118,
    label: 'قيمة المنحة',
    n: true,
    def: true,
    money: true,
    cell: (a) => <span className="num">{nf.format(a.amount)}</span>,
    text: (a) => nf.format(a.amount),
    value: (a) => a.amount,
    agg: 'sum',
  },
  {
    key: 'pays',
    w: 108,
    label: 'جدول الدفعات',
    def: true,
    /* Rule 8 - the total equals the grant value, and percentages equal 100%. */
    cell: (a) => {
      const b = agrPaymentsBalance(a)
      return b.balanced
        ? <span className="sub"><span className="num">{a.payments.length}</span> {nounAfter(a.payments.length, NOUN.payment)}</span>
        : <b>غير متوازن</b>
    },
    text: (a) => (agrPaymentsBalance(a).balanced ? `${countOf(a.payments.length, NOUN.payment)}` : 'غير متوازن'),
  },
  {
    key: 'reserve',
    w: 112,
    label: 'المخصص',
    def: true,
    /* Step 11 - a mismatch between agreement value and the reserved amount blocks submission. */
    cell: (a) => {
      const gap = agrReserveGap(a)
      return gap === 0
        ? <span className="sub">مطابق</span>
        : <b>فرق <span className="num">{nf.format(Math.abs(gap))}</span></b>
    },
    text: (a) => (agrReserveGap(a) === 0 ? 'مطابق' : `فرق ${nf.format(Math.abs(agrReserveGap(a)))}`),
  },
  {
    key: 'stage',
    w: 160,
    label: 'المرحلة',
    def: true,
    cell: (a) => <span className="sub">{agrStageLabel(a.stage)}</span>,
    text: (a) => agrStageLabel(a.stage),
  },
  {
    key: 'heat',
    w: 94,
    label: 'المدة',
    def: true,
    cell: (a) => {
      const h = agrHeat(a)
      return h === 'ok'
        ? <span className="sub"><span className="num">{Math.round(a.hoursInStage / 24)}</span> {nounAfter(Math.round(a.hoursInStage / 24), NOUN.day)}</span>
        : <Tag tone={HEAT_TONE[h]}>{HEAT_SAY[h]}</Tag>
    },
    text: (a) => (agrHeat(a) === 'ok' ? `${countOf(Math.round(a.hoursInStage / 24), NOUN.day)}` : HEAT_SAY[agrHeat(a)]),
    /* One row shows days, another shows a word ("overdue") - the middle needs to say its unit, or it
   becomes a number floating under a column full of text. */
    value: (a) => Math.round(a.hoursInStage / 24),
    agg: 'avg',
    aggSay: 'يومًا في المتوسط',
  },
  {
    key: 'version',
    w: 82,
    label: 'الإصدار',
    n: true,
    /* Rule 24 - multiple versions, one active. A second version is evidence a return happened, and it's
   the source of the fourth indicator. */
    cell: (a) => <span className="num">{a.version}</span>,
    text: (a) => String(a.version),
  },
  {
    key: 'owner',
    w: 132,
    label: 'المشرف',
    def: true,
    cell: (a) => <Person name={a.owner} />,
    text: (a) => a.owner,
  },
  {
    key: 'template',
    w: 210,
    label: 'النموذج',
    cell: (a) => <span className="sub">{a.template}</span>,
    text: (a) => a.template,
  },
  {
    key: 'signer',
    w: 168,
    label: 'ممثل الجهة',
    cell: (a) => (
      <span className="sub">{a.signer.name} · {a.signer.title}</span>
    ),
    text: (a) => `${a.signer.name} · ${a.signer.title}`,
  },
  {
    key: 'openedAt',
    w: 112,
    label: 'بدء الإعداد',
    cell: (a) => <DateText>{a.openedAt}</DateText>,
    text: (a) => a.openedAt,
  },
  {
    key: 'activeAt',
    w: 112,
    label: 'تاريخ التفعيل',
    cell: (a) => (a.activeAt ? <DateText>{a.activeAt}</DateText> : <Nil />),
    text: (a) => a.activeAt ?? '',
  },
]

export const GROUPS: GroupBy<AgreementRow>[] = [
  { key: 'stage', label: 'المرحلة', of: (a) => agrStageLabel(a.stage) },
  { key: 'kind', label: 'النوع', of: (a) => a.kind },
  { key: 'owner', label: 'المشرف', of: (a) => a.owner },
  { key: 'entity', label: 'الجهة', of: (a) => a.entityName },
]

export const groupByKey = (k?: string): GroupBy<AgreementRow> | undefined =>
  GROUPS.find((g) => g.key === k)
