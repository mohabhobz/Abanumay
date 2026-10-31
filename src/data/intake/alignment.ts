import type { ProjectRow } from '@/types/domain'
import { WAQF_ITEMS } from './waqfDeed'

/* Client 30 Oct (Mozaffar · voice note and two sheets) · two of the study's six sections measure the
   project against the foundation's references:

   · «الارتباط بمقاصد الشريعة» · the sheet «مصفوفة ارتباط المنح بمقاصد الشريعة»
   · «الارتباط بصك الوقفية» · the sheet «مصفوفة ارتباط المنح · صك الوقفية»

   Each has the same four parts as its sheet: the project (evaluator and date), the classification of
   the link, five weighted criteria scored 0–5, and the result (raw score, raw ratio, final ratio,
   class, review status, initial recommendation). The formulas are the sheets' own, read from their
   cells. The assistant drafts both from the request (`suggestMaqasid` · `suggestWaqf`) · the
   supervisor reviews and saves them with the study. */

/* ── The 0–5 scale both sheets share ── */
export const SCALE_0_5: { value: number; label: string }[] = [
  { value: 5, label: '5 · تحقق عالٍ جدًا' },
  { value: 4, label: '4 · تحقق عالٍ' },
  { value: 3, label: '3 · تحقق متوسط' },
  { value: 2, label: '2 · تحقق ضعيف' },
  { value: 1, label: '1 · تحقق ضعيف جدًا' },
  { value: 0, label: '0 · غير منطبق' },
]

export interface Crit { key: string; label: string; weight: number; how: string }
export interface CritScore { v: number | null; note?: string }

export type AlignClass = 'عالٍ' | 'متوسط' | 'ضعيف' | 'منخفض جدًا'
export const CLASS_TONE: Record<AlignClass, 'ok' | 'teal' | 'warn' | 'no'> = { 'عالٍ': 'ok', 'متوسط': 'teal', 'ضعيف': 'warn', 'منخفض جدًا': 'no' }
const classOf = (r: number): AlignClass => (r >= 0.8 ? 'عالٍ' : r >= 0.6 ? 'متوسط' : r >= 0.4 ? 'ضعيف' : 'منخفض جدًا')

export interface AlignResult {
  /** Weighted average on 5 */
  raw: number
  /** raw / 5 */
  rawRatio: number
  /** The final ratio, 0–1, with the sheet's adjustments */
  final: number
  cls: AlignClass
  review: string
  advice: string
  /** Each criterion's share, 0–1, for the reading */
  parts: { label: string; share: number }[]
}

const weighted = (crit: Crit[], vals: (number | null)[]) => {
  const w = crit.reduce((a, c) => a + c.weight, 0) || 1
  const raw = crit.reduce((a, c, i) => a + (vals[i] ?? 0) * c.weight, 0) / w
  return { raw, rawRatio: raw / 5 }
}

/* ═══ Maqasid · مقاصد الشريعة ═══ */

export const MAQASID_CRIT: Crit[] = [
  { key: 'rank', label: 'مرتبة المقصد في المشروع', weight: 25, how: 'تُحسب من مرتبة المقصد المختارة أعلاه' },
  { key: 'serve', label: 'قوة خدمة المشروع للمقصد', weight: 25, how: 'مقدار خدمة المشروع للمقصد في تصميمه ومخرجاته' },
  { key: 'clear', label: 'وضوح وجه الارتباط والترجيح', weight: 20, how: 'وضوح المزية الشرعية أو المقاصدية ودليلها' },
  { key: 'measure', label: 'قابلية القياس والتحقق', weight: 15, how: 'قدرة المشروع على تقديم شواهد ومؤشرات تحقق الأثر' },
  { key: 'reality', label: 'اعتبارات الواقع والتزاحم', weight: 15, how: 'ملاءمة المشروع للأشخاص والوقت والمكان والحاجة والعدد' },
]
export const MAQSAD_MAJOR = ['حفظ الدين', 'حفظ النفس', 'حفظ العرض والنسل', 'حفظ العقل', 'حفظ المال', 'حفظ الحقوق والأخلاق'] as const
export const MAQSAD_RANK: { value: string; score: number; say: string }[] = [
  { value: 'ضروري', score: 5, say: 'ما لا بد منه لقيام مصالح الدين والدنيا' },
  { value: 'حاجي', score: 3, say: 'ما يرفع الضيق والحرج والمشقة' },
  { value: 'تحسيني', score: 1, say: 'ما يكمل وجوه الحسن والفضيلة' },
]
export const MAQSAD_METHOD: { value: string; add: number }[] = [
  { value: 'جلب مصلحة', add: 0 }, { value: 'دفع مفسدة', add: 0 }, { value: 'جلب ودفع', add: 0.02 },
]
export const MAQSAD_NATURE: { value: string; add: number }[] = [
  { value: 'مقصد أصلي في المشروع', add: 0.02 }, { value: 'مقصد تابع في المشروع', add: 0.01 },
  { value: 'وسيلة ظاهرة لخدمة المقصد', add: 0 }, { value: 'ارتباط بعيد أو غير ظاهر', add: 0 },
]

