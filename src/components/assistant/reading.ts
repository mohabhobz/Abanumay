/**
 * A reading — the single unit the assistant uses to talk anywhere in the system.
 * The idea, tried and proven on the project page: the assistant doesn't say "there are 4,929
 * projects," it says "5 projects have passed their department's limit, the longest running 110
 * days" — a sentence with a number, the number's source, and a path to it.
 * For that to work on every screen, three conditions:
 *  1) The reading must be **computed** from the same data the screen shows, never hand-written —
 *  otherwise it will contradict the numbers in front of the user the moment the data changes.
 *  2) The reading changes with the filter. If the user filters to "unassigned," the assistant talks
 *  about that slice, not the whole set.
 *  3) The reading has a **path** (`to`) — clicking it takes you to the rows it's talking about.
 *  That's what makes it a tool, not a banner.
 */

/** A small action next to the reading. */
export interface ReadingAction {
  label: string
  kind?: 'btn-2'
  onClick?: () => void
}

export interface Reading {
  id: string
  /** flag = an issue that calls for a decision. note = an observation that supports the reading. */
  kind: 'flag' | 'note'
  /** Short heading — shown as a tag above the reading in the full view. */
  label?: string
  /**
   * The primary number — shown large before the sentence.
   * A reading whose number sits inside a sentence gets read; one whose number is large and leads
   * gets seen. The sentence after it explains the number rather than repeating it.
   */
  metric?: {
    value: string
    unit: string
    /**
     * ⚠️ The value is an ISO date, rendered as `<DateText>` **after** `unit`, as a sentence ("the
     * license expired on February 25, 2024"). It used to render as "{value} {unit}" like any
     * number, which put the raw date at the start of the sentence.
     */
    date?: boolean
  }
  text: string
  /** Words to highlight — an editorial decision, not a guess from the text. */
  bold?: string[]
  /** Which of them render in red. */
  danger?: string[]
  /** Where the number comes from — without it, the reading is just an opinion. */
  src?: string
  /**
   * Comparison bar: consumed vs. limit.
   * `valueLabel`/`limitLabel` are names without numbers — the renderer adds the number and unit. If
   * the number is also written into the name, it appears twice.
   */
  bar?: {
    value: number
    limit: number
    valueLabel: string
    limitLabel: string
    /** Unit written after the number: "days" or "documents". */
    unit?: string
  }
  actions?: ReadingAction[]
  /** The link that leads to the rows the reading is talking about. */
  to?: string
  /** Link text. */
  toLabel?: string
}
