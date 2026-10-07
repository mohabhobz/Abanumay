import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Glass, Head, Money, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import { HOLD_STAGE_SAY, linkOf, usableLines } from '@/data/budget/store'
import {
  PF_STAGE_SAY, PF_STAGE_TONE, PROFILES, PTYPE_SAY, PORTFOLIOS, ehMoney, ehsanProjects, financeQueue, partnerReport, pfMoney,
  usePartners, actOnPfReq,
} from '@/data/partners/store'
import { PartnerCard, PayList } from './parts'
import { AnalysisCard } from '@/components/assistant'
import { readFiles } from '@/data/shared/ai'
import { useState } from 'react'

/* Strategic partners · one hub for BPD-011 and BPD-013.

   Five views of the same records: the partners and their settings, the portfolios with their
   stage and position, the projects supported through Ehsan, the finance desk where every
   payment Ehsan executed or a portfolio requested waits to be confirmed, and the report that puts
   the Ehsan projects and the sub-projects next to everything else, each marked by its kind. */

const TABS = [
  { slug: 'partners', label: 'الشركاء' },
  { slug: 'portfolios', label: 'المحافظ' },
  { slug: 'ehsan', label: 'مشاريع إحسان' },
  { slug: 'finance', label: 'المراجعة المالية' },
  { slug: 'report', label: 'التقرير' },
] as const

