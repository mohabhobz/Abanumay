import { CFG, persist, readJson } from '@/lib/config'
import { DECLINE_REASONS } from '@/data/mock/taxonomy'
import { logSettings } from '@/data/shared/settingsLog'
import { ROUTES } from '@/app/routes'

/* v3 · 3.4.24 · 3.4.25 · the reasons for a recommendation to reject a project · a settings list the
   authority holders add to, edit and remove from · the supervisor picks one, or «أخرى» and writes the
   reason · both are kept in the project's record. */

export const OTHER = 'أخرى'

const DEFAULT = DECLINE_REASONS.filter((r) => r !== OTHER)

export const REJECT_REASONS: string[] = (() => {
  const saved = readJson<{ list?: string[] }>(CFG.rejectReasons, {})
  return Array.isArray(saved.list) && saved.list.length ? [...saved.list] : [...DEFAULT]
})()

export const REJECT_REASONS_DEFAULT: readonly string[] = DEFAULT

export function saveRejectReasons(list: string[], by: string): string[] {
  const clean = [...new Set(list.map((x) => x.trim()).filter(Boolean))].filter((x) => x !== OTHER)
  if (!clean.length) return ['سبب واحد على الأقل']
  const before = [...REJECT_REASONS]
  REJECT_REASONS.splice(0, REJECT_REASONS.length, ...clean)
  persist(CFG.rejectReasons, { list: clean })
  logSettings('أسباب التوصية بالرفض', `${ROUTES.projectSettings}?tab=reasons`, by, [{ k: 'القائمة', from: before.join('، '), to: clean.join('، ') }])
  return []
}

/** The reason as the record reads it · «أخرى» carries its text */
export const reasonSay = (reason?: string, other?: string): string =>
  !reason ? '' : reason === OTHER ? (other?.trim() ? `${OTHER}: ${other.trim()}` : OTHER) : reason
