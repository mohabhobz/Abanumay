import { activationSay } from '@/data/shared/decisions'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Mono, Num, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { activationTone } from '@/lib/tone'
import type { EntityActivation, EntityRow } from '@/types/domain'
import { BANK_REJECT_REASONS, entityDetail, type BankAccount } from '@/data/mock/entityDetail'
import { REG_STATE_SAY } from '@/data/mock/registration'
import { meOf, readRole, roleByKey } from '@/data/roles'
import { ENTITY_RULES } from '@/data/entities/rules'
import {
  UPD_STATE_SAY, archiveEntity, canDecide, expiredMandatory, isRegState, openUpdateOf, overlayOf,
  requestsOfEntity, setBankStatus, setEntityStatus, type UpdState,
} from '@/data/entities/store'

/* What can be done to an entity from its file (2.4.20 · 2.4.21 · 2.4.27 · 2.4.28).

   Every one of these is a decision with a reason: suspend, revoke, reactivate, archive, restore,
   disable an account. The reason is written once, in a modal that won't close without it, and it
   lands in the entity's log and on its portal — the entity reads why, not just that. The buttons
   belong to the roles settings name; anyone else sees who decides. */

type Act = { to: EntityActivation | 'archive' | 'restore'; label: string; tone: 'btn-p' | 'btn-2' | 'btn-d' }

const actsFor = (e: EntityRow): Act[] => {
  if (e.archived) return [{ to: 'restore', label: 'استعد من الأرشيف', tone: 'btn-p' }]
  const out: Act[] = []
  if (e.activation === 'معلق (موقوف)' || e.activation === 'ملغى الاعتماد') out.push({ to: 'نشط', label: 'أعد التفعيل', tone: 'btn-p' })
  if (e.activation === 'نشط' || e.activation === 'غير نشط' || e.activation === 'محدث') out.push({ to: 'معلق (موقوف)', label: 'علّق الاعتماد', tone: 'btn-2' })
  if (e.activation !== 'ملغى الاعتماد' && e.activation !== 'مرفوض') out.push({ to: 'ملغى الاعتماد', label: 'ألغِ الاعتماد', tone: 'btn-d' })
  out.push({ to: 'archive', label: 'أرشف الجهة', tone: 'btn-2' })
  return out
}

