/**
 * Data model — derived from the live production system.
 *
 * Every field here has a real counterpart in that system. When the
 * backend delivers its API, it should match this shape, and any
 * mismatch will surface at build time rather than at runtime.
 */

/** Color tone used in badges and indicators. */
export type Tone = 'ok' | 'warn' | 'no' | 'ret' | 'brand' | 'teal' | 'lime' | 'mute'

/** Funding source — the system separates them into independent workflow tracks. */
export type FundingSource = 'foundation' | 'waqf'

/**
 * Workflow stage — the system has 50 stages. These are the most
 * frequent ones in the projects table (18 values across 4,929 projects).
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

/** Grouped status — the system filters by this, only 5 values. */
export type ProjectStatusGroup =
  | 'في الدراسة'
  | 'في التشغيل'
  | 'معتذر عنه'
  | 'متعثر'
  | 'مكتمل'

/** Grant method, as in the system's filter. */
export type GrantMethod = 'بحث واستجابة' | 'ابتكار وإنضاج'

/** Method for transferring the amount to the entity. */
export type TransferMethod = 'حساب الجهة مباشر' | 'عبر منصة إحسان'

/** Standardized decline reasons in the system (9). */
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

/** The eight follow-up types. */
export type FollowUpType =
  | 'التواصل مع الشريك'
  | 'تحديث الاتفاقية'
  | 'تحديث تقرير المشروع'
  | 'منتج معرفي'
  | 'رفع صورة أو فيديو'
  | 'زيارة ميدانية'
  | 'مخاطبات'
  | 'أخرى'

// Entity

/** Entity activation · «نشط» can apply · «غير نشط» lost it to an expired mandatory document (2.4.20) ·
    «معلق (موقوف)» suspended by decision · «ملغى الاعتماد» revoked · «محدث» an update awaits approval (2.3.upd-16) */
export type EntityActivation = 'نشط' | 'غير نشط' | 'معلق (جديد)' | 'معلق (موقوف)' | 'محدث' | 'ملغى الاعتماد' | 'مرفوض'

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
  /** Hijri date as displayed by the system alongside the Gregorian date. */
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
  /** "Not rated" if the entity's file is incomplete. */
  governance: string
  activation?: EntityActivation
  docs: EntityDocument[]
  stats: KeyValue<number>[]
  projects: EntityProjectRef[]
}

// Project

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
 * An entry in the actions log. `hours` against `limit` is the basis
 * for the "action duration exceeded" alert — the system genuinely
 * tracks duration per level (13 duration columns in the projects table).
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
  /** Track → domain → goal — the budget tree. */
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
  /** Project weight, 0–100, as in the system. */
  weight: number
  /** Rating %. */
  score: number

  startDate: string
  durationDays: number

  region: string
  city: string
  beneficiaries: number
  /**
   * The count after the reviewer's check — the system keeps this
   * separate from the entity's own estimate.
   */
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

// Agreements

/**
 * Agreement stage — from the process flowchart and its action steps.
 *
 * This is the agreement's stage, not the project's status. The spec is
 * explicit: an agreement moving between review, approval, or signature
 * stages doesn't affect the project's status, which stays "drafting
 * agreement" until the final agreement is approved. So an agreement can
 * be sitting with the executive director while the project still shows
 * "drafting agreement" — both are correct at once.
 */
export type AgreementStage =
  /** Draft with the grants reviewer — steps 3–11. */
  | 'draft'
  /** Awaiting the grants manager — steps 12–13. */
  | 'manager'
  /** Awaiting the executive director — steps 16–17. */
  | 'executive'
  /** Awaiting the entity's signature — steps 20–21. */
  | 'entity'
  /** Returned for revision — steps 14, 18, 22. */
  | 'returned'
  /** In effect — steps 24–28. */
  | 'active'
  /** Cancelled or finally rejected — Rule 26. */
  | 'cancelled'

export type AgreementKind = 'إلكترونية' | 'ورقية'

/** A payment in the agreement's schedule — Rule 7. */
export interface AgreementPayment {
  no: number
  /** Value in riyals — Rule 8 verifies the total equals the grant value. */
  amount: number
  /** Percentage of the grant — Rule 8 verifies the total equals 100%. */
  share: number
  dueAt: string
  /** Disbursement requirements — linked to reports or deliverables. */
  requirement?: string
}

