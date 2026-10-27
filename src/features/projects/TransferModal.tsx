import { useState } from 'react'
import { FormField, FieldBox, Modal, ModalHead, Button, FieldSelect, icons, Person } from '@/components/ui'
import type { ProjectRow } from '@/types/domain'
import { CYCLE } from '@/data/intake/cycle'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { transferProject } from '@/data/intake/flow'
import { readRole } from '@/data/roles'
import { rehouseProject, reownProject } from '@/data/approvals/store'

/* Transfer a project to another domain or supervisor (3.4.20 · 3.4.21).

   Client 24 Oct (#90) · two different changes, said apart:
   - «مشرف المنح فقط» · another supervisor of the same domain · the domain, its track and goal stay as
     they are, and so does the study made so far
   - «المجال» · the track, the domain and the goal move together and the goal is picked again, and a
     new domain takes one of its own supervisors · from the supervisor's study seat this is the
     transfer (the study moves to «دراسات سابقة»); at the grants manager's seat it is re-housing
     (#82) · the project stays with him and its financial link is redistributed on the new goal's line

   The reason is required in both, and the log keeps the before and after. */

export type TransferMode = 'transfer' | 'owner' | 'rehouse'

export function TransferModal({ row, me, onClose, mode = 'transfer' }: { row: ProjectRow; me: string; onClose: () => void; mode?: TransferMode }) {
  const [kind, setKind] = useState<'owner' | 'field'>(mode === 'rehouse' ? 'field' : 'owner')
  const [track, setTrack] = useState(row.track)
  const [field, setField] = useState(row.field)
  const [goal, setGoal] = useState(row.goal)
  const fields = FIELDS_BY_TRACK[track] ?? []
  const goals = GOALS_BY_FIELD[field] ?? []
  const sups = CYCLE.domains[kind === 'owner' ? row.field : field]?.supervisors ?? []
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const [said, setSaid] = useState<string[]>([])
  const fieldMoved = field !== row.field
  /* a transfer always lands with someone who studies it · re-housing within the domain may keep him */
  const ownerNeeded = kind === 'owner' || mode === 'transfer' || fieldMoved
  const changed = kind === 'owner'
    ? Boolean(owner) && owner !== row.owner
    : field !== row.field || goal !== row.goal || track !== row.track || (Boolean(owner) && owner !== row.owner)
  const ok = Boolean(reason.trim()) && changed && (kind === 'owner'
    ? Boolean(owner)
    : Boolean(track && field && goal && goals.includes(goal)) && (!ownerNeeded || Boolean(owner)))
  const title = mode === 'rehouse' ? 'إعادة تسكين المشروع' : mode === 'owner' ? 'تعديل مشرف المنح' : 'تحويل المشروع'

  const submit = () => {
    const w = kind === 'owner'
      ? reownProject(row, owner, reason, me, readRole())
      : mode === 'rehouse'
        ? rehouseProject(row, { track, field, goal, owner: owner || undefined }, reason, me)
        : (transferProject(row.id, field, owner, reason.trim(), me, track, goal), [])
    setSaid(w)
    if (!w.length) onClose()
  }

  return <Modal label={title} onClose={onClose} escape>
        <ModalHead icon={icons.send} title={title} />
        <div className="mb col">
          <p className="sub cnote">{row.name} · في مجال «{row.field}» عند {row.owner ? <Person name={row.owner} /> : 'بلا مشرف'}</p>
          {mode === 'transfer' && (
            <FormField label="ما الذي يتغيّر؟" as="div">
              <div className="cfgchips" role="radiogroup" aria-label="نوع التعديل">
                {(['owner', 'field'] as const).map((k) => (
                  <Button plain key={k} type="button" role="radio" aria-checked={kind === k} className={`cfgchip${kind === k ? ' on' : ''}`}
                    onClick={() => { setKind(k); setOwner(''); setTrack(row.track); setField(row.field); setGoal(row.goal) }}>
                    {k === 'owner' ? 'مشرف المنح فقط' : 'المجال (ومعه المشرف)'}
                  </Button>
                ))}
              </div>
            </FormField>
          )}
          {kind === 'field' && (
            <>
              <FormField label="المسار" required>
                <FieldSelect value={track} label="المسار" options={[...TRACKS]} onChange={(v) => { setTrack(v); setField(''); setGoal(''); setOwner('') }} />
              </FormField>
              <FormField label="المجال" required>
                <FieldSelect value={field} label="المجال" options={fields} placeholder="اختر" onChange={(v) => { setField(v); setGoal(''); setOwner('') }} />
              </FormField>
              <FormField label="الهدف" required>
                <FieldSelect value={goal} label="الهدف" options={goals} placeholder={field ? 'اختر' : 'اختر المجال أولًا'} disabled={!field} onChange={setGoal} />
              </FormField>
            </>
          )}
          <FormField label={kind === 'owner' ? 'مشرف المجال نفسه' : 'مشرف المجال'} required={ownerNeeded}>
            <FieldSelect
              value={owner}
              label="مشرف المجال"
              options={kind === 'owner' ? sups.filter((x) => x !== row.owner) : sups}
              placeholder={sups.length ? (ownerNeeded ? 'اختر' : 'يبقى المشرف الحالي') : 'لا مشرف لهذا المجال'}
              disabled={sups.length === 0}
              onChange={setOwner}
            />
          </FormField>
          <FormField label="السبب" required>
            <FieldBox><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب التحويل" placeholder={kind === 'owner' ? 'مثال: توزيع الأحمال بين مشرفي المجال' : 'مثال: المشروع صحي لا تعليمي'} /></FieldBox>
          </FormField>
          {said.map((x) => <p key={x} className="bad cnote">{x}</p>)}
        </div>
        <div className="mf">
          <Button variant="p" disabled={!ok} onClick={submit}>
            {kind === 'owner' ? 'عدّل المشرف' : mode === 'rehouse' ? 'أعد التسكين' : 'حوّل المشروع'}
          </Button>
          <Button variant="2" onClick={onClose}>تراجع</Button>
        </div>
      </Modal>
}
