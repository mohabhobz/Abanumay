import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from '@/features/auth/AuthShell'
import { ROUTES } from '@/app/routes'
import { setRegAccount } from '@/data/mock/registration'
import { createAccount } from '@/data/entities/auth'
import { passwordIssues } from '@/data/entities/validate'
import { PassRules } from '@/features/auth/PassRules'

/* Creating an entity account - its own screen.

   Note: the account used to be the first stage in the stepper, and that was a classification error,
   not a placement one. An entity opens registration and the first thing it sees is a "3 missing"
   tag on "entity account" - the screen tells it something's missing before it's done anything,
   putting email and password next to "board term expiry date" and "IBAN" as if they were the same
   kind of thing. They aren't:

   - application data: an assertion that gets reviewed and checked against documentation
   - the account: the door the application is saved behind and returned to

   So the account got its own screen, shaped like the login screen, because that's what it actually
   is: email and password over the door's video, not thin fields in a long form. The stage still
   stays marked "done" in the stepper so the entity can see it's been completed - removing it would
   make the journey look like five steps when it's six.

   Note: this screen creates, it doesn't log in. An entity that already has an account goes to its
   application portal instead - the line under the button says so and takes it there, rather than
   creating a second account and losing its first application.

   Audit 26 Nov · an entity that already has an account goes back through the one sign-in screen
   (it opens its draft where it was left, or its request's portal, 2.2.5 · 2.4.12) · this card used to
   turn itself into a second sign-in screen for that, which is gone · the way back to the terms is
   beside it, each password field has its own eye, and the password's strength shows as it's typed. */


/** Minimum password length - defined once so the requirement and the message stay in sync. */
const MIN_PASS = 8

export default function RegisterAccountPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [show, setShow] = useState(false)
  const [show2, setShow2] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /* Audit 26 Nov · the message stays (the system's toast) until it's closed, a field changes, or the
     form is sent again · and the field it's about says so on itself and takes the focus */
  type F = 'email' | 'pass' | 'pass2'
  const [bad, setBad] = useState<Partial<Record<F, string>>>({})
  const refs = { email: useRef<HTMLInputElement>(null), pass: useRef<HTMLInputElement>(null), pass2: useRef<HTMLInputElement>(null) }
  const fail = (message: string) => setErr(message)
  const errOf = (f: F) => bad[f]
  const edit = (f: F, set: (v: string) => void) => (v: string) => { set(v); if (bad[f]) setBad((b) => ({ ...b, [f]: undefined })) }
  /* the confirmation is judged once the user leaves it (or sends), not on every key */
  const [touched2, setTouched2] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    /* Note: conditions are stated in the order the user actually hits them - one message at a time,
       naming the field. "Check your details" would make them hunt visually for what's wrong. */
    /* Audit 26 Nov · every problem at once, each on its own field · the first takes the focus and
       the toast counts them · it used to stop at the first one, so an empty form spoke of the email
       alone */
    const next: Partial<Record<F, string>> = {}
    if (!email.trim()) next.email = 'أدخل البريد الإلكتروني للجهة'
    else if (!email.includes('@')) next.email = 'أدخل بريدًا إلكترونيًا صحيحًا، مثل name@org.sa'
    const weak = passwordIssues(pass, email)
    if (!pass) next.pass = 'أدخل كلمة المرور'
    else if (pass.length < MIN_PASS || weak.length) next.pass = `كلمة المرور لا تستوفي: ${weak.join('، ') || `${MIN_PASS} أحرف على الأقل`}`
    if (!pass2) next.pass2 = 'أعد إدخال كلمة المرور للتأكيد'
    else if (pass !== pass2) next.pass2 = 'لا تطابق كلمة المرور'
    const keys = (['email', 'pass', 'pass2'] as F[]).filter((k) => next[k])
    if (keys.length) {
      setBad(next)
      setTouched2(true)
      refs[keys[0]].current?.focus()
      fail(keys.length === 1 ? next[keys[0]]! : `صحّح ${keys.length === 2 ? 'حقلين' : `${keys.length} حقول`} قبل المتابعة`)
      return
    }

    setErr('')
    setBusy(true)
    setTimeout(() => {
      setRegAccount(email)
      createAccount(email, pass)
      /* Note: `replace` is deliberate - a browser "back" after creating the account would return to
         an account-creation screen that's already been used, so this screen drops out of history
         exactly like the login screen. */
      navigate(`${ROUTES.entityRegister}?step=form`, { replace: true })
    }, 700)
  }

  /* Audit 26 Nov · each password field has its own eye · showing the confirmation no longer meant
     pressing the eye of the field above it */
  const eye = (on: boolean, set: (f: (v: boolean) => boolean) => void) => (
    <Button plain
      type="button"
      className="leye"
      onClick={() => set((v) => !v)}
      aria-label={on ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      title={on ? 'إخفاء' : 'إظهار'}
    >
      <Icon name={on ? icons.eyeOff : icons.eye} size="md" />
    </Button>
  )
  const mismatch = touched2 && pass2 && pass !== pass2 ? 'لا تطابق كلمة المرور' : undefined

  return (
    <AuthShell title="إنشاء حساب الجهة" sub="الخطوة الثانية في تسجيل جهة جديدة" err={err}>
      <form className="lform" onSubmit={submit} method="post" action="#" noValidate>
        <AuthField
          id="ra-email"
          name="email"
          label="البريد الإلكتروني للجهة"
          icon={icons.mail}
          type="email"
          value={email}
          onChange={edit('email', setEmail)}
          error={errOf('email')}
          inputRef={refs.email}
          autoComplete="email"
          enterKeyHint="next"
        />
        <AuthField
          id="ra-pass"
          name="new-password"
          label="كلمة المرور"
          icon={icons.lock}
          type={show ? 'text' : 'password'}
          value={pass}
          onChange={edit('pass', setPass)}
          error={errOf('pass')}
          inputRef={refs.pass}
          autoComplete="new-password"
          enterKeyHint="next"
          trailing={eye(show, setShow)}
          hint={<PassRules pass={pass} user={email} />}
        />
        <AuthField
          id="ra-pass2"
          name="confirm-password"
          label="تأكيد كلمة المرور"
          icon={icons.lock}
          type={show2 ? 'text' : 'password'}
          value={pass2}
          onChange={edit('pass2', setPass2)}
          error={errOf('pass2') ?? mismatch}
          inputRef={refs.pass2}
          onBlur={() => setTouched2(true)}
          autoComplete="new-password"
          enterKeyHint="go"
          trailing={eye(show2, setShow2)}
          /* Audit 26 Nov · the match is judged when the user leaves the confirmation (or sends), not
             on every key · a half-typed confirmation isn't a mistake yet */
          hint={!mismatch && pass2 && pass === pass2 ? <span className="lrule ok"><Icon name={icons.check} size="sm" />مطابقة</span> : undefined}
        />

        <Button variant="p" full type="submit" disabled={busy}>
          {busy ? 'جارٍ إنشاء الحساب…' : 'أنشئ الحساب وتابع التسجيل'}
        </Button>
      </form>

      {/* Audit 26 Nov · the other ways from here · back to the terms (the step before), or the one
          sign-in screen for an entity that already has an account */}
      <div className="lalt lalt-2">
        <Button variant="2" full type="button" onClick={() => navigate(ROUTES.entityRegister)}>
          <Icon name={icons.chevronBack} size="sm" />
          الضوابط
        </Button>
        <Button variant="2" full type="button" onClick={() => navigate(ROUTES.login)}>
          لديك حساب؟ سجّل الدخول
        </Button>
      </div>
    </AuthShell>
  )
}
