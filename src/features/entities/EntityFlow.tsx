import { reducedMotion } from '@/lib/prefs'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Glass, Money } from '@/components/ui'
import { ABLEAF_PATH } from '@/components/soul'
import { ROUTES } from '@/app/routes'
import type { EntityRow } from '@/types/domain'
import { pct } from '@/lib/format'

/* The riyal's flow through an entity, drawn as the Abanumay leaf.

   The relationship being shown:
     total granted = actually disbursed + still in disbursement
     granted this cycle = a time slice of the total (not a third part of it)

   So the leaf fills to the disbursed share, the lighter band above it is what is still in
   disbursement, and the cycle sits in the ledger as its own line under a divider. It sits on the
   page background with no card: the leaf is the object, and a card around it would frame an
   illustration like a data table.

   Motion: the leaf fills from empty when the page opens and the percentage counts up with it;
   hovering the leaf sways it and runs the water line once; hovering a ledger row highlights its
   part of the leaf. All of it is skipped under reduced motion. */

/* The leaf's vertical span inside its 24-unit viewBox (from the path's lowest to highest point). */
const LEAF_BOTTOM = 20.5
const LEAF_TOP = 3.5
const LEAF_SPAN = LEAF_BOTTOM - LEAF_TOP

const reduced = () =>
  reducedMotion()

/**
 * Counts from 0 to `to` over the same duration as the leaf fill. It starts when the fill's CSS
 * animation starts (`start()` is wired to `onAnimationStart`), so the number and the level move on
 * one clock instead of two timers that drift apart.
 */
function useCountUp(to: number, ms = 1200) {
  const [v, setV] = useState(() => (reduced() ? to : 0))
  const [t0, setT0] = useState<number | null>(null)
  useEffect(() => {
    if (reduced()) { setV(to); return }
    if (t0 === null) return
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms))
      /* Same curve family as the fill (ease-out), so both arrive together. */
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, ms, t0])
  /* No animation event under reduced motion or in a background tab: show the value anyway. */
  useEffect(() => {
    const safety = window.setTimeout(() => setT0((x) => x ?? performance.now() - ms), ms * 2)
    return () => window.clearTimeout(safety)
  }, [ms])
  return { value: v, start: () => setT0(performance.now()) }
}

export function EntityFlow({ entity }: { entity: EntityRow }) {
  /* Disbursed = committed minus what's still in transit. Both figures live in the entity's file,
     and the difference between them is the only thing computed here. */
  const total = entity.grantedTotal
  const pending = entity.inDisbursement
  const paid = Math.max(0, total - pending)
  /* Every link lands on the section that explains it: the payments inbox scoped to this entity
     only (all its requests, every stage), scrolled to the matching section; the year's approved
     amounts land on this entity's own projects. */
  const payOf = (section: string) =>
    `${ROUTES.payments}?entity=${encodeURIComponent(entity.id)}#${section}`
  const byEntity = `${ROUTES.entity(entity.id, 'projects')}#ent-projects`

  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  const paidPct = share(paid)
  const count = useCountUp(paidPct)
  const uid = useId().replace(/:/g, '')

  /* The empty state has a known background - plain text on the mesh used to fall below the contrast
     threshold. */
  if (total <= 0) {
    return (
      <Glass className="ejr ejr-none">
        <span className="ejr-ht">رحلة الريال في هذه الجهة</span>
        <p>لم تُمنح هذه الجهة أي مبلغ حتى الآن · الجهة مسجَّلة ولم تدخل دورة صرف بعد.</p>
      </Glass>
    )
  }

  /* Fill levels in viewBox units: the disbursed part rises from the leaf's base, and the pending
     band sits directly above it. */
  const paidTop = LEAF_BOTTOM - LEAF_SPAN * (paid / total)
  const pendTop = LEAF_BOTTOM - LEAF_SPAN * ((paid + pending) / total)

  return (
    <div className="ejr leafflow">
      <Link to={payOf('pay-kpi')} className="lf-art" aria-label={`وصل فعلًا ${pct(paidPct)} من إجمالي الممنوح`}>
        {/* The viewBox is cropped to the leaf's own bounds (it spans roughly 4-20.6 x 3.5-20.5 of the
            24-unit glyph), so the leaf fills its box instead of sitting inside a margin. */}
        <svg viewBox="3.4 3 17.6 18" aria-hidden="true">
          <defs>
            <clipPath id={`lfc-${uid}`}><path d={ABLEAF_PATH} /></clipPath>
            <linearGradient id={`lfg-${uid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" className="lf-g0" />
              <stop offset="1" className="lf-g1" />
            </linearGradient>
          </defs>
          <g clipPath={`url(#lfc-${uid})`}>
            <rect className="lf-track" x="0" y="0" width="24" height="24" />
            <g className="lf-fill" onAnimationStart={count.start}>
              <rect className="lf-pend" x="0" y={pendTop} width="24" height={paidTop - pendTop + 0.2} />
              <rect x="0" y={paidTop} width="24" height={24 - paidTop} fill={`url(#lfg-${uid})`} className="lf-paid" />
              <path
                className="lf-wave"
                d={`M-12 ${paidTop} q1.5 -.45 3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 t3 0 V${paidTop + 0.5} H-12 Z`}
              />
            </g>
          </g>
          <path className="lf-edge" d={ABLEAF_PATH} />
          <path className="lf-rib" d="M5 19.6C9 14 13.5 9 19.2 4.4" />
        </svg>
        <span className="lf-pct">
          <b className="num">{pct(count.value)}</b>
          <span>وصل فعلًا</span>
        </span>
      </Link>

      <div className="lf-ledger">
        <span className="lf-lbl">إجمالي الممنوح منذ التسجيل</span>
        <b className="lf-total"><Money>{total}</Money></b>
        <Link to={payOf('pay-paid')} className="lf-row lf-r-paid">
          <svg className="lf-dot" viewBox="0 0 24 24" aria-hidden="true"><path d={ABLEAF_PATH} /></svg>
          <span className="lf-k">وصل فعلًا</span>
          <b><Money sm>{paid}</Money></b>
          <span className="lf-p num">{pct(paidPct)}</span>
        </Link>
        <Link to={payOf('pay-open')} className="lf-row lf-r-pend">
          <svg className="lf-dot" viewBox="0 0 24 24" aria-hidden="true"><path d={ABLEAF_PATH} /></svg>
          <span className="lf-k">تحت الصرف</span>
          <b><Money sm>{pending}</Money></b>
          <span className="lf-p num">{pct(share(pending))}</span>
        </Link>
        <span className="lf-hr" aria-hidden="true" />
        <Link to={byEntity} className="lf-row lf-r-cyc">
          <svg className="lf-dot" viewBox="0 0 24 24" aria-hidden="true"><path d={ABLEAF_PATH} /></svg>
          <span className="lf-k">المبالغ المعتمدة 2026</span>
          <b><Money sm>{entity.grantedThisYear}</Money></b>
          <span className="lf-p num">{pct(share(entity.grantedThisYear))}</span>
        </Link>
      </div>
    </div>
  )
}
