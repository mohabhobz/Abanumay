import { NextStep } from '@/components/assistant/NextStep'
import { useDocReads } from '@/lib/docCache'
import { suggestNext } from '@/data/shared/agent'
import { rowGo } from '@/lib/rowGo'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FieldSelect, Glass, Head, KV, Money, Tabs, Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { nf } from '@/lib/format'
import { HOLD_STAGE_SAY, linkOf, usableLines } from '@/data/budget/store'
import {
  PF_STAGE_SAY, PF_STAGE_TONE, PROFILES, PORTFOLIOS, ehMoney, ehsanProjects, financeQueue, partnerReport, pfMoney,
  usePartners, actOnPfReq,
  EXT_ADMIN, EXT_CFG, EXT_CREATE, EXT_KIND, EXT_PARTY_FIELD_SAY, EXT_PROJECT_FIELD_SAY, createExternalParty, externalClosingsWaiting, externalParties, saveExtCfg,
  type ExtPartyField, type ExtProjectField,
  reviewEhsanPay,
} from '@/data/partners/store'
import { paidOf } from '@/data/payments/store'
import { REGIONS } from '@/data/mock/taxonomy'
import { PartnerCard, PayList, Said } from './parts'
import { ReconcileTab } from './Reconcile'
import { AnalysisCard } from '@/components/assistant'
import { externalDigest, readFiles } from '@/data/shared/ai'
import { useState } from 'react'

/* Strategic partners · one hub for BPD-011 and BPD-013.

   Five views of the same records: the partners and their settings, the portfolios with their
   stage and position, the projects supported through Ehsan, the finance desk where every
   payment Ehsan executed or a portfolio requested waits to be confirmed, and the report that puts
   the Ehsan projects and the sub-projects next to everything else, each marked by its kind. */

const TABS = [
  { slug: 'partners', label: 'الشركاء' },
  { slug: 'portfolios', label: 'المحافظ' },
  { slug: 'external', label: 'الجهات الخارجية' },
  { slug: 'ehsan', label: 'المشاريع عبر جهات خارجية' },
  { slug: 'finance', label: 'المراجعة المالية' },
  { slug: 'reconcile', label: 'مطابقة المنصة' },
  { slug: 'report', label: 'التقرير' },
] as const

