import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { FieldMultiSelect, DateField, FieldSelect, Icon, icons, Mono, Num, Select, Tag } from '@/components/ui'
import { useMenu } from '@/hooks/useMenu'
import { ROUTES } from '@/app/routes'
import { OWNERS } from '@/data/mock/taxonomy'
import type { EntityRow } from '@/types/domain'
import {
  ASK_ITEMS, CHANNELS, NOTICE_TPLS, REASONS, lastRequestOf, reasonText, splitFor, type Split,
} from '@/data/entities/actions'
import { ENTITY_RULES } from '@/data/entities/rules'
import {
  BATCH_SAY, askData, assignReview, nextBatchId, notifyEntities, type Batch, type BatchAct,
} from '@/data/entities/store'
import { todayIso } from '@/data/entities/validate'
import { units } from '@/lib/format'

/* The list's actions on a selection · LOCTech «الإجراءات عند التحديد» §1–2.

   Each one opens a short form that says, before anything is sent, how many entities it runs on and
   which are left out and why (§2 · «معاينة + العدد»). A selection of more than one becomes a batch:
   one id, one master line in the audit log, and a summary afterwards that keeps the left-out ones
   grouped by reason. Nothing here changes an entity's status · the eligibility decisions live in
   the entity's own file (§3). */

/* ── Shell ── */

