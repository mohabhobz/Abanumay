/**
 * نموذج البيانات · مشتق من النظام العامل `sys.abanumay.sa`
 * (راجع `Abanumay_System_Live_Audit.md` في مجلد المشروع).
 *
 * أي حقل هنا له مقابل حقيقي في النظام. لما الباك اند يسلّم الـAPI
 * المفروض يطابق الشكل ده، وأي اختلاف هيبان وقت البيلد مش وقت التشغيل.
 */

/** درجة اللون المستخدمة في الشارات والمؤشرات */
export type Tone = 'ok' | 'warn' | 'no' | 'ret' | 'brand' | 'teal' | 'lime' | 'mute'

/** مصدر التمويل · النظام بيفصل بينهم بأقسام إجرائية مستقلة */
export type FundingSource = 'foundation' | 'waqf'

/**
 * القسم الإجرائي · النظام فيه 50 قسمًا.
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

/** الحالة المجمّعة · النظام بيفلتر بيها، 5 قيم فقط */
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
 * `hours` مقابل `limit` هو أساس تنبيه «تجاوز مدة الإجراء» ·
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
  /** المسار ← المجال ← الهدف · شجرة الميزانية */
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
  /** العدد بعد مراجعة المشرف · النظام بيفصله عن تقدير الجهة */
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

// ═══════════════════════ الاتفاقيات · BPD-008 ═══════════════════════

/**
 * مرحلة الاتفاقية · من مخطط المسارات (9.6) وخطوات الإجراء.
 *
 * ⚠️ **دي مرحلة الاتفاقية لا حالة المشروع.** القاعدة 25 صريحة:
 * «لا يؤثر انتقال الاتفاقية بين مراحل المراجعة والاعتماد أو التوقيع
 * على حالة المشروع، حيث تبقى حالة المشروع (إعداد الاتفاقية) حتى
 * اعتماد الاتفاقية النهائية». يعني اتفاقية عند المدير التنفيذي
 * والمشروع لسّه مكتوب عليه «إعداد الاتفاقية» — والاتنين صح.
 */
export type AgreementStage =
  /** مسودة عند مشرف المنح · خطوات 3–11 */
  | 'draft'
  /** بانتظار مدير المنح · خطوات 12–13 */
  | 'manager'
  /** بانتظار المدير التنفيذي · خطوات 16–17 */
  | 'executive'
  /** بانتظار توقيع الجهة · خطوات 20–21 */
  | 'entity'
  /** مُعادة للتعديل · خطوات 14 · 18 · 22 */
  | 'returned'
  /** سارية · خطوات 24–28 */
  | 'active'
  /** ملغاة أو مرفوضة نهائيًا · قاعدة 26 */
  | 'cancelled'

export type AgreementKind = 'إلكترونية' | 'ورقية'

/** دفعة في جدول الاتفاقية · قاعدة 7 */
export interface AgreementPayment {
  no: number
  /** القيمة بالريال · قاعدة 8 بتتحقق إن المجموع = قيمة المنحة */
  amount: number
  /** النسبة من المنحة · قاعدة 8 بتتحقق إن المجموع = 100% */
  share: number
  dueAt: string
  /** متطلبات الصرف · بتتربط بالتقارير أو المخرجات */
  requirement?: string
}

/** حدث في سجل تدقيق الاتفاقية · قاعدة 22 */
export interface AgreementEvent {
  at: string
  who: string
  role: string
  what: string
  note?: string
  /** خطوة الإجراء في BPD-008 */
  step: number
  /** الإشعار اللي اتبعت مع الانتقال · قاعدة 20 */
  notified?: string
  /** الإصدار اللي الحدث حصل عليه · قاعدة 24 */
  version: number
}

