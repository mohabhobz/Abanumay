import { useRef } from 'react'
import { MISSING_ITEM, nounAfter } from '@/lib/format'
import { Icon, Num, Person, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import {
  closeCycle, closeStageLabel, evalBlockers, reportBlockers,
} from '@/data/mock/closing'
import { closeStops, type CloseAct } from '@/data/closing/store'
import type { CloseRow, CurrentUser } from '@/types/domain'
import { noteFirst } from '@/lib/dock'

/* Closing actions - two cycles, not one.

   Note: this is the most important part of this file. Rule 17 states that the final report and the
   project evaluation "go through two independent approval cycles" - meaning "grants manager
   approval" happens twice in the life of one request and means two different things: once on the
   entity's report, and once on the supervisor's evaluation. So the button label states what it
   approves, rather than just saying "approve".

   Note: a return goes back to whoever wrote the document, not to the previous stage - the same
   lesson as the plan and the agreement: the entity writes the report, so returning it goes back to
   the entity; the grants supervisor writes the evaluation, so returning it goes back to the
   supervisor. The destination is stated in the button label.

   Note: the `reportDone` stage has no approval action, it has a start action. The report is
   approved and the evaluation hasn't started (rule 6), so showing approval buttons here would imply
   a pending decision that doesn't exist. What's pending is drafting.

   Note: after `closed` there are no actions at all - rule 21: any change after final closure needs
   a new procedure, so the footer disappears instead of showing a disabled button. */

export interface CloseActionDockProps {
  user: CurrentUser
  row: CloseRow
  /** The exits come from the closing store · `closeActions(row, role)` */
  actions: CloseAct[]
  note: string
  onNote: (v: string) => void
  onAct: (a: CloseAct, file?: string) => void
}

export function CloseActionDock({
  user, row, actions, note, onNote, onAct,
}: CloseActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const needNote = actions.some((a) => a.needsNote)
  const cycle = closeCycle(row)

  /* Note: a request sitting with someone else states who, rather than disappearing or showing a
     disabled button - the supervisor who opened the request wants to know whose court the ball is
     in, and that's an answer in itself. */
  if (actions.length === 0) {
    if (row.stage === 'closed') return null
    return (
      <div className="decdock">
        <div className="chrome decbar" ref={bar}>
          <div className="rowf gp-3">
            <Person name={user.name} size="lg" quiet={false} />
            <span className="decsent">
              الطلب في <b>{closeStageLabel(row.stage)}</b>
              <span className="decsep" />
              {cycle === 'report' ? 'دورة التقرير الختامي' : 'دورة تقييم المشروع'}
              <span className="decsep" />
              لا يوجد قرار بانتظارك هنا
            </span>
          </div>
        </div>
      </div>
    )
  }

  const missing = cycle === 'report' ? reportBlockers(row) : evalBlockers(row)

  return (
    <div className="decdock">
      <div className="chrome decbar payact" ref={bar}>
        <div className="rowf gp-3 payact-w">
          <Person name={user.name} size="lg" quiet={false} />
          <span className="decsent">
            قرارك في إغلاق <b>{row.projectName}</b>
            <span className="decsep" />
            {cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}
            {missing.length > 0 && (
              <>
                <span className="decsep" />
                <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}
              </>
            )}
          </span>
        </div>

        {/* Field and buttons form one group that wraps together - the field doesn't split away from
            "return" if the note runs to two lines. */}
        <div className="payact-g">
        {needNote && (
          <label className="payact-n">
            <span className="vis-h">ملاحظات الإعادة</span>
            <input
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder="سبب الإعادة · إلزامي"
            />
          </label>
        )}

        <div className="rowf gp-2">
          {noteFirst(actions).map((x) => {
            /* The reason is written out, not left to color alone - the first issue is named, since
               "something's missing" makes users hunt for it visually. */
            const why =
              (x.needsNote && !note.trim())
                ? 'اكتب سبب الإعادة أولًا'
                : closeStops(row, x)[0] ?? ''
            if (x.needsFile && !why) {
              return (
                <label key={x.label} className={`btn ${x.btn}`} title={`ارفع ${x.needsFile} · ${x.why}`}>
                  <Icon name={icons.upload} size="sm" />{x.label}
                  <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={`${x.label} · ${x.needsFile}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAct(x, f.name); e.target.value = '' }} />
                </label>
              )
            }
            return (
              <button
                key={x.label}
                className={`btn ${x.btn}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(why)}
                title={why || x.why}
                onClick={() => onAct(x)}
              >
                {x.label}
              </button>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}
