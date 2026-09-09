import { useEffect, useRef, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { readViews, writeViews, type SavedView } from './views'

export function SavedViews({
  table, current, onApply,
}: {
  table: string
  /** لقطة الشاشة الحالية */
  current: string
  onApply: (query: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<SavedView[]>(() => readViews(table))
  const [name, setName] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  useEffect(() => { if (!open) setName('') }, [open])

  const active = views.find((v) => v.query === current)
  const trimmed = name.trim()
  /* الاسم المكرَّر بيحدّث الفيو القديم ما يعملش نسخة تانية: القائمة
     اللي فيها تلات حاجات بنفس الاسم مش قائمة، هي عبء. */
  const existing = views.find((v) => v.name === trimmed)

  const save = () => {
    if (!trimmed) return
    const next = existing
      ? views.map((v) => (v.id === existing.id ? { ...v, query: current } : v))
      : [{ id: String(Date.now()), name: trimmed, query: current }, ...views]
    setViews(writeViews(table, next))
    setName('')
  }

  const remove = (id: string) => setViews(writeViews(table, views.filter((v) => v.id !== id)))

  return (
    <div className="fviews" ref={box}>
      <button
        className={`fchip${active ? ' on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
      >
        <Icon path={icons.pin} size={15} />
        {active ? active.name : 'الفيوهات'}
        {!active && views.length > 0 && <b className="num">{views.length}</b>}
      </button>

      {open && (
        <div className="fmenu fviews-m">
          {views.length === 0 ? (
            <div className="fmenu-e sub">
              مفيش فيوهات محفوظة. اضبط الفلاتر اللي بتستخدمها كل يوم واحفظها باسم.
            </div>
          ) : (
            <div className="fmenu-l" role="menu">
              {views.map((v) => (
                <div key={v.id} className={`fopt fview${v.query === current ? ' on' : ''}`}>
                  <button
                    type="button"
                    className="fview-t"
                    onClick={() => { setOpen(false); onApply(v.query) }}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    className="fview-x"
                    aria-label={`حذف ${v.name}`}
                    onClick={() => remove(v.id)}
                  >
                    <Icon path={icons.close} size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="fviews-f">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
              placeholder="اسم الفيو…"
              aria-label="اسم الفيو"
            />
            <button className="btn btn-p btn-sm" disabled={!trimmed} onClick={save}>
              {existing ? 'حدّث' : 'احفظ'}
            </button>
          </div>
          {existing && (
            <div className="fviews-n sub">فيه فيو بنفس الاسم — الحفظ هيحدّثه.</div>
          )}
        </div>
      )}
    </div>
  )
}
