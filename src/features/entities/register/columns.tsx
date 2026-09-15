import { Link } from 'react-router-dom'
import { DateText, Mono, Num, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import {
  REG_DOCS, REG_STATE_SAY, REG_TONE, docRequired, regMissingDocs, type RegRequest,
} from '@/data/mock/registration'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة صندوق طلبات التسجيل · نفس عقد باقي الجداول.

   عمود «الملف» هنا **تحقّق لا معلومة**: بيقول المرفوع من المطلوب،
   والمطلوب نفسه بيتغيّر بتصنيف الجهة (تلات مستندات إلزامية للجهات
   التجارية وحدها). فـ«3 من 5» في صفّ و«3 من 2» مستحيلة في صفّ
   تاني — الرقم التاني مش ثابت.

   وعمود «درجة الحوكمة» موسوم **إقرار** لا تقييم · الجهة هي اللي
   كتبته في `/reg/add` (نوتة ن-2 في البريف).
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<RegRequest>

const needCount = (r: RegRequest) =>
  REG_DOCS.filter((d) => docRequired(d, r.type)).length

export const COLS: Col[] = [
  {
    key: 'id',
    w: 112,
    label: 'رقم الطلب',
    fixed: true,
    cell: (r) => (
      <Link to={ROUTES.entityRequest(r.id)} className="tlink"><Mono>{r.id}</Mono></Link>
    ),
    text: (r) => r.id,
  },
  {
    key: 'name',
    w: 230,
    label: 'اسم الجهة',
    fixed: true,
    cell: (r) => <Link to={ROUTES.entityRequest(r.id)} className="tlink">{r.name}</Link>,
    text: (r) => r.name,
  },
  {
    key: 'state',
    w: 132,
    label: 'حالة الطلب',
    def: true,
    cell: (r) => <Tag tone={REG_TONE[r.state]}>{REG_STATE_SAY[r.state]}</Tag>,
    text: (r) => REG_STATE_SAY[r.state],
  },
  {
    key: 'type',
    w: 108,
    label: 'التصنيف',
    def: true,
    cell: (r) => <span className="sub">{r.type}</span>,
    text: (r) => r.type,
  },
  {
    key: 'licenseNo',
    w: 106,
    label: 'رقم الترخيص',
    def: true,
    cell: (r) => <Mono>{r.licenseNo}</Mono>,
    text: (r) => r.licenseNo,
  },
  {
    key: 'docs',
    w: 130,
    label: 'ملف المستندات',
    def: true,
    n: true,
    cell: (r) => {
      const need = needCount(r)
      const have = need - regMissingDocs(r).length
      return (
        <Tag tone={have === need ? 'ok' : 'warn'}>
          <Num>{have}</Num> من <Num>{need}</Num>
        </Tag>
      )
    },
    text: (r) => `${needCount(r) - regMissingDocs(r).length}/${needCount(r)}`,
    value: (r) => regMissingDocs(r).length,
    agg: 'sum',
  },
  {
    key: 'governance',
    w: 128,
    label: 'الحوكمة · إقرار الجهة',
    n: true,
    cell: (r) =>
      r.governanceClaim > 0
        ? <span className="num">{r.governanceClaim}</span>
        : <span className="sub">لم تُقيَّم</span>,
    text: (r) => (r.governanceClaim > 0 ? String(r.governanceClaim) : 'لم تُقيَّم'),
    value: (r) => r.governanceClaim,
    agg: 'avg',
  },
  {
    key: 'licensor',
    w: 200,
    label: 'جهة الإشراف الفني',
    cell: (r) => <span className="sub trim1">{r.licensor}</span>,
    text: (r) => r.licensor,
  },
  {
    key: 'region',
    w: 118,
    label: 'المنطقة',
    cell: (r) => <span className="sub">{r.region}</span>,
    text: (r) => r.region,
  },
  {
    key: 'city',
    w: 112,
    label: 'المدينة',
    cell: (r) => <span className="sub">{r.city}</span>,
    text: (r) => r.city,
  },
  {
    key: 'submittedAt',
    w: 118,
    label: 'تاريخ الإرسال',
    def: true,
    cell: (r) => <DateText>{r.submittedAt}</DateText>,
    text: (r) => r.submittedAt,
  },
  {
    key: 'reviewDays',
    w: 108,
    label: 'مدة المراجعة',
    n: true,
    cell: (r) =>
      r.reviewDays
        ? <span className="num">{r.reviewDays}</span>
        : <span className="sub">لم تُغلق</span>,
    text: (r) => (r.reviewDays ? String(r.reviewDays) : 'لم تُغلق'),
    value: (r) => r.reviewDays ?? 0,
    agg: 'avg',
  },
  {
    key: 'clerk',
    w: 160,
    label: 'مدخل البيانات',
    cell: (r) => <span className="sub trim1">{r.clerkName}</span>,
    text: (r) => r.clerkName,
  },
  {
    key: 'entityId',
    w: 128,
    label: 'الجهة المتولّدة',
    /* قاعدة 2 · الجهة مالهاش وجود قبل الاعتماد، فالخانة فاضية عن
       قصد في كل حالة غير «معتمد» */
    cell: (r) =>
      r.entityId
        ? <Link to={ROUTES.entity(r.entityId)} className="tlink"><Mono>{r.entityId}</Mono></Link>
        : <span className="sub">لم تُنشأ بعد</span>,
    text: (r) => r.entityId ?? 'لم تُنشأ بعد',
  },
]

export const GROUPS: GroupBy<RegRequest>[] = [
  { key: 'state', label: 'حالة الطلب', of: (r) => REG_STATE_SAY[r.state] },
  { key: 'type', label: 'تصنيف الجهة', of: (r) => r.type },
  { key: 'region', label: 'المنطقة', of: (r) => r.region },
]

export const groupByKey = (k: string | undefined): GroupBy<RegRequest> | undefined =>
  GROUPS.find((g) => g.key === k)
