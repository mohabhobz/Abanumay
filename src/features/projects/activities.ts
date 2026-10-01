import { useCallback, useEffect, useState } from 'react'
import type { LogEvent } from '@/data/mock/log'
import type { FollowUp } from '@/types/domain'

/**
 * Manual project activities · field visits, meetings, workshops, calls.
 *
 * Recorded by hand from the activities tab and read back by the project log, which shows each one
 * as an event with the same shape as a workflow action (name · date · description · actor ·
 * source · attachments). Prototype storage is the session; in production this is
 * POST /projects/:id/activities.
 */

export const ACTIVITY_TYPES = ['زيارة ميدانية', 'اجتماع', 'ورشة', 'اتصال', 'أخرى'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]

/** Where the information came from · stated on every log event. */
export const ACTIVITY_SOURCES = [
  'تقرير زيارة ميدانية',
  'محضر اجتماع',
  'اتصال هاتفي',
  'بريد إلكتروني أو مراسلة',
  'إفادة الجهة',
  'ملاحظة المشرف المباشرة',
  'أخرى',
] as const

/** Follow-up types that are really activities · they live in the activities tab and log category. */
export const ACTIVITY_FOLLOW_TYPES: readonly string[] = ['زيارة ميدانية', 'التواصل مع الشريك']

export interface Activity {
  id: string
  projectId: string
  title: string
  /** ISO date · rendered through `<DateText>` */
  at: string
  type: ActivityType
  description: string
  source: string
  files: string[]
  by: string
  /** Time of entry, HH:MM */
  time: string
}

const KEY = 'ab-activities'
const EVENT = 'ab:activities'

const readAll = (): Activity[] => {
  try {
    const raw = sessionStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as Activity[]) : []
  } catch {
    return []
  }
}

const writeAll = (list: Activity[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* Storage blocked · the entry still lives for this render cycle via the event. */
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Activities of one project, newest first, plus an add function. */
export function useActivities(projectId: string): {
  list: Activity[]
  add: (a: Omit<Activity, 'id' | 'projectId' | 'time'>) => void
} {
  const pick = useCallback(
    () =>
      readAll()
        .filter((a) => a.projectId === projectId)
        .sort((a, b) => b.at.localeCompare(a.at) || b.time.localeCompare(a.time)),
    [projectId],
  )
  const [list, setList] = useState<Activity[]>(pick)

  useEffect(() => {
    setList(pick())
    const on = () => setList(pick())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [pick])

  const add = useCallback(
    (a: Omit<Activity, 'id' | 'projectId' | 'time'>) => {
      const now = new Date()
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      writeAll([...readAll(), { ...a, id: `ac-${now.getTime()}`, projectId, time }])
    },
    [projectId],
  )

  return { list, add }
}

/** One activity as a log event · same fields shape as a workflow action. */
export const activityEvent = (a: Activity): LogEvent => ({
  id: a.id,
  action: a.title,
  dept: a.type,
  by: a.by,
  actor: 'staff',
  at: a.at,
  time: a.time,
  days: 0,
  hours: 0,
  limit: 0,
  tone: 'mute',
  source: a.source,
  manual: true,
  files: a.files.length ? a.files : undefined,
  fields: [
    { k: 'نوع الفعالية', v: a.type, strong: true },
    { k: 'الوصف', v: a.description },
    { k: 'مصدر المعلومة', v: a.source },
  ],
})

/** Log plus manual activities, newest first · a stable sort keeps same-day order. */
export const withActivities = (log: LogEvent[], list: Activity[]): LogEvent[] =>
  [...log, ...list.map(activityEvent)].sort((x, y) => y.at.localeCompare(x.at))

/**
 * Field visits and partner calls that the current system stored as follow-ups. They are read as
 * activities (tab and log category), so a field visit never shows under «المتابعات».
 */
export const activitiesFromFollowUps = (
  projectId: string,
  list: FollowUp[],
): Activity[] =>
  list
    .filter((f) => ACTIVITY_FOLLOW_TYPES.includes(f.type))
    .map((f, i) => {
      const visit = f.type === 'زيارة ميدانية'
      return {
        id: `la-${projectId}-${i}`,
        projectId,
        /* The note itself is the title, and the type is the chip beside it, as for any event. */
        title: f.body,
        at: f.at,
        type: visit ? 'زيارة ميدانية' : 'اتصال',
        description: '',
        source: visit ? 'تقرير زيارة ميدانية' : 'اتصال هاتفي',
        files: f.attachment ? [f.attachment] : [],
        by: f.by,
        time: '13:26',
      }
    })
