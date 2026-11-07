import { useNavigate } from 'react-router-dom'
import { ButtonLink, Icon, icons, Tabs } from '@/components/ui'
import { REPORT_TABS, ROUTES } from '@/app/routes'

/* Client 7 Nov · one header for every reports tab · the title, the two links and the tabs row are
   the same element in the same place whichever tab is open · only what is under them changes. The
   aggregated board («اللوحة المجمّعة») used to draw its own header without the links, so the row
   jumped up and back as the tabs were switched. */
export function ReportsHead({ active }: { active: string }) {
  const navigate = useNavigate()
  return (
    <>
      <header>
        <div>
          <h1 className="ptitle">التقارير</h1>
        </div>
        <div className="rowf gp-2">
          {/* 11.4.26 · 13.2.27 · the Ehsan projects and the sub-projects, marked by their kind */}
          <ButtonLink variant="2" to={ROUTES.partnersTab('report')}><Icon name={icons.link} />تقرير الشركاء</ButtonLink>
          <ButtonLink variant="2" to={ROUTES.glassBoard}><Icon name={icons.insight} />لوحة المؤشرات · تجريبية</ButtonLink>
        </div>
      </header>
      <Tabs items={REPORT_TABS} active={active} onChange={(s) => navigate(ROUTES.reportTab(s))} />
    </>
  )
}
