/* Spelling and formatting of Arabic text the user types · batch 8 (cross · كشف الأخطاء الإملائية).

   Rules, not a model: the mistakes a reviewer fixes by hand in entity names, addresses and job
   titles. Each finding says what is wrong and, when the fix is certain, carries the corrected text,
   so the form can offer «صحّح» in one click. Nothing is changed without the user. A real spell
   checker (a model or a dictionary on the server) plugs in behind the same shape later. */

import { spellPairs } from '@/lib/textRules'

export interface TextIssue { say: string; fixed?: string }

/* 18 Oct · 2.6.3 · a dictionary of common slips, each with its one right spelling · whole words,
   with an optional «و» before them · the settings add more (lib/textRules) */
const DICT: [string, string][] = [
  /* hamza · قطع spelled bare */
  ['انشاء', 'إنشاء'], ['اساس', 'أساس'], ['اكثر', 'أكثر'], ['اقل', 'أقل'], ['اول', 'أول'], ['ايضا', 'أيضًا'], ['امام', 'أمام'],
  ['اسرة', 'أسرة'], ['الاسرة', 'الأسرة'], ['اسر', 'أسر'], ['الاسر', 'الأسر'], ['اعمال', 'أعمال'], ['الاعمال', 'الأعمال'],
  ['اهداف', 'أهداف'], ['الاهداف', 'الأهداف'], ['انشطة', 'أنشطة'], ['الانشطة', 'الأنشطة'], ['الاول', 'الأول'], ['الاولى', 'الأولى'],
  ['اطفال', 'أطفال'], ['الاطفال', 'الأطفال'], ['ارامل', 'أرامل'], ['الارامل', 'الأرامل'], ['اسكان', 'إسكان'], ['الاسكان', 'الإسكان'],
  ['اغاثة', 'إغاثة'], ['الاغاثة', 'الإغاثة'], ['ادارة', 'إدارة'], ['الادارة', 'الإدارة'], ['اجمالي', 'إجمالي'], ['الاجمالي', 'الإجمالي'],
  ['انجاز', 'إنجاز'], ['الانجاز', 'الإنجاز'], ['امكانية', 'إمكانية'], ['اضافة', 'إضافة'], ['الاضافة', 'الإضافة'], ['اجراء', 'إجراء'], ['الاجراء', 'الإجراء'],
  ['اجراءات', 'إجراءات'], ['الاجراءات', 'الإجراءات'],
  /* ى / ي at the end */
  ['حتي', 'حتى'], ['مستوي', 'مستوى'], ['المستوي', 'المستوى'], ['مدي', 'مدى'], ['اخري', 'أخرى'], ['الاخري', 'الأخرى'], ['كبري', 'كبرى'],
  ['الكبري', 'الكبرى'], ['اولي', 'أولى'], ['ادني', 'أدنى'], ['الادني', 'الأدنى'], ['اقصي', 'أقصى'], ['الاقصي', 'الأقصى'],
  /* ة / ه at the end */
  ['مدرسه', 'مدرسة'], ['المدرسه', 'المدرسة'], ['جامعه', 'جامعة'], ['الجامعه', 'الجامعة'], ['خدمه', 'خدمة'], ['الخدمه', 'الخدمة'],
  ['رعايه', 'رعاية'], ['الرعايه', 'الرعاية'], ['صحه', 'صحة'], ['الصحه', 'الصحة'], ['تنميه', 'تنمية'], ['التنميه', 'التنمية'],
  ['منطقه', 'منطقة'], ['المنطقه', 'المنطقة'], ['مدينه', 'مدينة'], ['المدينه', 'المدينة'], ['سنه', 'سنة'], ['السنه', 'السنة'],
  ['دراسه', 'دراسة'], ['الدراسه', 'الدراسة'], ['خطه', 'خطة'], ['الخطه', 'الخطة'], ['شراكه', 'شراكة'], ['الشراكه', 'الشراكة'],
  ['مبادره', 'مبادرة'], ['المبادره', 'المبادرة'], ['اسره', 'أسرة'], ['الاسره', 'الأسرة'], ['اغاثه', 'إغاثة'], ['الاغاثه', 'الإغاثة'],
  ['جديده', 'جديدة'], ['الجديده', 'الجديدة'], ['عامه', 'عامة'], ['العامه', 'العامة'], ['خاصه', 'خاصة'], ['الخاصه', 'الخاصة'],
].filter(([a, b]) => a !== b) as [string, string][]

