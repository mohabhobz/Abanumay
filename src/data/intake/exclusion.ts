import { CFG, persist, readJson } from '@/lib/config'
import { logSettings } from '@/data/shared/settingsLog'
import { ROUTES } from '@/app/routes'

/* Client meeting 21 Oct (#20) · exclusion criteria · yes/no questions the supervisor answers before
   scoring the study · e.g. a project outside the entity's licensed activity. Any «نعم» flags the
   project: the study suggests rejection and a recommendation to approve is refused.

   The list is a settings list the authority holders edit. A saved study keeps the questions as they
   read when it was saved (their text and answers), so a later change to the list never rewrites
   a study already made. */

export interface Exclusion {
  key: string
  label: string
}

/** One answered question as the study keeps it · a snapshot of the label at save time */
export interface ExclusionAnswer extends Exclusion {
  yes: boolean
}

const DEFAULT: Exclusion[] = [
  { key: 'scope', label: 'المشروع خارج نشاط الجهة المرخّص' },
  { key: 'eligible', label: 'الجهة غير مؤهلة للتمويل حاليًا' },
  { key: 'funded', label: 'سبق تمويل المشروع نفسه من المؤسسة' },
  { key: 'policy', label: 'المشروع خارج مجالات المؤسسة وسياساتها' },
]

export const EXCLUSIONS: Exclusion[] = (() => {
  const saved = readJson<{ list?: Exclusion[] }>(CFG.exclusions, {})
  return Array.isArray(saved.list) && saved.list.length ? saved.list.map((x) => ({ ...x })) : DEFAULT.map((x) => ({ ...x }))
})()

/** The questions a new study starts from · every answer «لا» until the supervisor says otherwise */
export const blankExclusions = (): ExclusionAnswer[] => EXCLUSIONS.map((x) => ({ ...x, yes: false }))

/** The answers of a saved study · a study saved before the criteria existed starts from the list */
export const exclusionsOf = (saved?: ExclusionAnswer[]): ExclusionAnswer[] => (saved?.length ? saved.map((x) => ({ ...x })) : blankExclusions())

/** The questions answered «نعم» · each one excludes the project */
export const excludedBy = (list?: ExclusionAnswer[]): ExclusionAnswer[] => (list ?? []).filter((x) => x.yes)

export function saveExclusions(list: Exclusion[], by: string): string[] {
  const seen = new Set<string>()
  const clean = list
    .map((x) => ({ key: x.key, label: x.label.trim() }))
    .filter((x) => x.label && !seen.has(x.label) && Boolean(seen.add(x.label)))
  if (!clean.length) return ['معيار واحد على الأقل']
  const before = EXCLUSIONS.map((x) => x.label)
  EXCLUSIONS.splice(0, EXCLUSIONS.length, ...clean)
  persist(CFG.exclusions, { list: clean })
  logSettings('معايير الاستبعاد', `${ROUTES.projectSettings}?tab=exclusion`, by, [{ k: 'القائمة', from: before.join('، '), to: clean.map((x) => x.label).join('، ') }])
  return []
}

/** A fresh key for a question added in settings */
export const exclusionKey = (): string => `x-${Math.random().toString(36).slice(2, 8)}`
