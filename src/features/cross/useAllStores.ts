import { useAgreements } from '@/data/agreements/store'
import { useApprovals } from '@/data/approvals/store'
import { useBudget } from '@/data/budget/store'
import { useClosing } from '@/data/closing/store'
import { useEntityFlow } from '@/data/entities/store'
import { useFlow } from '@/data/intake/flow'
import { usePartners } from '@/data/partners/store'
import { usePayments } from '@/data/payments/store'
import { usePlans } from '@/data/plans/store'

/** The shared pages read every module · subscribe to all of them so an action anywhere re-renders */
export function useAllStores(): void {
  useAgreements(); useApprovals(); useBudget(); useClosing(); useEntityFlow(); useFlow(); usePartners(); usePayments(); usePlans()
}
