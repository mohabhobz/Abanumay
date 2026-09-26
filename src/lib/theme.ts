/**
 * Theme — two named modes, no "follow system."
 *
 * A third mode used to exist (green, the brand's identity) and was
 * removed. While it existed, "follow system" made no sense: the device
 * only reports light or dark, it has no way to say "green." Now that
 * the two modes are true opposites, "follow system" would be possible
 * — but it isn't added until someone actually asks for it, and the
 * choice stays explicit as it is.
 *
 * The logic lives here rather than in the account menu, because the
 * choice needs to apply before React even runs: a small script in
 * `index.html` reads the same key and sets `data-theme` before the
 * first paint, so there's no light-mode flash. And because the sign-in
 * screen has no account menu, without this it would always stay stuck
 * in light mode.
 */
export type ThemeChoice = 'light' | 'dark'

export const THEMES: readonly ThemeChoice[] = ['light', 'dark']

export const THEME_KEY = 'ab-theme'

const isTheme = (v: unknown): v is ThemeChoice =>
  v === 'light' || v === 'dark'

export const readTheme = (): ThemeChoice => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return isTheme(saved) ? saved : 'light'
  } catch {
    return 'light'
  }
}

export const applyTheme = (theme: ThemeChoice): void => {
  document.documentElement.setAttribute('data-theme', theme)
}

export const writeTheme = (theme: ThemeChoice): void => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* Storage may be unavailable — the choice still works for this session. */
  }
}
