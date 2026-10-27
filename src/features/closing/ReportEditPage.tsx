import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, Icon, Num, Tag, icons } from '@/components/ui'
import { DocList, DocReadNote, UploadButton, useDocReads, type DocRow } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { MISSING_ITEM, nounAfter } from '@/lib/format'
import {
  CLOSE_DOCS, STOPPED_DOCS, closeById, evalApproved, reportBlockers,
} from '@/data/mock/closing'
import { projectRows } from '@/data/mock/projects'
import { addLink, attachDoc, saveReport, useClosing } from '@/data/closing/store'
import { ReportFiles, TargetActual } from './report'
import { REPORT_TERMS, type TvaKey } from './reportData'

/* Final report editor - written by the entity.

   Note: the four required fields are named in rule 4 verbatim: "actual number of beneficiaries,
   actual budget, execution duration, and key outputs and results achieved" - they aren't optional,
   and the asterisk on them says so.

   Note: every field shows the approved figure next to it. This is the one real difference between
   this editor and any other form in the system: while writing "780", the entity can see the
   approved figure was "1,000" - so it writes the explanation into "challenges" on its own instead
   of the reviewer sending it back to ask. A number with no reference gets written carelessly.

   Note: after final closure the page locks - rule 21: any change after closing needs a new
   procedure, so there are no fields, only a display.

   Note: no hand-built attachments table here - `DocList` is the one shape, enforced elsewhere. This
   lesson repeated after the checker was written, so it's stated explicitly here. */

