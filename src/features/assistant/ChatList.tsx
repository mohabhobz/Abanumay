import { useState } from 'react'
import { Icon, icons } from '@/components/ui'
import type { SavedChat } from '@/data/mock/assistant'

/** المجموعات بترتيبها في القائمة — «مثبّتة» بتسبق أي تاريخ */
const GROUPS = ['مثبّتة', 'اليوم', 'أمس', 'آخر 7 أيام'] as const

export interface ChatListProps {
  chats: SavedChat[]
  onChange: (chats: SavedChat[]) => void
  openId: string | null
  onOpen: (id: string) => void
  onNew: () => void
  /** مفتوحة فوق المحتوى على الموبايل */
  open: boolean
}

/**
 * قائمة المحادثات المحفوظة.
 *
 * العميل قال بالنص: «أنا امبارح دورت على كذا، عايز أثبته معايا» —
 * فالتثبيت والبحث ردّ على طلب صريح، مش زينة. والسحب بيرتّب، والإفلات
 * في مجموعة تانية بينقل المحادثة ليها، فسحبها لـ«مثبّتة» بيثبّتها.
 */
export function ChatList({ chats, onChange, openId, onOpen, onNew, open }: ChatListProps) {
  const [query, setQuery] = useState('')
  const [menuId, setMenuId] = useState<string | null>(null)
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
    setMenuId(null)
  }

  const remove = (id: string) => {
    onChange(chats.filter((c) => c.id !== id))
    setMenuId(null)
  }

  return (
    <aside className={`chatlist chrome${open ? ' on' : ''}`}>
      <div className="cl-head">
        <span className="cl-title">المحادثات</span>
        <button className="cl-new" onClick={onNew} title="محادثة جديدة · ⌘⇧O" aria-label="محادثة جديدة">
          <Icon name={icons.plus} size={16} />
        </button>
      </div>

      <div className="cl-search">
        <Icon name={icons.search} size={16} style={{ color: 'var(--t3)' }} />
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
                    <Icon name={icons.grip} size={16} />
                  </span>

                  <button className="cl-main" onClick={() => onOpen(c.id)}>
                    <div className="cl-t">
                      {c.pinned && <Icon name={icons.pin} size={14} />}
                      {c.title}
                    </div>
                  </button>

                  <button
                    className="cl-more"
                    aria-label="خيارات"
                    onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                  >
                    <Icon name={icons.dots} size={16} />
                  </button>

                  {menuId === c.id && (
                    <div className="cl-menu chrome">
                      <button onClick={() => togglePin(c.id)}>
                        <Icon name={icons.pin} size={16} />
                        {c.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                      </button>
                      <button onClick={() => setMenuId(null)}>
                        <Icon name={icons.edit} size={16} />
                        إعادة تسمية
                      </button>
                      <button onClick={() => setMenuId(null)}>
                        <Icon name={icons.file} size={16} />
                        تصدير المحادثة
                      </button>
                      <button className="danger" onClick={() => remove(c.id)}>
                        <Icon name={icons.trash} size={16} />
                        حذف
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {!filtered.length && <div className="cl-empty sub">مفيش محادثات مطابقة</div>}
      </div>

      <div className="cl-foot sub">
        المحادثات محفوظة لك وحدك · <b>{chats.length}</b> محادثة
      </div>
    </aside>
  )
}
