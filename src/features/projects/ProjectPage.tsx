import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GateArc, Icon, icons, Mono, Num, Riyal, Tabs } from '@/components/ui'
import { DecisionBar } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { nf } from '@/lib/format'
import { fixtures } from '@/data/repository'
import { assistFor } from '@/data/mock/assistant'
import {
  DEFAULT_PROJECT_TAB, PROJECT_TABS, ROUTES, type ProjectTabSlug,
} from '@/app/routes'
import {
  AgreementTab, CorrespondenceTab, DataTab, EntityTab, FollowUpsTab,
  HistoryTab, LogTab, PaymentsTab,
} from './tabs'
import { EntityProjectsPanel, LastActionPanel, QuickAnalysis } from './panels'

/** عدد الأيام اللي الإجراء الحالي مفتوح فيها — من سجل الإجراءات */
const OPEN_DAYS = 87

/**
 * صفحة المشروع — الشاشة المحورية في النظام.
 *
 * التبويب جزء من الـURL (`/projects/20940/entity`) عشان يتشارك ويترجع
 * له، والعمود الجانبي سياق ثابت مش تبويب — القراءة السريعة ومشاريع
 * الجهة وآخر إجراء بتفضل ظاهرة مهما اتنقّلت بين التبويبات.
 */
export default function ProjectPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const project = fixtures.project
  const entity = fixtures.entity
  const authority = fixtures.authority
  const user = fixtures.currentUser

  const active: ProjectTabSlug =
    PROJECT_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_PROJECT_TAB

  const goTab = (slug: string) => navigate(ROUTES.projectTab(project.id, slug))

  const breach = project.log.find((l) => l.hours > l.limit)

  /* لما الصفحة توصل لآخرها، تدرّج البلور تحت شريط القرار بيروح
     عشان آخر سيكشن يبان كامل من غير ضبابة فوقه. */
  const screen = useRef<HTMLDivElement>(null)
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

  return (
    <AppLayout
      assistantContext={assistFor.project({
        id: project.id,
        name: project.name,
        entity: entity.name,
      })}
    >
      <div className="viewstack">
        <div className="screen col" ref={screen}>
          {/* المسار جوّه البودي، مش في هيدر منفصل */}
          <nav className="crumb" aria-label="مسار التنقّل">
            <a onClick={() => navigate(ROUTES.projects)} className="lb">المشاريع</a>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="lb">دورة ٢٠٢٦ · {project.track}</span>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="now">مشروع <Mono>{id ?? project.id}</Mono></span>
          </nav>

          {/* ═══ الترويسة — بلا سطح، بتقعد على الخلفية مباشرة ═══ */}
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{project.name}</h1>

              <div className="pamt">
                <div className="lb">المبلغ المطلوب للدعم</div>
                <div className="v num">
                  {nf.format(project.amountRequested)}
                  <small><Riyal /></small>
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
                    days: OPEN_DAYS,
                    hours: breach.hours,
                    limit: breach.limit,
                    firstActionAt: '١١-٠٥-٢٠٢٦',
                  }
                }
              />
            </div>
          </header>

          <Tabs items={PROJECT_TABS} active={active} onChange={goTab} />

          <div className="g2">
            {/* ═══ العمود الرئيسي ═══ */}
            <div className="col">
              {active === 'data' && (
                <DataTab
                  project={project}
                  entityName={entity.name}
                  onOpenEntity={() => goTab('entity')}
                />
              )}
              {active === 'entity' && <EntityTab entity={entity} bank={project.bank} />}
              {active === 'history' && <HistoryTab entity={entity} currentId={project.id} />}
              {active === 'agreement' && <AgreementTab />}
              {active === 'payments' && <PaymentsTab />}
              {active === 'follow-ups' && (
                <FollowUpsTab project={project} types={fixtures.followUpTypes} />
              )}
              {active === 'log' && <LogTab project={project} />}
              {active === 'correspondence' && (
                <CorrespondenceTab project={project} entityName={entity.name} />
              )}
            </div>

            {/* ═══ العمود الجانبي — سياق ثابت ═══ */}
            <div className="col">
              <QuickAnalysis
                breach={breach}
                insights={fixtures.insights}
                openDays={OPEN_DAYS}
                onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              />
              <EntityProjectsPanel entity={entity} onOpen={() => goTab('history')} />
              <LastActionPanel entry={project.log[0]} onOpen={() => goTab('log')} />
            </div>
          </div>
        </div>

        <DecisionBar
          user={user}
          project={{ name: project.name, amount: project.amountRequested }}
          compact={mobile}
          atEnd={atEnd}
        />
      </div>
    </AppLayout>
  )
}
