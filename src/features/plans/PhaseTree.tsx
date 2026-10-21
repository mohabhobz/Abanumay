import { useEffect, useState } from 'react'
import { DateField, DateText, Icon, Money, Mono, Num, Tag, icons } from '@/components/ui'
import { phaseDone } from '@/data/mock/plans'
import { pct } from '@/lib/format'
import type { PlanActivity, PlanPhase } from '@/types/domain'
import { NoteTrail } from '@/components/notes'
import { isStuck } from '@/data/plans/store'
import { PROGRESS_SAY, PROGRESS_TONE, VERIFY_SAY, actSerial, progressOf, verifyOf } from '@/data/plans/timing'

/* Phase and activity tree - the plan's core.

   Client meeting 20 Oct (#31 · #32 · #33 · #34) · inside a phase the activities are a plain list,
   one line each, with the columns of the client's sheet: the serial, the activity, its evidence, its
   dates, its execution status, its attachments, the supervisor's check and the notes. Every decision
   sits on the row itself (accept / return for the supervisor, «مكتمل» for the entity), so nothing
   opens a screen of its own. What used to grow the row (the uploaded files, the execution data, the
   note trail) moved behind the row's «المرفقات» link, into a sheet that opens over the plan and
   closes back to one line.

   Note: a phase collapses over its activities. A phase with pending work opens on its own (the
   page decides), because the question here is "which activity is pending", not "how many phases".

   Note: the execution status is read from the dates and the plan settings (delay and stall
   margins), and «مكتمل» is the entity's word · the supervisor's check is its own column, so
   «مكتمل» never reads as counted (rule 14). */

export interface PhaseTreeProps {
  phases: PlanPhase[]
  /** The plan's id · the activity serial is keyed by plan and activity */
  planId?: string
  /** The plan is approved - before that, activity review doesn't exist at all. */
  live: boolean
  /** The current user is the grants supervisor - only they can accept or reject. */
  canReview: boolean
  /** The entity can update its activity - the entity's own portal. */
  canClaim?: boolean
  open: Set<string>
  onToggle: (id: string) => void
  onAccept?: (actId: string) => void
  onReject?: (actId: string) => void
  onClaim?: (actId: string) => void
  /** Upload evidence - the entity's portal only · `replace` is the evidence it replaces. */
  onUpload?: (actId: string, kind: string, fileName: string, replace?: string) => void
  /** Remove an uploaded evidence before the activity is submitted (12.2.20) */
  onDrop?: (actId: string, evId: string) => void
  /** Start an activity · «جارٍ» (12.2.13) */
  onStart?: (actId: string) => void
  /** Comment on an activity - under the name of whoever opened the screen (`me`). */
  onComment?: (actId: string, say: string) => void
  /** Whoever opened the screen - comments are attributed to them. */
  me?: string
  /** Batch 6 · the entity saves its activity's own data before acceptance · returns what blocks it */
  onData?: (actId: string, d: { text: string; reached: number | null; doneOn: string }) => string[]
  /** The activity the page links to - tagged live. */
  focus?: string
}

const missingOf = (a: PlanActivity) => a.needs.filter((n) => !a.evidence.some((e) => e.kind === n))

