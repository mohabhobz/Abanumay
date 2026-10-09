/* Spelling and formatting of Arabic text the user types · batch 8 (cross · كشف الأخطاء الإملائية).

   Rules, not a model: the mistakes a reviewer fixes by hand in entity names, addresses and job
   titles. Each finding says what is wrong and, when the fix is certain, carries the corrected text,
   so the form can offer «صحّح» in one click. Nothing is changed without the user. A real spell
   checker (a model or a dictionary on the server) plugs in behind the same shape later. */

export interface TextIssue { say: string; fixed?: string }

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
  for (const [re, to, say] of WORDS) {
    re.lastIndex = 0
    if (re.test(text)) { re.lastIndex = 0; out.push({ say, fixed: text.replace(re, to) }) }
  }
  if (/[؀-ۿ][a-zA-Z]|[a-zA-Z][؀-ۿ]/.test(text)) out.push({ say: 'حروف عربية ولاتينية ملتصقة في كلمة واحدة' })
  if (/[0-9]/.test(text) && /[٠-٩]/.test(text)) out.push({ say: 'أرقام عربية ولاتينية معًا · يُستخدم نوع واحد', fixed: text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))) })
  if (/[؀-ۿ]\s*,/.test(text)) out.push({ say: 'فاصلة لاتينية في نص عربي', fixed: text.replace(/\s*,\s*/g, '، ') })
  if (/\s[،.؛:]/.test(text)) out.push({ say: 'مسافة قبل علامة الترقيم', fixed: text.replace(/\s+([،.؛:])/g, '$1') })
  if (/(.)\1{3,}/.test(text)) out.push({ say: 'حرف مكرر أكثر من ثلاث مرات' })
  return out
}

/** All the fixes applied in turn · what «صحّح الكل» writes */
export function fixAll(text: string): string {
  let t = text
  for (let i = 0; i < 4; i++) {
    const next = textIssues(t).find((x) => x.fixed !== undefined)
    if (!next) break
    t = next.fixed!
  }
  return t
}
