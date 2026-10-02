/**
 * Notification preferences · what each user can be told, on which channel, and how often.
 *
 * Built from the system's own workflow, not a generic list: every event here is a step a project,
 * an entity or a payment actually goes through. Events the work cannot move without (a decision
 * waiting on you, a security alert) are `required`: their in-app notice can't be turned off, and
 * the page says why. SMS is reserved for `urgent` events, so a text message always means "now".
 */

export type Channel = 'app' | 'email' | 'sms'
export type Freq = 'now' | 'daily' | 'weekly'

export interface NotifyEvent {
  key: string
  label: string
  /** The in-app notice can't be switched off */
  required?: boolean
  /** May use SMS and passes through quiet hours */
  urgent?: boolean
}

export interface NotifyGroup {
  key: string
  label: string
  note: string
  events: NotifyEvent[]
}

export const NOTIFY_GROUPS: NotifyGroup[] = [
  {
    key: 'decisions',
    label: 'قرارات بانتظاري',
    note: 'ما لا يتحرك العمل بدونه · الإشعار داخل النظام إلزامي',
    events: [
      { key: 'awaiting', label: 'مشروع ينتظر توصيتي أو اعتمادي', required: true, urgent: true },
      { key: 'returned', label: 'مشروع أُعيد للاستكمال', required: true },
      { key: 'delegated', label: 'مهمة فُوِّضت إليّ', required: true, urgent: true },
    ],
  },
  {
    key: 'time',
    label: 'المدد',
    note: 'حدود الأقسام في مصفوفة الاعتماد',
    events: [
      { key: 'over', label: 'مشروعي تجاوز حدّ القسم', urgent: true },
      { key: 'near', label: 'مشروعي اقترب من الحدّ (80%)' },
    ],
  },
  {
    key: 'entity',
    label: 'الجهة',
    note: 'ما يصل من الجهات عبر البوابة',
    events: [
      { key: 'upload', label: 'رفعت الجهة مستندًا' },
      { key: 'expiry', label: 'ترخيص أو مستند ينتهي خلال 30 يومًا' },
      { key: 'reply', label: 'ردّت الجهة في المراسلات' },
    ],
  },
  {
    key: 'money',
    label: 'الصرف',
    note: 'طلبات الصرف ودفعات الاتفاقيات',
    events: [
      { key: 'payStage', label: 'طلب صرف وصل إلى مرحلتي', urgent: true },
      { key: 'payStuck', label: 'دفعة متعثّرة' },
      { key: 'paid', label: 'تم صرف دفعة' },
    ],
  },
  {
    key: 'docs',
    label: 'الاتفاقيات والإغلاق',
    note: 'التوقيع والتقرير الختامي والتقييم',
    events: [
      { key: 'sign', label: 'اتفاقية بانتظار التوقيع' },
      { key: 'final', label: 'رُفع التقرير الختامي' },
      { key: 'eval', label: 'تقييم مطلوب مني' },
    ],
  },
  {
    key: 'budget',
    label: 'الميزانية',
    note: 'البنود والربط',
    events: [
      { key: 'lineLow', label: 'بند قارب النفاد' },
      { key: 'linked', label: 'رُبط مشروع ببند' },
    ],
  },
  {
    key: 'mentions',
    label: 'الإشارات والنشاط',
    note: 'ما يخصّني في مشاريع أتابعها',
    events: [
      { key: 'mention', label: 'تعليق يذكرني بالاسم' },
      { key: 'activity', label: 'متابعة أو فعالية جديدة على مشروع أملكه' },
    ],
  },
  {
    key: 'security',
    label: 'الأمان',
    note: 'لا يُطفأ · حماية للحساب',
    events: [
      { key: 'newDevice', label: 'دخول من جهاز جديد', required: true, urgent: true },
    ],
  },
]

export type Matrix = Record<string, Record<Channel, boolean>>

export interface NotifyPrefs {
  matrix: Matrix
  freq: Record<string, Freq>
  digestAt: string
  quiet: { on: boolean; from: string; to: string; weekend: boolean }
  /** Awareness and foundation news · personal-data law: opt-in, with its date */
  news: { on: boolean; at: string }
}

/**
 * Defaults by role. The supervisor hears about their own projects at once; the grants manager gets
 * decisions at once and the rest in a daily summary; the executive director gets only what waits
 * for them, with a weekly summary.
 */
export function notifyDefaults(roleKey: string): NotifyPrefs {
  const matrix: Matrix = {}
  const freq: Record<string, Freq> = {}
  for (const g of NOTIFY_GROUPS) {
    for (const e of g.events) {
      const app = true
      const email = roleKey === 'ceo' ? Boolean(e.required) : g.key !== 'mentions'
      const sms = Boolean(e.urgent) && (e.required || roleKey === 'supervisor')
      matrix[e.key] = { app, email, sms }
    }
    freq[g.key] =
      g.key === 'decisions' || g.key === 'security'
        ? 'now'
        : roleKey === 'ceo'
          ? 'weekly'
          : roleKey === 'grants-manager'
            ? 'daily'
            : g.key === 'time' || g.key === 'money'
              ? 'now'
              : 'daily'
  }
  return {
    matrix,
    freq,
    digestAt: '07:30',
    quiet: { on: true, from: '16:00', to: '08:00', weekend: true },
    news: { on: false, at: '' },
  }
}

export const FREQ_OPTIONS: { value: Freq; label: string }[] = [
  { value: 'now', label: 'فوري' },
  { value: 'daily', label: 'ملخّص يومي' },
  { value: 'weekly', label: 'ملخّص أسبوعي' },
]

export const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)
  .concat(['07:30'])
  .sort()

/* ── Delegation ── */

export interface Delegation {
  on: boolean
  from: string
  to: string
  delegate: string
  scope: 'all' | 'approvals'
  note: string
}

export const DELEGATION_DEFAULT: Delegation = {
  on: false, from: '', to: '', delegate: '', scope: 'approvals', note: '',
}

/* ── Sessions (mock) ── */

export const SESSIONS = [
  { id: 's1', device: 'MacBook · Safari', place: 'الرياض', at: 'الآن', current: true },
  { id: 's2', device: 'iPhone · تطبيق الجوال', place: 'الرياض', at: 'قبل ساعتين' },
  { id: 's3', device: 'Windows · Chrome', place: 'جدة', at: 'قبل 3 أيام' },
]
