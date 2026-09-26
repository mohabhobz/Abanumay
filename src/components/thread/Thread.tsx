import { useState } from 'react'
import { DateText, Icon, icons } from '@/components/ui'
import { Composer } from '@/components/assistant'
import type { ThreadMessage } from '@/data/mock/detail'

/* Correspondence — **written once**.
   ⚠️ The thread used to be drawn inside the correspondence tab on the project page, and when the
   entity gate needed the same thing, the easiest path was to copy it — which is how two places end
   up saying the same thing in two different shapes a month later.
   This channel is **nearly dormant** in the legacy system: zero messages across the projects
   checked, and the one thread found was entirely about a failed receipt voucher. So it isn't a
   general communication channel — it opens **when a process gets stuck on one side**. The component
   states this outright when empty instead of showing a blank chat box.
   ⚠️ **And the entity sees itself on its own side.** A flag states who has the screen open, so
   their own messages get marked as such — without it the entity would read its own messages as
   coming from the foundation. */

export interface ThreadProps {
  messages: ThreadMessage[]
  /** The entity's name — written above its messages. */
  entityName: string
  /** Who has the screen open — determines which side a message lands on. */
  me: 'staff' | 'entity'
  /** Why the channel was opened — stated above the thread. */
  why?: string
  /** Placeholder text in the input field. */
  placeholder: string
  /** Empty-state text — changes depending on the screen. */
  emptyTitle: string
  emptyNote: string
}

/**
 * The channel while empty.
 * ⚠️ **The same closed-state pattern as the assistant**: a badge, a title, and a line stating when
 * the channel opens. Empty, in this system, is **a designed state**, not a gray line — and this
 * channel is in fact empty most of the time (zero messages across the sample checked), so this is
 * its **default view**, not the exception.
 * ⚠️ **And no button.** The assistant's closed-state button actually runs an analysis; here there's
 * nothing to do but point at the input field right below it. **A button that does what the field
 * already does on its own is a button that does nothing**, which is why it was removed.
 */
/* ⚠️ **Empty is a system message at the start of the conversation, not a banner in the middle.** It
   used to be centered with a large icon and the input field floating below it, mid-page, so the
   card read as a blank page rather than a conversation. Now it sits where the first message would,
   at the start of the line. */
function Blank({ title, note }: { title: string; note: string }) {
  return (
    <div className="chat-empty">
      <Icon name={icons.chat} size="md" />
      <div>
        <b>{title}</b>
        <p className="sub">{note}</p>
      </div>
    </div>
  )
}

export function Thread({
  messages, entityName, me, why, placeholder, emptyTitle, emptyNote,
}: ThreadProps) {
  const [draft, setDraft] = useState('')

  return (
    <div className="chat">
      <div className="chat-log">
      {messages.length > 0 ? (
        <>
          {why && (
            <div className="thread-why">
              <Icon name={icons.alert} size="sm" />
              <span className="sub">{why}</span>
            </div>
          )}
          <div className="thread">
            {messages.map((m, i) => (
              <div className={`msg ${m.from}${m.from === me ? ' mine' : ''}`} key={`${m.at}-${i}`}>
                {/* ⚠️ **Time sits under the name, not at the end of the row.** It used to be anchored to the
   opposite side of the bubble with a gap between them, so the eye read a name here and a date there
   and had to travel back — when the time actually belongs to the name. */}
                <div className="msg-h">
                  <span className="msg-by">{m.from === 'entity' ? entityName : m.by}</span>
                  <span className="msg-role">{m.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>
                  <span className="msg-at sub"><DateText>{m.at}</DateText></span>
                </div>
                <div className="msg-b">{m.body}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Blank title={emptyTitle} note={emptyNote} />
      )}
      </div>

      {/* ⚠️ **The input field is the system's own composer** — it used to be drawn here by hand: one line
   with the two buttons on the opposite side, with a gap the width of the card between them, which
   isn't the system's writing pattern or direction. The one shape: a box that grows with the text,
   buttons in a row underneath, and the send button stays disabled until there's text, so it never
   promises something that doesn't happen. */}
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => setDraft('')}
        onStop={() => {}}
        busy={false}
        placeholder={placeholder}
      />
    </div>
  )
}
