import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, Icon, Money, Tag, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { projectRows } from '@/data/mock/projects'
import { HOLDER_LABEL } from '@/data/holders'
import { flowOf } from '@/data/intake/flow'
import { printArea } from '@/lib/export'
import { nf } from '@/lib/format'
import { appFlowOf, useApprovals, type Brief } from '@/data/approvals/store'
import { closeRows } from '@/data/mock/closing'

/* v3 · 5.2.3 · 6.2.2 · 7.2.3 · «ملف العرض» · one file made when the project reached the executive
   director, the committee or the board, ready to print to PDF and send by mail · the project card,
   the recommendations, the foundation's outputs (the entity's beside them), the amount and its
   changes, the conditions, and the financial position **as it stood when the file was made** · it is
   never recomputed. The members read it before the meeting. In production the server renders the
   PDF; here the browser's print does. */

/** v3 · 5.2.3 · 6.2.2 · 7.2.3 · «التقرير السابق إن وجد» · the entity's last closed project, its final report */
function priorReport(entityId: string, exceptId: string) {
  const mine = closeRows.filter((c) => c.stage === 'closed' && c.projectId !== exceptId && projectRows.find((p) => p.id === c.projectId)?.entityId === entityId)
  return [...mine].sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0]
}

function BriefBody({ b, name, entity, field, docs, prior }: { b: Brief; name: string; entity: string; field: string; docs: string[]; prior?: ReturnType<typeof priorReport> }) {
  const one = b.fin.lines.length === 1 ? b.fin.lines[0] : undefined
  const row = (k: string, v: string) => <tr key={k}><th>{k}</th><td>{v}</td></tr>
  return (
    <div className="brief">
      <h2>ملف عرض المشروع · {HOLDER_LABEL[b.level]}</h2>
      <p className="sub">الموقف المالي حتى {b.at} {b.time} · يمثل وقت إنشاء الملف فقط</p>
      <h3>بطاقة المشروع</h3>
      <table><tbody>
        {row('المشروع', name)}
        {row('الجهة', entity)}
        {row('المجال', field)}
        {row('مبلغ الدعم', nf.format(b.amount))}
      </tbody></table>
      <h3>التوصيات</h3>
      <table><tbody>{[...b.recs].reverse().map((r, i) => <tr key={i}><th>{HOLDER_LABEL[r.level]} · {r.verdict}</th><td>{r.note} · {r.by} · {r.at}</td></tr>)}</tbody></table>
      {b.amounts.length > 1 && (
        <>
          <h3>تعديلات المبلغ</h3>
          <table><tbody>{b.amounts.slice(1).map((x, i) => <tr key={i}><th>{HOLDER_LABEL[x.level]}</th><td>{nf.format(x.from)} ← {nf.format(x.to)} · {x.reason}</td></tr>)}</tbody></table>
        </>
      )}
      <h3>مخرجات المؤسسة</h3>
      {b.orgOutputs.length ? <ul>{b.orgOutputs.map((o) => <li key={o}>{o}</li>)}</ul> : <p className="sub">لا مخرجات مسجّلة</p>}
      {b.entityOutputs.length > 0 && <p className="sub">مخرجات الجهة كما قدّمتها (للاطلاع): {b.entityOutputs.join(' ؛ ')}</p>}
      <h3>التقرير السابق</h3>
      {prior ? (
        <table><tbody>
          {row('المشروع', `${prior.projectName} · ${prior.projectId}`)}
          {prior.closedAt ? row('أُغلق في', prior.closedAt) : null}
          {prior.report.beneficiaries !== null ? row('المستفيدون الفعليون', nf.format(prior.report.beneficiaries)) : null}
          {prior.report.budget !== null ? row('الميزانية الفعلية', nf.format(prior.report.budget)) : null}
          {prior.report.outcomes ? row('النتائج', prior.report.outcomes) : null}
          {typeof prior.evaluation?.score === 'number' ? row('تقييم المشروع', `${nf.format(prior.evaluation.score)} من 100`) : null}
        </tbody></table>
      ) : <p className="sub">لا تقرير سابق · لا مشروع مغلق سابق للجهة</p>}
      <h3>الشروط</h3>
      {b.conditions.length ? <ul>{b.conditions.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="sub">لا شروط</p>}
      <h3>الموقف المالي</h3>
      <table><tbody>
        {one ? <>
          {row('البند', `${one.label} · ${one.budget}`)}
          {row('المخصص', nf.format(one.allocated))}
          {row('المعتمد النهائي', nf.format(one.finalApproved))}
          {row('الحجوزات المبدئية', nf.format(one.initial))}
          {row('الرصيد المتاح فعليًا', nf.format(one.available))}
        </> : b.fin.lines.map((x) => row(`${x.label} · ${x.budget}`, `حصة ${nf.format(x.share)} · مخصص ${nf.format(x.allocated)} · معتمد نهائي ${nf.format(x.finalApproved)} · مبدئي ${nf.format(x.initial)} · متاح ${nf.format(x.available)}`))}
        {row('الحد الأعلى الممكن للزيادة', nf.format(b.fin.maxRaise))}
        {row('الرصيد المتوقع بعد القرار', nf.format(b.fin.afterDecision))}
      </tbody></table>
      <h3>وثيقة المشروع والمرفقات</h3>
      {docs.length ? <ul>{docs.map((d) => <li key={d}>{d}</li>)}</ul> : <p className="sub">لا مرفقات</p>}
      <p className="sub">أعدّه النظام · {b.by}</p>
    </div>
  )
}

export default function BriefPage() {
  const { id = '', brief = '' } = useParams()
  const navigate = useNavigate()
  useApprovals()
  const p = projectRows.find((x) => x.id === id)
  const b = appFlowOf(id).briefs.find((x) => x.id === brief)
  const docs = flowOf(id).docs.map((d) => d.name)
  return (
    <AppLayout assistantContext={assistFor.page('ملف العرض')}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="ملف الاعتماد" onClick={() => navigate(ROUTES.projectTab(id, 'approval'))} />
          {!p || !b ? (
            <Glass><Empty title="ملف العرض غير موجود." note="يُنشأ عند وصول المشروع للمدير التنفيذي أو اللجنة أو المجلس." /></Glass>
          ) : (
            <>
              <header>
                <div>
                  <h1 className="ptitle">ملف العرض · {HOLDER_LABEL[b.level]}</h1>
                  <p className="sub mt-1">{p.name} · <Money sm>{b.amount}</Money></p>
                </div>
                <span className="rowf gp-2">
                  <Tag tone="mute">لقطة {b.at} {b.time}</Tag>
                  <button className="btn btn-2" onClick={() => setTimeout(printArea, 60)}><Icon name={icons.export} size="sm" />PDF للبريد</button>
                </span>
              </header>
              <Glass>
                <Head title="محتوى الملف" meta={<span className="sub">جاهز للطباعة إلى PDF والإرسال بالبريد</span>} />
                <BriefBody b={b} name={p.name} entity={p.entityName} field={p.field} docs={docs} prior={priorReport(p.entityId, p.id)} />
              </Glass>
              {createPortal(<div className="printsheet"><BriefBody b={b} name={p.name} entity={p.entityName} field={p.field} docs={docs} prior={priorReport(p.entityId, p.id)} /></div>, document.body)}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
