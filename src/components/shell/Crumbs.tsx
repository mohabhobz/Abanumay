import { Link } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { useMenu } from '@/hooks/useMenu'
import { Trail } from '@/components/soul'

/* Breadcrumbs.

   ⚠️ **A hierarchy, not a history.** This was settled with the folder-path analogy, and it's the
   first rule any research on the subject states. The practical reason here specifically: **the way
   into the system usually comes from a notification or a shared link** (every transition requires a
   notification), and anything arriving from outside **has no history at all** — so a history-based
   path would come up empty in the most common case this is designed for.

   History already exists: the browser's back button. That's browser behavior, not application
   behavior.

   ⚠️ **And the path is written on the page, not derived from the URL.** Deriving it gives ids and
   slugs, not names. The page is the only place that knows an id like `755` means, for example,
   "Scientific Building Society."

   ⚠️ **And the last item isn't a link.** A link leading to the screen you're already on breaks
   expectations — the user clicks and nothing happens, and assumes the screen is stuck. It's also
   what keeps `aria-current="page"` truthful.

   ⚠️ **And never two lines.** A path that wraps to two lines stops being a path and becomes a list
   of words. The overflow collapses into an ellipsis with a list, it never wraps down. */

export interface Crumb {
  label: string
  /** Its absence means this item is the current page. */
  to?: string
}

export interface CrumbsProps {
  /** From the root to the current page — the last item is where you are. */
  items: Crumb[]
}

/**
 * Above this count, the middle items collapse into an ellipsis.
 * ⚠️ **Four isn't an arbitrary number:** the deepest path in the system is four levels, so the
 * collapse kicks in only past that depth — meaning it practically never shows in the normal case.
 */
const FLAT = 4

export function Crumbs({ items }: CrumbsProps) {
  const { open, setOpen, box } = useMenu<HTMLSpanElement>()

  /* No path on a flat screen: a single level means there's no hierarchy to show, and one item in a
     nav element is just noise. */
  if (items.length < 2) return null

  const deep = items.length > FLAT
  /* The root and the last two items stay visible; the middle ones are what collapses, because the
     root says which module you're in and the last one says where you are. */
  const head = deep ? items[0] : undefined
  const folded = deep ? items.slice(1, items.length - 2) : []
  const tail = deep ? items.slice(items.length - 2) : items

  const link = (c: Crumb, i: number) =>
    c.to ? (
      <Link key={`${c.label}-${i}`} className="crumb" to={c.to} title={c.label}>
        {c.label}
      </Link>
    ) : (
      <span key={`${c.label}-${i}`} className="crumb now" aria-current="page" title={c.label}>
        {c.label}
      </span>
    )

  const sep = (k: string) => (
    <Icon key={`s-${k}`} name={icons.chevron} size="sm" className="crumb-s" />
  )

  /* A secondary visual layer: an underline beneath the path with two leaves at its end. */
  return (
    <div className="waypoint">
    <nav className="crumbs" aria-label="مسار الصفحة">
      {/* An ordered list, because order carries meaning: the first is the parent, the last is the
          child, and a screen reader says "item 2 of 4," giving depth with no need for sight. */}
      <ol>
        {head && (
          <li>
            {link(head, 0)}
            {sep('h')}
          </li>
        )}

        {folded.length > 0 && (
          <li>
            <span className="crumb-f" ref={box}>
              <button
                type="button"
                className="crumb crumb-b"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${folded.length} مستويات مطويّة`}
                title="المستويات الوسطى من المسار"
                onClick={() => setOpen((x) => !x)}
              >
                …
              </button>
              {open && (
                <div className="fmenu crumb-m">
                  <div className="fmenu-l" role="menu">
                    {folded.map((c, i) =>
                      c.to ? (
                        <Link
                          key={`${c.label}-${i}`}
                          role="menuitem"
                          className="fopt"
                          to={c.to}
                          onClick={() => setOpen(false)}
                        >
                          <span className="fopt-t">{c.label}</span>
                        </Link>
                      ) : null,
                    )}
                  </div>
                </div>
              )}
            </span>
            {sep('f')}
          </li>
        )}

        {tail.map((c, i) => (
          <li key={`${c.label}-${i}`}>
            {link(c, i)}
            {i < tail.length - 1 && sep(String(i))}
          </li>
        ))}
      </ol>
    </nav>
    <Trail />
    </div>
  )
}
