/**
 * المظهر — فاتح أو داكن أو تبع النظام.
 *
 * المنطق هنا لا في قائمة الحساب، لأن الاختيار لازم يتطبّق قبل ما
 * ريآكت يشتغل أصلًا: سكربت صغير في `index.html` بينده `bootTheme`
 * وهو نفس المصدر، فمفيش ومضة بيضا قبل ما الداكن ينزل. ولأن شاشة
 * الدخول مالهاش قائمة حساب، ومن غير ده كانت هتفضل فاتحة دايمًا.
 *
 * `system` ما بتكتبش `data-theme` خالص — بتسيب `prefers-color-scheme`
 * في الـCSS يقرر، فالتغيير في إعدادات الجهاز بينعكس فورًا بلا كود.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_KEY = 'ab-theme'

export const readTheme = (): ThemeChoice => {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export const applyTheme = (theme: ThemeChoice): void => {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export const writeTheme = (theme: ThemeChoice): void => {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* التخزين ممكن يكون مقفول — الاختيار يفضل شغال للجلسة دي */
  }
}
