import type { IconGlyph } from '@/components/ui/icons'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from '@/assets/LogoColor'
import { Icon, icons } from '@/components/ui'

/* Shared wrapper for the auth screens - written once.

   Note: this used to be one screen and is now two - login, and creating an entity account. Both
   share the exact same look: the sign-in column on the left (under a third of the width) with the
   logo, title, form and copyright line, and the glass tree video filling the rest (10 Oct).

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

/* Background video · the glass tree (10 Oct).
   Two files: the tree growing (10s, once) and a seamless 8s loop made from its last frame, where
   the light moves and the leaves sway in a slow wind. The loop's first frame is the intro's last
   frame, so the hand-over can't be seen. The growth plays each time the login page is opened
   (client's call, 10 Oct).
   Reduced motion: no video, the grown tree is shown still. */
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
  const loop = useRef<HTMLVideoElement>(null)
  const reduced = useReducedMotion()
  const [grown, setGrown] = useState(false)
  const toLoop = () => {
    setGrown(true)
    void loop.current?.play().catch(() => undefined)
  }

  if (reduced) return <div className="login-vid login-still"><img className="login-v on" src="./login-poster.jpg" alt="" /></div>
  return (
    <div className="login-vid">
      <video ref={loop} className={`login-v${grown ? ' on' : ''}`} muted loop playsInline preload="auto"
        autoPlay={grown} poster="./login-poster.jpg" aria-hidden="true">
        <source src="./login-tree-loop.mp4" type="video/mp4" />
      </video>
      {!grown && (
        <video className="login-v on" autoPlay muted playsInline preload="auto" onEnded={toLoop} onError={toLoop} aria-hidden="true">
          <source src="./login-tree-intro.mp4" type="video/mp4" />
        </video>
      )}
    </div>
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
  /** Sign-in form armed as a whole (`useArmed`) · without it the field arms itself on first touch */
  armed?: boolean
}

export function AuthField({
  id, name, label, icon, value, onChange,
  type = 'text', trailing, autoComplete, enterKeyHint, hint, armed: formArmed,
}: AuthFieldProps) {
  const [own, setOwn] = useState(false)
  const armed = formArmed ?? own
  const arm = () => { if (formArmed === undefined && !own) setOwn(true) }
  return (
    <label className="lfield" htmlFor={id}>
      <span className="llbl">{label}</span>
      <span className="lbox">
        <Icon name={icon} size="md" />
        <input
          id={id}
          name={armed ? name : undefined}
          type={armed || type !== 'password' ? type : 'text'}
          className={!armed && type === 'password' ? 'lmask' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={armed ? autoComplete : 'off'}
          onPointerDown={arm}
          onFocus={arm}
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
