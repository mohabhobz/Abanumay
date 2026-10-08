import type { ProjectStatusGroup } from '@/types/domain'
import { entityRows } from './entities'
import { projectRows } from './projects'
import {
  CITIES_BY_REGION, FIELDS_BY_TRACK, GOALS_BY_FIELD, REGIONS, TRACKS,
} from './taxonomy'
import { MONEY_LIMITS, TARGET_GROUPS } from './settings'
import { entityDetail } from './entityDetail'
import { NOUN, countOf } from '@/lib/format'
import { CYCLE, TODAY, addWorkingDays, goalFunded, inPeriod, openFields } from '@/data/intake/cycle'

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
 * Cap on an entity's requests in the intake cycle (3.4.12).
 *
 * Read from settings («الحدود المالية والزمنية» · projectsPerEntity), counted on the requests the
 * entity **submitted inside the current cycle's period** — not on its open projects: the rule
 * limits how many it may send in a period, not how many it runs.
 */
export const entityCap = (): number =>
  MONEY_LIMITS.find((l) => l.key === 'projectsPerEntity')?.value ?? 3

/** @deprecated kept for older imports · the cap now lives in settings */
export const ENTITY_PROJECT_CAP = 3

export const requestsInPeriod = (entityId: string): number =>
  projectRows.filter((p) => p.entityId === entityId && p.submittedAt >= CYCLE.from && p.submittedAt <= CYCLE.to).length

/** Open projects · shown beside the cap as context, no longer what it counts */
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
    const sent = requestsInPeriod(e.id)
    return {
      id: e.id,
      name: e.name,
      open: sent,
      capped: sent >= entityCap(),
      inactive: e.activation !== 'نشط',
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
      /* 11.2.4 · 11.2.5 · 13.2.4 · routing through a partner platform and the project's type · both
         stay open to the supervisor until the approval */
      { key: 'platform', label: 'منصة الشريك', kind: 'select', options: ['بلا منصة', 'منصة إحسان'], hint: 'قرار توجيه الدعم · يُعدَّل أثناء الدراسة' },
      { key: 'ptype', label: 'نوع المشروع', kind: 'select', options: ['مستقل', 'محفظة'], hint: 'للشريك الاستراتيجي وحده · المحفظة تُنشأ في صفحتها' },
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
      /* 3.1.input-2 · the project's own objectives, beyond the goal picked from the taxonomy */
      { key: 'objectives', label: 'الأهداف التفصيلية', kind: 'long', req: true, hint: 'هدف في كل سطر · ثلاثة أهداف على الأقل يُقاس كلٌّ منها' },
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
        /* Re-audit 7 Oct · it promised a priority the system doesn't compute · until the priority rule is decided */
        hint: 'اختياري · تُسجَّل مع الطلب',
      },
    ],
  },
  {
    key: 'when',
    label: 'المدة',
    note: 'قاعدة 13 · تاريخ التنفيذ الفعلي مستقل عن تاريخ التقديم',
    fields: [
      { key: 'startAt', label: 'بداية التنفيذ الفعلي', kind: 'date', req: true, hint: 'يختلف عن تاريخ تقديم الطلب' },
      /* 3.4.30 · the duration is in working days and the end date is computed, not typed */
      { key: 'workDays', label: 'مدة التنفيذ', kind: 'num', req: true, unit: 'يوم عمل', hint: 'تُستبعد العطلة الأسبوعية والإجازات الرسمية' },
      {
        key: 'multiYear', label: 'يمتد لأكثر من سنة مالية', kind: 'select',
        options: ['لا', 'نعم'],
        hint: 'يُتحقَّق منه في الدراسة (الخطوتان 14 و15)',
      },
    ],
  },
]

/** Documents stage key · its content is the upload list, not fields */
export const DOCS_STAGE = 'docs'

/** End of execution · start plus the working days, computed (3.4.13 · 3.4.30) */
export const endOf = (val: PValues): string =>
  val.startAt && Number(val.workDays) > 0 ? addWorkingDays(val.startAt, Number(val.workDays)) : ''

/* Only the domains open in the cycle (3.4.6) · a track with none open isn't offered */
const openTracks = () => TRACKS.filter((t) => (FIELDS_BY_TRACK[t] ?? []).some((f) => openFields().includes(f)))

/** Options for a dependent field · same cascading filter pattern used elsewhere */
export const optionsFor = (f: PFieldDef, parent: string): readonly string[] => {
  if (f.key === 'track') return openTracks()
  if (f.options) return f.options
  if (f.dependsOn === 'track') return (FIELDS_BY_TRACK[parent] ?? []).filter((x) => openFields().includes(x))
  /* 1.4.37 · only the goals an approved budget funds under the domain */
  if (f.dependsOn === 'field') return (GOALS_BY_FIELD[parent] ?? []).filter((g) => goalFunded(parent, g))
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
      say: `قدّمت «${ent.name}» ${countOf(ent.open, NOUN.project)} في هذه الدورة، والحدّ ${countOf(entityCap(), NOUN.project)}. لا يُقبل منها طلب آخر حتى الدورة القادمة.`,
      rule: 'قاعدة 3.4.12',
    })
  }
  if (ent?.inactive) {
    out.push({
      key: 'inactive',
      say: `«${ent.name}» غير نشطة، ولا تُقبل مشاريع من جهة غير نشطة.`,
      rule: 'تسجيل الجهات',
    })
  }

  /* 3.4.8 · 3.4.9 · the entity's own file must be valid when it applies: no expired mandatory
     document and at least one active bank account to receive the grant */
  const er = entityRows.find((e) => e.id === val.entityId)
  if (er && !ent?.inactive) {
    const det = entityDetail(er)
    const expired = det.docs.filter((d) => d.expired)
    if (expired.length) {
      out.push({ key: 'docs-exp', say: `في ملف «${er.name}» ${countOf(expired.length, NOUN.doc)} منتهية الصلاحية (${expired.map((d) => d.name).join('، ')}). تُحدَّث من ملف الجهة قبل التقديم.`, rule: 'قاعدة 3.4.8' })
    }
    if (!det.banks.some((b) => b.status === 'مفعل')) {
      out.push({ key: 'bank', say: `لا يوجد لـ«${er.name}» حساب بنكي مفعّل · يلزم حساب معتمد لاستلام المنحة.`, rule: 'قاعدة 3.4.9' })
    }
  }

  /* The portal accepts requests only inside the cycle's period (3.2.3) */
  if (!inPeriod()) {
    out.push({ key: 'period', say: `فترة التقديم من ${CYCLE.from} إلى ${CYCLE.to} · لا يُقبل طلب جديد خارجها.`, rule: 'قاعدة 3.2.3' })
  }
  if (val.field && !openFields().includes(val.field)) {
    out.push({ key: 'field', say: `مجال «${val.field}» غير مفتوح في هذه الدورة.`, rule: 'قاعدة 3.4.6' })
  }

  if (val.startAt && val.startAt < TODAY) {
    out.push({ key: 'dates', say: 'بداية التنفيذ قبل تاريخ اليوم · اختر تاريخًا قادمًا.', rule: 'قاعدة 3.4.13' })
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
