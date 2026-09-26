import type { ProjectStatusGroup } from '@/types/domain'
import { entityRows } from './entities'
import { projectRows } from './projects'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, REGIONS, TRACKS,
} from './taxonomy'
import { TARGET_GROUPS } from './settings'
import { NOUN, countOf } from '@/lib/format'

/* Create project · the most important action in the system, and a screen that was entirely missing.

   There are thousands of projects in the live system, and no way to add one.

   The three rules that shape this screen

   The form is staged. Linked sections, a completion percentage, navigation between stages, and
   draft saving — meaning what's needed isn't a long scrolling form, but stations with a percentage
   that tells the user where they are.

   Actual execution start date is a separate field from the request submission date — two fields,
   not one, and the difference between them shows up in reports later.

   There's a cap on how many projects an entity can submit in a period — so choosing an entity isn't
   just a list, it's a check: an entity that has hit the cap is flagged before the user finishes the
   form.

   The cap is shown, not enforced silently: an entity that has hit the cap stays in the list along
   with the reason, rather than disappearing from it. Disappearing would leave the user hunting for
   an entity they can't find.

   And there's no "completion percentage" for optional fields. The percentage is calculated on
   required fields only — otherwise it could reach 70% while every required field is still missing,
   giving a false sense of progress. */

export type FieldKind = 'text' | 'long' | 'num' | 'date' | 'select' | 'multi'

export interface PFieldDef {
  key: string
  label: string
  kind: FieldKind
  req?: boolean
  hint?: string
  /** Fixed options · or computed from `dependsOn` */
  options?: readonly string[]
  dependsOn?: string
  unit?: string
}

export interface PStageDef {
  key: string
  label: string
  note: string
  fields: PFieldDef[]
}

/**
 * Cap on an entity's projects per period.
 *
 * The number is an assumption — the spec says the cap comes from settings without giving a value,
 * same as the approval thresholds. The screen flags it as an assumption.
 */
export const ENTITY_PROJECT_CAP = 5

/**
 * How many **open** projects this entity has · this is what the cap measures.
 *
 * "Open" means still taking the team's time: in review, in execution, or stalled. Completed and
 * excused projects are done and don't count — the cap is about ongoing work, not the entity's whole
 * history.
 */
const OPEN_GROUPS: ProjectStatusGroup[] = ['في الدراسة', 'في التشغيل', 'متعثر']

export const openProjectsOf = (entityId: string): number =>
  projectRows.filter((p) => p.entityId === entityId && OPEN_GROUPS.includes(p.statusGroup)).length

export interface EntityOption {
  id: string
  name: string
  open: number
  /** Cap reached · stays in the list along with the reason */
  capped: boolean
  /** An inactive entity can't submit · a rule from entity registration */
  inactive: boolean
}

export const entityOptions = (): EntityOption[] =>
  entityRows.map((e) => {
    const open = openProjectsOf(e.id)
    return {
      id: e.id,
      name: e.name,
      open,
      capped: open >= ENTITY_PROJECT_CAP,
      inactive: e.activation !== 'مقبول',
    }
  })

/* Form stations.
   Five, each answering one question: who, what, where, how much, when. This order isn't cosmetic:
   the entity determines the track, the track determines the area, the area determines the goal —
   each step depends on the one before it. */
