import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DateText, Glass, Head, Icon, icons, KV, Money, Num, Person, Tag } from '@/components/ui'
import { DocList, UploadButton } from '@/components/docs'
import type { ProjectRow } from '@/types/domain'
import { studyScore } from '@/data/intake/criteria'
import { consultantByKey } from '@/data/intake/consultants'
import { REQUEST_DOCS, closeRequest, flowOf, uploadDoc } from '@/data/intake/flow'

/* The request's own cards on «بيانات المشروع» · procedure 3.

   RecommendationCard   what the supervisor recommends and why, where the grants manager reads it
                        first (3.4.25) — not buried in a timeline event
   RequestMetaCard      when it was created and sent, its versions, and the detailed objectives
                        (3.4.4 · 3.4.11 · 3.1.input-2)
   RequestDocsCard      the documents in two groups: the entity's and the internal ones; an entity
                        never sees the internal group (3.4.32)
   RequestCloseCard     cancel or archive with a reason — a request that was sent is never deleted
                        (3.4.27) */

export function RecommendationCard({ row }: { row: ProjectRow }) {
  const f = flowOf(row.id)
  const s = f.study
  if (!s) return null
  const sent = row.holder && row.holder !== 'supervisor'
  const c = f.referral ? consultantByKey(f.referral.consultant) : undefined
  return (
    <Glass className="reccard">
      <Head
        title="توصية مشرف المنح"
        meta={
          <>
            <Tag tone={s.recommendation === 'approve' ? 'ok' : s.recommendation === 'reject' ? 'no' : 'mute'}>
              {s.recommendation === 'approve' ? 'الموافقة' : s.recommendation === 'reject' ? 'الاعتذار' : 'لم تُحدَّد'}
            </Tag>
            {' '}<Tag tone="mute">{sent ? 'أُحيلت لمدير المنح' : 'مسودة لدى المشرف'}</Tag>
          </>
        }
      />
      <KV
        rows={[
          { k: 'المشرف', v: <Person name={s.by} /> },
          { k: 'درجة الدراسة', v: <><Num>{studyScore(s.scores)}</Num> من <Num>{100}</Num></> },
          ...(s.recommendation === 'approve' ? [{ k: 'المبلغ الموصى به', v: <Money>{s.amount}</Money> }] : []),
          { k: 'الإصدار', v: <><Num>{s.version}</Num> · <DateText>{s.at}</DateText></> },
          ...(f.referral ? [{ k: 'رأي المستشار', v: f.referral.opinion ? `${c?.name ?? ''} · ${f.referral.verdict}` : `${c?.name ?? ''} · بانتظار الرأي` }] : []),
        ]}
      />
      <p className="cnote"><b>المبررات:</b> {s.justification || '—'}</p>
      <p className="sub cnote">توصية استشارية · لا يترتب عليها اعتماد ولا صرف · القرار لصاحب الصلاحية حسب مصفوفة الاعتماد.</p>
    </Glass>
  )
}

export function RequestMetaCard({ row }: { row: ProjectRow }) {
  const f = flowOf(row.id)
  const created = f.createdAt ?? row.createdAt?.replace('T', ' ') ?? `${row.submittedAt} 09:00`
  return (
    <Glass>
      <Head title="بيانات الطلب" meta={<span className="sub"><Num>{Math.max(1, f.versions.length)}</Num> إصدار</span>} />
      <KV
        rows={[
          { k: 'أُنشئ', v: <span className="num">{created}</span> },
          { k: 'أُرسل', v: <DateText>{f.sentAt?.slice(0, 10) ?? row.submittedAt}</DateText> },
          { k: 'بداية التنفيذ', v: row.startAt ? <DateText>{row.startAt}</DateText> : '—' },
          { k: 'نهاية التنفيذ المحسوبة', v: row.endAt ? <DateText>{row.endAt}</DateText> : '—' },
        ]}
      />
      {f.versions.length > 0 && (
        <ol className="rqv">
          {f.versions.map((v) => (
            <li key={v.no}>
              <b className="num">V{v.no}</b>
              <span>{v.say}</span>
              <span className="pc-sp" />
              <span className="sub"><DateText>{v.at}</DateText></span>
            </li>
          ))}
        </ol>
      )}
      {f.objectives.length > 0 && (
        <>
          <h3 className="stdy-h mt-3">الأهداف التفصيلية</h3>
          <ol className="rqobj">
            {f.objectives.map((o) => <li key={o}>{o}</li>)}
          </ol>
        </>
      )}
    </Glass>
  )
}

