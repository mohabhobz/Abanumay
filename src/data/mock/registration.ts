/**
 * New entity registration.
 *
 * The single most important rule in this whole flow: no account before approval. What gets created
 * initially is a **request**, not an entity — the entity is generated after approval, and only then
 * is a username sent. So the type here is named `RegRequest`, not `EntityRow`, and its fields are
 * all text exactly as the entity wrote it, not approved values — because a reviewer is reviewing a
 * submission, not a record.
 *
 * That distinction shows up in three places in the UI:
 * · The screen is named "registration request", not "new entity"
 * · The governance score is labeled "entity's self-declaration"
 * · There is no delete button anywhere — only archive or deactivate
 *
 * Source: the spec, and the live system's own `/reg/add` form, read literally. Differences are
 * recorded separately.
 */
import { REG_TYPES, LICENSORS, REGIONS, CITIES_BY_REGION, BANKS as BANK_NAMES, BANK_REJECT_REASONS } from './taxonomy'
import { TONE } from '@/lib/tone'
import { ibanValid } from '@/lib/iban'
import type { Tone } from '@/types/domain'

/* Request states · five.
   Status reads as "who's holding it" rather than "approved/rejected", same as disbursement stages. */

export type RegState = 'draft' | 'review' | 'completion' | 'approved' | 'rejected'

export const REG_STATES: { key: RegState; label: string; who: string }[] = [
  { key: 'draft', label: 'مسودة', who: 'عند الجهة · لم يُرسل بعد' },
  { key: 'review', label: 'قيد المراجعة', who: 'عند مسؤول النظام' },
  { key: 'completion', label: 'بانتظار الاستكمال', who: 'أُعيد إلى الجهة مع ملاحظات' },
  { key: 'approved', label: 'معتمد', who: 'أُنشئت الجهة وأُرسلت بيانات الدخول' },
  { key: 'rejected', label: 'مرفوض', who: 'مؤرشف مع سبب الرفض · قاعدة 28' },
]

export const REG_STATE_SAY: Record<RegState, string> =
  Object.fromEntries(REG_STATES.map((s) => [s.key, s.label])) as Record<RegState, string>

export const REG_STATE_WHO: Record<RegState, string> =
  Object.fromEntries(REG_STATES.map((s) => [s.key, s.who])) as Record<RegState, string>

export const REG_TONE: Record<RegState, Tone> = {
  draft: TONE.draft,
  review: TONE.review,
  completion: TONE.returned,
  approved: TONE.done,
  rejected: TONE.rejected,
}

/* Partnership type · the real difference between the two entry points.

   The difference between "the entity registers itself" and "we register it" isn't the form layout,
   it's one field. Field control differs: an entity registering itself never sees this field — it's
   set automatically in the database.

   An entity coming from the portal defaults to beneficiary partner, which makes sense: it's
   requesting a grant. One registered internally can be an implementer or a strategic partner, like
   a government platform managing its own portfolio.

   The type isn't just a label, it's a key for conditions

   A platform like this may never access our platform at all: the grants officer adds it as an
   entity, creates the project, manages it entirely internally, and handles payments — with no
   agreement. So the type opens and closes steps in other actions; it doesn't just color a badge in
   a table.

   That's why each type here carries what it unlocks, and the screen shows it at selection time, not
   after. */

export type PartnerKind = 'beneficiary' | 'implementer' | 'strategic'

export interface PartnerKindDef {
  key: PartnerKind
  label: string
  /** What changes in the system when this type is selected */
  opens: string[]
  /** Where it's registered from · the public portal or internally */
  from: 'portal' | 'internal' | 'both'
  example: string
}

