/* Project request drafts · re-audit 7 Oct (3.2.12 · rule 31).

   «احفظ المسودة» used to set a flag on the screen and nothing else: leaving the page lost the
   request, and the creation date was the sending date. A draft is now kept per author — the entity
   applying from its portal, or the supervisor filing on its behalf — and the form reopens on it.
   The date the draft was first saved becomes the request's creation date. */

const KEY = 'ab-project-drafts'

export interface ProjectDraft {
  val: Record<string, string>
  docs: Record<string, string>
  /** First saved · the request's creation date when it's sent */
  createdAt: string
  savedAt: string
}

const read = (): Record<string, ProjectDraft> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ProjectDraft> } catch { return {} }
}
const write = (all: Record<string, ProjectDraft>) => {
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* storage blocked · the draft holds for this visit */ }
}

/** Whose draft · the entity from its portal, or the staff member filing on its behalf */
export const draftKey = (asEntity: boolean, entityId: string | undefined, user: string): string =>
  asEntity && entityId ? `e:${entityId}` : `s:${user}`

export const draftOf = (key: string): ProjectDraft | undefined => read()[key]

export function saveDraft(key: string, val: Record<string, string>, docs: Record<string, string>): ProjectDraft {
  const all = read()
  const at = new Date().toISOString()
  const d: ProjectDraft = { val, docs, createdAt: all[key]?.createdAt ?? at, savedAt: at }
  all[key] = d
  write(all)
  return d
}

export function dropDraft(key: string): void {
  const all = read()
  if (!(key in all)) return
  delete all[key]
  write(all)
}