/** An event in the agreement's audit log — Rule 22. */
export interface AgreementEvent {
  at: string
  who: string
  role: string
  what: string
  note?: string
  /** The action step in the process flowchart. */
  step: number
  /** The notification sent with the transition — Rule 20. */
  notified?: string
  /** The version the event occurred on — Rule 24. */
  version: number
}

export interface AgreementRow {
  id: string
  /** Rule 2 — exactly one project, never more. */
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  /** Rule 3 — set at creation and doesn't change except through a new version. */
  kind: AgreementKind
  /** The approved template — Rule 4 — one of the system's templates. */
  template: string
  stage: AgreementStage
  /** Rule 24 — multiple versions, one in effect. */
  version: number
  /** Grant value — step 11 matches it against the budget's reserved amount. */
  amount: number
  /** The amount actually reserved in the budget — a mismatch blocks submission. */
  reserved: number
  /**
   * Payment schedule — Rule 7, and part of the agreement itself, not an
   * attachment to it.
   */
  payments: AgreementPayment[]
  /** The entity's authorized signatory — an entry in the document. */
  signer: { name: string; title: string }
  /** The responsible grants reviewer. */
  owner: string
  /** Date the project was referred to the drafting-agreement stage — step 1. */
  openedAt: string
  /** Activation date — step 26, if activated. */
  activeAt?: string
  /** Hours spent in the current stage. */
  hoursInStage: number
  /** Note from the last return — Rule 10 requires stating the reason. */
  note?: string
  /** AI output — section 9.5 — Rule 21 makes it advisory only. */
  ai?: string
  /** Audit log — Rule 22. */
  log: AgreementEvent[]
  /** Attachments and appendices — Rule 18. */
  docs: PayDoc[]
}

// Permissions

export type AuthorityKind = 'submit' | 'recommend' | 'approve' | 'final'
export type AuthorityState = 'done' | 'now' | 'pending'

export interface AuthorityRole {
  role: string
  /** null = no cap (submission or final decision). */
  ceiling: number | null
  uplift?: number
  kind?: AuthorityKind
  state: AuthorityState
  note?: string
}

export interface AuthorityMatrix {
  /** Figures are provisional pending confirmation. */
  provisional: boolean
  roles: AuthorityRole[]
}

// User

/* Action ordering: one primary, secondary for the rest, destructive
   gets its own color. `btn-3` (blue) was deliberately removed from
   here — blue in the system describes a status, not a call to action,
   and having it in this type allowed that rule to be violated. */
export type DecisionKind = 'btn-p' | 'btn-2' | 'btn-d'

export interface DecisionAction {
  label: string
  kind: DecisionKind
  /** The decision carries a written note · its reason or its justification (4.2.9 · 5.4.17) */
  needsNote?: boolean
  /** A choice the decision needs before it runs · «يتطلب خطة» or the stage a return goes to */
  choose?: { label: string; options: { value: string; label: string }[] }
  /** Why the action can't run now · shown on the button, which stays visible but locked */
  blocked?: string
}

export interface CurrentUser {
  name: string
  role: string
  initial: string
  photo?: string
  /** null = recommendation-only authority, no financial cap. */
  financialAuthority: number | null
  actions: DecisionAction[]
}

// Assistant insights

export interface Insight {
  text: string
  bold: string[]
  src: string
}

// List rows

/**
 * A row in the projects list — the backbone of 12 fields. The
 * system's table has 62 columns; the rest live on the project page.
 */
export interface ProjectRow {
  /** Under study · the seat it sits at now (meeting 1 Oct, B-5) · `supervisor` when absent */
  holder?: 'supervisor' | 'manager' | 'exec' | 'committee' | 'board' | 'confirm'
  /** Archived request · out of the active lists, kept on record (3.4.27) */
  archived?: boolean
  /** Created on the system · date and time, set automatically (3.4.4) */
  createdAt?: string
  /** Execution window · start chosen by the requester, end computed in working days (3.4.13 · 3.4.30) */
  startAt?: string
  endAt?: string
  id: string
  name: string
  entityId: string
  entityName: string
  track: string
  field: string
  goal: string
  region: string
  city: string
  /** The actual workflow stage, not the group. */
  stage: string
  statusGroup: ProjectStatusGroup
  /** Hours spent in the current stage. */
  hoursInStage: number
  /** Stage threshold in hours — provisional pending confirmation. */
  stageLimit: number
  amountRequested: number
  amountGranted: number
  amountSpent: number
  weight: number
  score: number
  /** null = an unassigned project, which is a quarter of the system. */
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
  /** Project type · regular (default), external, or a portfolio row. */
  type?: ProjectType
  /** Portfolio rows only · the portfolio this row opens. */
  portfolioId?: string
}

