/**
 * حالة الجلسة · في البروتوتايب علامة واحدة، وفي النظام هتبقى التوكن.
 *
 * موجودة عشان الموقع يفتح على الدخول فعلًا لا على شاشة داخلية:
 * من غيرها أي حد يفتح الرابط بيلاقي نفسه جوّه النظام على طول،
 * وده بيدّي انطباع غلط عن حاجة اسمها «نظام منح» فيه صلاحيات.
 *
 * المخزن `sessionStorage` مش `localStorage` بقصد: التبويب الجديد
 * يبدأ من الدخول، والتحديث وسط الشغل ما يطردش المستخدم.
 *
 * لما الباك اند يجهز: `signIn` تحفظ التوكن، `isSignedIn` تتحقق من
 * صلاحيته، و`signOut` تبطّله على السيرفر كمان.
 */
const KEY = 'ab-session'
const ROLE = 'ab-role'

/**
 * دور الجلسة · **اتنين بس في البروتوتايب**.
 *
 * ⚠️ ده مش نظام صلاحيات · هو مفتاح عرض عشان العميل يقدر يفتح
 * الرحلتين من نفس الرابط من غير ما يدوّر على مسار محفوظ. الأدوار
 * الحقيقية (مشرف · مدير منح · مدير تنفيذي · مالية) بتتحدّد من
 * التوكن لما الباك اند يجهز، وهي أكتر من اتنين بكتير.
 */
export type Role = 'staff' | 'entity'

export const signIn = (username: string, role: Role = 'staff'): void => {
  try {
    sessionStorage.setItem(KEY, username || '1')
    sessionStorage.setItem(ROLE, role)
  } catch {
    /* وضع خاص أو تخزين مقفول · الجلسة تفضل في الذاكرة لحد التحديث */
  }
}

export const signOut = (): void => {
  try {
    sessionStorage.removeItem(KEY)
    sessionStorage.removeItem(ROLE)
  } catch {
    /* لا شيء نعمله */
  }
}

export const isSignedIn = (): boolean => {
  try {
    return sessionStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

/** دور الجلسة الحالية · الافتراضي موظّف المؤسسة */
export const sessionRole = (): Role => {
  try {
    return sessionStorage.getItem(ROLE) === 'entity' ? 'entity' : 'staff'
  } catch {
    return 'staff'
  }
}
