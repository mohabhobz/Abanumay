import { activationSay } from '@/data/shared/decisions'
import { useMemo, useRef } from 'react'
import { expiryAhead } from '@/data/shared/ai'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { EntityMark, Icon, icons, Mono, Tabs, Tag } from '@/components/ui'
import { Crumbs } from '@/components/shell'
import { PartnerCard } from '@/features/partners/parts'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { query } from '@/data/repository'
import { entityById } from '@/data/mock/entities'
import { entityDetail } from '@/data/mock/entityDetail'
import {
  DEFAULT_ENTITY_TAB, ENTITY_TABS, ROUTES, type EntityTabSlug,
} from '@/app/routes'
import { AnalysisCard } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'
import { EntityFlow } from './EntityFlow'
import { EntityRequestsTab, EntityStatusCard } from './EntityActions'
import { useEntityFlow } from '@/data/entities/store'
import { readEntity } from '@/data/readings'
import { entityCode } from '@/lib/format'
import {
  EntityBanksTab, EntityDataTab, EntityDocsTab, EntityGoTo, EntityLogTab,
  EntityProjectsTab, EntityRecord,
} from './tabs'

/**
 * Entity page.
 *
 * Its purpose is one question: can this project go to this entity?
 *
 * Answering it requires showing the entity's full file, as it exists in the live system: 35 fields
 * across five groups, eight documents each with its own status and validity, bank accounts with
 * their standardized rejection reasons, and the entity's decision log. This used to show only nine
 * fields, so a supervisor had to open the old system to see the rest.
 *
 * Splitting into tabs isn't organization for its own sake: the full file in one column becomes a
 * long scroll, and a supervisor ends up hunting for a field rather than reading it.
 */
export default function EntityPage() {
  useEntityFlow()
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const entity = id ? entityById(id) : undefined

  const projects = useMemo(() => (id ? query.entityProjects(id) : []), [id])

  /* The side card takes the remaining space up to the decision footer - the same calculation as the
     project page, so the layout matches across both. */
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, {
    varName: '--ai-fill',
    reserveSelector: '.decdock, .askfab',
    min: 240,
  })

  if (!entity) return <Navigate to={ROUTES.entities} replace />

  const active: EntityTabSlug =
    ENTITY_TABS.find((t) => t.slug === tab)?.slug ?? DEFAULT_ENTITY_TAB
  const goTab = (slug: string) => navigate(ROUTES.entity(entity.id, slug))

  const detail = entityDetail(entity)
  const ahead = expiryAhead(detail, entity)
  const readings = [...(ahead ? [ahead] : []), ...readEntity(entity, projects, detail)]

  return (
    <AppLayout assistantContext={assistFor.entity(entity)}>
      <div className="viewstack">
        <div className="screen col hasg2">
          {/* Note: the path is written with names, not derived from the URL. `/entities/755/banks`
              derived reads as "entities -> 755 -> banks", and only the page itself knows that 755
              is "Scientific Building Association". This is exactly the chain: entity -> bank
              account. */}
          <Crumbs
            items={[
              { label: 'الجهات', to: ROUTES.entities },
              ...(active === DEFAULT_ENTITY_TAB
                ? [{ label: entity.name }]
                : [
                    { label: entity.name, to: ROUTES.entity(entity.id) },
                    { label: ENTITY_TABS.find((t) => t.slug === active)?.label ?? '' },
                  ]),
            ]}
          />

          {/* The header follows the same layout as the project page: identity on the right, and the
              visual summary on the left in the same spot as the gauge - and `phead-g2` gives it the
              same `.g2` columns as the section below it, so the shape's edge lands exactly on the
              edge of "quick entity analytics" instead of a hand-picked width. */}
          <header className="phead phead-g2">
            <div className="pmain">
              <div className="ehead-id">
                <EntityMark logo={entity.logo} size="lg" />
                <div style={{ minWidth: 0 }}>
                  <h1 className="ptitle">{entity.name}</h1>
                  {/* Code and classification lead: they are the entity's identity in the list too,
                      under the same names, so the two screens read as one record. */}
                  <div className="ehead-m sub">
                    <Mono>{entityCode(entity.id, entity.registeredAt)}</Mono>
                    <span className="pc-dot" />
                    <span>تصنيف الجهة: <b className="ehead-v">{entity.type}</b></span>
                    <span className="pc-dot" />
                    <span>الترخيص <Mono>{entity.licenseNo}</Mono></span>
                    <span className="pc-dot" />
                    <Icon name={icons.pinMap} size="sm" /> {entity.region} · {entity.city}
                  </div>
                </div>
              </div>
              <div className="ehead-m mt-4">
                {/* The page header isn't a card's status field - tags here are neutral, and colored
                    detail lives in the tab cards. */}
                <Tag tone="mute">{entity.archived ? 'مؤرشفة' : activationSay(entity.activation)}</Tag>
                <Tag tone="mute">الحوكمة: {entity.governance}</Tag>
                {/* An expired license blocks contracting, so it belongs in the header, not inside a
                    tab - the decision is made from the top. */}
                {detail.licenseExpired && <Tag tone="mute">الترخيص منتهٍ</Tag>}
                <span className="sub">{entity.licensor}</span>
              </div>
            </div>

            {/* The visual sits in the left column facing identity - same position as the gauge on
                the project page. */}
            <EntityFlow entity={entity} />
          </header>

          <Tabs items={ENTITY_TABS} active={active} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {active === 'data' && <EntityStatusCard e={entity} />}
              {active === 'data' && <PartnerCard entityId={entity.id} />}
              {active === 'data' && <EntityDataTab e={entity} d={detail} />}
              {active === 'docs' && <EntityDocsTab d={detail} entityId={entity.id} />}
              {active === 'banks' && <EntityBanksTab d={detail} entityId={entity.id} />}
              {active === 'projects' && <EntityProjectsTab rows={projects} />}
              {active === 'requests' && <EntityRequestsTab e={entity} />}
              {active === 'log' && <EntityLogTab d={detail} entityId={entity.id} />}

              {/* The running log and links sit below every tab: persistent context, not tab content
                  - a supervisor needs it while reading anything. */}
              <EntityRecord e={entity} />
              <EntityGoTo e={entity} />
            </div>

            {/* Side column - one sticky card */}
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
