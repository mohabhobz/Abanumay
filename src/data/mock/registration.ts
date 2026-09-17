/**
 * تسجيل جهة جديدة · BPD-002
 *
 * ⚠️ **أهم قاعدة في الإجراء كله هي القاعدة 2: مفيش حساب قبل
 * الاعتماد.** اللي بيتعمل في البداية **طلب** لا جهة · والجهة
 * بتتولد بعد الاعتماد وساعتها بس بيتبعت اسم المستخدم. فالنوع
 * اللي هنا اسمه `RegRequest` لا `EntityRow`، وحقوله كلها نصوص
 * **زي ما الجهة كتبتها** لا قيم معتمدة · لأن المراجع بيراجع
 * إقرارًا لا سجلًا.
 *
 * والفرق ده بيظهر في تلات حاجات في الواجهة:
 *   · الشاشة اسمها «طلب تسجيل» لا «جهة جديدة»
 *   · درجة الحوكمة موسومة «إقرار الجهة» (نوتة ن-2)
 *   · مفيش زرار حذف في أي مكان · قاعدة 28: أرشفة أو تعطيل بس
 *
 * المصادر: الوثيقة ص 19–26 · ونموذج `/reg/add` في النظام العامل
 * اللي اتقرا حرفيًا. الفروق مسجَّلة في
 * `ENTITIES_REGISTRATION_BRIEF.md`.
 */
import { ENTITY_TYPES, LICENSORS, REGIONS, CITIES_BY_REGION } from './taxonomy'

/* ═══════════════════════════════════════════════════════════
   حالات الطلب · قاعدة 26 · خمسة
   والحالة بتتقري «مين واقف» لا «مقبول/مرفوض» · زي شرائح الصرف
   ═══════════════════════════════════════════════════════════ */

export type RegState = 'draft' | 'review' | 'completion' | 'approved' | 'rejected'

export const REG_STATES: { key: RegState; label: string; who: string }[] = [
  { key: 'draft', label: 'مسودة', who: 'عند الجهة · لسه ما اتبعتش' },
  { key: 'review', label: 'قيد المراجعة', who: 'عند مسؤول النظام' },
  { key: 'completion', label: 'بانتظار الاستكمال', who: 'رجعت للجهة بملاحظات' },
  { key: 'approved', label: 'معتمد', who: 'الجهة اتولدت وبيانات الدخول اتبعتت' },
  { key: 'rejected', label: 'مرفوض', who: 'مؤرشف بسببه · قاعدة 28' },
]

export const REG_STATE_SAY: Record<RegState, string> =
  Object.fromEntries(REG_STATES.map((s) => [s.key, s.label])) as Record<RegState, string>

export const REG_STATE_WHO: Record<RegState, string> =
  Object.fromEntries(REG_STATES.map((s) => [s.key, s.who])) as Record<RegState, string>

export const REG_TONE: Record<RegState, 'mute' | 'warn' | 'ret' | 'ok' | 'no'> = {
  draft: 'mute',
  review: 'warn',
  completion: 'ret',
  approved: 'ok',
  rejected: 'no',
}

/* ═══════════════════════════════════════════════════════════
   نوع الشراكة · قاعدة 32 والفرق الحقيقي بين المدخلين

   ⚠️ **الفرق بين «الجهة بتسجّل نفسها» و«إحنا بنسجّلها» مش شكل
   الفورم، هو حقل واحد.** مظفر: «الاختلاف حيكون في **التحكم في
   الحقول** · الجهة لما تيجي تسجّل الحقل ده ما بتشوفهوش، وبيتحطّ
   أوتوماتيك في الداتابيز».

   والجاي من البوّابة بياخد **شريك مستفيد** باي-ديفولت — وده منطقي:
   هو بيطلب منحة. واللي بيتسجّل من جوّه ممكن يكون **منفّذ** أو
   **استراتيجي**، زي منصة إحسان والمحافظ.

   ═══ والنوع مش تصنيفًا، هو مفتاح كونديشنز ═══

   منصة إحسان **ما بتدخلش منصتنا خالص**: مشرف المنح بيضيفها كجهة،
   وبينشئ المشروع، وبيديره داخليًا بالكامل، وبيعمل الدفعات —
   **ومفيش اتفاقية**. يعني النوع بيقفل ويفتح خطوات في إجراءات
   تانية، مش بيلوّن وسمًا في الجدول.

   عشان كده كل نوع هنا جاي معاه **اللي بيفتحه**، والشاشة بتعرضه
   وقت الاختيار لا بعده.
   ═══════════════════════════════════════════════════════════ */

