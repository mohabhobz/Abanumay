import type { IconGlyph } from '@/components/ui/icons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from '@/assets/LogoColor'
import { Icon, icons } from '@/components/ui'

/* Shared wrapper for the auth screens - written once.

   Note: this used to be one screen and is now two - login, and creating an entity account. Both
   share the exact same look: video background, a glass card in the frame's center opening, logo and
   title above it, copyright line below.

   Copying the wrapper into the second screen would have meant two things saying the same thing in
   two different shapes within a month. So only the content differs between the two screens; the
   wrapper is shared.

   Note: the field here isn't the system field (`.fld`). Auth screens use their own field
   (`.lfield`) with an inline label and a clearer focus state, deliberately: this screen sits
   outside the main product, opening over video rather than a glass surface, and the table's thin
   field gets lost on it. So the exception is written here once instead of every screen reinventing
   it. */

export interface AuthShellProps {
  /** Title under the logo. */
  title: string
  /** Line under the title. */
  sub: string
  children: ReactNode
  /** Alert message that floats over the card and disappears on its own. */
  err?: string
}

/* Background video.
   The source clip is 12s; the asset is a palindrome (forward then reversed, ~24s) so the loop point
   has no jump, and it plays at 0.6x (~40s per cycle) so the repeat is not noticeable.
   Reduced motion: no video, the poster frame is shown still. */
const VIDEO_RATE = 0.6
const REDUCED = '(prefers-reduced-motion: reduce)'

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED).matches)
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCED)
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

function LoginVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion()
  // playbackRate resets on load, so it is applied on every loadedmetadata as well.
  const slow = () => { if (ref.current) ref.current.playbackRate = VIDEO_RATE }
  useEffect(slow, [reduced])

  if (reduced) return <img className="login-vid login-still" src="./login-poster.jpg" alt="" />
  return (
    <video ref={ref} className="login-vid" autoPlay muted loop playsInline
      poster="./login-poster.jpg" onLoadedMetadata={slow} onPlay={slow}>
      <source src="./login-bg.mp4" type="video/mp4" />
    </video>
  )
}

export function AuthShell({ title, sub, children, err }: AuthShellProps) {
  return (
    <div className="login">
      <LoginVideo />

      <main className="login-mid">
        <div className="lcard glass">
          {/* Toast: floats over the form without pushing anything, and disappears on its own. */}
          {err && (
            <div className="ltoast" role="alert">
              <Icon name={icons.alert} size="sm" />
              <span>{err}</span>
            </div>
          )}

          <div className="lhead">
            <span className="lmark"><Logo /></span>
            <h1 className="ltitle">{title}</h1>
            <p className="lsub">{sub}</p>
          </div>

          {children}
        </div>

        <p className="lfoot sub">جميع الحقوق محفوظة · مؤسسة سليمان أبانمي الأهلية</p>
      </main>
    </div>
  )
}

/* Field with an inline label and a clear focus state - borders darken rather than change color. */
export interface AuthFieldProps {
  id: string
  /** Needed for name so password managers and autofill recognize the field. */
  name: string
  label: string
  icon: IconGlyph
  value: string
  onChange: (value: string) => void
  type?: string
  trailing?: ReactNode
  /** Standard autofill token: username, current-password, etc. */
  autoComplete?: string
  /** Mobile keyboard's enter-key style. */
  enterKeyHint?: 'go' | 'next' | 'done' | 'send' | 'search' | 'enter'
  /** Line under the field - a condition or clarification. */
  hint?: ReactNode
}

export function AuthField({
  id, name, label, icon, value, onChange,
  type = 'text', trailing, autoComplete, enterKeyHint, hint,
}: AuthFieldProps) {
  return (
    <label className="lfield" htmlFor={id}>
      <span className="llbl">{label}</span>
      <span className="lbox">
        <Icon name={icon} size="md" />
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
        />
        {trailing}
      </span>
      {hint && <span className="lhint sub">{hint}</span>}
    </label>
  )
}