export const P_STAGES: PStageDef[] = [
  {
    key: 'who',
    label: 'الجهة',
    note: 'الجهة التي تقدّم المشروع · ويُتحقَّق هنا من حدّ مشاريعها قبل أي خطوة أخرى',
    fields: [
      { key: 'entityId', label: 'الجهة المستفيدة', kind: 'select', req: true },
    ],
  },
  {
    key: 'what',
    label: 'تعريف المشروع',
    note: 'الاسم والتصنيف · المجال يتبع المسار، والهدف يتبع المجال',
    fields: [
      { key: 'name', label: 'اسم المشروع', kind: 'text', req: true, hint: 'كما سيظهر في الاتفاقية' },
      { key: 'track', label: 'المسار', kind: 'select', req: true, options: TRACKS },
      { key: 'field', label: 'المجال', kind: 'select', req: true, dependsOn: 'track' },
      { key: 'goal', label: 'الهدف', kind: 'select', req: true, dependsOn: 'field' },
      { key: 'summary', label: 'وصف المشروع', kind: 'long', req: true, hint: 'المشكلة والحل في فقرة واحدة' },
    ],
  },
  {
    key: 'where',
    label: 'النطاق والمستفيدون',
    note: 'مكان التنفيذ والمستفيدون · وعليهما تُبنى تقارير الأثر',
    fields: [
      { key: 'region', label: 'المنطقة', kind: 'select', req: true, options: REGIONS },
      { key: 'city', label: 'المحافظة / المدينة', kind: 'select', req: true, dependsOn: 'region' },
      { key: 'targets', label: 'الفئات المستهدفة', kind: 'multi', req: true, options: TARGET_GROUPS },
      { key: 'reach', label: 'عدد المستفيدين المتوقَّع', kind: 'num', req: true, unit: 'مستفيد' },
    ],
  },
  {
    key: 'money',
    label: 'التمويل',
    note: 'المبلغ المطلوب وتكلفة المستفيد · ويُحدَّد المبلغ المعتمد في الدراسة لا هنا',
    fields: [
      { key: 'amountRequested', label: 'المبلغ المطلوب', kind: 'num', req: true, unit: 'ريال' },
      {
        key: 'selfFund', label: 'مساهمة الجهة', kind: 'num', unit: 'ريال',
        hint: 'اختياري · يرفع أولوية المشروع في الدراسة',
      },
    ],
  },
  {
    key: 'when',
    label: 'المدة',
    note: 'قاعدة 13 · تاريخ التنفيذ الفعلي مستقل عن تاريخ التقديم',
    fields: [
      { key: 'startAt', label: 'بداية التنفيذ الفعلي', kind: 'date', req: true, hint: 'يختلف عن تاريخ تقديم الطلب' },
      { key: 'endAt', label: 'نهاية التنفيذ', kind: 'date', req: true },
      {
        key: 'multiYear', label: 'يمتد لأكثر من سنة مالية', kind: 'select',
        options: ['لا', 'نعم'],
        hint: 'يُتحقَّق منه في الدراسة (الخطوتان 14 و15)',
      },
    ],
  },
]

/** Options for a dependent field · same cascading filter pattern used elsewhere */
export const optionsFor = (f: PFieldDef, parent: string): readonly string[] => {
  if (f.options) return f.options
  if (f.dependsOn === 'track') return FIELDS_BY_TRACK[parent] ?? []
  if (f.dependsOn === 'field') return GOALS_BY_FIELD[parent] ?? []
  if (f.dependsOn === 'region') return CITIES_BY_REGION[parent] ?? []
  return []
}

export type PValues = Record<string, string>

/** Missing required fields in a station · optional ones don't count */
export const shortIn = (st: PStageDef, val: PValues): string[] =>
  st.fields.filter((f) => f.req && !val[f.key]?.trim()).map((f) => f.label)

/**
 * Completion percentage.
 *
 * Based on required fields only. Computing it over all fields would let a user fill in optional
 * fields and see 70% while every required field is still missing — a number that gives false
 * reassurance.
 */
export const completion = (val: PValues): number => {
  const req = P_STAGES.flatMap((s) => s.fields.filter((f) => f.req))
  const done = req.filter((f) => val[f.key]?.trim()).length
  return req.length === 0 ? 0 : Math.round((done / req.length) * 100)
}

/* Validation · rules checked before submission */
export interface PIssue { key: string; say: string; rule: string }

export const projectIssues = (val: PValues): PIssue[] => {
  const out: PIssue[] = []

  const ent = entityOptions().find((e) => e.id === val.entityId)
  if (ent?.capped) {
    out.push({
      key: 'cap',
      say: `لدى «${ent.name}» ${countOf(ent.open, NOUN.project)} مفتوحة، والحدّ ${countOf(ENTITY_PROJECT_CAP, NOUN.project)} في الفترة. اختر جهة أخرى أو انتظر إغلاق أحد مشاريعها.`,
      rule: 'قاعدة 12',
    })
  }
  if (ent?.inactive) {
    out.push({
      key: 'inactive',
      say: `«${ent.name}» غير نشطة، ولا تُقبل مشاريع من جهة غير نشطة.`,
      rule: 'تسجيل الجهات',
    })
  }

  /* Comparing as strings directly · dates here are `yyyy-mm-dd`, so lexical order matches
   chronological order and there's no need for a `Date` object */
  if (val.startAt && val.endAt && val.endAt < val.startAt) {
    out.push({ key: 'dates', say: 'تاريخ نهاية التنفيذ يسبق تاريخ بدايته. عدّل أحد التاريخين.', rule: 'قاعدة 13' })
  }

  const asked = Number(val.amountRequested) || 0
  const reach = Number(val.reach) || 0
  if (asked > 0 && reach > 0) {
    const per = Math.round(asked / reach)
    if (per > 50_000) {
      out.push({
        key: 'per',
        say: `تكلفة المستفيد ${per.toLocaleString('en-US')} ⃁، وهي مرتفعة. راجع عدد المستفيدين أو المبلغ المطلوب.`,
        rule: 'مؤشر الأثر',
      })
    }
  }

  return out
}
