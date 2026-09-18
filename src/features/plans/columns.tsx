import { Link } from 'react-router-dom'
import { DateText, Mono, Num, Person, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { pct } from '@/lib/format'
import {
  PLAN_TONE, planClaimed, planDone, planPlanned, planSpi, planStageLabel,
  lateActivities, waitingReview,
} from '@/data/mock/plans'
import type { PlanRow } from '@/types/domain'
import type { Col as TCol, GroupBy } from '@/components/table'

/* ═══════════════════════════════════════════════════════════
   أعمدة صندوق الخطط · نفس عقد المشاريع والاتفاقيات والصرف.

   ⚠️ **تلات أعمدة هنا مش معلومات، هما سؤال المشرف اليومي:**

   · «المنجَز» بيقول اللي **اتراجع واتقبل** · لا اللي الجهة قالته
   · «مستنّي مراجعة» بيقول **طابور شغله هو** · وده العمود اللي
     بيخلّي الصندوق أداة لا عرضًا
   · «الجدول» بيقارن المنجَز بالمخطَّط لليوم (SPI)

   من غير الفصل بين الأول والتاني، نسبة الإنجاز بتبقى إقرارًا
   ذاتيًا من الجهة · والمؤسسة بتقفل مشروعًا على كلام.
   ═══════════════════════════════════════════════════════════ */

export type Col = TCol<PlanRow>

export const COLS: Col[] = [
  {
    key: 'id',
    w: 112,
    label: 'رقم الخطة',
    fixed: true,
    cell: (p) => <Link to={ROUTES.plan(p.id)} className="tlink"><Mono>{p.id}</Mono></Link>,
    text: (p) => p.id,
  },
  {
    key: 'project',
    w: 214,
    label: 'المشروع',
    fixed: true,
    cell: (p) => <Link to={ROUTES.project(p.projectId)} className="tlink">{p.projectName}</Link>,
    text: (p) => p.projectName,
  },
  {
    key: 'entity',
    w: 168,
    label: 'الجهة',
    def: true,
    cell: (p) => <Link to={ROUTES.entity(p.entityId)} className="tlink">{p.entityName}</Link>,
    text: (p) => p.entityName,
  },
  {
    key: 'stage',
    w: 148,
    label: 'حالة الخطة',
    def: true,
    cell: (p) => <Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>,
    text: (p) => planStageLabel(p.stage),
  },
  {
    key: 'done',
    w: 132,
    label: 'المنجَز المقبول',
    def: true,
    n: true,
    /* ⚠️ **الرقمان جنب بعض عن قصد.** المقبول هو اللي بيتحسب،
       والمُعلَن هو اللي الجهة قالته · والفرق بينهم بالظبط هو
       الشغل المستنّي مراجعة. عرض واحد منهم وحده بيخبّي السؤال. */
    cell: (p) => {
      const d = planDone(p)
      const c = planClaimed(p)
      return (
        <span>
          {pct(d)}
          {c > d && <span className="sub"> · مُعلَن {pct(c)}</span>}
        </span>
      )
    },
    text: (p) => `${planDone(p)}%`,
    value: (p) => planDone(p),
    agg: 'avg',
    aggSay: '٪ وسطي',
  },
  {
    key: 'planned',
    w: 118,
    label: 'المخطَّط لليوم',
    n: true,
    cell: (p) => <span>{pct(planPlanned(p))}</span>,
    text: (p) => `${planPlanned(p)}%`,
    value: (p) => planPlanned(p),
    agg: 'avg',
    aggSay: '٪ وسطي',
  },
  {
    key: 'spi',
    w: 112,
    label: 'أداء الجدول',
    def: true,
    n: true,
    /* SPI = المنجَز ÷ المخطَّط · واحد صحيح يعني ماشي بالظبط */
    cell: (p) => {
      const v = planSpi(p)
      if (v === null) return <span className="sub">ما بدأش</span>
      return (
        <span className={v < 0.8 ? 'over' : undefined}>
          <span className="num">{v.toFixed(2)}</span>
        </span>
      )
    },
    text: (p) => { const v = planSpi(p); return v === null ? 'ما بدأش' : v.toFixed(2) },
    /* ⚠️ `null` لا `0` · «ما بدأش» مش أداءً صفرًا، هي غياب قياس */
    value: (p) => planSpi(p),
    agg: 'avg',
    aggSay: 'وسطي المُقاس',
  },
  {
    key: 'waiting',
    w: 132,
    label: 'مستنّي مراجعة',
    def: true,
    n: true,
    /* طابور شغل المشرف · الصفر خافت عشان اللي فوقه يبان */
    cell: (p) => {
      const n = waitingReview(p).length
      return n > 0
        ? <Tag tone="warn"><Num>{n}</Num> نشاطًا</Tag>
        : <span className="sub">0</span>
    },
    text: (p) => String(waitingReview(p).length),
    value: (p) => waitingReview(p).length,
    agg: 'sum',
    aggSay: 'نشاطًا مستنّيًا',
  },
  {
    key: 'late',
    w: 118,
    label: 'متأخّر',
    n: true,
    cell: (p) => {
      const n = lateActivities(p).length
      return n > 0 ? <span className="over">{n}</span> : <span className="sub">0</span>
    },
    text: (p) => String(lateActivities(p).length),
    value: (p) => lateActivities(p).length,
    agg: 'sum',
    aggSay: 'نشاطًا متأخّرًا',
  },
  {
    key: 'baseline',
    w: 122,
    label: 'النسخة المرجعية',
    /* ⚠️ الصفر معناه «ما اتعتمدتش» لا «النسخة صفر» · والكلمة
       بتقول كده، لأن رقم صفر في عمود نسخ بيتقري خطأ بيانات */
    cell: (p) => (p.baseline > 0
      ? <span>V<span className="num">{p.baseline}</span></span>
      : <span className="sub">ما اتعتمدتش</span>),
    text: (p) => (p.baseline > 0 ? `V${p.baseline}` : 'لم تُعتمد'),
  },
  {
    key: 'phases',
    w: 100,
    label: 'المراحل',
    n: true,
    cell: (p) => <span className="num">{p.phases.length}</span>,
    text: (p) => String(p.phases.length),
    value: (p) => p.phases.length,
    agg: 'sum',
  },
  {
    key: 'owner',
    w: 160,
    label: 'مشرف المنح',
    cell: (p) => <Person name={p.owner} />,
    text: (p) => p.owner,
  },
  {
    key: 'drafter',
    w: 140,
    label: 'كاتب المسودة',
    /* ⚠️ الوثيقة بتقول الجهة هي اللي بتكتب · والمشرف بيقدر يكتب
       بالنيابة لمّا الجهة ما تقدرش. العمود بيوثّق **مين فعلًا**،
       لأن «الجهة كتبتها» و«اتكتبت عنها» مش نفس الحاجة في مراجعة. */
    cell: (p) => (p.drafter === 'entity'
      ? <span className="sub">الجهة</span>
      : <Tag tone="ret">المشرف بالنيابة</Tag>),
    text: (p) => (p.drafter === 'entity' ? 'الجهة' : 'المشرف بالنيابة'),
  },
  {
    key: 'openedAt',
    w: 118,
    label: 'تاريخ الفتح',
    cell: (p) => <DateText>{p.openedAt}</DateText>,
    text: (p) => p.openedAt,
  },
  {
    key: 'baselineAt',
    w: 124,
    label: 'تاريخ الاعتماد',
    cell: (p) => (p.baselineAt
      ? <DateText>{p.baselineAt}</DateText>
      : <span className="sub">لم تُعتمد</span>),
    text: (p) => p.baselineAt ?? 'لم تُعتمد',
  },
]

export const GROUPS: GroupBy<PlanRow>[] = [
  { key: 'stage', label: 'حالة الخطة', of: (p) => planStageLabel(p.stage) },
  { key: 'entity', label: 'الجهة', of: (p) => p.entityName },
  { key: 'owner', label: 'مشرف المنح', of: (p) => p.owner },
]

export const groupByKey = (k: string | undefined): GroupBy<PlanRow> | undefined =>
  GROUPS.find((g) => g.key === k)
