/* The notification topics · its own file so the settings inventory can count them without importing
   every module's store through the hub. */

export type Topic =
  | 'cycle' | 'registration' | 'account' | 'project' | 'decision' | 'agreement' | 'payment' | 'plan' | 'closing' | 'partners' | 'budget' | 'escalation'

export const TOPIC_SAY: Record<Topic, string> = {
  cycle: 'فتح باب التقديم',
  registration: 'التسجيل وتحديث البيانات',
  account: 'الحساب وكلمة المرور',
  project: 'طلب المشروع والاستكمال',
  decision: 'قرارات الاعتماد',
  agreement: 'الاتفاقيات',
  payment: 'صرف الدفعات',
  plan: 'خطط المشاريع',
  closing: 'الإغلاق والتقرير الختامي',
  partners: 'الشركاء والمحافظ',
  budget: 'الميزانية',
  escalation: 'التأخر والتعثر',
}
