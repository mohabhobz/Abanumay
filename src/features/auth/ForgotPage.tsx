import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, FieldError, Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { ROUTES } from '@/app/routes'
import {
  OTP_LEN, clearOtp, expiresIn, findAccount, otp, resendIn, sendOtp, setPassword, triesLeft, verifyOtp,
  type PortalAccount,
} from '@/data/entities/auth'
import { isEmail, passwordIssues } from '@/data/entities/validate'
import { PassRules, staffRules } from './PassRules'
import { OTP_SAY, mmss, useTick } from '@/features/entities/otp'
import { staffLogin, type StaffAccount } from '@/data/roles'
import { setOwnPassword } from '@/data/staffAuth'
import { WORK_DOMAIN } from '@/data/mock/permissions'
import { toast } from '@/data/feedback'
import { OtpBoxes } from './OtpBoxes'

/* Password reset · one journey for every account (client 26 Nov).

   The user types the name they sign in with (or the account's email or mobile) and never says what
   kind of account it is · the system knows from the name where the code goes: an entity's email and
   mobile, a staff member's work email · every account gets the same code (6 characters, digits and
   capitals), the same boxes, the same timer.

   who → code → new password → done
   · who · one field, checked on the spot (an email's shape, a mobile's), a loading state on send ·
     the next screen reads the same whether the account exists or not (2.3.pw-3)
   · code · six boxes (paste and the phone's autofill fill them all), it checks itself when the sixth
     is typed · the validity counts down the whole time · a wrong code keeps what was typed (to fix
     one character) and says how many tries are left · an expired or spent code says so and the new
     code button is the way on · a new code has its own 60-second wait, counted on the button
   · password · the account's own rules ticking as it's typed, the confirmation judged on leaving it */

type Step = 'who' | 'code' | 'pass' | 'done'

const mobileish = (s: string) => /^[\d\s+]+$/.test(s.trim())
const isMobile = (s: string) => /^(05\d{8}|9665\d{8})$/.test(s.replace(/\D/g, ''))