export default function PartnersPage() {
  usePartners()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { role, user } = useRole()
  const tab = TABS.find((t) => t.slug === params.get('tab'))?.slug ?? 'partners'
  const fq = financeQueue()
  const [ref, setRef] = useState('')
  const alloc = usableLines('fy-2026').filter((l) => l.node.id === 'tPg1' || l.node.id === 'tPg2')
  const items = TABS.map((t) => ({ ...t, count: t.slug === 'finance' ? fq.pays.length + fq.requests.length : t.slug === 'portfolios' ? PORTFOLIOS.length : undefined }))

  return (
    <AppLayout assistantContext={assistFor.page('الشركاء الاستراتيجيون')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الشركاء الاستراتيجيون</h1>
              <p className="sub mt-1">منصة إحسان والمحافظ · <span className="num">{PROFILES.filter((p) => p.state === 'approved').length}</span> شريك معتمد · <span className="num">{PORTFOLIOS.length}</span> محافظ</p>
            </div>
            {role.key === 'supervisor' && <button type="button" className="btn btn-2" onClick={() => navigate(ROUTES.portfolioNew)}>محفظة جديدة</button>}
          </header>

          <Tabs items={items} active={tab} onChange={(s) => setParams({ tab: s })} />

          {tab === 'partners' && (
            <>
              <Glass>
                <Head title="مخصص الشراكات في الميزانية" meta={<span className="sub">ميزانية المنح 2026 · مسار الشراكات الاستراتيجية</span>} />
                <ul className="ptn-slots">
                  {alloc.map((l) => <li key={l.key}><span>{l.node.label}</span><span className="sub">المخصص <Money sm>{l.node.allocated}</Money></span><span className="sub">المتاح <Money sm>{l.free}</Money></span></li>)}
                </ul>
              </Glass>
              {PROFILES.map((p) => <PartnerCard key={p.entityId} entityId={p.entityId} />)}
              <p className="sub cnote">يُسجَّل الشريك من «تسجيل جهة داخليًا» بنوع «شريك استراتيجي» · ويعتمده مدير المنح هنا أو من ملف الجهة.</p>
            </>
          )}

          {tab === 'portfolios' && (
            <Glass className="tblcard">
              <div className="tblwrap">
                <table className="tbl" aria-label="المحافظ">
                  <thead><tr><th><span className="th-t">المحفظة</span></th><th><span className="th-t">الشريك</span></th><th><span className="th-t">المرحلة</span></th><th className="n"><span className="th-t">القيمة</span></th><th className="n"><span className="th-t">المعتمد · قيد الاعتماد</span></th><th className="n"><span className="th-t">المصروف</span></th><th><span className="th-t">الحجز</span></th></tr></thead>
                  <tbody>
                    {PORTFOLIOS.map((pf) => {
                      const m = pfMoney(pf)
                      const l = linkOf(pf.id)
                      return (
                        <tr key={pf.id}>
                          <td><Link className="tlink" to={ROUTES.portfolio(pf.id)}>{pf.name}</Link><span className="sub"> · {pf.id}</span></td>
                          <td className="sub">{PROFILES.find((p) => p.entityId === pf.entityId)?.name}</td>
                          <td><Tag tone={PF_STAGE_TONE[pf.stage]}>{PF_STAGE_SAY[pf.stage]}</Tag></td>
                          <td className="n"><Money sm>{pf.total}</Money></td>
                          <td className="n"><span className="num">{nf.format(m.approved)}</span><span className="sub"> · {nf.format(m.pending)}</span></td>
                          <td className="n"><Money sm>{m.confirmed}</Money></td>
                          <td className="sub">{l ? HOLD_STAGE_SAY[l.stage] : 'لم يُحجز'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}

          {tab === 'ehsan' && (
            <Glass className="tblcard">
              <div className="tblwrap">
                <table className="tbl" aria-label="مشاريع عبر منصة إحسان">
                  <thead><tr><th><span className="th-t">المشروع</span></th><th><span className="th-t">النوع</span></th><th><span className="th-t">المرحلة</span></th><th className="n"><span className="th-t">القيمة</span></th><th className="n"><span className="th-t">نفّذته المنصة</span></th><th className="n"><span className="th-t">بانتظار المالية</span></th></tr></thead>
                  <tbody>
                    {ehsanProjects().map((p) => {
                      const m = ehMoney(p.id)
                      return (
                        <tr key={p.id}>
                          <td><Link className="tlink" to={ROUTES.project(p.id)}>{p.name}</Link><span className="sub"> · {p.id}</span></td>
                          <td><Tag tone="teal">{p.partnerType === 'محفظة' ? PTYPE_SAY.portfolio : PTYPE_SAY.independent} · إحسان</Tag></td>
                          <td className="sub">{p.stage}</td>
                          <td className="n"><Money sm>{m.value}</Money></td>
                          <td className="n"><Money sm>{m.confirmed}</Money></td>
                          <td className="n"><Money sm>{m.review}</Money></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}

          {tab === 'finance' && (
            <>
              <Glass>
                <Head title="دفعات نفّذتها منصة إحسان" meta={<span className="sub">مراجعة المستندات وتأكيد الحالة · يعاينها المدير التنفيذي عن المالية</span>} />
                <PayList list={fq.pays} finance={role.key === 'ceo'} />
              </Glass>
              {/* Cross · each operation's documents read against its amount, number and date */}
              {fq.pays.some((x) => x.state === 'review') && (
                <AnalysisCard
                  title="قراءة مستندات الدفعات"
                  cta="اقرأ المستندات"
                  ask={false}
                  onAsk={() => undefined}
                  readings={fq.pays.filter((x) => x.state === 'review').map((x) => readFiles(`ai-eh-${x.id}`, `العملية ${x.ref}`, x.docs, { amount: x.amount, ref: x.ref, date: x.paidAt }))}
                />
              )}
              <Glass>
                <Head title="طلبات صرف على مستوى المحفظة" />
                {fq.requests.length ? (
                  <ul className="ptn-slots">
                    {fq.requests.map(({ pf, r }) => (
                      <li key={r.id}>
                        <Link className="tlink" to={ROUTES.portfolio(pf.id)}>{pf.name}</Link>
                        <span>الدفعة <span className="num">{r.no}</span></span>
                        <Money sm>{r.amount}</Money>
                        {role.key === 'ceo' && (
                          <span className="rowf gp-2">
                            <span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="رقم أمر التحويل" placeholder="رقم أمر التحويل" /></span>
                            <button type="button" className="btn btn-p btn-sm" onClick={() => actOnPfReq(pf.id, r.id, 'pay', '', user.name, ref)}>صرف</button>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : <p className="sub cnote">لا طلبات لدى المالية.</p>}
              </Glass>
            </>
          )}

          {tab === 'report' && (
            <Glass className="tblcard">
              <Head title="مشاريع الشركاء في التقارير" meta={<span className="sub">مميّزة بنوعها · تدخل التقارير العامة</span>} />
              <div className="tblwrap">
                <table className="tbl" aria-label="تقرير الشركاء">
                  <thead><tr><th><span className="th-t">النوع</span></th><th><span className="th-t">الاسم</span></th><th><span className="th-t">الشريك أو المحفظة</span></th><th><span className="th-t">المنطقة</span></th><th className="n"><span className="th-t">القيمة</span></th><th className="n"><span className="th-t">المصروف</span></th><th><span className="th-t">الحالة</span></th></tr></thead>
                  <tbody>
                    {partnerReport().map((x) => (
                      <tr key={x.key}>
                        <td><Tag tone={x.kind === 'محفظة' ? 'teal' : x.kind === 'مشروع فرعي' ? 'mute' : 'ok'}>{x.kind}</Tag></td>
                        <td><Link className="tlink" to={x.href}>{x.name}</Link></td>
                        <td className="sub">{x.partner}</td>
                        <td className="sub">{x.region}</td>
                        <td className="n"><Money sm>{x.value}</Money></td>
                        <td className="n"><Money sm>{x.paid}</Money></td>
                        <td className="sub">{x.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
