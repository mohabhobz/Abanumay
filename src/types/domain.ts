/**
 * نموذج البيانات — مشتق من النظام العامل `sys.abanumay.sa`
 * (راجع `Abanumay_System_Live_Audit.md` في مجلد المشروع).
 *
 * أي حقل هنا له مقابل حقيقي في النظام. لما الباك اند يسلّم الـAPI
 * المفروض يطابق الشكل ده، وأي اختلاف هيبان وقت البيلد مش وقت التشغيل.
 */

/** درجة اللون المستخدمة في الشارات والمؤشرات */
export type Tone = 'ok' | 'warn' | 'no' | 'ret' | 'brand' | 'teal' | 'lime' | 'mute'

/** مصدر التمويل — النظام بيفصل بينهم بأقسام إجرائية مستقلة */
export type FundingSource = 'foundation' | 'waqf'

/**
 * القسم الإجرائي — النظام فيه 50 قسمًا.
 * دي أكثرهم ورودًا في جدول المشاريع (18 قيمة على 4,929 مشروعًا).
 */
export type ProcedureStage =
  | 'دراسة المشروع'
  | 'استكمال بيانات المشروع'
  | 'اعتماد الإتفاقية'
  | 'اعتماد الإتفاقية الكترونيًا'
  | 'الإتفاقيات الورقية'
  | 'المشرف إذن الصرف'
  | 'إذن صرف معاد'
  | 'اصدار سند الصرف'
  | 'رفع سند القبض والقيد'
  | 'طلب التقرير الختامي'
  | 'رفع التقرير الختامي'
  | 'اعتماد التقرير الختامي'
  | 'رفع تقرير مرحلي'
  | 'تقييم المشروع'
  | 'مشروع مكتمل'
  | 'مشروع متعثر'
  | 'مشروع معتذر عنه'
  | 'مشروع ملغي'

/** الحالة المجمّعة — النظام بيفلتر بيها، 5 قيم فقط */
export type ProjectStatusGroup =
  | 'في الدراسة'
  | 'في التشغيل'
  | 'معتذر عنه'
  | 'متعثر'
  | 'مكتمل'

/** أسلوب المنح كما في فلتر النظام */
export type GrantMethod = 'بحث واستجابة' | 'ابتكار وإنضاج'

/** طريقة تحويل المبلغ للجهة */
export type TransferMethod = 'حساب الجهة مباشر' | 'عبر منصة إحسان'

/** مبررات الاعتذار المقنّنة في النظام (9) */
export type DeclineReason =
  | 'الاكتفاء بالمشاريع المدعومة في الهدف'
  | 'الاكتفاء بدعم المشاريع الأخرى لنفس الجهة'
  | 'مشروع مكرر لنفس الجهة'
  | 'ضعف دراسة المشروع'
  | 'الاكتفاء بالمشاريع المدعومة في المنطقة'
  | 'نفاذ البند المخصص'
  | 'مشروع ليس ضمن تخصص الجهة'
  | 'خطأ في تعبئة البيانات'
  | 'أخرى'

/** أنواع المتابعة الثمانية */
export type FollowUpType =
  | 'التواصل مع الشريك'
  | 'تحديث الاتفاقية'
  | 'تحديث تقرير المشروع'
  | 'منتج معرفي'
  | 'رفع صورة أو فيديو'
  | 'زيارة ميدانية'
  | 'مخاطبات'
  | 'أخرى'

// ═══════════════════════ الجهة ═══════════════════════

export type EntityActivation = 'مقبول' | 'معلق (جديد)' | 'معلق (موقوف)' | 'محدث' | 'مرفوض'

export interface EntityDocument {
  name: string
  uploaded: boolean
}

export interface EntityProjectRef {
  id: string
  name: string
  region: string
  status: string
  tone: Tone
  weight: number
}

export interface Entity {
  id?: string
  name: string
  initial: string
  type: string
  licensor: string
  supervisor: string
  region: string
  city: string
  licenseNo: string
  licenseEnd: string
  /** التاريخ الهجري كما يعرضه النظام جنب الميلادي */
  licenseEndH: string
  boardEnd: string
  founded: string
  foundedH: string
  phone: string
  mobile: string
  email: string
  website: string
  ceo: string
  ceoMobile: string
  dataEntry: string
  registeredAt: string
  lastEdit: string
  userNo: string
  userName: string
  accountType: string
  /** «لم تُقيَّم» لو ملف الجهة ناقص */
  governance: string
  activation?: EntityActivation
  docs: EntityDocument[]
  stats: KeyValue<number>[]
  projects: EntityProjectRef[]
}

// ═══════════════════════ المشروع ═══════════════════════

export interface KeyValue<V = string> {
  k: string
  v: V
}

export interface ProjectPhase {
  name: string
  tasks: string
  months: string
  tone: Tone
}

export interface Attachment {
  name: string
  uploaded: boolean
  required: boolean
}

export interface ContactPerson {
  name: string
  phone: string
  email: string
}

export interface BankAccount {
  name: string
  account: string
  iban: string
  status: string
}

export type GateState = 'now' | 'done' | ''

export interface Gate {
  role: string
  state: GateState
  note: string
}

/**
 * قيد في سجل الإجراءات.
 * `hours` مقابل `limit` هو أساس تنبيه «تجاوز مدة الإجراء» —
 * والنظام بيسجّل المدة لكل مستوى فعلًا (13 عمود مدة في جدول المشاريع).
 */
