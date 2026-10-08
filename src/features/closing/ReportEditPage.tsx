import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackTo, Empty, Glass, Head, MoneyField, Num, Tag, Riyal } from '@/components/ui'
import { DocList, UploadButton, type DocRow } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, MISSING_ITEM, nounAfter, NOUN } from '@/lib/format'
import {
  CLOSE_DOCS, closeById, evalApproved, reportBlockers, reportGap,
} from '@/data/mock/closing'
import { addLink, attachDoc, saveReport, useClosing } from '@/data/closing/store'

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
  /* 10.1.input-3 · the financial report · spend per line and the settlements */
  const [spent, setSpent] = useState<string[]>(c?.finance?.lines.map((l) => l.spent?.toString() ?? '') ?? [])
  const [settlements, setSettlements] = useState(c?.finance?.settlements ?? '')

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('تقرير غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                note="ارجع إلى صندوق الإغلاق واختر طلبًا منه."
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
    const lines = (c.finance?.lines ?? []).map((l, i) => ({ ...l, spent: num(spent[i] ?? '') }))
    saveReport(c.id, {
      beneficiaries: num(ben), budget: num(budget), days: num(days), outcomes, risks,
      finance: { lines, settlements },
    }, asEntity ? c.entityName : c.owner)
    navigate(back)
  }
  const gaps = reportGap(c)
  const planBen = gaps.find((g) => g.key === 'ben')?.planned ?? 0
  const planBudget = gaps.find((g) => g.key === 'budget')?.planned ?? 0
  const missing = reportBlockers(c)

  const docRows: DocRow[] = CLOSE_DOCS.map((d) => ({
    name: c.report.files?.[d.key] ?? `${d.label}.pdf`,
    meta: d.req ? 'مستند إلزامي · قاعدة 4' : 'مستند داعم · قاعدة 5',
    uploaded: c.report.docs.includes(d.key),
    required: d.req,
    action: !c.report.docs.includes(d.key) && !closed
      ? (
        <UploadButton
          label={`ارفع ${d.label}`}
          onPick={(f) => attachDoc(c.id, d.key, c.entityName, f.name)}
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
              <p className="sub mt-1">
                {evalApproved(c)
                  ? 'اكتمل الإغلاق · الصفحة للقراءة فقط، وأي تعديل بعده يحتاج إلى إجراء جديد (قاعدة 21)'
                  : !asEntity && (c.stage === 'draft' || c.stage === 'returned')
                    ? 'تكتب الجهة التقرير من بوابتها · الصفحة للقراءة'
                  : closed
                    ? 'التقرير في المراجعة · يُعدَّل حين يُعاد للجهة، وكل إعادة إصدار جديد (قاعدة 19)'
                  : <>تحدّد القاعدة <span className="num">4</span> أربع بيانات حدًّا
                    أدنى · وبجانب كل منها القيمة المعتمدة ليظهر الفرق أثناء الكتابة</>}
              </p>
            </div>
            {/* Status as text, not a colored tag - the page header isn't a card's status field.
                Counted the same way as "not blocking". */}
            {closed
              ? <Tag tone="mute">{evalApproved(c) ? 'مغلق · للقراءة' : !asEntity && (c.stage === 'draft' || c.stage === 'returned') ? 'عند الجهة' : 'في المراجعة'}</Tag>
              : <span className="sub">{missing.length > 0
                ? <>قبل الإرسال: <Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</>
                : 'جاهز للإرسال'}</span>}
          </header>

          <Glass>
            <Head
              title="التنفيذ الفعلي"
              meta={<Tag tone="mute">قاعدة <Num>4</Num></Tag>}
            />

            <div className="regfields">
              <label className="regf">
                <span className="lb">
                  عدد المستفيدين الفعلي<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <span className="fld">
                  <input
                    inputMode="numeric"
                    value={ben}
                    disabled={closed}
                    onChange={(e) => setBen(e.target.value.replace(/\D/g, ''))}
                    aria-label="عدد المستفيدين الفعلي"
                    placeholder="0"
                  />
                </span>
                <span className="sub regf-h">
                  المعتمد في المشروع <span className="num">{nf.format(planBen)}</span> {nounAfter(planBen, NOUN.beneficiary)}
                </span>
              </label>

              <label className="regf">
                <span className="lb">
                  الميزانية الفعلية<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <MoneyField value={budget} disabled={closed} onChange={setBudget} label="الميزانية الفعلية" />
                <span className="sub regf-h">
                  قيمة المنحة <span className="num">{nf.format(planBudget)}</span> <Riyal />
                </span>
              </label>

              <label className="regf">
                <span className="lb">
                  مدة التنفيذ الفعلية<b className="regf-r" aria-label="إلزامي">*</b>
                </span>
                <span className="fld">
                  <input
                    inputMode="numeric"
                    value={days}
                    disabled={closed}
                    onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
                    aria-label="مدة التنفيذ الفعلية بالأيام"
                    placeholder="0"
                  />
                </span>
                <span className="sub regf-h">بالأيام · من بداية التنفيذ إلى نهايته</span>
              </label>
            </div>
          </Glass>

          <Glass>
            <Head title="المخرجات والتحديات" />

            <label className="regf">
              <span className="lb">
                أبرز المخرجات والنتائج المحققة<b className="regf-r" aria-label="إلزامي">*</b>
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
              <span className="sub regf-h">
                هذا البيان الرابع في القاعدة <span className="num">4</span> · ويقارنه
                المراجع بأهداف المشروع في الاتفاقية والخطة
              </span>
            </label>

            {/* Note: "challenges" isn't required, and it's the most important field on the page.
                Rule 4 doesn't require it, but an unexplained gap between approved and actual comes
                back as a reviewer's question, and the cycle runs one extra lap. The line under the
                field says this outright. */}
            <label className="regf">
              <span className="lb">التحديات والانحرافات</span>
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
              <span className="sub regf-h">
                اختياري · لكن أي فرق عن المعتمد بلا تفسير يعود سؤالًا من المراجعة،
                والإعادة تُنشئ إصدارًا جديدًا (قاعدة <span className="num">19</span>)
              </span>
            </label>
          </Glass>

          <Glass>
            <Head
              title="المستندات الداعمة"
              meta={
                <span className="sub">
                  <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
                </span>
              }
            />
            <DocList rows={docRows} label="المستندات الداعمة للتقرير الختامي وحالتها" />

            {/* A cloud link is a different attachment type, not a substitute for one - rule 5 names
                Google Drive explicitly, for a practical reason. */}
            <label className="regf">
              <span className="lb">رابط تخزين سحابي</span>
              <span className="fld">
                <input
                  type="url"
                  value={link}
                  disabled={closed}
                  onChange={(e) => setLink(e.target.value)}
                  aria-label="رابط تخزين سحابي"
                  placeholder="https://drive.google.com/..."
                />
              </span>
              <span className="sub regf-h">
                تسمح القاعدة <span className="num">5</span> بإرسال المواد الإعلامية
                والفيديوهات روابطَ تخزين معتمدة · فهي عادةً أكبر من أي حدّ رفع
              </span>
            </label>
            {!closed && (
              <div className="apv-row mt-2">
                <span className="fld"><input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="وصف الرابط" aria-label="وصف الرابط" /></span>
                <button type="button" className="btn btn-2 btn-sm" disabled={!link.trim()} onClick={() => { const out = addLink(c.id, linkLabel, link, c.entityName); setBad(out); if (!out.length) { setLink(''); setLinkLabel('') } }}>أضف الرابط</button>
              </div>
            )}
            {c.report.links.length > 0 && (
              <ul className="apv-list">
                {c.report.links.map((l) => <li key={l.url}><span className="apv-t"><b>{l.label}</b><span className="sub">{l.url}</span></span></li>)}
              </ul>
            )}
            {bad.map((b) => <p key={b} className="bad cnote">{b}</p>)}
          </Glass>

          {/* 10.1.input-3 · the final financial report · each line's spend against what was approved */}
          <Glass>
            <Head title="التقرير المالي الختامي" meta={<Tag tone="mute">المدخل 3</Tag>} />
            <div className="regfields">
              {(c.finance?.lines ?? []).map((l, i) => (
                <label className="regf" key={l.label}>
                  <span className="lb">{l.label}<b className="regf-r" aria-label="إلزامي">*</b></span>
                  <MoneyField value={spent[i] ?? ''} disabled={closed} onChange={(v) => setSpent((x) => { const n = [...x]; n[i] = v; return n })} label={`المصروف في ${l.label}`} />
                  <span className="sub regf-h">المعتمد <span className="num">{nf.format(l.approved)}</span> <Riyal /></span>
                </label>
              ))}
            </div>
            <label className="regf">
              <span className="lb">التسويات المالية</span>
              <span className="fld">
                <textarea rows={2} value={settlements} disabled={closed} onChange={(e) => setSettlements(e.target.value)} aria-label="التسويات المالية" placeholder="مبالغ معلّقة لدى المورّدين أو مردودات أو فروق أسعار" />
              </span>
              <span className="sub regf-h">ما بقي من التزامات أو مردودات · ويطابقه المشرف بالفواتير قبل الاعتماد</span>
            </label>
          </Glass>

          {!closed && (
            <div className="act-a">
              <button type="button" className="btn btn-p" onClick={onSave}>
                احفظ وارجع إلى الطلب
              </button>
              <Link className="btn btn-2" to={back}>إلغاء</Link>
            </div>
          )}

          {/* The save note is shown only when a save button is present. */}
          {!closed && (
            <p className="sub tcen">
              الحفظ لا يُرسل التقرير · الإرسال للمراجعة من صفحة الطلب، وتمنعه القاعدة{' '}
              <span className="num">3</span> قبل اكتمال البيانات والمستندات.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
