import { useState, type FormEvent } from 'react'
import { signIn } from '@/data/session'
import { useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from '@/features/auth/AuthShell'
import { ROUTES } from '@/app/routes'
import { regRows, setRegAccount } from '@/data/mock/registration'
import { createAccount, passwordOk } from '@/data/entities/auth'
import { draftOf } from '@/data/entities/store'
import { passwordIssues } from '@/data/entities/validate'

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

   The same card also brings an entity back (2.2.5 · 2.4.12): with the account's email and password
   a saved draft opens where it was left, and a sent request opens its portal. A forgotten password
   goes to the self-service reset. */

/** Minimum password length - defined once so the requirement and the message stay in sync. */
const MIN_PASS = 8

export default function RegisterAccountPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /* Two jobs on one card: create the account, or come back to it (2.2.5 · 2.4.12) */
  const [back, setBack] = useState(false)

  /** Shows the error as a toast and hides it on its own - same behavior as the login screen. */
  const fail = (message: string) => {
    setErr(message)
    setTimeout(() => setErr(''), 4000)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    /* Note: conditions are stated in the order the user actually hits them - one message at a time,
       naming the field. "Check your details" would make them hunt visually for what's wrong. */
    if (!email.trim()) { fail('أدخل البريد الإلكتروني للجهة'); return }
    if (!email.includes('@')) { fail('أدخل بريدًا إلكترونيًا صحيحًا، مثل name@org.sa'); return }
    if (back) {
      /* Coming back · the saved draft opens where it was left; a sent request opens its portal */
      if (passwordOk(email, pass) === false) { fail('كلمة المرور غير صحيحة'); return }
      setRegAccount(email)
      const d = draftOf(email.trim())
      const sent = regRows.find((r) => r.acctEmail === email.trim() && r.state !== 'draft')
      /* The registrant's session · it opens its own request's portal and nothing else */
      if (sent) signIn(email.trim(), 'entity', sent.state === 'approved' && sent.entityId ? { entityId: sent.entityId, reqId: sent.id } : { reqId: sent.id })
      navigate(d?.state === 'draft' ? `${ROUTES.entityRegister}?step=form`
        : sent ? `${ROUTES.entityPortal}?req=${sent.id}` : `${ROUTES.entityRegister}?step=form`, { replace: true })
      return
    }
    const weak = passwordIssues(pass, email)
    if (pass.length < MIN_PASS || weak.length) { fail(`كلمة المرور: ${weak.join('، ') || `${MIN_PASS} أحرف على الأقل`}`); return }
    if (pass !== pass2) { fail('كلمتا المرور غير متطابقتين. أعد إدخال التأكيد.'); return }

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

  const eye = (
    <button
      type="button"
      className="leye"
      onClick={() => setShow((v) => !v)}
      aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
      title={show ? 'إخفاء' : 'إظهار'}
    >
      <Icon name={show ? icons.eyeOff : icons.eye} size="md" />
    </button>
  )

  return (
    <AuthShell title={back ? 'العودة إلى طلبك' : 'إنشاء حساب الجهة'} sub={back ? 'بالحساب الذي أنشأته عند التسجيل' : 'الخطوة الأولى في تسجيل جهة جديدة'} err={err}>
      {/* Note: this line explains why the account comes before the form. The entity asks "why am I
          creating an account before I've even applied" - the answer is that the form itself is long
          and gets interrupted: the license file, board term date, and IBAN aren't things people
          have on hand, so they start, go get a document, and come back. The account is what makes
          that "come back" possible. */}
      <p className="lnote sub lwhy">
        يُحفظ الطلب على هذا الحساب · يمكن تركه في أي خطوة والعودة إليه، ومتابعة
        حالته بعد الإرسال.
      </p>

      <form className="lform" onSubmit={submit} method="post" action="#" noValidate>
        <AuthField
          id="ra-email"
          name="email"
          label="البريد الإلكتروني للجهة"
          icon={icons.mail}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          enterKeyHint="next"
          hint="تصل إليه جميع الإشعارات"
        />
        <AuthField
          id="ra-pass"
          name={back ? 'password' : 'new-password'}
          label="كلمة المرور"
          icon={icons.lock}
          type={show ? 'text' : 'password'}
          value={pass}
          onChange={setPass}
          autoComplete={back ? 'current-password' : 'new-password'}
          enterKeyHint={back ? 'go' : 'next'}
          trailing={eye}
          hint={back ? undefined : <><span className="num">{MIN_PASS}</span> أحرف على الأقل، فيها حرف ورقم</>}
        />
        {!back && <AuthField
          id="ra-pass2"
          name="confirm-password"
          label="تأكيد كلمة المرور"
          icon={icons.lock}
          type={show ? 'text' : 'password'}
          value={pass2}
          onChange={setPass2}
          autoComplete="new-password"
          enterKeyHint="go"
          /* Note: match is stated while typing, not after clicking - a condition stated after a
             click makes the user go back and clear two fields instead of fixing one character. */
          hint={pass2 && pass !== pass2
            ? <span className="bad">لا تطابق كلمة المرور</span>
            : undefined}
        />}

        <button className="btn btn-p btn-full" type="submit" disabled={busy}>
          {back ? 'افتح طلبي' : busy ? 'جارٍ إنشاء الحساب…' : 'أنشئ الحساب وتابع التسجيل'}
        </button>
      </form>

      {/* Other paths - styled as a ghost so they don't compete with the primary button. */}
      <div className="lalt">
        <button
          className="btn btn-2 btn-full"
          type="button"
          onClick={() => { setBack((x) => !x); setErr('') }}
        >
          {back ? 'ليس لديك حساب؟ أنشئ حسابًا' : 'لديك حساب بالفعل؟ عُد إلى طلبك'}
        </button>
        <p className="lnote sub">
          {back
            ? <>نسيت كلمة المرور؟ <button type="button" className="llink" onClick={() => navigate(ROUTES.forgot)}>استعدها</button></>
            : 'تُفتح المسودة حيث تركتها، ويُفتح الطلب المرسل في بوابته.'}
        </p>
      </div>
    </AuthShell>
  )
}
