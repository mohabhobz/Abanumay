import { Link, useNavigate } from 'react-router-dom'
import { BackTo, DateText, Empty, Glass, Head, Money, Num, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import {
  CASES, CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, recoveryLeft, useClosing,
} from '@/data/closing/store'

/* «حالات التعثر» · every stop and change of value, open ones first, with the money each still
   waits for (10.9). A case starts from the project page; this list is where the grants manager and
   the CEO find what's waiting on them and what's still being recovered. */

export default function CasesPage() {
  const navigate = useNavigate()
  useClosing()
  const rows = [...CASES].sort((a, b) => Number(a.stage === 'closed' || a.stage === 'rejected') - Number(b.stage === 'closed' || b.stage === 'rejected'))
  return (
    <AppLayout assistantContext={assistFor.page('حالات التعثر')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
          <header>
            <div>
              <h1 className="ptitle">حالات التعثر</h1>
              <p className="sub mt-1">إيقاف المشاريع وتعديل قيمها والمبالغ المستردة · <Num>{rows.length}</Num> حالة</p>
            </div>
          </header>
          <Glass>
            <Head title="الحالات" />
            {rows.length ? (
              <ul className="apv-list">
                {rows.map((c) => (
                  <li key={c.id}>
                    <span className="apv-t">
                      <b><Link className="tlink" to={ROUTES.distress(c.id)}>{c.id}</Link> · {CASE_KIND_SAY[c.kind]} · {c.projectName}</b>
                      <span className="sub">{c.entityName} · <DateText>{c.openedAt}</DateText>{c.recovery && recoveryLeft(c.recovery) > 0 ? <> · متبقٍّ للاسترداد <Money sm>{recoveryLeft(c.recovery)}</Money></> : null}</span>
                    </span>
                    <span className="pc-sp" />
                    <Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag>
                  </li>
                ))}
              </ul>
            ) : <Empty title="لا حالات تعثّر." note="تُفتح الحالة من تبويب الإغلاق في صفحة المشروع." />}
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}
