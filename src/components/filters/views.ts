/* ═══════════════════════════════════════════════════════════
   الفيوهات المحفوظة.

   طلب الكلاينت حرفيًا: «راح حافظ لك الفلاتر دي على إنها جروب موجود
   معاك باسم إنت تختاره… جيت بكرة دُست على الزرار ده، على طول راحلك
   الفلاتر دي طبّقها لك كلها مرة واحدة».

   الفيو بيحفظ الشاشة كلها بلا رقم الصفحة: الفلاتر والترتيب والتجميع
   وعدد الصفوف ونوع العرض. لأن «مشاريع مدينة الرياض» لو اتحفظت وهي
   مجمّعة بالمنطقة، تستاهل ترجع مجمّعة · الفيو هو السؤال وشكل إجابته
   مش الفلاتر لوحدها.

   ⚠️ التخزين محلي في النموذج ده. المكان الصحيح للفيوهات هو السيرفر
   لكل مستخدم، عشان تنتقل معاه بين الأجهزة وتتشارك مع الفريق ·
   بند مسجَّل على الباك اند.
   ═══════════════════════════════════════════════════════════ */

export interface SavedView {
  id: string
  name: string
  /** نص الاستعلام بلا `?` وبلا رقم الصفحة */
  query: string
}

const KEY = (table: string) => `ab-views-${table}`
/** حدّ يمنع القائمة من إنها تبقى قائمة تانية محتاجة بحث */
const MAX = 20

export const readViews = (table: string): SavedView[] => {
  try {
    const raw = localStorage.getItem(KEY(table))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(list)) return []
    return list.filter(
      (v): v is SavedView =>
        typeof v === 'object' && v !== null &&
        typeof (v as SavedView).id === 'string' &&
        typeof (v as SavedView).name === 'string' &&
        typeof (v as SavedView).query === 'string',
    )
  } catch {
    return []
  }
}

const write = (table: string, list: SavedView[]): SavedView[] => {
  try {
    localStorage.setItem(KEY(table), JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* التخزين ممكن يكون مقفول · الفيوهات تفضل للجلسة دي */
  }
  return list
}

/** بيكتب القائمة ويرجّعها · الاستدعاء بيستعملها مباشرة كحالة */
export const writeViews = (table: string, list: SavedView[]): SavedView[] => write(table, list)
