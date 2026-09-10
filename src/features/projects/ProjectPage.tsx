import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GateArc, Icon, icons, Mono, Num, Riyal, Tabs } from '@/components/ui'
import { DecisionBar } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useFillHeight } from '@/hooks/useFillHeight'
import { addDays, nf, projectCode } from '@/lib/format'
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
  AgreementTab, CorrespondenceTab, DataTab, EntityTab, FollowUpsTab,
  HistoryTab, LogTab, PaymentsTab,
} from './tabs'
import { QuickAnalysis } from './panels'
import { readInsights, readJourney } from '@/data/readings'
import { exampleWith, projectDetail } from '@/data/mock/detail'
import { projectLog } from '@/data/mock/log'
import { journeys } from '@/data/journey'

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

  /**
   * صف القائمة لنفس المشروع.
   *
   * الفيكستشر المفصّل واحد بس، فأي مشروع تاني من القائمة بيتفتح
   * بترويسته وأرقامه الحقيقية من الصف، والتفاصيل العميقة (الأهداف
   * والمراحل والسجل) بتفضل من الفيكستشر لحد ما الباك اند يرجّعها.
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
        /* تاريخ البدء المطلوب في نموذج التقديم. الفيكستشر كان بيدّي
           نفس اليوم لكل مشروع، فكل الشاشات كانت بتقول 12 أبريل. */
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
  const { user } = useRole()

  const active: ProjectTabSlug =
    PROJECT_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_PROJECT_TAB

  const goTab = (slug: string) => navigate(ROUTES.projectTab(project.id, slug))

  /* تجاوز مدة الإجراء بيتحسب من الصف نفسه لما يكون موجود، عشان
     القراءة تطابق القسم اللي المشروع واقف فيه فعلًا لا قسم الفيكستشر. */
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

  /* لما الصفحة توصل لآخرها، تدرّج البلور تحت شريط القرار بيروح
     عشان آخر سيكشن يبان كامل من غير ضبابة فوقه. */
  const screen = useRef<HTMLDivElement>(null)
  /* عمود التحليلات بيملا الباقي من مكانه لحدّ فوق شريط القرار */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock .chrome', min: 240 })
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

  /* السرد محسوب من الصف نفسه، فبيتغيّر مع حالة المشروع فعلًا.
     ومعاه قراءات الملف في **قائمة واحدة**: كان فيه شريط «رحلة
     المشروع» فوق التبويبات وكارت «تحليلات المشروع» في الجانبي،
     والاتنين بيقولوا «واقف عند دراسة المشروع من 87 يومًا، 132% فوق
     الحدّ» بصياغتين. مكان واحد للمساعد في الشاشة. */
  /* تفاصيل المشروع — مشتقّة من الصف عشان كل مشروع في النموذج يبقى
     قابلًا للتجربة، مش المشروع الواحد اللي في الفيكستشر. */
  const detail = useMemo(
    () => projectDetail(row ?? fixtures.projects[0], entity.name),
    [row, entity.name],
  )

  /* مشروع وصل للمرحلة — بيتعرض في الحالة الفارغة عشان الكلاينت
     يشوف الشاشة مليانة بضغطة بدل ما يدوّر على مشروع مناسب. */
  const examples = useMemo(
    () => ({
      agreement: exampleWith(fixtures.projects, 'agreement', row?.id),
      payments: exampleWith(fixtures.projects, 'payments', row?.id),
    }),
    [row?.id],
  )

  /* السجل مولَّد من نفس التفاصيل، فالمتابعات والدفعات والاتفاقية
     اللي في التابات هي بعينها اللي في السجل — مفيش مصدران. */
  const log = useMemo(
    () => projectLog({ row: row ?? fixtures.projects[0], entityName: entity.name, detail }),
    [row, entity.name, detail],
  )

  const analysis = useMemo(
    () => [...(row ? readJourney(row, journeys.get(row.id)) : []), ...readInsights(fixtures.insights)],
    [row],
  )

  return (
    <AppLayout
      assistantContext={assistFor.project({
        id: project.id,
        name: project.name,
        entity: entity.name,
      })}
    >
      <div className="viewstack hasdock">
        <div className="screen col" ref={screen}>
          {/* المسار جوّه البودي، مش في هيدر منفصل */}
          <nav className="crumb" aria-label="مسار التنقّل">
            <a onClick={() => navigate(ROUTES.projects)} className="lb">المشاريع</a>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="lb">دورة 2026 · {project.track}</span>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="now">مشروع <Mono>{projectCode(id ?? project.id, row?.year)}</Mono></span>
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
            {/* ═══ العمود الرئيسي ═══ */}
            <div className="col">
              {active === 'data' && (
                <DataTab
                  project={project}
                  entityName={entity.name}
                  onOpenEntity={() => goTab('entity')}
                  /* أحدث **إجراء** لا أحدث حدث: المتابعات في نفس
                     التايم لاين، والصف مكتوب فوقه «آخر إجراء». */
                  last={log.find((e) => !e.followUp)}
                  onOpenLog={() => goTab('log')}
                />
              )}
              {active === 'entity' && <EntityTab entity={entity} bank={project.bank} />}
              {active === 'history' && <HistoryTab entity={entity} currentId={project.id} />}
              {active === 'agreement' && (
                <AgreementTab
                  agreement={detail.agreement}
                  payments={detail.payments}
                  entityName={entity.name}
                  example={examples.agreement}
                  onOpenExample={(x) => navigate(ROUTES.projectTab(x, 'agreement'))}
                />
              )}
              {active === 'payments' && (
                <PaymentsTab
                  payments={detail.payments}
                  granted={project.amountGranted || project.amountRequested}
                  example={examples.payments}
                  onOpenExample={(x) => navigate(ROUTES.projectTab(x, 'payments'))}
                />
              )}
              {active === 'follow-ups' && (
                <FollowUpsTab followUps={detail.followUps} types={fixtures.followUpTypes} />
              )}
              {active === 'log' && <LogTab events={log} entityName={entity.name} />}
              {active === 'correspondence' && (
                <CorrespondenceTab
                  messages={detail.messages}
                  entityName={entity.name}
                  why={detail.threadWhy}
                />
              )}
            </div>

            {/* ═══ العمود الجانبي — كارت واحد لازق ═══
                كان تلات كروت: التحليلات ومشاريع الجهة وآخر إجراء.
                مشاريع الجهة اتنقلت لتبويب «المشاريع السابقة» اللي هي
                محتواه أصلًا، وآخر إجراء اتنقل تحت التعريف. فبقى كارت
                واحد — وده اللي بيخلّي اللزق يشتغل من غير المشكلة اللي
                رفضها العميل: عمود بكذا كارت لازق بياخد تمريرًا جوّه
                تمرير، وكارت واحد بياخد ارتفاعه ويقف. */}
            <div className="col aiside" ref={aside}>
              <QuickAnalysis
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
        />
      </div>
    </AppLayout>
  )
}
