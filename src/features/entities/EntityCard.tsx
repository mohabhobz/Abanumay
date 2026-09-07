import { Link } from 'react-router-dom'
import { Icon, icons, Mono, Riyal, Tag } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { initial, nf } from '@/lib/format'
import { ENTITY_DOCS_TOTAL } from '@/data/repository'
import { activationTone, governanceTone } from '@/lib/tone'
import type { EntityRow } from '@/types/domain'

/**
 * كارت جهة.
 *
 * النظام الحالي بيعرض الجهات في ست قوائم بنفس الستة عشر عمودًا.
 * الكارت ده بيجمّع السؤالين اللي بيتسألوا فعلًا قبل أي قرار:
 * الجهة دي مفعّلة وملفها كامل؟ وسجلّها معانا عامل إيه؟
 */
export function EntityCard({ row }: { row: EntityRow }) {
  const docsPct = Math.round((row.docsUploaded / ENTITY_DOCS_TOTAL) * 100)
  const complete = row.docsUploaded >= ENTITY_DOCS_TOTAL

  return (
    <article className="ecard glass">
      <div className="ec-top">
        <span className="ec-init">{initial(row.name)}</span>
        <div className="ec-id">
          <Link className="ec-name" to={ROUTES.entity(row.id)}>{row.name}</Link>
          <div className="sub">
            <Mono>{row.licenseNo}</Mono> · {row.type}
          </div>
        </div>
        <Tag tone={activationTone(row.activation)}>{row.activation}</Tag>
      </div>

      <div className="ec-meta sub">
        <span><Icon path={icons.pinMap} size={14} /> {row.region} · {row.city}</span>
        <span className="pc-dot" />
        <span>الحوكمة: <Tag tone={governanceTone(row.governance)}>{row.governance}</Tag></span>
      </div>

      {/* ملف المستندات — الرقم ده هو اللي بيوقف الاتفاقيات */}
      <div className="ec-docs well">
        <div className="ec-docs-t">
          <span>ملف المستندات</span>
          <b className={complete ? '' : 'over'}>
            <span className="num">{row.docsUploaded}</span> من{' '}
            <span className="num">{ENTITY_DOCS_TOTAL}</span>
          </b>
        </div>
        <div className="pc-bar">
          <i style={{ width: `${docsPct}%`, background: complete ? 'var(--ok)' : 'var(--warn)' }} />
        </div>
      </div>

      <div className="ec-nums">
        <div><b className="num">{row.projectsRunning}</b><span>تشغيل</span></div>
        <div><b className="num">{row.projectsCompleted}</b><span>مكتمل</span></div>
        <div><b className="num">{row.projectsDeclined}</b><span>معتذر</span></div>
        <div><b className="num over">{row.projectsStalled}</b><span>متعثر</span></div>
      </div>

      <div className="ec-foot">
        <div className="pc-amt">
          <span className="k">إجمالي الممنوح</span>
          <span className="v num">
            {nf.format(row.grantedTotal)}
            <small><Riyal /></small>
          </span>
        </div>
        <Link className="btn btn-2 btn-sm" to={ROUTES.entity(row.id)}>ملف الجهة</Link>
      </div>
    </article>
  )
}
