import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { icons } from './icons'

/**
 * Step ladder · **one component** for any flow with stages that have a status.
 *
 * There used to be five different renderings of the same idea, with dot diameters of 10 · 10 · 16 ·
 * 15 · 5. Two were **dead** (no screen rendered them), one wasn't a ladder at all, and two were
 * live and differed in dot, line, and states. Users see both live ones on the same project — once
 * in the agreement tab, once in the disbursements tab — so the same meaning ("this stage is done")
 * gets said two different ways.
 *
 * The fix is **not** to make all five one shape. The two live flows genuinely differ in layout:
 *
 *   · `ladder` — a connected vertical ladder. Order carries meaning: supervisor -> manager ->
 *   finance -> executive -> entity. The line says "one after another."
 *   · `row` — a wrapping row. Four stages side by side with no line, because they read as a
 *   checklist, not a timeline, and a line in a wrapping grid would misrepresent the order.
 *   · `stepper` — a horizontal row that **compresses**. This is the only flow the user navigates
 *   themselves, and it takes the place of tabs in multi-stage forms.
 *
 * ### The number turns into a checkmark
 * In `stepper`, the dot holds the **step number**, and once the step completes, the number is
 * replaced by a checkmark — that's what makes the bar a "stepper" rather than "tabs": tabs say
 * "where are you," a stepper says "where are you **and how many are done**." The number isn't
 * decoration — it's the step's order in the process, so it belongs in the dot itself, not next to
 * the name.
 *
 * What's unified is the **marker**: one dot, one diameter, one set of states in one language, and
 * the same colors. The layout changes; the marker doesn't.
 *
 * ### Three states, not two
 * Disbursements used to be `on` or not — four stages, two green and two gray, with the user
 * **unable to tell whose turn it is**. The `now` state returns exactly that — and that's the whole
 * point of the screen: not just "how far along," but "who's holding it."
 *
 * The `now` color is amber, not green or the primary color: the ladder exists to say **who's
 * holding the request**, and amber is the color that says "this needs action." It's also the only
 * state the user actually acts on.
 */

/**
 * Stage status.
 *
 * Warning: **`skip` is a fourth state on purpose** — a stage that doesn't apply to this case (e.g.
 * reviewing institutional outreach when closing a project with no publicity commitment) is shown as
 * **skipped, not hidden** — the same rule that fixed the cards' handling of absence. Removing it
 * from the bar would make two different paths show the same number of stages with no way to tell
 * what differs.
 */
/* Warning: `no` means the stage **ended with a negative outcome** (rejected). Without it, a
   rejected request's stepper would still say "decision" is in progress (a numbered, empty dot) even
   though the decision has already been made. The outcome is an explicit state, not just a color. */
export type StepState = 'done' | 'now' | 'todo' | 'skip' | 'no'

export interface StepItem {
  /** Stage name · a role or an action */
  label: string
  /** Line under the name: a note or who took the action */
  note?: ReactNode
  /** Completion time · shown only in `ladder` */
  at?: ReactNode
  state: StepState
}

/** Status is read out for screen readers · color and marker alone aren't information */
const SAY: Record<StepState, string> = {
  done: 'تمّت',
  now: 'المحطة الحالية',
  todo: 'لم تبدأ',
  skip: 'لا تنطبق على هذه الحالة',
  no: 'انتهت بالرفض',
}

export interface StepsProps {
  items: StepItem[]
  /**
   * `ladder` connected vertical ladder · `row` wrapping row with no line · `stepper` compressing
   * horizontal row
   */
  flow?: 'ladder' | 'row' | 'stepper'
  /**
   * Clicking a step · only active in `stepper`.
   * Its presence is what turns items into buttons — without it the bar is display-only, so an item
   * with no action doesn't take on button styling.
   */
  onPick?: (index: number) => void
}

export function Steps({ items, flow = 'ladder', onPick }: StepsProps) {
  const stepper = flow === 'stepper'
  const can = stepper && Boolean(onPick)

  return (
    <ol className={`stp stp-${flow}`}>
      {items.map((s, i) => {
        const dot = (
          <span className="stp-dot" aria-hidden="true">
            {/* Warning: the number turns into a checkmark rather than sitting alongside it. Having
                both in the same dot would mean "step 3, and it's done" twice — the number after
                completion adds no information; what matters at that point is that it's done. */}
            {s.state === 'done'
              ? <Icon name={icons.check} size="sm" />
              : s.state === 'no'
                ? <Icon name={icons.close} size="sm" />
              /* A skipped stage has an empty dot · a number in it would promise a step that's going
                 to happen, and it won't. */
              : s.state === 'skip'
                ? null
              : stepper ? <b className="stp-num">{i + 1}</b> : null}
          </span>
        )
        const body = (
          <>
            {dot}
            <span className="stp-l">{s.label}</span>
            <span className="vis-h">{SAY[s.state]}</span>
            {s.note != null && s.note !== '' && <span className="stp-n">{s.note}</span>}
            {flow === 'ladder' && <span className="stp-at">{s.at ?? ''}</span>}
          </>
        )
        /* In the stepper, the dot sits above and the name below it, so the content is a centered
           column, and the horizontal track passes behind the dots.

           Warning: **this column used to be anchored to the button, so a bar with no click handler
           fell apart.** The whole layout was written on `.stp-b`, which only renders when `onPick`
           is passed — so the plan page (a display-only bar) ended up with a dot next to a name in a
           row, and the track, computed for a centered column, ran through the wrong place. The
           client noticed and asked why it wasn't using our stepper — it **was**, but the component
           itself only worked in one of its two states.

           So the `.stp-c` box is now always applied, and `.stp-b` is now an addition for behavior
           (cursor and hover), not for layout. */
        const box = `stp-c${can ? ' stp-b' : ''}`
        return (
          <li key={i} className={`stp-i ${s.state}`}>
            {can
              ? (
                <button
                  type="button"
                  className={box}
                  aria-current={s.state === 'now' ? 'step' : undefined}
                  onClick={() => onPick?.(i)}
                >
                  {body}
                </button>
              )
              : <span className={box}>{body}</span>}
          </li>
        )
      })}
    </ol>
  )
}
