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

/* Client 24 Nov (meeting) · the recommendation the average reads as · on the average only, never on
   the shari'a or the deed percent alone · five bands of twenty, the client's names:
     0–20 لا يوصى به · 20–40 لا يوصى به أوليًا · 40–60 يوصى به مبدئيًا · 60–80 يوصى به · 80–100 يوصى به جدًا
   (a band's upper edge belongs to the next one up: 20 reads «لا يوصى به أوليًا») · the projects list
   filters by it, the card and the study say it beside the average */
export const RECOS = [
  { min: 0, label: 'لا يوصى به', tone: 'no' },
  { min: 20, label: 'لا يوصى به أوليًا', tone: 'warn' },
  { min: 40, label: 'يوصى به مبدئيًا', tone: 'mute' },
  { min: 60, label: 'يوصى به', tone: 'teal' },
  { min: 80, label: 'يوصى به جدًا', tone: 'ok' },
] as const
export type Reco = (typeof RECOS)[number]
export const RECO_LABELS: string[] = RECOS.map((r) => r.label)
export const recoOf = (avg: number): Reco => [...RECOS].reverse().find((r) => avg >= r.min) ?? RECOS[0]