export const PARTNER_KINDS: PartnerKindDef[] = [
  {
    key: 'beneficiary',
    label: 'شريك مستفيد',
    from: 'portal',
    example: 'الجمعيات والمؤسسات التي تتقدّم بمشاريع',
    opens: [
      'تتقدّم بمشاريعها من بوابة المنح',
      'يمرّ المشروع بدورة الاعتماد كاملة',
      'الاتفاقية إلزامية قبل أي صرف',
    ],
  },
  {
    key: 'implementer',
    label: 'شريك منفّذ',
    from: 'internal',
    example: 'جهة تنفّذ مشروعًا بتكليف مباشر',
    opens: [
      'لا تدخل النظام · يدير مشرف المنح مشروعها داخليًا',
      'يُنشأ المشروع داخليًا لا من بوابة الجهة',
      'لا توجد اتفاقية · تُصرف الدفعات مباشرةً',
    ],
  },
  /* Meeting 1 Oct (items A-3, B-2): the strategic partner is the third legal persona — an entity
     such as Ihsan that manages a portfolio. It never registers from the portal; the grants
     supervisor adds it here. Unlike the implementer it has its own login, under the role
     «الشريك الاستراتيجي»: it sees and feeds its own portfolios and decides nothing. */
  {
    key: 'strategic',
    label: 'شريك استراتيجي · مدير محفظة',
    from: 'internal',
    example: 'منصة إحسان · تدير محفظة مشاريع',
    opens: [
      'لا تتقدّم من البوابة · يضيفها مشرف المنح من الداخل',
      'تدير محفظة مشاريع فرعية بمبلغ إجمالي واحد',
      'لمنسّقها حساب بدور «الشريك الاستراتيجي» · يرى محافظه وحدها',
      'اتفاقية واحدة للمحفظة · بلا اتفاقية لكل مشروع فرعي',
    ],
  },
]

export const partnerKind = (k: PartnerKind): PartnerKindDef =>
  PARTNER_KINDS.find((x) => x.key === k) ?? PARTNER_KINDS[0]

/** An entity coming from the portal never sees this field · it's set automatically */
export const PORTAL_KIND: PartnerKind = 'beneficiary'

/* Acceptance criteria · from the live system's `/reg` portal.

   Not in the spec. Included here because it's an eligibility filter: an entity outside the country
   or with no bank account finds out before spending twenty minutes on a form destined for
   rejection. */

export const REG_TERMS = [
  'أن تكون الجهة داخل المملكة العربية السعودية',
  'أن تكون مرخّصة نظاميًا من جهة إشراف معتمدة',
  'أن يكون لها حساب بنكي خاص باسمها',
  'أن تلتزم بالتسجيل واستكمال البيانات والمستندات المطلوبة',
  'أن تكون سليمة قانونيًا وإداريًا وماليًا',
] as const

/* Fields · the form splits into logical stages.

   This grouping already exists in the live system — the `/reg/add` page has a "Vertical Tabs"
   marker. What changed here is that the fifth tab (bank account) was added by a separate rule
   rather than by the live system, since the live system defers banking to a different action. */

export type FieldKind = 'text' | 'tel' | 'email' | 'date' | 'select' | 'number' | 'iban' | 'password' | 'digits' | 'url'

export interface RegField {
  key: string
  label: string
  kind: FieldKind
  req?: boolean
  /** A hint taken verbatim from the live system, where one exists */
  hint?: string
  /** A closed list · required specifically for bank names */
  options?: readonly string[]
  /** Options depend on another field's value · like city and region */
  dependsOn?: string
  /**
   * Starts a new row in the grid.
   *
   * Fields that are read together must appear together. Region, city, and license number all
   * describe the entity's location and permit, but the grid used to wrap them across two lines
   * (region at the end of one line, city and license number on the next) — so a user would read
   * region alongside "supervising authority", which has nothing to do with it.
   *
   * The marker is on the field, not a column count on the step, because the grid is responsive: the
   * number of columns changes with viewport width, and the start point needs to stay right here
   * regardless of that count.
   */
  nl?: boolean
  /**
   * The field takes the full row.
   *
   * "Technical supervising authority" has a name longer than a column. The full name was getting
   * truncated with an ellipsis in a four-column field, and users couldn't tell which option they'd
   * picked. Since it takes the full row, the row after it starts clean — region, city, and license
   * number sit together with no dead space before them.
   */
  wide?: boolean
}

