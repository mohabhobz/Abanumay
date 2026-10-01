import { useCallback, useEffect, useState } from 'react'
import type { FollowUp } from '@/types/domain'

/**
 * Follow-ups added by hand from the follow-ups tab.
 *
 * They are merged into the project's follow-ups before the log is built, so a new one shows in the
 * tab and in the log from the same record. Prototype storage is the session; in production this is
 * POST /projects/:id/follow-ups.
 */

const KEY = 'ab-followups'
const EVENT = 'ab:followups'

type Stored = FollowUp & { projectId: string }

const readAll = (): Stored[] => {
  try {
    const raw = sessionStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as Stored[]) : []
  } catch {
    return []
  }
}

export function useFollowUps(projectId: string): {
  list: FollowUp[]
  add: (f: FollowUp) => void
} {
  const pick = useCallback(
    () => readAll().filter((f) => f.projectId === projectId).reverse(),
    [projectId],
  )
  const [list, setList] = useState<FollowUp[]>(pick)

  useEffect(() => {
    setList(pick())
    const on = () => setList(pick())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [pick])

  const add = useCallback(
    (f: FollowUp) => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify([...readAll(), { ...f, projectId }]))
      } catch {
        /* Storage blocked · nothing to persist in this session */
      }
      window.dispatchEvent(new CustomEvent(EVENT))
    },
    [projectId],
  )

  return { list, add }
}
