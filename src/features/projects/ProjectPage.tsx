import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GateArc, Money, Num, Tabs } from '@/components/ui'
import { DecisionBar, Crumbs } from '@/components/shell'
import { EhsanCard, EhsanNoAgreement, RoutingCard } from '@/features/partners/parts'
import { viaEhsan } from '@/data/partners/store'
import { AppLayout } from '@/app/layout/AppLayout'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useFillHeight } from '@/hooks/useFillHeight'
import { addDays, projectCode } from '@/lib/format'
import { fixtures } from '@/data/repository'
import { useRole } from '@/hooks/useRole'
import { projectById } from '@/data/mock/projects'
import { entityById } from '@/data/mock/entities'
import { days, groupTone } from '@/lib/tone'
import { assistFor } from '@/data/mock/assistant'
import {
  DEFAULT_PROJECT_TAB, PROJECT_TABS, ROUTES, type ProjectTabSlug,
} from '@/app/routes'
import {
  ActivitiesTab, AgreementTab, CloseTab, CorrespondenceTab, DataTab, EntityTab, FollowUpsTab,
  HistoryTab, LogTab, PaymentsTab, PlanTab,
} from './tabs'
import { ACTIVITY_FOLLOW_TYPES, activitiesFromFollowUps, useActivities, withActivities } from './activities'
import { useFollowUps } from './followups'
import { closeOfProject } from '@/data/mock/closing'
import { openClosing, paidToDate } from '@/data/closing/store'
import { DistressCard } from '@/features/closing/DistressCard'
import { AnalysisCard } from '@/components/assistant'
import { ehsanAi, projectAi } from '@/data/shared/ai'
import { readInsights, readJourney } from '@/data/readings'
import { exampleWith, projectDetail } from '@/data/mock/detail'
import { projectLog } from '@/data/mock/log'
import { projectOptions } from '@/data/mock/agreementNew'
import { agreementsOfProject, useAgreements } from '@/data/agreements/store'
import { ProjectAgreements } from '@/features/agreements/parts'
import { projectChain } from '@/data/mock/chain'
import { planOfProject } from '@/data/mock/plans'
import { planDecisionEvents, planDecisionOf, usePlans } from '@/data/plans/store'
import { PlanDecisionCard } from '@/features/plans/PlanDecisionCard'
import { journeys } from '@/data/journey'
import { BudgetLinkAction } from '@/features/budget/BudgetLink'
import { useBudget } from '@/data/budget/store'
import { scheduleOf, usePayments } from '@/data/payments/store'
import { PAY_SLOT_SAY, payRequestById } from '@/data/mock/disbursements'
import type { PaymentDetail } from '@/data/mock/detail'
import { EditableCard } from '@/features/shared/EditableCard'
import { HOLDER_LABEL, authorityFor, holderOf } from '@/data/holders'
import { appFlowOf, approvalEvents, decide as decideApproval, seatOptions, useApprovals } from '@/data/approvals/store'
import {
  flowEvents, flowOf, recommend, requestCompletion, saveStudy, useFlow,
} from '@/data/intake/flow'
import { RecommendationCard, RequestCloseCard, RequestDocsCard, RequestMetaCard } from './tabs/RequestCards'
import { StudyAside, StudyTab } from './tabs'
import { ApprovalTab, OfficialNotes } from './tabs/ApprovalTab'
import { TransferModal } from './TransferModal'
import { useQueryParams } from '@/hooks/useQueryParams'
import type { DecisionAction } from '@/types/domain'

/** Number of days the current process has been open - from the action log. */
const OPEN_DAYS = 87

/**
 * Project page - the system's central screen.
 *
 * The tab is part of the URL (`/projects/20940/entity`) so it can be shared and returned to, while
 * the side column is fixed context, not a tab - the quick read, the entity's projects, and the
 * latest action stay visible no matter which tab is active.
 */
