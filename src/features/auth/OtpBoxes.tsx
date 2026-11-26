import { useEffect, useRef } from 'react'
import { OTP_CHARS, OTP_LEN } from '@/data/entities/auth'

/* Client 26 Nov · the one-time code as six boxes, one character each · typing moves on, Backspace
   moves back, the arrows move between boxes, and a pasted or autofilled code (the phone offers it
   from the message) fills all six at once · letters are taken in either case and shown in capitals ·
   when the sixth is filled it calls `onComplete`, so the code checks itself */

const keep = (s: string) => s.toUpperCase().split('').filter((c) => OTP_CHARS.includes(c) || /[0-9A-Z]/.test(c)).join('')

export function OtpBoxes({
  value, onChange, onComplete, disabled, invalid, autoFocus, describedBy,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  describedBy?: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => { if (autoFocus && !disabled) refs.current[Math.min(value.length, OTP_LEN - 1)]?.focus() }, [autoFocus, disabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next: string, focus?: number) => {
    const v = next.slice(0, OTP_LEN)
    onChange(v)
    /* the next box takes the focus at once, so fast typing never lands twice in the same box */
    if (focus !== undefined) refs.current[Math.max(0, Math.min(focus, OTP_LEN - 1))]?.focus()
    if (v.length === OTP_LEN) onComplete?.(v)
  }

  return (
    <div className={`otpbox${invalid ? ' bad' : ''}`} dir="ltr" role="group" aria-label={`رمز التحقّق · ${OTP_LEN} خانات`}>
      {Array.from({ length: OTP_LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className="otpbox-c"
          value={value[i] ?? ''}
          disabled={disabled}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          name={i === 0 ? 'one-time-code' : undefined}
          aria-label={`الخانة ${i + 1} من ${OTP_LEN}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const typed = keep(e.target.value)
            if (!typed) { set(value.slice(0, i) + value.slice(i + 1)); return }
            /* a paste or an autofill lands in one box · it fills from that box on */
            const next = (value.slice(0, i) + typed).slice(0, OTP_LEN)
            set(next, i + typed.length)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) { e.preventDefault(); set(value.slice(0, i - 1), i - 1) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); refs.current[Math.max(0, i - 1)]?.focus() }
            if (e.key === 'ArrowRight') { e.preventDefault(); refs.current[Math.min(OTP_LEN - 1, i + 1)]?.focus() }
          }}
          onPaste={(e) => {
            const t = keep(e.clipboardData.getData('text'))
            if (!t) return
            e.preventDefault()
            set(t, t.length)
          }}
        />
      ))}
    </div>
  )
}
