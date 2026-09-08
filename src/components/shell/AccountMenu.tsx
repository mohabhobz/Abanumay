import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, icons, type IconName } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { nf } from '@/lib/format'
import { Avatar } from './Avatar'
import { ROLES } from '@/data/roles'
import { useRole } from '@/hooks/useRole'
import type { CurrentUser } from '@/types/domain'
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from '@/lib/theme'

const THEME_ITEMS: { key: ThemeChoice; label: string; icon: IconName }[] = [
  { key: 'light', label: 'فاتح', icon: 'sun' },
  { key: 'dark', label: 'داكن', icon: 'moon' },
  { key: 'green', label: 'أخضر', icon: 'leaf' },
]

/**
 * قائمة الحساب — بتفتح من الصورة تحت الريل على جهة المحتوى.
 * المظهر وإعدادات الحساب والخروج هنا، عشان ما ياخدوش مكان في التنقّل.
 */
export function AccountMenu({
  user,
  onSignOut,
  /** تفتح لتحت بدل الجنب — للشريط العلوي في الموبايل */
  drop,
}: {
  user: CurrentUser
  onSignOut?: () => void
  drop?: boolean
}) {
  const { role, setRole } = useRole()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const wrap = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    applyTheme(theme)
    writeTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

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
                  <Icon path={icons[t.icon]} size={15} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* مبدّل الدور — للنموذج فقط. الأدوار بتغيّر القراءات
              والشرائح والسقوف، فمن غير المبدّل الفرق ما يتجرّبش.
              لما يبقى فيه باك اند، الدور بييجي من التوكن والقسم ده يختفي. */}
          <div className="acct-sec">
            <div className="acct-lbl">
              الدور <span className="acct-demo">للعرض</span>
            </div>
            <div className="rolesw" role="radiogroup" aria-label="الدور">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  role="radio"
                  aria-checked={role.key === r.key}
                  className={role.key === r.key ? 'on' : ''}
                  onClick={() => setRole(r.key)}
                >
                  <span className="rolesw-t">{r.title}</span>
                  <span className="rolesw-s">
                    {r.financialAuthority === null
                      ? 'توصية فقط'
                      : `سقف ${nf.format(r.financialAuthority)}`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="acct-sec">
            <button role="menuitem" onClick={() => go(ROUTES.account)}>
              <Icon path={icons.user} size={16} />
              إعدادات الحساب
            </button>
            <button role="menuitem" onClick={() => go(ROUTES.preferences)}>
              <Icon path={icons.gear} size={16} />
              التفضيلات والإشعارات
            </button>
          </div>

          <div className="acct-sec">
            <button className="danger" role="menuitem" onClick={() => onSignOut?.()}>
              <Icon path={icons.logout} size={16} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
