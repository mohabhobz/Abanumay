import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FieldSelect, Icon, icons, Person } from '@/components/ui'
import type { ProjectRow } from '@/types/domain'
import { ALL_FIELDS, CYCLE } from '@/data/intake/cycle'
import { transferProject } from '@/data/intake/flow'

/* Transfer a project to another domain or supervisor (3.4.20 · 3.4.21).

   The reason is required and the new supervisor is picked from the target domain's own
   supervisors — a transfer to a domain is a transfer to someone who studies it. The current study
   isn't lost: it moves to «دراسات سابقة» and the timeline keeps both. */

export function TransferModal({ row, me, onClose }: { row: ProjectRow; me: string; onClose: () => void }) {
  const [field, setField] = useState(row.field)
  const sups = (CYCLE.domains[field]?.supervisors ?? []).filter((s) => !(field === row.field && s === row.owner))
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const ok = Boolean(field && owner && reason.trim()) && !(field === row.field && owner === row.owner)

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
            <span className="lb">المجال<b className="regf-r" aria-label="إلزامي">*</b></span>
            <FieldSelect value={field} label="المجال" options={ALL_FIELDS} onChange={(v) => { setField(v); setOwner('') }} />
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
          <p className="sub cnote">تنتقل الدراسة الحالية إلى «دراسات سابقة» ويبقى تاريخ التحويل في السجل.</p>
        </div>
        <div className="mf">
          <button className="btn btn-p" disabled={!ok} onClick={() => { transferProject(row.id, field, owner, reason.trim(), me); onClose() }}>
            حوّل المشروع
          </button>
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