export interface RegStage {
  key: string
  label: string
  note: string
  fields: RegField[]
  /**
   * This station has its own screen outside the form.
   *
   * This isn't a navigation detail, it's a difference in the step's nature. The entity's account
   * isn't data inside a request — it's the account the request is saved under and that its owner
   * returns to. Placing it as a step inside the form implied it was like "dates" or "documents", so
   * the entity would see a "3 missing" badge on something it hadn't even entered yet.
   *
   * So the station stays in the stepper (so the entity sees it as passed) and is removed from the
   * form: the form starts from the step after it, and its own status is always "done", since
   * reaching the form at all requires going through it.
   */
  own?: true
}

/**
 * Entity account · stored outside the form because its screen is outside the form.
 *
 * This is a mock; in the real system this is an actual account created on the backend that returns
 * a token. Here the value is held in memory so the review page can show the email the request was
 * saved under.
 */
export const regAccount: { email: string } = { email: '' }

export const setRegAccount = (email: string): void => {
  regAccount.email = email.trim()
}

/** Technical supervising authority · 21 in the system; the full list is still pending */
const SUPERVISORS = [...LICENSORS, 'لا يوجد'] as const

export const REG_STAGES: RegStage[] = [
  {
    /* Entity account · the first station.

       Before the form, not after, because requests get interrupted. The license file, board mandate
       expiry date, and IBAN aren't things a user has memorized — they start, go find a document,
       and come back. The account is what makes coming back possible: without it, closing the page
       loses everything typed so far.

       This isn't a contradiction of the no-account-before-approval rule: this account is scoped to
       the entity's own request — it sees one request and its status, nothing more. The full entity
       account is still only generated after approval, as the rule states. */
    key: 'account',
    own: true,
    label: 'حساب الجهة',
    note: 'البريد الإلكتروني وكلمة المرور · لحفظ الطلب والعودة إليه، ومتابعة حالته بعد الإرسال',
    fields: [
      { key: 'acctEmail', label: 'البريد الإلكتروني', kind: 'email', req: true, hint: 'تصل إليه جميع الإشعارات' },
      { key: 'acctPass', label: 'كلمة المرور', kind: 'password', req: true, hint: '8 أحرف على الأقل' },
      { key: 'acctPass2', label: 'تأكيد كلمة المرور', kind: 'password', req: true },
    ],
  },
  {
    key: 'id',
    label: 'التعريف',
    note: 'الاسم والترخيص · بهما تُثبت هوية الجهة، ويُطابَقان مع التصريح',
    fields: [
      { key: 'name', label: 'اسم الجهة', kind: 'text', req: true, hint: 'مطابق للتصريح' },
      { key: 'type', label: 'تصنيف الجهة', kind: 'select', req: true, options: REG_TYPES },
      /* Required, per the client's live screens — it used to be optional on our side. The opposite
         is true of city: optional for them, required for us, kept required on purpose: geographic
         distribution feeds reports and indicators, and an empty city would leave rows with no city
         in every regional report (a deliberate decision, not an oversight). */
      { key: 'licensor', label: 'جهة الإشراف الفني', kind: 'select', req: true, options: SUPERVISORS, wide: true },
      { key: 'region', label: 'المنطقة', kind: 'select', req: true, options: REGIONS, nl: true },
      { key: 'city', label: 'المحافظة / المدينة', kind: 'select', req: true, dependsOn: 'region' },
      { key: 'licenseNo', label: 'رقم الترخيص', kind: 'digits', req: true },
    ],
  },
  {
    key: 'dates',
    label: 'التواريخ',
    note: 'انتهاء أيٍّ من التاريخين الأخيرين يوقف التعاقد · القاعدتان 18 و19 في إجراء التحديث',
    fields: [
      { key: 'foundedAt', label: 'تاريخ التأسيس', kind: 'date', req: true },
      { key: 'licenseEndsAt', label: 'تاريخ نهاية الترخيص', kind: 'date', req: true },
      { key: 'boardEndsAt', label: 'تاريخ انتهاء تكليف أعضاء المجلس', kind: 'date', req: true },
    ],
  },
  {
    key: 'contact',
    label: 'الاتصال والأشخاص',
    note: 'يصل اسم المستخدم إلى مدخل البيانات بعد الاعتماد · خطوة 15',
    fields: [
      { key: 'phone', label: 'الهاتف', kind: 'tel' },
      { key: 'mobile', label: 'جوال الجهة', kind: 'tel', req: true },
      { key: 'email', label: 'البريد الإلكتروني للجهة', kind: 'email', req: true },
      { key: 'website', label: 'الموقع الإلكتروني', kind: 'url' },
      { key: 'directorName', label: 'اسم المدير التنفيذي', kind: 'text', req: true },
      { key: 'directorMobile', label: 'جوال المدير التنفيذي', kind: 'tel', req: true },
      { key: 'clerkName', label: 'اسم مدخل البيانات', kind: 'text', req: true },
      { key: 'clerkMobile', label: 'جوال مدخل البيانات', kind: 'tel', req: true },
      { key: 'clerkEmail', label: 'البريد الإلكتروني لمدخل البيانات', kind: 'email', req: true },
    ],
  },
  {
    /* Accounts, not an account.

       This station has no `fields` because it's a list, not a form. An entity may have one account
       per cause, and a form that asks for "bank name" once assumes a single account — so the fields
       became rows in `banks`, each row carrying its own mandatory bank account document. */
    key: 'bank',
    label: 'الحسابات البنكية',
    note: 'قاعدة 11 · حساب واحد أو أكثر، ولكل حساب وثيقته · ويُعتمد الحساب البنكي منفصلًا عند المراجعة',
    fields: [],
  },
  {
    key: 'docs',
    label: 'المستندات',
    note: 'تختلف المستندات الإلزامية باختلاف تصنيف الجهة · ثلاثة منها إلزامية للشركات غير الربحية وحدها',
    fields: [],
  },
]

