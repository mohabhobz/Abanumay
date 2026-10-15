import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FieldSelect, Icon, icons, Person } from '@/components/ui'
import type { ProjectRow } from '@/types/domain'
import { CYCLE } from '@/data/intake/cycle'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, TRACKS } from '@/data/mock/taxonomy'
import { transferProject } from '@/data/intake/flow'

/* Transfer a project to another domain or supervisor (3.4.20 · 3.4.21).

   The reason is required and the new supervisor is picked from the target domain's own
   supervisors — a transfer to a domain is a transfer to someone who studies it. The current study
   isn't lost: it moves to «دراسات سابقة» and the timeline keeps both. */

export function TransferModal({ row, me, onClose }: { row: ProjectRow; me: string; onClose: () => void }) {
  /* v3 · 3.4.23 · the track, the domain and the goal move together · the goal is picked again, so the
     project never keeps a goal its new domain doesn't have */
  const [track, setTrack] = useState(row.track)
  const [field, setField] = useState(row.field)
  const [goal, setGoal] = useState(row.goal)
  const fields = FIELDS_BY_TRACK[track] ?? []
  const goals = GOALS_BY_FIELD[field] ?? []
  /* the same domain keeps its supervisor on offer · a goal moved within the domain is a transfer too */
  const sups = CYCLE.domains[field]?.supervisors ?? []
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const changed = field !== row.field || goal !== row.goal || track !== row.track || owner !== row.owner
  const ok = Boolean(track && field && goal && goals.includes(goal) && owner && reason.trim()) && changed

  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label="تحويل المشروع" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <Icon name={icons.send} size="md" />
          <b>تحويل المشروع</b>
        </div>
        <div className="mb col">
          <p className="sub cnote">{row.name} · في مجال «{row.field}» عند {row.owner ? <Person name={row.owner} /> : 'بلا مشرف'}</p>
          <label className="regf">
            <span className="lb">المسار<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect value={track} label="المسار" options={[...TRACKS]} onChange={(v) => { setTrack(v); setField(''); setGoal(''); setOwner('') }} />
          </label>
          <label className="regf">
            <span className="lb">المجال<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect value={field} label="المجال" options={fields} placeholder="اختر" onChange={(v) => { setField(v); setGoal(''); setOwner('') }} />
          </label>
          <label className="regf">
            <span className="lb">الهدف<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect value={goal} label="الهدف" options={goals} placeholder={field ? 'اختر' : 'اختر المجال أولًا'} disabled={!field} onChange={setGoal} />
          </label>
          <label className="regf">
            <span className="lb">مشرف المجال<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect
              value={owner}
              label="مشرف المجال"
              options={sups}
              placeholder={sups.length ? 'اختر' : 'لا مشرف لهذا المجال'}
              disabled={sups.length === 0}
              onChange={setOwner}
            />
          </label>
          <label className="regf">
            <span className="lb">سبب التحويل<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب التحويل" placeholder="مثال: المشروع صحي لا تعليمي" /></span>
          </label>
          <p className="sub cnote">تنتقل الدراسة الحالية إلى «دراسات سابقة» · ويبقى اختيار الجهة الأصلي ({row.track} · {row.field} · {row.goal}) محفوظًا في بيانات المشروع وسجله.</p>
        </div>
        <div className="mf">
          <button className="btn btn-p" disabled={!ok} onClick={() => { transferProject(row.id, field, owner, reason.trim(), me, track, goal); onClose() }}>
            حوّل المشروع
          </button>
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
