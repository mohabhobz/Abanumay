import { useEffect, useRef, useState } from 'react'
import { DateText, Icon, icons } from '@/components/ui'
import { Composer } from '@/components/assistant'
import type { ThreadMessage } from '@/data/mock/detail'
import { DocPreview } from '@/components/docs/DocPreview'
import { KEEP_BYTES, readFile, sendMessage, threadOf, useThreads, type ChatMessage, type ThreadFile } from '@/data/thread'
import { toast } from '@/data/feedback'
import { nf, readDateTime } from '@/lib/format'

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
  /** The record's seed messages · what was sent in this browser is added from the store */
  messages: ThreadMessage[]
  /** The channel key · `close:CL-2041`, `project:20852`, `reg:REQ-…` · where sent messages are kept */
  channel: string
  /** Who writes from this screen · the name kept on the message */
  by: string
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

const kb = (n: number) => (n >= 1024 * 1024 ? `${nf.format(Math.round(n / 104857.6) / 10)} م.ب` : `${nf.format(Math.max(1, Math.round(n / 1024)))} ك.ب`)

/** Open a kept file in a new tab · from its content when kept, else the in-place preview */
async function openKept(f: ThreadFile, preview: (name: string) => void) {
  if (!f.data) { preview(f.name); return }
  try {
    const blob = await (await fetch(f.data)).blob()
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank', 'noopener')
    if (!w) preview(f.name)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch { preview(f.name) }
}

/** A file on a message · its name, size, and what opens it · the sender sees what he sent */
function FileChip({ f, onOpen }: { f: ThreadFile; onOpen: (f: ThreadFile) => void }) {
  return (
    <button type="button" className="msg-file" onClick={() => onOpen(f)} aria-label={`افتح ${f.name}`} title={f.data ? 'يفتح في تبويب جديد' : 'معاينة في مكانها'}>
      <Icon name={icons.file} size="sm" />
      <span className="msg-file-n">{f.name}</span>
      <span className="sub">{kb(f.size)}</span>
    </button>
  )
}

export function Thread({
  messages: seed, channel, by, entityName, me, why, placeholder, emptyTitle, emptyNote,
}: ThreadProps) {
  useThreads()
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<ThreadFile[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const messages = threadOf(channel, seed)

  /* the newest message stays in view · the channel opens on where the conversation stands */
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [messages.length])

  const attach = (f: File) => {
    readFile(f).then((x) => {
      if (f.size > KEEP_BYTES) toast(`«${f.name}» كبير · يُحفظ اسمه وحجمه ويُعاين في مكانه`)
      setFiles((xs) => [...xs, x])
    })
  }
  const send = (text: string) => {
    if (!text.trim() && !files.length) return
    sendMessage(channel, { by, from: me, body: text.trim(), files: files.length ? files : undefined })
    setDraft('')
    setFiles([])
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={log}>
      {messages.length > 0 ? (
        <>
          {why && (
            <div className="thread-why">
              <Icon name={icons.alert} size="sm" />
              <span className="sub">{why}</span>
            </div>
          )}
          <div className="thread">
            {messages.map((m, i) => {
              const fs = (m as ChatMessage).files
              return (
                <div className={`msg ${m.from}${m.from === me ? ' mine' : ''}`} key={`${m.at}-${i}`}>
                  {/* ⚠️ **Time sits under the name, not at the end of the row.** It used to be
                      anchored to the opposite side of the bubble with a gap between them, so the eye
                      read a name here and a date there and had to travel back — when the time
                      actually belongs to the name. */}
                  <div className="msg-h">
                    <span className="msg-by">{m.from === 'entity' ? entityName : m.by}</span>
                    <span className="msg-role">{m.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>
                    <span className="msg-at sub">{m.at.includes('T') ? <span className="date">{readDateTime(m.at)}</span> : <DateText>{m.at}</DateText>}</span>
                  </div>
                  {m.body && <div className="msg-b">{m.body}</div>}
                  {fs && fs.length > 0 && (
                    <div className="msg-files">
                      {fs.map((f, j) => <FileChip key={`${f.name}-${j}`} f={f} onOpen={(x) => openKept(x, setPreview)} />)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <Blank title={emptyTitle} note={emptyNote} />
      )}
      </div>

      {/* Files picked for the next message · each removable before it goes */}
      {files.length > 0 && (
        <div className="msg-files msg-pending" aria-label="مرفقات الرسالة">
          {files.map((f, j) => (
            <span className="msg-file" key={`${f.name}-${j}`}>
              <Icon name={icons.file} size="sm" />
              <span className="msg-file-n">{f.name}</span>
              <span className="sub">{kb(f.size)}</span>
              <button type="button" className="iact" aria-label={`أزل ${f.name}`} onClick={() => setFiles((xs) => xs.filter((_, k) => k !== j))}>
                <Icon name={icons.close} size="sm" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ⚠️ **The input field is the system's own composer** — it used to be drawn here by hand:
          one line with the two buttons on the opposite side, with a gap the width of the card
          between them, which isn't the system's writing pattern or direction. The one shape: a box
          that grows with the text, buttons in a row underneath, and the send button stays disabled
          until there's text or a file, so it never promises something that doesn't happen. */}
      <Composer
        value={draft}
        onChange={setDraft}
        onSend={send}
        onStop={() => {}}
        busy={false}
        placeholder={placeholder}
        onAttach={attach}
        canSend={files.length > 0}
      />
      {preview && <DocPreview name={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
