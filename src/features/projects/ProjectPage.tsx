import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GateArc, Money, Num, Tabs } from '@/components/ui'
import { DecisionBar, Crumbs } from '@/components/shell'
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
import { closeOfProject, openClose } from '@/data/mock/closing'
import { AnalysisCard } from '@/components/assistant'
import { readInsights, readJourney } from '@/data/readings'
import { exampleWith, projectDetail } from '@/data/mock/detail'
import { projectLog } from '@/data/mock/log'
import { projectOptions } from '@/data/mock/agreementNew'
import { projectChain } from '@/data/mock/chain'
import { planOfProject } from '@/data/mock/plans'
import { journeys } from '@/data/journey'
import { BudgetLinkAction } from '@/features/budget/BudgetLink'

/** Number of days the current process has been open - from the action log. */
const OPEN_DAYS = 87

/**
 * Project page - the system's central screen.
 *
 * The tab is part of the URL (`/projects/20940/entity`) so it can be shared and returned to, while
 * the side column is fixed context, not a tab - the quick read, the entity's projects, and the
 * latest action stay visible no matter which tab is active.
 */
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
        status: { label: row.stage, tone: groupTone(row.statusGroup) },
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
  const authority = fixtures.authority
  const { user, role } = useRole()

  /* The display code is the one the list shows (`PRJ-YYYY-NNNNN`), so a number copied from the
     list matches the project page everywhere. The raw id stays the URL key. */
  const code = projectCode(project.id, row?.year ?? '2026')
  const type = row?.type ?? 'مشروع عادي'
  const activities = useActivities(project.id)

  const active: ProjectTabSlug =
    PROJECT_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_PROJECT_TAB

  const goTab = (slug: string) => navigate(ROUTES.projectTab(project.id, slug))

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
    () => projectLog({ row: row ?? fixtures.projects[0], entityName: entity.name, detail }),
    [row, entity.name, detail],
  )

  /* Manual activities join the same timeline, so the log stays the one place to read history. */
  const fullLog = useMemo(() => withActivities(log, activityList), [log, activityList])

  const analysis = useMemo(
    () => [...(row ? readJourney(row, journeys.get(row.id)) : []), ...readInsights(fixtures.insights)],
    [row],
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

          <Tabs items={PROJECT_TABS} active={active} onChange={goTab} />

          <div className="g2">
            {/* === Main column === */}
            <div className="col">
              {active === 'data' && (
                <DataTab
                  project={project}
                  code={code}
                  type={type}
                  entityName={entity.name}
                  entityId={String(entity.id)}
                  /* The latest action, not the latest event: updates share the same timeline, with
                     the row labeled "latest action" above it. */
                  last={log.find((e) => !e.followUp)}
                  onOpenLog={() => goTab('log')}
                  deps={{
                    agreements: detail.agreement ? 1 : 0,
                    payments: detail.payments.length,
                  }}
                  chain={row ? projectChain(row) : undefined}
                />
              )}
              {active === 'entity' && <EntityTab entity={entity} bank={project.bank} />}
              {active === 'history' && (
                <HistoryTab entity={entity} currentId={project.id} year={row?.year ?? '2026'} />
              )}
              {active === 'agreement' && (
                <AgreementTab
                  agreement={detail.agreement}
                  payments={detail.payments}
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
              {active === 'plan' && (
                <PlanTab
                  plan={planOfProject(project.id)}
                  granted={project.amountGranted || project.amountRequested}
                  onStart={() => navigate(ROUTES.planNew(project.id))}
                  /* Same blocker as the agreement: no plan before approval is complete, since a
                     plan is measured against an approved grant amount. */
                  startBlocked={agreementBlock}
                />
              )}
              {/* Note: closing is also its own independent tab - rule 16 states its stages don't
                  affect the project's status, so it's its own record - the tab answers "where's
                  this project's closing". */}
              {active === 'closing' && (
                <CloseTab
                  row={closeOfProject(project.id)}
                  projectId={project.id}
                  onOpen={() => navigate(ROUTES.closing(openClose(project.id)))}
                />
              )}
              {active === 'payments' && (
                <PaymentsTab
                  payments={detail.payments}
                  granted={project.amountGranted || project.amountRequested}
                  projectId={project.id}
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
            </div>

            {/* === Side column - one sticky card ===
                There used to be three cards: analytics, the entity's projects, and the latest
                action. The entity's projects moved to the "previous projects" tab, which is where
                that content belongs, and the latest action moved under the identification block.
                That leaves one card - and that's what makes the sticky behavior work without the
                problem the client rejected: a column with several sticky cards creates
                scroll-inside-scroll, while one card just takes its height and stays put. */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                readings={analysis}
                onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              />
            </div>
          </div>
        </div>

        <DecisionBar
          user={user}
          project={{ name: project.name, amount: project.amountRequested }}
          compact={mobile}
          atEnd={atEnd}
          /* The grants manager links the project to a budget line as part of the decision. */
          lead={role.key === 'grants-manager' ? (
            <BudgetLinkAction
              project={{
                id: project.id, name: project.name, year: row?.year ?? '2026-f',
                goal: row?.goal, amount: project.amountRequested,
              }}
            />
          ) : undefined}
        />
      </div>
    </AppLayout>
  )
}
