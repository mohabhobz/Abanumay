/**
 * المظهر — ثلاثة مظاهر مسمّاة، مفيش «تبع النظام».
 *
 * «النظام» كان معناه إن اللي بيقرر هو إعداد الجهاز، وده منطقي
 * لما المظهرين عكس بعض. هنا التالت مظهر بذاته (الأخضر — هوية
 * المؤسسة) مش حالة من حالتين، فالاختيار لازم يكون صريح.
 *
 * المنطق هنا لا في قائمة الحساب، لأن الاختيار لازم يتطبّق قبل ما
 * ريآكت يشتغل أصلًا: سكربت صغير في `index.html` بيقرا نفس المفتاح
 * وبيكتب `data-theme` قبل أول رسمة، فمفيش ومضة فاتحة. ولأن شاشة
 * الدخول مالهاش قائمة حساب، ومن غير ده كانت هتفضل فاتحة دايمًا.
 */
export type ThemeChoice = 'light' | 'dark' | 'green'

export const THEMES: readonly ThemeChoice[] = ['light', 'dark', 'green']

export const THEME_KEY = 'ab-theme'

const isTheme = (v: unknown): v is ThemeChoice =>
  v === 'light' || v === 'dark' || v === 'green'

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
    /* التخزين ممكن يكون مقفول — الاختيار يفضل شغال للجلسة دي */
  }
}
