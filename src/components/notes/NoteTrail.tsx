import { useState } from 'react'
import { Icon, Person, icons } from '@/components/ui'
import { isolate, readDateTime } from '@/lib/format'
import type { ActivityNote } from '@/types/domain'

/* Note trail — **written once**.

   ⚠️ **A note used to be a line with no owner.** "Report missing beneficiary list" sat in a colored
   box with no record of who wrote it or when, and a second rejection would overwrite the first. The
   requirement: a note **is attributed to its author, with a timestamp**, and **someone else can add
   to it** — it's a short conversation on the item, not a banner.

   ⚠️ **And no new shape was invented.** Every note is **the same bubble as the correspondence
   thread**: name and tag on the first line, time underneath, the current viewer's own messages on
   the opposite side, and the entity in its own tone. It used to be a flat list, so a reason and its
   reply read like two lines in a log rather than a conversation between two parties.

   ⚠️ **And the comment is attributed to whoever has the screen open, not a typed-in name.** A note
   authored by someone else, typed by a different person, can't be attributed to anyone, so the name
   comes from the session, and switching role in this mock changes who the comment is attributed to. */

/* The tag sits on the rejection decision alone — reasons added after it are understood from their
   place in the thread, and a tag on every bubble repeats the same word until it loses meaning. */
const REJECT = 'سبب الرفض'

export interface NoteTrailProps {
  notes: ActivityNote[]
  /** Whoever has the screen open — a new comment is attributed to them. */
  me: string
  /** Adding a comment — without it, the trail is read-only. */
  onAdd?: (say: string) => void
}

export function NoteTrail({ notes, me, onAdd }: NoteTrailProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  if (notes.length === 0 && !onAdd) return null

  const add = () => {
    const say = draft.trim()
    if (!say || !onAdd) return
    onAdd(say)
    setDraft('')
    setOpen(false)
  }

  return (
    <div className="notes">
      {notes.length > 0 && (
        <div className="thread">
          {notes.map((n, i) => (
            <div
              key={`${n.at}-${i}`}
              className={`msg${n.from === 'entity' ? ' entity' : ''}${n.by === me ? ' mine' : ''}`}
            >
              <div className="msg-h">
                <Person name={n.by} quiet={false} />
                {n.kind === 'reject'
                  /* The conversation has no colored tags — "reason for rejection" already carries
                     weight as a phrase. */
                  ? <b className="msg-role">{REJECT}</b>
                  : <span className="msg-role">{n.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>}
                <span className="msg-at sub">{readDateTime(n.at)}</span>
              </div>
              <div className="msg-b">{isolate(n.say)}</div>
            </div>
          ))}
        </div>
      )}

      {onAdd && (open ? (
        <div className="notes-add">
          <label className="regf">
            <span className="lb">السبب · باسم {me}</span>
            <span className="fld">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add()
                  if (e.key === 'Escape') { setOpen(false); setDraft('') }
                }}
                aria-label="نصّ السبب"
                placeholder="مثال: كشف المستفيدين غير مرفق"
              />
            </span>
          </label>
          <div className="act-a">
            <button className="btn btn-p btn-sm" disabled={!draft.trim()} onClick={add}>
              أضف السبب
            </button>
            <button className="btn btn-2 btn-sm" onClick={() => { setOpen(false); setDraft('') }}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        /* ⚠️ **"Add a reason," not "add a comment."** This is specifically about the rejection
           reason: the supervisor adds another reason, and the entity replies to it — "comment" made
           it read like a side chat with no weight. The name is stated as soon as the field opens
           ("Reason, as [name]"), so no one thinks they need to type their own name. */
        <button className="btn btn-ghost btn-sm notes-open" onClick={() => setOpen(true)}>
          <Icon name={icons.plus} size="sm" />
          إضافة سبب
        </button>
      ))}
    </div>
  )
}
