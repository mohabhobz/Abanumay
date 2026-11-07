import type { ProjectRow } from '@/types/domain'
import { flowOf } from './flow'
import { maqasidResult, pctOf, suggestMaqasid, suggestWaqf, waqfResult } from './alignment'

/* Client 7 Nov · the project's two reference links as percents, read from its study (the saved
   evaluation, or the assistant's draft while none is saved) · `avg` is «متوسط الارتباط», the two
   final percents added and halved · it is what the list sorts by when asked */

export interface AlignScore { mq: number; wq: number; avg: number }

export const alignAvg = (mq: number, wq: number): number => Math.round((mq + wq) / 2)

export function alignOf(p: ProjectRow): AlignScore {
  const st = flowOf(p.id).study
  const mq = pctOf(maqasidResult(st?.maqasid ?? suggestMaqasid(p)).final)
  const wq = pctOf(waqfResult(st?.waqf ?? suggestWaqf(p)).final)
  return { mq, wq, avg: alignAvg(mq, wq) }
}

/** Tone for a link percent · the same thresholds as the study's own tags */
export const alignTone = (x: number): 'ok' | 'teal' | 'warn' => (x >= 80 ? 'ok' : x >= 60 ? 'teal' : 'warn')