export type PartnerKind = 'beneficiary' | 'implementer' | 'strategic'

export interface PartnerKindDef {
  key: PartnerKind
  label: string
  /** إيه اللي بيتغيّر في السيستم لما النوع ده يتختار */
  opens: string[]
  /** بيتسجّل منين · البوّابة العامة ولا من جوّه */
  from: 'portal' | 'internal' | 'both'
  example: string
}

export const PARTNER_KINDS: PartnerKindDef[] = [
  {
    key: 'beneficiary',
    label: 'شريك مستفيد',
    from: 'portal',
    example: 'الجمعيات والمؤسسات اللي بتتقدّم بمشاريع',
    opens: [
      'بتتقدّم بمشاريع من بوّابتها',
      'المشروع بيمرّ بدورة الاعتماد كاملة',
      'الاتفاقية إلزامية قبل أي صرف',
    ],
  },
  {
    key: 'implementer',
    label: 'شريك منفّذ',
    from: 'internal',
    example: 'منصة إحسان · المحافظ',
    opens: [
      'ما بتدخلش المنصة · مشرف المنح بيدير مشاريعها داخليًا',
      'المشروع بيتنشئ من جوّه لا من بوّابة الجهة',
      'مفيش اتفاقية · الدفعات بتتعمل مباشرةً',
      'ممكن يكون مشروعًا واحدًا أو محفظة',
    ],
  },
  {
    key: 'strategic',
    label: 'شريك استراتيجي',
    from: 'internal',
    example: 'شراكات طويلة المدى بترتيب خاص',
    opens: [
      'بتتسجّل من جوّه · قاعدة 32',
      'مشاريعها بتتدار داخليًا',
      'شروط الصرف بترتيب الشراكة لا بالدورة العامة',
    ],
  },
]

export const partnerKind = (k: PartnerKind): PartnerKindDef =>
  PARTNER_KINDS.find((x) => x.key === k) ?? PARTNER_KINDS[0]

/** ⚠️ الجاي من البوّابة **ما بيشوفش** الحقل ده · بياخده أوتوماتيك */
export const PORTAL_KIND: PartnerKind = 'beneficiary'

/* ═══════════════════════════════════════════════════════════
   ضوابط القبول · بوّابة `/reg` في النظام العامل

   ⚠️ **مش في الوثيقة** (نوتة ن-1). موجودة هنا لأنها فلتر أهلية:
   الجهة اللي برّه المملكة أو من غير حساب بنكي بتعرف قبل ما تقضّي
   عشرين دقيقة في فورم مصيره الرفض.
   ═══════════════════════════════════════════════════════════ */

export const REG_TERMS = [
  'أن تكون الجهة داخل المملكة العربية السعودية',
  'أن تكون مرخّصة نظاميًا من جهة إشراف معتمدة',
  'أن يكون لها حساب بنكي خاص باسمها',
  'أن تلتزم بالتسجيل واستكمال البيانات والمستندات المطلوبة',
  'أن تكون سليمة قانونيًا وإداريًا وماليًا',
] as const

/* ═══════════════════════════════════════════════════════════
   الحقول · قاعدة 25: الفورم بيتقسّم لمراحل منطقية

   والتقسيم ده **موجود في النظام العامل فعلًا** · صفحة `/reg/add`
   فيها علامة "Vertical Tabs". اللي اتغيّر هنا إن التبويب الخامس
   (الحساب البنكي) اتضاف من **قاعدة 11** لا من النظام، لأن النظام
   بيأجّل البنك لإجراء تاني. الفرق مسجَّل في النوتة ن-4.
   ═══════════════════════════════════════════════════════════ */

export type FieldKind = 'text' | 'tel' | 'email' | 'date' | 'select' | 'number' | 'iban' | 'password'