export interface LogEntry {
  action: string
  body: string
  dept: string
  by: string
  at: string
  days: number
  hours: number
  limit: number
  extra?: string
  tone: Tone
}

export interface FollowUp {
  type: FollowUpType
  body: string
  at: string
  by: string
  attachment?: string
}

export interface Payment {
  no: number
  amount: number
  date: string
  status: string
  voucher?: string
}

export interface Minute {
  no: string
  date: string
  file?: string
}

export interface Correspondence {
  no: string
  date: string
  kind: string
  body: string
}

export interface Agreement {
  no: string
  kind: 'إلكترونية' | 'ورقية'
  status: string
  signedAt?: string
}

export interface Project {
  id: string
  name: string
  /** المسار ← المجال ← الهدف — شجرة الميزانية */
  track: string
  field: string
  goal: string
  tags: string[]

  status: { label: string; tone: Tone }
  stage: ProcedureStage
  statusGroup?: ProjectStatusGroup
  funding?: FundingSource

  amountRequested: number
  amountTotal: number
  amountGranted: number
  amountSpent?: number
  /** وزن المشروع 0–100 كما في النظام */
  weight: number
  /** التقييم % */
  score: number

  startDate: string
  durationDays: number

  region: string
  city: string
  beneficiaries: number
  /** العدد بعد مراجعة المشرف — النظام بيفصله عن تقدير الجهة */
  beneficiariesVerified: number
  audiences: string[]

  compliance: KeyValue[]

  idea: string
  mainGoal: string
  goals: string[]
  outputs: string[]
  rationale: string[]
  phases: ProjectPhase[]

  manager: ContactPerson
  bank: BankAccount
  attachments: Attachment[]

  gates: Gate[]
  log: LogEntry[]

  followUps: FollowUp[]
  messages: Correspondence[]
  payments: Payment[]
  minutes: Minute[]
  correspondence: Correspondence[]
  agreement: Agreement | null

  grantMethod?: GrantMethod
  transferMethod?: TransferMethod
  declineReason?: DeclineReason
  owner?: string
}

// ═══════════════════════ الصلاحيات ═══════════════════════

export type AuthorityKind = 'submit' | 'recommend' | 'approve' | 'final'
export type AuthorityState = 'done' | 'now' | 'pending'

export interface AuthorityRole {
  role: string
  /** null = بلا سقف (تقديم أو قرار نهائي) */
  ceiling: number | null
  uplift?: number
  kind?: AuthorityKind
  state: AuthorityState
  note?: string
}

export interface AuthorityMatrix {
  /** الأرقام مؤقتة لحين تأكيدها من العميل */
  provisional: boolean
  roles: AuthorityRole[]
}

// ═══════════════════════ المستخدم ═══════════════════════

/* ترتيب الأفعال: أساسي واحد · ثانوي للباقي · هدّام له لونه.
   `btn-3` (الأزرق) اتشال من هنا عن قصد — الأزرق في النظام يوصف
   حالة لا يعمل نداء، ووجوده في النوع كان بيسمح بالمخالفة. */
export type DecisionKind = 'btn-p' | 'btn-1' | 'btn-2' | 'btn-d'

export interface DecisionAction {
  label: string
  kind: DecisionKind
}

export interface CurrentUser {
  name: string
  role: string
  initial: string
  photo?: string
  /** null = صلاحية توصية فقط، بلا سقف مالي */
  financialAuthority: number | null
  actions: DecisionAction[]
}

// ═══════════════════════ قراءات المساعد ═══════════════════════

export interface Insight {
  text: string
  bold: string[]
  src: string
}

// ═══════════════════ صفوف القوائم ═══════════════════

/**
 * صف في قائمة المشاريع — العمود الفقري من 12 حقلًا.
 * جدول النظام فيه 62 عمودًا؛ الباقي يعيش في صفحة المشروع.
 */
export interface ProjectRow {
  id: string
  name: string
  entityId: string
  entityName: string
  track: string
  field: string
  goal: string
  region: string
  city: string
  /** القسم الإجرائي الفعلي، مش المجموعة */
  stage: string
  statusGroup: ProjectStatusGroup
  /** ساعات المكوث في القسم الحالي */
  hoursInStage: number
  /** حدّ القسم بالساعات — مؤقت لحين تأكيده */
  stageLimit: number
  amountRequested: number
  amountGranted: number
  amountSpent: number
  weight: number
  score: number
  /** null = مشروع بلا مالك، وده ربع النظام */
  owner: string | null
  year: string
  funding: FundingSource
  tags: string[]
  grantMethod: GrantMethod
  shared: boolean
  impact: boolean
  supportStatus: 'معتمد' | 'مرفوض' | null
  declineReason?: DeclineReason
  submittedAt: string
  decidedAt?: string
  durationDays: number
  beneficiaries: number
  hasInterimReport: boolean
  hasFinalReport: boolean
  hasKnowledgeProduct: boolean
  fieldVisit: boolean
}

/** صف في قائمة الجهات — التعريف + الأداء التراكمي */
export interface EntityRow {
  id: string
  name: string
  licenseNo: string
  type: string
  licensor: string
  region: string
  city: string
  registeredAt: string
  activation: EntityActivation
  /** «لم تُقيَّم» لو ملف الجهة ناقص */
  governance: string
  /** عدد المستندات المرفوعة من 8 */
  docsUploaded: number
  projectsApproved: number
  projectsRunning: number
  projectsDeclined: number
  projectsStalled: number
  projectsCompleted: number
  grantedThisYear: number
  grantedTotal: number
  inDisbursement: number
  mobile: string
  email: string
}