export interface MaqasidEval {
  major: string
  general: string
  rank: string
  method: string
  nature: string
  how: string
  evidence: string
  /** The four scored criteria · the first (rank) is read from `rank` */
  scores: CritScore[]
  notes: string
  /** Drafted by the assistant and not yet saved by the supervisor */
  drafted?: boolean
  by?: string
  at?: string
}

export function maqasidResult(m: MaqasidEval): AlignResult {
  const rank = MAQSAD_RANK.find((x) => x.value === m.rank)?.score ?? 0
  const vals = [rank, ...MAQASID_CRIT.slice(1).map((_, i) => m.scores[i + 1]?.v ?? null)]
  const { raw, rawRatio } = weighted(MAQASID_CRIT, vals)
  const add = (MAQSAD_METHOD.find((x) => x.value === m.method)?.add ?? 0) + (MAQSAD_NATURE.find((x) => x.value === m.nature)?.add ?? 0)
  const final = Math.min(1, rawRatio + add)
  const cls = classOf(final)
  /* the sheet · review when the link's clarity or its measurability scores under 3 */
  const review = (vals[2] ?? 0) < 3 || (vals[3] ?? 0) < 3 ? 'تحتاج مراجعة شرعية/منهجية' : 'لا تظهر حاجة إلزامية للمراجعة'
  const advice = cls === 'عالٍ' ? 'يعزز الترشيح مقاصديًا' : cls === 'متوسط' ? 'صالح للمفاضلة مع التحقق' : cls === 'ضعيف' ? 'يحتاج تحسين التعليل أو النطاق' : 'يعرض على مختص قبل القرار'
  return { raw, rawRatio, final, cls, review, advice, parts: MAQASID_CRIT.map((c, i) => ({ label: c.label, share: (vals[i] ?? 0) / 5 })) }
}

/* ═══ The deed · صك الوقفية ═══ */

export const WAQF_CRIT: Crit[] = [
  { key: 'people', label: 'الأشخاص / الفئة المستفيدة', weight: 20, how: 'قرب الفئة المستفيدة من الفئات التي نص عليها الواقف أو قدّمها' },
  { key: 'times', label: 'الأزمنة', weight: 15, how: 'مناسبة زمن المشروع للتعظيم الشرعي أو للحاجة الموسمية' },
  { key: 'places', label: 'الأمكنة', weight: 15, how: 'قرب مكان المشروع من الأماكن المنصوصة أو المفضلة أو داخل البلاد' },
  { key: 'breadth', label: 'شمولية المصارف', weight: 20, how: 'قدرة المشروع على خدمة مصرف أو أكثر' },
  { key: 'benefit', label: 'أعظمية النفع', weight: 30, how: 'أثر المشروع واستدامة نفعه وأنه أنفع للميت وأعظم لمصلحة المسلمين' },
]
export const WAQF_FIT: { value: string; v: number }[] = [
  { value: 'ينطبق', v: 1 }, { value: 'ينطبق جزئياً', v: 0.3 }, { value: 'لا ينطبق', v: 0 },
]
/** The sheet's weights for the final ratio · the criteria's result and the head's fit */
const WAQF_MIX = { crit: 0.9, fit: 0.1 }

export interface WaqfEval {
  cat: string
  item: string
  fit: string
  conflict: 'نعم' | 'لا'
  how: string
  evidence: string
  scores: CritScore[]
  notes: string
  drafted?: boolean
  by?: string
  at?: string
}

export function waqfResult(w: WaqfEval): AlignResult {
  const vals = WAQF_CRIT.map((_, i) => w.scores[i]?.v ?? null)
  const { raw, rawRatio } = weighted(WAQF_CRIT, vals)
  const blocked = w.conflict === 'نعم' || w.fit === 'لا ينطبق'
  const fit = WAQF_FIT.find((x) => x.value === w.fit)?.v ?? 0
  const final = blocked ? 0 : Math.min(1, (rawRatio * WAQF_MIX.crit + fit * WAQF_MIX.fit) / (WAQF_MIX.crit + WAQF_MIX.fit))
  const cls = classOf(final)
  const review = blocked ? 'تحتاج مراجعة صك/حوكمة قبل المفاضلة' : w.fit === 'ينطبق جزئياً' ? 'تحتاج استكمال الشواهد أو تحسين النطاق' : 'لا تظهر حاجة إلزامية للمراجعة'
  const advice = blocked ? 'استبعاد أولي أو إحالة للمراجعة' : cls === 'عالٍ' ? 'يعزز الترشيح وفق الصك' : cls === 'متوسط' ? 'صالح للمفاضلة مع التحقق' : cls === 'ضعيف' ? 'يحتاج تحسين التعليل أو النطاق' : 'لا يوصى به أوليًا'
  return { raw, rawRatio, final, cls, review, advice, parts: WAQF_CRIT.map((c, i) => ({ label: c.label, share: (vals[i] ?? 0) / 5 })) }
}

