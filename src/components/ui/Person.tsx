import { useLayoutEffect, useRef } from 'react'
import { isNobody, isPerson, person } from '@/data/people'

/* 11 Oct · audit UI-068 and five more · two Arabic initials in bold are wider than a 28px box in
   some faces («س‌ف» measured 30px), so they were cut at its edges. The letters keep their size in
   the type scale and shrink to fit the box only when they have to, with a margin each side. */
function Initials({ text, box, title }: { text: string; box: string; title: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!el || !host) return
    const fit = () => {
      el.style.removeProperty('--av-s')
      const room = host.clientWidth - 6
      const w = el.scrollWidth
      if (w > room && w > 0) el.style.setProperty('--av-s', String(Math.max(0.6, room / w)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready.then(fit).catch(() => undefined)
    return () => ro.disconnect()
  }, [text])
  return <span className={`av av-${box}`} title={title} aria-hidden="true"><span className="av-i" ref={ref}>{text}</span></span>
}

/* Person · face and name together.

   The name alone can be read, and the face can be recognized. In a list of five reviewers who all
   start with the same letter, telling them apart comes from **shape**, not from reading the line to
   the end — that's the difference between picking by glance and picking by comparison.

   Warning: **one component for every place a person appears.** If every screen drew its own avatar,
   sizes and corners would differ for the same thing — exactly the pattern the whole system was
   unified to get away from.

   Warning: **initials are deliberately neutral — no per-person color.** The temptation is for each
   face to get a color derived from its name, but the cost is a **new color family with no key**:
   chart colors are reserved for categories, status colors are reserved for status, and a third set
   stepping in between would make green on screen mean three different things. The real photo is
   what actually distinguishes people; the initial is just a placeholder until the photo loads. */

export interface PersonProps {
  /** Name as stored in the data · the record turns it into a face */
  name: string | null | undefined
  /** Text shown when there is no person (no owner · unassigned) */
  empty?: string
  /** 28px by default · `lg` = 34 for the decision bar and the account menu */
  size?: 'sm' | 'md' | 'lg'
  /** Face only, no name · for narrow cells */
  bare?: boolean
  /** Dims the name like `.sub` · the default in cards and cells */
  quiet?: boolean
}

/** Face only · reuses the same `.av`/`.pht` box as the account menu */
export function Face({ name, size = 'sm' }: { name: string; size?: PersonProps['size'] }) {
  const p = person(name)
  const box = size === 'lg' ? '34' : size === 'md' ? '30' : '28'
  const title = p.title ? `${p.name}، ${p.title}` : p.name
  if (p.photo) return <img className={`pht pht-${box}`} src={p.photo} alt="" title={title} />
  return <Initials text={p.initial} box={box} title={title} />
}

export function Person({ name, empty = 'بلا مالك', size = 'sm', bare, quiet = true }: PersonProps) {
  /* Warning: "unassigned" is **not a person**, so it gets no face. An initials avatar on a value
     like this reads as a person literally named "unassigned." */
  if (!isPerson(name)) {
    /* Warning: **a role is shown by its name.** "Grants supervisor" is not "unassigned": a role has
       no face, but it does have a name. `empty` is only for values that are genuinely empty. */
    return <span className={quiet ? 'sub' : undefined}>{isNobody(name) ? empty : name!.trim()}</span>
  }
  const p = person(name)
  if (bare) return <Face name={p.name} size={size} />
  return (
    <span className={`prs prs-${size}`}>
      <Face name={p.name} size={size} />
      <span className={quiet ? 'prs-n sub' : 'prs-n'}>{p.name}</span>
    </span>
  )
}
