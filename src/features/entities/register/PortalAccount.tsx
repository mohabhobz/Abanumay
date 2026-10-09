import { activationSay } from '@/data/shared/decisions'
import { Link } from 'react-router-dom'
import { DateText, Glass, Head, Icon, KV, Mono, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { activationTone } from '@/lib/tone'
import { entityCode } from '@/lib/format'
import type { EntityRow } from '@/types/domain'
import { expiredMandatory, openUpdateOf, overlayOf, UPD_STATE_SAY } from '@/data/entities/store'
import { entityDetail } from '@/data/mock/entityDetail'

/* The entity's own account in its portal (2.2.17 · 2.4.18 · 2.4.20 · 2.3.upd-1).

   What it can do now — apply or not — and why, in the entity's words: «نشطة» applies; an expired
   mandatory document makes it inactive until an update request carries the renewed copy; an open
   update request pauses it until decided; a suspension carries the reason the foundation wrote.

   The update service starts here, not from the staff screens: the entity changes its own file. */

export function PortalAccount({ e }: { e: EntityRow }) {
  const det = entityDetail(e)
  const lapsed = [...new Set([...expiredMandatory(e), ...(det.licenseExpired ? ['الترخيص'] : []), ...(det.boardExpired ? ['قرار تكليف المجلس'] : [])])]
  const open = openUpdateOf(e.id)
  const reason = overlayOf(e.id).statusReason
  const blocked = e.activation === 'معلق (موقوف)' || e.activation === 'ملغى الاعتماد' || e.archived

  return (
    <Glass>
      <Head
        title="حساب الجهة"
        meta={<Tag tone={activationTone(e.activation)}>{e.archived ? 'مؤرشفة' : activationSay(e.activation)}</Tag>}
      />
      <KV
        rows={[
          { k: 'كود الجهة', v: <Mono>{entityCode(e.id, e.registeredAt)}</Mono> },
          { k: 'صلاحية التقديم', v: e.canApply ? <Tag tone="ok">مفعّلة</Tag> : <Tag tone="mute">موقوفة</Tag> },
          { k: 'نهاية الترخيص', v: <DateText>{e.licenseEndsAt}</DateText> },
        ]}
      />

      {lapsed.length > 0 && !open && (
        <div className="ptl-res no">
          <Icon name={icons.alert} size="sm" />
          <div>
            <b>انتهت صلاحية {lapsed.join(' و')}</b>
            <p>الجهة غير نشطة حتى ترفع النسخة السارية بطلب تحديث، ولا يُقبل منها طلب مشروع قبل اعتماده.</p>
          </div>
        </div>
      )}
      {open && (
        <div className="ptl-res">
          <Icon name={icons.clock} size="sm" />
          <div>
            <b>طلب التحديث <Mono>{open.id}</Mono> · {UPD_STATE_SAY[open.state]}</b>
            <p>{open.state === 'completion'
              ? `أعادته المؤسسة للاستكمال: ${open.note ?? ''}`
              : open.state === 'draft' ? 'مسودة لم تُرسل بعد.' : 'نشاط الجهة معلّق حتى يُبتّ فيه.'}</p>
          </div>
        </div>
      )}
      {blocked && reason && (
        <div className="ptl-res no">
          <Icon name={icons.alert} size="sm" />
          <div><b>{e.archived ? 'أُرشفت الجهة' : activationSay(e.activation)}</b><p>{reason}</p></div>
        </div>
      )}

      {!blocked && (
        <footer className="payq-f">
          <span className="sub payq-when">بيانات الاتصال تُحدَّث فورًا · والهوية والترخيص والحسابات البنكية باعتماد المؤسسة</span>
          <Link className={`btn ${lapsed.length && !open ? 'btn-p' : 'btn-2'}`} to={`${ROUTES.entityUpdate}?entity=${e.id}${open ? `&id=${open.id}` : ''}`}>
            <Icon name={icons.edit} size="sm" />
            {open && open.state !== 'review' ? 'أكمل طلب التحديث' : open ? 'اعرض طلب التحديث' : 'حدّث بيانات الجهة'}
          </Link>
        </footer>
      )}
    </Glass>
  )
}