export function PhaseTree(props: PhaseTreeProps) {
  const { phases, planId = '', live, canReview, canClaim, open, onToggle, onAccept, onReject, onClaim, onStart, focus } = props
  const [sheet, setSheet] = useState<string | null>(null)
  const all = phases.flatMap((ph) => ph.activities)
  const cur = sheet ? all.find((a) => a.id === sheet) : undefined

  return (
    <div className="phtree">
      {phases.map((ph, i) => {
        const done = phaseDone(ph)
        const shut = !open.has(ph.id)
        const queue = ph.activities.filter((a) => a.state === 'claimed').length
        const late = ph.activities.filter((a) => progressOf(a) === 'late').length
        const stuck = ph.activities.filter((a) => isStuck(a)).length

        return (
          <section className="phase" key={ph.id}>
            <button type="button" className="phase-h" aria-expanded={!shut} onClick={() => onToggle(ph.id)}>
              <Icon name={shut ? icons.chevronDown : icons.chevronUp} size="sm" />
              <span className="phase-n num">{i + 1}</span>
              <span className="phase-t">{ph.name || 'مرحلة بلا اسم'}</span>
              <span className="phase-d sub"><DateText>{ph.from}</DateText> ← <DateText>{ph.to}</DateText></span>
              <span className="phase-c"><Money sm>{ph.cost}</Money></span>
              {/* Percentage of the accepted amount alone - rule 14. */}
              <Tag tone={done === 100 ? 'ok' : done > 0 ? 'teal' : 'mute'}>{pct(done)}</Tag>
              {queue > 0 && <span className="sub"><b><Num>{queue}</Num></b> بانتظار</span>}
              {late > 0 && <span className="sub"><b><Num>{late}</Num></b> متأخّر</span>}
              {stuck > 0 && <span className="sub"><b><Num>{stuck}</Num></b> متعثّر</span>}
            </button>

            {!shut && (ph.activities.length === 0 ? (
              <p className="sub cnote acttbl-empty">المرحلة بلا أنشطة · تُقاس المرحلة بأنشطتها، فلا يوجد ما يُراجَع.</p>
            ) : (
              <div className="tblwrap acttbl-w">
                <table className="tbl acttbl">
                  <colgroup>
                    <col className="c-name" /><col className="c-ev" /><col className="c-d" />
                    <col className="c-st" /><col className="c-att" /><col className="c-vf" /><col className="c-nt" /><col className="c-act" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th><span className="th-t">النشاط · م</span></th>
                      <th><span className="th-t">الشاهد</span></th>
                      <th><span className="th-t">البدء · الانتهاء</span></th>
                      <th><span className="th-t">حالة الإنجاز</span></th>
                      <th><span className="th-t">المرفقات</span></th>
                      <th><span className="th-t">تحقق المشرف</span></th>
                      <th><span className="th-t">ملاحظات</span></th>
                      <th><span className="th-t vis-h">الإجراء</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ph.activities.map((a) => {
                      const st = progressOf(a)
                      const vf = verifyOf(a)
                      const missing = missingOf(a)
                      const notes = a.notes ?? []
                      const lastNote = notes.at(-1)
                      return (
                        <tr key={a.id} id={`act-${a.id}`} className={a.id === focus ? 'on' : undefined}>
                          {/* the serial rides under the name · ten narrow columns cut both of them */}
                          <td className="acttbl-2"><b className="acttbl-n" title={a.name}>{a.name}</b><Mono>{actSerial(planId, a.id)}</Mono></td>
                          <td className="acttbl-2"><span className="sub" title={a.needs.join(' · ')}>{a.needs.length ? a.needs.join(' · ') : 'بلا شاهد'}</span></td>
                          <td className="acttbl-2"><DateText>{a.from}</DateText><DateText>{a.to}</DateText></td>
                          <td><Tag tone={PROGRESS_TONE[st]}>{PROGRESS_SAY[st]}</Tag></td>
                          <td className="acttbl-2">
                            <button type="button" className="tlink acttbl-l" onClick={() => setSheet(a.id)}
                              aria-label={`المرفقات · ${a.name}`}>
                              المرفقات (<Num>{a.evidence.length}</Num>)
                            </button>
                            {missing.length > 0 && <span className="sub">ينقص <Num>{missing.length}</Num></span>}
                          </td>
                          <td>{vf ? <Tag tone={vf === 'ok' ? 'ok' : vf === 'no' ? 'no' : 'warn'}>{VERIFY_SAY[vf]}</Tag> : <span className="sub">—</span>}</td>
                          <td>
                            {notes.length > 0
                              ? <button type="button" className="tlink acttbl-l" title={lastNote?.say} onClick={() => setSheet(a.id)}><Num>{notes.length}</Num> · {lastNote?.say}</button>
                              : <span className="sub">—</span>}
                          </td>
                          <td>
                            <span className="acttbl-a">
                              {live && canReview && a.state === 'claimed' && (
                                <>
                                  <button type="button" className="btn btn-p btn-sm" disabled={missing.length > 0}
                                    title={missing.length ? `ينقص: ${missing.join(' · ')}` : 'يُحتسب إنجازًا من لحظة القبول'}
                                    onClick={() => onAccept?.(a.id)}>اقبل النشاط</button>
                                  <button type="button" className="btn btn-2 btn-sm" onClick={() => onReject?.(a.id)}>أعده بملاحظة</button>
                                </>
                              )}
                              {live && canClaim && a.state === 'todo' && onStart && st !== 'notYet' && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onStart(a.id)}>ابدأ</button>
                              )}
                              {live && canClaim && (a.state === 'doing' || a.state === 'todo' || a.state === 'rejected') && (
                                <button type="button" className="btn btn-2 btn-sm" disabled={missing.length > 0}
                                  title={missing.length ? 'ارفع الشواهد المطلوبة من «المرفقات» أولًا' : 'يذهب لمشرف المنح للتحقق ولا يُحتسب قبل قبوله'}
                                  onClick={() => onClaim?.(a.id)}>مكتمل</button>
                              )}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )
      })}

      {cur && <ActSheet a={cur} serial={actSerial(planId, cur.id)} {...props} onClose={() => setSheet(null)} />}
    </div>
  )
}

/** #33 · an activity's attachments, its execution data and its notes · over the plan, not under the row */
function ActSheet({ a, serial, live, canClaim, onUpload, onDrop, onComment, me = '', onData, onClose }: PhaseTreeProps & { a: PlanActivity; serial: string; onClose: () => void }) {
  const edit = Boolean(live && canClaim && a.state !== 'accepted' && a.state !== 'claimed')
  const extra = a.evidence.filter((e) => !a.needs.includes(e.kind))
  /* Escape closes the sheet like every other overlay in the system */
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={`مرفقات النشاط · ${a.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <Icon name={icons.upload} size="md" />
          <b>{a.name}</b>
          <Mono>{serial}</Mono>
        </div>
        <div className="mb col">
          <h4 className="fnd-h">المرفقات</h4>
          {/* Upload sits next to the specific evidence item · the button already knows its type */}
          <ul className="act-ev">
            {a.needs.map((need) => {
              const got = a.evidence.find((e) => e.kind === need)
              return (
                <li key={need} className={got ? 'ok' : 'no'}>
                  <Icon name={got ? icons.check : icons.alert} size="sm" />
                  <span>{need}</span>
                  <span className="sub act-f">{got ? got.fileName : 'لم يُرفع'}</span>
                  {edit && onUpload && (
                    <label className="btn btn-ghost btn-sm act-up">
                      <Icon name={icons.upload} size="sm" />
                      {got ? 'استبدل' : 'ارفع الشاهد'}
                      <input className="vis-h" type="file" aria-label={`${got ? 'استبدل' : 'ارفع'} ${need} · ${a.name}`} onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onUpload(a.id, need, f.name, got?.id)
                        e.target.value = ''
                      }} />
                    </label>
                  )}
                  {edit && got && onDrop && (
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف ${got.fileName}`} onClick={() => onDrop(a.id, got.id)}>
                      <Icon name={icons.close} size="sm" />
                    </button>
                  )}
                </li>
              )
            })}
            {extra.map((e) => (
              <li key={e.id} className="ok">
                <Icon name={icons.check} size="sm" />
                <span>{e.kind}</span>
                <span className="sub act-f">{e.fileName}</span>
                {edit && onDrop && (
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف ${e.fileName}`} onClick={() => onDrop(a.id, e.id)}>
                    <Icon name={icons.close} size="sm" />
                  </button>
                )}
              </li>
            ))}
            {a.needs.length === 0 && extra.length === 0 && <li className="sub">لا يطلب النشاط شاهدًا ولا مرفقات عليه</li>}
          </ul>
          {edit && onUpload && (
            <label className="btn btn-2 btn-sm act-up">
              <Icon name={icons.plus} size="sm" />
              أضف مرفقًا آخر
              <input className="vis-h" type="file" aria-label={`أضف مرفقًا · ${a.name}`} onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUpload(a.id, 'مرفق إضافي', f.name)
                e.target.value = ''
              }} />
            </label>
          )}

          <h4 className="fnd-h">بيانات التنفيذ</h4>
          <ActData a={a} edit={Boolean(edit && onData)} onSave={(d) => onData?.(a.id, d) ?? []} />

          <h4 className="fnd-h">الملاحظات</h4>
          <NoteTrail
            notes={a.notes ?? []}
            me={me}
            onAdd={onComment && live ? (say) => onComment(a.id, say) : undefined}
          />
          {(a.notes ?? []).length === 0 && !(onComment && live) && <p className="sub">لا ملاحظات</p>}
        </div>
        <div className="mf">
          <button type="button" className="btn btn-2" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

/** An activity's implementation data · read-only once accepted or under review */
function ActData({ a, edit, onSave }: { a: PlanActivity; edit: boolean; onSave: (d: { text: string; reached: number | null; doneOn: string }) => string[] }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(a.actual?.text ?? '')
  const [reached, setReached] = useState(a.actual?.reached === null || a.actual?.reached === undefined ? '' : String(a.actual.reached))
  const [doneOn, setDoneOn] = useState(a.actual?.doneOn ?? '')
  const [err, setErr] = useState<string[]>([])
  if (open) {
    return (
      <div className="regfields mt-2">
        <label className="regf">
          <span className="lb">ما نُفّذ</span>
          <span className="fld"><input value={text} onChange={(e) => setText(e.target.value)} aria-label={`ما نُفّذ · ${a.name}`} /></span>
        </label>
        <label className="regf">
          <span className="lb">المستفيدون الفعليون</span>
          <span className="fld"><input inputMode="numeric" value={reached} onChange={(e) => setReached(e.target.value.replace(/[^\d]/g, ''))} aria-label={`المستفيدون الفعليون · ${a.name}`} /></span>
        </label>
        <label className="regf">
          <span className="lb">تاريخ التنفيذ الفعلي</span>
          <DateField value={doneOn} onChange={setDoneOn} label={`تاريخ التنفيذ الفعلي · ${a.name}`} />
        </label>
        {err.length > 0 && <p className="bad">{err.join(' · ')}</p>}
        <div className="rowf gp-2">
          <button type="button" className="btn btn-p btn-sm" onClick={() => {
            const e = onSave({ text, reached: reached ? Number(reached) : null, doneOn })
            setErr(e)
            if (!e.length) setOpen(false)
          }}>احفظ بيانات النشاط</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setErr([]) }}>إلغاء</button>
        </div>
      </div>
    )
  }
  return (
    <div className="act-m sub">
      {a.actual ? (
        <>
          {a.actual.text}
          {a.actual.reached !== null && <> · <Num>{a.actual.reached}</Num> مستفيد</>}
          {a.actual.doneOn && <> · <DateText>{a.actual.doneOn}</DateText></>}
        </>
      ) : 'لم تُسجَّل بيانات التنفيذ بعد'}
      {edit && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
          <Icon name={icons.edit} size="sm" />{a.actual ? 'عدّل بيانات النشاط' : 'سجّل بيانات النشاط'}
        </button>
      )}
    </div>
  )
}
