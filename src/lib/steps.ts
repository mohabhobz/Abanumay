import type { ReactNode } from 'react'
import type { StepItem } from '@/components/ui'

/**
 * The first step not yet complete is the one currently in progress.
 *
 * Sequential steps are described in the data only as "done/not done,"
 * and the `now` state is derived from their order — because it isn't a
 * property of a step, it's its position in the sequence. If everything
 * is done, there's no `now`, and that's correct.
 */
export function sequence(marks: { label: string; note?: ReactNode; done: boolean }[]): StepItem[] {
  const next = marks.findIndex((m) => !m.done)
  return marks.map((m, i) => ({
    label: m.label,
    note: m.note,
    state: m.done ? 'done' : i === next ? 'now' : 'todo',
  }))
}
