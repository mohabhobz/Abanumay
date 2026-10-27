import { Icon } from './Icon'
import { icons } from './icons'

/* Client 27 Oct · the days of the week as seven toggles, all in view · a weekend-only project picks
   الجمعة and السبت without opening a menu to find them. Values are the day indices (0 = الأحد). */
export function WeekdayPicker({ days, value, onChange, label, min = 1 }: {
  /** Day names in week order · index = day number */
  days: readonly string[]
  value: number[]
  onChange: (next: number[]) => void
  label: string
  /** The fewest days that may stay picked · the last one can't be cleared below it */
  min?: number
}) {
  const set = new Set(value)
  const flip = (i: number) => {
    const next = new Set(set)
    if (next.has(i)) { if (next.size <= min) return; next.delete(i) } else next.add(i)
    onChange([...next].sort((a, b) => a - b))
  }
  return (
    <div className="wdpick" role="group" aria-label={label}>
      {days.map((d, i) => {
        const on = set.has(i)
        return (
          <button
            key={d}
            type="button"
            className={`wdpick-d${on ? ' on' : ''}`}
            aria-pressed={on}
            title={on && set.size <= min ? 'يلزم يوم واحد على الأقل' : undefined}
            onClick={() => flip(i)}
          >
            {on && <Icon name={icons.check} size="sm" />}
            {d}
          </button>
        )
      })}
    </div>
  )
}