/* ═══ The assistant's drafts · read from the request's field, goal, name and place ═══ */

const text = (p: ProjectRow) => `${p.name} ${p.field} ${p.goal} ${p.track}`
const has = (p: ProjectRow, re: RegExp) => re.test(text(p))
const HOLY = /مكة|المدينة/

export function suggestMaqasid(p: ProjectRow): MaqasidEval {
  const major =
    has(p, /قرآن|شرعي|دعوة|مسجد|مساجد|حج|عمرة|أضاح/) ? 'حفظ الدين'
      : has(p, /صحة|صحي|علاج|إغاثة|غذاء|إطعام|سقيا|مياه/) ? 'حفظ النفس'
        : has(p, /أسرة|زواج|أيتام|أرامل/) ? 'حفظ العرض والنسل'
          : has(p, /تعليم|تعليمي|مدرسة|تدريب|موهوب|طلاب|معلم|علم/) ? 'حفظ العقل'
            : has(p, /تمكين|اقتصادي|وقف|مال|تطوير القطاع/) ? 'حفظ المال'
              : 'حفظ الحقوق والأخلاق'
  const rank = major === 'حفظ الدين' || major === 'حفظ النفس' ? 'ضروري' : major === 'حفظ الحقوق والأخلاق' ? 'تحسيني' : 'حاجي'
  const direct = has(p, /قرآن|شرعي|مسجد|مساجد|علاج|سقيا|إطعام|أيتام/)
  const reach = p.beneficiaries ?? 0
  return {
    major,
    general: `${major} · ${p.goal || p.field}`,
    rank,
    method: has(p, /وقاية|حماية|علاج|مكافحة/) ? 'جلب ودفع' : 'جلب مصلحة',
    nature: direct ? 'مقصد أصلي في المشروع' : 'مقصد تابع في المشروع',
    how: `يخدم المشروع ${major} من خلال ${p.goal || p.field} في ${p.city || p.region}.`,
    evidence: `مجال «${p.field}» · ${reach ? `${reach.toLocaleString('en-US')} مستفيد · ` : ''}مخرجات الطلب`,
    scores: [
      { v: null },
      { v: direct ? 5 : 4 },
      { v: direct ? 4 : 3 },
      { v: reach > 0 ? 4 : 2 },
      { v: 4 },
    ],
    notes: '',
    drafted: true,
  }
}

export function suggestWaqf(p: ProjectRow): WaqfEval {
  const pick = (re: RegExp) => WAQF_ITEMS.find((x) => re.test(x.item) && !x.bound)
  const item =
    (has(p, /قرآن|تحفيظ|حلقات/) && pick(/حلقات تحفيظ/))
    || (has(p, /مسجد|مساجد/) && pick(has(p, /صيانة|ترميم/) ? /صيانة المساجد/ : /بناء المساجد/))
    || (has(p, /دعوة|دعوي|الجاليات/) && pick(/^الدعوة إلى الله/))
    || (has(p, /شرعي|طلاب العلم|طالب علم/) && pick(/طلاب العلوم الشرعية/))
    || (has(p, /أيتام|يتيم/) && pick(/^الأيتام/))
    || (has(p, /أرامل/) && pick(/^الأرامل/))
    || (has(p, /إغاثة|منكوب|كوارث/) && pick(/المنكوبين/))
    || (has(p, /إطعام|سقيا|مياه|تفطير|غذاء/) && pick(has(p, /تفطير/) ? /تفطير الصوام/ : /تأمين المياه/))
    || (has(p, /بحث|دراسات|دراسة/) && pick(/^البحوث والدراسات/))
    || (has(p, /منح دراسية|ابتعاث/) && pick(/المنح الدراسية/))
    || (has(p, /تعليم|مدرسة|تدريب|مناهج|موهوب|معلم/) && pick(/تعليم النشء/))
    || (has(p, /فقر|محتاج|صحة|علاج/) && pick(/^الفقراء/))
    || WAQF_ITEMS.find((x) => x.added)!
  const general = !item.added
  return {
    cat: item.cat,
    item: item.item,
    fit: general ? 'ينطبق' : 'ينطبق جزئياً',
    conflict: 'لا',
    how: `يندرج المشروع تحت «${item.item}» من مصارف «${item.cat}».`,
    evidence: `مجال «${p.field}» وهدف «${p.goal || '—'}» في طلب المشروع`,
    scores: [
      { v: general ? 4 : 2 },
      { v: has(p, /رمضان|الحج|موسم/) ? 5 : 3 },
      { v: HOLY.test(`${p.city} ${p.region}`) ? 5 : 4 },
      { v: 3 },
      { v: (p.beneficiaries ?? 0) >= 1000 ? 5 : 4 },
    ],
    notes: '',
    drafted: true,
  }
}

/** The ratio as a percent, rounded */
export const pctOf = (r: number): number => Math.round(r * 100)
