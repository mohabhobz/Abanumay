import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons } from '@/components/ui'
import { OTHER, reasonsOf, type PickedReason, type ReasonKind } from '@/data/entities/reasons'

/* Client meeting 23 Oct · one dialog for every «turn it down» decision in the entity module.

   The decision is picked first (reject, return, disable, delete), then this dialog asks why: the
   reasons come from the entity settings, «أخرى» opens a required text, and a listed reason may carry
   an optional note. Confirm hands the pick back; the caller writes it to the record's log. */

export interface ReasonDialogProps {
  kind: ReasonKind
  title: string
  /** One line under the title · what is being decided on */
  subject?: string
  confirm: string
  /** `btn-d` for a destructive decision, `btn-p` otherwise */
  tone?: 'btn-d' | 'btn-p'
  onConfirm: (p: PickedReason) => void
  onClose: () => void
}

export function ReasonDialog({ kind, title, subject, confirm, tone = 'btn-d', onConfirm, onClose }: ReasonDialogProps) {
  const list = reasonsOf(kind)
  const [reason, setReason] = useState('')
  const [text, setText] = useState('')
  const other = reason === OTHER
  const ok = Boolean(reason) && (!other || text.trim().length > 0)
  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <Icon name={icons.alert} size="md" />
          <b>{title}</b>
        </div>
        <div className="mb col">
          {subject && <p className="sub cnote">{subject}</p>}
          <div className="regf regf-w">
            <span className="lb">السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
            <div className="cfgchips" role="radiogroup" aria-label="السبب">
              {[...list, OTHER].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} className={`cfgchip${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <label className="regf regf-w">
            <span className="lb">{other ? 'اكتب السبب' : 'ملاحظة'}{other && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
            <span className="fld fld-a">
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label={other ? 'نص السبب' : 'ملاحظة'} placeholder={other ? 'السبب كما يُسجَّل في سجل الطلب' : 'اختيارية · تُضاف إلى السبب في السجل'} />
            </span>
          </label>
          <p className="sub cnote">يُسجَّل السبب في السجل باسمك ووقته · والقائمة تُعدَّل من إعدادات الجهات.</p>
        </div>
        <div className="mf">
          <button type="button" className={`btn ${tone}`} disabled={!ok} title={!reason ? 'اختر السبب أولًا' : other && !text.trim() ? 'اكتب السبب' : undefined} onClick={() => onConfirm({ reason, text: text.trim() })}>
            {confirm}
          </button>
          <button type="button" className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
