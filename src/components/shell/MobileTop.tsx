import Logo from '@/assets/LogoColor'
import { AccountMenu } from './AccountMenu'
import type { CurrentUser } from '@/types/domain'

/**
 * Mobile top bar: the logo and avatar that used to be on the rail.
 * The avatar here is the account menu itself, not decoration: it used to be a static image up top
 * with a working copy below in the bottom bar — a user would tap the one on top since it's the
 * expected spot, and nothing would happen. Moving it up frees a slot in a bottom bar that already
 * holds several entries.
 */
export function MobileTop({ user, onSignOut }: { user: CurrentUser; onSignOut?: () => void }) {
  return (
    <div className="mobtop chrome">
      <span className="mark mark-38 logo"><Logo /></span>
      <span className="mobtitle">منح أبانمي</span>
      <AccountMenu user={user} onSignOut={onSignOut} drop />
    </div>
  )
}
