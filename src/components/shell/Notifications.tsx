import { useFlow } from '@/data/intake/flow'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import { Button, DateText, EntityMark, Face, Icon, icons } from '@/components/ui'
import { buildNotes, entityNotes, isRead, markRead, NOTE_GROUPS, useReadSet, type Note, type NoteFrom, type NoteKind } from '@/data/notifications'
import { readRole } from '@/data/roles'
import { todayFor } from '@/features/home/today'
import { liveDay, TODAY } from '@/data/clock'

/* 17 Oct · client · the bell stays as it is, with the important cases added and a filter on the
   important and the late.
   26 Nov · audit #54–#58 · one source per number:
   · «المتأخر» is the person's own late work and nothing else · the same items, one each, as the
     «عاجل» lane on «اليوم», so the two counts always agree
   · the escalation mechanism's alerts on other desks' items (the CEO sees the whole foundation)
     are their own group, «تصعيدات من محطات أخرى» · important, never counted as «my late»
   · «غير المقروء» is its own filter, and its count is the header's and the badge's */
type NoteFilter = 'all' | 'unread' | 'important' | 'late'
const IMPORTANT = /أُعيد|إعادة|رفض|تصعيد|متأخر|تجاوز|يقترب|يحتاج قرارك|بانتظار قرارك|عاجل/
const isLate = (n: Note) => n.kind === 'late'
const isImportant = (n: Note) => n.kind === 'decide' || n.kind === 'late' || n.kind === 'esc' || IMPORTANT.test(`${n.title} ${n.context}`)
const ESC_ID = /^(late|stall)-/
const strip = (t: string) => t.replace(/^(تجاوز مدته|متعثر) · /, '')
/** The person's own late work (the «عاجل» lane) as notes · and the escalation alerts re-sorted:
    one on an item already in that lane is dropped (it's said once), the rest are other desks' */
function withDue(name: string, have: Note[]): Note[] {
  const due = todayFor(readRole(), name).byLane.due
  const tos = new Set(due.map((i) => i.to)); const titles = new Set(due.map((i) => i.title))
  const rest = have.flatMap((n): Note[] => {
    if (n.kind !== 'late' || !ESC_ID.test(n.id)) return [n]
    if (tos.has(n.to) || titles.has(strip(n.title))) return []
    return [{ ...n, kind: 'esc' }]
  })
  const mine = due.map((i): Note => ({ id: `td-${i.queueKey}-${i.id}`, kind: 'late', title: i.title, context: `${i.queue} · ${i.why}`, at: TODAY, to: i.to, from: { type: 'system' } }))
  return [...rest, ...mine]
}
/* A notice can't be dated after today · an op stamped by a moved clock (QA data) read «March 2027» */
const notAfterToday = (n: Note): Note => { const d = liveDay(); return n.at > d ? { ...n, at: d } : n }

let noteCache: { k: string; v: Note[]; at: number } | null = null

const KIND_ICON: Record<NoteKind, keyof typeof icons> = { decide: 'checks', msg: 'chat', late: 'clock', esc: 'alert', info: 'info' }
const KIND_SAY: Record<NoteKind, string> = { decide: 'يحتاج قرارك', msg: 'رسالة', late: 'متأخر', esc: 'تصعيد', info: 'للعلم' }

/** The card's leading mark: sender photo, entity/project logo, or the Abanumay mark for the system. */
function NoteMark({ from }: { from: NoteFrom }) {
  if (from.type === 'person') return <span className="nmark"><Face name={from.name} size="lg" /></span>
  if (from.type === 'system') return <span className="nmark nmark-sys" aria-hidden="true"><Logo /></span>
  if (from.type === 'project' && !from.logo) {
    return <span className="nmark ec-init ec-mark" aria-hidden="true"><Icon name={icons.navProjects} /></span>
  }
  return <span className="nmark"><EntityMark logo={from.logo} /></span>
}

/**
 * Notification bell and drawer.
 * On desktop the bell is a rail item above the avatar; on mobile it sits in the top header
 * (`place="top"`). Its number is the unread count.
 * **The drawer belongs to the floating-layer family**: it covers rather than raises, with a scrim
 * behind it; it opens from the left edge (inline-end in RTL) on every screen size, away from the
 * rail, so the navigation stays readable beside it. Escape and the scrim close it; focus is
 * trapped inside and returns to the bell.
 * **Each notification is a card.** Unread and read differ by the card's background (a light brand
 * tint vs. the neutral surface) and by weight, never by colored text or a dot. The card leads with
 * who it's from and puts the date under the description.
 */
