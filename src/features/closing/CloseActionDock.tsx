import { useRef, useState } from 'react'
import { MISSING_ITEM, nounAfter } from '@/lib/format'
import { DecisionDialog, Icon, Num, Person, Tag, icons } from '@/components/ui'
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
  /** Runs the action · returns what refused it, which the popup shows */
  onAct: (a: CloseAct, file?: string, note?: string) => string[] | void
}

export function CloseActionDock({
  user, row, actions, onAct,
}: CloseActionDockProps) {
  const bar = useRef<HTMLDivElement>(null)
  useProximity(bar)

  const [pick, setPick] = useState<CloseAct | null>(null)
  const [file, setFile] = useState('')
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

        {/* Client 26 Oct · the bar holds the buttons only · each one confirms in its popup, with the
            reason (a return) or the file the step needs asked there */}
        <div className="payact-g">
        <div className="rowf gp-2">
          {noteFirst(actions).map((x) => {
            /* The reason is written out, not left to color alone - the first issue is named, since
               "something's missing" makes users hunt for it visually. */
            const why = closeStops(row, x)[0] ?? ''
            return (
              <button
                key={x.label}
                className={`btn ${x.btn}`}
                data-needs-note={x.needsNote ? '' : undefined}
                disabled={Boolean(why)}
                title={why || x.why}
                onClick={() => { setPick(x); setFile('') }}
              >
                {x.needsFile && <Icon name={icons.upload} size="sm" />}{x.label}
              </button>
            )
          })}
        </div>
        </div>
      </div>
      {pick && (
        <DecisionDialog
          title={pick.label}
          tone="btn-p"
          subject={<>إغلاق {row.projectName} · {cycle === 'report' ? 'التقرير الختامي' : 'تقييم المشروع'}{pick.why ? ` · ${pick.why}` : ''}</>}
          note={pick.needsNote ? 'required' : 'optional'}
          notePlaceholder={pick.needsNote ? 'سبب الإعادة · يصل مع الطلب إلى كاتبه' : undefined}
          stops={closeStops(row, pick)}
          ready={!pick.needsFile || Boolean(file)}
          onClose={() => setPick(null)}
          onConfirm={(n) => onAct(pick, file || undefined, n)}
        >
          {pick.needsFile && (
            <div className="regf">
              <span className="lb">{pick.needsFile}<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="apv-row">
                <label className="btn btn-2 btn-sm">
                  <Icon name={icons.upload} size="sm" />{file ? 'استبدل الملف' : 'ارفع الملف'}
                  <input className="vis-h" type="file" accept=".pdf,.jpg,.png" aria-label={`${pick.label} · ${pick.needsFile}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f.name); e.target.value = '' }} />
                </label>
                {file ? <Tag tone="ok">{file}</Tag> : <span className="sub">لا ملف بعد</span>}
              </span>
            </div>
          )}
        </DecisionDialog>
      )}
    </div>
  )
}
