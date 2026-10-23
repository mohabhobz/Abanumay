import { useState } from 'react'
import { createPortal } from 'react-dom'
import { DateField, DateText, Glass, Head, Icon, icons, KV, Money, Num, Person, Tag } from '@/components/ui'
import { DocList, UploadButton } from '@/components/docs'
import type { ProjectRow } from '@/types/domain'
import { studyScore } from '@/data/intake/criteria'
import { consultantByKey } from '@/data/intake/consultants'
import { REQUEST_DOCS, closeRequest, flowOf, rescheduleStart, uploadDoc } from '@/data/intake/flow'
import { P_STAGES } from '@/data/mock/projectNew'
import { agreements } from '@/data/mock/agreements'
import { outputLine, parseOutputs } from '@/data/intake/flow'
import { OtherDocs } from './OtherDocs'
import { WEEKDAYS, calendarDaysBetween, endAfterDays, foundationWeek, workDaysOf } from '@/data/intake/cycle'

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
              {s.recommendation === 'approve' ? 'الموافقة' : s.recommendation === 'reject' ? 'الرفض' : 'لم تُحدَّد'}
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

/** The request form's field labels · a version's values read with the form's own names */
/* v3 · the outputs list and the execution days read as text, not as their stored form */
const sayValue = (k: string, x: string): string =>
  k === 'outputs' ? parseOutputs(x).map(outputLine).join(' ؛ ')
    : k === 'execDays' ? (workDaysOf(x) ?? []).map((n) => WEEKDAYS[n]).join('، ')
      : x

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  [...P_STAGES.flatMap((st) => st.fields.filter((x) => x.key !== 'entityId').map((x) => [x.key, x.label])), ['amount', 'المبلغ'], ['days', 'المدة بالأيام'], ['beneficiaries', 'المستفيدون'], ['startAt', 'تاريخ بدء التنفيذ المتوقع']],
)

