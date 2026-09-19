import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { AFTER_LOGIN, ROUTES } from '@/app/routes'
import { signIn, type Role } from '@/data/session'

/* ═══════════════════════════════════════════════════════════
   شاشة الدخول

   الفيديو خلفية مش بطل: الفتحة اللي في نص الكادر هي مكان الكارت.
   الفيديو بيتعرض بلونه الطبيعي، والكارت زجاج زي كروت الداخل.

   من النظام الحقيقي: اسم مستخدم وكلمة مرور، ومسار منفصل تمامًا
   اسمه «تسجيل جهة جديدة».

   ⚠️ **والغلاف بقى `AuthShell`** · الفيديو والكارت والعلامة وسطر
   الحقوق كانوا مكتوبين هنا، ولمّا شاشة إنشاء حساب الجهة احتاجت
   نفس المنظر كان أسهل حاجة إني أنسخهم · وده اللي بيخلّي حاجتين
   بيقولوا نفس المعنى بشكلين بعد شهر.

   ⚠️ **وحسابا العرض تحت النموذج لا بدله.** العميل محتاج يفتح
   الرحلتين بنفسه في الاجتماع من غير ما يدوّر على رابط محفوظ ·
   والرحلتان مختلفتان فعلًا لا مجرد صلاحيات: موظّف المؤسسة بيدخل
   النظام كله، والجهة بتفتح **بوّابتها** اللي فيها طلبها وخططها
   وبس (شوف `PortalPage`).

   ⚠️ **وضغطة واحدة بلا كلمة مرور.** حطّ كلمة مرور جاهزة في
   الشاشة معناه كتابة بيانات دخول في الواجهة، وهي حاجة ما
   بتتعملش حتى في نموذج · والزرار بيقول إنه عرض صراحةً فمحدش
   بيفتكره دخولًا حقيقيًّا. */

export default function LoginPage() {
  const navigate = useNavigate()
  const loc = useLocation()
  /* الرابط اللي اتحوّل منه · لو فتح رابط مشروع وهو برّه، يرجعله
     بعد الدخول بدل ما يبدأ من الأول */
  const from = (loc.state as { from?: string } | null)?.from
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /** يعرض الخطأ كتوست ويخفيه لوحده · الرسالة تنبيه مش حالة دائمة */
  const fail = (message: string) => {
    setErr(message)
    setTimeout(() => setErr(''), 4000)
  }

  /* الدخول السريع · بيسجّل الدور ويودّي لبداية رحلته */
  const demo = (as: Role) => {
    signIn(as === 'entity' ? 'جمعية البر بالأحساء' : 'عمر قاسم', as)
    navigate(as === 'entity' ? ROUTES.entityPortal : AFTER_LOGIN, { replace: true })
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
    <AuthShell title="منح أبانمي" sub="مؤسسة سليمان أبانمي الأهلية" err={err}>
          {/* method/action موجودين عشان مديري كلمات السر يتعرّفوا على
              الفورم ويعرضوا الحفظ · الإرسال نفسه متوقّف بـpreventDefault */}
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
                  <Icon name={show ? icons.eyeOff : icons.eye} size={17} />
                </button>
              }
            />

            <div className="lrow">
              <label className="lcheck">
                <input type="checkbox" name="remember" />
                <span>تذكّرني</span>
              </label>
              {/* ⚠️ **كان `<a>` بلا `href` · وده رابط كذّاب.** شكله
                  رابط وسلوكه ولا حاجة: ما بيتفتحش في تاب، ولا
                  بيوصله الكيبورد، ولا بيقول إنه مش شغّال. واللي
                  بيتعمل هنا **فعل** (إرسال رابط استعادة) لا انتقال،
                  فهو زرار · والنموذج مفيهوش صفحة استعادة لسه،
                  فالزرار بيقول كده صريحًا بدل ما يسكت. */}
              <button
                type="button"
                className="llink"
                title="الاستعادة بتتعمل من إدارة النظام في النموذج ده"
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            <button className="btn btn-p btn-full" type="submit" disabled={busy}>
              {busy ? 'جارٍ التحقق…' : 'تسجيل الدخول'}
            </button>
          </form>

          {/* ⚠️ حسابا العرض · مكانهم تحت النموذج لأنهم مش الطريق
              الأساسي، وشكلهم صفّ واحد عشان يتقروا اختيارًا واحدًا
              من اتنين لا زرارين منفصلين */}
          <div className="ldemo">
            <span className="lnote sub">الدخول السريع للعرض</span>
            <div className="ldemo-r">
              <button type="button" className="ldemo-b" onClick={() => demo('staff')}>
                <Icon name={icons.user} size={16} />
                <span>
                  <b>موظّف المؤسسة</b>
                  <span className="sub">مشرف المنح</span>
                </span>
              </button>
              <button type="button" className="ldemo-b" onClick={() => demo('entity')}>
                <Icon name={icons.entity} size={16} />
                <span>
                  <b>الجهة المستفيدة</b>
                  <span className="sub">بوّابة الجهة</span>
                </span>
              </button>
            </div>
          </div>

          {/* مسار مختلف تمامًا، فشكله جوست · مش قرار تاني منافس للدخول */}
          <div className="lalt">
            {/* ⚠️ الزرار ده كان `type="button"` بلا `onClick` · شكله
                زرار وبيعمل focus وبيتضغط، وما بيحصلش حاجة. دلوقتي
                بيودّي للمسار العام `/entities/register` (BPD-002)،
                وهو برّه بوّابة الدخول لأن صاحب الطلب مالوش حساب. */}
            <button
              className="btn btn-2 btn-full"
              type="button"
              onClick={() => navigate(ROUTES.entityRegister)}
            >
              تسجيل جهة جديدة
            </button>
            <p className="lnote sub">للجمعيات والمؤسسات التي لم تسجّل في المنصة بعد</p>
          </div>
    </AuthShell>
  )
}
