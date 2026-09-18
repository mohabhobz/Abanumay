import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import {
  agrHeat, agrPaymentsBalance, agrReserveGap, agrStageLabel,
} from '@/data/mock/agreements'
import type { AgreementRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة جدول الاتفاقيات · نفس عقد المشاريع والجهات والصرف.

   عمودان هنا مش معلومات، هما **تحقّقان**: «جدول الدفعات» بيقول
   متوازن ولا لأ (قاعدة 8)، و«المخصص» بيقول فيه فرق عن المحجوز ولا
   لأ (خطوة 11). الاتنين دول اللي بيمنعوا الإرسال للاعتماد، فالجدول
   بيوَرّيهم في عمود بدل ما المشرف يفتح كل اتفاقية عشان يعرف.
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<AgreementRow>

const HEAT_TONE = { ok: 'ok', late: 'warn', stuck: 'no' } as const
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
    /* قاعدة 8 · المجموع = قيمة المنحة، والنسب = 100% */
    cell: (a) => {
      const b = agrPaymentsBalance(a)
      return b.balanced
        ? <span className="sub"><span className="num">{a.payments.length}</span> دفعات</span>
        : <Tag tone="no">غير متوازن</Tag>
    },
    text: (a) => (agrPaymentsBalance(a).balanced ? `${a.payments.length} دفعات` : 'غير متوازن'),
  },
  {
    key: 'reserve',
    w: 112,
    label: 'المخصص',
    def: true,
    /* خطوة 11 · فرق بين قيمة الاتفاقية والمحجوز بيمنع الإرسال */
    cell: (a) => {
      const gap = agrReserveGap(a)
      return gap === 0
        ? <span className="sub">مطابق</span>
        : <Tag tone="no">فرق <span className="num">{nf.format(Math.abs(gap))}</span></Tag>
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
        ? <span className="sub"><span className="num">{Math.round(a.hoursInStage / 24)}</span> يومًا</span>
        : <Tag tone={HEAT_TONE[h]}>{HEAT_SAY[h]}</Tag>
    },
    text: (a) => (agrHeat(a) === 'ok' ? `${Math.round(a.hoursInStage / 24)} يومًا` : HEAT_SAY[agrHeat(a)]),
    /* الخلية بتقول أيامًا في صفّ وكلمة («متأخر») في صفّ · فالوسط
       لازم يقول وحدته، وإلا بقى رقمًا معلّقًا تحت عمود فيه كلام */
    value: (a) => Math.round(a.hoursInStage / 24),
    agg: 'avg',
    aggSay: 'يومًا وسطي',
  },
  {
    key: 'version',
    w: 82,
    label: 'الإصدار',
    n: true,
    /* قاعدة 24 · إصدارات متعددة وواحد ساري · الإصدار التاني دليل
       إعادة حصلت، وهو مصدر المؤشر الرابع */
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
    cell: (a) => (a.activeAt ? <DateText>{a.activeAt}</DateText> : <span className="sub">·</span>),
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
