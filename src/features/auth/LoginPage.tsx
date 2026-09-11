import type { LucideIcon } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import { Icon, icons } from '@/components/ui'
import { AFTER_LOGIN } from '@/app/routes'
import { signIn } from '@/data/session'

/* ═══════════════════════════════════════════════════════════
   شاشة الدخول

   الفيديو خلفية مش بطل: الفتحة اللي في نص الكادر هي مكان الكارت.
   الفيديو بيتعرض بلونه الطبيعي، والكارت زجاج زي كروت الداخل.

   من النظام الحقيقي: اسم مستخدم وكلمة مرور، ومسار منفصل تمامًا
   اسمه «تسجيل جهة جديدة».
   ═══════════════════════════════════════════════════════════ */

export default function LoginPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  /* الرابط اللي اتحوّل منه — لو فتح رابط مشروع وهو برّه، يرجعله
     بعد الدخول بدل ما يبدأ من الأول */
  const from = (loc.state as { from?: string } | null)?.from
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /** يعرض الخطأ كتوست ويخفيه لوحده — الرسالة تنبيه مش حالة دائمة */
  const fail = (message: string) => {
    setErr(message)
    setTimeout(() => setErr(''), 4000)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!user.trim() || !pass) {
      fail('اكتب اسم المستخدم وكلمة المرور')
      return
    }
    setErr('')
    setBusy(true)
    setTimeout(() => {
      signIn(user.trim())
      navigate(from ?? AFTER_LOGIN, { replace: true })
    }, 700)
  }

  return (
    <div className="login">
      <video className="login-vid" autoPlay muted loop playsInline poster="./login-poster.jpg">
        <source src="./login-bg.mp4" type="video/mp4" />
      </video>

      <main className="login-mid">
        <div className="lcard glass">
          {/* توست: بيطفو فوق الفورم وما يزقّش أي حاجة، وبيختفي لوحده */}
          {err && (
            <div className="ltoast" role="alert">
              <Icon name={icons.alert} size={16} />
              <span>{err}</span>
            </div>
          )}

          <div className="lhead">
            <span className="lmark"><Logo /></span>
            <h1 className="ltitle">منح أبانمي</h1>
            <p className="lsub">مؤسسة سليمان أبانمي الأهلية</p>
          </div>

          {/* method/action موجودين عشان مديري كلمات السر يتعرّفوا على
              الفورم ويعرضوا الحفظ — الإرسال نفسه متوقّف بـpreventDefault */}
          <form
            className="lform"
            onSubmit={submit}
            method="post"
            action="#"
            noValidate
          >
            <Field
              id="lg-user"
              name="username"
              label="اسم المستخدم"
              icon={icons.user}
              value={user}
              onChange={setUser}
              autoComplete="username"
              enterKeyHint="next"
            />
            <Field
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
                  <Icon name={show ? icons.eyeOff : icons.eye} size={17} />
                </button>
              }
            />

            <div className="lrow">
              <label className="lcheck">
                <input type="checkbox" name="remember" />
                <span>تذكّرني</span>
              </label>
              <a className="llink">نسيت كلمة المرور؟</a>
            </div>

            <button className="btn btn-p btn-full" type="submit" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>
          </form>

          {/* مسار مختلف تمامًا، فشكله جوست — مش قرار تاني منافس للدخول */}
          <div className="lalt">
            <button className="btn btn-ghost btn-full" type="button">تسجيل جهة جديدة</button>
            <p className="lnote sub">للجمعيات والمؤسسات التي لم تسجّل في المنصة بعد</p>
          </div>
        </div>

        <p className="lfoot sub">جميع الحقوق محفوظة · مؤسسة سليمان أبانمي الأهلية</p>
      </main>
    </div>
  )
}

/* حقل بعلامة داخلية وحالة تركيز واضحة — الحدود بتغمق مش بتتلوّن */
interface FieldProps {
  id: string
  /** لازم للاسم عشان مديري كلمات السر والأوتوفيل يتعرّفوا على الحقل */
  name: string
  label: string
  icon: LucideIcon
  value: string
  onChange: (value: string) => void
  type?: string
  trailing?: ReactNode
  /** توكن الأوتوفيل القياسي: username · current-password … */
  autoComplete?: string
  /** شكل زرار الإدخال في كيبورد الموبايل */
  enterKeyHint?: 'go' | 'next' | 'done' | 'send' | 'search' | 'enter'
}

function Field({
  id, name, label, icon, value, onChange,
  type = 'text', trailing, autoComplete, enterKeyHint,
}: FieldProps) {
  return (
    <label className="lfield" htmlFor={id}>
      <span className="llbl">{label}</span>
      <span className="lbox">
        <Icon name={icon} size={17} />
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
    </label>
  )
}
