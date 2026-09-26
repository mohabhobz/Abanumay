import { Link } from 'react-router-dom'
import { DateText, Mono, Num, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import {
  REG_DOCS, REG_STATE_SAY, REG_TONE, docRequired, partnerKind, regMissingDocs,
  type RegRequest,
} from '@/data/mock/registration'
import type { Col as TCol, GroupBy } from '@/components/table'

/* Registration request inbox columns - same contract as the other tables.

   The "file" column here is a check, not information: it states uploaded against required, and
   required itself changes by entity category (three documents are mandatory for commercial entities
   only). So "3 of 5" in one row and "3 of 2" in another are both valid - the second number isn't
   fixed.

   The "governance score" column is tagged declaration, not assessment - the entity wrote it
   themselves in `/reg/add`. */

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
    key: 'partner',
    w: 120,
    label: 'نوع الشراكة',
    cell: (r) => <span className="sub">{partnerKind(r.partner).label}</span>,
    text: (r) => partnerKind(r.partner).label,
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
    /* Note: the cell counts what's complete, and the total counts what's missing - so it has to say so.
   Without the word, it rendered as a bare black number (5) under a column whose other cells read "1
   of 2", with nothing for the reader to connect it to. */
    value: (r) => regMissingDocs(r).length,
    agg: 'sum',
    aggSay: 'مستندًا ناقصًا',
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
    /* "Not yet assessed" is excluded from the calculation - a zero would say "scored zero". */
    value: (r) => (r.governanceClaim > 0 ? r.governanceClaim : null),
    agg: 'avg',
    aggSay: 'متوسط المُقيَّم',
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
    /* Note: `null`, not `0` - "not yet closed" isn't a zero duration, it's the absence of one. It used
   to be `?? 0`, so the average was dividing by requests that were still open. */
    value: (r) => r.reviewDays ?? null,
    agg: 'avg',
    aggSay: 'يومًا في المتوسط للمغلَق',
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
    label: 'الجهة المُنشأة',
    /* Rule 2 - the entity doesn't exist before approval, so this cell is deliberately empty in every
   status except "approved". */
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
