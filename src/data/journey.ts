/**
 * رحلة المشروع في الإجراء · المدد والإعادات والمستوى اللي بتّ.
 *
 * ⚠️ الملف ده **مشتقّ**، مش مصدر. النظام العامل بيمسك المدد دي فعلًا
 * (جدول المشاريع فيه 13 عمود مدة، والأقسام الإجرائية 50 قسمًا)، لكن
 * الأعمدة دي ما اتسحبتش للنموذج لأن الأوديت كان قراءة فقط. فبدل ما
 * نسيب نص المؤشرات فاضي، بنشتقّ الرحلة من الصف نفسه بشكل **حتمي**:
 * نفس المشروع بيدّي نفس الأرقام في كل تحميل، والتوزيع بيطلع من
 * `hoursInStage` و`submittedAt` و`decidedAt` والمبلغ · يعني الأرقام
 * متّسقة مع اللي الشاشات التانية بتعرضه، مش عشوائية جنبه.
 *
 * لما الـAPI يسلّم أعمدة المدة الحقيقية، الملف ده بيتشال بالكامل
 * وواجهة `Journey` بتتملّى من الباك اند من غير أي تعديل في الشاشات.
 */
import type { ProjectRow } from '@/types/domain'
import { projectRows } from './mock/projects'

/** المستوى اللي القرار النهائي اتاخد عنده */
export type DecisionLevel =
  | 'مدير المنح'
  | 'المدير التنفيذي'
  | 'اللجنة التنفيذية'
  | 'مجلس الأمناء'

/** سقوف الصلاحية · نفس الأرقام اللي في `roles.ts`، مؤقتة لحين تأكيد مظفر */
const CEILING_MANAGER = 250_000
const CEILING_CEO = 500_000
const CEILING_COMMITTEE = 2_000_000

export interface Journey {
  /** مشرف المنح: من إسناد المشروع لتسجيل التوصية · بالساعات */
  study: number | null
  /** مدير المنح: من الاستلام لتسجيل القرار */
  manager: number | null
  /** المدير التنفيذي */
  exec: number | null
  /** اللجنة التنفيذية · من الإحالة للقرار */
  committee: number | null
  /** إعداد الاتفاقية واعتمادها */
  agreement: number | null
  /** معالجة أول طلب صرف */
  payout: number | null
  /** من طلب التقرير الختامي للإغلاق */
  closing: number | null
  /** مرات إعادة الطلب للجهة لاستكمال البيانات */
  toEntity: number
  /** مرات إعادة المشروع من المدير للمشرف */
  toSupervisor: number
  /** اتحوّل بين مشرفَين */
  transferred: boolean
  /** المستوى اللي بتّ فعلًا · null يعني لسه ما اتبتّش */
  decidedBy: DecisionLevel | null
  /** اتقرّر من أول عرض بلا إعادة */
  firstPass: boolean
  /** اتحجزت ميزانيته من أول مراجعة */
  reservedFirstPass: boolean
}

/* ═══ عشوائية حتمية ═══
   دالة hash على الـid: نفس المدخل = نفس المخرج دايمًا. الغرض توزيع
   معقول مش أرقام «جميلة» · لو كل المشاريع خدت نفس المدة المؤشر
   بيبقى بلا معنى. */
const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/** رقم في مدى، مشتقّ من الـid + بذرة نصية تفرّق بين الحقول */
const pick = (id: string, salt: string, min: number, max: number): number =>
  Math.round(min + hash(`${id}:${salt}`) * (max - min))

/** ترتيب الأقسام · المشروع اللي في قسم متأخّر عدّى اللي قبله */
const ORDER = [
  'استكمال بيانات المشروع',
  'دراسة المشروع',
  'اعتماد الإتفاقية',
  'اعتماد الإتفاقية الكترونيًا',
  'الإتفاقيات الورقية',
  'المشرف إذن الصرف',
  'إذن صرف معاد',
  'اصدار سند الصرف',
  'رفع سند القبض والقيد',
  'رفع تقرير مرحلي',
  'طلب التقرير الختامي',
  'رفع التقرير الختامي',
  'اعتماد التقرير الختامي',
  'تقييم المشروع',
  'مشروع مكتمل',
]

