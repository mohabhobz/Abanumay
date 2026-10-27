import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, Glass, Head, Nil, Num, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { DockSlotProvider, useDockSlot } from '@/components/shell'
import { StageLimits } from '@/features/settings/CfgEdit'
import { CFG } from '@/lib/config'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { EVIDENCE_KINDS, PLAN_LIMIT, PLAN_STAGES, planRows } from '@/data/mock/plans'
import type { PlanStage } from '@/types/domain'
import { NOUN, nounAfter } from '@/lib/format'
import { PlanAuthTab } from './PlanAuthTab'
import { ACT_TIMING, ACT_TIMING_DEFAULT, saveActTiming, timingIssues } from '@/data/plans/timing'

/* Plan settings - D-1 and D-3.

   Note: every module carries its own settings and reports beneath it - the stated requirement:
   budget has its configuration, reports, and the budget itself underneath it; the same for
   projects; the same for entities.

   Two different kinds of data live here, and mixing them hides the difference:

     Evidence types - master data (D-3) - any dropdown list in the system belongs in settings, and a
     new type appears in every plan.
     Phase thresholds - a business rule - the number changes behavior: a plan past its threshold
     moves into "late" and enters the escalation report.

   Note: all these numbers are placeholders, and the screen states so. The spec gives no duration
   for any stage in the plan module - the same as the empty "target value" in the disbursement
   indicators. Presenting them as agreed-upon would let whoever builds on this assume they are.

   Note: the "used in" column isn't decoration. An evidence type with no usage means either it was
   added and never adopted, or it was removed from plans and left behind in the list - the number
   states this without anyone counting. */

const KEYS = ['tab'] as const
type Params = Record<(typeof KEYS)[number], string | undefined>

const TABS = [
  { slug: 'evidence', label: 'أنواع الشواهد' },
  { slug: 'timing', label: 'تأخّر الأنشطة وتعثّرها' },
  { slug: 'limits', label: 'حدود المراحل' },
  { slug: 'auth', label: 'صلاحية الاعتماد' },
] as const