export default function PartnersPage() {
  usePartners()
  useDocReads() /* 11.6.1 · the transfer proofs' content once it's read */
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { role, user } = useRole()
  const tab = TABS.find((t) => t.slug === params.get('tab'))?.slug ?? 'partners'
  const fq = financeQueue()
  /* Re-audit 7 Oct · one transfer number per request, and the refusal said beside it */
  const [refs, setRefs] = useState<Record<string, string>>({})
  const [refErr, setRefErr] = useState<Record<string, string>>({})
  const alloc = usableLines('fy-2026').filter((l) => l.node.id === 'tPg1' || l.node.id === 'tPg2')
  const items = TABS.map((t) => ({ ...t, count: t.slug === 'finance' ? fq.pays.length + fq.requests.length : t.slug === 'portfolios' ? PORTFOLIOS.length : t.slug === 'external' ? externalParties().length : t.slug === 'ehsan' ? ehsanProjects().length : undefined }))
  /* v3 · 11.4.14 · 11.1.output-4 · the report filtered by kind and by the external party */
  const [kindF, setKindF] = useState('')
  const [partyF, setPartyF] = useState('')
  const rows = partnerReport().filter((x) => (!kindF || x.kind === kindF) && (!partyF || x.partner === partyF))

  return (
    <AppLayout assistantContext={assistFor.page('الشركاء الاستراتيجيون')}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">الشركاء الاستراتيجيون</h1>
              <p className="sub mt-1">المشاريع المدعومة عبر جهات خارجية والمحافظ · <span className="num">{PROFILES.filter((p) => p.state === 'approved').length}</span> شريك معتمد · <span className="num">{PORTFOLIOS.length}</span> محافظ</p>
            </div>
            <span className="rowf gp-2">
              {EXT_CREATE.includes(role.key) && <button type="button" className="btn btn-2" onClick={() => navigate(ROUTES.externalNew)}>مشروع عبر جهة خارجية</button>}
              {role.key === 'supervisor' && <button type="button" className="btn btn-2" onClick={() => navigate(ROUTES.portfolioNew)}>محفظة جديدة</button>}
            </span>
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
                        <tr key={pf.id} {...rowGo(navigate, ROUTES.portfolio(pf.id))}>
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

          {tab === 'external' && <ExternalTab />}

          {tab === 'reconcile' && <ReconcileTab me={user.name} canAct={role.key === 'finance' || role.key === 'admin'} />}

          {tab === 'ehsan' && (
            <Glass className="tblcard">
              <div className="tblwrap">
                <table className="tbl" aria-label="المشاريع المدعومة عبر جهات خارجية">
                  <thead><tr><th><span className="th-t">المشروع</span></th><th><span className="th-t">الجهة الخارجية</span></th><th><span className="th-t">الحالة</span></th><th className="n"><span className="th-t">القيمة</span></th><th className="n"><span className="th-t">صُرف بأذونات النظام</span></th><th className="n"><span className="th-t">عمليات بانتظار المالية</span></th></tr></thead>
                  <tbody>
                    {ehsanProjects().map((p) => {
                      const m = ehMoney(p.id)
                      return (
                        <tr key={p.id} {...rowGo(navigate, ROUTES.project(p.id))}>
                          <td><Link className="tlink" to={ROUTES.project(p.id)}>{p.name}</Link><span className="sub"> · {p.id}</span></td>
                          <td><Tag tone="teal">{p.platform}</Tag></td>
                          <td className="sub">{p.statusGroup} · {p.stage}</td>
                          <td className="n"><Money sm>{m.value}</Money></td>
                          <td className="n"><Money sm>{paidOf(p.id)}</Money></td>
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
                <Head title="عمليات منصات الجهات الخارجية" meta={<span className="sub">مراجعة المستندات وتأكيد الحالة · الإدارة المالية</span>} />
                <PayList list={fq.pays} finance={role.key === 'finance'} />
              </Glass>
              {/* Cross · each operation's documents read against its amount, number and date */}
              {fq.pays.some((x) => x.state === 'review') && (
                <AnalysisCard
                  title="قراءة مستندات الدفعات"
                  cta="اقرأ المستندات"
                  ask={false}
                  onAsk={() => undefined}
                  suggest={role.key === 'finance' ? <EhsanNext pays={fq.pays} user={user.name} /> : undefined}
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
                        {r.why && <span className="sub">{r.why}</span>}
                        {role.key === 'finance' && r.state === 'finance' && (
                          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfReq(pf.id, r.id, 'order', '', user.name); setRefErr((m) => ({ ...m, [r.id]: out.join(' · ') })) }}>اعتمد أمر الصرف</button>
                        )}
                        {role.key === 'finance' && r.state === 'order' && (
                          <span className="rowf gp-2">
                            <span className="fld"><input value={refs[r.id] ?? ''} onChange={(e) => setRefs((m) => ({ ...m, [r.id]: e.target.value }))} aria-label={`رقم أمر التحويل · الدفعة ${r.no}`} placeholder="رقم أمر التحويل" /></span>
                            <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfReq(pf.id, r.id, 'pay', '', user.name, refs[r.id] ?? ''); setRefErr((m) => ({ ...m, [r.id]: out.length ? `ينقص: ${out.join(' · ')}` : '' })) }}>صرف</button>
                            {refErr[r.id] && <span className="bad">{refErr[r.id]}</span>}
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
              <div className="ftool-f mb-2">
                <FieldSelect value={kindF} onChange={setKindF} label="النوع" options={[{ value: '', label: 'كل الأنواع' }, ...[EXT_KIND, 'محفظة', 'مشروع فرعي'].map((k) => ({ value: k, label: k }))]} />
                <FieldSelect value={partyF} onChange={setPartyF} label="الجهة الخارجية أو الشريك" options={[{ value: '', label: 'كل الجهات' }, ...[...new Set(partnerReport().map((x) => x.partner))].map((k) => ({ value: k, label: k }))]} />
                <span className="sub"><span className="num">{rows.length}</span> صفًّا</span>
              </div>
              <div className="tblwrap">
                <table className="tbl" aria-label="تقرير الشركاء">
                  <thead><tr><th><span className="th-t">النوع</span></th><th><span className="th-t">الاسم</span></th><th><span className="th-t">الشريك أو المحفظة</span></th><th><span className="th-t">المنطقة</span></th><th className="n"><span className="th-t">القيمة</span></th><th className="n"><span className="th-t">المصروف</span></th><th><span className="th-t">الحالة</span></th></tr></thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.key} {...rowGo(navigate, x.href)}>
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

/* v3 · 11.2.1 · 11.4.1 · 11.4.2 · the external parties' reference records · no portal account, no user,
   no representative · and the minimum the foundation asks of a party and of its project (11.4.3) */
function ExternalTab() {
  usePartners()
  const navigate = useNavigate()
  const { role, user } = useRole()
  const may = EXT_ADMIN.includes(role.key)
  const [v, setV] = useState({ name: '', region: '', city: '', transfer: '', refs: '' })
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const [cfg, setCfg] = useState<{ party: ExtPartyField[]; project: ExtProjectField[] }>(() => ({ party: [...EXT_CFG.party], project: [...EXT_CFG.project] }))
  const [cfgSaid, setCfgSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const waiting = externalClosingsWaiting()
  const add = () => {
    const out = createExternalParty(v, user.name, role.key)
    setSaid(out.errors.length ? { bad: out.errors } : { ok: `السجل المرجعي · ${v.name}` })
    if (!out.errors.length) setV({ name: '', region: '', city: '', transfer: '', refs: '' })
  }
  const flip = <K extends 'party' | 'project'>(k: K, f: (K extends 'party' ? ExtPartyField : ExtProjectField)) =>
    setCfg((c) => ({ ...c, [k]: (c[k] as string[]).includes(f) ? (c[k] as string[]).filter((x) => x !== f) : [...(c[k] as string[]), f] }))
  const digest = externalDigest(ehsanProjects())
  return (
    <>
      {/* Batch 8 · 11.6.3 · a periodic digest over every external project */}
      {digest && <AnalysisCard title="ملخص دوري" cta="حدّث الملخص" ask={false} onAsk={() => undefined} readings={[digest]} />}
      <Glass className="tblcard">
        <Head title="السجلات المرجعية للجهات الخارجية" meta={<span className="sub">لا حساب بوابة · لا مستخدم · لا ممثل تنفيذي</span>} />
        <div className="tblwrap">
          <table className="tbl" aria-label="الجهات الخارجية">
            <thead><tr><th><span className="th-t">الجهة</span></th><th><span className="th-t">بيانات التحويل</span></th><th><span className="th-t">البيانات المرجعية</span></th><th className="n"><span className="th-t">المشاريع</span></th><th><span className="th-t">أنشأه</span></th></tr></thead>
            <tbody>
              {externalParties().map((e) => (
                <tr key={e.id}>
                  <td><Link className="tlink" to={ROUTES.entity(e.id)}>{e.name}</Link><span className="sub"> · {e.id}</span></td>
                  <td className="sub">{e.external?.transfer ?? '—'}</td>
                  <td className="sub">{e.external?.refs ?? '—'}</td>
                  <td className="n"><span className="num">{ehsanProjects().filter((p) => p.externalId === e.id).length}</span></td>
                  <td className="sub">{e.external?.by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>
      {may && (
        <Glass>
          <Head title="سجل مرجعي جديد" meta={<span className="sub">صاحب صلاحية تسجيل الجهات واعتمادها</span>} />
          <div className="regfields">
            <label className="regf"><span className="lb">اسم الجهة الخارجية</span><span className="fld"><input value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} aria-label="اسم الجهة الخارجية" /></span></label>
            <label className="regf"><span className="lb">المنطقة · اختياري</span><FieldSelect value={v.region} onChange={(x) => setV((y) => ({ ...y, region: x }))} label="منطقة الجهة الخارجية" options={[...REGIONS]} /></label>
            <label className="regf"><span className="lb">بيانات الحساب أو التحويل{EXT_CFG.party.includes('transfer') ? '' : ' · إذا لزم'}</span><span className="fld"><input value={v.transfer} onChange={(e) => setV((x) => ({ ...x, transfer: e.target.value }))} aria-label="بيانات الحساب أو التحويل" /></span></label>
            <label className="regf"><span className="lb">البيانات المرجعية{EXT_CFG.party.includes('refs') ? '' : ' · اختياري'}</span><span className="fld"><input value={v.refs} onChange={(e) => setV((x) => ({ ...x, refs: e.target.value }))} aria-label="البيانات المرجعية" /></span></label>
          </div>
          <div className="apv-row mt-3"><button type="button" className="btn btn-p btn-sm" onClick={add}>أنشئ السجل المرجعي</button></div>
          <Said said={said} />
        </Glass>
      )}
      <Glass>
        <Head title="الحد الأدنى من البيانات" meta={<span className="sub">{may ? 'قابل للإعداد' : 'للاطلاع'}</span>} />
        <KV rows={[
          { k: 'الجهة الخارجية', v: <span className="rowf gp-2">{(Object.keys(EXT_PARTY_FIELD_SAY) as ExtPartyField[]).map((f) => <button key={f} type="button" disabled={!may} className={`btn btn-sm ${cfg.party.includes(f) ? 'btn-2' : 'btn-ghost'}`} aria-pressed={cfg.party.includes(f)} onClick={() => flip('party', f)}>{EXT_PARTY_FIELD_SAY[f]}</button>)}</span> },
          { k: 'المشروع · فوق الاسم والجهة والمسار والمجال والمبلغ والمدة', v: <span className="rowf gp-2">{(Object.keys(EXT_PROJECT_FIELD_SAY) as ExtProjectField[]).map((f) => <button key={f} type="button" disabled={!may} className={`btn btn-sm ${cfg.project.includes(f) ? 'btn-2' : 'btn-ghost'}`} aria-pressed={cfg.project.includes(f)} onClick={() => flip('project', f)}>{EXT_PROJECT_FIELD_SAY[f]}</button>)}</span> },
        ]} />
        {may && <div className="apv-row mt-3"><button type="button" className="btn btn-p btn-sm" onClick={() => { const out = saveExtCfg(cfg, user.name, role.key); setCfgSaid(out.length ? { bad: out } : { ok: 'الحد الأدنى من البيانات' }) }}>احفظ الإعداد</button></div>}
        <Said said={cfgSaid} />
        <p className="sub cnote">الحقل المفعَّل إلزامي · ولا يلزم المشروع الخارجي استيفاء كل حقول المشروع العادي{/* doc 11.4.3 */}.</p>
      </Glass>
      {waiting.length > 0 && (
        <Glass>
          <Head title="إغلاقات بانتظار مدير المنح" />
          <ul className="ptn-slots">{waiting.map((p) => <li key={p.id}><Link className="tlink" to={ROUTES.project(p.id)}>{p.name}</Link><span className="sub">{p.platform}</span></li>)}</ul>
        </Glass>
      )}
      {EXT_CREATE.includes(role.key) && <div className="apv-row"><button type="button" className="btn btn-2 btn-sm" onClick={() => navigate(ROUTES.externalNew)}>مشروع مدعوم عبر جهة خارجية</button></div>}
    </>
  )
}

/* 17 Oct · the assistant reads each operation's documents against its amount, number and date and
   suggests confirming the clean ones and returning the rest with what it found · the officer presses it */
function EhsanNext({ pays, user }: { pays: ReturnType<typeof financeQueue>['pays']; user: string }) {
  useDocReads()
  const due = pays.filter((x) => x.state === 'review')
  const read = due.map((x) => ({ x, bad: readFiles(`ai-eh-${x.id}`, x.ref, x.docs, { amount: x.amount, ref: x.ref, date: x.paidAt }).danger ?? [] }))
  const ok = read.filter((r) => !r.bad.length)
  const back = read.filter((r) => r.bad.length)
  type EhAct = { label: string; kind: string; go: 'all' | 'ok' }
  const s = suggestNext<EhAct>(due.length ? [
    { label: `تأكيد ${ok.length} وردّ ${back.length} للجهة بملاحظاتها`, kind: 'btn-p', go: 'all' },
    ...(back.length && ok.length ? [{ label: `تأكيد السليمة فقط (${ok.length})`, kind: 'btn-2', go: 'ok' as const }] : []),
  ] : [], {
    issues: [],
    good: [...ok.slice(0, 2).map((r) => `${r.x.ref}: المستندات تطابق المبلغ والمرجع`), ...back.slice(0, 2).map((r) => `${r.x.ref}: ${r.bad[0]}`)],
  })
  const exec = (a: EhAct) => {
    const out: string[] = []
    for (const r of ok) out.push(...reviewEhsanPay(r.x.id, 'confirm', 'المستندات مطابقة للمبلغ والمرجع والتاريخ', user))
    if (a.go === 'all') for (const r of back) out.push(...reviewEhsanPay(r.x.id, 'return', r.bad.join(' · '), user))
    return out
  }
  if (!due.length) return null
  return <NextStep s={s} exec={exec} />
}
