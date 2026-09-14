import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { payHeat, payStateLabel } from '@/data/mock/disbursements'
import type { PayRequest } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة جدول الصرف.

   نفس عقد المشاريع والجهات: تعريف واحد بيغذّي الجدول والإجماليات
   والتصدير والتجميع · فالعمود اللي بيتضاف هنا بيوصل للإكسل وللصورة
   من غير أي شغل زيادة.

   الكارت والجدول بيجاوبوا سؤالين مختلفين، وده سبب وجود الاتنين:
   الكارت بيقول «ليه ده واقف» بالشروط الأربعة قدامك، والجدول بيقول
   «إيه شكل الطابور كله» · تقارن مبالغ وتواريخ ومشرفين في عمود واحد،
   وتصدّره. عشان كده عمود الشروط هنا رقم (٣ من ٤) لا قائمة: الجدول
   بيقول إن فيه واقف، والكارت بيقول أنهي واحد.
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<PayRequest>

const HEAT_TONE = { ok: 'ok', late: 'warn', stuck: 'no' } as const
const HEAT_SAY = { ok: 'في المدة', late: 'متأخر', stuck: 'متعثر' } as const

const okCount = (r: PayRequest) => r.checks.filter((c) => c.ok).length + (r.bank.active ? 1 : 0)
const allCount = (r: PayRequest) => r.checks.length + 1

export const COLS: Col[] = [
  {
    key: 'id',
    w: 130,
    label: 'رقم الطلب',
    fixed: true,
    cell: (r) => <Mono>{r.id}</Mono>,
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
        ? <span className="sub"><span className="num">{Math.round(r.hoursInState / 24)}</span> يومًا</span>
        : <Tag tone={HEAT_TONE[h]}>{HEAT_SAY[h]}</Tag>
    },
    text: (r) => (payHeat(r) === 'ok' ? `${Math.round(r.hoursInState / 24)} يومًا` : HEAT_SAY[payHeat(r)]),
    value: (r) => Math.round(r.hoursInState / 24),
    agg: 'avg',
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
    /* `Person` هو نفسه اللي في الكارت وفي فلتر المشرف · الشخص
       بنفس الشكل في التلات أماكن، بكمبوننت واحد لا تلاتة */
    cell: (r) => <Person name={r.owner} />,
    text: (r) => r.owner,
  },
  {
    key: 'bank',
    w: 170,
    label: 'الحساب المعتمد',
    cell: (r) => (
      <span className={r.bank.active ? 'sub' : 'bad'}>
        {r.bank.name}{r.bank.active ? '' : ' · معطَّل'}
      </span>
    ),
    text: (r) => `${r.bank.name}${r.bank.active ? '' : ' · معطل'}`,
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
    cell: (r) => (r.paidAt ? <DateText>{r.paidAt}</DateText> : <span className="sub">·</span>),
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
