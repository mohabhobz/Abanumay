import { DateText, Glass, Head, Num, Tag } from '@/components/ui'
import { Link } from 'react-router-dom'
import { CHANNEL_SAY } from '@/data/shared/escRules'
import { NOTIFY_RULES, entityNotices, TOPIC_SAY } from '@/data/shared/notify'

/* The entity's notices on its portal · cross «الإشعارات».

   Every result the foundation sends the entity lands here as well as on the channels the settings
   give it (email, SMS): a registration received, returned, approved or rejected, an update's
   result, a password change, the cycle opening, a decision on its project, an agreement to sign, a
   payment made. The channel tags say where else it went, so «did you get our email» has an answer. */

export function PortalNotices({ name }: { name: string }) {
  const list = entityNotices(name)
  if (!list.length) return null
  return (
    <Glass>
      <Head title="إشعاراتك" meta={<span className="sub"><Num>{list.length}</Num> إشعار</span>} />
      <ul className="xs-notes">
        {list.slice(0, 6).map((n) => (
          <li key={n.id}>
            <b><Link className="tlink" to={n.href}>{n.title}</Link></b>
            {NOTIFY_RULES.channels.entity[n.topic].filter((c) => c !== 'app').map((c) => <Tag key={c} tone="mute">{CHANNEL_SAY[c]}</Tag>)}
            <span className="sub">{TOPIC_SAY[n.topic]} · <DateText>{n.at}</DateText> · {n.context}</span>
          </li>
        ))}
      </ul>
    </Glass>
  )
}
