import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { ROUTES } from '@/app/routes'
import {
  OTP_LEN, clearOtp, expiresIn, findAccount, mask, otp, resendIn, sendOtp, setPassword, triesLeft, verifyOtp,
  type PortalAccount,
} from '@/data/entities/auth'
import { passwordIssues } from '@/data/entities/validate'
import { ENTITY_RULES } from '@/data/entities/rules'
import { OTP_SAY, mmss, useTick } from '@/features/entities/otp'

/* Password reset · fully self-service (2.3.pw-1 – 2.3.pw-14).

   Four steps on the login card: who you are → the code → the new password → back to sign-in.

   The first step answers the same sentence whether the account exists or not (2.3.pw-3): an
   attacker typing emails learns nothing. The code step is shown either way too — for an unknown
   account no code was sent, and the screen can't tell the difference.

   Nothing here goes through the system administrator (2.3.pw-12): the entity resets its own
   password, and every earlier code dies when the new one is saved (2.3.pw-9). */

type Step = 'who' | 'code' | 'pass' | 'done'

export default function ForgotPage() {
  const navigate = useNavigate()
  useTick()
  const [step, setStep] = useState<Step>('who')
  const [who, setWho] = useState('')
  const [acct, setAcct] = useState<PortalAccount | undefined>()
  const [code, setCode] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')

  const fail = (m: string) => { setErr(m); setTimeout(() => setErr(''), 4000) }

  const identify = (e: FormEvent) => {
    e.preventDefault()
    if (!who.trim()) { fail('أدخل اسم المستخدم أو البريد أو الجوال'); return }
    const a = findAccount(who)
    setAcct(a)
    /* An unknown account gets the same screen, with a code nobody received */
    if (a) sendOtp('reset', [a.email, /X/.test(a.mobile) ? '' : a.mobile], a.id)
    else clearOtp()
    setNote('إن كان الحساب مسجَّلًا لدينا فقد أُرسل إليه رمز تحقّق صالح لمدة محدودة.')
    setStep('code')
  }

  const check = (e: FormEvent) => {
    e.preventDefault()
    if (!acct) { fail(OTP_SAY.wrong); setCode(''); return }
    const r = verifyOtp(code)
    if (r === 'ok') { setStep('pass'); setNote(''); return }
    fail(r === 'wrong' ? `${OTP_SAY.wrong} تبقّى ${triesLeft()}.` : OTP_SAY[r])
    setCode('')
  }

  const issues = passwordIssues(pass, acct?.username)
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (issues.length) { fail(`كلمة المرور: ${issues.join('، ')}`); return }
    if (pass !== pass2) { fail('كلمتا المرور غير متطابقتين'); return }
    if (acct) setPassword(acct, pass)
    setStep('done')
  }

  const c = otp()
  const left = expiresIn()
  const wait = resendIn()

  return (
    <AuthShell title="استعادة كلمة المرور" sub="لحسابات الجهات في بوابة المنح" err={err}>
      {step === 'who' && (
        <form className="lform" onSubmit={identify} noValidate>
          <p className="lnote sub lwhy">أدخل اسم المستخدم أو البريد الإلكتروني أو رقم الجوال المسجَّل · يصلك رمز تحقّق لتعيين كلمة مرور جديدة.</p>
          <AuthField id="fp-who" name="username" label="اسم المستخدم أو البريد أو الجوال" icon={icons.user}
            value={who} onChange={setWho} autoComplete="username" enterKeyHint="go" />
          <button className="btn btn-p btn-full" type="submit">أرسل رمز التحقّق</button>
        </form>
      )}

      {step === 'code' && (
        <form className="lform" onSubmit={check} noValidate>
          <p className="lnote sub lwhy">{note}</p>
          {acct && c && <p className="lnote sub">إلى {c.to.join(' و')}</p>}
          <AuthField id="fp-code" name="one-time-code" label={`رمز التحقّق · ${OTP_LEN} أرقام`} icon={icons.lock}
            value={code} onChange={(x) => setCode(x.replace(/\D/g, '').slice(0, OTP_LEN))} autoComplete="one-time-code" enterKeyHint="go"
            hint={acct && c
              ? c.dead
                ? <span className="bad">{left === 0 ? OTP_SAY.expired : OTP_SAY.dead}</span>
                : <>صالح لمدة <span className="num">{mmss(left)}</span> · {triesLeft()} محاولات متبقية</>
              : <>صالح لمدة <span className="num">{ENTITY_RULES.otpMinutes}</span> دقائق</>} />
          <button className="btn btn-p btn-full" type="submit" disabled={code.length !== OTP_LEN}>تحقّق من الرمز</button>
          <button
            className="btn btn-2 btn-full"
            type="button"
            disabled={Boolean(acct) && wait > 0}
            onClick={() => { if (acct) sendOtp('reset', [acct.email, /X/.test(acct.mobile) ? '' : acct.mobile], acct.id); setCode('') }}
          >
            <Icon name={icons.redo} size="sm" />
            {acct && wait > 0 ? <>رمز جديد بعد <span className="num">{wait}</span> ث</> : 'أرسل رمزًا جديدًا'}
          </button>
          {acct && c && !c.dead && <p className="lnote sub otp-demo">رمز النموذج التجريبي: <span className="num">{c.code}</span></p>}
        </form>
      )}

      {step === 'pass' && (
        <form className="lform" onSubmit={save} noValidate>
          <p className="lnote sub lwhy">عيّن كلمة مرور جديدة لـ <b>{acct ? mask(acct.email) : ''}</b> · تُلغى بعدها كل الرموز السابقة.</p>
          <AuthField id="fp-pass" name="new-password" label="كلمة المرور الجديدة" icon={icons.lock}
            type={show ? 'text' : 'password'} value={pass} onChange={setPass} autoComplete="new-password" enterKeyHint="next"
            trailing={<button type="button" className="leye" onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              <Icon name={show ? icons.eyeOff : icons.eye} size="md" /></button>}
            hint={pass ? (issues.length ? <span className="bad">ينقص: {issues.join('، ')}</span> : <span className="ok-ink">تستوفي السياسة</span>)
              : <>{ENTITY_RULES.passMin} أحرف على الأقل، فيها حرف ورقم</>} />
          <AuthField id="fp-pass2" name="confirm-password" label="تأكيد كلمة المرور" icon={icons.lock}
            type={show ? 'text' : 'password'} value={pass2} onChange={setPass2} autoComplete="new-password" enterKeyHint="go"
            hint={pass2 && pass !== pass2 ? <span className="bad">لا تطابق كلمة المرور</span> : undefined} />
          <button className="btn btn-p btn-full" type="submit">احفظ كلمة المرور</button>
        </form>
      )}

      {step === 'done' && (
        <div className="lform">
          <p className="lnote sub lwhy">
            <Icon name={icons.check} size="sm" /> حُفظت كلمة المرور الجديدة وأُلغيت الرموز السابقة · ادخل بها الآن.
          </p>
          <button className="btn btn-p btn-full" type="button"
            onClick={() => navigate(ROUTES.login, { replace: true, state: { user: acct?.username, reset: true } })}>
            الذهاب إلى تسجيل الدخول
          </button>
        </div>
      )}

      <div className="lalt">
        <button className="btn btn-2 btn-full" type="button" onClick={() => navigate(ROUTES.login)}>العودة إلى تسجيل الدخول</button>
      </div>
    </AuthShell>
  )
}
