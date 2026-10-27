import { FormField, FieldBox } from './FormField'
import { Modal, ModalHead } from './Modal'
import { Button } from './Button'
import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { icons } from './icons'
import { DateField } from './DateField'
import { FieldMultiSelect, FieldSelect } from './FieldSelect'

/* Client 24 Oct · «كل سكشن فيه بيانات محتاج أكشن تعديل … في شكل بوب أب».

   One editor for every data section in the system · the section's «تعديل» opens it with the
   section's own fields, already filled, and saving hands back only what changed · the caller writes
   it to its record and its log (who, when, before → after). Closed values stay closed: a select
   keeps its list, a dependent list (the city) follows its parent, a list of lines edits one per line.
   The same box, the same order, the same buttons on the project, the entity and its requests, so a
   user who edits one section knows them all. */

export type EditKind = 'text' | 'textarea' | 'lines' | 'date' | 'tel' | 'email' | 'url' | 'digits' | 'number' | 'select' | 'multi'

export interface EditField {
  key: string
  label: string
  kind?: EditKind
  value: string | string[]
  options?: readonly string[]
  /** A list read from another field's value · the city from the region */
  dependsOn?: { key: string; options: (parent: string) => readonly string[] }
  required?: boolean
  /** One line under the field · what the change does */
  hint?: string
}

export interface EditChange { key: string; label: string; from: string; to: string }

export interface EditModalProps {
  title: string
  fields: EditField[]
  onClose: () => void
  /** Saves the changes · returns what refuses them, empty when saved */
  onSave: (changes: EditChange[], values: Record<string, string | string[]>, reason: string) => string[]
  /** One line under the title · where the change lands */
  note?: ReactNode
}

const asText = (v: string | string[]): string => (Array.isArray(v) ? v.join('، ') : v)
const LTR: EditKind[] = ['tel', 'email', 'url', 'digits', 'number']

export function EditModal({ title, fields, onClose, onSave, note }: EditModalProps) {
  const [vals, setVals] = useState<Record<string, string | string[]>>(() => Object.fromEntries(fields.map((f) => [f.key, f.kind === 'lines' && Array.isArray(f.value) ? f.value.join('\n') : f.value])))
  const [reason, setReason] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const norm = (f: EditField, v: string | string[]): string => (f.kind === 'lines' ? String(v).split('\n').map((x) => x.trim()).filter(Boolean).join('، ') : asText(v).trim())
  const changes: EditChange[] = fields
    .filter((f) => norm(f, vals[f.key] ?? '') !== norm(f, f.kind === 'lines' && Array.isArray(f.value) ? f.value.join('\n') : f.value))
    .map((f) => ({ key: f.key, label: f.label, from: asText(f.value), to: norm(f, vals[f.key] ?? '') }))
  const missing = fields.filter((f) => f.required && !norm(f, vals[f.key] ?? ''))
  const set = (k: string, v: string | string[]) => setVals((x) => {
    const next = { ...x, [k]: v }
    /* a dependent list empties when its parent moves */
    for (const f of fields) if (f.dependsOn?.key === k && x[k] !== v) next[f.key] = ''
    return next
  })
  const save = () => {
    if (missing.length) { setBad(missing.map((f) => `${f.label} إلزامي`)); return }
    const out = onSave(changes, Object.fromEntries(fields.map((f) => [f.key, f.kind === 'lines' ? String(vals[f.key] ?? '').split('\n').map((x) => x.trim()).filter(Boolean) : vals[f.key] ?? ''])), reason.trim())
    if (out.length) setBad(out)
    else onClose()
  }
  return <Modal label={title} onClose={onClose} className="modal-w" escape>
        <ModalHead icon={icons.edit} title={title} />
        <div className="mb col">
          {note && <p className="sub cnote">{note}</p>}
          <div className="regfields">
            {fields.map((f) => {
              const v = vals[f.key] ?? ''
              const k = f.kind ?? 'text'
              const opts = f.dependsOn ? f.dependsOn.options(String(vals[f.dependsOn.key] ?? '')) : f.options ?? []
              const wide = k === 'textarea' || k === 'lines'
              return (
                <FormField key={f.key} as="div" wide={wide} label={f.label} required={f.required}>
                  {k === 'select' ? (
                    <FieldSelect value={String(v)} options={opts} onChange={(x) => set(f.key, x)} label={f.label}
                      disabled={Boolean(f.dependsOn) && !vals[f.dependsOn!.key]} placeholder={f.dependsOn && !vals[f.dependsOn.key] ? 'اختر أولًا ما يسبقه' : 'اختر'} />
                  ) : k === 'multi' ? (
                    <FieldMultiSelect values={Array.isArray(v) ? v : String(v).split('، ').filter(Boolean)} options={opts} onChange={(x) => set(f.key, x)} label={f.label} />
                  ) : k === 'date' ? (
                    <DateField value={String(v)} onChange={(x) => set(f.key, x)} label={f.label} />
                  ) : wide ? (
                    <FieldBox area><textarea rows={k === 'lines' ? 4 : 3} value={String(v)} onChange={(e) => set(f.key, e.target.value)} aria-label={f.label} /></FieldBox>
                  ) : (
                    <FieldBox><input value={String(v)} dir={LTR.includes(k) ? 'ltr' : undefined} inputMode={k === 'tel' || k === 'digits' || k === 'number' ? 'numeric' : undefined}
                      onChange={(e) => set(f.key, k === 'digits' || k === 'number' ? e.target.value.replace(/[^\d]/g, '') : e.target.value)} aria-label={f.label} /></FieldBox>
                  )}
                  {(f.hint || k === 'lines') && <span className="sub regf-h">{f.hint ?? 'سطر لكل بند'}</span>}
                </FormField>
              )
            })}
          </div>
          <FormField label="سبب التعديل" wide>
            <FieldBox><input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="سبب التعديل" placeholder="اختياري · يُسجَّل مع التعديل في السجل" /></FieldBox>
          </FormField>
          {bad.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
        </div>
        <div className="mf">
          <Button type="button" variant="p" disabled={!changes.length} title={changes.length ? undefined : 'لم يتغيّر شيء'} onClick={save}>
            احفظ التعديل{changes.length ? ` · ${changes.length}` : ''}
          </Button>
          <Button type="button" variant="2" onClick={onClose}>تراجع</Button>
        </div>
      </Modal>
}

/** The section's «تعديل» · sits in the section's head */
export function EditButton({ onClick, label = 'تعديل', title }: { onClick: () => void; label?: string; title?: string }) {
  return (
    <Button type="button" variant="2" size="sm" onClick={onClick} title={title}>
      <Icon name={icons.edit} size="sm" />{label}
    </Button>
  )
}
