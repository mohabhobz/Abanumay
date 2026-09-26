import Logo from '@/assets/LogoColor'
import { NotificationBell } from './Notifications'
import type { CurrentUser } from '@/types/domain'

/**
 * Mobile top bar: logo, product name and the notification bell.
 * The account moved to the bottom bar, where the profile slot also opens the modules that don't
 * fit there, so the header keeps only what is read at a glance.
 */
export function MobileTop({ user }: { user: CurrentUser }) {
  return (
    <div className="mobtop chrome">
      <span className="mark mark-38 logo"><Logo /></span>
      <span className="mobtitle">منح أبانمي</span>
      <NotificationBell user={user} place="top" />
    </div>
  )
}
