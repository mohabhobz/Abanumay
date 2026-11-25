import { readDisplay } from '@/lib/prefs'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { useArmed } from './useArmed'
import { AFTER_LOGIN, ROUTES } from '@/app/routes'
import { signIn } from '@/data/session'
import { STAFF_DIRECTORY, staffLogin, writeRole } from '@/data/roles'
import { findAccount, passwordOk } from '@/data/entities/auth'
import { lockLeft, loginFailed, loginSucceeded } from '@/data/authGuard'
import { hasStaffPassword, staffPasswordOk } from '@/data/staffAuth'
import { regRows, setRegAccount } from '@/data/mock/registration'

/* Login screen.

   The video background isn't decorative: the opening in the center of the frame is where the card
   sits. The video plays in its natural colors, and the card is glass, like cards elsewhere in the
   product.

   From the live system: username and password, plus a fully separate flow called "register a new
   entity".

   Note: the wrapper is now `AuthShell`. The video, card, logo, and copyright line used to be
   written here, and when the entity signup screen needed the same look, copying them was the easy
   path - which is exactly what leads to two things saying the same thing in two shapes within a
   month.

   Note: the demo-mode shortcuts were removed. There used to be a row below the form, "quick demo
   login", with two buttons (institution staff / beneficiary entity), added so a presenter could
   open both flows without hunting for a link.

   They were removed because the product's front door isn't a place for demo tooling. The first
   screen in a product sets its tone, and a row labeled "for demo" tells users that what's above it
   is a mockup - so the screen reads as a demo rather than a product.

   Both flows are still reachable, through their real entry points rather than a shortcut:
   - institution staff: the same form above
   - entity: "register a new entity" below, and from there "already have an account? open your
   application portal" - the actual path an entity follows. */

/* Audit 26 Nov · the field is «اسم المستخدم», so the message says so (it used to say «البريد») */
const WRONG = 'اسم المستخدم أو كلمة المرور غير صحيحة'
/* Audit 26 Nov · a lock is said on its own, not after «wrong password» · the two read as one sentence
   that contradicts itself */
