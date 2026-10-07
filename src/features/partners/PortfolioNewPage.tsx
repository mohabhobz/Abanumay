import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BackTo, FieldSelect, Glass, Head, KV, MoneyField, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { projectById } from '@/data/mock/projects'
import { FIELDS_BY_TRACK, TRACKS } from '@/data/mock/taxonomy'
import { nf } from '@/lib/format'
import { createPortfolio, profileOf, strategicPartners, typeAllowed, usePartners } from '@/data/partners/store'
import { Said } from './parts'

/* A new portfolio (13.2.2 · 13.2.3 · 13.2.4).

   The supervisor creates one internally for an approved strategic partner, or converts a project
   under study into one (`?from=`); the partner requests one from its portal (`?as=partner&entity=`)
   with its data, goals and value. Either way it's sent for study and climbs the usual approval
   path; nothing about it is managed before the final approval. The partner list offers approved
   strategic partners only, and only those a portfolio is allowed for (11.2.2 · 13.4.1). */

export default function PortfolioNewPage() {
  usePartners()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useRole()
  const asPartner = params.get('as') === 'partner'
  const from = params.get('from') ? projectById(params.get('from')!) : undefined
  const fixed = params.get('entity') ?? from?.entityId ?? ''
  const options = strategicPartners().filter((p) => typeAllowed(p.entityId, 'portfolio'))
  const [entityId, setEntity] = useState(fixed || options[0]?.entityId || '')
  const [name, setName] = useState(from?.name ?? '')
  const [total, setTotal] = useState(from ? String(from.amountRequested) : '')
  const [track, setTrack] = useState(from?.track ?? '')
  const [field, setField] = useState(from?.field ?? '')
  const [goals, setGoals] = useState('')
  const [summary, setSummary] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const prof = profileOf(entityId)

  const save = (send: boolean) => {
    const out = createPortfolio({
      name, entityId, total: Number(total) || 0, track, field, goals, summary, files,
      origin: asPartner ? 'partner' : 'internal', channel: prof?.platform ? 'ehsan' : 'direct',
    }, send, asPartner ? prof?.name ?? user.name : user.name, from?.id)
    if (out.errors.length || !out.id) { setSaid({ bad: [`ينقص: ${out.errors.join('، ')}`] }); return }
    navigate(`${ROUTES.portfolio(out.id)}${asPartner ? '?as=partner' : ''}`)
  }

  const missing = [!entityId && 'الشريك', !name.trim() && 'الاسم', !(Number(total) > 0) && 'القيمة', !goals.trim() && 'الأهداف', !track && 'المسار', !field && 'المجال', !files.length && 'وثيقة المحفظة'].filter(Boolean) as string[]

  return (
    <AppLayout assistantContext={assistFor.page('محفظة جديدة')}>
      <div className="viewstack">
        <div className="screen col hasg2">
          <BackTo label={asPartner ? 'البوابة' : 'الشركاء'} onClick={() => navigate(asPartner ? `${ROUTES.entityPortal}?entity=${fixed}` : ROUTES.partners)} />
          <header>
            <div>
              <h1 className="ptitle">{asPartner ? 'طلب محفظة' : from ? 'تحويل المشروع إلى محفظة' : 'محفظة جديدة'}</h1>
              <p className="sub mt-1">{from ? `من المشروع ${from.id} · يُؤرشف بعد التحويل وتبدأ المحفظة مسار الاعتماد` : 'تُدرس وتُعتمد كاملةً مرة واحدة · ثم الخطة والاتفاقية · ثم المشاريع الفرعية'}</p>
            </div>
          </header>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="الشريك ونوع المشروع" meta={<Tag tone="teal">محفظة</Tag>} />
                <div className="regfields">
                  <label className="regf">
                    <span className="lb">الشريك الاستراتيجي</span>
                    {fixed ? <span className="fld"><input value={prof?.name ?? ''} readOnly aria-label="الشريك الاستراتيجي" /></span> : (
                      <FieldSelect value={entityId} onChange={setEntity} label="الشريك الاستراتيجي" options={options.map((p) => ({ value: p.entityId, label: p.name }))} />
                    )}
                    <span className="sub regf-h">الجهات المعتمدة بنوع «شريك استراتيجي» والمسموح لها بالمحافظ وحدها</span>
                  </label>
                  <label className="regf">
                    <span className="lb">منصة الشريك</span>
                    <span className="fld"><input value={prof?.platform ? 'منصة إحسان · تنفّذ الدفعات بنفسها' : 'بلا منصة · تُطلب الدفعات على مستوى المحفظة'} readOnly aria-label="منصة الشريك" /></span>
                  </label>
                </div>
              </Glass>

              <Glass>
                <Head title="بيانات المحفظة" />
                <div className="regfields">
                  <label className="regf"><span className="lb">اسم المحفظة</span><span className="fld"><input value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم المحفظة" /></span></label>
                  <label className="regf"><span className="lb">القيمة الإجمالية</span><MoneyField value={total} onChange={setTotal} label="قيمة المحفظة" /></label>
                  <label className="regf"><span className="lb">المسار</span><FieldSelect value={track} onChange={(v) => { setTrack(v); setField('') }} label="المسار" options={[...TRACKS]} /></label>
                  <label className="regf"><span className="lb">المجال</span><FieldSelect value={field} onChange={setField} label="المجال" options={FIELDS_BY_TRACK[track] ?? []} /><span className="sub regf-h">يرثه كل مشروع فرعي</span></label>
                </div>
                <label className="regf mt-3"><span className="lb">أهداف المحفظة</span><span className="fld"><textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} aria-label="أهداف المحفظة" /></span></label>
                <label className="regf mt-3"><span className="lb">وصف مختصر</span><span className="fld"><textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="وصف المحفظة" /></span></label>
                <div className="apv-row mt-3">
                  <span className="sub">{files.length ? files.join(' · ') : 'وثيقة المحفظة ومرفقاتها'}</span>
                  <UploadButton label="مرفق" onPick={(f) => setFiles((x) => [...x, f.name])} />
                </div>
              </Glass>

              <Glass>
                <KV rows={[{ k: 'القيمة', v: `${nf.format(Number(total) || 0)} ريال` }, { k: 'ينقص', v: missing.length ? missing.join('، ') : 'لا شيء' }]} />
                <div className="apv-row mt-3">
                  <button type="button" className="btn btn-2" onClick={() => save(false)}>احفظ مسودة</button>
                  <button type="button" className="btn btn-p" disabled={missing.length > 0} onClick={() => save(true)}>{asPartner ? 'أرسل الطلب' : 'أرسل للدراسة'}</button>
                </div>
                <Said said={said} />
              </Glass>
            </div>
            <AssistantAside
              title="مراجعة الطلب"
              cta="راجع الطلب"
              empty="الطلب مكتمل · يُرسل لمشرف المنح للدراسة."
              ask={!asPartner}
              readings={missing.length ? [{ id: 'pn-miss', kind: 'flag', label: 'ينقص', text: missing.join('، '), src: '13.2.3' }] : []}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
