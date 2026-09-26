import { Link } from 'react-router-dom'
import { DateText, Empty, Glass, Head, Icon, KV, Money, Num, Tag, icons } from '@/components/ui'
import { TONE } from '@/lib/tone'
import { ROUTES } from '@/app/routes'
import { NOUN, nounAfter, pct, ver } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planPlanned, planSpi,
  planStageLabel, readyToClose, spiSay, waitingReview,
} from '@/data/mock/plans'
import { PlanBar } from '@/features/plans/PlanBar'
import type { PlanRow } from '@/types/domain'

/* Plan tab on the project page.

   The tab answers "what's this project's plan," while the panel answers
   "what's currently pending on it" — both exist because the questions
   differ, not because the screen was duplicated; the same split as the
   agreement tab.

   "Doesn't require a plan" is an explicit state, not an empty tab. The
   grants manager's pre-approval decision determines whether a project
   requires a work plan at all. A project with no plan isn't missing
   something — it was decided that it doesn't need one. An empty tab without
   this statement reads as "something's missing." */

export interface PlanTabProps {
  plan?: PlanRow
  granted: number
  /** Starts a plan — empty if the project hasn't reached that stage. */
  onStart?: () => void
  startBlocked?: string
}

export function PlanTab({ plan: p, granted, onStart, startBlocked }: PlanTabProps) {
  if (!p) {
    return (
      <Glass>
        <Head title="خطة تنفيذ المشروع" meta="قرار مدير المنح قبل الاعتماد" />
        <Empty
          art={{ done: 0 }}
          title="هذا المشروع لم تُفتح له خطة تنفيذ."
          note="تُفتح خطة التنفيذ للمشاريع التي يقرّر مدير المنح أنها تتطلب خطة عمل · وهي إجراء مستقل يسير بالتوازي مع الاتفاقية: تكتب الجهة المراحل والأنشطة والشواهد، ويعتمدها مشرف المنح ثم مدير المنح، فتُثبَّت نسخة مرجعية يُقاس عليها الإنجاز."
          actions={onStart && (
            <button
              className="btn btn-p"
              disabled={Boolean(startBlocked)}
              title={startBlocked || 'يفتح الخطة ويرسلها إلى الجهة لتعبئتها'}
              onClick={onStart}
            >
              <Icon name={icons.plus} size="sm" />
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
              ? <><Num>{ver(p.baseline)}</Num>{' '}
                <span className="sub">من <DateText>{p.baselineAt ?? ''}</DateText></span></>
              : <span className="sub">لم تُعتمد بعد</span>,
          },
          {
            k: 'المراحل والأنشطة',
            v: <>
              <Num>{p.phases.length}</Num> {nounAfter(p.phases.length, NOUN.phase)} ·{' '}
              <Num>{p.phases.reduce((s, ph) => s + ph.activities.length, 0)}</Num> {nounAfter(p.phases.reduce((s, ph) => s + ph.activities.length, 0), NOUN.activity)}
            </>,
          },
          {
            k: 'ميزانية المراحل',
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
                ? <span className="sub">لم يبدأ التنفيذ</span>
                : <span className={spi < 0.8 ? 'bad' : undefined}>
                  <span className="num">{spi.toFixed(2)}</span>
                  <span className="sub"> · {say.say}</span>
                </span>,
            },
            {
              k: 'بانتظار مراجعة المشرف',
              v: queue === 0
                ? <span className="sub">لا شيء</span>
                : <Tag tone="warn"><Num>{queue}</Num> {nounAfter(queue, NOUN.activity)}</Tag>,
            },
            {
              k: 'تجاوز موعده ولم يُقبل',
              v: late === 0
                ? <span className="sub">لا شيء</span>
                : <Tag tone={TONE.late}><Num>{late}</Num> {nounAfter(late, NOUN.activity)}</Tag>,
            },
          ] : []),
        ]}
      />

      {/* This line is the plan's effect on the project — without it, the tab would
          just display numbers with no consequence. A completed plan lifts a
          blocker on closing; it doesn't perform the closing itself. */}
      {readyToClose(p) ? (
        <p className="ok cnote">
          قُبلت كل أنشطة الخطة · المشروع مؤهَّل للإغلاق، والإغلاق إجراء مستقل
          له قواعده (التقرير الختامي · الاتصال المؤسسي · التقييم).
        </p>
      ) : (
        <p className="sub cnote">
          مرحلة الخطة لا تغيّر حالة المشروع · فهما إجراءان مستقلان. ولا يصبح
          المشروع مؤهَّلًا للإغلاق قبل قبول كل أنشطة خطته
          {live && <> · المقبول الآن {pct(done)}</>}.
        </p>
      )}

      <div className="rowf gp-2">
        <Link to={ROUTES.plan(p.id)} className="btn btn-p">
          افتح الخطة
          <Icon name={icons.chevron} size="sm" />
        </Link>
        <Link to={ROUTES.plans} className="btn btn-2">صندوق الخطط</Link>
      </div>
    </Glass>
  )
}