/** فين وصل المشروع في السلسلة. المتعثّر والمعتذر عنه بيتعاملوا بحالتهم. */
const reach = (row: ProjectRow): number => {
  if (row.statusGroup === 'مكتمل') return ORDER.length - 1
  if (row.statusGroup === 'معتذر عنه') return 1
  if (row.statusGroup === 'متعثر') return ORDER.indexOf('رفع تقرير مرحلي')
  const i = ORDER.indexOf(row.stage)
  return i < 0 ? 1 : i
}

const daysBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null
}

/** المستوى اللي بتّ · بيتحدّد بالمبلغ المعتمد مقابل السقوف */
const levelFor = (amount: number): DecisionLevel =>
  amount <= CEILING_MANAGER
    ? 'مدير المنح'
    : amount <= CEILING_CEO
      ? 'المدير التنفيذي'
      : amount <= CEILING_COMMITTEE
        ? 'اللجنة التنفيذية'
        : 'مجلس الأمناء'

export function journeyOf(row: ProjectRow): Journey {
  const at = reach(row)
  const decided = row.supportStatus !== null
  const id = row.id

  /* مدة الدراسة: لو المشروع اتبتّ فيه، المدة الحقيقية من التقديم
     للقرار موجودة · بنقسّمها بين المشرف والمدير بدل ما نخترعها.
     ولو لسه في الدراسة، المكوث الحالي هو المدة. */
  const total = daysBetween(row.submittedAt, row.decidedAt)
  const studyShare = 0.55 + hash(`${id}:split`) * 0.3

  const study =
    total !== null
      ? Math.max(1, Math.round(total * 24 * studyShare))
      : row.stage === 'دراسة المشروع' || row.stage === 'استكمال بيانات المشروع'
        ? row.hoursInStage
        : at >= 2
          ? pick(id, 'study', 120, 1_400)
          : null

  const manager =
    total !== null ? Math.max(1, Math.round(total * 24 * (1 - studyShare))) : at >= 2 ? pick(id, 'mgr', 24, 600) : null

  const level = decided && row.amountGranted > 0 ? levelFor(row.amountGranted) : null

  return {
    study,
    manager,
    exec: level === 'المدير التنفيذي' || level === 'اللجنة التنفيذية' || level === 'مجلس الأمناء'
      ? pick(id, 'exec', 24, 480)
      : null,
    committee: level === 'اللجنة التنفيذية' || level === 'مجلس الأمناء' ? pick(id, 'cmt', 168, 1_100) : null,
    agreement: at >= 2 ? pick(id, 'agr', 72, 900) : null,
    payout: at >= 5 ? pick(id, 'pay', 48, 700) : null,
    closing: at >= ORDER.indexOf('طلب التقرير الختامي') ? pick(id, 'cls', 240, 1_600) : null,
    /* الإعادة الاستثناء لا القاعدة. اللي في «استكمال بيانات المشروع»
       اتعاد فعلًا مرة على الأقل · القسم نفسه هو الدليل. والباقي
       نسبة أقل: الأوديت شاف القسم ده صغيرًا مقارنة بالمحفظة. */
    toEntity: row.stage === 'استكمال بيانات المشروع'
      ? (hash(`${id}:te`) < 0.25 ? 2 : 1)
      : hash(`${id}:te2`) < 0.06
        ? 2
        : hash(`${id}:te2`) < 0.24
          ? 1
          : 0,
    toSupervisor: at >= 2 && hash(`${id}:ts`) < 0.18 ? 1 : 0,
    transferred: hash(`${id}:tr`) < 0.12,
    decidedBy: level,
    firstPass: hash(`${id}:fp`) < 0.62,
    reservedFirstPass: hash(`${id}:rs`) < 0.78,
  }
}

/** الرحلة لكل صف · محسوبة مرة واحدة */
export const journeys: Map<string, Journey> = new Map(
  projectRows.map((r) => [r.id, journeyOf(r)]),
)
