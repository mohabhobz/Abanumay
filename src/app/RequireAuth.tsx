import { Navigate, useLocation } from 'react-router-dom'
import { isSignedIn } from '@/data/session'
import { ROUTES } from './routes'

/**
 * بوّابة كل الشاشات الداخلية.
 *
 * بتحتفظ بالمسار اللي المستخدم كان رايحه في `state.from`، فلو حد
 * فتح رابط مشروع وهو مش داخل، بعد الدخول يروح للمشروع لا للصفحة
 * الافتراضية · الرابط اللي اتبعتله هو سبب دخوله أصلًا.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  if (isSignedIn()) return <>{children}</>
  /* الجذر مش وجهة مقصودة · هو «فتحت الموقع». لو بعتناه كـ`from`
     المستخدم يقع على «اليوم» بدل الشاشة الافتراضية. */
  const target = loc.pathname + loc.search
  const from = loc.pathname === ROUTES.home ? undefined : target
  return <Navigate to={ROUTES.login} replace state={from ? { from } : null} />
}
