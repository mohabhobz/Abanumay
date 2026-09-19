import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import Logo from '@/assets/LogoColor'
import { Icon, icons } from '@/components/ui'

/* ═══════════════════════════════════════════════════════════
   غلاف شاشات الباب · **مكتوب مرة واحدة**

   ⚠️ **الشاشة دي كانت شاشة واحدة، وبقت اتنين** · الدخول، وإنشاء
   حساب الجهة. والاتنين نفس المنظر بالظبط: الفيديو خلفية، وكارت
   زجاج في الفتحة اللي في نص الكادر، والعلامة والعنوان فوقه،
   وسطر الحقوق تحته.

   ونسخ الغلاف للشاشة التانية كان هيخلّي **حاجتين بيقولوا نفس
   المعنى بشكلين بعد شهر** · نفس الدرس اللي الثريد اتصلّح عليه.
   فاللي بيتغيّر بين الشاشتين هو **المحتوى** بس، والغلاف واحد.

   ⚠️ **والحقل هنا مش حقل السيستم (`.fld`).** شاشات الباب ليها
   حقلها الخاص (`.lfield`) بعلامة داخلية وحالة تركيز أوضح · وده
   مقصود: الشاشة دي برّه النظام، بتتفتح على فيديو لا على أرضية
   زجاج، والحقل الرفيع بتاع الجداول بيضيع عليها. فالاستثناء
   مكتوب هنا مرة واحدة بدل ما كل شاشة تخترعه.
   ═══════════════════════════════════════════════════════════ */

export interface AuthShellProps {
  /** العنوان تحت العلامة */
  title: string
  /** سطر تحت العنوان */
  sub: string
  children: ReactNode
  /** رسالة تنبيه بتطفو فوق الكارت وبتختفي لوحدها */
  err?: string
}

export function AuthShell({ title, sub, children, err }: AuthShellProps) {
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

/* حقل بعلامة داخلية وحالة تركيز واضحة · الحدود بتغمق مش بتتلوّن */
export interface AuthFieldProps {
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
  /** سطر تحت الحقل · شرط أو توضيح */
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
      {hint && <span className="lhint sub">{hint}</span>}
    </label>
  )
}