export default function ForgotPage() {
  const navigate = useNavigate()
  useTick()
  const [step, setStep] = useState<Step>('who')
  const [who, setWho] = useState('')
  const [whoErr, setWhoErr] = useState('')
  const [acct, setAcct] = useState<PortalAccount | undefined>()
  const [staff, setStaff] = useState<StaffAccount | null>(null)
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [passErr, setPassErr] = useState('')
  const [show, setShow] = useState(false)
  const [show2, setShow2] = useState(false)
  const [left2, setLeft2] = useState(false)
  const [busy, setBusy] = useState<'' | 'send' | 'check' | 'save'>('')

  const known = Boolean(acct || staff)
  /* where the code goes · an entity: its email and mobile · a staff member: the work email */
  const dest = (a = acct, s = staff): string[] =>
    a ? [a.email, /X/.test(a.mobile) ? '' : a.mobile] : s ? [who.includes('@') ? who.trim() : `${s.login}@${WORK_DOMAIN}`] : []
  const send = (a = acct, s = staff) => sendOtp('reset', dest(a, s), a?.id ?? (s ? `staff:${s.login}` : undefined))

  /* ── who ── */
  const identify = (e: FormEvent) => {
    e.preventDefault()
    const w = who.trim()
    if (!w) { setWhoErr('أدخل اسم المستخدم أو البريد أو الجوال'); return }
    if (w.includes('@') && !isEmail(w)) { setWhoErr('صيغة البريد غير صحيحة، مثل name@org.sa'); return }
    if (mobileish(w) && !isMobile(w)) { setWhoErr('رقم الجوال يبدأ بـ05 ويليه 8 أرقام'); return }
    setWhoErr('')
    setBusy('send')
    window.setTimeout(() => {
      const a = findAccount(w)
      const s = a ? null : staffLogin(w)
      setAcct(a); setStaff(s)
      /* an unknown name gets the same screen, with a code nobody received */
      if (a || s) send(a, s)
      else sendOtp('reset', [], undefined)
      setCode(''); setCodeErr('')
      setBusy('')
      setStep('code')
    }, 700)
  }

  /* ── code ── */
  const c = otp()
  const left = expiresIn()
  const wait = resendIn()
  const spent = !c || c.dead || left === 0

  const check = (value = code) => {
    if (busy) return
    if (spent) { setCodeErr(left === 0 ? OTP_SAY.expired : OTP_SAY.dead); return }
    if (value.length < OTP_LEN) { setCodeErr(`أدخل الرمز كاملًا · ${OTP_LEN} خانات`); return }
    setBusy('check')
    window.setTimeout(() => {
      setBusy('')
      const r = known ? verifyOtp(value) : (verifyOtp('______'), 'wrong' as const)
      if (r === 'ok') { setCodeErr(''); setStep('pass'); return }
      const t = triesLeft()
      setCodeErr(r === 'wrong' && t > 0 ? `${OTP_SAY.wrong} تبقّى ${t} ${t === 1 ? 'محاولة' : 'محاولات'}.` : r === 'wrong' ? OTP_SAY.dead : OTP_SAY[r])
    }, 600)
  }
  const resend = () => {
    if (wait > 0) return
    if (known) send(); else sendOtp('reset', [], undefined)
    setCode(''); setCodeErr('')
    toast('أُرسل رمز جديد · الرمز السابق لم يعد يعمل', 'ok')
  }
  /* the code ran out while the screen was open · said on its own, without a press */
  useEffect(() => {
    if (step === 'code' && c && !c.dead && left === 0) setCodeErr(OTP_SAY.expired)
  }, [step, left, c])

  /* ── password ── */
  const rulesOk = staff ? staffRules(pass).every((r) => r.ok) : !passwordIssues(pass, acct?.username).length
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!pass) { setPassErr('أدخل كلمة المرور الجديدة'); return }
    if (!rulesOk) { setPassErr('كلمة المرور لا تستوفي الشروط أدناه'); return }
    setPassErr('')
    if (pass !== pass2) { setLeft2(true); return }
    setBusy('save')
    window.setTimeout(() => {
      if (acct) setPassword(acct, pass)
      if (staff) setOwnPassword(staff.login, pass)
      clearOtp()
      setBusy('')
      setStep('done')
    }, 600)
  }

  const sub = step === 'who' ? 'أدخل الاسم الذي تدخل به، أو بريدك أو جوالك'
    : step === 'code' ? 'أدخل الرمز المرسَل إليك'
      : step === 'pass' ? 'عيّن كلمة مرور جديدة'
        : 'تمّت الاستعادة'

  return (
    <AuthShell title="استعادة كلمة المرور" sub={sub}>
      {step === 'who' && (
        <form className="lform" onSubmit={identify} noValidate>
          <AuthField id="fp-who" name="username" label="اسم المستخدم أو البريد أو الجوال" icon={icons.user}
            value={who} onChange={(v) => { setWho(v); if (whoErr) setWhoErr('') }}
            autoComplete="username" enterKeyHint="send" error={whoErr || undefined} />
          <Button variant="p" full type="submit" disabled={busy === 'send'}>
            {busy === 'send' ? 'جارٍ الإرسال…' : 'أرسل رمز التحقّق'}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form className="lform" onSubmit={(e) => { e.preventDefault(); check() }} noValidate>
          <p className="lnote sub lwhy">
            إن كان الحساب مسجَّلًا لدينا فقد أُرسل رمز من <span className="num">{OTP_LEN}</span> خانات
            {known && c && c.to.length ? <> إلى <span dir="ltr">{c.to.join(' · ')}</span></> : <> إلى وسيلة التواصل المسجّلة</>}.
          </p>
          <OtpBoxes value={code} onChange={(v) => { setCode(v); if (codeErr && !spent) setCodeErr('') }}
            onComplete={(v) => check(v)} disabled={spent || busy === 'check'} invalid={Boolean(codeErr)} autoFocus describedBy="fp-code-err" />
          {codeErr && <FieldError id="fp-code-err">{codeErr}</FieldError>}
          {/* the validity, always in view, counting down */}
          <p className={`otp-time${left <= 60 && !spent ? ' soon' : ''}`} aria-live="off">
            <Icon name={icons.clock} size="sm" />
            {spent ? 'انتهت صلاحية هذا الرمز' : <>صالح لمدة <b className="num">{mmss(left)}</b> · <span className="num">{triesLeft()}</span> {triesLeft() === 1 ? 'محاولة' : 'محاولات'}</>}
          </p>
          <Button variant="p" full type="submit" disabled={spent || busy === 'check'}>
            {busy === 'check' ? 'جارٍ التحقّق…' : 'تحقّق من الرمز'}
          </Button>
          <Button variant="2" full type="button" disabled={wait > 0} onClick={resend}
            title={wait > 0 ? `يُتاح رمز جديد بعد ${mmss(wait)}` : 'أرسل رمزًا جديدًا'}>
            <Icon name={icons.redo} size="sm" />
            {wait > 0 ? <>رمز جديد بعد <span className="num">{mmss(wait)}</span></> : 'أرسل رمزًا جديدًا'}
          </Button>
          <Button plain type="button" className="llink lcenter" onClick={() => { setStep('who'); setCode(''); setCodeErr('') }}>
            ليس هذا حسابك؟ غيّر الاسم
          </Button>
          {/* there is no mail or SMS gateway in the prototype · the code is shown so the journey can be walked */}
          {known && c && !c.dead && <p className="lnote sub otp-demo">رمز النموذج التجريبي: <span className="num" dir="ltr">{c.code}</span></p>}
        </form>
      )}

      {step === 'pass' && (
        <form className="lform" onSubmit={save} noValidate>
          <AuthField id="fp-pass" name="new-password" label="كلمة المرور الجديدة" icon={icons.lock}
            type={show ? 'text' : 'password'} value={pass} onChange={(v) => { setPass(v); if (passErr) setPassErr('') }}
            autoComplete="new-password" enterKeyHint="next" error={passErr || undefined}
            trailing={<Button plain type="button" className="leye" onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              <Icon name={show ? icons.eyeOff : icons.eye} size="md" /></Button>}
            hint={<PassRules pass={pass} user={acct?.username ?? staff?.login ?? ''} staff={Boolean(staff)} />} />
          <AuthField id="fp-pass2" name="confirm-password" label="تأكيد كلمة المرور" icon={icons.lock}
            type={show2 ? 'text' : 'password'} value={pass2} onChange={setPass2} autoComplete="new-password" enterKeyHint="go"
            onBlur={() => setLeft2(true)}
            trailing={<Button plain type="button" className="leye" onClick={() => setShow2((v) => !v)} aria-label={show2 ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              <Icon name={show2 ? icons.eyeOff : icons.eye} size="md" /></Button>}
            error={left2 && pass !== pass2 ? (pass2 ? 'لا تطابق كلمة المرور' : 'أعد إدخال كلمة المرور للتأكيد') : undefined}
            hint={pass2 && pass === pass2 ? <span className="lrule ok"><Icon name={icons.check} size="sm" />مطابقة</span> : undefined} />
          <Button variant="p" full type="submit" disabled={busy === 'save'}>{busy === 'save' ? 'جارٍ الحفظ…' : 'احفظ كلمة المرور'}</Button>
        </form>
      )}

      {step === 'done' && (
        <div className="lform">
          <p className="lrule ok lcenter"><Icon name={icons.check} size="sm" />حُفظت كلمة المرور الجديدة · كل رمز سابق لم يعد يعمل</p>
          <Button variant="p" full type="button"
            onClick={() => navigate(ROUTES.login, { replace: true, state: { user: acct?.username ?? staff?.login, reset: true } })}>
            الذهاب إلى تسجيل الدخول
          </Button>
        </div>
      )}

      {step !== 'done' && (
        <div className="lalt">
          <Button variant="2" full type="button" onClick={() => navigate(ROUTES.login)}>العودة إلى تسجيل الدخول</Button>
        </div>
      )}
    </AuthShell>
  )
}
