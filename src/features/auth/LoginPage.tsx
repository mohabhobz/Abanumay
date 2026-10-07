import { readDisplay } from '@/lib/prefs'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { AFTER_LOGIN, ROUTES } from '@/app/routes'
import { signIn } from '@/data/session'
import { STAFF_LOGINS, staffLogin, writeRole } from '@/data/roles'
import { findAccount, passwordOk } from '@/data/entities/auth'
import { regRows } from '@/data/mock/registration'

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

export default function LoginPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  /* The URL redirected from - if a project link was opened while logged out, it returns there after
     login instead of starting from scratch. */
  const st = loc.state as { from?: string; user?: string; reset?: boolean } | null
  const from = st?.from
  const [user, setUser] = useState(st?.user ?? '')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /**
   * Shows the error as a toast and hides it on its own - the message is an alert, not a persistent
   * state.
   */
  const fail = (message: string) => {
    setErr(message)
    setTimeout(() => setErr(''), 4000)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pass) {
      fail('أدخل اسم المستخدم وكلمة المرور')
      return
    }
    /* A portal account whose password was set (registration or reset) must match it (2.3.pw-11) */
    if (passwordOk(user, pass) === false) {
      fail('كلمة المرور غير صحيحة · استعدها من «نسيت كلمة المرور»')
      return
    }
    setErr('')
    setBusy(true)
    setTimeout(() => {
      /* An entity signs in to its own portal, not to the staff system */
      const acct = findAccount(user)
      if (acct) {
        signIn(user.trim(), 'entity', acct.kind === 'entity' ? { entityId: acct.id.slice(2) } : { reqId: regRows.find((r) => r.acctEmail === acct.email)?.id })
        const req = acct.kind === 'reg' ? regRows.find((r) => r.acctEmail === acct.email) : undefined
        navigate(acct.kind === 'entity'
          ? `${ROUTES.entityPortal}?entity=${acct.id.slice(2)}`
          : req ? `${ROUTES.entityPortal}?req=${req.id}` : ROUTES.entityRegister, { replace: true })
        return
      }
      const seat = staffLogin(user)
      if (!seat) {
        setBusy(false)
        fail(`اسم المستخدم غير معروف · جرّب: ${STAFF_LOGINS}`)
        return
      }
      writeRole(seat)
      signIn(user.trim())
      navigate(from ?? (readDisplay().landing || AFTER_LOGIN), { replace: true })
    }, 700)
  }

  return (
    <AuthShell title="منح أبانمي" sub="مؤسسة سليمان أبانمي الأهلية" err={err}>
          {st?.reset && <p className="lnote sub lwhy">حُفظت كلمة المرور الجديدة · ادخل بها.</p>}
          {/* method/action are present so password managers recognize the form and offer to save -
              submission itself is blocked with preventDefault. */}
          <form
            className="lform"
            onSubmit={submit}
            method="post"
            action="#"
            noValidate
          >
            <AuthField
              id="lg-user"
              name="username"
              label="اسم المستخدم"
              icon={icons.user}
              value={user}
              onChange={setUser}
              autoComplete="username"
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
              autoComplete="current-password"
              enterKeyHint="go"
              trailing={
                <button
                  type="button"
                  className="leye"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  title={show ? 'إخفاء' : 'إظهار'}
                >
                  <Icon name={show ? icons.eyeOff : icons.eye} size="md" />
                </button>
              }
            />

            <div className="lrow">
              <label className="lcheck">
                <input type="checkbox" name="remember" />
                <span>تذكّرني</span>
              </label>
              {/* Opens the self-service reset (2.3.pw) · the entity resets its own password with a
                  one-time code; it no longer goes through the system administrator. */}
              <button type="button" className="llink" onClick={() => navigate(ROUTES.forgot)}>
                نسيت كلمة المرور؟
              </button>
            </div>

            <button className="btn btn-p btn-full" type="submit" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>
          </form>

          {/* A completely separate flow, so it's styled as a ghost - not a second option competing
              with login. */}
          <div className="lalt">
            {/* Note: this button used to be `type="button"` with no `onClick` - it looked like a
                button, could be focused and clicked, and nothing happened. Now it leads to the
                public route `/entities/register`, which sits outside the login gate because the
                applicant has no account yet. */}
            <button
              className="btn btn-2 btn-full"
              type="button"
              onClick={() => navigate(ROUTES.entityRegister)}
            >
              تسجيل جهة جديدة
            </button>
            <p className="lnote sub">للجهات التي لم تسجّل في بوابة المنح بعد</p>
          </div>
    </AuthShell>
  )
}
