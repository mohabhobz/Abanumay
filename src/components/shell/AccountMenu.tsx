import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, icons, type IconName } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'

export type ThemeChoice = 'light' | 'dark' | 'system'

const THEMES: { key: ThemeChoice; label: string; icon: IconName }[] = [
  { key: 'light', label: 'فاتح', icon: 'sun' },
  { key: 'dark', label: 'داكن', icon: 'moon' },
  { key: 'system', label: 'النظام', icon: 'device' },
]

const THEME_KEY = 'ab-theme'

function readTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

/**
 * قائمة الحساب — بتفتح من الصورة تحت الريل على جهة المحتوى.
 * المظهر وإعدادات الحساب والخروج هنا، عشان ما ياخدوش مكان في التنقّل.
 */
export function AccountMenu({ user, onSignOut }: { user: CurrentUser; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const wrap = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* التخزين ممكن يكون مقفول — الاختيار يفضل شغال للجلسة دي */
    }
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
        <div className="acct" role="menu">
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
              {THEMES.map((t) => (
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
