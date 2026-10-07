import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, MultiSelect, Num, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { CFG, persist } from '@/lib/config'
import { AGR_LIMIT } from '@/data/mock/agreements'
import { PAY_LIMIT } from '@/data/mock/disbursements'
import { CLOSE_LIMIT } from '@/data/mock/closing'
import { PLAN_LIMIT } from '@/data/mock/plans'
import { STAGES } from '@/data/mock/taxonomy'
import {
  CHANNEL_SAY, ESC_LIMITS, ESC_PROCS, ESC_RULES, RECIPIENT_SAY, saveEscRules,
  type EscChannel, type EscLevel, type EscProc, type EscRecipient, type EscRules,
} from '@/data/shared/escRules'
import { escCounts, escStages } from '@/data/shared/escalation'
import { CfgNum } from '@/features/settings/CfgEdit'
import { useAllStores } from './useAllStores'

/* Escalation settings · cross «التصعيد», clauses 1, 2 and 4.

   One page for the mechanism the thirteen procedures share: each stage's days, the margin before
   «متأخر» becomes «متعثر», and who the two alert levels reach on which channel. Clause 4 makes it
   the system admin's directly, with no approval path: she saves and it applies · everyone else
   reads the same page without fields, so the numbers a report is built on are never hidden.

   A stage's days were scattered over five settings pages and the code (the budget, registration,
   the approval seats and the partners had none at all). They are all here now, and each module's
   own settings page keeps editing its own as before · both write the same table. */

const RCPT = (Object.keys(RECIPIENT_SAY) as EscRecipient[]).map((k) => ({ value: k, label: RECIPIENT_SAY[k] }))
const CHNL = (Object.keys(CHANNEL_SAY) as EscChannel[]).map((k) => ({ value: k, label: CHANNEL_SAY[k] }))

type Days = Record<string, number>
const allDays = (): Days => Object.fromEntries(ESC_PROCS.flatMap((p) => escStages(p.key)).map((s) => [s.key, Math.round(s.hours / 24)]))
const rulesNow = (): EscRules => structuredClone({ stuck: ESC_RULES.stuck, late: ESC_RULES.late, stalled: ESC_RULES.stalled })

function persistLimits(): void {
  persist(CFG.agrLimits, AGR_LIMIT)
  persist(CFG.payLimits, PAY_LIMIT)
  persist(CFG.closeLimits, CLOSE_LIMIT)
  persist(CFG.planLimits, PLAN_LIMIT)
  persist(CFG.escLimits, ESC_LIMITS)
  persist(CFG.stageLimits, Object.fromEntries(STAGES.filter((s) => s.limit > 0).map((s) => [s.stage, s.limit])))
}

