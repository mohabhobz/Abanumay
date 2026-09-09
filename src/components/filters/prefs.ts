/* ═══════════════════════════════════════════════════════════
   الفلاتر الظاهرة وترتيبها.

   طلب الكلاينت: «الداتا اللي بترجع خمسين نوع، فإنت عايز الخمسين
   فلتر يرجعوا، بس أنا أختار منهم خمسة وأرصّهم بالطريقة اللي تريحني».

   المخزَّن هو **قائمة الظاهر بترتيبها**، والباقي مخفي. الشكل ده
   بيحلّ الحاجتين برقم واحد: الترتيب هو ترتيب القائمة، والإخفاء هو
   الغياب منها.

   والتخزين محلي زي الأعمدة وبنفس السبب: ده شكل شاشتك إنت، والرابط
   اللي بتبعته لزميلك ينقل السؤال لا شكل شاشتك.
   ═══════════════════════════════════════════════════════════ */

const KEY = (table: string) => `ab-filters-${table}`

export const readFilterOrder = (table: string, all: string[]): string[] => {
  try {
    const raw = localStorage.getItem(KEY(table))
    if (!raw) return all
    const keys = JSON.parse(raw) as unknown
    if (!Array.isArray(keys)) return all
    /* الفلاتر اللي اتشالت من الكود بتتصفّى، والجديدة اللي اتضافت
       بعد آخر حفظ ما بتظهرش تلقائيًا — المستخدم اللي رصّ خمسة
       ما يستاهلش سادسًا يقتحم ترتيبه. بتلاقيه في لوحة التخصيص. */
    return keys.filter((k): k is string => typeof k === 'string' && all.includes(k))
  } catch {
    return all
  }
}

export const writeFilterOrder = (table: string, keys: string[]): void => {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(keys))
  } catch {
    /* التخزين ممكن يكون مقفول — الترتيب يفضل للجلسة دي */
  }
}
