/* Client meeting 23 Oct · the request pages read alike · registration and update review carry the
   same three tabs, and the same «الطلب متوقف» count noun. */

export const REQ_TABS = [
  { slug: 'data', label: 'بيانات الطلب' },
  { slug: 'docs', label: 'المرفقات' },
  { slug: 'log', label: 'سجل الطلب' },
] as const

/** The noun after a blocker count · «3 موانع» */
export const STOP_NOUN = { one: 'مانع', few: 'موانع', many: 'مانعًا' }
