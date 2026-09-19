import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { AuthShell, AuthField } from './AuthShell'
import { AFTER_LOGIN, ROUTES } from '@/app/routes'
import { signIn } from '@/data/session'

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

   ⚠️ **وحسابا العرض اتشالوا · ١٩ سبتمبر.** كان تحت النموذج صفّ
   «الدخول السريع للعرض» بزرارين (موظّف المؤسسة · الجهة
   المستفيدة)، اتعملوا عشان العميل يفتح الرحلتين في الاجتماع من
   غير ما يدوّر على رابط.

   واتشالوا لأن **باب النظام مش مكان أدوات العرض.** أول شاشة في
   المنتج هي اللي بتقول إيه ده، وصفّ مكتوب عليه «للعرض» بيقول إن
   اللي فوقه نموذج · فالشاشة بتاخد نبرة ديمو بدل نبرة منتج.

   والرحلتان لسه مفتوحتين، بمداخلهم الحقيقية لا باختصار:
     · موظّف المؤسسة · النموذج نفسه فوق
     · الجهة · «تسجيل جهة جديدة» تحت، ومنها «عندك حساب بالفعل؟
       افتح بوّابة طلبك» · وهو الطريق اللي الجهة بتمشيه فعلًا. */

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