export function Modal({ title, icon = icons.alert, children, foot, onClose, wide }: {
  title: string; icon?: (typeof icons)[keyof typeof icons]; children: ReactNode; foot: ReactNode; onClose: () => void; wide?: boolean
}) {
  return createPortal(
    <div className="bmask" role="presentation" onClick={onClose}>
      <div className={`chrome modal${wide ? ' modal-w' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(x) => x.stopPropagation()}>
        <div className="mh"><Icon name={icon} size="md" /><b>{title}</b></div>
        <div className="mb col">{children}</div>
        <div className="mf">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Who it runs on and who's left out · shown before sending */
function Scope({ split, cap }: { split: Split; cap?: number }) {
  const over = cap !== undefined && split.ok.length > cap
  return (
    <div className="selscope">
      <span><b>{units.entity(split.ok.length)}</b> يُنفَّذ عليها</span>
      {split.skipped.map((x) => (
        <span key={x.reason} className="sub">مستثناة {units.entity(x.rows.length)} · {x.reason}</span>
      ))}
      {over && <span className="bad">يتجاوز الحد الأقصى للدفعة (<Num>{cap!}</Num>) · قلّص التحديد</span>}
    </div>
  )
}

const skipOf = (s: Split) => s.skipped.map((x) => ({ reason: x.reason, ids: x.rows.map((r) => r.id) }))

/** A reason from the action's template · «أخرى» needs free text */
export function ReasonField({ kind, code, text, onCode, onText, label = 'السبب' }: {
  kind: keyof typeof REASONS; code: string; text: string; onCode: (v: string) => void; onText: (v: string) => void; label?: string
}) {
  const opts = REASONS[kind].map((r) => ({ value: r.code, label: `${r.label}${r.shown ? '' : ' · داخلي'}` }))
  return (
    <>
      <div className="regf">
        <span className="lb">{label}<b className="regf-r" aria-label="إلزامي">*</b></span>
        <FieldSelect value={code} options={opts} onChange={onCode} label={label} placeholder="اختر من القالب" />
      </div>
      {code === 'OTH' && (
        <label className="regf">
          <span className="lb">نص السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
          <span className="fld"><input value={text} onChange={(x) => onText(x.target.value)} aria-label="نص السبب" /></span>
        </label>
      )}
    </>
  )
}


/* ── «طلب تحديث البيانات» · one entity or many ── */

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export function AskModal({ rows, me, onClose, onDone }: {
  rows: EntityRow[]; me: string; onClose: () => void; onDone: (b: Batch | null) => void
}) {
  const split = splitFor('ask', rows)
  const [items, setItems] = useState<string[]>([])
  const [due, setDue] = useState(plusDays(14))
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const reason = reasonText('ask', code, text)
  const bulk = rows.length > 1
  const ready = items.length > 0 && due && reason && split.ok.length > 0 && split.ok.length <= ENTITY_RULES.bulkMax
  const send = () => {
    const ids = split.ok.map((e) => e.id)
    const batch = bulk ? { id: nextBatchId(), skipped: skipOf(split), failed: [] } : undefined
    askData(ids, items, due, reason, me, note.trim() || undefined, batch)
    onDone(batch ? { ...batch, act: 'ask', at: new Date().toISOString(), by: me, ok: ids } : null)
    onClose()
  }
  return (
    <Modal wide title={bulk ? `طلب تحديث البيانات · ${units.entity(rows.length)}` : `طلب تحديث البيانات · ${rows[0]?.name}`} icon={icons.edit} onClose={onClose}
      foot={<>
        <button className="btn btn-p" disabled={!ready} onClick={send}>أرسل الطلب</button>
        <button className="btn btn-2" onClick={onClose}>تراجع</button>
      </>}>
      {bulk && <Scope split={split} cap={ENTITY_RULES.bulkMax} />}
      <div className="regf">
        <span className="lb">البنود المطلوبة<b className="regf-r" aria-label="إلزامي">*</b></span>
        <FieldMultiSelect placeholder="اختر البنود" values={items} options={ASK_ITEMS} onChange={setItems} />
      </div>
      <div className="regf">
        <span className="lb">تاريخ الاستحقاق<b className="regf-r" aria-label="إلزامي">*</b></span>
        <DateField value={due} min={todayIso()} onChange={setDue} label="تاريخ الاستحقاق" />
      </div>
      <ReasonField kind="ask" code={code} text={text} onCode={setCode} onText={setText} />
      <label className="regf">
        <span className="lb">ملاحظة للجهة</span>
        <span className="fld"><input value={note} onChange={(x) => setNote(x.target.value)} aria-label="ملاحظة للجهة" /></span>
      </label>
      {ready && (
        <div className="selprev">
          <span className="sub">معاينة ما يصل للجهة</span>
          <b>مطلوب تحديث بيانات جهتك</b>
          <span>{items.join('، ')} · قبل {due} · {reason}{note.trim() ? ` · ${note.trim()}` : ''}</span>
        </div>
      )}
    </Modal>
  )
}

/* ── «إرسال إشعار» ── */

export function NotifyModal({ rows, me, onClose, onDone }: {
  rows: EntityRow[]; me: string; onClose: () => void; onDone: (b: Batch | null) => void
}) {
  const split = splitFor('notify', rows)
  const [tpl, setTpl] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [channel, setChannel] = useState(CHANNELS[3])
  const bulk = rows.length > 1
  const pick = (k: string) => {
    setTpl(k)
    const t = NOTICE_TPLS.find((x) => x.key === k)
    if (t && t.key !== 'free') { setTitle(t.title); setText(t.text) }
  }
  const ready = tpl && title.trim() && text.trim() && split.ok.length > 0 && split.ok.length <= ENTITY_RULES.bulkMax
  const send = () => {
    const ids = split.ok.map((e) => e.id)
    const batch = bulk ? { id: nextBatchId(), skipped: skipOf(split), failed: [] } : undefined
    notifyEntities(ids, title.trim(), text.trim(), channel, NOTICE_TPLS.find((x) => x.key === tpl)?.label ?? tpl, me, batch)
    onDone(batch ? { ...batch, act: 'notify', at: new Date().toISOString(), by: me, ok: ids } : null)
    onClose()
  }
  return (
    <Modal wide title={bulk ? `إرسال إشعار · ${units.entity(rows.length)}` : `إرسال إشعار · ${rows[0]?.name}`} icon={icons.bell} onClose={onClose}
      foot={<>
        <button className="btn btn-p" disabled={!ready} onClick={send}>أرسل</button>
        <button className="btn btn-2" onClick={onClose}>تراجع</button>
      </>}>
      {bulk && <Scope split={split} cap={ENTITY_RULES.bulkMax} />}
      <div className="regf">
        <span className="lb">القالب<b className="regf-r" aria-label="إلزامي">*</b></span>
        <FieldSelect value={tpl} options={NOTICE_TPLS.map((t) => ({ value: t.key, label: t.label }))} onChange={pick} label="القالب" placeholder="اختر قالبًا أو نصًا حرًا" />
      </div>
      <label className="regf">
        <span className="lb">العنوان<b className="regf-r" aria-label="إلزامي">*</b></span>
        <span className="fld"><input value={title} onChange={(x) => setTitle(x.target.value)} aria-label="عنوان الإشعار" /></span>
      </label>
      <label className="regf">
        <span className="lb">النص<b className="regf-r" aria-label="إلزامي">*</b></span>
        <span className="fld fld-a"><textarea rows={3} value={text} onChange={(x) => setText(x.target.value)} aria-label="نص الإشعار" /></span>
      </label>
      <div className="regf">
        <span className="lb">القناة</span>
        <FieldSelect value={channel} options={CHANNELS} onChange={setChannel} label="القناة" />
      </div>
    </Modal>
  )
}

/* ── «إسناد المراجعة» ── */

export function AssignModal({ rows, me, onClose, onDone }: {
  rows: EntityRow[]; me: string; onClose: () => void; onDone: (b: Batch | null) => void
}) {
  const split = splitFor('assign', rows)
  const [to, setTo] = useState('')
  const bulk = rows.length > 1
  const send = () => {
    const reqs = split.ok.map((e) => ({ reqId: lastRequestOf(e)!.id, entityId: e.id }))
    const batch = bulk ? { id: nextBatchId(), skipped: skipOf(split), failed: [] } : undefined
    assignReview(reqs, to, me, batch)
    onDone(batch ? { ...batch, act: 'assign', at: new Date().toISOString(), by: me, ok: split.ok.map((e) => e.id) } : null)
    onClose()
  }
  return (
    <Modal title={bulk ? `إسناد المراجعة · ${units.entity(rows.length)}` : `إسناد المراجعة · ${rows[0]?.name}`} icon={icons.users} onClose={onClose}
      foot={<>
        <button className="btn btn-p" disabled={!to || split.ok.length === 0} onClick={send}>أسند</button>
        <button className="btn btn-2" onClick={onClose}>تراجع</button>
      </>}>
      {bulk ? <Scope split={split} /> : (() => {
        const r = lastRequestOf(rows[0])
        return r ? <p className="sub cnote">الطلب <Mono>{r.id}</Mono> · المُسند إليه حاليًا: {r.assignee ?? 'غير مُسنَد'}</p> : null
      })()}
      <div className="regf">
        <span className="lb">المشرف<b className="regf-r" aria-label="إلزامي">*</b></span>
        <Select value={to} all="اختر المشرف…" people allowEmpty={false} options={[...OWNERS]} onChange={(v) => setTo(v ?? '')} />
      </div>
    </Modal>
  )
}

/* ── After a batch · §2 «ملخص النتيجة» ── */

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`

export function BatchResult({ batch, byId, onClose }: { batch: Batch; byId: (id: string) => EntityRow | undefined; onClose: () => void }) {
  const name = (id: string) => byId(id)?.name ?? id
  const download = () => {
    const lines = [['الجهة', 'رقم الترخيص', 'النتيجة', 'السبب'].map(csvCell).join(',')]
    for (const id of batch.ok) lines.push([name(id), byId(id)?.licenseNo ?? '', 'تم', ''].map(csvCell).join(','))
    for (const s of batch.skipped) for (const id of s.ids) lines.push([name(id), byId(id)?.licenseNo ?? '', 'مستثناة', s.reason].map(csvCell).join(','))
    for (const id of batch.failed) lines.push([name(id), byId(id)?.licenseNo ?? '', 'تعذّر', 'خطأ في قناة الإرسال'].map(csvCell).join(','))
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${batch.id}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const skipped = batch.skipped.reduce((n, s) => n + s.ids.length, 0)
  return (
    <Modal wide title={`اكتمل الإجراء: ${BATCH_SAY[batch.act as BatchAct]}`} icon={icons.check} onClose={onClose}
      foot={<>
        <button className="btn btn-p" onClick={onClose}>تم</button>
        <button className="btn btn-2" onClick={download}><Icon name={icons.export} size="sm" /> تنزيل النتيجة · CSV</button>
        <span className="pc-sp" />
        <Link className="lnk" to={`${ROUTES.audit}?q=${batch.id}`}>الدفعة في سجل التدقيق</Link>
      </>}>
      <p className="sub"><Mono>{batch.id}</Mono> · {batch.at.slice(0, 16).replace('T', ' ')}</p>
      <ul className="selres">
        <li><Tag tone="ok">تم بنجاح</Tag><b className="num">{batch.ok.length}</b></li>
        <li>
          <Tag tone={skipped ? 'warn' : 'mute'}>مستثناة</Tag><b className="num">{skipped}</b>
          {batch.skipped.map((s) => (
            <details key={s.reason} className="selres-g">
              <summary>{s.reason} · <span className="num">{s.ids.length}</span></summary>
              <ul className="sub">{s.ids.map((id) => <li key={id}>{name(id)}</li>)}</ul>
            </details>
          ))}
        </li>
        {batch.failed.length > 0 && (
          <li><Tag tone="no">تعذّر التنفيذ</Tag><b className="num">{batch.failed.length}</b></li>
        )}
      </ul>
    </Modal>
  )
}

/* ── «المزيد ⋯» ── */

export interface MoreItem { label: string; onClick: () => void; why?: string }

export function MoreMenu({ items }: { items: MoreItem[] }) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()
  if (!items.length) return null
  return (
    <div className="fexp" ref={box}>
      <button className={`btn btn-2 btn-sm${open ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        المزيد <Icon name={icons.dots} size="sm" />
      </button>
      {open && (
        <div className="fmenu fexp-m selmore" role="menu">
          {items.map((it) => (
            <button key={it.label} className="fopt" role="menuitem" disabled={Boolean(it.why)} title={it.why}
              onClick={() => { setOpen(false); it.onClick() }}>
              <span className="fopt-t">{it.label}</span>
              {it.why && <span className="fopt-n sub">{it.why}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
