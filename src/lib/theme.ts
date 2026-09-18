/**
 * المظهر · مظهران مسمّيان، مفيش «تبع النظام».
 *
 * ⚠️ **كان فيه تالت (الأخضر · هوية المؤسسة) واتشال بقرار العميل.**
 * لمّا كان موجودًا، «تبع النظام» ما كانش له معنى: الجهاز بيقول
 * فاتح ولا غامق، ومش بيعرف يقول «أخضر». دلوقتي المظهران عكس بعض
 * فعلًا، فـ«تبع النظام» بقى ممكن · لكنه **مش مطلوبًا** لحد ما حد
 * يطلبه، والاختيار يفضل صريحًا زي ما هو.
 *
 * المنطق هنا لا في قائمة الحساب، لأن الاختيار لازم يتطبّق قبل ما
 * ريآكت يشتغل أصلًا: سكربت صغير في `index.html` بيقرا نفس المفتاح
 * وبيكتب `data-theme` قبل أول رسمة، فمفيش ومضة فاتحة. ولأن شاشة
 * الدخول مالهاش قائمة حساب، ومن غير ده كانت هتفضل فاتحة دايمًا.
 */
export type ThemeChoice = 'light' | 'dark'

export const THEMES: readonly ThemeChoice[] = ['light', 'dark']

export const THEME_KEY = 'ab-theme'

const isTheme = (v: unknown): v is ThemeChoice =>
  v === 'light' || v === 'dark'

export const readTheme = (): ThemeChoice => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return isTheme(saved) ? saved : 'light'
  } catch {
    return 'light'
  }
}

export const applyTheme = (theme: ThemeChoice): void => {
  document.documentElement.setAttribute('data-theme', theme)
}

export const writeTheme = (theme: ThemeChoice): void => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* التخزين ممكن يكون مقفول · الاختيار يفضل شغال للجلسة دي */
  }
}
