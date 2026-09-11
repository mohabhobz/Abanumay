import type { ReactNode } from 'react'
import type { StepItem } from '@/components/ui'

/**
 * أول محطة لسّه ما خلصتش هي اللي الدور عليها.
 *
 * المحطات المتسلسلة بتوصف في الداتا بـ«خلصت/ما خلصتش» بس، والحالة
 * `now` بتتشتقّ من الترتيب · لأنها **مش خاصية محطة**، هي موضعها
 * في السلسلة. لو كله خلص فمفيش `now`، وده صحيح.
 */
export function sequence(marks: { label: string; note?: ReactNode; done: boolean }[]): StepItem[] {
  const next = marks.findIndex((m) => !m.done)
  return marks.map((m, i) => ({
    label: m.label,
    note: m.note,
    state: m.done ? 'done' : i === next ? 'now' : 'todo',
  }))
}