export function NotificationBell({ user, place = 'rail', entity }: { user: { name: string }; place?: 'rail' | 'top'; entity?: string }) {
  const [open, setOpen] = useState(false)
  /* Intake actions add notes while the app is open · re-read when one runs */
  const flowV = useFlow()
  /* Batch 3 · an entity session has its own bell · what the foundation sent the entity (payments,
     closing, agreements, its registration), the same list as «إشعاراتك» on its portal */
  /* 26 Nov · the list is kept between mounts · every screen mounts the rail anew (and its outline
     before it), and reading every queue twice per page held the page's first frame */
  const notes = useMemo(() => {
    const k = `${entity ?? ''}|${user.name}|${readRole()}|${flowV}|${liveDay()}`
    /* Kept for a moment only · the outline's rail and the page's rail a frame apart read once; a
       later screen reads afresh, so a step taken elsewhere is in the count */
    if (noteCache?.k === k && Date.now() - noteCache.at < 3000) return noteCache.v
    const v = entity ? entityNotes(entity).map(notAfterToday) : withDue(user.name, buildNotes(user)).map(notAfterToday)
    noteCache = { k, v, at: Date.now() }
    return v
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, entity, flowV])
  const [filter, setFilter] = useState<NoteFilter>('all')
  const read = useReadSet()
  const unread = notes.filter((n) => !isRead(n, read)).length
  const pass = (n: Note) => filter === 'all' || (filter === 'unread' ? !isRead(n, read) : filter === 'late' ? isLate(n) : isImportant(n))
  const counts = { all: notes.length, unread, important: notes.filter(isImportant).length, late: notes.filter(isLate).length }
  const bell = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = () => { setOpen(false); bell.current?.focus() }

  useEffect(() => {
    if (!open) return
    /* First focusable element inside the drawer — the "mark all" button, or the close control. */
    panel.current?.querySelector<HTMLElement>('button,a[href]')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /* Focus trap — Tab from the last item returns to the first, and vice versa. */
  const trap = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panel.current) return
    const f = [...panel.current.querySelectorAll<HTMLElement>('button,a[href]')]
    if (!f.length) return
    const [first, last] = [f[0], f[f.length - 1]]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const label = unread ? `الإشعارات · ${unread} غير مقروء` : 'الإشعارات'

  return (
    <>
      <Button plain
        ref={bell}
        type="button"
        className={`${place === 'rail' ? 'railitem ' : 'nbell-top '}nbell${open ? ' on' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="nbell-ic">
          <Icon name={icons.bell} active={open} />
          {unread > 0 && <b className="nbadge num" aria-hidden="true">{unread}</b>}
        </span>
        {place === 'rail' && <span className="rail-l">الإشعارات</span>}
        {place === 'rail' && <span className="rail-tip">{label}</span>}
      </Button>

      {open && createPortal(
        <div className="nscrim" role="presentation" onClick={close}>
          <div
            ref={panel}
            className="ndrawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ndrawer-t"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={trap}
          >
            <header className="ndrawer-h">
              <div className="ndrawer-tt">
                <h2 id="ndrawer-t">الإشعارات</h2>
                <span className="sub">{unread ? `${unread} غير مقروء` : 'كلها مقروءة'}</span>
              </div>
              <Button
                type="button"
                variant="ghost" size="sm"
                disabled={!unread}
                onClick={() => markRead(notes.map((n) => n.id))}
              >
                <Icon name={icons.checks} size="sm" />
                تعيين الكل كمقروء
              </Button>
              <Button plain type="button" className="aclose" onClick={close} aria-label="إغلاق الإشعارات" title="إغلاق">
                <Icon name={icons.close} size="sm" />
              </Button>
            </header>

            <div className="nfilter" role="group" aria-label="تصفية الإشعارات">
              {([['all', 'الكل'], ['unread', 'غير المقروء'], ['important', 'المهم'], ['late', 'المتأخر']] as const).map(([k, l]) => (
                <Button plain key={k} type="button" className={`fchip${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l} <b className="num">{counts[k]}</b>
                </Button>
              ))}
            </div>

            <div className="ndrawer-b">
              {notes.filter(pass).length === 0 && <p className="sub cnote">لا إشعارات في هذا التصنيف.</p>}
              {NOTE_GROUPS.map((g) => {
                const rows = notes.filter((n) => n.kind === g.kind && pass(n))
                if (!rows.length) return null
                return (
                  <section key={g.kind} className="ngroup" aria-labelledby={`ng-${g.kind}`}>
                    <h3 id={`ng-${g.kind}`} className="ngroup-h">
                      {g.label}
                      <span className="num">{rows.length}</span>
                    </h3>
                    <ul className="nlist">
                      {rows.map((n) => {
                        const fresh = !isRead(n, read)
                        return (
                          <li key={n.id}>
                            <Link
                              to={n.to}
                              className={`ncard${fresh ? ' unread' : ''}`}
                              onClick={() => { markRead([n.id]); setOpen(false) }}
                            >
                              {n.from.type === 'system' ? (
                                /* The system speaks through what kind of notice it is · its logo on every card said nothing */
                                <span className={`nmark nmark-k k-${n.kind}`} title={KIND_SAY[n.kind]} aria-hidden="true"><Icon name={icons[KIND_ICON[n.kind]]} /></span>
                              ) : (
                                <span className="nmark-w">
                                  <NoteMark from={n.from} />
                                  <span className={`nkind k-${n.kind}`} title={KIND_SAY[n.kind]} aria-hidden="true"><Icon name={icons[KIND_ICON[n.kind]]} size="sm" /></span>
                                </span>
                              )}
                              <span className="ncard-b">
                                <span className="nrow-t">{n.title}</span>
                                <span className="nrow-c">{n.context}</span>
                                <span className="nrow-d"><DateText>{n.at}</DateText></span>
                              </span>
                              <span className="nsr">{KIND_SAY[n.kind]}{fresh ? ' · غير مقروء' : ''}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
