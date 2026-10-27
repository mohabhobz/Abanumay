import { useState } from 'react'
import { FormField, FieldBox, Button, DateText, Glass, Head, Select, Tag } from '@/components/ui'
import { useRole } from '@/hooks/useRole'
import { readRole, ROLES, type RoleKey } from '@/data/roles'
import { BEHALF_LOG, currentBehalf, endBehalf, startBehalf } from '@/data/behalf'

/* Batch 8 · v3 0.def.16 · the system admin takes over a stalled step on another role's behalf ·
   the role and the reason are required · it runs until she ends it, and the audit log reads every
   action she takes inside it as «on behalf of» with the reason */
export function BehalfCard() {
  const { user } = useRole()
  const [role, setRole] = useState<RoleKey | ''>('')
  const [reason, setReason] = useState('')
  const [bad, setBad] = useState<string[]>([])
  if (readRole() !== 'admin' || currentBehalf()) return null
  const seats = ROLES.filter((r) => r.key !== 'admin')
  const past = BEHALF_LOG.filter((b) => b.to).slice(-3).reverse()
  return (
    <Glass>
      <Head title="تولّي إجراء متعثر" meta={<Tag tone="mute">مدير النظام</Tag>} />
      <div className="regfields">
        <Select label="الدور الأصلي" all="اختر الدور" value={role || undefined} options={seats.map((r) => ({ value: r.key, label: r.title }))} onChange={(v) => setRole((v ?? '') as RoleKey | '')} />
        <FormField label="السبب (إلزامي)"><FieldBox><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب التولّي" placeholder="مثل: غياب المستخدم المسؤول" /></FieldBox></FormField>
        <span className="rowf gp-2">
          <Button type="button" variant="2" size="sm" onClick={() => {
            const out = role ? startBehalf(role, reason, user.name) : ['اختر الدور الذي تتولاه']
            setBad(out)
          }}>ابدأ التولّي</Button>
        </span>
      </div>
      {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
      {past.length > 0 && (
        <p className="sub cnote">آخر التولّيات: {past.map((b) => `${ROLES.find((r) => r.key === b.role)?.title} · ${b.reason}`).join(' — ')}</p>
      )}
    </Glass>
  )
}

/** The running takeover, said on every screen · with its way out */
export function BehalfBar() {
  const { user } = useRole()
  const b = currentBehalf()
  if (!b || !user.behalf) return null
  return (
    <nav className="xs-etop glass" aria-label="تولّي إجراء نيابةً">
      <Tag tone="warn">نيابةً عن {user.behalf.role}</Tag>
      <span className="sub">{b.reason} · منذ <DateText>{b.from.slice(0, 10)}</DateText></span>
      <Button type="button" variant="2" size="sm" onClick={() => endBehalf()}>أنهِ التولّي</Button>
    </nav>
  )
}
