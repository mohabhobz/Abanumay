import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DateField, DateText, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, Tag, icons } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { nf } from '@/lib/format'
import { entityById } from '@/data/mock/entities'
import { planOfProject } from '@/data/mock/plans'
import type { ProjectRow } from '@/types/domain'
import {
  PTYPE_SAY, addEhOp, closeEhsanProject, ehCloseChecks, ehCloseOf, ehGate, ehMoney, ehOpsOf, ehScheduleOf, isStrategic,
  openEhsanPlan, paysOf, pfOfEntity, profileOf, recordEhsanPay, reviewEhsanPay, routeProject, proposeRoute, decideRoute, routeProposalOf, saveEhReport, saveEhSchedule,
  setPartnerTypes, typeAllowed, usePartners, viaEhsan, PF_STAGE_SAY, PF_STAGE_TONE, decidePartner,
  EH_STATE_SAY, EH_STATE_TONE, type EhSlot, type EhsanPay, type PayTarget, type PType,
} from '@/data/partners/store'

/* Partner pieces shared by the project page, the entity page, the portfolio and the partners
   hub · each states what it waits on and why, like every card in the system. */


/** A small result line · what was recorded, or why not */
export function Said({ said }: { said: { ok?: string; bad?: string[] } }) {
  return (
    <>
      {said.ok && <p className="ok-ink cnote" role="status">سُجّل: <b>{said.ok}</b></p>}
      {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}
    </>
  )
}

