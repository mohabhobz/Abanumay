import { scheduleOf } from '@/data/payments/store'
import { PAY_SLOT_SAY, payRequestById } from '@/data/mock/disbursements'
import type { PaymentDetail } from '@/data/mock/detail'

/* A project's payments as its «الدفعات» tab reads them · every slot of its schedule whatever its
   state · shared by the project page and the closing page (client 28 Oct) */
export const paymentsOfProject = (projectId: string): PaymentDetail[] =>
  scheduleOf(projectId).map((x) => {
    const r = x.requestId ? payRequestById(x.requestId) : undefined
    const paid = x.state === 'paid'
    /* Batch 2 · the order is issued once the manager passes the request to finance · it read «تمّت»
       on every payment, paid or not */
    return {
      no: x.no, amount: x.amount, date: paid ? r?.paidAt ?? x.legacy?.paidAt ?? x.dueAt : x.dueAt,
      status: paid ? 'مدفوع' : PAY_SLOT_SAY[x.state].label, voucher: paid ? r?.id ?? x.legacy?.voucher : undefined,
      condition: x.condition, basis: x.basis, via: paid ? r?.bank?.name ?? (r ? 'حساب الجهة' : undefined) : undefined, receipt: paid && Boolean(r),
      authorized: paid || r?.state === 'finance', before: paid && !r,
    }
  })
