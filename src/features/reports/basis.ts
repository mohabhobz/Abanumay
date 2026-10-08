import { NOUN, countOf, units } from '@/lib/format'
import type { Basis } from '@/data/kpi'

/**
 * The denominator is written with its unit: "out of 30 projects," not
 * "out of 30."
 *
 * A percentage without its denominator lies: "100%" of one project and
 * of a thousand projects would read identically. The unit also needs to
 * be explicit, or a budget denominator (in riyals) reads as if it were a
 * count of cases.
 *
 * This returns text containing both a number and a word, so it must be
 * wrapped with `isolate`, not `.num`: `.num` isolates the whole element
 * as LTR, which slides the Arabic word to the left of the number ("riyal
 * 73,700,000"). `isolate` isolates only the number, leaving the word in
 * the Arabic sentence flow.
 */
export const basisText = (n: number, basis: Basis): string =>
  basis === 'riyal'
    ? units.riyal(n)
    : basis === 'entity'
      ? units.entity(n, true)
      : basis === 'line'
        ? units.line(n, true)
        : basis === 'source'
          ? units.source(n, true)
          : basis === 'agreement'
            ? countOf(n, NOUN.agreement)
            : basis === 'activity'
              ? countOf(n, NOUN.activity)
              : basis === 'beneficiary'
                ? countOf(n, NOUN.beneficiary)
                : units.project(n, true)
