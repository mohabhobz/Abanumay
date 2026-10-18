import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { onToast } from '@/data/feedback'
import { todayFor } from './today'
import { clearTrail, getTrail, pathOf, setTrail } from './trail'

/**
 * The bar on a record opened from «اليوم» (client, 17 Oct): while the item is still open it offers
 * the way back; once its action is taken it says so and names the next one · «ارجع ليومك · التالي».
 */
export function TodayReturn() {
  const { role, user } = useRole()
  const loc = useLocation()
  const navigate = useNavigate()
  const [tick, setTick] = useState(0)
  useEffect(() => onToast(() => setTick((t) => t + 1)), [])
  const trail = getTrail()
  const here = Boolean(trail) && loc.pathname !== ROUTES.home && pathOf(trail!.to) === loc.pathname
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const day = useMemo(() => (here ? todayFor(role.key, user.name) : null), [here, role.key, user.name, tick])
  if (!here || !trail || !day) return null
  const still = day.items.some((i) => i.id === trail.id && i.queueKey === trail.queueKey)
  const next = day.items.find((i) => !(i.id === trail.id && i.queueKey === trail.queueKey))
  const back = () => { clearTrail(); navigate(ROUTES.home) }
  return (
    <nav className="tday-ret" aria-label="من يومك">
      {still ? (
        <span className="sub">من يومك · {trail.title}</span>
      ) : (
        <span><Icon name={icons.check} size="sm" /> أُنجز · {next ? <>التالي: <b>{next.title}</b></> : 'لا شيء آخر ينتظرك'}</span>
      )}
      {!still && next && (
        <button type="button" className="btn btn-p btn-sm" onClick={() => { setTrail({ id: next.id, queueKey: next.queueKey, title: next.title, to: next.to }); navigate(next.to) }}>التالي</button>
      )}
      <button type="button" className="btn btn-2 btn-sm" onClick={back}>ارجع ليومك</button>
      <button type="button" className="aclose" aria-label="أخفِ الشريط" title="أخفِ" onClick={() => { clearTrail(); setTick((t) => t + 1) }}>
        <Icon name={icons.close} size="sm" />
      </button>
    </nav>
  )
}
