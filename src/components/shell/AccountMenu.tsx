import { useEffect, useState } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Face, Icon, icons, type IconName } from '@/components/ui'
import { STAFF_DIRECTORY, roleByKey, switchAccount } from '@/data/roles'
import { useRole } from '@/hooks/useRole'
import { ROUTES, type NavItem } from '@/app/routes'
import { Avatar } from './Avatar'
import type { CurrentUser } from '@/types/domain'
import { applyTheme, readTheme, writeTheme, type ThemeChoice } from '@/lib/theme'

const THEME_ITEMS: { key: ThemeChoice; label: string; icon: IconName }[] = [
  { key: 'light', label: 'فاتح', icon: 'sun' },
  { key: 'dark', label: 'داكن', icon: 'moon' },
]

/**
 * Account menu — opens from the avatar under the rail, on the content side.
 * Appearance, account settings, and sign out live here, so they don't take up space in navigation.
 * On mobile the avatar is the last slot of the bottom bar, and the menu also lists `modules`: the
 * navigation items that don't fit in the bar. That section is hidden on desktop, where the rail
 * already shows every module.
 */
export function AccountMenu({
  user,
  onSignOut,
  /** Opens downward instead of sideways — for a top bar. */
  drop,
  /** Modules listed at the top of the menu on mobile. */
  modules = [],
}: {
  user: CurrentUser
  onSignOut?: () => void
  drop?: boolean
  modules?: NavItem[]
}) {
  const { open, setOpen, box: wrap } = useMenu<HTMLDivElement>()
  const [who, setWho] = useState(false)
  const { role, setRole } = useRole()
  const [theme, setTheme] = useState<ThemeChoice>(readTheme)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  /* The profile slot reads as active while one of its modules is open. */
  const here = modules.some((m) => pathname === m.to || pathname.startsWith(`${m.to}/`))

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
        className={`acctbtn${open ? ' on' : ''}${here ? ' here' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${user.name}، ${user.role}`}
      >
        <Avatar user={user} />
        {/* The name and role show once the bar is wide enough — the account stays like any other
            entry in it, not a silent circle among names. */}
        <span className="rail-l acct-who">
          <span className="acct-who-n">{user.name}</span>
          <span className="acct-who-r">{user.role}</span>
        </span>
        <span className="acct-mob-l">حسابي</span>
      </button>

      {open && (
        <div className={`acct${drop ? ' drop' : ''}`} role="menu">
          {/* The profile card doubles as the switcher: its arrow lists the three roles the
              prototype is built for, and picking one swaps the whole system to that person, home
              page first. In production the role comes from the sign-in and this list goes. */}
          <div className="acct-id">
            <Avatar user={user} />
            <div style={{ minWidth: 0 }}>
              <div className="acct-name">{user.name}</div>
              <div className="sub acct-role">{user.role}</div>
            </div>
            <button
              type="button"
              className="iact acct-sw"
              aria-expanded={who}
              aria-controls="acct-who"
              aria-label="تبديل المستخدم"
              title="تبديل المستخدم"
              onClick={() => setWho((x) => !x)}
            >
              <Icon name={who ? icons.chevronUp : icons.chevronDown} size="sm" />
            </button>
          </div>

          {who && (
            <div className="acct-sec acct-who-list" id="acct-who" role="group" aria-label="المستخدمون">
              {/* Batch 1 · 8 Oct · the list is people, not seats: picking one signs in as that person
                  (the demo's shortcut for signing out and in), so a vote or a study is always
                  someone's own · two officers on the supervisor seat are two accounts */}
              {STAFF_DIRECTORY.map((a) => {
                const on = a.name === user.name && a.role === role.key
                return (
                  <button
                    key={a.login}
                    role="menuitemradio"
                    aria-checked={on}
                    className={on ? 'on' : ''}
                    onClick={() => {
                      switchAccount(a)
                      setRole(a.role)
                      setWho(false)
                      go(ROUTES.home)
                    }}
                  >
                    <Face name={a.name} />
                    <span className="acct-who-t">
                      <span>{a.name}</span>
                      <span className="sub">{roleByKey(a.role).title}</span>
                    </span>
                    {on && <Icon name={icons.check} size="sm" />}
                  </button>
                )
              })}
            </div>
          )}

          {modules.length > 0 && (
            <nav className="acct-sec acct-mods" aria-label="باقي الأقسام">
              {modules.map((m) => (
                <NavLink
                  key={m.key}
                  to={m.to}
                  role="menuitem"
                  className={({ isActive }) => (isActive ? 'on' : '')}
                  onClick={() => setOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={icons[m.icon as IconName]} active={isActive} />
                      <span>{m.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          )}

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
                  <Icon name={icons[t.icon]} size="sm" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="acct-sec">
            <button role="menuitem" onClick={() => go(ROUTES.account)}>
              <Icon name={icons.user} size="sm" />
              إعدادات الحساب
            </button>
            <button role="menuitem" onClick={() => go(ROUTES.preferences)}>
              <Icon name={icons.gear} size="sm" />
              التفضيلات والإشعارات
            </button>
          </div>

          {/* ⚠️ **System settings are kept separate from preferences, deliberately.** Preferences
              change the screen's look **for their owner**; system settings change the system's
              behavior **for every user** — mixing them into one section is what makes someone go
              looking for "cities" under their own preferences. */}
          <div className="acct-sec">
            <button role="menuitem" onClick={() => go(ROUTES.settings)}>
              <Icon name={icons.gear} size="sm" />
              إعدادات النظام
            </button>
            {/* The system admin's entry · in production it shows only to holders of
                «الصلاحيات · تعديل»; the mock shows it so the screen can be reviewed. */}
            <button role="menuitem" onClick={() => go(ROUTES.permissions)}>
              <Icon name={icons.shield} size="sm" />
              الصلاحيات والأدوار
            </button>
            {/* Cross · the shared services · the late report, the outbox and the audit log */}
            <button role="menuitem" onClick={() => go(ROUTES.escalation)}>
              <Icon name={icons.clock} size="sm" />
              المتأخر والمتعثر
            </button>
            <button role="menuitem" onClick={() => go(ROUTES.notifyHub)}>
              <Icon name={icons.bell} size="sm" />
              سجل الإشعارات
            </button>
            <button role="menuitem" onClick={() => go(ROUTES.audit)}>
              <Icon name={icons.checks} size="sm" />
              سجل التدقيق
            </button>
          </div>

          <div className="acct-sec">
            <button className="danger" role="menuitem" onClick={() => onSignOut?.()}>
              <Icon name={icons.logout} size="sm" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
