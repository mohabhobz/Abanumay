import { Glass, Head, Num } from '@/components/ui'
import { DocList, type DocRow } from '@/components/docs'
import type { ProjectRow } from '@/types/domain'
import { agreementsOfProject, useAgreements } from '@/data/agreements/store'
import { payRequests } from '@/data/mock/disbursements'
import { CLOSE_DOCS, closeOfProject } from '@/data/mock/closing'
import { readDate } from '@/lib/format'
import { RequestDocsCard } from './RequestCards'

/* Client 21 Oct (#31) · every document of the project in one tab · the request's attachments (with
   «مرفقات أخرى», the only place here that takes uploads), then what the procedures after it
   produced: the agreement and its appendices, each payment's requirements, and the final report's
   files. Read-only beyond the request · a document belongs to its procedure and is changed there. */

export interface AttachmentsTabProps {
  row?: ProjectRow
  projectId: string
  me: string
  asEntity: boolean
  canUpload: boolean
  /** The fixture's list when the project has no live request row */
  fallback?: { name: string; uploaded: boolean; required?: boolean }[]
}

function Section({ title, note, rows, empty }: { title: string; note: string; rows: DocRow[]; empty: string }) {
  return (
    <Glass>
      <Head title={title} meta={<span className="sub"><Num>{rows.length}</Num> {rows.length === 1 ? 'مستند' : 'مستندات'} · {note}</span>} />
      {rows.length ? <DocList label={title} rows={rows} /> : <p className="sub cnote">{empty}</p>}
    </Glass>
  )
}

export function AttachmentsTab({ row, projectId, me, asEntity, canUpload, fallback }: AttachmentsTabProps) {
  useAgreements()
  const agr: DocRow[] = agreementsOfProject(projectId).flatMap((a) =>
    a.docs.map((d) => ({ name: d.name, uploaded: true, meta: `${a.id} · ${d.kind} · ${readDate(d.at)}` })))
  const pays: DocRow[] = payRequests.filter((r) => r.projectId === projectId).flatMap((r) =>
    r.docs.map((d) => ({ name: d.name, uploaded: true, meta: `الدفعة ${r.no} · ${d.kind} · ${readDate(d.at)}` })))
  const close = closeOfProject(projectId)
  const rep: DocRow[] = close
    ? CLOSE_DOCS.filter((d) => close.report.docs.includes(d.key)).map((d) => ({
        name: close.report.files?.[d.key] ?? `${d.label}.pdf`, uploaded: true, meta: d.label,
      }))
    : []

  return (
    <>
      {row
        ? <RequestDocsCard row={row} me={me} asEntity={asEntity} canUpload={canUpload} />
        : fallback && (
          <Glass>
            <Head title="المرفقات" meta={<span className="sub"><Num>{fallback.filter((a) => a.uploaded).length}</Num> من <Num>{fallback.length}</Num> مرفوعة</span>} />
            <DocList label="مرفقات المشروع وحالتها" rows={fallback} />
          </Glass>
        )}
      <Section title="مستندات الاتفاقية" note="من إجراء الاتفاقيات" rows={agr} empty="لا اتفاقية موقّعة بعد · تظهر هنا الاتفاقية وملاحقها بعد توقيعها." />
      <Section title="مستندات الدفعات" note="متطلبات كل دفعة كما رُفعت" rows={pays} empty="لا دفعات طُلبت بعد." />
      <Section title="ملفات التقرير الختامي" note="من إجراء الإغلاق" rows={rep} empty="لم يُرفع التقرير الختامي بعد." />
    </>
  )
}
