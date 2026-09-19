import { Link } from 'react-router-dom'
import { DateText, Mono, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import {
  CLOSE_TONE, closeCycle, closeLate, closeStageLabel, reportBlockers,
} from '@/data/mock/closing'
import type { CloseRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة جدول الإغلاق · نفس عقد المشاريع والاتفاقيات والخطط.

   ⚠️ **عمود «الدورة» مش تصنيفًا، هو اللي بيمنع الخلط.** القاعدة
   17 بتقول إن التقرير والتقييم **دورتا اعتماد مستقلتان**، يعني
   «عند مدير المنح» بتحصل مرتين في حياة الطلب الواحد وبتعني
   حاجتين مختلفتين. لو الجدول قال المحطة بس، المدير بيقرا اسمًا
   ما بيقولش هو بيراجع تقرير الجهة ولا تقييم مشرفه.

   ⚠️ **وعمود «الناقص» تحقّق لا معلومة** · زي «جدول الدفعات» في
   الاتفاقيات: قاعدة 4 بتحدّد أربع بيانات وقاعدة 10 بتمنع الإرسال
   من غيرهم · فالمانع بيبان في الصندوق بدل ما المشرف يفتح كل طلب
   عشان يعرف إيه اللي واقف.
   ═══════════════════════════════════════════════════════════ */

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
    /* قاعدة 4 و10 · الحدّ الأدنى والمرفقات الإلزامية */
    cell: (c) => {
      const n = reportBlockers(c).length
      return n === 0
        ? <span className="sub">مكتمل</span>
        : <Tag tone="no"><span className="num">{n}</span> بند</Tag>
    },
    text: (c) => {
      const n = reportBlockers(c).length
      return n === 0 ? 'مكتمل' : `${n} بند`
    },
    value: (c) => reportBlockers(c).length,
    agg: 'sum',
    aggSay: 'بندًا ناقصًا',
  },
  {
    key: 'beneficiaries',
    w: 120,
    label: 'المستفيدون الفعلي',
    n: true,
    def: true,
    cell: (c) => (c.report.beneficiaries === null
      ? <span className="sub">·</span>
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
      ? <span className="sub">·</span>
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
        ? <Tag tone="warn">متأخر</Tag>
        : <span className="sub"><span className="num">{days}</span> يومًا</span>
    },
    text: (c) => (closeLate(c) ? 'متأخر' : `${Math.round(c.hoursInStage / 24)} يومًا`),
    /* نفس درس عمود المدة في الاتفاقيات: الخلية بتقول رقمًا في صفّ
       وكلمة في صفّ · فالوسط لازم يقول وحدته */
    value: (c) => Math.round(c.hoursInStage / 24),
    agg: 'avg',
    aggSay: 'يومًا وسطي',
  },
  {
    key: 'version',
    w: 84,
    label: 'الإصدار',
    n: true,
    /* قاعدة 15 و19 · الإصدار التاني دليل إعادة حصلت */
    cell: (c) => <span className="num">{c.versions.length}</span>,
    text: (c) => String(c.versions.length),
  },
  {
    key: 'media',
    w: 128,
    label: 'النشر الإعلامي',
    /* قاعدة 9 · محطة الاتصال المؤسسي «متى كانت مطلوبة» */
    cell: (c) => <span className="sub">{c.mediaRequired ? 'مطلوب' : 'ما بينطبقش'}</span>,
    text: (c) => (c.mediaRequired ? 'مطلوب' : 'ما بينطبقش'),
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
    label: 'فتح الطلب',
    cell: (c) => <DateText>{c.openedAt}</DateText>,
    text: (c) => c.openedAt,
  },
  {
    key: 'closedAt',
    w: 112,
    label: 'تاريخ الإغلاق',
    cell: (c) => (c.closedAt ? <DateText>{c.closedAt}</DateText> : <span className="sub">·</span>),
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
