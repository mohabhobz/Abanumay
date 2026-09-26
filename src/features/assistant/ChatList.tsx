import { useState } from 'react'
import { Icon, icons } from '@/components/ui'
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
}

/**
 * List of saved conversations.
 *
 * Pinning and search were requested directly, not added as decoration. Dragging reorders, and
 * dropping into another group moves the conversation there, so dragging into "pinned" pins it.
 */
export function ChatList({
  chats, onChange, openId, onOpen, onNew, open, shut, onShut,
}: ChatListProps) {
  const [query, setQuery] = useState('')
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
    onChange(chats.filter((c) => c.id !== id))
    menu.close()
  }

  return (
    <aside className={`chatlist chrome${open ? ' on' : ''}${shut ? ' shut' : ''}`}>
      <div className="cl-head">
        <span className="cl-title">المحادثات</span>
        {/* Note: the collapse button lives inside the sidebar, not in the conversation header -
            whoever collapses something clicks on it, and whoever restores it clicks where it was.
            So this button collapses, and a different button in the conversation header restores it. */}
        <button
          className="cl-new"
          onClick={onShut}
          title="اطوِ المحادثات"
          aria-label="اطوِ المحادثات"
        >
          <Icon name={icons.panel} size="sm" />
        </button>
        <button className="cl-new" onClick={onNew} title="محادثة جديدة · ⌘⇧O" aria-label="محادثة جديدة">
          <Icon name={icons.plus} size="sm" />
        </button>
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

                  <button className="cl-main" onClick={() => onOpen(c.id)}>
                    <div className="cl-t">
                      {c.pinned && <Icon name={icons.pin} size="sm" />}
                      {c.title}
                    </div>
                  </button>

                  <button
                    className="cl-more"
                    aria-label="خيارات المحادثة"
                    onClick={() => menu.toggle(c.id)}
                  >
                    <Icon name={icons.dots} size="sm" />
                  </button>

                  {menu.id === c.id && (
                    <div className="cl-menu chrome">
                      <button onClick={() => togglePin(c.id)}>
                        <Icon name={icons.pin} size="sm" />
                        {c.pinned ? 'ألغِ التثبيت' : 'ثبّت المحادثة'}
                      </button>
                      <button onClick={menu.close}>
                        <Icon name={icons.edit} size="sm" />
                        أعد التسمية
                      </button>
                      <button onClick={menu.close}>
                        <Icon name={icons.file} size="sm" />
                        صدّر المحادثة
                      </button>
                      <button className="danger" onClick={() => remove(c.id)}>
                        <Icon name={icons.trash} size="sm" />
                        احذف المحادثة
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {!filtered.length && <div className="cl-empty sub">لا توجد محادثات مطابقة</div>}
      </div>

      <div className="cl-foot sub">
        المحادثات محفوظة لك وحدك · <b>{chats.length}</b> محادثة
      </div>
    </aside>
  )
}
