import { useEffect, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { Icon, icons } from '@/components/ui'
import { readViews, writeViews, type SavedView } from './views'

/* "Views" is a name that doesn't land.

   Feedback was blunt: it wasn't understood the first time or the second, and needed explaining.

   ⚠️ **The problem isn't the translation of the word, it's that the name names the thing, not the
   action.** "View" names an abstract object the user has never seen before, and a literal
   translation carries the same vagueness. What the user is actually doing is: **saving the current
   state** to bring it back later.

   So the button became "Saved state," with "Save current state" as its action, and a line
   underneath stating **exactly what gets saved**: filter, sort, grouping, and columns. The vague
   name gets explained by the sentence under it, not by chasing a cleverer name.

   ⚠️ **And the decision was made not to split it: one saved state saves everything.** Splitting
   filters and columns into separate saves would add complexity, not remove it. */
export function SavedViews({
  table, current, onApply,
}: {
  table: string
  /** Snapshot of the current screen. */
  current: string
  onApply: (query: string) => void
}) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [views, setViews] = useState<SavedView[]>(() => readViews(table))
  const [name, setName] = useState('')
  useEffect(() => { if (!open) setName('') }, [open])

  const active = views.find((v) => v.query === current)
  const trimmed = name.trim()
  /* A duplicate name updates the old saved state instead of creating another — a list with several
     items sharing a name isn't a list, it's clutter. */
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
        <Icon name={icons.pin} size="sm" />
        {active ? active.name : 'الوضع المحفوظ'}
        {!active && views.length > 0 && <b className="num">{views.length}</b>}
      </button>

      {open && (
        <div className="fmenu fviews-m">
          {/* -- Original design --
              The list used to be one-way: click a saved state, the screen changes, and there's no
              clear way back — anyone wanting to return had to remove filters one by one until the
              chip cleared. This row is that way back, and it's also **a status indicator**: it
              clears when no saved state is selected, so the list says "where you are," not just
              "where to go." */}
          <div className="fmenu-l" role="menu">
            <div className={`fopt fview fview-0${active ? '' : ' on'}`}>
              <button
                type="button"
                className="fview-t"
                onClick={() => { setOpen(false); onApply('') }}
              >
                <Icon name={icons.redo} size="sm" />
                العرض الأصلي
              </button>
            </div>
          </div>

          {views.length === 0 ? (
            <div className="fmenu-e sub">
              لا توجد أوضاع محفوظة. اضبط الشاشة كما تريد واحفظها باسم لتستعيدها بضغطة.
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
                  {/* A trash icon, not an X — X means "close" everywhere else in the system, and
                      this row gets removed, not closed. Same icon set as everywhere else. */}
                  <button
                    type="button"
                    className="fview-x"
                    aria-label={`حذف ${v.name}`}
                    title={`حذف ${v.name}`}
                    onClick={() => remove(v.id)}
                  >
                    <Icon name={icons.trash} size="sm" />
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
              placeholder="سمِّ الوضع الحالي…"
              aria-label="اسم الوضع المحفوظ"
            />
            <button className="btn btn-p btn-sm" disabled={!trimmed} onClick={save}>
              {existing ? 'حدّث' : 'احفظ'}
            </button>
          </div>
          {/* ⚠️ **What gets saved is stated, not left to guessing.** The button says "Save," and
              the user asks "save what?" — this line is the answer, and it's also what makes the
              "one saved state saves everything" decision legible instead of looking like a gap. */}
          <div className="fviews-n sub">
            يُحفظ: الفلتر والبحث والترتيب <b>والتجميع</b> وعدد الصفوف.
          </div>
          {existing && (
            <div className="fviews-n sub">يوجد وضع بالاسم نفسه، وسيُحدَّث عند الحفظ.</div>
          )}
        </div>
      )}
    </div>
  )
}