export default function PlanSettingsPage() {
  const navigate = useNavigate()
  const { values: v, set } = useQueryParams<Params>(KEYS)
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : TABS[0].slug

  /** How many activities require this type - actual usage, not the count defined. */
  const usage = (kind: string) =>
    planRows.reduce(
      (s, p) => s + p.phases.reduce(
        (x, ph) => x + ph.activities.filter((a) => a.needs.includes(kind)).length, 0,
      ), 0,
    )

  /** How many plans currently sit at this stage. */
  const dock = useDockSlot()
  const atStage = (k: PlanStage) => planRows.filter((p) => p.stage === k).length

  return (
    <AppLayout assistantContext={assistFor.page('إعدادات الخطط')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <BackTo label="الخطط" onClick={() => navigate(ROUTES.plans)} />

          <header>
            <div>
              <h1 className="ptitle">إعدادات الخطط</h1>
            </div>
            <Tag tone="mute">قيم افتراضية</Tag>
          </header>

          <Tabs
            items={TABS}
            active={tab}
            onChange={(x) => set({ tab: x === TABS[0].slug ? undefined : x })}
          />

          {tab === 'timing' ? <ActTimingTab /> : tab === 'auth' ? <PlanAuthTab /> : tab === 'evidence' ? (
            <Glass className="tblcard">
              <Head
                title="أنواع الشواهد"
                meta={<span className="sub"><Num>{EVIDENCE_KINDS.length}</Num> {nounAfter(EVIDENCE_KINDS.length, NOUN.kind)}</span>}
              />
              {/* Note: the "note" column used to be all dots - a note is only written for a type no
                  plan has requested, so the column renders only when one exists. */}
              {/* Note: a name/value table sized to its content, not the card width - at full card
                  width, the value sat 1100px from its name. */}
              <table className="tbl">{/* audit UI-161 · the table fills its card like every list in the system */}
                <colgroup><col /><col />{EVIDENCE_KINDS.some((k) => usage(k) === 0) && <col />}</colgroup>
                <thead>
                  <tr>
                    <th><span className="th-t">النوع</span></th>
                    <th className="n"><span className="th-t">مستعمَل في</span></th>
                    {EVIDENCE_KINDS.some((k) => usage(k) === 0) && <th><span className="th-t">ملاحظة</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {EVIDENCE_KINDS.map((k) => {
                    const n = usage(k)
                    return (
                      <tr key={k}>
                        <td>{k}</td>
                        <td className="n">
                          {n > 0
                            ? <><span className="num">{n}</span> {nounAfter(n, NOUN.activity)}</>
                            : <span className="sub">لا شيء</span>}
                        </td>
                        {EVIDENCE_KINDS.some((kk) => usage(kk) === 0) && (
                          <td>
                            {n === 0
                              ? <span className="sub">معرَّف ولم تطلبه أي خطة</span>
                              : <Nil />}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Glass>
          ) : (
            <Glass className="tblcard">
              <Head
                title="حدود المحطات"
              />
              <StageLimits
                stages={PLAN_STAGES.map((x) => ({ key: x.key, label: x.label, who: x.who }))}
                limits={PLAN_LIMIT}
                cfgKey={CFG.planLimits}
                title="مدد مراحل الخطط"
                countAt={(k) => atStage(k as PlanStage)}
                unitLabel="الخطط فيها الآن"
              />
            </Glass>
          )}
        </div>
        {/* The unsaved-changes dock · inside the view stack, so it spans the content column like the decision bar, not the rail */}
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}

/* Client meeting 20 Oct (#35) · when an activity reads «متأخر» and when «متعثر» · in days after its
   planned end · the stall margin is never shorter than the delay margin, and the screen says so
   before it saves */
function ActTimingTab() {
  const [delay, setDelay] = useState(String(ACT_TIMING.delayDays))
  const [stall, setStall] = useState(String(ACT_TIMING.stallDays))
  const [said, setSaid] = useState('')
  const next = { delayDays: Number(delay), stallDays: Number(stall) }
  const issues = delay === '' || stall === '' ? ['أدخل المدتين'] : timingIssues(next)
  const dirty = next.delayDays !== ACT_TIMING.delayDays || next.stallDays !== ACT_TIMING.stallDays
  return (
    <Glass>
      <Head title="تأخّر الأنشطة وتعثّرها" meta={<span className="sub">الافتراضي <Num>{ACT_TIMING_DEFAULT.delayDays}</Num> و<Num>{ACT_TIMING_DEFAULT.stallDays}</Num> أيام</span>} />
      <div className="actcfg">
        <label className="regf">
          <span className="lb">مدة التأخير · بالأيام بعد تاريخ الانتهاء<b className="regf-r" aria-label="إلزامي">*</b></span>
          <span className="fld"><input inputMode="numeric" value={delay} onChange={(e) => { setDelay(e.target.value.replace(/[^\d]/g, '')); setSaid('') }} aria-label="مدة التأخير بالأيام" /></span>
        </label>
        <label className="regf">
          <span className="lb">مدة التعثّر · بالأيام بعد تاريخ الانتهاء<b className="regf-r" aria-label="إلزامي">*</b></span>
          <span className="fld"><input inputMode="numeric" value={stall} onChange={(e) => { setStall(e.target.value.replace(/[^\d]/g, '')); setSaid('') }} aria-label="مدة التعثّر بالأيام" aria-invalid={issues.length > 0} /></span>
        </label>
        <button type="button" className="btn btn-p" disabled={!dirty || issues.length > 0}
          onClick={() => { const e = saveActTiming(next); setSaid(e[0] ?? 'حُفظت المدد · تُقرأ بها حالة كل نشاط من الآن') }}>
          احفظ المدد
        </button>
      </div>
      {issues.length > 0 && <p className="bad cnote" role="alert">{issues.join(' · ')}</p>}
      {said && !issues.length && <p className="sub cnote" aria-live="polite">{said}</p>}
    </Glass>
  )
}
