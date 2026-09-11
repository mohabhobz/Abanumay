import { Link } from 'react-router-dom'
import { Mono, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { activationTone, governanceTone } from '@/lib/tone'
import { ENTITY_DOCS_TOTAL } from '@/data/repository'
import type { EntityRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة جدول الجهات.

   نفس عقد المشاريع: تعريف واحد بيغذّي الجدول والإجماليات
   والتصدير والتجميع. تقرير الشركاء في النظام العامل فيه 16 عمودًا،
   وكلهم هنا · تسعة ظاهرين افتراضيًا والباقي من منتقي الأعمدة.
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<EntityRow>

export const COLS: Col[] = [
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
  { key: 'type', w: 118, label: 'النوع', def: true, cell: (e) => <span className="sub">{e.type}</span>, text: (e) => e.type },
  { key: 'licensor', w: 160, label: 'الجهة المرخِّصة', cell: (e) => <span className="sub">{e.licensor}</span>, text: (e) => e.licensor },
  { key: 'region', w: 98, label: 'المنطقة', def: true, cell: (e) => <span className="sub">{e.region}</span>, text: (e) => e.region },
  { key: 'city', w: 98, label: 'المدينة', cell: (e) => <span className="sub">{e.city}</span>, text: (e) => e.city },
  {
    key: 'activation',
    w: 116,
    label: 'التفعيل',
    def: true,
    cell: (e) => <Tag tone={activationTone(e.activation)}>{e.activation}</Tag>,
    text: (e) => e.activation,
  },
  {
    key: 'governance',
    w: 106,
    label: 'الحوكمة',
    def: true,
    cell: (e) => <Tag tone={governanceTone(e.governance)}>{e.governance}</Tag>,
    text: (e) => e.governance,
  },
  {
    key: 'docs',
    w: 104,
    label: 'المستندات',
    def: true,
    n: true,
    /* الناقص بيتلوّن: ملف الجهة الناقص هو اللي بيوقف الاتفاقية،
       فلازم يبان من مسح الجدول لا من فتح الصف. */
    cell: (e) => (
      <span className={e.docsUploaded < ENTITY_DOCS_TOTAL ? 'over' : undefined}>
        {e.docsUploaded}/{ENTITY_DOCS_TOTAL}
      </span>
    ),
    text: (e) => `${e.docsUploaded}/${ENTITY_DOCS_TOTAL}`,
    value: (e) => e.docsUploaded,
    agg: 'avg',
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
  { key: 'email', w: 170, label: 'البريد', cell: (e) => <span className="sub">{e.email}</span>, text: (e) => e.email },
]

export const GROUPS: GroupBy<EntityRow>[] = [
  { key: 'region', label: 'المنطقة', of: (e) => e.region },
  { key: 'city', label: 'المدينة', of: (e) => e.city },
  { key: 'type', label: 'النوع', of: (e) => e.type },
  { key: 'licensor', label: 'الجهة المرخِّصة', of: (e) => e.licensor },
  { key: 'activation', label: 'التفعيل', of: (e) => e.activation },
  { key: 'governance', label: 'الحوكمة', of: (e) => e.governance },
]

export const groupByKey = (key: string | undefined): GroupBy<EntityRow> | undefined =>
  GROUPS.find((g) => g.key === key)