/** Project type as shown in the list filter and the identity card. */
export type ProjectType = 'مشروع عادي' | 'مشروع خارجي' | 'محفظة'

/** A row in the entities list — identity plus cumulative performance. */
export interface EntityRow {
  id: string
  name: string
  /**
   * The entity's logo, if uploaded — otherwise the entity's generated
   * icon (`EntityMark`) is shown.
   */
  logo?: string
  licenseNo: string
  type: string
  licensor: string
  region: string
  city: string
  registeredAt: string
  /**
   * License expiry — a value read from the data, not a generated number.
   *
   * It used to be computed as `registeredAt + int(1,6) years`, so an
   * entity registered in 2016 with excellent governance still receiving
   * grants today would show its license expiring in 2019 — ten years with
   * no renewal, contradicting the status written right next to it. This
   * date is read and displayed, never generated.
   */
  licenseEndsAt: string
  activation: EntityActivation
  /** "Not rated" if the entity's file is incomplete. */
  governance: string
  /** Number of documents uploaded, out of 8. */
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
  /** Archived instead of deleted (2.4.28) · out of every list, found only by the archive search (2.4.29) */
  archived?: boolean
  /** May submit project requests · granted on approval (2.2.17 · 2.4.18), lost with activation */
  canApply?: boolean
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
  /** Request number — not the payment number. */
  id: string
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  /** Which payment, out of how many — from the agreement's payment schedule. */
  no: number
  of: number
  /** Payment value approved in the schedule. */
  due: number
  /** Request value — rule 5 caps it at `due`. */
  asked: number
  /** Due date, per the schedule. */
  dueAt: string
  state: PayState
  /** Hours spent in the current stage — feeds the escalation in section 9.5. */
  hoursInState: number
  /** Disbursement condition — rule 6 — empty when the payment carries no condition. */
  condition?: string
  /** Conditions the system verifies before allowing the transition. */
  checks: PayCheck[]
  /** The approved bank — the spec's second deliverable: "the approved bank account." */
  bank: { name: string; active: boolean }
  /** Funding sources — rule 12 distributes the payment across them. */
  sources: { name: string; share: number }[]
  /** AI output — step 6 — rule 20 makes it advisory only. */
  ai?: string
  /** Note from the last return — rules 7 and 8. */
  note?: string
  /** The responsible grants reviewer. */
  owner: string
  /** Date the request was created — step 2. */
  at: string
  /** Transfer date — step 17, only when paid. */
  paidAt?: string

  /* What the single-request page needs. */

  /** The agreement and whether it's in effect — rule 10 checks it before finance. */
  agreement: { id: string; active: boolean; endsAt: string }
  /** The grant's full value — rule 14 caps the total at it. */
  granted: number
  /** Amount spent from the grant before this payment — rule 14. */
  spent: number
  /** Amount reserved for this payment — rule 11, then rule 13 turns it into spent. */
  reserved: number
  /** Attachments — rule 21 keeps them on the request itself. */
  docs: PayDoc[]
  /** Audit log — rule 16 — every transition, with its step number. */
  log: PayEvent[]
}

/** A document attached to the request — rule 21. */
export interface PayDoc {
  name: string
  kind: string
  at: string
  size: string
}

/** An event in the audit log — rule 16 — `step` is its step in the process spec. */
export interface PayEvent {
  at: string
  who: string
  role: string
  what: string
  note?: string
  step: number
  /** The notification sent with the transition — rule 17. */
  notified?: string
}