export function RequestMetaCard({ row, me, canReschedule = false }: { row: ProjectRow; me?: string; canReschedule?: boolean }) {
  const f = flowOf(row.id)
  /* Client 21 Oct (#26 · #28) · the expected dates are the entity's, the duration the calendar days
     between them · the actual start comes with the agreement's signature (or the approval of an external
     project) · after the approvals the supervisor and the grants manager may move it, with a reason,
     and the end moves with it by the same number of days */
  const [edit, setEdit] = useState(false)
  const [start, setStart] = useState(row.actualStartAt ?? row.startAt ?? '')
  const [why, setWhy] = useState('')
  const [err, setErr] = useState<string[]>([])
  const created = f.createdAt ?? row.createdAt?.replace('T', ' ') ?? `${row.submittedAt} 09:00`
  const days = row.startAt && row.endAt && !row.actualStartAt ? calendarDaysBetween(row.startAt, row.endAt) || (row.durationDays ?? 0) : (row.durationDays ?? 0)
  const expectedEnd = row.actualStartAt ? (row.startAt && days ? endAfterDays(row.startAt, days) : '') : (row.endAt ?? '')
  const external = Boolean(row.platform)
  const approved = row.supportStatus === 'معتمد' || !['دراسة المشروع', 'استكمال بيانات المشروع'].includes(row.stage)
  const week = (row.execDays ?? foundationWeek()).map((n) => WEEKDAYS[n]).join('، ')
  /* a record from before the rule carries no actual start · its agreement's signature is that start */
  const signed = row.actualStartAt ? undefined : agreements.find((a) => a.projectId === row.id && a.stage === 'active' && a.activeAt)?.activeAt?.slice(0, 10)
  return (
    <Glass>
      <Head title="بيانات الطلب" meta={<span className="sub"><Num>{Math.max(1, f.versions.length)}</Num> إصدار</span>} />
      <KV
        rows={[
          { k: 'أُنشئ', v: <span className="num">{created}</span> },
          { k: 'أُرسل', v: <DateText>{f.sentAt?.slice(0, 10) ?? row.submittedAt}</DateText> },
          { k: 'تاريخ تقديم الطلب', v: <DateText>{row.submittedAt}</DateText> },
          { k: 'تاريخ بدء التنفيذ المتوقع', v: row.startAt ? <><DateText>{row.startAt}</DateText> <span className="sub">· كما أدخلته الجهة</span></> : '—' },
          { k: 'تاريخ انتهاء التنفيذ المتوقع', v: expectedEnd ? <DateText>{expectedEnd}</DateText> : '—' },
          ...(days ? [{ k: 'المدة', v: <><Num>{days}</Num> يومًا <span className="sub">· من تاريخ البدء إلى تاريخ الانتهاء</span></> }] : []),
          {
            k: 'تاريخ بدء التنفيذ الفعلي',
            v: row.actualStartAt
              ? <DateText>{row.actualStartAt}</DateText>
              : signed ? <><DateText>{signed}</DateText> <span className="sub">· مع توقيع الاتفاقية</span></>
              : <span className="sub">{external ? 'يُسجَّل مع اكتمال الاعتماد · المشروع الخارجي بلا اتفاقية' : 'يُسجَّل مع توقيع الاتفاقية'}</span>,
          },
          ...(row.actualStartAt && row.endAt ? [{ k: 'نهاية التنفيذ', v: <><DateText>{row.endAt}</DateText> <span className="sub">· من البداية الفعلية بالمدة نفسها</span></> }] : []),
          { k: 'أيام التنفيذ من الأسبوع', v: <>{week} <span className="sub">· للعلم · لا تغيّر المدة</span></> },
        ]}
      />
      {canReschedule && approved && days ? (
        edit ? (
          <div className="regfields mt-3">
            <label className="regf">
              <span className="lb">بداية التنفيذ الفعلي</span>
              <DateField value={start} onChange={setStart} label="بداية التنفيذ الفعلي" />
            </label>
            <label className="regf">
              <span className="lb">سبب التعديل<b className="regf-r" aria-label="إلزامي">*</b></span>
              <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="سبب تعديل البداية" /></span>
              <span className="sub regf-h">تنتقل النهاية بالمدة نفسها · <Num>{days}</Num> يومًا</span>
            </label>
            {err.length > 0 && <p className="bad">{err.join(' · ')}</p>}
            <div className="rowf gp-2">
              <button type="button" className="btn btn-p btn-sm" onClick={() => {
                const e = rescheduleStart(row.id, start, why, me ?? '')
                setErr(e)
                if (!e.length) { setEdit(false); setWhy('') }
              }}>احفظ البداية الفعلية</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEdit(false); setErr([]) }}>إلغاء</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-2 btn-sm mt-2" onClick={() => { setStart(row.actualStartAt ?? row.startAt ?? ''); setEdit(true) }}>
            <Icon name={icons.edit} size="sm" />{row.actualStartAt ? 'عدّل بداية التنفيذ الفعلي' : 'سجّل بداية التنفيذ الفعلي'}
          </button>
        )
      ) : null}
      {f.versions.length > 0 && (
        <ol className="rqv">
          {f.versions.map((v) => (
            <li key={v.no}>
              <b className="num">V{v.no}</b>
              <span>{v.say}</span>
              <span className="pc-sp" />
              <span className="sub"><DateText>{v.at}</DateText></span>
              {v.snap && (
                <span className="sub rqv-snap">
                  المبلغ <Money sm>{v.snap.amount}</Money> · المدة <Num>{v.snap.days}</Num> يومًا · المستفيدون <Num>{v.snap.reach}</Num> · المرفقات <Num>{v.snap.docs}</Num>
                </span>
              )}
              {/* Batch 7 · intake#14 · the version read whole · each field as sent, the changes
                  against the version before marked, and its attachments */}
              {v.values && (
                <details className="rqv-full">
                  <summary className="lnk">اعرض الإصدار كاملًا</summary>
                  <KV rows={Object.entries(v.values).filter(([k, x]) => x && FIELD_LABEL[k]).map(([k, x]) => {
                    const before = f.versions.filter((y) => y.no < v.no && y.values).pop()?.values?.[k]
                    const changed = before !== undefined && before !== x
                    return { k: FIELD_LABEL[k]!, v: changed ? <><b>{sayValue(k, x)}</b> <Tag tone="warn">تغيّر · كان {sayValue(k, before)}</Tag></> : sayValue(k, x) }
                  })} />
                  {v.docs && v.docs.length > 0 && <p className="sub cnote">المرفقات: {v.docs.join(' · ')}</p>}
                </details>
              )}
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
        /* #32 · the named «more» slot gives way to the «مرفقات أخرى» list below · a file already
           sent in it stays visible as it was */
        const kinds = REQUEST_DOCS.filter((d) => d.audience === g && (d.key !== 'more' || f.docs.some((x) => x.kind === 'more')))
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
      <OtherDocs projectId={row.id} me={asEntity ? row.entityName : me} asEntity={asEntity} canUpload={canUpload} />
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