/** The request's own content and the plan's phases · empty keys fall back to the fixture */
function ownContent(id: string): Partial<typeof fixtures.project> {
  const f = flowOf(id)
  const sent = f.versions.find((v) => v.values)?.values
  const plan = planOfProject(id)
  const out: Partial<typeof fixtures.project> = {}
  if (sent?.summary) out.idea = sent.summary
  if (f.objectives.length) { out.goals = f.objectives; out.outputs = f.objectives }
  if (plan?.phases.length) {
    out.phases = plan.phases.map((ph, i) => ({
      name: ph.name, tasks: ph.activities.map((a) => a.name).join('، ') || '—', months: `${ph.from} – ${ph.to}`,
      tone: i === plan.phases.length - 1 ? 'mute' : i < 2 ? 'teal' : 'lime',
    })) as typeof fixtures.project.phases
  }
  return out
}

export default function ProjectPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const mobile = useIsMobile()

  /**
   * The same project's row from the list.
   *
   * There's a single detailed fixture, so any other project opened from the list gets its header
   * and real numbers from its own row, while deeper details (goals, phases, log) stay from the
   * fixture until the backend supplies them.
   */
  const row = projectById(id ?? fixtures.project.id)

  const project = row
    ? {
        ...fixtures.project,
        id: row.id,
        name: row.name,
        track: row.track,
        field: row.field,
        goal: row.goal,
        tags: row.tags.length ? row.tags : fixtures.project.tags,
        region: row.region,
        city: row.city,
        amountRequested: row.amountRequested,
        amountTotal: row.amountRequested,
        amountGranted: row.amountGranted,
        weight: row.weight,
        score: row.score,
        beneficiaries: row.beneficiaries,
        durationDays: row.durationDays,
        /* The requested start date from the application form. The fixture used to return the same
           day for every project, so every screen read the same date. */
        startDate: addDays(row.submittedAt, 30),
        /* 5.2.10 · returned by the executive director, the project reads its own state */
        status: { label: appFlowOf(row.id).awaitingReview && row.holder === 'manager' ? 'بانتظار استكمال المراجعة' : row.stage, tone: groupTone(row.statusGroup) },
        /* Batch 7 · approvals#8 · the project's own idea, objectives and phases where it has them ·
           the request as sent, and the approved plan · the fixture stays the fallback for a seeded row */
        ...ownContent(row.id),
      }
    : fixtures.project

  const entityRow = row ? entityById(row.entityId) : undefined
  const entity = entityRow
    ? {
        ...fixtures.entity,
        id: entityRow.id,
        name: entityRow.name,
        type: entityRow.type,
        licensor: entityRow.licensor,
        region: entityRow.region,
        city: entityRow.city,
        licenseNo: entityRow.licenseNo,
        governance: entityRow.governance,
      }
    : fixtures.entity
  const { user: me, role } = useRole()
  useFlow()
  const { values: qv } = useQueryParams(['as'])
  /* `?as=entity` · the entity's view of its own request: its documents only, no internal ones */
  const asEntity = qv.as === 'entity'
  const flow = row ? flowOf(row.id) : undefined
  const closed = Boolean(flow?.closed)
  const waiting = row?.stage === 'استكمال بيانات المشروع'
  /* B-5 · the seat the project sits at decides the fan and the bar's buttons — not the signed-in
     role alone. Out of study, the fan shows the full path as passed. */
  const holder = row && !closed ? holderOf(row) : null
  const authority = row ? authorityFor(row.amountRequested, holder) : fixtures.authority
  useApprovals()
  useAgreements()
  /* A budget link changes what the seat may do (4.2.12) */
  useBudget()
  const seat = holder && row ? seatOptions(row, holder, role.key, me.name) : null
  /* A project waiting on the entity, or closed, has no decision for anyone (3.4.16 · 3.4.27) */
  const frozen = waiting || closed
  const user = frozen ? { ...me, actions: [] } : seat ? { ...me, actions: seat.actions } : me
  const studyEditable = role.key === 'supervisor' && holder === 'supervisor' && !frozen && row?.owner === me.name
  const [transfer, setTransfer] = useState(false)

  /* What each seat's button does (procedure 3) · the supervisor's recommendation forwards, never
     approves; a return goes back to the supervisor with its note */
  const decide = (a: DecisionAction, note: string, choice: string): string[] | void => {
    if (!row) return
    /* Above the supervisor, every seat's decision runs through the approval path (BPD-004–007) */
    if (holder && holder !== 'supervisor') return decideApproval(row, holder, a.label, note, choice, me.name)
    if (a.label === 'توصية بالموافقة' || a.label === 'توصية بالرفض' || a.label === 'أعد الإرسال لمدير المنح') {
      const want = a.label === 'توصية بالرفض' ? 'reject' : a.label === 'توصية بالموافقة' ? 'approve' : flowOf(row.id).study?.recommendation || 'approve'
      const s = flowOf(row.id).study
      if (s && s.recommendation !== want) saveStudy(row.id, { ...s, recommendation: want, by: me.name })
      return recommend(row.id, me.name)
    }
    if (a.label === 'طلب استكمال') { requestCompletion(row.id, note, me.name); return }
  }
  const intercept = (a: DecisionAction) => {
    if (a.label.startsWith('تحويل')) { setTransfer(true); return true }
    return false
  }
  const editState = holder
    ? holder === 'supervisor' ? 'دراسة المشروع' : holder
    : row?.stage === 'استكمال بيانات المشروع' ? row.stage
      : row?.statusGroup === 'في التشغيل' ? 'running' : 'done'

  /* The display code is the one the list shows (`PRJ-YYYY-NNNNN`), so a number copied from the
     list matches the project page everywhere. The raw id stays the URL key. */
  const code = projectCode(project.id, row?.year ?? '2026')
  const type = row?.type ?? 'مشروع عادي'
  const activities = useActivities(project.id)

  /* The entity's view never shows the supervisor's study (3.4.32) · its tab is dropped, and the
     view is kept across tab changes */
  const tabs = asEntity ? PROJECT_TABS.filter((t) => t.slug !== 'study' && t.slug !== 'approval') : PROJECT_TABS
  const active: ProjectTabSlug =
    tabs.find((t) => t.slug === tab)?.slug ?? DEFAULT_PROJECT_TAB

  const goTab = (slug: string) => navigate(`${ROUTES.projectTab(project.id, slug)}${asEntity ? `?as=entity` : ''}`)

  /* Process duration overrun is computed from the row itself when present, so the reading matches
     the department the project is actually in, not the fixture's department. */
  const rowBreach =
    row && row.stageLimit > 0 && row.hoursInStage > row.stageLimit
      ? {
          ...fixtures.project.log[0],
          action: 'تجاوز مدة الإجراء',
          dept: row.stage,
          by: row.owner ?? 'غير مُسنَد',
          hours: row.hoursInStage,
          limit: row.stageLimit,
          days: days(row.hoursInStage),
        }
      : undefined

  const breach = row ? rowBreach : project.log.find((l) => l.hours > l.limit)
  const openDays = row ? days(row.hoursInStage) : OPEN_DAYS

  /* Once the page reaches its end, the blur gradient under the decision bar fades out so the last
     section shows fully, with no haze over it. */
  const screen = useRef<HTMLDivElement>(null)
  /* The analytics column fills the remaining space from its position up to the decision bar. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const el = screen.current
    if (!el) return
    const check = () => setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
    check()
    el.addEventListener('scroll', check)
    window.addEventListener('resize', check)
    return () => {
      el.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  /* Note: the narrative is computed from the row itself, so it actually changes with the project's
     status. It's now combined with the file's readings into a single list - there used to be a
     "project journey" bar above the tabs and a "project analytics" card in the side column, both
     saying "stuck in project review for 87 days, 132% over the threshold" in two different
     phrasings. One place for the assistant on the screen. */
  /* Project details are derived from the row so every project in the demo is explorable, not just
     the single one baked into the fixture. */
  const baseDetail = useMemo(
    () => projectDetail(row ?? fixtures.projects[0], entity.name),
    [row, entity.name],
  )
  /* Re-audit 7 Oct · the payments tab reads the payment store's schedule · it read a generator */
  usePayments()
  const livePayments: PaymentDetail[] = scheduleOf(project.id).map((x) => {
    const r = x.requestId ? payRequestById(x.requestId) : undefined
    const paid = x.state === 'paid'
    /* Batch 2 · the order is issued once the manager passes the request to finance · it read «تمّت»
       on every payment, paid or not */
    return {
      no: x.no, amount: x.amount, date: paid ? r?.paidAt ?? x.dueAt : x.dueAt,
      status: paid ? 'مدفوع' : PAY_SLOT_SAY[x.state].label, voucher: paid ? r?.id : undefined,
      condition: x.condition, via: paid ? r?.bank?.name ?? (r ? 'حساب الجهة' : undefined) : undefined, receipt: paid && Boolean(r),
      authorized: paid || r?.state === 'finance', before: paid && !r,
    }
  })
  /* Follow-ups added from the tab join the project's own, so the tab and the log read one list. */
  const followUps = useFollowUps(project.id)
  const detail = useMemo(
    () => ({
      ...baseDetail,
      followUps: [
        ...followUps.list,
        ...baseDetail.followUps.filter((f) => !ACTIVITY_FOLLOW_TYPES.includes(f.type)),
      ],
    }),
    [baseDetail, followUps.list],
  )
  /* Field visits recorded as follow-ups in the current system are activities here: they show in
     the activities tab and the log's activity category, never under «المتابعات». */
  const activityList = useMemo(
    () =>
      [...activities.list, ...activitiesFromFollowUps(project.id, baseDetail.followUps)].sort(
        (a, b) => b.at.localeCompare(a.at) || b.time.localeCompare(a.time),
      ),
    [activities.list, project.id, baseDetail.followUps],
  )

  /* Note: eligibility for an agreement is computed here, not in the tab. The rule (rule 1) states
     no agreement before approval is complete and the allocation hold still stands - the reason is
     passed to the button so it appears in the `title` instead of a disabled button with no
     explanation. */
  usePlans()
  const planApproved = Boolean(row && row.amountGranted > 0 && !['دراسة المشروع', 'استكمال بيانات المشروع'].includes(row.stage) && row.statusGroup !== 'معتذر عنه')
  const planDecision = row ? planDecisionOf(row.id) : undefined
  const planBlock = !planApproved ? 'يُفتح بعد الاعتماد النهائي للمشروع'
    : planDecision && !planDecision.needs ? 'قرار مدير المنح: لا يتطلب خطة · يُعدَّل القرار أولًا'
      : planOfProject(project.id) && planOfProject(project.id)!.stage !== 'cancelled' ? 'للمشروع خطة' : ''
  const agreementBlock = useMemo(
    () => (row ? projectOptions().find((p) => p.id === row.id)?.blocked ?? '' : ''),
    [row],
  )

  /* A project that reached this stage - shown in the empty state so a reviewer sees the screen
     populated with one click instead of hunting for a suitable project. */
  const examples = useMemo(
    () => ({
      agreement: exampleWith(fixtures.projects, 'agreement', row?.id),
      payments: exampleWith(fixtures.projects, 'payments', row?.id),
    }),
    [row?.id],
  )

  /* The log is generated from the same details, so the updates, payments, and agreement shown in
     the tabs are exactly what's in the log - no second source. */
  const log = useMemo(
    /* Batch 7 · payments#26 · the log reads the payments store's schedule, like the tab · it read the
       generator's payments, so the log could disagree with the tab (21020) */
    () => projectLog({ row: row ?? fixtures.projects[0], entityName: entity.name, detail: { ...detail, payments: livePayments } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, entity.name, detail, livePayments.length, livePayments.filter((x) => x.status === 'مدفوع').length],
  )

  /* Manual activities join the same timeline, so the log stays the one place to read history. */
  const fullLog = useMemo(
    () => [...(row ? [...approvalEvents(row.id), ...flowEvents(row.id), ...planDecisionEvents(row.id)].sort((a, b) => b.at.localeCompare(a.at) || b.time.localeCompare(a.time)) : []), ...withActivities(log, activityList)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [log, activityList, row, flow?.events.length],
  )

  const analysis = useMemo(
    () => [
      ...(row ? readJourney(row, journeys.get(row.id)) : []),
      /* Cross · the readings of the reviewer's seat and of a project through Ehsan */
      ...(row && row.statusGroup === 'في الدراسة' && !asEntity ? projectAi(row) : []),
      ...(row && row.platform === 'منصة إحسان' && !asEntity ? ehsanAi(row) : []),
      ...readInsights(fixtures.insights),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row, asEntity, flow?.events.length],
  )

  return (
    <AppLayout
      assistantContext={assistFor.project({
        id: code,
        name: project.name,
        entity: entity.name,
      })}
    >
      <div className="viewstack hasdock">
        <div className="screen col hasg2" ref={screen}>
          {/* The path sits inside the body, not a separate header - and it's hierarchical, not
              chronological. */}
          <Crumbs
            items={[
              { label: 'المشاريع', to: ROUTES.projects },
              ...(active === 'data'
                ? [{ label: project.name }]
                : [
                    { label: project.name, to: ROUTES.project(project.id) },
                    { label: PROJECT_TABS.find((t) => t.slug === active)?.label ?? '' },
                  ]),
            ]}
          />

          {/* === Header - no surface, sits directly on the background === */}
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{project.name}</h1>

              <div className="pamt">
                <div className="lb">المبلغ المطلوب للدعم</div>
                <div className="v">
                  <Money sm>{project.amountRequested}</Money>
                </div>
                <div className="sub">
                  إجمالي المشروع <Num>{project.amountTotal}</Num> · تمويل كامل
                </div>
              </div>
            </div>

            <div className="pgates">
              <GateArc
                amount={project.amountRequested}
                authority={authority}
                compact={mobile}
                standing={
                  breach && {
                    by: breach.by,
                    days: openDays,
                    hours: breach.hours,
                    limit: breach.limit,
                    firstActionAt: '11-05-2026',
                  }
                }
              />
            </div>
          </header>

          <Tabs items={tabs} active={active} onChange={goTab} />

          <div className="g2">
            {/* === Main column === */}
            <div className="col">
              {active === 'data' && row && !asEntity && <RecommendationCard row={row} />}
              {/* BPD-011 · the routing decision under study, and an Ehsan project's own management after it */}
              {active === 'data' && row && !asEntity && (row.statusGroup === 'في الدراسة' || row.platform) && <RoutingCard row={row} />}
              {active === 'data' && row && !asEntity && row.platform && row.statusGroup !== 'في الدراسة' && <EhsanCard row={row} />}
              {/* 12.2.2 · the plan decision is part of the project's data */}
              {active === 'data' && row && !asEntity && planApproved && <PlanDecisionCard projectId={row.id} approved={planApproved} />}
              {active === 'approval' && row && <ApprovalTab row={row} />}
              {active === 'data' && row && asEntity && appFlowOf(row.id).official.length > 0 && (
                <OfficialNotes notes={appFlowOf(row.id).official} />
              )}
              {active === 'study' && row && (
                <StudyTab key={`${row.id}-${flow?.study?.version ?? 0}-${row.field}`} row={row} me={me.name} editable={studyEditable} />
              )}
              {active === 'data' && (
                <DataTab
                  hideAttachments={Boolean(row)}
                  project={project}
                  code={code}
                  /* Re-audit 7 Oct · the routing card and the data tab read the same type */
                  type={row?.partnerType === 'مستقل' ? `مشروع مستقل${row.platform ? ` · ${row.platform}` : ''}` : type}
                  entityName={entity.name}
                  entityId={String(entity.id)}
                  /* The latest action, not the latest event: updates share the same timeline, with
                     the row labeled "latest action" above it. */
                  last={log.find((e) => !e.followUp)}
                  onOpenLog={() => goTab('log')}
                  deps={{
                    agreements: detail.agreement ? 1 : 0,
                    payments: livePayments.length,
                  }}
                  chain={row ? projectChain(row) : undefined}
                />
              )}
              {active === 'data' && row && (
                <>
                  <RequestMetaCard row={row} me={me.name} canReschedule={!asEntity && !closed && ((role.key === 'supervisor' && row.owner === me.name) || role.key === 'grants-manager')} />
                  <RequestDocsCard row={row} me={me.name} asEntity={asEntity} canUpload={!closed && (asEntity ? waiting : true)} />
                  {!asEntity && (row.statusGroup === 'في الدراسة' || closed) ? <RequestCloseCard row={row} me={me.name} /> : null}
                </>
              )}
              {active === 'entity' && <EntityTab entity={entity} bank={project.bank} />}
              {active === 'history' && (
                <HistoryTab entity={entity} currentId={project.id} year={row?.year ?? '2026'} />
              )}
              {active === 'agreement' && viaEhsan(project.id) && <EhsanNoAgreement />}
              {active === 'agreement' && !viaEhsan(project.id) && agreementsOfProject(project.id).length > 0 && (
                <ProjectAgreements
                  list={agreementsOfProject(project.id)}
                  onAdditional={asEntity ? undefined : () => navigate(ROUTES.agreementNew(project.id))}
                  additionalBlock={agreementBlock || (projectOptions().find((x) => x.id === project.id)?.additional ? '' : 'تُضاف اتفاقية إضافية لمشروع له اتفاقية سارية')}
                />
              )}
              {active === 'agreement' && !viaEhsan(project.id) && agreementsOfProject(project.id).length === 0 && (
                <AgreementTab
                  agreement={null}
                  payments={livePayments}
                  entityName={entity.name}
                  example={examples.agreement}
                  onOpenExample={(x) => navigate(ROUTES.projectTab(x, 'agreement'))}
                  onStart={() => navigate(ROUTES.agreementNew(project.id))}
                  startBlocked={agreementBlock}
                />
              )}
              {/* Note: the plan tab is independent of the agreement, and both proceed in parallel -
                  the spec states this explicitly, and the tab answers "what's this project's plan"
                  while the inbox answers "what's on my desk". */}
              {active === 'plan' && row && !asEntity && <PlanDecisionCard projectId={row.id} approved={planApproved} />}
              {active === 'plan' && (
                <PlanTab
                  plan={planOfProject(project.id)}
                  granted={project.amountGranted || project.amountRequested}
                  onStart={asEntity ? undefined : () => navigate(ROUTES.planNew(project.id))}
                  /* The plan runs beside the agreement, not after it (12.2.3) · it opens on an
                     approved project the manager decided needs one */
                  startBlocked={planBlock}
                />
              )}
              {/* Note: closing is also its own independent tab - rule 16 states its stages don't
                  affect the project's status, so it's its own record - the tab answers "where's
                  this project's closing". */}
              {active === 'closing' && (
                <>
                  <CloseTab
                    row={closeOfProject(project.id)}
                    projectId={project.id}
                    onOpen={role.key === 'supervisor' ? () => { const out = openClosing(project.id, user.name); if (out.id) navigate(ROUTES.closing(out.id)) } : undefined}
                  />
                  <DistressCard projectId={project.id} />
                </>
              )}
              {active === 'payments' && (
                <PaymentsTab
                  payments={livePayments}
                  granted={project.amountGranted || project.amountRequested}
                  projectId={project.id}
                  paidBefore={livePayments.length ? 0 : paidToDate(project.id)}
                  example={examples.payments}
                  onOpenExample={(x) => navigate(ROUTES.projectTab(x, 'payments'))}
                />
              )}
              {active === 'follow-ups' && (
                <FollowUpsTab
                  projectId={project.id}
                  followUps={detail.followUps}
                  types={fixtures.followUpTypes}
                  me={user.name}
                  onAdd={followUps.add}
                />
              )}
              {active === 'activities' && (
                <ActivitiesTab
                  projectId={project.id}
                  me={user.name}
                  list={activityList}
                  onAdd={activities.add}
                />
              )}
              {active === 'log' && <LogTab events={fullLog} entityName={entity.name} />}
              {active === 'correspondence' && (
                <CorrespondenceTab
                  messages={detail.messages}
                  entityName={entity.name}
                  why={detail.threadWhy}
                />
              )}
              {/* What can change at this stage · in the main column, the end column is the assistant's alone */}
              <EditableCard module="project" state={editState} label={holder ? HOLDER_LABEL[holder] : row?.stage} />
            </div>

            {/* === Side column - one sticky card ===
                There used to be three cards: analytics, the entity's projects, and the latest
                action. The entity's projects moved to the "previous projects" tab, which is where
                that content belongs, and the latest action moved under the identification block.
                That leaves one card - and that's what makes the sticky behavior work without the
                problem the client rejected: a column with several sticky cards creates
                scroll-inside-scroll, while one card just takes its height and stays put. */}
            <div className="col aiside" ref={aside}>
              {active === 'study' && row ? (
                <StudyAside row={row} me={me.name} editable={studyEditable} />
              ) : (
              <AnalysisCard
                readings={analysis}
                onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              />
              )}
            </div>
          </div>
        </div>

        <DecisionBar
          user={user}
          project={{ name: project.name, amount: project.amountRequested }}
          compact={mobile}
          atEnd={atEnd}
          /* The grants manager links the project to a budget line as part of the decision. */
          hold={waiting ? 'بانتظار استكمال الجهة · الدراسة متوقفة حتى تعيد إرسال الطلب' : closed ? (flow?.closed?.kind === 'cancel' ? 'الطلب ملغى' : 'الطلب مؤرشف') : seat && (!seat.mine || seat.actions.length === 0) ? seat.say : undefined}
          onDecide={decide}
          intercept={intercept}
          context={holder === 'supervisor' && seat?.mine && flow?.study ? (
            <p className="sub cnote">
              التوصية المسجّلة: <b>{flow.study.recommendation === 'approve' ? 'الموافقة' : flow.study.recommendation === 'reject' ? 'الاعتذار' : 'لم تُحدَّد'}</b>
              {' · '}تُحال لمدير المنح ولا يترتب عليها اعتماد
            </p>
          ) : undefined}
          lead={(holder === 'committee' || holder === 'board') && seat?.mine ? (
            <Link className="btn btn-p" to={holder === 'committee' ? ROUTES.committee : ROUTES.board}>افتح الجلسة</Link>
          ) : ((role.key === 'grants-manager' && holder === 'manager') || (role.key === 'ceo' && holder === 'exec')) && seat?.mine ? (
            <BudgetLinkAction
              project={{
                id: project.id, name: project.name, year: row?.year ?? '2026-f',
                goal: row?.goal, amount: project.amountRequested,
              }}
            />
          ) : undefined}
        />
      </div>
      {transfer && row && <TransferModal row={row} me={me.name} onClose={() => setTransfer(false)} />}
    </AppLayout>
  )
}
