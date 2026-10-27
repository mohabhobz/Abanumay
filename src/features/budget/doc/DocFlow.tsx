import { useState } from 'react'
import { FormField, FieldBox, Modal, ModalHead, Button, DateText, Glass, Head, Icon, Person, Steps, Tag, icons, type StepItem } from '@/components/ui'
import { BUDGET_STATE_SAY, budgetTone, type BudgetState } from '@/data/mock/budgetTree'
import { whoActs, type BudgetEvent } from '@/data/budget/store'
import { noReviewStep } from '@/data/budget/rules'
import { readDateTime } from '@/lib/format'

const OTHER = 'أخرى'

/* The path a budget or an operation request walks (1.7.1) · prepared, the grants manager, finance,
   the executive director · and the history under it, each step with who and when (1.2.13).

   Both share one ladder: an operation request takes the same four steps as the budget it changes
   (1.3.6–1.3.9), and its last state reads «نُفِّذ» where the budget's reads «مفعّلة». */

const ORDER = ['prepare', 'manager', 'finance', 'exec', 'done'] as const
type Stop = (typeof ORDER)[number]

const STOP_OF: Record<string, Stop> = {
  draft: 'prepare', returned: 'prepare', submitted: 'manager', finance: 'finance', exec: 'exec',
  approved: 'done', executed: 'done', rejected: 'done',
}

export function FlowSteps({ state, last }: { state: string; last: string }) {
  /* client 18 Oct · #6 · prepared → finance → the executive · the first review shows only when a
     setting names it */
  const skip = noReviewStep()
  const order = ORDER.filter((s) => !(skip && s === 'manager'))
  const stop = skip && state === 'submitted' ? 'finance' : STOP_OF[state] ?? 'prepare'
  const at = order.indexOf(stop)
  const say: Record<Stop, string> = {
    /* v3 · 1.1.desc-4 · the reviewer and the approver as settings name them · finance is the department */
    prepare: 'الإعداد', manager: whoActs('submitted') || 'صاحب الصلاحية', finance: 'الإدارة المالية', exec: whoActs('exec') || 'المدير التنفيذي', done: last,
  }
  const items: StepItem[] = order.map((s, i) => ({
    label: say[s],
    state: state === 'rejected' && s === 'done' ? 'no'
      : i < at || (s === 'done' && at === order.length - 1) ? 'done'
        : i === at ? 'now' : 'todo',
    note: s === 'prepare' && state === 'returned' ? 'معادة للاستكمال' : undefined,
  }))
  return <Steps items={items} flow="ladder" />
}

export function History({ events }: { events: BudgetEvent[] }) {
  if (!events.length) return <p className="sub cnote">لا إجراءات مسجّلة بعد.</p>
  return (
    <ul className="bghist">
      {events.map((e, i) => (
        <li key={`${e.at}-${i}`}>
          <span className="bghist-t">
            <b>{e.text}</b>
            {e.note && <span className="sub">«{e.note}»</span>}
          </span>
          <span className="bghist-m sub">
            {/* 1.2.12 · the date and the time of each step */}
            <Person name={e.by} /> · {e.at.length > 10 ? <span className="date">{readDateTime(e.at)}</span> : <DateText>{e.at}</DateText>}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function FlowCard({ state, events }: { state: BudgetState; events: BudgetEvent[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? events : events.slice(0, 4)
  return (
    <Glass>
      <Head title="مسار الاعتماد" meta={<Tag tone={budgetTone(state)}>{BUDGET_STATE_SAY[state]}</Tag>} />
      <FlowSteps state={state} last="معتمدة · مفعّلة" />
      <h3 className="stdy-h mt-3">السجل</h3>
      <History events={shown} />
      {events.length > 4 && (
        <Button variant="2" size="sm" className="mt-2" onClick={() => setAll((x) => !x)}>
          <Icon name={all ? icons.chevronUp : icons.chevronDown} size="sm" />
          {all ? 'اعرض أقل' : 'اعرض السجل كاملًا'}
        </Button>
      )}
    </Glass>
  )
}

/** A decision that carries a note · required on a return, optional on an approval */
/** A decision's note · client 24 Oct (#87) · a return or a rejection may carry a reason list (from
    budget settings) · the reason is picked first, «أخرى» needs its text, and the note reads
    «السبب · الملاحظة» in the log, the same way every other approval in the system records it */
export function NoteModal({ title, cta, tone, required, reasons, onClose, onDone }: {
  title: string; cta: string; tone: string; required: boolean
  reasons?: string[]
  onClose: () => void; onDone: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const picks = reasons?.length ? [...reasons, OTHER] : []
  const other = reason === OTHER
  const ok = picks.length
    ? Boolean(reason) && (!other || note.trim().length > 0)
    : !required || note.trim().length > 0
  const said = picks.length
    ? (other ? `${OTHER}: ${note.trim()}` : note.trim() ? `${reason} · ${note.trim()}` : reason)
    : note.trim()
  return <Modal label={title} onClose={onClose}>
        <ModalHead icon={required ? icons.redo : icons.check} title={title} />
        <div className="mb col">

          {picks.length > 0 && (
            <FormField label="السبب" required wide as="div">
              <div className="cfgchips" role="radiogroup" aria-label="السبب">
                {picks.map((r) => (
                  <Button plain key={r} type="button" role="radio" aria-checked={reason === r} className={`cfgchip${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>{r}</Button>
                ))}
              </div>
            </FormField>
          )}
          <FormField label={picks.length ? (other ? 'اكتب السبب' : 'ملاحظة') : 'الملاحظة'} required={(picks.length ? other : required)}>
            <FieldBox area>
              <textarea rows={3} autoFocus={!picks.length} value={note} onChange={(x) => setNote(x.target.value)} aria-label="الملاحظة" />
            </FieldBox>
          </FormField>

        </div>
        <div className="mf">
          <Button plain className={`btn ${tone}`} disabled={!ok} onClick={() => { onDone(said); onClose() }}>{cta}</Button>
          <Button variant="2" onClick={onClose}>تراجع</Button>
        </div>
      </Modal>
}
