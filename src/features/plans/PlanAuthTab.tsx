import { useState } from 'react'
import { FieldMultiSelect, DateField, FieldSelect, Glass, Head, Icon, Tag, icons } from '@/components/ui'
import { PLAN_AUTH, delegationOf, savePlanAuth, type PlanAuth } from '@/data/plans/auth'
import { STAFF_ROLES, meOf, readRole, roleByKey, type RoleKey } from '@/data/roles'
import { liveDay } from '@/data/clock'

/* v3 · 12.2.11 · who approves a plan · the grants manager by default · and his delegations, each to
   a role until a date · the plan keeps the actual approver's name and that he approved by delegation.
   Only the holders in their own right edit this. */

const ROLE_OPTS = STAFF_ROLES.map((r) => ({ value: r.key, label: r.title }))

export function PlanAuthTab() {
  const role = readRole()
  const me = meOf(role)
  const can = PLAN_AUTH.approveBy.includes(role) || role === 'admin'
  const [d, setD] = useState<PlanAuth>(() => structuredClone(PLAN_AUTH))
  const [to, setTo] = useState<RoleKey | ''>('')
  const [until, setUntil] = useState('')
  const [said, setSaid] = useState('')
  const put = (next: PlanAuth) => { setD(next); savePlanAuth(next); setSaid('حُفظ') }
  return (
    <Glass>
      <Head title="صلاحية اعتماد الخطط" />
      <ul className="cfglist">
        <li className="itk-sup">
          <span className="cfgl"><b>يعتمد الخطة وطلبات تعديلها</b></span>
          <span className="pc-sp" />
          <FieldMultiSelect placeholder="لا أحد" values={d.approveBy} options={ROLE_OPTS} onChange={(x) => can && put({ ...d, approveBy: (x.length ? x : ['grants-manager']) as RoleKey[] })} />
        </li>
      </ul>
      <h4 className="fnd-h">التفويض</h4>
      {d.delegations.length === 0 && <p className="sub cnote">لا تفويض قائم.</p>}
      <ul className="apv-list">
        {d.delegations.map((x, i) => (
          <li key={`${x.to}-${i}`}>
            <Tag tone={x.until >= liveDay() ? 'ok' : 'mute'}>{x.until >= liveDay() ? 'نافذ' : 'منتهٍ'}</Tag>
            <span className="apv-t"><b>{roleByKey(x.to).title} حتى {x.until}</b><span className="sub">فوّضه {x.by} · {x.at}</span></span>
            <span className="pc-sp" />
            {can && <button type="button" className="iact" aria-label={`ألغِ تفويض ${roleByKey(x.to).title}`} title="ألغِ" onClick={() => put({ ...d, delegations: d.delegations.filter((_, j) => j !== i) })}><Icon name={icons.close} size="sm" /></button>}
          </li>
        ))}
      </ul>
      {can && (
        <div className="cfgrow">
          <FieldSelect value={to} label="المفوَّض" options={ROLE_OPTS.filter((o) => !d.approveBy.includes(o.value as RoleKey) && o.value !== 'supervisor')} onChange={(v) => setTo(v as RoleKey)} />
          <DateField value={until} onChange={setUntil} label="التفويض حتى" />
          <button type="button" className="btn btn-2 cfgadd" disabled={!to || !until || until < liveDay() || Boolean(to && delegationOf(to))} onClick={() => { if (!to) return; put({ ...d, delegations: [...d.delegations, { to, until, by: me, at: liveDay() }] }); setTo(''); setUntil('') }}>فوّض</button>
        </div>
      )}
      {!can && <p className="sub cnote">للاطلاع فقط.</p>}
      {said && <p className="sub cnote" aria-live="polite">{said}</p>}
    </Glass>
  )
}
