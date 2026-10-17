import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BackTo, DateField, FieldSelect, Glass, Head, KV, MoneyField, Tag } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { FIELDS_BY_TRACK, GOALS_BY_FIELD, REGIONS, TRACKS } from '@/data/mock/taxonomy'
import { nf } from '@/lib/format'
import {
  EXT_CFG, EXT_CREATE, EXT_FUNDING, EXT_KIND, EXT_METHODS, EXT_PROJECT_FIELD_SAY, createExternalProject, externalDraftIssues, externalParties, usePartners,
  type ExtProjectDraft,
} from '@/data/partners/store'
import { Said } from './parts'

/* v3 · 11.2.2 · 11.4.3 · a project supported through an external party, created inside the system by the
   authority with the simplified data the settings name · no portal, no internal agreement, no plan ·
   it is then studied and approved like any project (11.2.4). The party is a reference record (11.2.1). */

export default function ExternalNewPage() {
  usePartners()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const parties = externalParties()
  const [v, setV] = useState<ExtProjectDraft>({ name: '', party: parties[0]?.id ?? '', track: '', field: '', goal: '', description: '', amount: 0, days: 0, funding: '', method: '', region: '', startAt: '', files: [] })
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const put = <K extends keyof ExtProjectDraft>(k: K, x: ExtProjectDraft[K]) => setV((s) => ({ ...s, [k]: x }))
  const missing = externalDraftIssues(v)
  const req = (k: keyof typeof EXT_PROJECT_FIELD_SAY) => (EXT_CFG.project.includes(k) ? '' : ' · اختياري')
  const may = EXT_CREATE.includes(role.key)

  const send = () => {
    const out = createExternalProject(v, user.name, role.key)
    if (out.errors.length || !out.id) { setSaid({ bad: [`ينقص: ${out.errors.join('، ')}`] }); return }
    navigate(ROUTES.project(out.id))
  }

  return (
    <AppLayout assistantContext={assistFor.page('مشروع مدعوم عبر جهة خارجية')}>
      <div className="viewstack">
        <div className="screen col hasg2">
          <BackTo label="الشركاء" onClick={() => navigate(ROUTES.partnersTab('external'))} />
          <header>
            <div>
              <h1 className="ptitle">مشروع مدعوم عبر جهة خارجية</h1>
              <p className="sub mt-1">نموذج مبسط · يُدرس ويُعتمد بالمسار المعتاد · بلا بوابة ولا اتفاقية داخلية ولا خطة</p>
            </div>
          </header>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="الجهة الخارجية" meta={<Tag tone="teal">{EXT_KIND}</Tag>} />
                <div className="regfields">
                  <label className="regf">
                    <span className="lb">الجهة الخارجية</span>
                    <FieldSelect value={v.party} onChange={(x) => put('party', x)} label="الجهة الخارجية" options={parties.map((e) => ({ value: e.id, label: e.name }))} />
                    <span className="sub regf-h">من السجلات المرجعية المعتمدة · لا حساب بوابة لها</span>
                  </label>
                  <label className="regf"><span className="lb">طريقة التحويل أو التنفيذ{req('method')}</span><FieldSelect value={v.method} onChange={(x) => put('method', x)} label="طريقة التحويل أو التنفيذ" options={[...EXT_METHODS]} /></label>
                </div>
              </Glass>

              <Glass>
                <Head title="بيانات المشروع" />
                <div className="regfields">
                  <label className="regf ptn-wide"><span className="lb">اسم المشروع</span><span className="fld"><input value={v.name} onChange={(e) => put('name', e.target.value)} aria-label="اسم المشروع" /></span></label>
                  <label className="regf"><span className="lb">المسار</span><FieldSelect value={v.track} onChange={(x) => setV((s) => ({ ...s, track: x, field: '', goal: '' }))} label="المسار" options={[...TRACKS]} /></label>
                  <label className="regf"><span className="lb">المجال</span><FieldSelect value={v.field} onChange={(x) => setV((s) => ({ ...s, field: x, goal: '' }))} label="المجال" options={FIELDS_BY_TRACK[v.track] ?? []} /></label>
                  <label className="regf"><span className="lb">الهدف{req('goal')}</span><FieldSelect value={v.goal} onChange={(x) => put('goal', x)} label="الهدف" options={GOALS_BY_FIELD[v.field] ?? []} /></label>
                  <label className="regf"><span className="lb">المبلغ</span><MoneyField value={v.amount ? String(v.amount) : ''} onChange={(x) => put('amount', Number(x) || 0)} label="مبلغ المشروع" /></label>
                  <label className="regf"><span className="lb">مدة التنفيذ بالأيام</span><span className="fld"><input inputMode="numeric" value={v.days ? String(v.days) : ''} onChange={(e) => put('days', Number(e.target.value.replace(/[^\d]/g, '')) || 0)} aria-label="مدة التنفيذ بالأيام" /></span></label>
                  <label className="regf"><span className="lb">تاريخ البدء{req('startAt')}</span><DateField value={v.startAt} onChange={(x) => put('startAt', x)} label="تاريخ البدء" /></label>
                  <label className="regf"><span className="lb">المنطقة{req('region')}</span><FieldSelect value={v.region} onChange={(x) => put('region', x)} label="المنطقة" options={[...REGIONS]} /></label>
                  <label className="regf"><span className="lb">مصدر التمويل{req('funding')}</span><FieldSelect value={v.funding} onChange={(x) => put('funding', x)} label="مصدر التمويل" options={[...EXT_FUNDING]} /></label>
                </div>
                <label className="regf mt-3"><span className="lb">الوصف{req('description')}</span><span className="fld"><textarea rows={3} value={v.description} onChange={(e) => put('description', e.target.value)} aria-label="وصف المشروع" /></span></label>
                <div className="apv-row mt-3">
                  <span className="sub">{v.files.length ? v.files.join(' · ') : `المرفقات المتاحة${req('files')}`}</span>
                  <UploadButton label="مرفق" onPick={(f) => put('files', [...v.files, f.name])} />
                </div>
              </Glass>

              <Glass>
                <KV rows={[{ k: 'المبلغ', v: `${nf.format(v.amount)} ريال` }, { k: 'ينقص', v: missing.length ? missing.join('، ') : 'لا شيء' }]} />
                <div className="apv-row mt-3">
                  <button type="button" className="btn btn-p" disabled={!may || missing.length > 0} onClick={send}>أنشئ المشروع وأرسله للدراسة</button>
                  {!may && <span className="sub">يُنشئه صاحب الصلاحية · مشرف المنح أو مدير المنح</span>}
                </div>
                <Said said={said} />
              </Glass>
            </div>
            <AssistantAside
              title="مراجعة البيانات"
              cta="راجع البيانات"
              empty="البيانات المبسطة مكتملة · يُرسل للدراسة والاعتماد بالمسار المعتاد."
              ask={false}
              readings={missing.length ? [{ id: 'xn-miss', kind: 'flag', label: 'ينقص', text: missing.join('، '), src: /* doc 11.4.3 */ '' }] : []}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