/* Project implementation plan.

   This is the most serious gap the review found. The spec says, step 1,
   verbatim: "the plan is prepared by the beneficiary entity and
   approved by the grants reviewer and grants manager, for projects that
   require a work plan." In the current system, the "implementation
   plan" is an attachment, not a module — there's no approval cycle and
   no progress tracking.

   The plan is also its own independent process, exactly like the
   agreement. This follows the separation-of-actions principle: "the
   problem is that the system treats the project as a single thing — the
   project is the plan is the agreement is the payment." So the plan
   runs in parallel with the agreement, and its status doesn't change
   the project's status — the same rule as the agreement's Rule 25. */

export type PlanStage =
  /** The entity is writing it — a draft not yet submitted. */
  | 'draft'
  /** With the grants reviewer for review. */
  | 'supervisor'
  /** With the grants manager for approval. */
  | 'manager'
  /** Returned to the entity with comments. */
  | 'returned'
  /** Approved — `Baseline V1` is locked in and implementation has started. */
  | 'active'
  /** All activities accepted — the project is eligible for closing. */
  | 'done'

/**
 * Status of a single activity — Rule 14 separates "the entity says"
 * from "the reviewer accepted."
 */
export type ActivityState =
  /** Not started. */
  | 'todo'
  /** The entity is implementing it. */
  | 'doing'
  /** The entity uploaded evidence and marked it done — not yet counted as completed. */
  | 'claimed'
  /** The reviewer checked and accepted it — only this counts. */
  | 'accepted'
  /** The reviewer rejected the evidence and sent it back. */
  | 'rejected'

/** Evidence uploaded against an activity. */
export interface PlanEvidence {
  id: string
  /** Required evidence type — from the module's settings. */
  kind: string
  fileName: string
  uploadedAt: string
  /** Who uploaded it — usually the entity. */
  by: string
}

/** A note on an activity — with its author's name and timestamp. */
export interface ActivityNote {
  by: string
  /** `YYYY-MM-DDTHH:mm` — the time is part of the information, not decoration. */
  at: string
  say: string
  /**
   * A rejection reason (Rule 14) or a reason added afterward — only the
   * first is tagged.
   */
  kind: 'reject' | 'comment'
  /**
   * The party — determines the bubble color, exactly like the
   * correspondence thread.
   */
  from?: 'staff' | 'entity'
}

export interface PlanActivity {
  id: string
  name: string
  state: ActivityState
  /** Planned dates — locked in along with `Baseline V1`. */
  from: string
  to: string
  /** Actual acceptance date — empty if not yet accepted. */
  doneAt?: string
  /** Evidence types that must be uploaded before an activity can be marked done. */
  needs: string[]
  evidence: PlanEvidence[]
  /**
   * Notes on an activity — a log, not a single line.
   *
   * This used to be `note?: string`: a single line with no author or
   * timestamp, where a second rejection would overwrite the first. The
   * requirement was for a note to be attributed to its author with a
   * timestamp, and for someone else to be able to add to it — meaning
   * this is a short conversation on the activity, and a rejection is only
   * its first line, not the whole thing. Rule 14 requires stating the
   * reason for a rejection, and the log is what keeps that explanation
   * around after the activity is fixed.
   */
  notes?: ActivityNote[]
  /**
   * Activity's weight in the completion percentage — the weights of a
   * phase's activities sum to 100.
   */
  weight: number
}

export interface PlanPhase {
  id: string
  name: string
  from: string
  to: string
  /** Phase cost — the sum of all phases equals the grant value. */
  cost: number
  activities: PlanActivity[]
}

/** A request for a substantive change to an approved plan — Rule 21. */
export interface PlanChange {
  id: string
  at: string
  by: string
  /** What was requested to change, in text. */
  say: string
  state: 'waiting' | 'approved' | 'rejected'
  /** The grants manager's decision and its reason. */
  note?: string
}

export interface PlanRow {
  id: string
  /** One plan per project. */
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  stage: PlanStage
  /**
   * Baseline version number — 1 on first approval, incrementing with
   * each approved change.
   */
  baseline: number
  /** Date the baseline was locked in — empty before approval. */
  baselineAt?: string
  phases: PlanPhase[]
  /** The responsible grants reviewer. */
  owner: string
  /** Who wrote the draft — the entity, or the reviewer on its behalf. */
  drafter: 'entity' | 'supervisor'
  openedAt: string
  hoursInStage: number
  changes: PlanChange[]
  note?: string
}

