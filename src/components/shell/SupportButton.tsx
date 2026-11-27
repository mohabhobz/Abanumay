import { Button, Icon, icons } from '@/components/ui'
import { openSupport, useReports } from '@/data/support'

/* 27 Nov · the support centre's place in the rail · above the bell · its badge counts the reports
   with a reply not read yet · on a phone the rail's foot is hidden, and the account menu carries it */
export function SupportButton({ user }: { user: { name: string } }) {
  const reports = useReports(user.name)
  const unread = reports.filter((r) => r.unread).length
  const label = unread ? `الدعم والبلاغات · ${unread} ردود جديدة` : 'الدعم والبلاغات'
  return (
    <Button plain type="button" className="railitem nbell supbtn" onClick={() => openSupport(unread ? { mine: true } : {})} aria-label={label}>
      <span className="nbell-ic">
        <Icon name={icons.support} />
        {unread > 0 && <b className="nbadge num" aria-hidden="true">{unread}</b>}
      </span>
      <span className="rail-l">الدعم والبلاغات</span>
      <span className="rail-tip">{label}</span>
    </Button>
  )
}
