import { useEffect, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { useNavigate } from 'react-router-dom'
import { Icon, icons, type IconName } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from '@/lib/theme'

const THEME_ITEMS: { key: ThemeChoice; label: string; icon: IconName }[] = [
  { key: 'light', label: 'فاتح', icon: 'sun' },
  { key: 'dark', label: 'داكن', icon: 'moon' },
  { key: 'green', label: 'أخضر', icon: 'leaf' },
]

/**
 * قائمة الحساب · بتفتح من الصورة تحت الريل على جهة المحتوى.
 * المظهر وإعدادات الحساب والخروج هنا، عشان ما ياخدوش مكان في التنقّل.
 */
export function AccountMenu({
  user,
  onSignOut,
  /** تفتح لتحت بدل الجنب · للشريط العلوي في الموبايل */
  drop,
}: {
  user: CurrentUser
  onSignOut?: () => void
  drop?: boolean
}) {
  const { open, setOpen, box: wrap } = useMenu<HTMLDivElement>()
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const navigate = useNavigate()

  useEffect(() => {
    applyTheme(theme)
    writeTheme(theme)
  }, [theme])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <div className="acctwrap" ref={wrap}>
      <button
        className={`acctbtn${open ? ' on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.name}، ${user.role}`}
      >
        <Avatar user={user} />
        {/* الاسم والدور بيبانوا لمّا الشريط يتفرد · الحساب يفضل
            زي أي مدخل تاني فيه، مش دايرة صامتة وسط أسماء */}
        <span className="rail-l acct-who">
          <span className="acct-who-n">{user.name}</span>
          <span className="acct-who-r">{user.role}</span>
        </span>
      </button>

      {open && (
        <div className={`acct${drop ? ' drop' : ''}`} role="menu">
          <div className="acct-id">
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <div className="acct-name">{user.name}</div>
              <div className="sub acct-role">{user.role}</div>
            </div>
          </div>

          <div className="acct-sec">
            <div className="acct-lbl">المظهر</div>
            <div className="seg" role="radiogroup" aria-label="المظهر">
              {THEME_ITEMS.map((t) => (
                <button
                  key={t.key}
                  className={theme === t.key ? 'on' : ''}
                  role="radio"
                  aria-checked={theme === t.key}
                  onClick={() => setTheme(t.key)}
                >
                  <Icon name={icons[t.icon]} size={14} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* مبدّل الدور اتشال من القايمة بطلب العميل.
              ⚠️ الدور لسّه بيغيّر القراءات والشرائح والسقوف في
              الصفحات (`useRole`)، بس مفيش واجهة تبدّله دلوقتي ·
              فالنموذج بيفضل على الدور المخزَّن. مكانه الطبيعي شاشة
              «إعدادات الحساب» لما تتبني. */}
          <div className="acct-sec">
            <button role="menuitem" onClick={() => go(ROUTES.account)}>
              <Icon name={icons.user} size={16} />
              إعدادات الحساب
            </button>
            <button role="menuitem" onClick={() => go(ROUTES.preferences)}>
              <Icon name={icons.gear} size={16} />
              التفضيلات والإشعارات
            </button>
          </div>

          <div className="acct-sec">
            <button className="danger" role="menuitem" onClick={() => onSignOut?.()}>
              <Icon name={icons.logout} size={16} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
