/**
 * حالة الجلسة — في البروتوتايب علامة واحدة، وفي النظام هتبقى التوكن.
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

export const signIn = (username: string): void => {
  try {
    sessionStorage.setItem(KEY, username || '1')
  } catch {
    /* وضع خاص أو تخزين مقفول — الجلسة تفضل في الذاكرة لحد التحديث */
  }
}

export const signOut = (): void => {
  try {
    sessionStorage.removeItem(KEY)
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
