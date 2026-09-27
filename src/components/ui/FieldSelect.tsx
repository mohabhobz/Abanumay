import { useId } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { optLabel, optValue, type SelectOption } from './filters'
import { MenuOpt, MenuPanel, useMenuSearch } from './menu'
import { Icon } from './Icon'
import { icons } from './icons'

/* Select **inside a form**.

   Warning: the rule was written in one place and missing in another. The toolbar `Select` dropped
   the native `<select>` a while back, and the comment above it explains why: its list is rendered
   by the operating system — its font, background, and behavior sit outside the system, and in dark
   theme it opens a gray box in Latin script inside an Arabic glass UI. But the form fields never
   changed — 11 native `<select>` elements are still used in entity registration, new project,
   agreement, and budget.

   So the same system opens two different lists for the user depending on where they are — exactly
   what showed up in entity registration.

   A rule written in one place doesn't guard the other. So the panel here is the **same** `.fmenu`
   and `.fopt` as the toolbar version — only the trigger differs: in the toolbar it wears `.fsel-b`
   (chip look), and here it wears `.fld` (field look) so it lines up with the fields around it —
   same height, same border, same focus ring. */

export interface FieldSelectProps {
  value: string
  options: readonly SelectOption[]
  onChange: (v: string) => void
  /** Text shown when nothing is selected · colored `--t3` like `::placeholder` */
  placeholder?: string
  disabled?: boolean
  /** Field name for screen readers · the label above it is visually separate from the trigger */
  label?: string
  /** Above this count, a search box appears inside the panel · 40+ cities */
  searchAt?: number
  /** Anchors the panel to the end · for the last field in a row */
  end?: boolean
}

export function FieldSelect({
  value, options, onChange, placeholder = 'اختر', disabled, label, searchAt = 9, end,
}: FieldSelectProps) {
  const { open, setOpen, box, pop } = useMenu<HTMLSpanElement>()
  const { needle, setNeedle, search } = useMenuSearch(open, searchAt, options.length)
  const id = useId()

  const current = options.find((o) => optValue(o) === value)
  const shown = needle
    ? options.filter((o) => optLabel(o).includes(needle.trim()))
    : options

  return (
    <span className={`fldsel${end ? ' end' : ''}`} ref={box}>
      <button
        type="button"
        id={`${id}-b`}
        className={`fld fldsel-b${disabled ? ' off' : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((x) => !x)}
      >
        <span className={`fldsel-t${current ? '' : ' ph'}`}>
          {current ? optLabel(current) : placeholder}
        </span>
        <Icon name={icons.chevronDown} size="sm" />
      </button>

      {open && (
        <MenuPanel
          one
          end={end}
          float={{ anchor: box, pop }}
          search={search}
          needle={needle}
          onNeedle={setNeedle}
          empty={shown.length === 0}
        >
          {shown.map((o) => (
            <MenuOpt
              key={optValue(o)}
              on={optValue(o) === value}
              onPick={() => { onChange(optValue(o)); setOpen(false) }}
            >
              {optLabel(o)}
            </MenuOpt>
          ))}
        </MenuPanel>
      )}
    </span>
  )
}
