import { NavLink } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import { Icon, icons, type IconName } from '@/components/ui'
import { NAV } from '@/app/routes'
import { AccountMenu } from './AccountMenu'
import type { CurrentUser } from '@/types/domain'

export interface RailProps {
  user: CurrentUser
  onAssistant: () => void
  assistantOpen: boolean
  onSignOut?: () => void
  /**
   * مفاتيح الصلاحيات اللي المستخدم يملكها.
   * لو مش متبعتة بيتعرض كل شيء — لما الباك اند يرجّع الصلاحيات،
   * الريل بيتفلتر لوحده من غير أي تعديل هنا.
   */
  permissions?: string[]
}

export function Rail({ user, onAssistant, assistantOpen, onSignOut, permissions }: RailProps) {
  const allowed = NAV.filter((n) => !n.perm || !permissions || permissions.includes(n.perm))

  return (
    <nav className="rail chrome" aria-label="التنقّل الرئيسي">
      <span className="mark mark-64 logo" style={{ marginBottom: '.85rem' }}>
        <Logo />
      </span>

      {allowed.map((item, i) => {
        const prev = allowed[i - 1]
        return (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `railitem${isActive ? ' on' : ''}${item.mob ? '' : ' nomob'}` +
              `${prev && prev.group !== item.group ? ' newgroup' : ''}`
            }
          >
            <Icon path={icons[item.icon as IconName]} />
            <span>{item.label}</span>
          </NavLink>
        )
      })}

      <div className="railfoot">
        <button
          className={`aitrigger${assistantOpen ? ' on' : ''}`}
          onClick={onAssistant}
          aria-expanded={assistantOpen}
          title="مساعد أبانمي · ⌘K"
        >
          <span className="aispark" />
          <span>
            المساعد<kbd>⌘K</kbd>
          </span>
        </button>
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>
    </nav>
  )
}
