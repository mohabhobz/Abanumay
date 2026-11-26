import { useState } from 'react'
import { Button, Icon, icons, Modal, ModalHead } from '@/components/ui'
import { useMenuOf } from '@/hooks/useMenu'
import type { SavedChat } from '@/data/mock/assistant'

/** Groups in list order - "pinned" comes before any date. */
const GROUPS = ['مثبّتة', 'اليوم', 'أمس', 'آخر 7 أيام'] as const

export interface ChatListProps {
  chats: SavedChat[]
  onChange: (chats: SavedChat[]) => void
  openId: string | null
  onOpen: (id: string) => void
  onNew: () => void
  /** Opens over the content on mobile. */
  open: boolean
  /** Collapsed on desktop - the button restores it. */
  shut: boolean
  onShut: () => void
  /** Removing a conversation · the screen also clears it if it's the one open */
  onRemove: (id: string) => void
  /** Downloads a conversation as text */
  onExport: (id: string) => void
}

/* Audit 26 Nov · Arabic counts the noun by the number · 1 محادثة · 2 محادثتان · 3–10 محادثات · 11+ محادثة */
const countSay = (n: number) => n === 0 ? 'لا محادثات' : n === 1 ? 'محادثة واحدة' : n === 2 ? 'محادثتان' : n <= 10 ? `${n} محادثات` : `${n} محادثة`

/**
 * List of saved conversations.
 *
 * Pinning and search were requested directly, not added as decoration. Dragging reorders, and
 * dropping into another group moves the conversation there, so dragging into "pinned" pins it.
 */