/** Checks as a list · a tick or a flag, and the requirement in words */
export function Checks({ items }: { items: { key: string; label: string; ok: boolean }[] }) {
  return (
    <ul className="payq-ck">
      {items.map((c) => (
        <li key={c.key} className={c.ok ? 'ok' : 'no'}>
          <Icon name={c.ok ? icons.check : icons.alert} size="sm" />
          <span>{c.label}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── Recording a payment Ehsan executed (11.2.11 · 11.2.19) ── */

export function PayForm({ target, max, onDone }: { target: PayTarget; max: number; onDone?: () => void }) {
  const { user } = useRole()
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [docs, setDocs] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const send = () => {
    const out = recordEhsanPay({ target, amount: Number(amount) || 0, ref, paidAt, docs, note: note || undefined }, user.name)
    if (out.length) { setSaid({ bad: out }); return }
    setSaid({ ok: 'الدفعة · أُحيلت للإدارة المالية' })
    setAmount(''); setRef(''); setPaidAt(''); setDocs([]); setNote('')
    onDone?.()
  }
  return (
    <div className="ptn-form">
      <div className="regfields">
        <label className="regf"><span className="lb">المبلغ المنفّذ</span><MoneyField value={amount} onChange={setAmount} label="المبلغ المنفّذ" /><span className="sub regf-h">المتبقي <span className="num">{nf.format(Math.max(0, max))}</span></span></label>
        <label className="regf"><span className="lb">رقم العملية على المنصة</span><span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="رقم العملية على منصة إحسان" /></span></label>
        <label className="regf"><span className="lb">تاريخ التنفيذ</span><DateField value={paidAt} onChange={setPaidAt} label="تاريخ التنفيذ" /></label>
        <label className="regf"><span className="lb">ملاحظة</span><span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الدفعة" /></span></label>
      </div>
      <div className="apv-row mt-2">
        <span className="sub">{docs.length ? docs.join(' · ') : 'إشعار التحويل أو مستند المنصة · إلزامي'}</span>
        <UploadButton label="مستند الدفعة" onPick={(f) => setDocs((d) => [...d, f.name])} />
        <button type="button" className="btn btn-p btn-sm" onClick={send}>سجّل الدفعة</button>
      </div>
      <Said said={said} />
    </div>
  )
}

/** The payments recorded on one target · with their state and the finance desk's word */
export function PayList({ list, finance }: { list: EhsanPay[]; finance?: boolean }) {
  const { user } = useRole()
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  if (!list.length) return <p className="sub cnote">لا دفعات مسجلة بعد.</p>
  const act = (id: string, a: 'confirm' | 'return') => {
    const out = reviewEhsanPay(id, a, note, user.name)
    setSaid(out.length ? { bad: out } : { ok: a === 'confirm' ? 'تأكيد الدفعة' : 'إعادة الدفعة' })
    if (!out.length) setNote('')
  }
  return (
    <>
      <div className="tblwrap">
        <table className="tbl" aria-label="الدفعات عبر منصة إحسان">
          <thead><tr><th><span className="th-t">العملية</span></th><th><span className="th-t">التاريخ</span></th><th className="n"><span className="th-t">المبلغ</span></th><th><span className="th-t">الحالة</span></th>{finance && <th><span className="th-t">المراجعة</span></th>}</tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td><span className="num">{p.ref}</span><span className="sub"> · {p.docs.join('، ')}</span></td>
                <td><DateText>{p.paidAt}</DateText></td>
                <td className="n"><Money sm>{p.amount}</Money></td>
                <td><Tag tone={EH_STATE_TONE[p.state]}>{EH_STATE_SAY[p.state]}</Tag>{p.reviewNote && <span className="sub"> · {p.reviewNote}</span>}</td>
                {finance && (
                  <td>{p.state === 'review' ? (
                    <span className="rowf gp-2">
                      <button type="button" className="btn btn-p btn-sm" onClick={() => act(p.id, 'confirm')}>تأكيد</button>
                      <button type="button" className="btn btn-2 btn-sm" onClick={() => act(p.id, 'return')}>إعادة</button>
                    </span>
                  ) : <span className="sub">{p.reviewedBy ?? '—'}</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {finance && list.some((p) => p.state === 'review') && (
        <label className="regf mt-2"><span className="lb">ملاحظة الإعادة</span><span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة الإعادة" placeholder="إلزامية عند الإعادة" /></span></label>
      )}
      <Said said={said} />
    </>
  )
}

/** A payment schedule editor · rows of value and due date (11.2.16 · 13.2.24) */
export function SlotsEditor({ slots, total, onSave, locked }: { slots: EhSlot[]; total: number; onSave: (s: EhSlot[]) => string[]; locked?: boolean }) {
  const [rows, setRows] = useState<{ amount: string; dueAt: string }[]>(() => (slots.length ? slots : [{ no: 1, amount: 0, dueAt: '' }]).map((s) => ({ amount: s.amount ? String(s.amount) : '', dueAt: s.dueAt })))
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  if (locked) {
    return (
      <ul className="ptn-slots">
        {slots.map((s) => <li key={s.no}><span>الدفعة <span className="num">{s.no}</span></span><Money sm>{s.amount}</Money><DateText>{s.dueAt}</DateText></li>)}
      </ul>
    )
  }
  return (
    <div className="ptn-form">
      {rows.map((r, i) => (
        <div key={i} className="regfields">
          <label className="regf"><span className="lb">الدفعة {i + 1}</span><MoneyField value={r.amount} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, amount: v } : y)))} label={`قيمة الدفعة ${i + 1}`} /></label>
          <label className="regf"><span className="lb">الاستحقاق</span><DateField value={r.dueAt} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, dueAt: v } : y)))} label={`استحقاق الدفعة ${i + 1}`} /></label>
        </div>
      ))}
      <div className="apv-row mt-2">
        <span className={`sub${sum !== total ? ' bad' : ''}`}>المجموع <span className="num">{nf.format(sum)}</span> من <span className="num">{nf.format(total)}</span></span>
        <button type="button" className="btn btn-2 btn-sm" onClick={() => setRows((x) => [...x, { amount: '', dueAt: '' }])}>دفعة أخرى</button>
        <button type="button" className="btn btn-p btn-sm" onClick={() => {
          const out = onSave(rows.map((r, i) => ({ no: i + 1, amount: Number(r.amount) || 0, dueAt: r.dueAt })))
          setSaid(out.length ? { bad: out } : { ok: 'جدول الدفعات' })
        }}>احفظ الجدول</button>
      </div>
      <Said said={said} />
    </div>
  )
}

/* ── The routing decision on a project under study (11.2.4 · 11.2.5) ── */

