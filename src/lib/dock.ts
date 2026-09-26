/**
 * Order of decision-bar buttons when a note field is present.
 *
 * The field serves "return" and "reject," so it needs to sit right next
 * to them, not next to the approve button. So the actions that need a
 * note come first (next to the field), and the primary action stays at
 * the end of the row — its usual place in RTL (the left). The order
 * stays fixed whether the field is shown or not, so the buttons don't jump around.
 */
export const noteFirst = <T extends { needsNote?: boolean }>(xs: T[]): T[] => [
  ...xs.filter((x) => x.needsNote),
  ...xs.filter((x) => !x.needsNote),
]