export default function EscalationSettingsPage() {
  useAllStores()
  const dock = useDockSlot()
  const { role, user } = useRole()
  const admin = role.key === 'admin'
  const [savedDays, setSavedDays] = useState<Days>(allDays)
  const [days, setDays] = useState<Days>(savedDays)
  const [saved, setSaved] = useState<EscRules>(rulesNow)
  const [d, setD] = useState<EscRules>(saved)
  const counts = escCounts()

  const dayChanges = Object.keys(days).filter((k) => days[k] !== savedDays[k])
  const ruleDirty = JSON.stringify(d) !== JSON.stringify(saved)
  const changes = dayChanges.length + (ruleDirty ? 1 : 0)

  const save = () => {
    for (const p of ESC_PROCS) for (const s of escStages(p.key)) if (days[s.key] !== savedDays[s.key]) s.set(days[s.key] * 24)
    persistLimits()
    saveEscRules(d, user.name)
    setSavedDays(days)
    setSaved(structuredClone(d))
  }
  const discard = () => { setDays(savedDays); setD(saved) }
  const putLevel = (k: 'late' | 'stalled', v: Partial<EscLevel>) => setD((x) => ({ ...x, [k]: { ...x[k], ...v } }))
  const putStuck = (p: EscProc, v: number | null) => setD((x) => ({ ...x, stuck: { ...x.stuck, [p]: v } }))

  const level = (k: 'late' | 'stalled', title: string, note: string) => (
    <li className="itk-sup">
      <span className="cfgl"><b>{title}</b><span className="sub">{note}</span></span>
      <span className="pc-sp" />
      {admin ? (
        <span className="rowf gp-2">
          <MultiSelect label={`مستلمو ${title}`} all="اختر المستلمين" values={d[k].to} options={RCPT} onChange={(v) => putLevel(k, { to: v.length ? (v as EscRecipient[]) : d[k].to })} />
          <MultiSelect label={`قنوات ${title}`} all="اختر القنوات" values={d[k].channels} options={CHNL} onChange={(v) => putLevel(k, { channels: v.includes('app') ? (v as EscChannel[]) : (['app', ...v] as EscChannel[]) })} />
        </span>
      ) : (
        <span className="sub">{d[k].to.map((r) => RECIPIENT_SAY[r]).join('، ')} · {d[k].channels.map((c) => CHANNEL_SAY[c]).join('، ')}</span>
      )}
    </li>
  )

  return (
    <AppLayout assistantContext={assistFor.page('آلية التصعيد')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">آلية التصعيد</h1>
              <p className="sub mt-1">
                مدد المراحل في جميع الإجراءات ومستويات التنبيه · يحرّرها مدير النظام مباشرة بلا مسار موافقات
                {ESC_RULES.savedAt && <> · آخر حفظ <DateText>{ESC_RULES.savedAt}</DateText>{ESC_RULES.savedBy ? ` · ${ESC_RULES.savedBy}` : ''}</>}
              </p>
            </div>
            <div className="rowf gp-2">
              {!admin && <Tag tone="mute">للاطلاع · يحرّرها مدير النظام</Tag>}
              <Link className="btn btn-2 btn-sm" to={ROUTES.escalation}>تقرير المتأخر والمتعثر</Link>
            </div>
          </header>

          <Glass>
            <Head title="مستويات التنبيه" meta={<span className="sub">داخل النظام إلزامي في المستويين</span>} />
            <ul className="cfglist">
              {level('late', 'المستوى الأول · متأخر', 'تنبيه مرة واحدة يوم تجاوز مدة المرحلة')}
              {level('stalled', 'المستوى الثاني · متعثر', 'تنبيه يومي متكرر حتى اتخاذ الإجراء أو انتقال المرحلة')}
            </ul>
          </Glass>

          {ESC_PROCS.map((p) => {
            const stages = escStages(p.key)
            const c = counts[p.key] ?? { late: 0, stuck: 0 }
            const n = d.stuck[p.key]
            return (
              <Glass key={p.key} className="tblcard">
                <Head
                  title={p.label}
                  meta={<span className="sub"><bdi>{p.bpd}</bdi> · الآن <Num>{c.late}</Num> متأخر و<Num>{c.stuck}</Num> متعثر</span>}
                />
                <ul className="cfglist">
                  <li className="itk-sup">
                    <span className="cfgl"><b>يصير الطلب متعثرًا</b><span className="sub">بعد تجاوز مدة المرحلة بعدد من الأيام · أو عند ضعفها</span></span>
                    <span className="pc-sp" />
                    {admin ? (
                      <span className="rowf gp-2">
                        <span className="cfgchips xs-chips" role="radiogroup" aria-label={`قاعدة التعثر في ${p.label}`}>
                          <button type="button" role="radio" aria-checked={n === null} className={`cfgchip${n === null ? ' on' : ''}`} onClick={() => putStuck(p.key, null)}>ضعف المدة</button>
                          <button type="button" role="radio" aria-checked={n !== null} className={`cfgchip${n !== null ? ' on' : ''}`} onClick={() => putStuck(p.key, n ?? 7)}>أيام إضافية</button>
                        </span>
                        {n !== null && <CfgNum value={n} min={1} label={`أيام التعثر في ${p.label}`} suffix="يومًا" onChange={(x) => putStuck(p.key, Math.max(1, x))} />}
                      </span>
                    ) : (
                      <span className="sub">{n === null ? 'عند ضعف مدة المرحلة' : <>بعد <Num>{n}</Num> يومًا إضافية</>}</span>
                    )}
                  </li>
                </ul>
                <div className="tblwrap">
                  <table className="tbl cfgtbl" aria-label={`مدد مراحل ${p.label}`}>
                    <thead>
                      <tr>
                        <th><span className="th-t">المرحلة</span></th>
                        <th><span className="th-t">المسؤول</span></th>
                        <th className="n"><span className="th-t">المدة بالأيام</span></th>
                        <th className="n"><span className="th-t">متعثر بعد</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stages.map((s) => (
                        <tr key={s.key}>
                          <td>{s.label}</td>
                          <td className="sub">{s.who}</td>
                          <td className="n">
                            {admin
                              ? <CfgNum value={days[s.key]} min={1} label={`مدة ${s.label} بالأيام`} onChange={(x) => setDays((y) => ({ ...y, [s.key]: Math.max(1, x) }))} />
                              : <Num>{days[s.key]}</Num>}
                          </td>
                          <td className="n"><Num>{days[s.key] + (n === null ? days[s.key] : n)}</Num></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Glass>
            )
          })}

          {admin && changes > 0 && (
            <SaveBar
              count={changes}
              sentence={<>تعديلات على آلية التصعيد<span className="decsep" /><span className="sub">تُطبَّق فور الحفظ على الاحتساب والتنبيهات والتقارير</span></>}
              onSave={save}
              onDiscard={discard}
            />
          )}
        </div>
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}