export default function ReportEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asEntity = params.get('as') === 'entity'
  useClosing()
  const c = closeById(id)

  const [ben, setBen] = useState(c?.report.beneficiaries?.toString() ?? '')
  const [budget, setBudget] = useState(c?.report.budget?.toString() ?? '')
  const [days, setDays] = useState(c?.report.days?.toString() ?? '')
  const [outcomes, setOutcomes] = useState(c?.report.outcomes ?? '')
  const [risks, setRisks] = useState(c?.report.risks ?? '')
  const [link, setLink] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const { reads, read } = useDocReads()
  /* v3 · 10.4.4 · 10.4.7 */
  const [value, setValue] = useState(c?.report.projectValue?.toString() ?? '')
  const [outs, setOuts] = useState<{ text: string; achieved: string }[]>(c?.report.outputs ?? [])
  const [contribution, setContribution] = useState(c?.report.contribution ?? '')
  const [template, setTemplate] = useState<'foundation' | 'own'>(c?.report.template ?? 'own')

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('تقرير غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.closings)}>
                    العودة إلى صندوق الإغلاق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  /* The entity writes while the report is with it · in review or after closing it reads (rule 21) */
  /* Re-audit 7 Oct · the report is the entity's to write, from its own account · staff read it (10.2.4) */
  const closed = evalApproved(c) || (c.stage !== 'draft' && c.stage !== 'returned') || !asEntity
  const back = `${ROUTES.closing(c.id)}${asEntity ? '?as=entity' : ''}`
  const num = (v: string) => (v === '' ? null : Number(v))
  const onSave = () => {
    /* Client 21 Oct (#6) · the costs are two figures · the store derives the support line from them */
    saveReport(c.id, {
      beneficiaries: num(ben), budget: num(budget), days: num(days), outcomes, risks,
      projectValue: num(value), outputs: outs, contribution, template,
    }, asEntity ? c.entityName : c.owner)
    navigate(back)
  }
  const missing = reportBlockers(c)
  /* 10 Oct · the invoices are read for the support spent the report states */
  const spentTotal = Number(budget) || 0
  const tva: Partial<Record<TvaKey, string>> = { ben, days, total: value, support: budget }
  const setTva = (k: TvaKey, v: string) => ({ ben: setBen, days: setDays, total: setValue, support: setBudget })[k](v)

  const stopped = c.basis === 'stopped'
  const grant = projectRows.find((p) => p.id === c.projectId)?.amountGranted ?? 0
  const partial = Number(value) > grant && grant > 0
  /* Client 21 Oct (#8) · the invoices are never required · a supporting document like the rest */
  const reqOf = (k: string, req?: boolean) => (stopped ? STOPPED_DOCS.includes(k) : Boolean(req))
  /* v3 · 10.4.7 · the foundation's template · the mandatory data stays entered here either way */
  const downloadTemplate = () => {
    const body = [
      `التقرير الختامي · ${c.projectName}`, `الجهة: ${c.entityName}`, '',
      '1. قيمة المشروع الإجمالية ومساهمة المؤسسة', '2. المخرجات والنتائج المتفق عليها والمتحقق منها', ...(c.report.outputs ?? []).map((o) => `   · ${o.text}`),
      '3. النتائج الفعلية', '4. عدد المستفيدين الفعلي', '5. مدة التنفيذ الفعلية', '6. الشواهد', '7. علاقة مساهمة المؤسسة بما تحقق (عند التمويل الجزئي)', '8. التحديات والانحرافات',
    ].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `قالب التقرير الختامي · ${c.projectId}.txt`; a.click(); URL.revokeObjectURL(url)
  }

  const docRows: DocRow[] = CLOSE_DOCS.filter((d) => d.key !== 'invoices' || c.report.docs.includes('invoices') || !closed).map((d) => ({
    name: c.report.files?.[d.key] ?? `${d.label}.pdf`,
    meta: reqOf(d.key, d.req) ? /* doc rule 4 */ 'مستند إلزامي' : /* doc rule 5 */ 'مستند داعم',
    uploaded: c.report.docs.includes(d.key),
    required: reqOf(d.key, d.req),
    /* Verifier · 16 Oct · a document may be replaced before sending or after a formal return (10.4.23) */
    action: !closed
      ? (
        <UploadButton
          label={c.report.docs.includes(d.key) ? `استبدل ${d.label}` : `ارفع ${d.label}`}
          onPick={(f) => { attachDoc(c.id, d.key, c.entityName, f.name); read(d.key, f, d.key === 'invoices' || d.key === 'finrep' ? 'invoice' : 'report', (d.key === 'invoices' || d.key === 'finrep') && spentTotal ? { amount: String(spentTotal) } : {}) }}
        />
      )
      : undefined,
  }))

  return (
    <AppLayout assistantContext={assistFor.page(`تقرير ${c.projectName} الختامي`)}>
      <div className="viewstack">
        <div className="screen col">
          <BackTo label="صفحة الإغلاق" onClick={() => navigate(back)} />

          <header>
            <div>
              <h1 className="ptitle">التقرير الختامي · {c.projectName}</h1>
              {closed && (
                <p className="sub mt-1">
                  {evalApproved(c) ? /* doc rule 21 */ 'اكتمل الإغلاق · الصفحة للقراءة فقط' : 'الصفحة للقراءة'}
                </p>
              )}
            </div>
            {/* Status as text, not a colored tag - the page header isn't a card's status field.
                Counted the same way as "not blocking". */}
            {closed
              ? <Tag tone="mute">{evalApproved(c) ? 'مغلق · للقراءة' : !asEntity && (c.stage === 'draft' || c.stage === 'returned') ? 'عند الجهة' : 'في المراجعة'}</Tag>
              : <span className="sub">{missing.length > 0
                ? <>قبل الإرسال: <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</>
                : 'جاهز للإرسال'}</span>}
          </header>

          {/* Client 21 Oct (#4) · the report's terms on top · the template changes how the report looks, never
              what this form asks for · the same fields whichever the entity picks */}
          {!stopped && (
            <Glass>
              <Head title="شروط التقرير الختامي" meta={<span className="sub">{template === 'foundation' ? 'بقالب المؤسسة' : 'بنموذج الجهة الخاص'}</span>} />
              <ol className="rptterms">
                {REPORT_TERMS.map((t) => <li key={t}>{t}</li>)}
              </ol>
              <div className="rowf gp-2 mt-3" role="radiogroup" aria-label="نموذج التقرير">
                <button type="button" role="radio" aria-checked={template === 'foundation'} className={`cfgchip${template === 'foundation' ? ' on' : ''}`} disabled={closed} onClick={() => setTemplate('foundation')}>قالب المؤسسة</button>
                <button type="button" role="radio" aria-checked={template === 'own'} className={`cfgchip${template === 'own' ? ' on' : ''}`} disabled={closed} onClick={() => setTemplate('own')}>نموذج الجهة الخاص</button>
                <span className="pc-sp" />
                <button type="button" className="btn btn-2 btn-sm" onClick={downloadTemplate}><Icon name={icons.export} size="sm" />نزّل قالب المؤسسة</button>
              </div>
            </Glass>
          )}

          {/* Client 21 Oct (#5 · #6) · the target from the approved project beside the actual the entity writes ·
              the costs are two figures · the project's whole budget and the foundation's support */}
          {!stopped && (
            <Glass>
              <Head title="المستهدف والفعلي" />
              {closed
                ? <TargetActual c={c} />
                : <TargetActual c={c} edit values={tva} onValue={setTva} outputs={outs} onOutput={(i, v) => setOuts((x) => x.map((y, j) => (j === i ? { ...y, achieved: v } : y)))} />}
              {partial && (
                <label className="regf mt-3">
                  <span className="lb">علاقة مساهمة المؤسسة بما تحقق<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <span className="fld"><textarea rows={2} value={contribution} disabled={closed} onChange={(e) => setContribution(e.target.value)} aria-label="علاقة مساهمة المؤسسة بما تحقق" placeholder="ما الذي موّلته مساهمة المؤسسة تحديدًا من المخرجات" /></span>
                </label>
              )}
            </Glass>
          )}

          <Glass>
            <Head title="النتائج والتحديات" />

            <label className="regf">
              <span className="lb">
                {stopped ? 'ما نُفّذ حتى الإيقاف' : 'أبرز المخرجات والنتائج المحققة'}<b className="regf-r" aria-label="إلزامي">*</b>
              </span>
              <span className="fld">
                <textarea
                  rows={4}
                  value={outcomes}
                  disabled={closed}
                  onChange={(e) => setOutcomes(e.target.value)}
                  aria-label="أبرز المخرجات والنتائج المحققة"
                  placeholder="نُفّذت 42 جلسة من 48 · وخدمت 780 مستفيدًا في ستة مراكز"
                />
              </span>
            </label>

            {/* Note: "challenges" isn't required · an unexplained gap between target and actual comes
                back as a reviewer's question, and the cycle runs one extra lap. */}
            <label className="regf">
              <span className="lb">التحديات والانحرافات · اختياري</span>
              <span className="fld">
                <textarea
                  rows={3}
                  value={risks}
                  disabled={closed}
                  onChange={(e) => setRisks(e.target.value)}
                  aria-label="التحديات والانحرافات"
                  placeholder="تأخّر التوريد شهرًا في المرحلة الثانية"
                />
              </span>
            </label>
          </Glass>

          <Glass>
            <Head
              title="المستندات"
              meta={
                <span className="sub">
                  <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
                </span>
              }
            />
            <DocList rows={docRows} label="مستندات التقرير الختامي وحالتها" />
            {Object.entries(reads).map(([k, r]) => <div key={k}><span className="sub">{CLOSE_DOCS.find((d) => d.key === k)?.label}</span><DocReadNote r={r} /></div>)}
          </Glass>

          {/* Client 21 Oct (#7) · the execution files in the foundation's storage · many at once · read in place */}
          <ReportFiles c={c} edit={!closed} by={asEntity ? c.entityName : c.owner} />

          {/* An outside link stays possible · no longer the main way to send the media */}
          <Glass>
            <Head title="رابط خارجي · اختياري" meta={c.report.links.length ? <span className="sub"><Num>{c.report.links.length}</Num> رابط</span> : undefined} />
            {!closed && (
              <div className="apv-row">
                <span className="fld"><input type="url" value={link} onChange={(e) => setLink(e.target.value)} aria-label="رابط خارجي" placeholder="https://" /></span>
                <span className="fld"><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="وصف الرابط" aria-label="وصف الرابط" /></span>
                <button type="button" className="btn btn-2 btn-sm" disabled={!link.trim()} onClick={() => { const out = addLink(c.id, linkLabel, link, c.entityName); setBad(out); if (!out.length) { setLink(''); setLinkLabel('') } }}>أضف الرابط</button>
              </div>
            )}
            {c.report.links.length > 0 && <ul className="apv-list">{c.report.links.map((l) => <li key={l.url}><span className="apv-t"><b>{l.label}</b><span className="sub">{l.url}</span></span></li>)}</ul>}
            {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
          </Glass>

          {!closed && (
            <div className="act-a">
              <button type="button" className="btn btn-p" onClick={onSave}>
                احفظ وارجع إلى الطلب
              </button>
              <Link className="btn btn-2" to={back}>إلغاء</Link>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  )
}