/* Project closing.

   Two independent cycles, not one. The spec states verbatim: "the final
   report and the project evaluation each go through independent
   approval cycles, with a separate record kept of all comments and
   approval decisions for each." So this type carries both with their
   own logs, and a single `stage` states where we stand across both at once.

   The report is written by the entity, the evaluation by the reviewer.
   This isn't a minor detail of roles: the report is an account from the
   implementer, and the evaluation is a judgment from the funder — their
   source differs, and so does how much weight each carries when read. */

export type CloseStage =
  /**
   * The grants reviewer created the request and sent it to the entity —
   * the entity is writing it.
   */
  | 'draft'
  /** The entity submitted it — with the grants reviewer. */
  | 'supervisor'
  /** With institutional communications — Rule 9 — if media publication is required. */
  | 'comms'
  /** With the grants manager. */
  | 'manager'
  /** With the executive director — their approval closes the report cycle. */
  | 'executive'
  /** The report was approved — the evaluation hasn't started yet (Rule 6). */
  | 'reportDone'
  /** The grants reviewer is writing the evaluation. */
  | 'evalDraft'
  /** The evaluation is with the grants manager. */
  | 'evalManager'
  /** The evaluation is with the executive director. */
  | 'evalExecutive'
  /**
   * Both were approved and the requirements are complete — the project
   * is "complete."
   */
  | 'closed'
  /** Returned with comments — `returnedTo` states to whom. */
  | 'returned'

/** Which cycle this stage belongs to — the two logs are separate (Rule 17). */
export type CloseCycle = 'report' | 'eval'

/**
 * Final report — written by the entity.
 *
 * The minimum required content is stated verbatim in Rule 4: "actual
 * number of beneficiaries, actual budget, implementation duration, and
 * key deliverables and results achieved." These four are mandatory and
 * are compared against what was approved — that comparison is the
 * whole point of this screen.
 */
export interface FinalReport {
  /** Actual number of beneficiaries — compared against the planned figure. */
  beneficiaries: number | null
  /** Actual budget — compared against the grant. */
  budget: number | null
  /** Actual implementation duration, in days. */
  days: number | null
  /** Key deliverables and results. */
  outcomes: string
  /** Challenges and deviations — stated by the implementer themselves. */
  risks: string
  /** Uploaded documents — keys from `CLOSE_DOCS`. */
  docs: string[]
  /**
   * Cloud storage links.
   *
   * Rule 5 states verbatim "approved cloud storage links (such as Google
   * Drive)." The reason is practical: videos and media files exceed any
   * reasonable upload limit. A link isn't a substitute for an attachment
   * — it's another type of one.
   */
  links: { label: string; url: string }[]
}

/**
 * Project evaluation — written by the grants reviewer after the report
 * is approved. It doesn't start before the executive director's
 * approval (Rule 6).
 */
export interface ProjectEval {
  /** Performance indicators — target versus achieved. */
  indicators: { name: string; target: number; actual: number | null; unit: string }[]
  /** Observed impact. */
  impact: string
  /** Lessons learned — feeds into later projects. */
  lessons: string
  /** Overall rating out of 5 — advisory. */
  score: number | null
}

/**
 * A version — Rules 15 and 19: every return creates a new version, and
 * the previous one is kept.
 */
export interface CloseVersion {
  no: number
  at: string
  by: string
  /** Reason for the new version — "returned by the grants manager," for example. */
  say: string
}

/** Audit log — Rule 11 — every review, approval, and edit. */
export interface CloseAudit {
  at: string
  by: string
  what: string
}

export interface CloseRow {
  id: string
  projectId: string
  projectName: string
  entityId: string
  entityName: string
  stage: CloseStage
  /** Who it was returned to — read together with `returned` alone. */
  returnedTo?: CloseStage
  report: FinalReport
  /** Empty until the report is approved (Rule 6). */
  evaluation: ProjectEval | null
  /** Report versions — the first is numbered 1. */
  versions: CloseVersion[]
  /** Evaluation versions — a separate log (Rule 17). */
  evalVersions: CloseVersion[]
  audit: CloseAudit[]
  /** Is media publication required in the agreement? — Rule 9. */
  mediaRequired: boolean
  owner: string
  openedAt: string
  /** Final closing date — set together with `closed`. */
  closedAt?: string
  hoursInStage: number
  /** Most recent return note. */
  note?: string
}