const AR = '\\u0600-\\u06FF'
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function dictIssues(text: string): TextIssue[] {
  const out: TextIssue[] = []
  for (const [wrong, right] of [...DICT, ...spellPairs()]) {
    const re = new RegExp(`(^|[^${AR}])(و?)${esc(wrong)}(?![${AR}])`, 'g')
    if (re.test(text)) out.push({ say: `«${wrong}» تُكتب «${right}»`, fixed: text.replace(new RegExp(re.source, 'g'), `$1$2${right}`) })
  }
  return out
}

/** Common slips with one right spelling · whole words only */
const WORDS: [RegExp, string, string][] = [
  [/(^|\s)الى(?=\s|$)/g, '$1إلى', '«الى» تُكتب «إلى»'],
  [/(^|\s)هذة(?=\s|$)/g, '$1هذه', '«هذة» تُكتب «هذه»'],
  [/(^|\s)هاذا(?=\s|$)/g, '$1هذا', '«هاذا» تُكتب «هذا»'],
  [/(^|\s)هاذه(?=\s|$)/g, '$1هذه', '«هاذه» تُكتب «هذه»'],
  [/(^|\s)لاكن(?=\s|$)/g, '$1لكن', '«لاكن» تُكتب «لكن»'],
  [/(^|\s)إ(ستـ?|جت|بتد|نتخ|ستث|ستش|نطل|نتق)/g, '$1ا$2', 'همزة وصل كُتبت قطعًا (مثل «إستثمار» ← «استثمار»)'],
  [/(^|\s)(مؤسس|جمعي|خيري|أهلي|اهلي|تنموي|تعاوني|وقفي|الخيري|الأهلي|الاهلي|التنموي|التعاوني)ه(?=\s|$)/g, '$1$2ة', 'تاء مربوطة كُتبت هاءً (مثل «جمعيه» ← «جمعية»)'],
]

export function textIssues(text: string): TextIssue[] {
  if (!text?.trim()) return []
  const out: TextIssue[] = []
  if (/ {2,}/.test(text) || text !== text.trim()) out.push({ say: 'مسافات زائدة', fixed: text.replace(/ {2,}/g, ' ').trim() })
  const rep = text.match(/(^|\s)([؀-ۿ]{2,})\s+\2(?=\s|$)/)
  if (rep) out.push({ say: `كلمة مكررة: «${rep[2]}»`, fixed: text.replace(/(^|\s)([؀-ۿ]{2,})\s+\2(?=\s|$)/g, '$1$2') })
  out.push(...dictIssues(text))
  for (const [re, to, say] of WORDS) {
    re.lastIndex = 0
    if (re.test(text)) { re.lastIndex = 0; out.push({ say, fixed: text.replace(re, to) }) }
  }
  if (/[؀-ۿ][a-zA-Z]|[a-zA-Z][؀-ۿ]/.test(text)) out.push({ say: 'حروف عربية ولاتينية ملتصقة في كلمة واحدة' })
  /* 18 Oct · 2.6.3 · a digit stuck to an Arabic word · «المرحلة2» ← «المرحلة 2» */
  if (/[ء-ي][0-9]|[0-9][ء-ي]/.test(text)) out.push({ say: 'رقم ملتصق بكلمة عربية', fixed: text.replace(/([ء-ي])([0-9])/g, '$1 $2').replace(/([0-9])([ء-ي])/g, '$1 $2') })
  if (/[0-9]/.test(text) && /[٠-٩]/.test(text)) out.push({ say: 'أرقام عربية ولاتينية معًا · يُستخدم نوع واحد', fixed: text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) })
  if (/[؀-ۿ]\s*,/.test(text)) out.push({ say: 'فاصلة لاتينية في نص عربي', fixed: text.replace(/\s*,\s*/g, '، ') })
  if (/\s[،.؛:؟!]/.test(text)) out.push({ say: 'مسافة قبل علامة الترقيم', fixed: text.replace(/\s+([،.؛:؟!])/g, '$1') })
  if (/(.)\1{3,}/.test(text)) out.push({ say: 'حرف مكرر أكثر من ثلاث مرات' })
  return out
}

/** All the fixes applied in turn · what «صحّح الكل» writes */
export function fixAll(text: string): string {
  let t = text
  for (let i = 0; i < 12; i++) {
    const next = textIssues(t).find((x) => x.fixed !== undefined)
    if (!next) break
    t = next.fixed!
  }
  return t
}
