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
}

const DEFAULT: { list: Criterion[] } = {
  list: [
    { key: 'fit', label: 'التوافق مع هدف المجال', group: 'فني', weight: 20 },
    { key: 'need', label: 'وضوح الاحتياج والمشكلة', group: 'فني', weight: 15 },
    { key: 'plan', label: 'جودة خطة التنفيذ والمخرجات', group: 'فني', weight: 15 },
    { key: 'impact', label: 'الأثر المتوقع وقابلية قياسه', group: 'فني', weight: 15 },
    { key: 'cost', label: 'معقولية التكلفة للمستفيد', group: 'مالي', weight: 15 },
    { key: 'capacity', label: 'قدرة الجهة وسجلها السابق', group: 'إداري', weight: 10 },
    { key: 'gov', label: 'الحوكمة واكتمال الوثائق', group: 'إداري', weight: 10 },
  ],
}

export const CRITERIA: { list: Criterion[] } = readJson(CFG.criteria, DEFAULT)
/* A file saved before the financial group keeps cost under «إداري» · it moves once, with its weight */
for (const c of CRITERIA.list) if (c.key === 'cost' && c.group === 'إداري') c.group = 'مالي'

export const weightSum = (list: Criterion[]): number => list.reduce((a, c) => a + c.weight, 0)

export const saveCriteria = (list: Criterion[]): void => {
  CRITERIA.list = structuredClone(list)
  persist(CFG.criteria, CRITERIA)
}

/** Weighted total out of 100 · a criterion not yet scored counts as 0 */
export const studyScore = (scores: Record<string, number>, list = CRITERIA.list): number =>
  Math.round(list.reduce((a, c) => a + ((scores[c.key] ?? 0) / 5) * c.weight, 0))
