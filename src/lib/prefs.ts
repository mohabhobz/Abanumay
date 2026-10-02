import { useCallback, useEffect, useState } from 'react'

/**
 * Personal preferences · display, accessibility, notifications and delegation.
 *
 * Accessibility choices apply to the whole document as `data-*` attributes on `<html>`, and the
 * CSS reads them (see «Accessibility preferences» at the end of `index.css`), so every screen,
 * input and menu follows without a component knowing about it. `index.html` applies the same
 * attributes before the first paint, so a large-text user never sees the small page flash first.
 *
 * Storage is the browser (`localStorage`, wrapped in try). In production these become the user's
 * profile on the server, so they follow them across devices.
 */

export type TextSize = '100' | '112' | '125' | '150'

export interface A11y {
  /** Text size · scales every rem-based size, and the control line so heights stay 44px */
  text: TextSize
  /** Heavier strokes on all text, for low vision */
  bold: boolean
  /** Secondary text close to primary, stronger borders on cards and controls */
  contrast: boolean
  /** `system` follows the device; `reduce` stops movement regardless of the device */
  motion: 'system' | 'reduce'
  /** Links underlined, so they don't depend on color alone */
  links: boolean
  /** A thick, always-visible focus ring for keyboard users */
  focus: boolean
  /** Wider word and line spacing (WCAG 1.4.12). No letter spacing: it breaks Arabic joining */
  spacing: boolean
}

export const A11Y_DEFAULT: A11y = {
  text: '100', bold: false, contrast: false, motion: 'system', links: false, focus: false, spacing: false,
}

export const A11Y_KEY = 'ab-a11y'

export const readA11y = (): A11y => {
  try {
    const raw = localStorage.getItem(A11Y_KEY)
    return raw ? { ...A11Y_DEFAULT, ...(JSON.parse(raw) as Partial<A11y>) } : A11Y_DEFAULT
  } catch {
    return A11Y_DEFAULT
  }
}

export const applyA11y = (a: A11y): void => {
  const el = document.documentElement
  const flag = (name: string, on: boolean) => (on ? el.setAttribute(name, '') : el.removeAttribute(name))
  if (a.text === '100') el.removeAttribute('data-text')
  else el.setAttribute('data-text', a.text)
  flag('data-bold', a.bold)
  flag('data-contrast', a.contrast)
  if (a.motion === 'reduce') el.setAttribute('data-motion', 'reduce')
  else el.removeAttribute('data-motion')
  flag('data-links', a.links)
  flag('data-focus', a.focus)
  flag('data-spacing', a.spacing)
}

const writeJSON = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* Storage blocked · the choice still applies for this visit. */
  }
}

export function useA11y(): [A11y, (patch: Partial<A11y>) => void, () => void] {
  const [a, setA] = useState<A11y>(readA11y)
  useEffect(() => {
    applyA11y(a)
    writeJSON(A11Y_KEY, a)
  }, [a])
  const set = useCallback((patch: Partial<A11y>) => setA((x) => ({ ...x, ...patch })), [])
  const reset = useCallback(() => setA(A11Y_DEFAULT), [])
  return [a, set, reset]
}

/**
 * Motion is reduced when the device asks for it **or** the user chose it here. Scripts that animate
 * (count-up, smooth scroll, typing) read this instead of the media query alone.
 */
export const reducedMotion = (): boolean =>
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  (typeof document !== 'undefined' && document.documentElement.getAttribute('data-motion') === 'reduce')

/* ── Generic stored state for the rest of the preferences (notifications, delegation, display) ── */

export function useStored<T>(key: string, initial: T): [T, (next: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? ({ ...initial, ...(JSON.parse(raw) as object) } as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => { writeJSON(key, v) }, [key, v])
  return [v, setV]
}

/* ── Display ── */

export type CalendarChoice = 'gregory' | 'hijri' | 'both'

export interface Display {
  /** Calendar for every date in the system · read by `readDate` through `data-cal` */
  cal: CalendarChoice
  /** Where the user lands after signing in */
  landing: string
}

export const DISPLAY_KEY = 'ab-display'

export const readDisplay = (): Display => {
  try {
    const raw = localStorage.getItem(DISPLAY_KEY)
    return { cal: 'gregory', landing: '', ...(raw ? (JSON.parse(raw) as Partial<Display>) : {}) }
  } catch {
    return { cal: 'gregory', landing: '' }
  }
}

export const applyDisplay = (d: Display): void => {
  const el = document.documentElement
  if (d.cal === 'gregory') el.removeAttribute('data-cal')
  else el.setAttribute('data-cal', d.cal)
}

export function useDisplay(): [Display, (patch: Partial<Display>) => void] {
  const [d, setD] = useState<Display>(readDisplay)
  useEffect(() => {
    applyDisplay(d)
    writeJSON(DISPLAY_KEY, d)
  }, [d])
  return [d, useCallback((patch: Partial<Display>) => setD((x) => ({ ...x, ...patch })), [])]
}