export function ChatList({
  chats, onChange, openId, onOpen, onNew, open, shut, onShut, onRemove, onExport,
}: ChatListProps) {
  const [query, setQuery] = useState('')
  /* Audit 26 Nov · rename in place (Enter saves, Esc cancels, leaving saves) · delete asks first */
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const rename = (id: string) => {
    const t = name.trim().replace(/\s+/g, ' ')
    if (t) onChange(chats.map((c) => (c.id === id ? { ...c, title: t.slice(0, 80) } : c)))
    setEditing(null)
  }
  /* Note: this list used to be a bare `useState` with no click-outside handling - the same behavior
     written once in `useMenu` for six other lists, and this seventh one was missed because its
     state is an id, not a boolean. */
  const menu = useMenuOf<HTMLDivElement>()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const filtered = chats.filter(
    (c) => !query || c.title.includes(query) || c.snippet.includes(query),
  )

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return

    const from = chats.findIndex((c) => c.id === dragId)
    const to = chats.findIndex((c) => c.id === targetId)
    if (from === -1 || to === -1) return

    const next = [...chats]
    const [moved] = next.splice(from, 1)
    const at = to > from ? to - 1 : to
    const target = next[at]
    if (moved && target) {
      next.splice(at, 0, { ...moved, pinned: target.pinned, group: target.group })
      onChange(next)
    }

    setDragId(null)
    setOverId(null)
  }

  const togglePin = (id: string) => {
    onChange(chats.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)))
    menu.close()
  }

  const remove = (id: string) => {
    onRemove(id)
    setAsking(null)
  }
  const doomed = chats.find((c) => c.id === asking)

  return (
    <aside className={`chatlist chrome${open ? ' on' : ''}${shut ? ' shut' : ''}`}>
      <div className="cl-head">
        <span className="cl-title">المحادثات</span>
        {/* Note: the collapse button lives inside the sidebar, not in the conversation header -
            whoever collapses something clicks on it, and whoever restores it clicks where it was.
            So this button collapses, and a different button in the conversation header restores it. */}
        <Button plain
          className="cl-new"
          onClick={onShut}
          title="اطوِ المحادثات"
          aria-label="اطوِ المحادثات"
        >
          <Icon name={icons.panel} size="sm" />
        </Button>
        <Button plain className="cl-new" onClick={onNew} title="محادثة جديدة · ⌘⇧O" aria-label="محادثة جديدة">
          <Icon name={icons.plus} size="sm" />
        </Button>
      </div>

      <div className="cl-search">
        <Icon name={icons.search} size="sm" style={{ color: 'var(--t3)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث في محادثاتك…"
        />
      </div>

      <div className="cl-body">
        {GROUPS.map((group) => {
          const rows = filtered.filter((c) => (c.pinned ? 'مثبّتة' : c.group) === group)
          if (!rows.length) return null

          return (
            <div key={group} className="cl-group">
              <div className="cl-gt">{group}</div>

              {rows.map((c) => (
                <div
                  key={c.id}
                  ref={menu.id === c.id ? menu.box : undefined}
                  className={
                    `cl-row${openId === c.id ? ' on' : ''}` +
                    `${dragId === c.id ? ' dragging' : ''}${overId === c.id ? ' over' : ''}`
                  }
                  draggable
                  onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { setDragId(null); setOverId(null) }}
                  onDragOver={(e) => { e.preventDefault(); setOverId(c.id) }}
                  onDragLeave={() => setOverId((v) => (v === c.id ? null : v))}
                  onDrop={(e) => { e.preventDefault(); drop(c.id) }}
                >
                  <span className="cl-grip" aria-hidden="true">
                    <Icon name={icons.grip} size="sm" />
                  </span>

                  {editing === c.id ? (
                    <input
                      className="cl-edit"
                      value={name}
                      autoFocus
                      maxLength={80}
                      aria-label="اسم المحادثة"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') rename(c.id); if (e.key === 'Escape') setEditing(null) }}
                      onBlur={() => rename(c.id)}
                    />
                  ) : (
                  <Button plain className="cl-main" onClick={() => onOpen(c.id)} title={c.title} aria-current={openId === c.id ? 'true' : undefined}>
                    {/* 11 Oct · audit UI-215/216 · the title is its own box so it can end in «…» (a
                        flex row can't), and the pin follows it, so pinned and unpinned titles start
                        on the same edge. */}
                    <div className="cl-t">
                      <span className="cl-tx">{c.title}</span>
                      {c.pinned && <Icon name={icons.pin} size="sm" />}
                    </div>
                  </Button>
                  )}

                  <Button plain
                    className="cl-more"
                    aria-label="خيارات المحادثة"
                    onClick={() => menu.toggle(c.id)}
                  >
                    <Icon name={icons.dots} size="sm" />
                  </Button>

                  {menu.id === c.id && (
                    <div className="cl-menu chrome">
                      <Button plain onClick={() => togglePin(c.id)}>
                        <Icon name={icons.pin} size="sm" />
                        {c.pinned ? 'ألغِ التثبيت' : 'ثبّت المحادثة'}
                      </Button>
                      <Button plain onClick={() => { setName(c.title); setEditing(c.id); menu.close() }}>
                        <Icon name={icons.edit} size="sm" />
                        أعد التسمية
                      </Button>
                      <Button plain onClick={() => { onExport(c.id); menu.close() }}>
                        <Icon name={icons.file} size="sm" />
                        صدّر المحادثة
                      </Button>
                      <Button plain className="danger" onClick={() => { setAsking(c.id); menu.close() }}>
                        <Icon name={icons.trash} size="sm" />
                        احذف المحادثة
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {!filtered.length && <div className="cl-empty sub">لا توجد محادثات مطابقة</div>}
      </div>

      <div className="cl-foot sub">{countSay(chats.length)}</div>

      {doomed && (
        <Modal label="حذف المحادثة" onClose={() => setAsking(null)} escape>
          <ModalHead icon={icons.trash} title="حذف المحادثة" />
          <div className="mb col">
            <p className="cnote">ستُحذف «<b>{doomed.title}</b>» وكل ما فيها، ولا يمكن استرجاعها بعد الحذف.</p>
          </div>
          <div className="mf">
            <Button variant="d" onClick={() => remove(doomed.id)}>احذف المحادثة</Button>
            <Button variant="2" autoFocus onClick={() => setAsking(null)}>تراجع</Button>
          </div>
        </Modal>
      )}
    </aside>
  )
}
