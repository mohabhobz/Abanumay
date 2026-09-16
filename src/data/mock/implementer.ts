import { entityRows } from './entities'
import type { PartnerKind } from './registration'

/* ═══════════════════════════════════════════════════════════
   الشريك المنفّذ والمحفظة · ب-8 · سيناريو منصة إحسان

   مظفر: «إحسان منصة حكومية بتدعم جهات خيرية · **ما بتدخلش منصتنا
   خالص**. مشرف المنح بيضيف إحسان كجهة، وبينشئ المشروع، وبيديره
   **داخليًا كاملًا**، وبيحدد مشروع واحد ولا **محفظة**، وبيعمل
   الدفعات · **ومفيش اتفاقية**».

   ⚠️ **ودي مش حالة استثناء، دي طرف تاني.** الفرق مش إن الشاشة
   مختصرة، الفرق إن الطرف اللي في الناحية التانية مش موجود في
   المنصة أصلًا · فكل حاجة بتفترض وجوده بتسقط: البوّابة والتوقيع
   والاتفاقية ومسوغات الجهة.

   ⚠️ **والمحفظة مش مشروع كبير.** هي **كيان أب** تحته مشاريع، وكل
   مشروع له مبلغه وحالته · والمحفظة ما بتدخلش قايمة المشاريع
   كصفّ لأنها مش مشروع. اللي بيدخل القايمة أبناؤها.

   ⚠️ **سؤال مفتوح لمظفر (س-2 في بريف بنية الموديول):** «المحفظة
   يعني إيه بالظبط في الشاشة؟ مشروع أب وتحته مشاريع؟» · اللي
   مبني هنا هو **الافتراض ده**، وموسوم في الشاشة على إنه افتراض.
   ═══════════════════════════════════════════════════════════ */

/** الشركاء المنفّذون · بيتحطّوا من جوّه النظام (قاعدة 32) */
export const IMPLEMENTERS: { id: string; name: string; note: string }[] = [
  { id: '860', name: 'منصة إحسان', note: 'منصة حكومية بتدعم جهات خيرية · ما بتدخلش المنصة' },
  { id: '861', name: 'المحافظ الخيرية', note: 'نفس الترتيب · إدارة داخلية كاملة' },
]

export const isImplementer = (entityId: string): boolean =>
  IMPLEMENTERS.some((x) => x.id === entityId)

/** نوع شراكة الجهة · الجاي من البوّابة مستفيد، ودول منفّذون */
export const partnerOf = (entityId: string): PartnerKind =>
  isImplementer(entityId) ? 'implementer' : 'beneficiary'

export const implementerName = (entityId: string): string =>
  IMPLEMENTERS.find((x) => x.id === entityId)?.name ??
  entityRows.find((e) => e.id === entityId)?.name ??
  ''

/* ═══════════════════════════════════════════════════════════
   اللي بيتغيّر لمّا الشريك يبقى منفّذًا

   ⚠️ مكتوبة هنا **مرة واحدة** وبتتقري في كل شاشة بتلمس الحالة دي ·
   وإلا كل شاشة بتفتكر نُصّها وبتنسى نُصّها.
   ═══════════════════════════════════════════════════════════ */
export interface KindDiff { on: string; off: string }

export const IMPLEMENTER_DIFF: KindDiff[] = [
  { on: 'المشروع بيتنشئ من جوّه', off: 'الجهة بتتقدّم من بوّابتها' },
  { on: 'مفيش اتفاقية · الدفعات بتتعمل مباشرةً', off: 'الاتفاقية إلزامية قبل أي صرف' },
  { on: 'مفيش مسوغات من الجهة · المشرف بيرفعها', off: 'الجهة بترفع مسوغات كل دفعة' },
  { on: 'ممكن يبقى مشروعًا واحدًا أو محفظة', off: 'مشروع واحد في كل مرة' },
]

/* ═══ المحفظة ═══ */
export interface PortfolioItem {
  id: string
  name: string
  region: string
  amount: number
  spent: number
  status: 'مكتمل' | 'تحت التنفيذ' | 'لم يبدأ'
}

export interface Portfolio {
  id: string
  name: string
  entityId: string
  /** المبلغ المتفق عليه للمحفظة كلها */
  total: number
  year: string
  openedAt: string
  items: PortfolioItem[]
}

export const portfolios: Portfolio[] = [
  {
    id: 'PF-2026-001',
    name: 'محفظة إحسان · الإغاثة والكفالات',
    entityId: '860',
    total: 6_000_000,
    year: '2026',
    openedAt: '2026-02-10',
    items: [
      { id: 'PF-1', name: 'كفالة الأيتام · الربع الأول', region: 'عموم المملكة', amount: 2_000_000, spent: 2_000_000, status: 'مكتمل' },
      { id: 'PF-2', name: 'السلال الغذائية في رمضان', region: 'عموم المملكة', amount: 1_800_000, spent: 1_240_000, status: 'تحت التنفيذ' },
      { id: 'PF-3', name: 'تهيئة السكن للأسر المحتاجة', region: 'مكة المكرمة', amount: 1_400_000, spent: 300_000, status: 'تحت التنفيذ' },
      { id: 'PF-4', name: 'كسوة الشتاء', region: 'تبوك', amount: 800_000, spent: 0, status: 'لم يبدأ' },
    ],
  },
]

export const portfolioById = (id: string): Portfolio | undefined =>
  portfolios.find((p) => p.id === id)

export const itemsTotal = (p: Portfolio): number =>
  p.items.reduce((a, x) => a + x.amount, 0)

export const itemsSpent = (p: Portfolio): number =>
  p.items.reduce((a, x) => a + x.spent, 0)

/* ═══════════════════════════════════════════════════════════
   تحقّق المحفظة

   ⚠️ **نفس انضباط شجرة الميزانية وجدول الدفعات:** مجموع الأبناء
   لازم يساوي مبلغ الأب · ومحفظة بتلخّص وبس بتخفي الغلط. والصرف
   ما يعدّيش المخصص، لا في المحفظة ولا في مشروع جوّاها.
   ═══════════════════════════════════════════════════════════ */
export interface PfIssue { key: string; say: string; rule: string }

export const portfolioIssues = (p: Portfolio): PfIssue[] => {
  const out: PfIssue[] = []
  const sum = itemsTotal(p)

  if (sum !== p.total) {
    const gap = p.total - sum
    out.push({
      key: 'sum',
      say: gap > 0
        ? `مجموع مشاريع المحفظة ناقص ${gap.toLocaleString('en-US')} عن مبلغها.`
        : `مجموع مشاريع المحفظة زايد ${Math.abs(gap).toLocaleString('en-US')} عن مبلغها.`,
      rule: 'مجموع الأبناء = مبلغ الأب',
    })
  }

  const over = p.items.filter((x) => x.spent > x.amount)
  if (over.length) {
    out.push({
      key: 'over',
      say: `«${over[0].name}» منصرف عليه أكتر من مخصصه.`,
      rule: 'الصرف داخل المخصص',
    })
  }

  return out
}
