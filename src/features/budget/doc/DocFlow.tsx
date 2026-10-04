import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DateText, Glass, Head, Icon, Person, Steps, Tag, icons, type StepItem } from '@/components/ui'
import { BUDGET_STATE_SAY, budgetTone, type BudgetState } from '@/data/mock/budgetTree'
import type { BudgetEvent } from '@/data/budget/store'

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
  const at = ORDER.indexOf(STOP_OF[state] ?? 'prepare')
  const say: Record<Stop, string> = {
    prepare: 'الإعداد', manager: 'مدير المنح', finance: 'الإدارة المالية', exec: 'المدير التنفيذي', done: last,
  }
  const items: StepItem[] = ORDER.map((s, i) => ({
    label: say[s],
    state: state === 'rejected' && s === 'done' ? 'no'
      : i < at || (s === 'done' && at === ORDER.length - 1) ? 'done'
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
            <Person name={e.by} /> · <DateText>{e.at.slice(0, 10)}</DateText>
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
        <button className="btn btn-2 btn-sm mt-2" onClick={() => setAll((x) => !x)}>
          <Icon name={all ? icons.chevronUp : icons.chevronDown} size="sm" />
          {all ? 'اعرض أقل' : 'اعرض السجل كاملًا'}
        </button>
      )}
    </Glass>
  )
}

/** A decision that carries a note · required on a return, optional on an approval */
export function NoteModal({ title, cta, tone, required, hint, onClose, onDone }: {
  title: string; cta: string; tone: string; required: boolean; hint?: string
  onClose: () => void; onDone: (note: string) => void
}) {
  const [note, setNote] = useState('')
  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={title} onClick={(x) => x.stopPropagation()}>
        <div className="mh"><Icon name={required ? icons.redo : icons.check} size="md" /><b>{title}</b></div>
        <div className="mb col">
          {hint && <p className="sub cnote">{hint}</p>}
          <label className="regf">
            <span className="lb">الملاحظة{required && <b className="regf-r" aria-label="إلزامي">*</b>}</span>
            <span className="fld fld-a">
              <textarea rows={3} autoFocus value={note} onChange={(x) => setNote(x.target.value)} aria-label="الملاحظة" />
            </span>
          </label>
        </div>
        <div className="mf">
          <button className={`btn ${tone}`} disabled={required && !note.trim()} onClick={() => { onDone(note.trim()); onClose() }}>{cta}</button>
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