/**
 * Form steps · excludes the one with its own screen outside it.
 *
 * The stepper is built from the full set of registration stages (so the entity sees the station it
 * has passed), and the form is built from this subset — both come from the same source so they
 * can't drift apart.
 */
/* The partner's own access · shown only when registering a strategic partner (meeting 1 Oct, B-2).
   No password here: the supervisor never sets a credential for someone else. The coordinator gets an
   invitation by email and sets their own password on first sign-in. */
export const PARTNER_ACCESS_STAGE: RegStage = {
  key: 'access',
  label: 'حساب الشريك',
  note: 'منسّق الشريك يدخل النظام بدور «الشريك الاستراتيجي» · تصله دعوة بالبريد ويضع كلمة مروره بنفسه',
  fields: [
    /* Re-audit 7 Oct · the portfolio's name and value were asked here and kept nowhere · a portfolio
       is its own request now (13.2.2), opened by the partner or the supervisor after approval */
    { key: 'coordName', label: 'اسم المنسّق', kind: 'text', req: true, nl: true },
    { key: 'coordEmail', label: 'بريد المنسّق', kind: 'email', req: true, hint: 'تصل إليه دعوة الدخول' },
    { key: 'coordMobile', label: 'جوال المنسّق', kind: 'tel', req: true },
  ],
}

export const FORM_STAGES: RegStage[] = REG_STAGES.filter((s) => !s.own)

/** The first step that's actually filled in · where the form starts */
export const FIRST_FORM_STAGE = FORM_STAGES[0].key

/** Bank names are standardized · a closed list rules out a free-text field here */
export const BANKS = BANK_NAMES

/* The field is defined above with an empty list on purpose, since `BANKS` is defined below it —
   this linking prevents two copies of the same list */
const bankField = REG_STAGES.find((s) => s.key === 'bank')?.fields[0]
if (bankField) bankField.options = BANKS

/** Bank account rejection reasons · the same seven coded values as the entity file (2.4.27) */
export const BANK_REJECTS = BANK_REJECT_REASONS

/** Registration rejection reasons · coded, so the indicator «rejected for incorrect data or
    documents» counts a reason picked by the reviewer, not a guess from the wording of the note
    (BPD-002 · 2.8.4 · re-audit 7 Oct) */
export const REG_REJECT_REASONS = [
  { key: 'data', label: 'عدم صحة البيانات أو الوثائق' },
  { key: 'terms', label: 'عدم استيفاء ضوابط القبول' },
  { key: 'dup', label: 'جهة مسجّلة سابقًا' },
  { key: 'other', label: 'سبب آخر' },
] as const
export type RegRejectReason = (typeof REG_REJECT_REASONS)[number]['key']

