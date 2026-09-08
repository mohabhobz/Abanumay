/**
 * الأدوار.
 *
 * السيستم واحد، لكن السؤال اللي في دماغ كل دور مختلف تمامًا:
 *
 *   مشرف المنح     ← «إيه اللي عليّ أنا النهارده؟»
 *                    شغله على مشروع واحد في المرة، ومالوش سقف مالي.
 *   مدير المنح     ← «فريقي ماشي إزاي، وإيه اللي واقف عندي؟»
 *                    بيوزّع الحمل ويعتمد فوق سقف المشرف.
 *   المدير التنفيذي ← «المحفظة رايحة فين؟»
 *                    ما بيفتحش مشروعًا مشروعًا، بيقيس التزامًا وأثرًا.
 *
 * فالقراءات والشرائح والصلاحيات بتشتق من هنا. الأوديت لقى 24 مستخدمًا
 * و18 ملف صلاحيات في النظام العامل؛ التلاتة دول هم الأدوار اللي
 * الشاشات اتصمّمت لها.
 */
import userPhoto from '@/assets/user-omar.jpg'
import type { CurrentUser, DecisionAction } from '@/types/domain'

export type RoleKey = 'supervisor' | 'grants-manager' | 'ceo'

export interface Role {
  key: RoleKey
  name: string
  title: string
  /** حرفان: أول الاسم وأول اللقب — التلاتة بيبدأوا بعين،
   *  فحرف واحد ما بيفرّقش بينهم */
  initial: string
  photo?: string
  /** null = توصية فقط، بلا سقف مالي */
  financialAuthority: number | null
  /** نبرة صندوقه: شخصية (شغلي) · إشرافية (فريقي) · محفظة (المؤسسة) */
  lens: 'own' | 'team' | 'portfolio'
  actions: DecisionAction[]
}

export const ROLES: Role[] = [
  {
    key: 'supervisor',
    name: 'عمر قاسم',
    title: 'مشرف المنح',
    initial: 'عق',
    photo: userPhoto,
    financialAuthority: null,
    lens: 'own',
    actions: [
      { label: 'توصية بالموافقة', kind: 'btn-1' },
      { label: 'طلب استكمال', kind: 'btn-3' },
      { label: 'تحويل لمشرف آخر', kind: 'btn-2' },
      { label: 'توصية بالرفض', kind: 'btn-d' },
    ],
  },
  {
    key: 'grants-manager',
    name: 'عبدالله الدوسري',
    title: 'مدير المنح',
    initial: 'عد',
    financialAuthority: 250_000,
    lens: 'team',
    actions: [
      { label: 'اعتماد', kind: 'btn-1' },
      { label: 'رفع للجنة التنفيذية', kind: 'btn-3' },
      { label: 'إعادة للمشرف', kind: 'btn-2' },
      { label: 'اعتذار', kind: 'btn-d' },
    ],
  },
  {
    key: 'ceo',
    name: 'عبدالرحمن الهليّل',
    title: 'المدير التنفيذي',
    initial: 'عه',
    financialAuthority: 500_000,
    lens: 'portfolio',
    actions: [
      { label: 'اعتماد', kind: 'btn-1' },
      { label: 'رفع لمجلس الأمناء', kind: 'btn-3' },
      { label: 'إعادة لمدير المنح', kind: 'btn-2' },
      { label: 'اعتذار', kind: 'btn-d' },
    ],
  },
]

export const roleByKey = (key: string): Role => ROLES.find((r) => r.key === key) ?? ROLES[0]

/** الدور بيتحوّل للشكل اللي الواجهة بتستهلكه */
export const asUser = (role: Role): CurrentUser => ({
  name: role.name,
  role: role.title,
  initial: role.initial,
  photo: role.photo,
  financialAuthority: role.financialAuthority,
  actions: role.actions,
})

/* ── الدور الحالي ──
   في النموذج ده بيتبدّل من قائمة الحساب عشان الفرق بين الأدوار
   يتجرّب فعلًا. لما يبقى فيه باك اند، بييجي من التوكن ويختفي المبدّل. */

const KEY = 'ab-role'

export function readRole(): RoleKey {
  try {
    const saved = localStorage.getItem(KEY)
    return ROLES.some((r) => r.key === saved) ? (saved as RoleKey) : 'supervisor'
  } catch {
    return 'supervisor'
  }
}

export function writeRole(key: RoleKey): void {
  try {
    localStorage.setItem(KEY, key)
  } catch {
    /* التخزين ممكن يكون مقفول */
  }
}
