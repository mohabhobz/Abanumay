/* One clock for the operation logs · re-audit 7 Oct.

   Each module keeps its own log of operations in the browser and replays it at load. Two of them
   act on the same project: the study (intake) and the approval path. Replayed one log after the
   other, a «return to the supervisor» from the approval path landed after the supervisor's own
   resubmission, so a reload sent the project back to the supervisor. Every operation now carries a
   number from this clock, and the two logs replay together in the order things happened.

   In production the server orders the events · this is the browser's stand-in. */

const KEY = 'ab-op-seq'

let seq = (() => {
  try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 }
})()

/** The next number · every recorded operation takes one */
export function nextSeq(): number {
  seq += 1
  try { localStorage.setItem(KEY, String(seq)) } catch { /* storage blocked · order holds for this visit */ }
  return seq
}

export interface Stamped {
  seq?: number
  /** When the action was taken · the date every record it writes carries, the same on every replay */
  at?: string
}

/**
 * Replay several logs as one, in clock order. An operation saved before the clock existed has no
 * number · it keeps its place at the head of its own log, so old saved data replays as it did.
 */
export function replayTogether(logs: { ops: Stamped[]; apply: (o: never) => void }[]): void {
  const all = logs.flatMap((l, li) => l.ops.map((o, i) => ({ o, li, i, apply: l.apply as (o: Stamped) => void })))
  all.sort((a, b) => (a.o.seq ?? 0) - (b.o.seq ?? 0) || a.li - b.li || a.i - b.i)
  for (const x of all) x.apply(x.o)
}