export interface AgreementRow {
  id: string
  /** قاعدة 2 · مشروع واحد بالظبط، لا أكتر */
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  /** قاعدة 3 · بيتحدد عند الإنشاء وما يتغيّرش إلا بإصدار جديد */
  kind: AgreementKind
  /** القالب المعتمد · قاعدة 4 · واحد من نماذج النظام */
  template: string
  stage: AgreementStage
  /** قاعدة 24 · إصدارات متعددة، وواحد ساري */
  version: number
  /** قيمة المنحة · خطوة 11 بتطابقها بالمحجوز في الميزانية */
  amount: number
  /** المحجوز فعلًا في الميزانية · الفرق بيمنع الإرسال */
  reserved: number
  /** جدول الدفعات · قاعدة 7، وجزء من الاتفاقية لا ملحق بيها */
  payments: AgreementPayment[]
  /** ممثل الجهة المخوّل بالتوقيع · مدخل في الوثيقة */
  signer: { name: string; title: string }
  /** مشرف المنح المسؤول */
  owner: string
  /** تاريخ إحالة المشروع لمرحلة إعداد الاتفاقية · خطوة 1 */
  openedAt: string
  /** تاريخ التفعيل · خطوة 26، لو اتفعّلت */
  activeAt?: string
  /** ساعات المكوث في المرحلة الحالية */
  hoursInStage: number
  /** ملاحظة آخر إعادة · قاعدة 10 بتلزم توضيح السبب */
  note?: string
  /** مخرج الذكاء الاصطناعي · 9.5 · قاعدة 21 بتخلّيه استرشاديًا */
  ai?: string
  /** سجل التدقيق · قاعدة 22 */
  log: AgreementEvent[]
  /** المرفقات والملاحق · قاعدة 18 */
  docs: PayDoc[]
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
   `btn-3` (الأزرق) اتشال من هنا عن قصد · الأزرق في النظام يوصف
   حالة لا يعمل نداء، ووجوده في النوع كان بيسمح بالمخالفة. */
export type DecisionKind = 'btn-p' | 'btn-2' | 'btn-d'

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
 * صف في قائمة المشاريع · العمود الفقري من 12 حقلًا.
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
  /** حدّ القسم بالساعات · مؤقت لحين تأكيده */
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

/** صف في قائمة الجهات · التعريف + الأداء التراكمي */
export interface EntityRow {
  id: string
  name: string
  licenseNo: string
  type: string
  licensor: string
  region: string
  city: string
  registeredAt: string
  /** نهاية الترخيص · **قيمة في الداتا لا رقم مولَّد**.
      كانت بتتحسب `registeredAt + int(1,6) سنة`، فجهة مسجّلة ٢٠١٦
      وحوكمتها ممتازة وبتاخد منح لحدّ دلوقتي كان ترخيصها بينتهي
      ٢٠١٩ · يعني عشر سنين بلا تجديد واحد، وده بيناقض حالتها
      المكتوبة جنبه. التاريخ ده بيتقرا وبيتراجع، وما بيتخلقش. */
  licenseEndsAt: string
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

/* ═══════════════════════════════════════════════════════════
   Disbursement · BPD-009

   The states are "who is waiting", not "paid / unpaid". The live
   system shows two payment states while the flow has many more, so
   a supervisor reading "unpaid" learns nothing about what is
   blocking it. These five come straight from the document's own
   step list, and rule 19 requires the beneficiary to see the state
   of the REQUEST, not the state of the payment.
   ═══════════════════════════════════════════════════════════ */

/** State of a disbursement request · BPD-009 steps 4-19 */
export type PayState =
  | 'supervisor'   /* steps 4-7   · with the grants supervisor      */
  | 'returned'     /* steps 10-11 · back with the beneficiary       */
  | 'manager'      /* steps 12-13 · with the grants manager         */
  | 'finance'      /* steps 14-17 · with finance                    */
  | 'paid'         /* steps 18-19 · transferred                     */
  | 'closed'       /* rule 15     · finally rejected, kept on record */

/** One pre-condition the document requires before a step may pass */
export interface PayCheck {
  label: string
  ok: boolean
  /** The rule number in BPD-009 this check enforces */
  rule: number
}

export interface PayRequest {
  /** رقم الطلب · not the payment number */
  id: string
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  /** الدفعة كام من كام · from the agreement's payment schedule */
  no: number
  of: number
  /** قيمة الدفعة المعتمدة في الجدول */
  due: number
  /** قيمة الطلب · rule 5 caps it at `due` */
  asked: number
  /** تاريخ الاستحقاق وفق الجدول */
  dueAt: string
  state: PayState
  /** ساعات المكوث في المرحلة الحالية · feeds the escalation in 9.5 */
  hoursInState: number
  /** شرط الصرف · rule 6 · empty when the payment carries no condition */
  condition?: string
  /** الشروط اللي النظام بيتحقق منها قبل الانتقال */
  checks: PayCheck[]
  /** البنك المعتمد · المخرج الثاني في الوثيقة: «الحساب البنكي المعتمد» */
  bank: { name: string; active: boolean }
  /** مصادر التمويل · rule 12 distributes the payment across them */
  sources: { name: string; share: number }[]
  /** مخرج الذكاء الاصطناعي · step 6 · rule 20 makes it advisory only */
  ai?: string
  /** ملاحظة آخر إعادة · rules 7 و8 */
  note?: string
  /** مشرف المنح المسؤول */
  owner: string
  /** تاريخ إنشاء الطلب · step 2 */
  at: string
  /** تاريخ التحويل · step 17, only when paid */
  paidAt?: string

  /* ── ما يلزم صفحة الطلب الواحد ── */

  /** الاتفاقية وسريانها · rule 10 checks it before finance */
  agreement: { id: string; active: boolean; endsAt: string }
  /** قيمة المنحة كاملة · rule 14 caps the total at it */
  granted: number
  /** المصروف من المنحة قبل هذه الدفعة · rule 14 */
  spent: number
  /** المحجوز على هذه الدفعة · rule 11 then rule 13 turns it into spent */
  reserved: number
  /** المرفقات · rule 21 keeps them on the request itself */
  docs: PayDoc[]
  /** سجل التدقيق · rule 16 · every transition, with its step number */
  log: PayEvent[]
}

/** مستند مرفق بالطلب · rule 21 */
export interface PayDoc {
  name: string
  kind: string
  at: string
  size: string
}

/** حدث في سجل التدقيق · rule 16 · `step` is the step in BPD-009 */
export interface PayEvent {
  at: string
  who: string
  role: string
  what: string
  note?: string
  step: number
  /** الإشعار المرسل مع الانتقال · rule 17 */
  notified?: string
}
