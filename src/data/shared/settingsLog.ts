/* The history of the rules' changes · re-audit 7 Oct (cross · audit trail).

   The escalation and notification settings used to leave one line in the audit log — the last save,
   overwritten by the next — with no earlier saves and no values. And a stage's days edited from a
   module's own settings page left nothing at all. Every save now appends one entry with each
   changed value before and after; nothing is overwritten or removed.

   In production the server keeps this table · the browser's copy stands in for the prototype. */

const KEY = 'ab-settings-log'

export interface SettingChange { k: string; from: string; to: string }
export interface SettingsEntry {
  id: string
  /** ISO time of the save */
  at: string
  by: string
  /** What was edited · «آلية التصعيد», «قنوات الإشعار», «مدد مراحل الاتفاقيات»… */
  ref: string
  /** The page it was edited on */
  href: string
  changes: SettingChange[]
}

export const SETTINGS_LOG: SettingsEntry[] = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SettingsEntry[] } catch { return [] }
})()

/** Record one save · an entry with no change isn't written */
export function logSettings(ref: string, href: string, by: string, changes: SettingChange[]): void {
  if (!changes.length) return
  SETTINGS_LOG.push({ id: `set-${SETTINGS_LOG.length + 1}`, at: new Date().toISOString(), by, ref, href, changes })
  try { localStorage.setItem(KEY, JSON.stringify(SETTINGS_LOG)) } catch { /* storage blocked · holds for this visit */ }
}

/** Before and after of two flat records · the keys whose value changed, labelled */
export function diffOf<T extends Record<string, unknown>>(before: T, after: T, label: (k: string) => string, say: (v: unknown) => string = (v) => String(v ?? '—')): SettingChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ k: label(k), from: say(before[k]), to: say(after[k]) }))
}
