import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Arriving from an action lands on the part of the page that explains it.
 *
 * Any link can carry a hash (`/payments?entity=755#pay-list`): once the target screen has rendered,
 * the element with that id scrolls into view and gets a short highlight (`.arrive`), so the user
 * sees why they were brought here instead of starting from the top. Screens render their data
 * synchronously today but may not once the backend is connected, so the element is looked up for a
 * short while before giving up.
 */
export function useHashScroll() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''))
    if (!id) return
    let tries = 0
    let timer = 0
    const find = () => {
      const el = document.getElementById(id)
      if (el) {
        /* Smooth scrolling is kept for desktop only. On phones a long smooth scroll is cut short
           when the page keeps growing under it (entrance animations, charts sizing themselves),
           so it stopped at the top; a direct jump always lands. */
        const smooth =
          !matchMedia('(prefers-reduced-motion: reduce)').matches &&
          !matchMedia('(max-width: 860px)').matches
        el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
        /* Once the layout has settled, correct the position if it drifted off the target. */
        window.setTimeout(() => {
          const top = el.getBoundingClientRect().top
          const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
          if (Math.abs(top - margin) > 48) el.scrollIntoView({ behavior: 'auto', block: 'start' })
        }, smooth ? 900 : 350)
        el.classList.remove('arrive')
        void el.offsetWidth
        el.classList.add('arrive')
        timer = window.setTimeout(() => el.classList.remove('arrive'), 2400)
        return
      }
      if (tries++ < 30) timer = window.setTimeout(find, 50)
    }
    timer = window.setTimeout(find, 30)
    return () => window.clearTimeout(timer)
  }, [pathname, search, hash])
}