function ReasonModal({ title, cta, tone, onClose, onDone }: {
  title: string; cta: string; tone: string; onClose: () => void; onDone: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className="chrome modal" role="dialog" aria-modal="true" aria-label={title} onClick={(x) => x.stopPropagation()}>
        <div className="mh"><Icon name={icons.alert} size="md" /><b>{title}</b></div>
        <div className="mb col">
          <p className="sub cnote">يُكتب السبب في سجل الجهة ويظهر لها في بوابتها (القاعدة 31).</p>
          <label className="regf">
            <span className="lb">السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
            <span className="fld"><input autoFocus value={reason} onChange={(x) => setReason(x.target.value)} aria-label="السبب" /></span>
          </label>
        </div>
        <div className="mf">
          <button className={`btn ${tone}`} disabled={!reason.trim()} onClick={() => { onDone(reason.trim()); onClose() }}>{cta}</button>
          <button className="btn btn-2" onClick={onClose}>تراجع</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The entity's standing · its status, why, and the decisions that change it */
export function EntityStatusCard({ e }: { e: EntityRow }) {
  const role = readRole()
  const may = canDecide('status', role)
  const me = meOf(role)
  const [act, setAct] = useState<Act | null>(null)
  const o = overlayOf(e.id)
  /* The file's own reading of its dates · the license on the row and the board mandate on the file */
  const det = entityDetail(e)
  const lapsed = [...new Set([...expiredMandatory(e), ...(det.licenseExpired ? ['الترخيص'] : []), ...(det.boardExpired ? ['قرار تكليف المجلس'] : [])])]
  const open = openUpdateOf(e.id)
  const deciders = ENTITY_RULES.statusBy.map((k) => roleByKey(k).title).join(' أو ')

  return (
    <Glass>
      <Head title="حالة الجهة" meta={<Tag tone={e.archived ? 'mute' : activationTone(e.activation)}>{e.archived ? 'مؤرشفة' : activationSay(e.activation)}</Tag>} />
      <KV rows={[
        { k: 'صلاحية التقديم', v: e.canApply ? <Tag tone="ok">مفعّلة</Tag> : <Tag tone="mute">موقوفة</Tag> },
        ...(lapsed.length ? [{ k: 'وثائق منتهية', v: <span className="bad">{lapsed.join('، ')} · غير نشطة تلقائيًا حتى التحديث</span> }] : []),
        ...(open ? [{ k: 'طلب تحديث', v: <Link className="lnk" to={ROUTES.entityUpdateReview(open.id)}><Mono>{open.id}</Mono> · {UPD_STATE_SAY[open.state]}</Link> }] : []),
        ...(o.statusReason ? [{ k: 'سبب آخر قرار', v: o.statusReason }] : []),
      ]} />
      {may ? (
        <div className="rowf gp-2 mt-3">
          {actsFor(e).map((a) => (
            <button key={a.label} className={`btn btn-sm ${a.tone}`} onClick={() => setAct(a)}>{a.label}</button>
          ))}
        </div>
      ) : (
        <p className="sub cnote">قرارات التعليق والإلغاء والأرشفة لـ{deciders}.</p>
      )}
      {act && (
        <ReasonModal
          title={`${act.label} · ${e.name}`}
          cta={act.label}
          tone={act.tone}
          onClose={() => setAct(null)}
          onDone={(reason) => {
            if (act.to === 'archive') archiveEntity(e.id, true, reason, me)
            else if (act.to === 'restore') archiveEntity(e.id, false, reason, me)
            else setEntityStatus(e.id, act.to, reason, me)
          }}
        />
      )}
    </Glass>
  )
}

const TONE_OF = (s: string): 'ok' | 'no' | 'warn' | 'ret' | 'mute' =>
  s === 'approved' ? 'ok' : s === 'rejected' ? 'no' : s === 'review' ? 'warn' : s === 'completion' ? 'ret' : 'mute'

/** 2.4.1 · the entity and its requests are separate records · each request has its own history */
export function EntityRequestsTab({ e }: { e: EntityRow }) {
  const rows = requestsOfEntity(e.id).sort((a, b) => b.at.localeCompare(a.at))
  if (rows.length === 0) {
    return (
      <Glass>
        <Empty title="لا طلبات مسجّلة لهذه الجهة." note="سُجّلت الجهة قبل بوابة التسجيل · وتظهر هنا طلبات التحديث التي ترسلها من بوابتها." />
      </Glass>
    )
  }
  return (
    <Glass>
      <Head title="طلبات الجهة" meta={<span className="sub"><Num>{rows.length}</Num> طلب</span>} />
      <ul className="eprq">
        {rows.map((r) => (
          <li key={r.id}>
            <Link className="eprq-r well" to={r.kind === 'reg' ? ROUTES.entityRequest(r.id) : ROUTES.entityUpdateReview(r.id)}>
              <Icon name={r.kind === 'reg' ? icons.doc : icons.edit} size="sm" />
              <span className="eprq-b">
                <b>{r.title}</b>
                <span className="sub"><Mono>{r.id}</Mono> · <DateText>{r.at}</DateText></span>
              </span>
              <span className="pc-sp" />
              <Tag tone={TONE_OF(r.state)}>{isRegState(r.state) && r.kind === 'reg' ? REG_STATE_SAY[r.state] : UPD_STATE_SAY[r.state as UpdState]}</Tag>
            </Link>
          </li>
        ))}
      </ul>
    </Glass>
  )
}

/** One account's decision · disable with a coded reason, or activate (2.4.27) */
export function BankActions({ entityId, b }: { entityId: string; b: BankAccount }) {
  const role = readRole()
  const me = meOf(role)
  const [why, setWhy] = useState('')
  if (!canDecide('status', role)) return null
  return b.status === 'مفعل' ? (
    <div className="rowf gp-2 mt-3">
      <FieldSelect value={why} options={BANK_REJECT_REASONS} onChange={setWhy} label={`سبب تعطيل ${b.bank}`} placeholder="سبب التعطيل" />
      <button className="btn btn-2 btn-sm" disabled={!why} onClick={() => setBankStatus(entityId, b.id, 'غير مفعل', me, why)}>عطّل الحساب</button>
    </div>
  ) : (
    <div className="rowf gp-2 mt-3">
      <button className="btn btn-p btn-sm" onClick={() => setBankStatus(entityId, b.id, 'مفعل', me)}>
        <Icon name={icons.check} size="sm" /> فعّل الحساب
      </button>
    </div>
  )
}