/* Documents · requirement is conditional on entity type.

   The most important detail taken from the live system rather than the spec: the spec says "all
   required documents" with no branching, while the system makes three of them required for
   non-profit companies only. So the list updates the moment the classification changes, not at
   submission. */

export interface RegDoc {
  key: string
  label: string
  /** Always required */
  req?: boolean
  /** Required for these classifications only */
  reqFor?: readonly string[]
  /** Maximum size in megabytes */
  maxMb: number
}

/**
 * Maximum attachment size for registration · 5 MB.
 *
 * This figure comes from the client's live screens, not the live system. What the live system
 * exposed was 64 MB for seven documents and 800 MB for the board decision — and the latter is an
 * odd number to begin with (800 MB for a mandate decision?). The client's upload screen states a 5
 * MB maximum for every document without exception.
 *
 * Written in one place on purpose — it used to be duplicated eight times, so changing it meant
 * eight edits, and a missed one left a document with a different limit than its neighbors for no
 * reason.
 */
export const DOC_MAX_MB = 5

export const REG_DOCS: RegDoc[] = [
  { key: 'license', label: 'الترخيص', req: true, maxMb: DOC_MAX_MB },
  { key: 'board', label: 'قرار تكليف أعضاء مجلس الإدارة ساري المفعول', req: true, maxMb: DOC_MAX_MB },
  { key: 'activity', label: 'ترخيص مزاولة النشاط', reqFor: ['شركة غير ربحية'], maxMb: DOC_MAX_MB },
  { key: 'zakat', label: 'شهادة هيئة الزكاة والدخل', reqFor: ['شركة غير ربحية'], maxMb: DOC_MAX_MB },
  { key: 'vat', label: 'شهادة التسجيل في ضريبة القيمة المضافة', reqFor: ['شركة غير ربحية'], maxMb: DOC_MAX_MB },
  { key: 'governance', label: 'تقرير الحوكمة', maxMb: DOC_MAX_MB },
  { key: 'annual', label: 'التقرير السنوي', maxMb: DOC_MAX_MB },
  { key: 'auditor', label: 'تقرير المراجع القانوني', maxMb: DOC_MAX_MB },
]

/** Is this document mandatory for the entity type currently chosen? */
export const docRequired = (d: RegDoc, type: string): boolean =>
  Boolean(d.req) || Boolean(d.reqFor?.includes(type))

/**
 * Reference number format · `REQ-YYYY-NNNNNN`.
 *
 * This format comes from the client's live screens — ours used to be `RG-1039`, theirs is
 * `REQ-2026-947124`: a clearer prefix, the year embedded in the number, and six sequential digits.
 * The embedded year isn't decoration — it's what lets a request be identified from its number alone
 * in a phone call, without opening a screen.
 *
 * The entity reads and repeats this number, so it gets a copy button everywhere it's shown to the
 * entity (`CopyId`) — fourteen characters are easy to mistype by eye.
 */
export const REQ_ID_SHAPE = 'REQ-YYYY-NNNNNN'

/* Sample requests.

   Names and licenses are fictional. What's real is the distribution: most requests sit in "pending
   completion" rather than "rejected", since in the live system the usual cause is missing
   documents, not ineligibility. */

/* Bank account.

   A row, not a group of fields. An entity has one account per cause ("memorization", "iftar",
   "sacrifices"), and a form with a single `bankName` field assumed one account — so an entity with
   four accounts would enter one and send the rest by email.

   The account document is required for every account. An account without its document can't be
   verified, and disbursement stops there — so requiring it here keeps an incomplete request from
   ever reaching a reviewer, instead of having it bounce back with a note. */
export interface RegBank {
  id: string
  bankName: string
  /** In the entity's name, not a person's · a bank-name standardization rule */
  bankHolder: string
  /**
   * Short account label.
   *
   * A required field on the client's live screens that we didn't have. Its exact meaning isn't
   * settled: the closest interpretation is that it's the name the account is identified by in
   * statements, instead of the long official name, which fits with the one-account-per-cause
   * pattern ("memorization", "iftar", "sacrifices"). This is still an open question with the
   * client, and the on-screen hint states this interpretation explicitly so the entity isn't left
   * guessing.
   */
  shortName: string
  iban: string
  /** Bank account document · uploaded file name · required */
  doc?: string
}

