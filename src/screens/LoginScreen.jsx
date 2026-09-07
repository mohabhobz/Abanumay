import { useState, useRef, useEffect } from 'react'
import Logo from '../assets/LogoColor.jsx'
import { Icon, icons } from '../components/ui.jsx'

/* ═══════════════════════════════════════════════════════════
   شاشة الدخول

   الفيديو خلفية مش بطل: الفتحة اللي في نص الكادر هي مكان الكارت،
   وفوقها طبقة تلوين بهوية المؤسسة عشان الأخضر الطبيعي يتحوّل
   لتيل الهوية، وطبقة تعتيم خفيفة عشان النص الغامق يفضل مقروء
   مهما اختلف الفريم.

   من النظام الحقيقي: اسم مستخدم وكلمة مرور، ومسار منفصل تمامًا
   اسمه «تسجيل جهة جديدة»، و OTP مفعّل — فالدخول خطوتين.
   ═══════════════════════════════════════════════════════════ */

export default function LoginScreen({ onDone }) {
  const [step, setStep] = useState('creds')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!user.trim() || !pass) {
      setErr('اكتب اسم المستخدم وكلمة المرور')
      return
    }
    setErr('')
    setBusy(true)
    setTimeout(() => { setBusy(false); setStep('otp') }, 900)
  }

  return (
    <div className="login">
      <video className="login-vid" autoPlay muted loop playsInline poster="./login-poster.jpg">
        <source src="./login-bg.mp4" type="video/mp4" />
      </video>
      <span className="login-tint" aria-hidden="true" />
      <span className="login-grain grain" aria-hidden="true" />

      <main className="login-mid">
        <div className="lcard chrome">
          <div className="lhead">
            <span className="lmark"><Logo /></span>
            <h1 className="ltitle">منح أبانمي</h1>
            <p className="lsub">
              {step === 'creds'
                ? 'مؤسسة سليمان أبانمي الأهلية'
                : `أرسلنا رمز تحقق إلى جوال ${user || 'المستخدم'}`}
            </p>
          </div>

          {step === 'creds' ? (
            <form className="lform" onSubmit={submit} noValidate>
              <Field
                id="lg-user"
                label="اسم المستخدم"
                icon={icons.user}
                value={user}
                onChange={setUser}
                autoComplete="username"
              />
              <Field
                id="lg-pass"
                label="كلمة المرور"
                icon={icons.lock}
                type={show ? 'text' : 'password'}
                value={pass}
                onChange={setPass}
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    className="leye"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    title={show ? 'إخفاء' : 'إظهار'}
                  >
                    <Icon path={show ? icons.eyeOff : icons.eye} size={17} />
                  </button>
                }
              />

              {err && <div className="lerr">{err}</div>}

              <div className="lrow">
                <label className="lcheck">
                  <input type="checkbox" />
                  <span>تذكّرني</span>
                </label>
                <a className="llink">نسيت كلمة المرور؟</a>
              </div>

              <button className={`lgo${busy ? ' busy' : ''}`} type="submit" disabled={busy}>
                {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
              </button>
            </form>
          ) : (
            <Otp onBack={() => setStep('creds')} onDone={onDone} />
          )}

          {/* التسجيل مسار دخول مختلف، فمالوش لازمة وأنت جوّه خطوة التحقق */}
          {step === 'creds' && (
            <div className="lalt">
              <span className="lsep"><i /><b>أو</b><i /></span>
              <button className="lreg" type="button">
                <Icon path={icons.entity} size={17} />
                تسجيل جهة جديدة
              </button>
              <p className="lnote sub">للجمعيات والمؤسسات التي لم تسجّل في المنصة بعد</p>
            </div>
          )}
        </div>

        <p className="lfoot sub">جميع الحقوق محفوظة · مؤسسة سليمان أبانمي الأهلية</p>
      </main>
    </div>
  )
}

/* حقل بعلامة داخلية وحالة تركيز واضحة — الحدود بتغمق مش بتتلوّن */
function Field({ id, label, icon, value, onChange, type = 'text', trailing, autoComplete }) {
  return (
    <label className="lfield" htmlFor={id}>
      <span className="llbl">{label}</span>
      <span className="lbox">
        <Icon path={icon} size={17} />
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          dir="ltr"
        />
        {trailing}
      </span>
    </label>
  )
}

/* الخطوة التانية — الـOTP مفعّل فعلًا في النظام ومربوط بجوال المستخدم */
function Otp({ onBack, onDone }) {
  const [code, setCode] = useState(['', '', '', ''])
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const full = code.every((c) => c !== '')

  useEffect(() => { refs[0].current?.focus() }, [])

  const put = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1)
    setCode((c) => c.map((x, j) => (j === i ? d : x)))
    if (d && i < 3) refs[i + 1].current?.focus()
  }

  const key = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs[i - 1].current?.focus()
  }

  return (
    <form className="lform" onSubmit={(e) => { e.preventDefault(); onDone?.() }}>
      <div className="lotp" dir="ltr">
        {code.map((c, i) => (
          <input
            key={i}
            ref={refs[i]}
            inputMode="numeric"
            maxLength={1}
            value={c}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => key(i, e)}
            aria-label={`الخانة ${i + 1}`}
          />
        ))}
      </div>

      <div className="lrow">
        <button type="button" className="llink" onClick={onBack}>رجوع</button>
        <button type="button" className="llink">إعادة الإرسال</button>
      </div>

      <button className="lgo" type="submit" disabled={!full}>تأكيد الدخول</button>
    </form>
  )
}
