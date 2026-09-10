import { useMemo, useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Icon, icons, Mono, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { initial } from '@/lib/format'
import { query } from '@/data/repository'
import { entityById } from '@/data/mock/entities'
import { entityDetail } from '@/data/mock/entityDetail'
import {
  DEFAULT_ENTITY_TAB, ENTITY_TABS, ROUTES, type EntityTabSlug,
} from '@/app/routes'
import { activationTone, governanceTone } from '@/lib/tone'
import { AnalysisCard } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'
import { EntityTotals } from './EntityTotals'
import { readEntity } from '@/data/readings'
import {
  EntityBanksTab, EntityDataTab, EntityDocsTab, EntityGoTo, EntityLogTab,
  EntityProjectsTab, EntityRecord,
} from './tabs'

/**
 * صفحة الجهة.
 *
 * الغرض منها سؤال واحد: أقدر أدي المشروع ده للجهة دي؟
 *
 * وعشان تجاوب عليه، لازم تعرض **ملف الجهة كامل** زي ما هو في النظام
 * العامل: ٣٥ حقلًا في خمس مجموعات، وثمانية مستندات بحالة وصلاحية كل
 * واحد، والحسابات البنكية بأسباب رفضها المقنّنة، وسجل قرارات الجهة.
 * قبل كده كانت بتعرض تسعة حقول بس، فالمشرف كان لازم يفتح النظام
 * القديم عشان يشوف الباقي.
 *
 * والتقسيم لتابات مش تنظيمًا: الملف الكامل في عمود واحد بيبقى تمريرًا
 * طويلًا، والمشرف بيدوّر على الحقل بدل ما يقراه.
 */
export default function EntityPage() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const entity = id ? entityById(id) : undefined

  const projects = useMemo(() => (id ? query.entityProjects(id) : []), [id])

  /* الكارت الجانبي بياخد المساحة الباقية لحدّ رصيف القرار — نفس
     حساب صفحة المشروع بالظبط، عشان الشكل واحد في الصفحتين. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, {
    varName: '--ai-fill',
    reserveSelector: '.decdock .chrome, .askfab',
    min: 240,
  })

  if (!entity) return <Navigate to={ROUTES.entities} replace />

  const active: EntityTabSlug =
    ENTITY_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_ENTITY_TAB
  const goTab = (slug: string) => navigate(ROUTES.entity(entity.id, slug))

  const detail = entityDetail(entity)
  const readings = readEntity(entity, projects, detail)

  return (
    <AppLayout assistantContext={assistFor.entity(entity)}>
      <div className="viewstack">
        <div className="screen col hasg2">
          <nav className="crumb" aria-label="مسار التنقّل">
            <Link to={ROUTES.entities} className="lb">الجهات</Link>
            <Icon path={icons.chevron} size={16} style={{ color: 'var(--t3)' }} />
            <span className="now">{entity.name}</span>
          </nav>

          {/* الترويسة بنفس تشكيل صفحة المشروع: الهوية على اليمين،
              والقراءة البصرية على الشمال في نفس مكان المروحة. */}
          <header className="phead">
            <div className="pmain">
              <div className="ehead-id">
                <span className="ec-init lg">{initial(entity.name)}</span>
                <div style={{ minWidth: 0 }}>
                  <h1 className="ptitle">{entity.name}</h1>
                  <div className="ehead-m sub">
                    <Mono>{entity.licenseNo}</Mono>
                    <span className="pc-dot" />
                    {entity.type}
                    <span className="pc-dot" />
                    <Icon path={icons.pinMap} size={14} /> {entity.region} · {entity.city}
                  </div>
                </div>
              </div>
              <div className="ehead-m" style={{ marginTop: '.9rem' }}>
                <Tag tone={activationTone(entity.activation)}>{entity.activation}</Tag>
                <Tag tone={governanceTone(entity.governance)}>الحوكمة: {entity.governance}</Tag>
                {/* الترخيص المنتهي بيوقف التعاقد، فمكانه الترويسة لا
                    جوّه تاب — القرار بيتاخد من فوق. */}
                {detail.licenseExpired && <Tag tone="no">الترخيص منتهٍ</Tag>}
                <span className="sub">{entity.licensor}</span>
              </div>
            </div>

            <div className="pgates">
              <EntityTotals entity={entity} />
            </div>
          </header>

          <Tabs items={ENTITY_TABS} active={active} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {active === 'data' && <EntityDataTab e={entity} d={detail} />}
              {active === 'docs' && <EntityDocsTab d={detail} />}
              {active === 'banks' && <EntityBanksTab d={detail} />}
              {active === 'projects' && <EntityProjectsTab rows={projects} />}
              {active === 'log' && <EntityLogTab d={detail} />}

              {/* السجل التراكمي والروابط تحت أي تاب: سياق دايم لا
                  محتوى تاب — المشرف محتاجه وهو بيقرا أي حاجة. */}
              <EntityRecord e={entity} />
              <EntityGoTo e={entity} />
            </div>

            {/* ═══ العمود الجانبي — كارت واحد لازق ═══ */}
            <div className="col aiside" ref={aside}>
              <AnalysisCard
                readings={readings}
                title="تحليلات الجهة السريعة"
                onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
