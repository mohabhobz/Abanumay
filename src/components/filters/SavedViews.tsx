import { useEffect, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
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
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  const [views, setViews] = useState<SavedView[]>(() => readViews(table))
  const [name, setName] = useState('')
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
        <Icon name={icons.pin} size={15} />
        {active ? active.name : 'الفيوهات'}
        {!active && views.length > 0 && <b className="num">{views.length}</b>}
      </button>

      {open && (
        <div className="fmenu fviews-m">
          {/* ══ العرض الأصلي ══
              القايمة كانت بتوَدّي ومَتِرجَّعش: تدوس فيو، الشاشة
              تتغيّر، وما فيش طريق معلوم للرجوع · اللي عايز يرجع
              لازم يفضل يشيل الفلاتر واحدًا واحدًا لحدّ ما الشريحة
              تطفي. الصفّ ده هو الطريق، وهو كمان **حالة**: بيتعلّم
              لمّا ما يكونش في فيو مختار، فالقايمة بتقول «إنت فين»
              لا «روح فين» بس. */}
          <div className="fmenu-l" role="menu">
            <div className={`fopt fview fview-0${active ? '' : ' on'}`}>
              <button
                type="button"
                className="fview-t"
                onClick={() => { setOpen(false); onApply('') }}
              >
                <Icon name={icons.redo} size={14} />
                العرض الأصلي
              </button>
            </div>
          </div>

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
                  {/* سلّة لا إكس · الإكس معناها «اقفل» في كل مكان
                      تاني في السيستم، والصفّ ده بيتشال لا بيتقفل.
                      ونفس المكتبة (لوسيد) زي كل أيقونة. */}
                  <button
                    type="button"
                    className="fview-x"
                    aria-label={`حذف ${v.name}`}
                    title={`حذف ${v.name}`}
                    onClick={() => remove(v.id)}
                  >
                    <Icon name={icons.trash} size={15} />
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
            <div className="fviews-n sub">فيه فيو بنفس الاسم، الحفظ هيحدّثه.</div>
          )}
        </div>
      )}
    </div>
  )
}
