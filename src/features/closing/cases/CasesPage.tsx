import { Link, useNavigate } from 'react-router-dom'
import { Button, BackTo, DateText, Empty, Glass, Head, Money, MultiSelect, Num, Tag } from '@/components/ui'
import { readList, useQueryParams, writeList } from '@/hooks/useQueryParams'
import { caseOutcome, outcomeMatches, outcomeOptions } from '@/data/shared/outcome'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import type { CaseKind } from '@/types/domain'
import {
  CASES, CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, recoveryLeft, useClosing,
} from '@/data/closing/store'

/* «حالات التعثر» · every stop and change of value, open ones first, with the money each still
   waits for (10.9). A case starts from the project page; this list is where the grants manager and
   the CEO find what's waiting on them and what's still being recovered. */

export default function CasesPage() {
  const navigate = useNavigate()
  useClosing()
  const { values: v, set } = useQueryParams(['res', 'kind'])
  const all = [...CASES].sort((a, b) => Number(a.stage === 'closed' || a.stage === 'rejected') - Number(b.stage === 'closed' || b.stage === 'rejected'))
  /* Client sheet 24 Oct (#95) · the case's outcome · مكتمل / مرفوض / ملغي, or still under way */
  const res = readList(v.res)
  /* #27 · the direct closings sit here too · a filter by the procedure */
  const kinds = readList(v.kind)
  const rows = all.filter((c) => outcomeMatches(caseOutcome(c.stage), res) && (!kinds.length || kinds.includes(c.kind)))
  return (
    <AppLayout assistantContext={assistFor.page('حالات التعثر')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
          <header>
            <div>
              <h1 className="ptitle">حالات التعثر</h1>
              <p className="sub mt-1"><Num>{all.length}</Num> حالة</p>
            </div>
          </header>
          <Glass className="ftoolbar">
            <div className="ftool-r">
              <div className="ftool-f">
                <MultiSelect
                  values={kinds}
                  all="كل الإجراءات"
                  options={(['stop', 'reduce', 'increase', 'direct'] as CaseKind[]).map((k) => ({ value: k, label: CASE_KIND_SAY[k] }))}
                  onChange={(x) => set({ kind: writeList(x) })}
                />
                <MultiSelect
                  values={res}
                  all="كل النتائج"
                  options={outcomeOptions(all, (c) => caseOutcome(c.stage))}
                  onChange={(x) => set({ res: writeList(x) })}
                />
              </div>
            </div>
          </Glass>
          <Glass>
            <Head title="الحالات" meta={res.length || kinds.length ? <span className="sub"><Num>{rows.length}</Num> من <Num>{all.length}</Num></span> : undefined} />
            {rows.length ? (
              <ul className="apv-list">
                {rows.map((c) => (
                  <li key={c.id}>
                    <span className="apv-t">
                      <b><Link className="tlink" to={ROUTES.distress(c.id)}>{c.id}</Link> · {CASE_KIND_SAY[c.kind]} · {c.projectName}</b>
                      <span className="sub">{c.entityName} · <DateText>{c.openedAt}</DateText>{c.recovery && recoveryLeft(c.recovery) > 0 ? <> · متبقٍّ للاسترداد <Money sm>{recoveryLeft(c.recovery)}</Money></> : null}</span>
                    </span>
                    <span className="pc-sp" />
                    <span className="rowf gp-2"><Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag><OutcomeTag outcome={caseOutcome(c.stage)} pending /></span>
                  </li>
                ))}
              </ul>
            ) : res.length || kinds.length
              ? <Empty title="لا حالات بهذه النتيجة." actions={<Button type="button" variant="2" onClick={() => set({ res: undefined, kind: undefined })}>مسح الفلتر</Button>} />
              : <Empty title="لا حالات تعثّر." />}
          </Glass>
        </div>
      </div>
    </AppLayout>
  )
}
