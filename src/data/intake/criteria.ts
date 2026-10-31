import { CFG, persist, readJson } from '@/lib/config'

/* Evaluation criteria for the supervisor's study (3.2.13 · 3.1.input-5).

   The live system's review form carries twenty weighted criteria and seven yes/no checks; the
   document asks that the criteria be defined in settings, not in code. So the list here is the
   default set, editable from «معايير التقييم», and a study scores each one 1–5 against its
   weight. The weights must sum to 100 — the settings tab refuses to save otherwise. */

/* Batch 7 · approvals#8 · the financial evaluation is its own group (5.2.2) · cost moves there, same weight */
export type CriterionGroup = 'فني' | 'مالي' | 'إداري'
export const GROUP_SAY: Record<CriterionGroup, { study: string; eval: string }> = {
  'فني': { study: 'الفنية', eval: 'الفني' }, 'مالي': { study: 'المالية', eval: 'المالي' }, 'إداري': { study: 'الإدارية', eval: 'الإداري' },
}

export interface Criterion {
  key: string
  label: string
  group: CriterionGroup
  /** Share of the total score · all weights sum to 100 */
  weight: number
  /** Client 30 Oct · the old system's way · the question takes points out of its weight (0–weight)
      instead of a 1–5 rating */
  points?: boolean
}

/* Client 30 Oct (Mozaffar · «حقول دراسة المشروع») · the old system's study questions, each with its
   points · four read in the study's «بيانات المشروع» section, the entity's experience in «الجهة» */
const DEFAULT: { list: Criterion[] } = {
  list: [
    { key: 'idea', label: 'أهمية فكرة المشروع', group: 'فني', weight: 20, points: true },
    { key: 'benNeed', label: 'حاجة المستفيدين للمشروع', group: 'فني', weight: 25, points: true },
    { key: 'studyQ', label: 'جودة دراسة المشروع', group: 'فني', weight: 25, points: true },
    { key: 'costClear', label: 'وضوح وواقعية التكاليف المالية', group: 'مالي', weight: 20, points: true },
    { key: 'entityExp', label: 'خبرة الجهة في مجال المشروع', group: 'إداري', weight: 10, points: true },
  ],
}

/** The earlier 1–5 weighted criteria · a study saved under them keeps its score · a portfolio's study still asks them */
export const LEGACY_CRITERIA: Criterion[] = [
  { key: 'fit', label: 'التوافق مع هدف المجال', group: 'فني', weight: 20 },
  { key: 'need', label: 'وضوح الاحتياج والمشكلة', group: 'فني', weight: 15 },
  { key: 'plan', label: 'جودة خطة التنفيذ والمخرجات', group: 'فني', weight: 15 },
  { key: 'impact', label: 'الأثر المتوقع وقابلية قياسه', group: 'فني', weight: 15 },
  { key: 'cost', label: 'معقولية التكلفة للمستفيد', group: 'مالي', weight: 15 },
  { key: 'capacity', label: 'قدرة الجهة وسجلها السابق', group: 'إداري', weight: 10 },
  { key: 'gov', label: 'الحوكمة واكتمال الوثائق', group: 'إداري', weight: 10 },
]

export const CRITERIA: { list: Criterion[] } = readJson(CFG.criteria, structuredClone(DEFAULT))
/* A file saved before the financial group keeps cost under «إداري» · it moves once, with its weight */
for (const c of CRITERIA.list) if (c.key === 'cost' && c.group === 'إداري') c.group = 'مالي'

export const weightSum = (list: Criterion[]): number => list.reduce((a, c) => a + c.weight, 0)

export const saveCriteria = (list: Criterion[]): void => {
  CRITERIA.list = structuredClone(list)
  persist(CFG.criteria, CRITERIA)
}

/** The most a criterion takes · its points, or 5 on the 1–5 scale */
export const critMax = (c: Criterion): number => (c.points ? c.weight : 5)
/** A criterion's share of its weight, 0–1 */
export const critShare = (c: Criterion, v: number | undefined): number => Math.min(1, Math.max(0, (v ?? 0) / critMax(c)))

/** The list a set of scores was given against · a study saved under the earlier criteria reads by them */
export const criteriaFor = (scores: Record<string, number>, list = CRITERIA.list): Criterion[] => {
  const keys = Object.keys(scores)
  return keys.length && !list.some((c) => keys.includes(c.key)) && LEGACY_CRITERIA.some((c) => keys.includes(c.key)) ? LEGACY_CRITERIA : list
}

/** A portfolio's study keeps the 1–5 questions · the points questions are the project study's */
export const pfCriteria = (): Criterion[] => (CRITERIA.list.some((c) => c.points) ? LEGACY_CRITERIA : CRITERIA.list)

/** Weighted total out of 100 · a criterion not yet scored counts as 0 */
export const studyScore = (scores: Record<string, number>, list = CRITERIA.list): number =>
  Math.round(criteriaFor(scores, list).reduce((a, c) => a + critShare(c, scores[c.key]) * c.weight, 0))
