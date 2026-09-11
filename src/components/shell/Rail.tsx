import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from '@/assets/LogoColor'
import { Icon, icons, type IconName } from '@/components/ui'
import { NAV } from '@/app/routes'
import { AccountMenu } from './AccountMenu'
import type { CurrentUser } from '@/types/domain'

export interface RailProps {
  user: CurrentUser
  onSignOut?: () => void
  /**
   * مفاتيح الصلاحيات اللي المستخدم يملكها.
   * لو مش متبعتة بيتعرض كل شيء — لما الباك اند يرجّع الصلاحيات،
   * الريل بيتفلتر لوحده من غير أي تعديل هنا.
   */
  permissions?: string[]
}

/* ═══════════════════════════════════════════════════════════
   عرض الشريط — بالسحب لا بزرار

   الزرار بيقول «في حالتين» ويخفي إن العرض متغيّر أصلًا. الخط على
   الحافة بيقول الحقيقة: امسك واسحب لأي عرض يريحك. والضغطة من غير
   سحب بتقلب بين الحالتين، فاللي عايز زرار لقى زرار.

   الأرقام: 80 مطويّ (أيقونة مريحة بلا تسمية)، و208 مفرود، والحدّ
   الأقصى 272 عشان الشريط ما ياخدش من المحتوى أكتر مما يستحق.
   ═══════════════════════════════════════════════════════════ */
const SHUT = 80
const OPEN = 208
const MAX = 272
/** أقل عرض تبان فيه التسمية — تحته الشريط بيرجع أيقونات */
const LABEL_AT = 132

const RAIL_KEY = 'ab-rail-w'

const clamp = (n: number) => Math.min(MAX, Math.max(SHUT, Math.round(n)))

const readWidth = (): number => {
  try {
    const v = Number(localStorage.getItem(RAIL_KEY))
    return Number.isFinite(v) && v > 0 ? clamp(v) : SHUT
  } catch {
    return SHUT
  }
}

export function Rail({ user, onSignOut, permissions }: RailProps) {
  const allowed = NAV.filter((n) => !n.perm || !permissions || permissions.includes(n.perm))

  const [w, setW] = useState(readWidth)
  const [dragging, setDragging] = useState(false)
  /* مرجع للحالة وقت بداية السحب — الستيت جوّه المستمع بيبقى قديمًا */
  const drag = useRef<{ x: number; w: number; moved: boolean } | null>(null)
  const open = w >= LABEL_AT

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, String(w))
    } catch {
      /* التخزين ممكن يكون مقفول — العرض يفضل للجلسة دي */
    }
  }, [w])

  /* RTL: الشريط على اليمين، فالسحب لليسار بيكبّره */
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = d.x - e.clientX
    if (Math.abs(dx) > 3) d.moved = true
    setW(clamp(d.w + dx))
  }, [])

  const onUp = useCallback(() => {
    const d = drag.current
    drag.current = null
    setDragging(false)
    window.removeEventListener('pointermove', onMove)
    /* ضغطة بلا سحب = قلب الحالة. اللي بيدوّر على زرار لقى زرار. */
    if (d && !d.moved) setW((v) => (v >= LABEL_AT ? SHUT : OPEN))
  }, [onMove])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onMove, onUp])

  const grab = (e: RPointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, w, moved: false }
    setDragging(true)
  }

  return (
    <nav
      className={`rail chrome${open ? ' open' : ''}${dragging ? ' dragging' : ''}`}
      style={{ '--rail-w': `${w}px` } as React.CSSProperties}
      aria-label="التنقّل الرئيسي"
    >
      {/* الشريط مطويّ ⇒ العلامة وحدها. مفرود ⇒ **القفل الكامل**:
          العلامة والاسم جنبها. اللي بيتغيّر مع فرد الشريط هو كمية
          الهوية اللي بتتقال، لا مقاس نفس العنصر.

          ⚠️ اسم المؤسسة هنا **مركّب بخط العرض** لأن ملف القفل
          الرسمي (العلامة + الاسم المخطوط) لسه ما وصلش — زيّه زي
          ملف براندو عربي. أول ما يوصل بيتحطّ مكانه هنا وبس. */}
      <span className="raillock">
        <span className="mark mark-64 logo"><Logo /></span>
        <span className="raillock-t" aria-hidden={!open}>
          <b>أبانمي</b>
          <small>مؤسسة سليمان أبانمي الأهلية</small>
        </span>
      </span>

      {allowed.map((item) => {
        return (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/'}
            /* التجميع كان بيتعلّم بهامش على أول بند في كل مجموعة
               (`.newgroup`). يعني إيقاعان في قايمة من ستّة بنود،
               وفاصل قبل بند واحد في الآخر بيتقري «ده منفصل» لا
               «هنا مجموعة». اتشال، والمسافة بقت واحدة. */
            className={({ isActive }) =>
              `railitem${isActive ? ' on' : ''}${item.mob ? '' : ' nomob'}`
            }
          >
            <Icon name={icons[item.icon as IconName]} />
            <span className="rail-l">{item.label}</span>
            {/* التلميح عنصر مستقل لا `title`: تلميح المتصفح بيتأخّر
                ثانية كاملة، والشريط المطويّ محتاج الاسم فورًا */}
            <span className="rail-tip">{item.label}</span>
          </NavLink>
        )
      })}

      {/* «اسأل أبانمي» اتنقل لرصيف القرار أسفل الشاشة — مش بند تنقّل،
          وقربه من مكان القرار هو اللي بيخلّيه يتستخدم. */}
      <div className="railfoot">
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>

      {/* مقبض العرض — خط على الحافة يظهر عند الاقتراب */}
      <div
        className="railgrip"
        onPointerDown={grab}
        role="separator"
        aria-orientation="vertical"
        aria-label="عرض القائمة"
        aria-valuenow={w}
        aria-valuemin={SHUT}
        aria-valuemax={MAX}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setW((v) => clamp(v + 16)) }
          if (e.key === 'ArrowRight') { e.preventDefault(); setW((v) => clamp(v - 16)) }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setW((v) => (v >= LABEL_AT ? SHUT : OPEN))
          }
        }}
      >
        <span className="railgrip-l" />
        <span className="railgrip-b" aria-hidden="true">
          <Icon name={icons.panel} size={14} />
        </span>
      </div>
    </nav>
  )
}
