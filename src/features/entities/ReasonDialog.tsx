import { useState } from 'react'
import { FormField, FieldBox, Modal, ModalHead, Button, icons } from '@/components/ui'
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
  return <Modal label={title} onClose={onClose} escape>
        <ModalHead icon={icons.alert} title={title} />
        <div className="mb col">
          {subject && <p className="sub cnote">{subject}</p>}
          <FormField label="السبب" required wide as="div">
            <div className="cfgchips" role="radiogroup" aria-label="السبب">
              {[...list, OTHER].map((r) => (
                <Button plain key={r} type="button" role="radio" aria-checked={reason === r} className={`cfgchip${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>
                  {r}
                </Button>
              ))}
            </div>
          </FormField>
          <FormField label={other ? 'اكتب السبب' : 'ملاحظة'} required={other} wide>
            <FieldBox area>
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label={other ? 'نص السبب' : 'ملاحظة'} placeholder={other ? 'السبب كما يُسجَّل في سجل الطلب' : 'اختيارية · تُضاف إلى السبب في السجل'} />
            </FieldBox>
          </FormField>
        </div>
        <div className="mf">
          <Button plain type="button" className={`btn ${tone}`} disabled={!ok} title={!reason ? 'اختر السبب أولًا' : other && !text.trim() ? 'اكتب السبب' : undefined} onClick={() => onConfirm({ reason, text: text.trim() })}>
            {confirm}
          </Button>
          <Button type="button" variant="2" onClick={onClose}>تراجع</Button>
        </div>
      </Modal>
}
