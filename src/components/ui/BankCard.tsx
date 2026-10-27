import type { ReactNode } from 'react'

/* Client 27 Oct · «طريقة عرض الكارت البنكي نفسه» · one bank account, drawn as the bank card it is,
   the same component wherever an account shows (the entity's accounts, a registration's accounts,
   a payment's account). The card is read only · what is done to an account (its certificate, its
   edit, its decision) sits under it, the actions on the row's end. Several accounts lay out as a
   grid of cards, two or three to a row, each with its own foot. */

export interface BankCardProps {
  bank: string
  iban: string
  /** The account holder as the bank has it */
  holder: string
  /** What the account is for (its purpose or short name) */
  purpose?: string
  status?: string
  /** Inactive, rejected or disabled · the card greys */
  off?: boolean
  /** The document beside it and the actions on it · under the card */
  children?: ReactNode
  /** Actions · on the foot's end */
  actions?: ReactNode
  /** The account's state on this record (accepted, rejected, the payment's account) · beside the actions */
  tag?: ReactNode
}

/** The IBAN in the card's groups of four */
const groups = (iban: string) => iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

export function BankCard({ bank, iban, holder, purpose, status, off, children, actions, tag }: BankCardProps) {
  return (
    <div className="bankitem">
      {/* Client 27 Oct · laid out like a real bank card: the bank and the account's state on top, the
          chip, the IBAN in groups of four, then the holder and what the account is for */}
      <div className={`bankcard${off ? ' off' : ''}`} role="group" aria-label={`${bank} · ${iban}`}>
        <div className="bankcard-h">
          <b className="bankcard-b">{bank}</b>
          {status && <span className="bankcard-s">{status}</span>}
        </div>
        <div className="bankcard-m">
          <span className="bankcard-chip" aria-hidden="true"><i /><i /><i /></span>
          <svg className="bankcard-nfc" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M15.5 2.5a13 13 0 0 1 0 19" /></svg>
        </div>
        <div className="bankcard-i" dir="ltr">{groups(iban)}</div>
        <div className="bankcard-f">
          <span><span className="bankcard-k">اسم المستفيد</span><b title={holder}>{holder}</b></span>
          {purpose && <span className="bankcard-p"><span className="bankcard-k">الغرض</span><b title={purpose}>{purpose}</b></span>}
        </div>
      </div>
      {(children || actions || tag) && (
        <div className="bankitem-f">
          {children && <div className="bankitem-c">{children}</div>}
          {(actions || tag) && <div className="bankitem-a">{tag}{actions}</div>}
        </div>
      )}
    </div>
  )
}

/** Several accounts · a grid of cards */
export function BankGrid({ children }: { children: ReactNode }) {
  return <div className="bankgrid">{children}</div>
}
