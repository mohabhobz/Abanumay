import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from '@/features/auth/AuthShell'
import { ROUTES } from '@/app/routes'
import { setRegAccount } from '@/data/mock/registration'

/* ═══════════════════════════════════════════════════════════
   إنشاء حساب الجهة · شاشة بذاتها

   ⚠️ **الحساب كان أول محطة في الستيبر، وده كان غلطًا في تصنيف
   الخطوة لا في مكانها.** الجهة بتفتح التسجيل فتلاقي أول ما
   تشوفه وسم **«٣ ناقص»** على «حساب الجهة» · يعني الشاشة بتقول
   لها إنها ناقصة حاجة قبل ما تعمل أي حاجة، وبتحطّ إيميل وكلمة
   مرور جنب «تاريخ انتهاء تكليف المجلس» و«رقم الآيبان» كإنهم من
   نفس النوع. وهما مش من نفس النوع:

     · بيانات الطلب · **إقرار** بتتراجع وبتتقارن بالتصريح
     · الحساب · **الباب** اللي الطلب بيتحفظ عليه وبترجع له

   فالحساب طلع لشاشته، وشكلها **شكل الدخول** لأن ده اللي هي فعلًا:
   بريد وكلمة مرور على فيديو الباب، لا حقول رفيعة في فورم طويل.
   والمحطة بتفضل في الستيبر **معلَّمة «تمّت»** عشان الجهة تشوف إنها
   عدّتها · شيلها كان هيخلّيها تفتكر إن الرحلة خمس خطوات وهي ستة.

   ⚠️ **والشاشة دي إنشاء لا دخول.** الجهة اللي عندها حساب بالفعل
   بتروح لبوّابة طلبها لا هنا · والسطر تحت الزرار بيقول كده
   ويودّيها، بدل ما تعمل حسابًا تانيًا وتضيّع طلبها الأول.

   ⚠️ **ومفيش «تذكّرني» ولا «نسيت كلمة المرور».** الاتنين دول
   لشاشة الدخول · وهنا مفيش حساب أصلًا عشان يتنسي أو يتفكر.
   الغلاف واحد والمحتوى بيقول شغله هو.
   ═══════════════════════════════════════════════════════════ */

/** أقلّ طول لكلمة المرور · مكتوب مرة واحدة عشان الشرط والرسالة يتفقوا */
const MIN_PASS = 8

export default function RegisterAccountPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /** يعرض الخطأ كتوست ويخفيه لوحده · نفس سلوك شاشة الدخول */
  const fail = (message: string) => {
    setErr(message)
    setTimeout(() => setErr(''), 4000)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    /* ⚠️ **الشروط بتتقال بالترتيب اللي المستخدم بيقع فيه** · رسالة
       واحدة في المرة، وبتسمّي الحقل · «تأكد من البيانات» بتخلّيه
       يدوّر بعينه على اللي هو غلط فيه. */
    if (!email.trim()) { fail('أدخل البريد الإلكتروني للجهة'); return }
    if (!email.includes('@')) { fail('أدخل بريدًا إلكترونيًا صحيحًا، مثل name@org.sa'); return }
    if (pass.length < MIN_PASS) { fail(`أدخل كلمة مرور من ${MIN_PASS} أحرف على الأقل`); return }
    if (pass !== pass2) { fail('كلمتا المرور غير متطابقتين. أعد إدخال التأكيد.'); return }

    setErr('')
    setBusy(true)
    setTimeout(() => {
      setRegAccount(email)
      /* ⚠️ `replace` عن قصد · «رجوع» المتصفح بعد إنشاء الحساب
         يرجّع لشاشة إنشاء حساب اتعمل خلاص · فالشاشة دي بتتشال من
         التاريخ زي شاشة الدخول بالظبط. */
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
    <AuthShell title="إنشاء حساب الجهة" sub="الخطوة الأولى في تسجيل جهة جديدة" err={err}>
      {/* ⚠️ **السطر ده بيقول ليه الحساب قبل النموذج.** الجهة بتسأل
          «أنا بعمل حساب ليه وأنا لسه ما قدّمتش» · والإجابة إن
          النموذج نفسه طويل وبيتقطع: ملف الترخيص وتاريخ تكليف
          المجلس والآيبان مش حاجات حافظها، فهي بتبدأ وتقوم تجيب
          ورقة وترجع. والحساب هو اللي بيخلّي «ترجع» دي ممكنة. */}
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
          name="new-password"
          label="كلمة المرور"
          icon={icons.lock}
          type={show ? 'text' : 'password'}
          value={pass}
          onChange={setPass}
          autoComplete="new-password"
          enterKeyHint="next"
          trailing={eye}
          hint={<><span className="num">{MIN_PASS}</span> أحرف على الأقل</>}
        />
        <AuthField
          id="ra-pass2"
          name="confirm-password"
          label="تأكيد كلمة المرور"
          icon={icons.lock}
          type={show ? 'text' : 'password'}
          value={pass2}
          onChange={setPass2}
          autoComplete="new-password"
          enterKeyHint="go"
          /* ⚠️ **التطابق بيتقال وإنت بتكتب لا بعد ما تضغط** ·
              الشرط اللي بيتقال بعد الضغط بيخلّي المستخدم يرجع
              يمسح حقلين بدل ما يصلّح حرفًا. */
          hint={pass2 && pass !== pass2
            ? <span className="bad">لا تطابق كلمة المرور</span>
            : undefined}
        />

        <button className="btn btn-p btn-full" type="submit" disabled={busy}>
          {busy ? 'جارٍ إنشاء الحساب…' : 'أنشئ الحساب وتابع التسجيل'}
        </button>
      </form>

      {/* مسارات تانية · شكلها جوست عشان ما تنافسش الزرار الأساسي */}
      <div className="lalt">
        <button
          className="btn btn-2 btn-full"
          type="button"
          onClick={() => navigate(ROUTES.entityPortal)}
        >
          لديك حساب بالفعل؟ افتح بوابة طلبك
        </button>
        <p className="lnote sub">
          تتابع الجهة التي قدّمت طلبًا حالته من بوابتها بالحساب نفسه.
        </p>
      </div>
    </AuthShell>
  )
}