export interface RegField {
  key: string
  label: string
  kind: FieldKind
  req?: boolean
  /** تلميح من النظام العامل حرفيًا · لو موجود */
  hint?: string
  /** قائمة مقفولة · قاعدة 27 بتفرض ده على أسماء البنوك تحديدًا */
  options?: readonly string[]
  /** الخيارات تابعة لقيمة حقل تاني · زي المدينة والمنطقة */
  dependsOn?: string
}

export interface RegStage {
  key: string
  label: string
  note: string
  fields: RegField[]
}

/** جهة الإشراف الفني · 21 في النظام، والقايمة الكاملة لسه (نوتة ن-6) */
const SUPERVISORS = [...LICENSORS, 'لا يوجد'] as const

export const REG_STAGES: RegStage[] = [
  {
    /* ═══ ن-2 · حساب الجهة · أول محطة ═══
       ⚠️ **قبل الفورم لا بعده، والسبب إن الطلب بيتقطع.** ملف
       الترخيص وتاريخ انتهاء تكليف المجلس والآيبان مش حاجات
       المستخدم حافظها · فهو بيبدأ، بيقوم يجيب ورقة، بيرجع.
       والحساب هو اللي بيخلّي «بيرجع» دي ممكنة: من غيره كل مرة
       بيقفل فيها الصفحة بتضيّع اللي كتبه.

       ⚠️ **وده مش نقض للقاعدة 2.** الحساب ده على **طلبه هو**:
       بيشوف طلبًا واحدًا وحالته وبس · وحساب الجهة الكامل لسه
       بيتولد بعد الاعتماد زي ما القاعدة بتقول. الفرق مشروح في
       `regPortal.ts` وفي شاشة البوّابة نفسها. */
    key: 'account',
    label: 'حساب الجهة',
    note: 'إيميل وكلمة مرور · عشان تقدر تسيب الطلب وترجع له، وتتابع حالته بعد الإرسال',
    fields: [
      { key: 'acctEmail', label: 'البريد الإلكتروني', kind: 'email', req: true, hint: 'كل الإشعارات بتروح عليه' },
      { key: 'acctPass', label: 'كلمة المرور', kind: 'password', req: true, hint: '8 حروف على الأقل' },
      { key: 'acctPass2', label: 'تأكيد كلمة المرور', kind: 'password', req: true },
    ],
  },
  {
    key: 'id',
    label: 'التعريف',
    note: 'الاسم والترخيص · وده اللي بيثبّت الجهة، وبيتقارن بالتصريح',
    fields: [
      { key: 'name', label: 'اسم الجهة', kind: 'text', req: true, hint: 'مطابق للتصريح' },
      { key: 'type', label: 'تصنيف الجهة', kind: 'select', req: true, options: ENTITY_TYPES },
      { key: 'licensor', label: 'جهة الإشراف الفني', kind: 'select', options: SUPERVISORS },
      { key: 'region', label: 'المنطقة', kind: 'select', req: true, options: REGIONS },
      { key: 'city', label: 'المحافظة / المدينة', kind: 'select', req: true, dependsOn: 'region' },
      { key: 'licenseNo', label: 'رقم الترخيص', kind: 'text', req: true },
    ],
  },
  {
    key: 'dates',
    label: 'التواريخ',
    note: 'التاريخان الأخيران بيوقفوا التعاقد لو انتهوا · قاعدتا 18 و19 في إجراء التحديث',
    fields: [
      { key: 'foundedAt', label: 'تاريخ التأسيس', kind: 'date', req: true },
      { key: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص', kind: 'date', req: true },
      { key: 'boardEndsAt', label: 'تاريخ انتهاء تكليف أعضاء المجلس', kind: 'date', req: true },
    ],
  },
  {
    key: 'contact',
    label: 'الاتصال والأشخاص',
    note: 'مدخل البيانات هو اللي بيوصله اسم المستخدم بعد الاعتماد · خطوة 15',
    fields: [
      { key: 'phone', label: 'الهاتف', kind: 'tel' },
      { key: 'mobile', label: 'جوال الجهة', kind: 'tel', req: true },
      { key: 'email', label: 'البريد الإلكتروني للجهة', kind: 'email', req: true },
      { key: 'website', label: 'الموقع الإلكتروني', kind: 'text' },
      { key: 'directorName', label: 'اسم المدير التنفيذي', kind: 'text', req: true },
      { key: 'directorMobile', label: 'جوال المدير التنفيذي', kind: 'tel', req: true },
      { key: 'clerkName', label: 'اسم مدخل البيانات', kind: 'text', req: true },
      { key: 'clerkMobile', label: 'جوال مدخل البيانات', kind: 'tel', req: true },
      { key: 'clerkEmail', label: 'البريد الإلكتروني لمدخل البيانات', kind: 'email', req: true },
    ],
  },
  {
    /* ═══ ن-1 · حسابات لا حساب ═══
       ⚠️ **المحطة دي مالهاش `fields` لأنها قايمة لا نموذج.**
       الجهة ممكن يكون عندها حساب لكل وجه خير (ح-5)، والفورم
       اللي بيسأل «اسم البنك» مرة واحدة بيفترض حسابًا واحدًا ·
       فالحقول اتحوّلت لصفوف في `banks`، وكل صفّ معاه **وثيقة
       الحساب البنكي** إلزامية. */
    key: 'bank',
    label: 'الحسابات البنكية',
    note: 'قاعدة 11 · حساب أو أكتر، وكل حساب لازم وثيقته · واعتماد البنك منفصل عند المراجعة',
    fields: [],
  },
  {
    key: 'docs',
    label: 'المستندات',
    note: 'الإلزام بيتغيّر مع تصنيف الجهة · تلات مستندات إلزامية للتجارية وحدها',
    fields: [],
  },
]

/** أسماء البنوك موحّدة · قاعدة 27 بتمنع حقل نصّ هنا */
export const BANKS = [
  'مصرف الراجحي',
  'البنك الأهلي السعودي',
  'بنك الرياض',
  'البنك السعودي الفرنسي',
  'بنك البلاد',
  'البنك السعودي للاستثمار',
  'بنك الجزيرة',
  'البنك العربي الوطني',
  'مصرف الإنماء',
  'بنك الخليج الدولي',
] as const

/* الحقل اتعرّف فوق بقائمة فاضية عشان `BANKS` معرَّفة تحته ·
   والربط هنا بيمنع نسختين من نفس القايمة */
const bankField = REG_STAGES.find((s) => s.key === 'bank')?.fields[0]
if (bankField) bankField.options = BANKS

/** أسباب رفض الحساب البنكي · سبعة مكوَّدة في النظام العامل */
export const BANK_REJECTS = [
  'الآيبان غير مطابق لاسم الجهة',
  'صورة الآيبان غير واضحة',
  'الحساب مقفل أو موقوف',
  'الحساب باسم شخص لا باسم الجهة',
  'البنك غير معتمد',
  'الآيبان غير صحيح',
  'خطاب البنك منتهي الصلاحية',
] as const

/* ═══════════════════════════════════════════════════════════
   المستندات · والإلزام مشروط بالنوع

   ⚠️ دي أهم تفصيلة اتاخدت من النظام ومش في الوثيقة: الوثيقة
   بتقول «كل المستندات الإلزامية» بلا تفريع، والنظام بيخلّي تلاتة
   منهم **إلزاميين للجهات التجارية وحدها**. فالقائمة بتتحدّث لحظة
   تغيير التصنيف لا عند الإرسال.
   ═══════════════════════════════════════════════════════════ */

export interface RegDoc {
  key: string
  label: string
  /** إلزامي دايمًا */
  req?: boolean
  /** إلزامي للتصنيفات دي وحدها */
  reqFor?: readonly string[]
  /** الحدّ الأقصى بالميجابايت · من النظام العامل */
  maxMb: number
}

export const REG_DOCS: RegDoc[] = [
  { key: 'license', label: 'الترخيص', req: true, maxMb: 64 },
  { key: 'board', label: 'قرار تكليف أعضاء مجلس الإدارة ساري المفعول', req: true, maxMb: 800 },
  { key: 'activity', label: 'ترخيص مزاولة النشاط', reqFor: ['تجارية'], maxMb: 64 },
  { key: 'zakat', label: 'شهادة هيئة الزكاة والدخل', reqFor: ['تجارية'], maxMb: 64 },
  { key: 'vat', label: 'شهادة التسجيل في ضريبة القيمة المضافة', reqFor: ['تجارية'], maxMb: 64 },
  { key: 'governance', label: 'تقرير الحوكمة', maxMb: 64 },
  { key: 'annual', label: 'التقرير السنوي', maxMb: 64 },
  { key: 'auditor', label: 'تقرير المراجع القانوني', maxMb: 64 },
]

/** Is this document mandatory for the entity type currently chosen? */
export const docRequired = (d: RegDoc, type: string): boolean =>
  Boolean(d.req) || Boolean(d.reqFor?.includes(type))

/* ═══════════════════════════════════════════════════════════
   طلبات تجريبية

   ⚠️ الأسماء والتراخيص **وهمية**. اللي حقيقي هو التوزيع: أغلب
   الطلبات بتقف في «بانتظار الاستكمال» لا في «مرفوض» · لأن سبب
   الوقوف في النظام العامل نواقص ملف لا عدم أهلية.
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   الحساب البنكي · ن-1

   ⚠️ **صفّ لا مجموعة حقول.** الجهة عندها حساب لكل وجه خير
   («تحفيظ · تفطير صائم · أضاحي») زي ما مظفر قال في ح-5، والفورم
   اللي فيه `bankName` واحد كان بيفترض حسابًا واحدًا · فاللي عنده
   أربعة كان بيحطّ واحدًا ويبعت الباقي في إيميل.

   ⚠️ **ووثيقة الحساب إلزامية لكل حساب.** الحساب من غير وثيقته
   ما ينفعش يتحقّق منه، والصرف بيقف عنده · فالإلزام هنا بيمنع
   طلبًا ناقصًا يوصل للمراجع أصلًا بدل ما يرجع بملاحظة.
   ═══════════════════════════════════════════════════════════ */
export interface RegBank {
  id: string
  bankName: string
  /** باسم الجهة لا باسم شخص · قاعدة 27 */
  bankHolder: string
  iban: string
  /** وثيقة الحساب البنكي · اسم الملف المرفوع · إلزامية */
  doc?: string
}

export const BANK_DOC_LABEL = 'وثيقة الحساب البنكي'

/** حساب فاضي جديد · الترقيم للمفتاح لا للعرض */
export const emptyBank = (n: number): RegBank => ({
  id: `b${n}`, bankName: '', bankHolder: '', iban: '',
})

export interface BankIssue { key: string; say: string }

/**
 * نواقص الحسابات · دي اللي بتمنع الإرسال لا رأي المساعد.
 *
 * ⚠️ **والآيبان المكرَّر غلط برضو.** حسابان بنفس الآيبان معناهم
 * صفّ اتنسخ وما اتعدّلش · والمراجع بيشوفهم حسابين.
 */
export const bankIssues = (banks: RegBank[]): BankIssue[] => {
  const out: BankIssue[] = []
  if (banks.length === 0) {
    out.push({ key: 'none', say: 'لازم حساب بنكي واحد على الأقل باسم الجهة.' })
    return out
  }
  const seen = new Map<string, number>()
  banks.forEach((b, i) => {
    const at = `الحساب ${i + 1}`
    if (!b.bankName) out.push({ key: `${b.id}-name`, say: `${at}: اختار البنك.` })
    if (!b.bankHolder.trim()) out.push({ key: `${b.id}-holder`, say: `${at}: اسم صاحب الحساب ناقص.` })
    const iban = b.iban.replace(/\s/g, '')
    if (!iban) out.push({ key: `${b.id}-iban`, say: `${at}: الآيبان ناقص.` })
    else if (!/^SA\d{22}$/i.test(iban)) {
      out.push({ key: `${b.id}-ibanbad`, say: `${at}: الآيبان لازم SA ويليه ٢٢ رقمًا.` })
    } else {
      const before = seen.get(iban.toUpperCase())
      if (before !== undefined) {
        out.push({ key: `${b.id}-dup`, say: `${at}: نفس آيبان الحساب ${before + 1}.` })
      } else seen.set(iban.toUpperCase(), i)
    }
    if (!b.doc) out.push({ key: `${b.id}-doc`, say: `${at}: ${BANK_DOC_LABEL} مطلوبة.` })
  })
  return out
}

export interface RegRequest {
  id: string
  name: string
  type: string
  licensor: string
  region: string
  city: string
  licenseNo: string
  foundedAt: string
  licenseEndsAt: string
  boardEndsAt: string
  mobile: string
  email: string
  directorName: string
  clerkName: string
  clerkMobile: string
  clerkEmail: string
  /** إقرار الجهة لا تقييمنا · نوتة ن-2 */
  governanceClaim: number
  /** نوع الشراكة · الجاي من البوّابة بياخد «مستفيد» ومش بيشوف الحقل */
  partner: PartnerKind
  /** حسابات الجهة · واحد على الأقل · ن-1 */
  banks: RegBank[]
  /** بريد حساب البوّابة · ن-2 · وبيه بتفتح على طلبها */
  acctEmail: string
  /** مفاتيح المستندات المرفوعة */
  docs: string[]
  state: RegState
  submittedAt: string
  decidedAt?: string
  /** ملاحظة إدارية · إلزامية مع الإعادة والرفض · قاعدة 31 */
  note?: string
  /** الجهة اللي اتولدت بعد الاعتماد · قاعدة 2 */
  entityId?: string
  /** أيام المراجعة · بيغذّي المؤشر 4 */
  reviewDays?: number
}

const req = (
  id: string,
  name: string,
  type: string,
  licensor: string,
  region: string,
  city: string,
  licenseNo: string,
  state: RegState,
  submittedAt: string,
  docs: string[],
  governanceClaim: number,
  extra: Partial<RegRequest> = {},
): RegRequest => ({
  id,
  name,
  type,
  licensor,
  region,
  city,
  licenseNo,
  foundedAt: '2019-04-02',
  licenseEndsAt: '2029-04-01',
  boardEndsAt: '2027-03-15',
  mobile: '9665XXXXXXXX',
  email: `reg-${id}@example.org`,
  directorName: 'عبدالله المطيري',
  clerkName: 'سارة القحطاني',
  clerkMobile: '9665XXXXXXXX',
  clerkEmail: `clerk-${id}@example.org`,
  governanceClaim,
  partner: PORTAL_KIND,
  /* ⚠️ آيبان مموّه · ده نموذج في ريبو مفتوح، ومفيش داعي لرقم
     يشبه الحقيقي */
  banks: [
    { id: 'b1', bankName: 'مصرف الراجحي', bankHolder: name, iban: 'SA00 0000 0000 0000 0000 0000', doc: 'وثيقة-الحساب.pdf' },
  ],
  acctEmail: `reg-${id}@example.org`,
  docs,
  state,
  submittedAt,
  ...extra,
})

const ALL_DOCS = REG_DOCS.map((d) => d.key)
const NCNP = LICENSORS[0]
const AWQAF = LICENSORS[1]
const HRSD = LICENSORS[4]
const TRADE = LICENSORS[3]

export const regRows: RegRequest[] = [
  req('RG-1041', 'جمعية إحسان للرعاية الصحية', 'جمعية أهلية', HRSD, 'الرياض', 'الخرج', '1004412', 'review', '2026-09-08', ['license', 'board', 'annual'], 0),
  req('RG-1040', 'مؤسسة نماء الوقفية', 'وقفية', AWQAF, 'القصيم', 'بريدة', '1004398', 'review', '2026-09-06', ['license', 'board', 'governance', 'annual'], 78),
  req('RG-1039', 'شركة تمكين للاستشارات التنموية', 'تجارية', TRADE, 'الرياض', 'الرياض', '1004377', 'completion', '2026-08-30', ['license', 'board', 'activity'], 0, {
    note: 'ناقص شهادة هيئة الزكاة والدخل وشهادة ضريبة القيمة المضافة · إلزاميتان للجهات التجارية.',
  }),
  req('RG-1038', 'جمعية مسارات للتنمية الأسرية', 'جمعية أهلية', HRSD, 'عسير', 'خميس مشيط', '1004360', 'completion', '2026-08-27', ['license'], 55, {
    note: 'قرار تكليف أعضاء المجلس المرفوع منتهي الصلاحية · مطلوب القرار الساري.',
  }),
  req('RG-1037', 'مؤسسة البناء الوقفية بالمدينة', 'مؤسسة أهلية', NCNP, 'المدينة المنورة', 'ينبع', '1004341', 'approved', '2026-08-18', ALL_DOCS, 84, {
    decidedAt: '2026-08-24', entityId: '803', reviewDays: 6,
  }),
  req('RG-1036', 'جمعية كفالة بالجوف', 'جمعية أهلية', HRSD, 'الجوف', 'سكاكا', '1004322', 'approved', '2026-08-11', ALL_DOCS.slice(0, 6), 71, {
    decidedAt: '2026-08-15', entityId: '846', reviewDays: 4,
  }),
  req('RG-1035', 'مركز الأثر للدراسات', 'حكومي', 'أخرى', 'الرياض', 'الرياض', '1004310', 'rejected', '2026-08-04', ['license'], 0, {
    decidedAt: '2026-08-10', reviewDays: 6,
    note: 'الترخيص المرفوع صادر لجهة أخرى · ورقم الترخيص مسجَّل لجهة قائمة بنفس التصنيف (قاعدة 8).',
  }),
  req('RG-1034', 'جمعية عطاء بجازان', 'جمعية أهلية', HRSD, 'جيزان', 'صبيا', '1004288', 'approved', '2026-07-21', ALL_DOCS.slice(0, 7), 63, {
    decidedAt: '2026-07-29', entityId: '774', reviewDays: 8,
  }),
  req('RG-1033', 'جمعية إعمار المساجد بحائل', 'جمعية أهلية', AWQAF, 'حائل', 'حائل', '1004265', 'draft', '2026-09-12', ['license'], 0),
]

export const regRequestById = (id: string): RegRequest | undefined =>
  regRows.find((r) => r.id === id)

/** المستندات الناقصة في الطلب ده · بالتصنيف اللي فيه */
export const regMissingDocs = (r: RegRequest): RegDoc[] =>
  REG_DOCS.filter((d) => docRequired(d, r.type) && !r.docs.includes(d.key))

/** قاعدة 8 · رقم الترخيص ما يتكررش · إلا لو التصنيف مختلف (قاعدة 9) */
export const licenseClash = (
  licenseNo: string,
  type: string,
  known: { name: string; licenseNo: string; type: string }[],
): { name: string; type: string } | null => {
  const hit = known.find((e) => e.licenseNo === licenseNo.trim() && e.type === type)
  return hit ? { name: hit.name, type: hit.type } : null
}

/** المدن التابعة للمنطقة · نفس السلسلة اللي في فلاتر الجهات */
export const citiesOf = (region: string): readonly string[] =>
  CITIES_BY_REGION[region] ?? []

/* ═══════════════════════════════════════════════════════════
   المؤشرات الستة · بند 6 في الإجراء

   المعروض هنا **محسوب من الطلبات** لا مكتوب · فأي تغيير في
   الفكسشر بيتحرّك معاه الرقم، ومحصلش إن مؤشر يقول حاجة والجدول
   تحته يقول غيرها.
   ═══════════════════════════════════════════════════════════ */

export function regKpi() {
  const sent = regRows.filter((r) => r.state !== 'draft')
  const done = regRows.filter((r) => r.state === 'approved' || r.state === 'rejected')
  const approved = regRows.filter((r) => r.state === 'approved')
  const rejected = regRows.filter((r) => r.state === 'rejected')
  const back = regRows.filter((r) => r.state === 'completion')
  const days = done.reduce((s, r) => s + (r.reviewDays ?? 0), 0)
  const share = (n: number) => (sent.length ? Math.round((n / sent.length) * 100) : 0)

  return {
    /** 1 · عدد طلبات التسجيل */
    total: sent.length,
    /** 2 · نسبة المعتمدة */
    approvedPct: share(approved.length),
    /** 3 · نسبة المرفوضة */
    rejectedPct: share(rejected.length),
    /** 4 · متوسط مدة المراجعة */
    avgDays: done.length ? Math.round(days / done.length) : 0,
    /** 5 · نسبة المعادة للاستكمال */
    backPct: share(back.length),
    /** 6 · نسبة اكتمال ملفات الجهات · محسوبة من المرفوع مقابل المطلوب */
    filePct: sent.length
      ? Math.round(
          (sent.reduce((s, r) => {
            const need = REG_DOCS.filter((d) => docRequired(d, r.type)).length
            const have = REG_DOCS.filter(
              (d) => docRequired(d, r.type) && r.docs.includes(d.key),
            ).length
            return s + have / need
          }, 0) /
            sent.length) *
            100,
        )
      : 0,
    open: regRows.filter((r) => r.state === 'review').length,
  }
}
