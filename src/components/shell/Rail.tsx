import { useEffect, useState } from 'react'
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

/**
 * حالة الطيّ محفوظة، والافتراضي مطويّ.
 *
 * الشريط المفرود بياخد عرضًا من المحتوى طول الوقت مقابل معلومة
 * المستخدم بيحفظها بعد يومين. فالافتراضي أيقونات، والاسم بيظهر
 * عند الهوفر لمّا يكون محتاجه — والفرد اختيار بيفضل محفوظ لمن
 * بيفضّله.
 */
const RAIL_KEY = 'ab-rail'

const readOpen = (): boolean => {
  try {
    return localStorage.getItem(RAIL_KEY) === 'open'
  } catch {
    return false
  }
}

export function Rail({ user, onAssistant, assistantOpen, onSignOut, permissions }: RailProps) {
  const allowed = NAV.filter((n) => !n.perm || !permissions || permissions.includes(n.perm))
  const [open, setOpen] = useState(readOpen)

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, open ? 'open' : 'shut')
    } catch {
      /* التخزين ممكن يكون مقفول — الاختيار يفضل للجلسة دي */
    }
  }, [open])

  return (
    <nav className={`rail chrome${open ? ' open' : ''}`} aria-label="التنقّل الرئيسي">
      <div className="railtop">
        <span className="mark mark-64 logo"><Logo /></span>
        <button
          className="railtog"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'طيّ القائمة' : 'فرد القائمة'}
        >
          <Icon path={icons.chevron} size={16} />
          <span className="rail-tip">{open ? 'طيّ القائمة' : 'فرد القائمة'}</span>
        </button>
      </div>

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
            <span className="rail-l">{item.label}</span>
            {/* التلميح عنصر مستقل لا `title`: تلميح المتصفح بيتأخّر
                ثانية كاملة، والشريط المطويّ محتاج الاسم فورًا */}
            <span className="rail-tip">{item.label}</span>
          </NavLink>
        )
      })}

      <div className="railfoot">
        <button
          className={`aitrigger${assistantOpen ? ' on' : ''}`}
          onClick={onAssistant}
          aria-expanded={assistantOpen}
        >
          <span className="aispark" />
          <span className="rail-l">
            المساعد<kbd>⌘K</kbd>
          </span>
          <span className="rail-tip">مساعد أبانمي · ⌘K</span>
        </button>
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>
    </nav>
  )
}
