import { CFG, hydrateRows } from '@/lib/config'

/* Approval matrix · who decides a project by its amount.

   One source for every screen: the settings page edits it, the roles read their financial
   authority from it, and «اليوم» sorts the executive's projects into his own, the executive
   committee's and the board's by it. Before 3 Oct these were three different sets of numbers.

   The grants officer has no row: he recommends and never approves (no financial authority).
   The matrix reads bottom-up: the first level whose cap is at or above the amount decides.
   All caps are assumptions until the foundation confirms its delegation of authority. */
export interface ApprovalRow {
  key: 'manager' | 'exec' | 'committee' | 'board'
  role: string
  /** Up to how much · `null` means no cap above it */
  upTo: number | null
  assumed: boolean
}

export const APPROVAL_MATRIX: ApprovalRow[] = hydrateRows(CFG.approval, [
  { key: 'manager', role: 'مدير المنح', upTo: 250_000, assumed: true },
  { key: 'exec', role: 'المدير التنفيذي', upTo: 500_000, assumed: true },
  { key: 'committee', role: 'اللجنة التنفيذية', upTo: 1_000_000, assumed: true },
  { key: 'board', role: 'مجلس الأمناء', upTo: null, assumed: true },
], 'upTo')

/** Who approves a given amount */
export const approverFor = (amount: number): ApprovalRow =>
  APPROVAL_MATRIX.find((r) => r.upTo === null || amount <= r.upTo) ??
  APPROVAL_MATRIX[APPROVAL_MATRIX.length - 1]

/** A level's cap · `Infinity` for the open top */
export const capOf = (key: ApprovalRow['key']): number =>
  APPROVAL_MATRIX.find((r) => r.key === key)?.upTo ?? Infinity