export const BANK_DOC_LABEL = 'وثيقة الحساب البنكي'

/** A new empty account · numbering is for the key, not for display */
export const emptyBank = (n: number): RegBank => ({
  id: `b${n}`, bankName: '', bankHolder: '', shortName: '', iban: '',
})

export interface BankIssue { key: string; say: string }

/**
 * Account gaps · these block submission, not the assistant's opinion.
 *
 * A duplicate IBAN counts as a gap too: two accounts with the same IBAN mean a copied row that was
 * never edited, and a reviewer would see them as two accounts.
 */
export const bankIssues = (banks: RegBank[]): BankIssue[] => {
  const out: BankIssue[] = []
  if (banks.length === 0) {
    out.push({ key: 'none', say: 'أضف حسابًا بنكيًا واحدًا على الأقل باسم الجهة.' })
    return out
  }
  const seen = new Map<string, number>()
  banks.forEach((b, i) => {
    const at = `الحساب ${i + 1}`
    if (!b.bankName) out.push({ key: `${b.id}-name`, say: `${at}: اختر البنك.` })
    if (!b.bankHolder.trim()) out.push({ key: `${b.id}-holder`, say: `${at}: أدخل اسم صاحب الحساب.` })
    /* Required on the client's side · counted among submission gaps like any other, since a field
       labeled required that doesn't actually block submission isn't really required */
    if (!b.shortName.trim()) out.push({ key: `${b.id}-short`, say: `${at}: أدخل الاسم المختصر للحساب.` })
    const iban = b.iban.replace(/\s/g, '')
    if (!iban) out.push({ key: `${b.id}-iban`, say: `${at}: أدخل رقم الآيبان.` })
    else if (!/^SA\d{22}$/i.test(iban)) {
      out.push({ key: `${b.id}-ibanbad`, say: `${at}: أدخل رقم آيبان يبدأ بـSA ويليه 22 رقمًا.` })
    } else if (!ibanValid(iban)) {
      /* 2.4.6 · the shape is right but the check digits aren't · a digit was mistyped */
      out.push({ key: `${b.id}-ibansum`, say: `${at}: رقم الآيبان غير صحيح · خانتا التحقّق لا تطابقان بقية الرقم.` })
    } else {
      const before = seen.get(iban.toUpperCase())
      if (before !== undefined) {
        out.push({ key: `${b.id}-dup`, say: `${at}: الآيبان مطابق لآيبان الحساب ${before + 1}. تحقّق منه.` })
      } else seen.set(iban.toUpperCase(), i)
    }
    if (!b.doc) out.push({ key: `${b.id}-doc`, say: `${at}: يلزم رفع ${BANK_DOC_LABEL}.` })
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
  /** The entity's self-declaration, not our assessment */
  governanceClaim: number
  /**
   * Partnership type · an entity coming from the portal defaults to "beneficiary" and never sees
   * this field
   */
  partner: PartnerKind
  /** Entity accounts · at least one */
  banks: RegBank[]
  /** Portal account email · used to log in and see its request */
  acctEmail: string
  /** Keys of the uploaded documents */
  docs: string[]
  state: RegState
  submittedAt: string
  decidedAt?: string
  /** Admin note · required on both return and rejection */
  note?: string
  /** The coded rejection reason · the reviewer picks it with the note */
  rejectReason?: RegRejectReason
  /** The entity generated after approval */
  entityId?: string
  /** Days under review · feeds an indicator */
  reviewDays?: number
  /* ── Recorded by the request's own actions (data/entities/store) ── */
  phone?: string
  website?: string
  directorMobile?: string
  /** Every action on the request, oldest first · returns are never overwritten (2.4.3 · 2.4.15) */
  events?: RegEvent[]
  /** Fields the reviewer flagged on a return · the only ones the entity may edit (2.2.14) */
  returnFields?: string[]
  /** Each resubmission is a new version */
  version?: number
  /** Bank decision per account · '' accepted, otherwise one of the coded reasons (2.2.15) */
  bankDecisions?: Record<string, string>
  /** Picked files · name and size, with a legibility warning when one was raised (2.4.5) */
  files?: Record<string, { name: string; size: number; warn?: string }>
  decidedBy?: string
}

export interface RegEvent {
  kind: 'draft' | 'submit' | 'otp' | 'return' | 'resubmit' | 'approve' | 'reject' | 'bank'
  action: string
  by: string
  /** ISO date and time */
  at: string
  note?: string
  fields?: { k: string; v: string }[]
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
  /* An obfuscated IBAN · this is a mock in an open repo, no need for a number resembling a real one */
  banks: [
    { id: 'b1', bankName: 'مصرف الراجحي', bankHolder: name, shortName: 'الحساب العام', iban: 'SA00 0000 0000 0000 0000 0000', doc: 'وثيقة-الحساب.pdf' },
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
  req('REQ-2026-947141', 'جمعية إحسان للرعاية الصحية', 'جمعية أهلية', HRSD, 'الرياض', 'الخرج', '1004412', 'review', '2026-09-08', ['license', 'board', 'annual'], 0),
  req('REQ-2026-947140', 'مؤسسة نماء الوقفية', 'وقف', AWQAF, 'القصيم', 'بريدة', '1004398', 'review', '2026-09-06', ['license', 'board', 'governance', 'annual'], 78),
  req('REQ-2026-947139', 'شركة تمكين للاستشارات التنموية', 'شركة غير ربحية', TRADE, 'الرياض', 'الرياض', '1004377', 'completion', '2026-08-30', ['license', 'board', 'activity'], 0, {
    note: 'تنقص شهادة هيئة الزكاة والدخل وشهادة ضريبة القيمة المضافة · وهما إلزاميتان للشركات غير الربحية.',
  }),
  req('REQ-2026-947138', 'جمعية مسارات للتنمية الأسرية', 'جمعية أهلية', HRSD, 'عسير', 'خميس مشيط', '1004360', 'completion', '2026-08-27', ['license'], 55, {
    note: 'قرار تكليف أعضاء المجلس المرفوع منتهي الصلاحية · يلزم رفع القرار الساري.',
  }),
  req('REQ-2026-947137', 'مؤسسة البناء الوقفية بالمدينة', 'مؤسسة أهلية', NCNP, 'المدينة المنورة', 'ينبع', '1004341', 'approved', '2026-08-18', ALL_DOCS, 84, {
    decidedAt: '2026-08-24', entityId: '803', reviewDays: 6,
  }),
  req('REQ-2026-947136', 'جمعية كفالة بالجوف', 'جمعية أهلية', HRSD, 'الجوف', 'سكاكا', '1004322', 'approved', '2026-08-11', ALL_DOCS.slice(0, 6), 71, {
    decidedAt: '2026-08-15', entityId: '846', reviewDays: 4,
  }),
  req('REQ-2026-947135', 'مركز الأثر للدراسات', 'حكومي', 'أخرى', 'الرياض', 'الرياض', '1004310', 'rejected', '2026-08-04', ['license'], 0, {
    decidedAt: '2026-08-10', reviewDays: 6, rejectReason: 'data',
    note: 'الترخيص المرفوع صادر لجهة أخرى · ورقم الترخيص مسجَّل لجهة قائمة بالتصنيف نفسه (قاعدة 8).',
  }),
  req('REQ-2026-947134', 'جمعية عطاء بجازان', 'جمعية أهلية', HRSD, 'جيزان', 'صبيا', '1004288', 'approved', '2026-07-21', ALL_DOCS.slice(0, 7), 63, {
    decidedAt: '2026-07-29', entityId: '774', reviewDays: 8,
  }),
  req('REQ-2026-947133', 'جمعية إعمار المساجد بحائل', 'جمعية أهلية', AWQAF, 'حائل', 'حائل', '1004265', 'draft', '2026-09-12', ['license'], 0),

  /* Scenario data (meeting 1 Oct, A-6): at least three requests in every state, so each state of
     the procedure can be opened and shown in a workshop — not only the ones the sample happened
     to land on. */
  req('REQ-2026-947142', 'جمعية سواعد للتطوع بتبوك', 'جمعية أهلية', HRSD, 'تبوك', 'تبوك', '1004420', 'draft', '2026-09-14', [], 0),
  req('REQ-2026-947143', 'مؤسسة ريادة الوقفية', 'وقف', AWQAF, 'مكة المكرمة', 'جدة', '1004425', 'draft', '2026-09-15', ['license', 'board'], 40),
  req('REQ-2026-947144', 'جمعية بصيرة لرعاية المكفوفين', 'جمعية أهلية', HRSD, 'المنطقة الشرقية', 'الأحساء', '1004431', 'review', '2026-09-10', ALL_DOCS.slice(0, 6), 66),
  req('REQ-2026-947145', 'جمعية أمان لرعاية الأيتام بنجران', 'جمعية أهلية', HRSD, 'نجران', 'نجران', '1004436', 'completion', '2026-09-02', ['license', 'board'], 48, {
    note: 'القوائم المالية المرفوعة لسنة 2023 · يلزم رفع آخر قوائم مدقّقة.',
  }),
  req('REQ-2026-947146', 'مكتب الخبراء للتدريب', 'شركة ربحية', TRADE, 'الرياض', 'الرياض', '1004440', 'rejected', '2026-08-20', ['license', 'activity'], 0, {
    decidedAt: '2026-08-26', reviewDays: 6, rejectReason: 'terms',
    note: 'الجهة شركة ربحية · ونطاق المنح للجهات غير الربحية وحدها (ضوابط القبول، البند 2).',
  }),
  req('REQ-2026-947147', 'جمعية همم بالباحة', 'جمعية أهلية', HRSD, 'الباحة', 'الباحة', '1004444', 'rejected', '2026-08-14', ['license'], 0, {
    decidedAt: '2026-08-21', reviewDays: 7, rejectReason: 'data',
    note: 'رفض بعد إعادتين للاستكمال لم تُستكمل خلالهما المستندات الإلزامية في المهلة.',
  }),
]

export const regRequestById = (id: string): RegRequest | undefined =>
  regRows.find((r) => r.id === id)

/** Missing documents for this request · based on its classification */
export const regMissingDocs = (r: RegRequest): RegDoc[] =>
  REG_DOCS.filter((d) => docRequired(d, r.type) && !r.docs.includes(d.key))

/** License number can't repeat · unless the classification differs */
export const licenseClash = (
  licenseNo: string,
  type: string,
  known: { name: string; licenseNo: string; type: string }[],
): { name: string; type: string } | null => {
  const hit = known.find((e) => e.licenseNo === licenseNo.trim() && e.type === type)
  return hit ? { name: hit.name, type: hit.type } : null
}

/** Cities under a region · same cascading pattern used in entity filters */
export const citiesOf = (region: string): readonly string[] =>
  CITIES_BY_REGION[region] ?? []

/* The six indicators.

   What's shown here is calculated from the requests, not hardcoded — so any change to the fixture
   moves the number with it, and an indicator never contradicts the table beneath it. */

export function regKpi() {
  const sent = regRows.filter((r) => r.state !== 'draft')
  const done = regRows.filter((r) => r.state === 'approved' || r.state === 'rejected')
  const approved = regRows.filter((r) => r.state === 'approved')
  const rejected = regRows.filter((r) => r.state === 'rejected')
  const back = regRows.filter((r) => r.state === 'completion')
  const days = done.reduce((s, r) => s + (r.reviewDays ?? 0), 0)
  const share = (n: number) => (sent.length ? Math.round((n / sent.length) * 100) : 0)

  return {
    /** 1 · Number of registration requests */
    total: sent.length,
    /** 2 · Approval rate */
    approvedPct: share(approved.length),
    /** 3 · Rejection rate */
    rejectedPct: share(rejected.length),
    /** 4 · Average review duration */
    avgDays: done.length ? Math.round(days / done.length) : 0,
    /** 5 · Rate returned for completion */
    backPct: share(back.length),
    /** 6 · Entity file completion rate · calculated from uploaded vs. required documents */
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
