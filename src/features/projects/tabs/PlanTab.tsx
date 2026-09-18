import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, KV, Money, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { pct } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planPlanned, planSpi,
  planStageLabel, readyToClose, spiSay, waitingReview,
} from '@/data/mock/plans'
import { PlanBar } from '@/features/plans/PlanBar'
import type { PlanRow } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   تاب الخطة في صفحة المشروع · BPD-012

   ⚠️ **التاب بيجاوب «إيه خطة المشروع ده» · الصندوق بيجاوب «إيه
   اللي واقف عندي».** الاتنين موجودين لأن السؤالين مختلفين، لا
   لأن الشاشة اتكرّرت · نفس منطق تاب الاتفاقية بالحرف.

   ⚠️ **و«لا يتطلب خطة» حالة مكتوبة لا تاب فاضي.** قرار مدير المنح
   قبل الاعتماد بيحدّد إن المشروع يتطلب خطة عمل ولا لأ (الوثيقة:
   «في حالة المشاريع التي تتطلب خطة عمل») · فالمشروع اللي مالوش
   خطة **مش ناقص حاجة**، هو اتقرّر إنه ما يحتاجش. وتاب فاضي من غير
   الجملة دي بيتقري «فيه حاجة ناقصة».
   ═══════════════════════════════════════════════════════════ */

export interface PlanTabProps {
  plan?: PlanRow
  granted: number
  /** يبدأ خطة · فاضي لو المشروع ما وصلش المرحلة */
  onStart?: () => void
  startBlocked?: string
}

export function PlanTab({ plan: p, granted, onStart, startBlocked }: PlanTabProps) {
  if (!p) {
    return (
      <Glass>
        <Head title="خطة تنفيذ المشروع" meta="قرار مدير المنح قبل الاعتماد" />
        <Empty
          title="هذا المشروع لم تُفتح له خطة تنفيذ."
          note="خطة التنفيذ تُفتح للمشاريع التي يقرّر مدير المنح أنها تتطلب خطة عمل · وهي إجراء مستقل يمشي بالتوازي مع الاتفاقية: الجهة تكتب المراحل والأنشطة والشواهد، ويعتمدها مشرف المنح ثم مدير المنح، فتُثبَّت نسخة مرجعية يُقاس عليها الإنجاز."
          actions={onStart && (
            <button
              className="btn btn-p"
              disabled={Boolean(startBlocked)}
              title={startBlocked || 'يفتح الخطة ويحيلها للجهة لتعبئتها'}
              onClick={onStart}
            >
              <Icon name={icons.plus} size={16} />
              افتح خطة للمشروع
            </button>
          )}
        />
      </Glass>
    )
  }

  const done = planDone(p)
  const claim = planClaimed(p)
  const want = planPlanned(p)
  const spi = planSpi(p)
  const say = spiSay(spi)
  const queue = waitingReview(p).length
  const late = lateActivities(p).length
  const live = p.stage === 'active' || p.stage === 'done'
  const cost = p.phases.reduce((s, ph) => s + ph.cost, 0)

  return (
    <Glass>
      <Head
        title="خطة تنفيذ المشروع"
        meta={<Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>}
      />

      {live && <PlanBar done={done} claim={claim} want={want} />}

      <KV
        rows={[
          {
            k: 'النسخة المرجعية',
            v: p.baseline > 0
              ? <>V<span className="num">{p.baseline}</span>{' '}
                <span className="sub">من <DateText>{p.baselineAt ?? ''}</DateText></span></>
              : <span className="sub">لم تُعتمد بعد</span>,
          },
          {
            k: 'المراحل والأنشطة',
            v: <>
              <Num>{p.phases.length}</Num> مراحل ·{' '}
              <Num>{p.phases.reduce((s, ph) => s + ph.activities.length, 0)}</Num> نشاطًا
            </>,
          },
          {
            k: 'تكلفة المراحل',
            v: <>
              <Money sm>{cost}</Money>
              {granted > 0 && cost !== granted && (
                <span className="bad"> · لا تساوي قيمة المنحة</span>
              )}
            </>,
          },
          ...(live ? [
            {
              k: 'أداء الجدول · SPI',
              v: spi === null
                ? <span className="sub">ما بدأش</span>
                : <span className={spi < 0.8 ? 'bad' : undefined}>
                  <span className="num">{spi.toFixed(2)}</span>
                  <span className="sub"> · {say.say}</span>
                </span>,
            },
            {
              k: 'مستنّي مراجعة المشرف',
              v: queue === 0
                ? <span className="sub">لا شيء</span>
                : <Tag tone="warn"><Num>{queue}</Num> نشاطًا</Tag>,
            },
            {
              k: 'عدّى موعده ولم يُقبل',
              v: late === 0
                ? <span className="sub">لا شيء</span>
                : <Tag tone="no"><Num>{late}</Num> نشاطًا</Tag>,
            },
          ] : []),
        ]}
      />

      {/* ⚠️ **الجملة دي هي أثر الخطة على المشروع** · ومن غيرها
          التاب بيبقى عرضًا لأرقام مالهاش نتيجة. الخطة المكتملة
          بترفع **مانعًا** للإغلاق، وما بتعملش الإغلاق (فصل
          الإجراءات · ح-10). */}
      {readyToClose(p) ? (
        <p className="ok cnote">
          كل أنشطة الخطة قُبلت · المشروع مؤهَّل للإغلاق، والإغلاق إجراء تاني
          له قواعده (التقرير الختامي · الاتصال المؤسسي · التقييم).
        </p>
      ) : (
        <p className="sub cnote">
          مرحلة الخطة لا تغيّر حالة المشروع · إجراءان مستقلان. والمشروع
          ما يبقاش مؤهَّلًا للإغلاق قبل قبول كل أنشطة خطته
          {live && <> · المقبول الآن {pct(done)}</>}.
        </p>
      )}

      <div className="rowf gp-2">
        <Link to={ROUTES.plan(p.id)} className="btn btn-p">
          افتح الخطة
          <Icon name={icons.chevron} size={15} />
        </Link>
        <Link to={ROUTES.plans} className="btn btn-2">صندوق الخطط</Link>
      </div>
    </Glass>
  )
}
