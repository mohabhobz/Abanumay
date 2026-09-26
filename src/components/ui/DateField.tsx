import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMenu } from '@/hooks/useMenu'
import { useFloat } from '@/hooks/useFloat'
import { Icon } from './Icon'
import { icons } from './icons'

/* Date field · the system's own calendar, not the browser's.

   Warning: `<input type="date">` opens a calendar rendered by the browser — the same problem as the
   native `<select>`, and for the same reason: Latin script, English day names, and the week
   starting Sunday or Monday depending on the system language rather than the country, plus a
   different look on Windows, inside an Arabic glass UI. Worse, the empty field shows `dd/mm/yyyy`
   in English inside an Arabic field.

   So the calendar here is drawn by hand: same `.fmenu` panel, same styling, and the week starts on
   Sunday since that's the first working day in Saudi Arabia, with Friday and Saturday treated as
   the weekend.

   Warning: digits are Latin only, per the system-wide rule (`--fd` and the `.num` class) — a
   calendar with Arabic-Indic digits next to an amount in Latin digits would split the screen
   between two number systems.

   Warning: the value still stays `YYYY-MM-DD`, exactly like `type="date"`, so screens consuming it
   don't need to know the control changed, and the comparisons and sorting in `plans.ts` and
   `registration.ts` keep working as-is. */

/* Warning: one letter, not three. "Ithn", "thala", "khami" aren't standard Arabic abbreviations —
   they're words cut off midway. The convention in Arabic calendars is a single-letter abbreviation.
   The order starts on Sunday since that's the first working day in Saudi Arabia. */
const DAYS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س']
const DAY_SAY = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** "2026-09-18" → "18 September 2026" · empty input returns empty */
const say = (v: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return ''
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export interface DateFieldProps {
  value: string
  onChange: (v: string) => void
  label?: string
  disabled?: boolean
  /** Earliest allowed date · `YYYY-MM-DD` */
  min?: string
  /** Latest allowed date */
  max?: string
  /** Anchors to the end of the field · for the last column in a row */
  end?: boolean
}

export function DateField({ value, onChange, label, disabled, min, max, end }: DateFieldProps) {
  const { open, setOpen, box, pop } = useMenu<HTMLSpanElement>()
  /* Warning: the panel lives in `body`, not inside the field · see `useFloat` */
  useFloat(open, box, pop, end)

  /* Month shown · opens on the value's month, or on today if the field is empty */
  const now = new Date()
  const [at, setAt] = useState(() => {
    const m = /^(\d{4})-(\d{2})/.exec(value)
    return m ? { y: Number(m[1]), m: Number(m[2]) - 1 }
      : { y: now.getFullYear(), m: now.getMonth() }
  })

  const today = iso(now.getFullYear(), now.getMonth(), now.getDate())

  const grid = useMemo(() => {
    const first = new Date(at.y, at.m, 1)
    /* `getDay()` returns 0 for Sunday, which is the first column here, so no offset is needed */
    const lead = first.getDay()
    const days = new Date(at.y, at.m + 1, 0).getDate()
    const cells: (number | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d += 1) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [at])

  const step = (by: number) => setAt((x) => {
    const m = x.m + by
    if (m < 0) return { y: x.y - 1, m: 11 }
    if (m > 11) return { y: x.y + 1, m: 0 }
    return { y: x.y, m }
  })

  const off = (d: number) => {
    const v = iso(at.y, at.m, d)
    return (min !== undefined && v < min) || (max !== undefined && v > max)
  }

  const pick = (d: number) => { onChange(iso(at.y, at.m, d)); setOpen(false) }

  return (
    <span className={`fldsel${end ? ' end' : ''}`} ref={box}>
      <button
        type="button"
        className={`fld fldsel-b${disabled ? ' off' : ''}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((x) => !x)}
      >
        {/* Warning: fallback text is Arabic · the browser's Latin `dd/mm/yyyy` used to show up in
            an Arabic field next to fields with Arabic text */}
        <span className={`fldsel-t${value ? '' : ' ph'}`}>
          {value ? say(value) : 'اختر التاريخ'}
        </span>
        <Icon name={icons.date} size="sm" />
      </button>

      {open && createPortal(
        <div className="fmenu cal float" role="dialog" aria-label={label ?? 'التقويم'} ref={pop}>
          <div className="cal-h">
            {/* Warning: the arrow follows reading direction — "previous" is on the right in Arabic
                · the browser calendar's back arrow used to point the wrong way because it was
                hardcoded for Latin */}
            <button type="button" className="cal-n" aria-label="الشهر السابق" onClick={() => step(-1)}>
              <Icon name={icons.chevronBack} size="sm" />
            </button>
            <span className="cal-t">
              {MONTHS[at.m]} <span className="num">{at.y}</span>
            </span>
            <button type="button" className="cal-n" aria-label="الشهر التالي" onClick={() => step(1)}>
              <Icon name={icons.chevron} size="sm" />
            </button>
          </div>

          <div className="cal-w" aria-hidden="true">
            {DAYS.map((d, i) => <span key={d} title={DAY_SAY[i]}>{d}</span>)}
          </div>

          <div className="cal-g" role="grid">
            {grid.map((d, i) => {
              if (d === null) return <span key={`e${i}`} className="cal-d off" />
              const v = iso(at.y, at.m, d)
              return (
                <button
                  type="button"
                  key={v}
                  role="gridcell"
                  aria-selected={v === value}
                  disabled={off(d)}
                  className={`cal-d num${v === value ? ' on' : ''}${v === today ? ' now' : ''}`}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="fmenu-f cal-f">
            <button type="button" className="fclear" onClick={() => { onChange(today); setOpen(false) }}>
              اليوم
            </button>
            {value && (
              <button type="button" className="fclear" onClick={() => { onChange(''); setOpen(false) }}>
                مسح
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
