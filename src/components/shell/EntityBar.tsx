import { useNavigate } from 'react-router-dom'
import { Button, ButtonLink, Icon, icons } from '@/components/ui'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
import { NotificationBell } from './Notifications'

/* Client 9 Nov · the entity's one bar, on every screen it opens.

   The portal drew its own row (the mark, the bell, «تسجيل الخروج») and every other screen an entity
   opens (a new request, its project, its closing) drew a second one, a floating box that the shell
   laid out as a side column · so the menu came and went, the bell moved and changed look, and the
   way back to the portal was a breadcrumb to the staff projects list.

   Now one component, the same row in the same place: the mark and «منح أبانمي · بوابة الجهة» at the
   start, then, at the end, the way back to the portal (on any screen that isn't the portal), the
   bell and the sign-out. It sits above the page and does not scroll with it. */

export interface EntityBarProps {
  /** The entity's (or the applicant's) name · the bell reads its notices by it */
  name: string
  /** The portal's address · given on a screen that isn't the portal, so the bar leads back to it */
  portal?: string
  /** A staff member previewing the portal · no bell and no sign-out of someone else's session */
  preview?: boolean
}

export function EntityBar({ name, portal, preview }: EntityBarProps) {
  const navigate = useNavigate()
  return (
    <div className="ebar">
      <div className="ebar-in">
        <Logo className="mark mark-38" />
        <div className="ebar-id">
          <b>منح أبانمي</b>
          <span className="sub">بوابة الجهة · {name}</span>
        </div>
        <span className="pc-sp" />
        {portal && (
          <ButtonLink variant="2" size="sm" to={portal}>
            <Icon name={icons.chevronBack} size="sm" />
            بوابة الجهة
          </ButtonLink>
        )}
        {!preview && <NotificationBell user={{ name }} entity={name} place="top" />}
        {!preview && (
          <Button variant="2" size="sm" onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}>
            <Icon name={icons.logout} size="sm" />
            تسجيل الخروج
          </Button>
        )}
      </div>
    </div>
  )
}