const LOCKED = 'قُفل الحساب مؤقتًا بعد محاولات دخول خاطئة متتالية'
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export default function LoginPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  /* The URL redirected from - if a project link was opened while logged out, it returns there after
     login instead of starting from scratch. */
  const st = loc.state as { from?: string; user?: string; reset?: boolean; expired?: boolean } | null
  const from = st?.from
  const [user, setUser] = useState(st?.user ?? '')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const { armed, formProps } = useArmed()

  /* Audit 26 Nov · what went wrong stays on screen (AuthShell's toast) until it's closed, a field
     changes, or the form is sent again · it used to leave after 4s, unread */
  const fail = (message: string) => setErr(message)
  /* Audit 26 Nov · a missing name or password gets one message for both, the same either way, and no
     field is marked (client · security: the sign-in screen never says which of the two is missing or
     wrong) · the focus still moves to the first empty field so the user can type straight away */
  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  /* Audit 26 Nov · while the name typed is locked, the button rests with the time left on it, the
     time counts down each second, and the way out (reset the password) sits right under it */
  const [, setTick] = useState(0)
  /* Audit 26 Nov · the lock stays on screen for the account it fell on, whatever is typed after it ·
     it used to follow the name field, so editing or clearing the name hid the countdown and the
     button looked free again */
  const [lockedFor, setLockedFor] = useState('')
  const lockWho = user.trim() && lockLeft(user) ? user : lockedFor
  /* a name that is locked is held as soon as it's typed (not only after a send) */
  useEffect(() => { if (user.trim() && lockLeft(user) && user !== lockedFor) setLockedFor(user) }, [user, lockedFor])
  const lockSecs = lockWho ? lockLeft(lockWho) : 0
  useEffect(() => {
    if (!lockSecs) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [lockSecs > 0])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pass) {
      ;(!user.trim() ? userRef : passRef).current?.focus()
      fail('أكمل بيانات الدخول للمتابعة')
      return
    }
    /* Batch 8 · a locked account waits out its lock */
    const locked = lockLeft(user)
    if (locked) {
      setLockedFor(user)
      fail(LOCKED)
      return
    }
    /* A portal account whose password was set (registration or reset) must match it (2.3.pw-11) */
    if (passwordOk(user, pass) === false) {
      const left = loginFailed(user)
      /* Client 23 Oct · one message for a wrong user or password · it never says which of the two */
      if (!left) setLockedFor(user)
      fail(left ? `${WRONG} · تبقّى ${left} ${left === 1 ? 'محاولة' : 'محاولات'} قبل قفل الحساب مؤقتًا` : LOCKED)
      setTick((t) => t + 1)
      return
    }
    /* Client 14 Nov · a staff account with a password kept (an added account, or one that set its
       own) must match it · the demo accounts with none keep opening with any password */
    const stf = staffLogin(user)
    /* Client 16 Nov · an added account opens only once its owner set a password from the emailed link */
    if (stf && !STAFF_DIRECTORY.some((a) => a.login === stf.login) && !hasStaffPassword(stf.login)) {
      fail('الحساب بانتظار التفعيل · افتح الرابط المرسل إلى بريد العمل لتعيين كلمة المرور')
      return
    }
    if (stf && staffPasswordOk(stf.login, pass) === false) {
      const left = loginFailed(user)
      if (!left) setLockedFor(user)
      fail(left ? `${WRONG} · تبقّى ${left} ${left === 1 ? 'محاولة' : 'محاولات'} قبل قفل الحساب مؤقتًا` : LOCKED)
      setTick((t) => t + 1)
      return
    }
    loginSucceeded(user)
    setErr('')
    setBusy(true)
    setTimeout(() => {
      /* An entity signs in to its own portal, not to the staff system */
      const acct = findAccount(user)
      if (acct) {
        /* Audit 26 Nov · the one sign-in screen also brings back an entity in registration (the
           account card no longer doubles as a second sign-in) · a sent request opens its portal,
           an unsent one opens its draft form where it was left (2.2.5 · 2.4.12) */
        const sent = acct.kind === 'reg' ? regRows.find((r) => r.acctEmail === acct.email && r.state !== 'draft') : undefined
        if (acct.kind === 'reg' && !sent) {
          setRegAccount(acct.email)
          navigate(`${ROUTES.entityRegister}?step=form`, { replace: true })
          return
        }
        signIn(user.trim(), 'entity', acct.kind === 'entity' ? { entityId: acct.id.slice(2) } : { reqId: sent?.id })
        navigate(acct.kind === 'entity'
          ? `${ROUTES.entityPortal}?entity=${acct.id.slice(2)}`
          : `${ROUTES.entityPortal}?req=${sent!.id}`, { replace: true })
        return
      }
      const staff = staffLogin(user)
      if (!staff) {
        setBusy(false)
        fail(WRONG)  /* audit 26 Nov · a sign-in screen never lists account names */
        return
      }
      writeRole(staff.role)
      signIn(staff.login)
      navigate(from ?? (readDisplay().landing || AFTER_LOGIN), { replace: true })
    }, 700)
  }

  return (
    <AuthShell
      wait={3000}
      title="منح أبانمي"
      sub="مؤسسة سليمان أبانمي الأهلية"
      err={err}
      notice={st?.reset ? 'حُفظت كلمة المرور الجديدة · ادخل بها.' : st?.expired ? 'انتهت الجلسة لعدم النشاط · ادخل من جديد.' : undefined}
    >
          {/* method/action (added once armed) let password managers recognize the form and offer
              to save - submission itself is blocked with preventDefault. */}
          <form className="lform" onSubmit={submit} noValidate {...formProps}>
            <AuthField
              id="lg-user"
              name="username"
              label="اسم المستخدم"
              icon={icons.user}
              value={user}
              onChange={setUser}
              inputRef={userRef}
              autoComplete="username"
              armed={armed}
              enterKeyHint="next"
            />
            <AuthField
              id="lg-pass"
              name="password"
              label="كلمة المرور"
              icon={icons.lock}
              type={show ? 'text' : 'password'}
              value={pass}
              onChange={setPass}
              inputRef={passRef}
              autoComplete="current-password"
              armed={armed}
              enterKeyHint="go"
              trailing={
                <Button plain
                  type="button"
                  className="leye"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  title={show ? 'إخفاء' : 'إظهار'}
                >
                  <Icon name={show ? icons.eyeOff : icons.eye} size="md" />
                </Button>
              }
            />

            <div className="lrow">
              <label className="lcheck">
                <input type="checkbox" name="remember" />
                <span>تذكّرني</span>
              </label>
              {/* Opens the self-service reset (2.3.pw) · the entity resets its own password with a
                  one-time code; it no longer goes through the system administrator. */}
              <Button plain type="button" className="llink" onClick={() => navigate(ROUTES.forgot)}>
                نسيت كلمة المرور؟
              </Button>
            </div>

            <Button variant="p" full type="submit" disabled={busy || lockSecs > 0}
              title={lockSecs > 0 ? `الحساب مقفل مؤقتًا · يُفتح بعد ${mmss(lockSecs)}` : undefined}>
              {busy ? 'جارٍ التحقق…' : lockSecs > 0 ? 'الحساب مقفل مؤقتًا' : 'تسجيل الدخول'}
            </Button>
            {lockSecs > 0 && (
              <p className="llock" role="status">
                <Icon name={icons.lock} size="sm" />
                <span>يُفتح الدخول بعد <b className="num">{mmss(lockSecs)}</b> · أو</span>
                <Button plain type="button" className="llink" onClick={() => navigate(ROUTES.forgot)}>استعد كلمة المرور</Button>
              </p>
            )}
          </form>

          {/* A completely separate flow, so it's styled as a ghost - not a second option competing
              with login. */}
          <div className="lalt">
            {/* Note: this button used to be `type="button"` with no `onClick` - it looked like a
                button, could be focused and clicked, and nothing happened. Now it leads to the
                public route `/entities/register`, which sits outside the login gate because the
                applicant has no account yet. */}
            <Button
              variant="2" full
              type="button"
              onClick={() => navigate(ROUTES.entityRegister)}
            >
              تسجيل جهة جديدة
            </Button>
          </div>
    </AuthShell>
  )
}
