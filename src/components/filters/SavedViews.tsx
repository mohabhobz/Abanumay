import { useEffect, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { Icon, icons } from '@/components/ui'
import { readViews, writeViews, type SavedView } from './views'

/* ═══════════════════════════════════════════════════════════
   ي-12 · «الفيوهات» اسم مش مفهوم

   مظفر بالنص: «**ما اتفهمتش من أول مرة ولا تاني مرة، لازم
   تتشرح**» · ومهاب وافق.

   ⚠️ **والمشكلة مش ترجمة الكلمة، هي إن الاسم بيسمّي الشيء لا
   الفعل.** «فيو» اسم لحاجة مجرّدة المستخدم ما شافهاش قبل كده، و
   «العروض المحفوظة» ترجمة حرفية بنفس الغموض. اللي المستخدم بيعمله
   فعليًّا هو: **حفظ الوضع الحالي** عشان يرجّعه بعدين.

   فالزرار بقى «الوضع المحفوظ» والفعل جوّاه «احفظ الوضع الحالي»،
   وتحته سطر بيقول **إيه اللي بيتحفظ بالظبط**: الفلتر والترتيب
   والتجميع والأعمدة. الاسم الغامض بيتشرح بالجملة اللي تحته لا
   بمحاولة اسم أذكى.

   ⚠️ **وقرار الفصل اتّاخد: فيو واحد بيحفظ كل حاجة.** مظفر: «زيادة
   فانكشنز جوّه فانكشنز بتعقّد الدنيا أكتر ما بتحلّ» · فمفيش حفظ
   منفصل للفلاتر وحفظ منفصل للأعمدة.
   ═══════════════════════════════════════════════════════════ */
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
        {active ? active.name : 'الوضع المحفوظ'}
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
              مفيش أوضاع محفوظة. اضبط الشاشة زي ما بتحبّها واحفظها باسم، وارجّعها بضغطة.
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
              placeholder="سمّي الوضع الحالي…"
              aria-label="اسم الوضع المحفوظ"
            />
            <button className="btn btn-p btn-sm" disabled={!trimmed} onClick={save}>
              {existing ? 'حدّث' : 'احفظ'}
            </button>
          </div>
          {/* ⚠️ **اللي بيتحفظ مكتوب، مش متروك للتخمين.** الزرار
              اسمه «احفظ» والمستخدم بيسأل «احفظ إيه؟» · والسطر ده
              هو الإجابة، وهو كمان اللي بيخلّي قرار «فيو واحد
              بيحفظ كل حاجة» مفهومًا بدل ما يبان نقصًا. */}
          <div className="fviews-n sub">
            بيتحفظ: الفلتر والبحث والترتيب <b>والتجميع</b> وعدد الصفوف.
          </div>
          {existing && (
            <div className="fviews-n sub">فيه واحد بنفس الاسم، الحفظ هيحدّثه.</div>
          )}
        </div>
      )}
    </div>
  )
}
