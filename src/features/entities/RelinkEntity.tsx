import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FieldSelect, Icon, Mono, Tag, icons } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { entityRows } from '@/data/mock/entities'
import { ENTITY_RULES } from '@/data/entities/rules'
import { relinkEntity, relinksOf, useEntityFlow } from '@/data/entities/store'
import { meOf, readRole } from '@/data/roles'
import { readDateTime } from '@/lib/format'
import { Modal } from './SelectionActions'

/* v3 · 2.4.10 · 2.4.11 · moving a project to another entity.

   For the exceptional case the document names: a duplicate entity record found after a project was
   tied to it. The authority holder picks the entity the project belongs to and writes why; the
   project, its agreements, payment requests, plans and closing records all follow in one step, and
   the move is kept with the entity before and after, the time and the person. */

export function RelinkEntityButton({ projectId, entityId, projectName }: { projectId: string; entityId: string; projectName: string }) {
  useEntityFlow()
  const role = readRole()
  const [open, setOpen] = useState(false)
  if (!ENTITY_RULES.relinkEntityBy.includes(role)) return null
  return (
    <>
      <button type="button" className="lnk" onClick={() => setOpen(true)}>تعديل الجهة</button>
      {open && <RelinkModal projectId={projectId} entityId={entityId} projectName={projectName} onClose={() => setOpen(false)} />}
    </>
  )
}

function RelinkModal({ projectId, entityId, projectName, onClose }: { projectId: string; entityId: string; projectName: string; onClose: () => void }) {
  const me = meOf(readRole())
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState('')
  const from = entityRows.find((e) => e.id === entityId)
  const opts = entityRows.filter((e) => e.id !== entityId && !e.archived)
    .map((e) => ({ value: e.id, label: `${e.name} · ${e.licenseNo}${e.activation === 'نشط' ? '' : ` · ${e.activation}`}` }))
  const target = entityRows.find((e) => e.id === to)
  return (
    <Modal wide title={`تعديل الجهة المرتبطة · ${projectName}`} icon={icons.edit} onClose={onClose}
      foot={<>
        <button className="btn btn-p" disabled={!to || !reason.trim()} onClick={() => { relinkEntity(projectId, to, reason.trim(), me, file || undefined); onClose() }}>انقل المشروع</button>
        <button className="btn btn-2" onClick={onClose}>تراجع</button>
      </>}>
      <p>الجهة الحالية: <b>{from?.name ?? entityId}</b> <Mono>{from?.licenseNo}</Mono></p>
      <div className="regf">
        <span className="lb">الجهة الصحيحة<b className="regf-r" aria-label="إلزامي">*</b></span>
        <FieldSelect value={to} options={opts} onChange={setTo} label="الجهة الصحيحة" placeholder="اختر الجهة" />
      </div>
      {target && target.activation !== 'نشط' && <p className="bad cnote">حساب الجهة المختارة «{target.activation}» · لا صرف لحساب غير نشط.</p>}
      <label className="regf">
        <span className="lb">السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
        <span className="fld"><input value={reason} onChange={(x) => setReason(x.target.value)} aria-label="سبب تعديل الجهة" /></span>
      </label>
      <div className="regf">
        <span className="lb">مستند داعم</span>
        <span className="apv-row">
          <label className="btn btn-2 btn-sm">
            <Icon name={icons.upload} size="sm" />{file ? 'استبدل الملف' : 'ارفع الملف'}
            <input className="vis-h" type="file" aria-label="مستند داعم" onChange={(x) => { const f = x.target.files?.[0]; if (f) setFile(f.name); x.target.value = '' }} />
          </label>
          {file ? <Tag tone="ok">{file}</Tag> : <span className="sub">اختياري</span>}
        </span>
      </div>
    </Modal>
  )
}

/** 2.4.11 · the project's entity moves · before, after, when and who */
export function RelinkHistory({ projectId }: { projectId: string }) {
  useEntityFlow()
  const rows = relinksOf(projectId)
  if (!rows.length) return null
  return (
    <ul className="relink">
      {rows.map((r) => (
        <li key={r.id}>
          <span><Link className="lnk" to={ROUTES.entity(r.from.id)}>{r.from.name}</Link> ← <Link className="lnk" to={ROUTES.entity(r.to.id)}>{r.to.name}</Link></span>
          <span className="sub">{r.by} · <span className="date">{readDateTime(r.at)}</span> · {r.reason}{r.file ? ` · ${r.file}` : ''}</span>
        </li>
      ))}
    </ul>
  )
}

