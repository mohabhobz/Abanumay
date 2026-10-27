import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ButtonLink, Button, DateText, Empty, Glass, Head, Icon, KV, Money, Num, Tabs, Tag, icons } from '@/components/ui'
import { TONE } from '@/lib/tone'
import { ROUTES } from '@/app/routes'
import { nf, NOUN, nounAfter, pct, ver } from '@/lib/format'
import {
  PLAN_TONE, lateActivities, planClaimed, planDone, planCounts, planExecution, planPlanned, planRows, planSpi,
  planStageLabel, readyToClose, spiSay, waitingReview,
} from '@/data/mock/plans'
import { planVersions } from '@/data/plans/store'
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
  /* Client meeting 20 Oct (#37) · the active plan by default · and beside it everything that came
     before: the versions an approved change cancelled, the project's cancelled plans, the requests */
  const [pane, setPane] = useState<'active' | 'history'>('active')
  if (!p) {
    return (
      <Glass>
        <Head title="خطة تنفيذ المشروع" />
        <Empty
          art={{ done: 0 }}
          title="هذا المشروع لم تُفتح له خطة تنفيذ."
          actions={onStart && (
            <Button
              variant="p"
              disabled={Boolean(startBlocked)}
              title={startBlocked || 'يفتح الخطة ويرسلها إلى الجهة لتعبئتها'}
              onClick={onStart}
            >
              <Icon name={icons.plus} size="sm" />
              افتح خطة للمشروع
            </Button>
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
  const old = planVersions(p).filter((v) => v.state === 'cancelled' && v.change)
  const otherPlans = planRows.filter((x) => x.projectId === p.projectId && x.id !== p.id)
  const histCount = old.length + otherPlans.length + p.changes.length

  return (
    <Glass>
      <Head
        title="خطة تنفيذ المشروع"
        meta={<Tag tone={PLAN_TONE[p.stage]}>{planStageLabel(p.stage)}</Tag>}
      />
      {histCount > 0 && (
        <Tabs
          pin={false}
          items={[{ slug: 'active', label: p.stage === 'cancelled' ? 'الخطة' : 'الخطة النشطة' }, { slug: 'history', label: 'الملغاة وطلبات التعديل', count: histCount }]}
          active={pane}
          onChange={(x) => setPane(x === 'history' ? 'history' : 'active')}
        />
      )}
      {pane === 'history' && histCount > 0 ? (
        <ul className="plver">
          {old.map((v) => (
            <li key={`v${v.no}`}>
              <div className="plver-h">
                <b>النسخة <Num>{ver(v.no)}</Num></b>
                <Tag tone="no">ملغاة</Tag>
                {v.at && <span className="sub">أُلغيت <DateText>{v.at}</DateText></span>}
              </div>
            </li>
          ))}
          {otherPlans.map((x) => (
            <li key={x.id}>
              <div className="plver-h">
                <Link className="tlink" to={ROUTES.plan(x.id)}>{x.id}</Link>
                <Tag tone={PLAN_TONE[x.stage]}>{planStageLabel(x.stage)}</Tag>
                <span className="sub">فُتحت <DateText>{x.openedAt}</DateText></span>
              </div>
            </li>
          ))}
          {[...p.changes].reverse().map((c) => (
            <li key={c.id}>
              <div className="plver-h">
                <b>{c.mode === 'cancel' ? 'طلب إلغاء' : 'طلب تعديل'}</b>
                <Tag tone={c.state === 'approved' ? 'ok' : c.state === 'rejected' ? 'no' : 'warn'}>
                  {c.state === 'approved' ? 'معتمَد' : c.state === 'rejected' ? 'مرفوض' : c.state === 'returned' ? 'أُعيد للاستكمال' : c.state === 'toAgreement' ? 'بانتظار ملحق الاتفاقية' : c.step === 'supervisor' ? 'بانتظار مشرف المنح' : 'بانتظار مدير المنح'}
                </Tag>
                <span className="sub"><DateText>{c.at}</DateText> · {c.by}</span>
              </div>
              <span className="sub">{c.why ?? c.say}</span>
            </li>
          ))}
        </ul>
      ) : (<>

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
              /* Client sheet 24 Oct (#96) · accepted activities ÷ all activities */
              k: 'نسبة اكتمال المشروع',
              v: <span><span className="num">{pct(done)}</span>
                <span className="sub"> · {(() => { const c = planCounts(p); return `${nf.format(c.accepted)} مقبولة من ${nf.format(c.total)} ${nounAfter(c.total, NOUN.activity)}` })()}</span></span>,
            },
            {
              /* Client sheet 24 Oct (#97) */
              k: 'نسبة تنفيذ المشروع',
              v: spi === null
                ? <span className="sub">لم يحن موعد أي نشاط بعد</span>
                : <span className={spi < 0.8 ? 'bad' : undefined}>
                  <span className="num">{pct(Math.round(spi * 100))}</span>
                  <span className="sub"> · {(() => { const e = planExecution(p); return `${nf.format(e.accepted)} مقبولة من ${nf.format(e.due)} ${nounAfter(e.due, NOUN.activity)} حلّ موعدها` })()} · {say.say}</span>
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

      {readyToClose(p) && (
        <p className="ok cnote">قُبلت كل أنشطة الخطة · المشروع مؤهَّل للإغلاق.</p>
      )}

      </>)}

      {/* Client 27 Oct · the card's actions on its own foot, clear of the data above them */}
      <div className="cardfoot">
        <ButtonLink to={ROUTES.plan(p.id)} variant="p">
          افتح الخطة
          <Icon name={icons.chevron} size="sm" />
        </ButtonLink>
        <ButtonLink to={ROUTES.plans} variant="2">صندوق الخطط</ButtonLink>
      </div>
    </Glass>
  )
}