export function RoutingCard({ row }: { row: ProjectRow }) {
  usePartners()
  const { role, user } = useRole()
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const navigate = useNavigate()
  const strategic = isStrategic(row.entityId)
  const study = row.statusGroup === 'في الدراسة'
  const type: PType = row.partnerType === 'محفظة' ? 'portfolio' : 'independent'
  /* Batch 7 · partners#4 · 11.1.input-1 · the supervisor proposes the routing in the study, the
     executive decides it · the executive may also decide directly */
  const ceo = role.key === 'ceo' && study
  const sup = role.key === 'supervisor' && study
  const prop = routeProposalOf(row.id)
  const [why, setWhy] = useState('')
  const set = (platform: boolean, t: PType) => {
    if (t === 'portfolio') { navigate(`${ROUTES.portfolioNew}?entity=${row.entityId}&from=${row.id}`); return }
    const out = ceo ? routeProject(row.id, platform, t, user.name) : proposeRoute(row.id, platform, t, why, user.name)
    setSaid(out.length ? { bad: out } : { ok: ceo ? (platform ? 'التوجيه عبر منصة إحسان' : 'الدعم المباشر') : 'اقتراح التوجيه للمدير التنفيذي' })
  }
  const decide = (accept: boolean) => {
    const out = decideRoute(row.id, accept, why, user.name)
    setSaid(out.length ? { bad: out } : { ok: accept ? 'إقرار التوجيه' : 'رفض الاقتراح' })
    if (!out.length) setWhy('')
  }
  const mine = (sup && !prop) || ceo
  return (
    <Glass>
      <Head title="التوجيه عبر الشريك" meta={row.platform ? <Tag tone="teal">منصة إحسان</Tag> : <Tag tone="mute">دعم مباشر</Tag>} />
      <KV rows={[
        { k: 'منصة الشريك', v: row.platform ?? 'بلا منصة · الجهة تستلم مباشرة' },
        ...(strategic ? [{ k: 'نوع المشروع', v: PTYPE_SAY[type] }] : []),
        ...(prop ? [{ k: 'اقتراح بانتظار المدير التنفيذي', v: <>{prop.platform ? 'عبر منصة إحسان' : 'دعم مباشر'} · <Person name={prop.by} />{prop.note ? ` · ${prop.note}` : ''}</> }] : []),
      ]} />
      {ceo && prop && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="ملاحظة على اقتراح التوجيه" placeholder="سبب الرفض" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => decide(false)}>ارفض الاقتراح</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => decide(true)}>أقرّ التوجيه</button>
        </div>
      )}
      {mine ? (
        <div className="apv-row mt-3">
          {sup && <span className="fld"><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="مبرّر الاقتراح" placeholder="مبرّر الاقتراح · اختياري" /></span>}
          <button type="button" className="btn btn-2 btn-sm" disabled={Boolean(row.platform)} onClick={() => set(true, 'independent')}>توجيه عبر منصة إحسان</button>
          {row.platform && <button type="button" className="btn btn-2 btn-sm" onClick={() => set(false, 'independent')}>دعم مباشر</button>}
          {sup && <span className="sub">يُرفع اقتراحًا · يقرّه المدير التنفيذي</span>}
          {strategic && typeAllowed(row.entityId, 'portfolio') && <button type="button" className="btn btn-2 btn-sm" onClick={() => set(Boolean(row.platform), 'portfolio')}>تحويل إلى محفظة</button>}
        </div>
      ) : (
        <p className="sub cnote">{study ? (prop ? 'الاقتراح عند المدير التنفيذي' : 'يقترحه مشرف المنح في الدراسة ويقرّه المدير التنفيذي') : 'حُدّد قبل الاعتماد · لا يتغيّر بعده'}</p>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── A project of its own through Ehsan · plan, schedule, payments, follow-ups and closing ── */

export function EhsanCard({ row }: { row: ProjectRow }) {
  usePartners()
  const { role, user } = useRole()
  const [kind, setKind] = useState('زيارة ميدانية')
  const [note, setNote] = useState('')
  const [ref, setRef] = useState('')
  const [report, setReport] = useState(() => ehCloseOf(row.id)?.report ?? '')
  const [evidence, setEvidence] = useState<string[]>(() => ehCloseOf(row.id)?.evidence ?? [])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  if (!viaEhsan(row.id)) return null
  const g = ehGate(row.id)
  const m = ehMoney(row.id)
  const plan = planOfProject(row.id)
  const sched = ehScheduleOf(row.id)
  const sup = role.key === 'supervisor'
  const fin = role.key === 'finance'
  const closed = Boolean(ehCloseOf(row.id)?.closedAt)
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })

  return (
    <>
      <Glass>
        <Head title="مشروع عبر منصة إحسان" meta={<Tag tone="teal">{closed ? 'مغلق' : 'مستقل · بلا اتفاقية'}</Tag>} />
        <KV rows={[
          { k: 'الشريك', v: <Link className="tlink" to={ROUTES.entity(row.entityId)}>{row.entityName}</Link> },
          { k: 'الاتفاقية', v: <span className="sub">لا يوجد · يُكتفى بالخطة وجدول الدفعات والمستندات (11.2.17)</span> },
          { k: 'الخطة', v: plan ? <Link className="tlink" to={ROUTES.plan(plan.id)}>خطة المشروع · {plan.stage === 'active' || plan.stage === 'done' ? 'معتمدة' : 'قيد الإعداد'}</Link> : g.plan && sup ? <button type="button" className="btn btn-2 btn-sm" onClick={() => r(openEhsanPlan(row.id, user.name), 'فتح الخطة')}>أعدّ الخطة</button> : <span className="sub">{g.why}</span> },
          { k: 'قيمة المشروع', v: <Money sm>{m.value}</Money> },
          { k: 'نفّذته المنصة · مؤكد', v: <Money sm>{m.confirmed}</Money> },
          { k: 'بانتظار المالية', v: <Money sm>{m.review}</Money> },
          { k: 'المتبقي', v: <Money sm>{m.left}</Money> },
        ]} />
        <Said said={said} />
      </Glass>

      <Glass>
        <Head title="جدول الدفعات" meta={<span className="sub">بعد الاعتماد والخطة</span>} />
        {g.schedule
          ? <SlotsEditor slots={sched} total={m.value} locked={!sup || closed || m.recorded > 0} onSave={(s) => saveEhSchedule(row.id, s, user.name)} />
          : <p className="sub cnote">{g.why}</p>}
        {sup && m.recorded > 0 && <p className="sub cnote">الجدول مقفل بعد أول دفعة · يُعدَّل بقرار تعديل القيمة (10.9).</p>}
      </Glass>

      <Glass>
        <Head title="الدفعات المنفّذة عبر إحسان" meta={<span className="sub">يسجّلها المشرف · تؤكّدها المالية</span>} />
        <PayList list={paysOf({ kind: 'project', projectId: row.id })} finance={fin} />
        {sup && !closed && (g.pay ? <PayForm target={{ kind: 'project', projectId: row.id }} max={m.left} /> : <p className="sub cnote">{g.why}</p>)}
      </Glass>

      <Glass>
        <Head title="متابعة المشروع على المنصة" meta={<span className="sub">ما جرى على إحسان ينعكس هنا</span>} />
        <ul className="plchg">
          {ehOpsOf(row.id).slice().reverse().map((o, i) => (
            <li key={`${o.at}-${i}`}>
              <div className="plchg-h"><Tag tone="mute"><DateText>{o.at}</DateText></Tag><span className="sub">{o.kind} · {o.by}{o.ref ? ` · ${o.ref}` : ''}</span></div>
              <p className="plchg-t">{o.note}</p>
            </li>
          ))}
        </ul>
        {sup && !closed && (
          <div className="regfields mt-3">
            <label className="regf"><span className="lb">النوع</span><FieldSelect value={kind} onChange={setKind} label="نوع المتابعة" options={['زيارة ميدانية', 'تحديث تنفيذ', 'عملية على المنصة', 'ملاحظة']} /></label>
            <label className="regf"><span className="lb">المرجع على المنصة</span><span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="مرجع المتابعة" /></span></label>
            <label className="regf ptn-wide"><span className="lb">ما جرى</span><span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ما جرى" /></span></label>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = addEhOp(row.id, kind, note, user.name, ref || undefined); r(out, 'المتابعة'); if (!out.length) { setNote(''); setRef('') } }}>سجّل</button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="إغلاق المشروع" meta={closed ? <Tag tone="ok">أُغلق <DateText>{ehCloseOf(row.id)!.closedAt!}</DateText></Tag> : <Tag tone="mute">يكتبه المشرف</Tag>} />
        <Checks items={ehCloseChecks(row.id)} />
        {sup && !closed && (
          <>
            <label className="regf mt-3"><span className="lb">التقرير الختامي</span><span className="fld"><textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} aria-label="التقرير الختامي" /></span></label>
            <div className="apv-row mt-2">
              <span className="sub">{evidence.length ? evidence.join(' · ') : 'الشواهد · صور التنفيذ ومحاضر التسليم'}</span>
              <UploadButton label="شاهد" onPick={(f) => setEvidence((x) => [...x, f.name])} />
              <button type="button" className="btn btn-2 btn-sm" onClick={() => r(saveEhReport(row.id, report, evidence, user.name), 'التقرير الختامي')}>احفظ التقرير</button>
              <button type="button" className="btn btn-p btn-sm" disabled={ehCloseChecks(row.id).some((c) => !c.ok)} onClick={() => r(closeEhsanProject(row.id, user.name), 'إغلاق المشروع')}>أغلق المشروع</button>
            </div>
          </>
        )}
      </Glass>
    </>
  )
}

/* ── The entity's partnership · type, state and allowed project types (11.2.1 · 11.2.2) ── */

export function PartnerCard({ entityId }: { entityId: string }) {
  usePartners()
  const { role, user } = useRole()
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const p = profileOf(entityId)
  if (!p) return null
  const mgr = role.key === 'grants-manager'
  const toggle = (t: PType) => {
    const next = p.allowed.includes(t) ? p.allowed.filter((x) => x !== t) : [...p.allowed, t]
    if (!next.length) { setSaid({ bad: ['نوع واحد على الأقل'] }); return }
    setPartnerTypes(entityId, next, user.name)
    setSaid({ ok: 'الأنواع المسموحة' })
  }
  const pfs = pfOfEntity(entityId)
  return (
    <Glass>
      {/* Re-audit 7 Oct · the card names its entity · the hub listed identical «الشراكة الاستراتيجية» cards */}
      <Head title={<>الشراكة الاستراتيجية · <Link className="tlink" to={ROUTES.entity(entityId)}>{p.name || entityById(entityId)?.name || entityId}</Link></>} meta={<Tag tone={p.state === 'approved' ? 'ok' : p.state === 'review' ? 'warn' : 'no'}>{p.state === 'approved' ? 'شريك استراتيجي معتمد' : p.state === 'review' ? 'بانتظار اعتماد مدير المنح' : 'مرفوض'}</Tag>} />
      <KV rows={[
        { k: 'نوع الشراكة', v: 'شريك استراتيجي' },
        { k: 'منصة تنفيذ الدفعات', v: p.platform ? 'منصة إحسان · تنفّذ الدفعات بنفسها' : 'تُطلب الدفعات على مستوى المحفظة' },
        { k: 'أنواع المشاريع المسموحة', v: p.allowed.map((t) => PTYPE_SAY[t]).join(' · ') },
        { k: 'المحافظ', v: pfs.length ? <span className="ptn-chips">{pfs.map((x) => <Link key={x.id} className="tlink" to={ROUTES.portfolio(x.id)}>{x.name} <Tag tone={PF_STAGE_TONE[x.stage]}>{PF_STAGE_SAY[x.stage]}</Tag></Link>)}</span> : <span className="sub">لا محافظ بعد</span> },
      ]} />
      {mgr && p.state === 'approved' && (
        <div className="apv-row mt-3">
          <span className="sub">الأنواع المسموحة</span>
          {(['independent', 'portfolio'] as PType[]).map((t) => (
            <button key={t} type="button" className={`btn btn-sm ${p.allowed.includes(t) ? 'btn-2' : 'btn-ghost'}`} aria-pressed={p.allowed.includes(t)} onClick={() => toggle(t)}>{PTYPE_SAY[t]}</button>
          ))}
        </div>
      )}
      {mgr && p.state === 'review' && (
        <div className="apv-row mt-3">
          <button type="button" className="btn btn-p btn-sm" onClick={() => { decidePartner(entityId, 'approve', '', user.name); setSaid({ ok: 'اعتماد الشريك' }) }}>اعتمد الشريك</button>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { decidePartner(entityId, 'reject', 'لا تنطبق شروط الشراكة', user.name); setSaid({ ok: 'رفض الشريك' }) }}>ارفض</button>
        </div>
      )}
      {p.state === 'approved' && p.allowed.includes('portfolio') && role.key === 'supervisor' && (
        <div className="apv-row mt-3"><Link className="btn btn-2 btn-sm" to={`${ROUTES.portfolioNew}?entity=${entityId}`}>محفظة جديدة</Link></div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/** A project's agreement tab when the support goes through Ehsan · the exemption, said (11.2.17) */
export function EhsanNoAgreement({ children }: { children?: ReactNode }) {
  return (
    <Glass>
      <Head title="الاتفاقية" meta={<Tag tone="teal">معفى</Tag>} />
      <p className="prose">المشروع موجّه عبر منصة إحسان كمشروع مستقل · لا تُعدّ له اتفاقية، ويُكتفى بالخطة وجدول الدفعات والمستندات، وتنفّذ المنصة الدفعات ويؤكّدها قسم المالية.</p>
      {children}
    </Glass>
  )
}