export function RequestDocsCard({ row, me, asEntity, canUpload }: { row: ProjectRow; me: string; asEntity: boolean; canUpload: boolean }) {
  const f = flowOf(row.id)
  const groups = asEntity ? (['entity'] as const) : (['entity', 'internal'] as const)
  const up = (kind: string) => (file: File) => uploadDoc(row.id, kind, file.name, asEntity ? row.entityName : me)
  return (
    <Glass>
      <Head
        title="المرفقات"
        meta={<span className="sub"><Num>{f.docs.length}</Num> مرفوعة</span>}
      />
      {groups.map((g) => {
        const kinds = REQUEST_DOCS.filter((d) => d.audience === g)
        return (
          <div key={g} className="stdy-g">
            <h3 className="stdy-h">
              {g === 'entity' ? 'مرفقات الجهة' : 'مرفقات داخلية'}
              {' '}<Tag tone="mute">{g === 'entity' ? 'تراها الجهة والفريق' : 'للفريق الداخلي وحده'}</Tag>
            </h3>
            <DocList
              label={g === 'entity' ? 'مرفقات الجهة' : 'المرفقات الداخلية'}
              rows={kinds.map((d) => {
                const file = f.docs.find((x) => x.kind === d.key)
                return {
                  name: file?.name ?? d.label,
                  meta: file ? `${d.label} · ${file.by}` : undefined,
                  uploaded: Boolean(file),
                  required: d.required,
                  action: canUpload && !file && (g === 'internal' ? !asEntity : true)
                    ? <UploadButton label={`ارفع ${d.label}`} onPick={up(d.key)} accept=".pdf,.xlsx,.docx,.jpg,.png" />
                    : undefined,
                }
              })}
            />
          </div>
        )
      })}
    </Glass>
  )
}

export function RequestCloseCard({ row, me }: { row: ProjectRow; me: string }) {
  const f = flowOf(row.id)
  const [kind, setKind] = useState<'cancel' | 'archive' | null>(null)
  const [reason, setReason] = useState('')
  if (f.closed) {
    return (
      <Glass>
        <Head title={f.closed.kind === 'cancel' ? 'الطلب ملغى' : 'الطلب مؤرشف'} meta={<Tag tone="mute"><DateText>{f.closed.at}</DateText></Tag>} />
        <p className="sub cnote">{f.closed.reason} · <Person name={f.closed.by} /> · لا يُحذف الطلب ولا توصياته، ويبقى كاملًا في السجل.</p>
      </Glass>
    )
  }
  return (
    <Glass>
      <Head title="إلغاء الطلب أو أرشفته" meta={<Tag tone="mute">لا حذف بعد الإرسال</Tag>} />
      <p className="sub cnote">الطلب المرسل لا يُحذف ولا تُحذف توصياته · يُلغى إن انتهى سببه، أو يُؤرشف ليخرج من القوائم النشطة ويبقى في السجل.</p>
      <div className="rowf gp-2">
        <button type="button" className="btn btn-2" onClick={() => { setKind('archive'); setReason('') }}>أرشف الطلب</button>
        <button type="button" className="btn btn-d" onClick={() => { setKind('cancel'); setReason('') }}>ألغِ الطلب</button>
      </div>
      {kind && createPortal(
        <div className="bmask" role="presentation" onClick={() => setKind(null)}>
          <div className="chrome modal" role="dialog" aria-modal="true" aria-label={kind === 'cancel' ? 'إلغاء الطلب' : 'أرشفة الطلب'} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <Icon name={kind === 'cancel' ? icons.close : icons.folder} size="md" />
              <b>{kind === 'cancel' ? 'إلغاء الطلب' : 'أرشفة الطلب'}</b>
            </div>
            <div className="mb col">
              <p className="sub cnote">{row.name} · يبقى الطلب وكل ما سُجّل عليه في السجل.</p>
              <label className="regf">
                <span className="lb">السبب<b className="regf-r" aria-label="إلزامي">*</b></span>
                <span className="fld"><input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} aria-label="السبب" /></span>
              </label>
            </div>
            <div className="mf">
              <button className={`btn ${kind === 'cancel' ? 'btn-d' : 'btn-p'}`} disabled={!reason.trim()} onClick={() => { closeRequest(row.id, kind, reason.trim(), me); setKind(null) }}>
                {kind === 'cancel' ? 'ألغِ الطلب' : 'أرشف الطلب'}
              </button>
              <button className="btn btn-2" onClick={() => setKind(null)}>تراجع</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </Glass>
  )
}
