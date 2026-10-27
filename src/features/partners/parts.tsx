import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ButtonLink, FormField, FieldBox, Button, FieldMultiSelect, DockActions, DateField, DateText, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, Tag, icons } from '@/components/ui'
import { DocReadNote, UploadButton, useDocReads } from '@/components/docs'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { nf } from '@/lib/format'
import { entityById } from '@/data/mock/entities'
import { planOfProject } from '@/data/mock/plans'
import type { ProjectRow } from '@/types/domain'
import {
  PTYPE_SAY, addEhOp, closeEhsanProject, ehCloseChecks, ehCloseOf, ehGate, ehMoney, ehOpsOf, ehScheduleOf, isStrategic,
  EXT_KIND, EXT_CREATE, EXEC_STATES, EXT_CLOSE_OUTCOME_SAY, type ExtCloseOutcome, decideExternalClosing, ehExecLog, ehExecOf, extFilesOf, externalParties, recordExec, type ExecState,
  paysOf, addExtDoc, extDocsOf, pfOfEntity, profileOf, recordEhsanPay, reviewEhsanPay, routeProject, proposeRoute, decideRoute, routeProposalOf, saveEhReport, saveEhSchedule,
  setPartnerTypes, usePartners, viaEhsan, PF_STAGE_SAY, PF_STAGE_TONE, decidePartner,
  EH_STATE_SAY, EH_STATE_TONE, type EhSlot, type EhsanPay, type PayTarget, type PType } from '@/data/partners/store'
import { flowOf } from '@/data/intake/flow'
import { paidOf, usePayments } from '@/data/payments/store'
import { payRequests } from '@/data/mock/disbursements'

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
  /* 10 Oct · the platform's notice is read for the amount and the operation number typed */
  const { reads, read } = useDocReads()
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
        <FormField label="المبلغ المنفّذ"><MoneyField value={amount} onChange={setAmount} label="المبلغ المنفّذ" /><span className="sub regf-h">المتبقي <span className="num">{nf.format(Math.max(0, max))}</span></span></FormField>
        <FormField label="رقم العملية على المنصة"><FieldBox><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="رقم العملية على منصة إحسان" /></FieldBox></FormField>
        <FormField label="تاريخ التنفيذ"><DateField value={paidAt} onChange={setPaidAt} label="تاريخ التنفيذ" /></FormField>
        <FormField label="ملاحظة"><FieldBox><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الدفعة" /></FieldBox></FormField>
      </div>
      <div className="apv-row mt-2">
        <span className="sub">{docs.length ? docs.join(' · ') : 'إشعار التحويل أو مستند المنصة · إلزامي'}</span>
        <UploadButton label="مستند الدفعة" onPick={(f) => { setDocs((d) => [...d, f.name]); read('pay', f, 'transfer', { amount, ref }) }} />
        <Button type="button" variant="p" size="sm" onClick={send}>سجّل الدفعة</Button>
      </div>
      {docs.length > 0 && <DocReadNote r={reads.pay} />}
      <Said said={said} />
    </div>
  )
}

/** The payments recorded on one target · with their state and the finance desk's word */
export function PayList({ list, finance }: { list: EhsanPay[]; finance?: boolean }) {
  const { user } = useRole()
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  /* Re-audit 17 Oct · the last one reviewed empties the list · its message still shows */
  if (!list.length) return <><p className="sub cnote">لا دفعات مسجلة بعد.</p><Said said={said} /></>
  const act = (id: string, a: 'confirm' | 'return', note: string) => {
    const out = reviewEhsanPay(id, a, note, user.name)
    setSaid(out.length ? { bad: out } : { ok: a === 'confirm' ? 'تأكيد الدفعة' : 'إعادة الدفعة' })
    return out
  }
  return (
    <>
      <div className="tblwrap">
        <table className="tbl" aria-label="عمليات منصة الجهة الخارجية">
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
                      {/* Client 26 Oct · the decision confirms in its popup · the return's reason there */}
                      <DockActions
                        actions={[{ label: 'إعادة', kind: 'btn-2 btn-sm', needsNote: true, a: 'return' as const }, { label: 'تأكيد', kind: 'btn-p btn-sm', a: 'confirm' as const }]}
                        subject={<>دفعة {p.ref} · {nf.format(p.amount)} ريال</>}
                        placeholder="سبب الإعادة"
                        onRun={(x, n) => act(p.id, x.a, n)}
                      />
                    </span>
                  ) : <span className="sub">{p.reviewedBy ?? '—'}</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Said said={said} />
    </>
  )
}

/** A payment schedule editor · rows of value and due date (11.2.16 · 13.2.24) · with `terms`, the
    requirements and conditions of each payment as the external document states them (v3 · 11.2.7) */
export function SlotsEditor({ slots, total, onSave, locked, terms, upTo }: { slots: EhSlot[]; total: number; onSave: (s: EhSlot[]) => string[]; locked?: boolean; terms?: boolean; upTo?: boolean }) {
  const [rows, setRows] = useState<{ amount: string; dueAt: string; needs: string; cond: string }[]>(() => (slots.length ? slots : [{ no: 1, amount: 0, dueAt: '' }]).map((s) => ({ amount: s.amount ? String(s.amount) : '', dueAt: s.dueAt, needs: s.needs ?? '', cond: s.cond ?? '' })))
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const sum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const off = upTo ? sum > total : sum !== total
  const put = (i: number, k: 'amount' | 'dueAt' | 'needs' | 'cond', v: string) => setRows((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)))
  if (locked) {
    return (
      <ul className="ptn-slots">
        {slots.map((s) => <li key={s.no}><span>الدفعة <span className="num">{s.no}</span></span><Money sm>{s.amount}</Money><DateText>{s.dueAt}</DateText>{s.needs && <span className="sub">المتطلبات: {s.needs}</span>}{s.cond && <span className="sub">الشرط: {s.cond}</span>}</li>)}
      </ul>
    )
  }
  return (
    <div className="ptn-form">
      {rows.map((r, i) => (
        <div key={i} className="regfields">
          <FormField label={<>الدفعة {i + 1}</>}><MoneyField value={r.amount} onChange={(v) => put(i, 'amount', v)} label={`قيمة الدفعة ${i + 1}`} /></FormField>
          <FormField label="الاستحقاق"><DateField value={r.dueAt} onChange={(v) => put(i, 'dueAt', v)} label={`استحقاق الدفعة ${i + 1}`} /></FormField>
          {terms && <FormField label="المتطلبات"><FieldBox><input value={r.needs} onChange={(e) => put(i, 'needs', e.target.value)} aria-label={`متطلبات الدفعة ${i + 1}`} placeholder="ما يُرفع قبل الصرف" /></FieldBox></FormField>}
          {terms && <FormField label="الشروط"><FieldBox><input value={r.cond} onChange={(e) => put(i, 'cond', e.target.value)} aria-label={`شروط الدفعة ${i + 1}`} placeholder="اختياري" /></FieldBox></FormField>}
        </div>
      ))}
      <div className="apv-row mt-2">
        <span className={`sub${off ? ' bad' : ''}`}>المجموع <span className="num">{nf.format(sum)}</span> {upTo ? 'لا يتجاوز' : 'من'} <span className="num">{nf.format(total)}</span></span>
        <Button type="button" variant="2" size="sm" onClick={() => setRows((x) => [...x, { amount: '', dueAt: '', needs: '', cond: '' }])}>دفعة أخرى</Button>
        {rows.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setRows((x) => x.slice(0, -1))}>احذف الأخيرة</Button>}
        <Button type="button" variant="p" size="sm" onClick={() => {
          const out = onSave(rows.map((r, i) => ({ no: i + 1, amount: Number(r.amount) || 0, dueAt: r.dueAt, ...(terms ? { needs: r.needs, cond: r.cond } : {}) })))
          setSaid(out.length ? { bad: out } : { ok: 'جدول الدفعات' })
        }}>احفظ الجدول</Button>
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
  const study = row.statusGroup === 'قيد الدراسة'
  const type: PType = row.partnerType === 'محفظة' ? 'portfolio' : 'independent'
  /* Batch 7 · partners#4 · 11.1.input-1 · the supervisor proposes the routing in the study, the
     executive decides it · the executive may also decide directly */
  const ceo = role.key === 'ceo' && study
  const sup = role.key === 'supervisor' && study
  const prop = routeProposalOf(row.id)
  const [why, setWhy] = useState('')
  /* v3 · 11.4.1 · the external party is one of the reference records */
  const parties = externalParties()
  const [party, setParty] = useState<string>(row.externalId ?? parties[0]?.id ?? '')
  const set = (platform: boolean, t: PType) => {
    if (t === 'portfolio') { navigate(`${ROUTES.portfolioNew}?entity=${row.entityId}&from=${row.id}`); return }
    const out = ceo ? routeProject(row.id, platform, t, user.name, party, role.key) : proposeRoute(row.id, platform, t, why, user.name, party, role.key)
    setSaid(out.length ? { bad: out } : { ok: ceo ? (platform ? 'التوجيه عبر الجهة الخارجية' : 'الدعم المباشر') : 'اقتراح التوجيه للمدير التنفيذي' })
  }
  const decide = (accept: boolean, why: string) => {
    const out = decideRoute(row.id, accept, why, user.name, role.key)
    setSaid(out.length ? { bad: out } : { ok: accept ? 'إقرار التوجيه' : 'رفض الاقتراح' })
    return out
  }
  const mine = (sup && !prop) || ceo
  /* v3 · 11.4.11 · a portfolio is never supported through an external party */
  const portfolioNext = role.key === 'supervisor' && row.statusGroup === 'معتمد' && flowOf(row.id).study?.classification === 'محفظة' && !row.archived && !row.platform
  return (
    <Glass>
      <Head title="الدعم عبر جهة خارجية" meta={row.platform ? <Tag tone="teal">{EXT_KIND}</Tag> : <Tag tone="mute">دعم مباشر</Tag>} />
      <KV rows={[
        { k: 'الجهة الخارجية', v: row.platform ? (row.externalId ? <Link className="tlink" to={ROUTES.entity(row.externalId)}>{row.platform}</Link> : row.platform) : 'لا جهة خارجية' },
        ...(strategic ? [{ k: 'نوع المشروع', v: PTYPE_SAY[type] }] : []),
        ...(prop ? [{ k: 'اقتراح بانتظار المدير التنفيذي', v: <>{prop.platform ? `عبر ${entityById(prop.party ?? '860')?.name ?? 'جهة خارجية'}` : 'دعم مباشر'} · <Person name={prop.by} />{prop.note ? ` · ${prop.note}` : ''}</> }] : []),
      ]} />
      {ceo && prop && (
        <div className="apv-row mt-3">
          {/* Client 26 Oct · the decision confirms in its popup · the rejection's reason there */}
          <DockActions
            actions={[{ label: 'ارفض الاقتراح', kind: 'btn-2 btn-sm', needsNote: true, accept: false }, { label: 'أقرّ التوجيه', kind: 'btn-p btn-sm', accept: true }]}
            subject={<>توجيه {row.name}</>}
            placeholder="سبب الرفض"
            onRun={(x, n) => decide(x.accept, n)}
          />
        </div>
      )}
      {mine ? (
        <div className="apv-row mt-3">
          {sup && <FieldBox><input value={why} onChange={(e) => setWhy(e.target.value)} aria-label="مبرّر الاقتراح" placeholder="مبرّر الاقتراح · اختياري" /></FieldBox>}
          {!row.platform && <FieldSelect value={party} onChange={setParty} label="الجهة الخارجية" options={parties.map((e) => ({ value: e.id, label: e.name }))} />}
          <Button type="button" variant="2" size="sm" disabled={Boolean(row.platform) || !party} onClick={() => set(true, 'independent')}>توجيه عبر الجهة الخارجية</Button>
          {row.platform && <Button type="button" variant="2" size="sm" onClick={() => set(false, 'independent')}>دعم مباشر</Button>}
        </div>
      ) : study && prop ? (
        <p className="sub cnote">الاقتراح عند المدير التنفيذي</p>
      ) : null}
      {/* v3 · 3.2.17 · an approved project classified a portfolio · the supervisor opens its path */}
      {portfolioNext && (
        <div className="apv-row mt-3">
          <Button type="button" variant="p" size="sm" onClick={() => set(false, 'portfolio')}>فعّل مسار المحفظة</Button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── A project supported through an external party (BPD-011) · its document, schedule, execution and closing ── */

export function EhsanCard({ row }: { row: ProjectRow }) {
  usePartners()
  usePayments()
  const { role, user } = useRole()
  const [kind, setKind] = useState('زيارة ميدانية')
  const [note, setNote] = useState('')
  const [ref, setRef] = useState('')
  const [report, setReport] = useState(() => ehCloseOf(row.id)?.report ?? '')
  const [evidence, setEvidence] = useState<string[]>(() => ehCloseOf(row.id)?.evidence ?? [])
  const [ex, setEx] = useState<{ status: string; progress: string; note: string; files: string[] }>(() => { const x = ehExecOf(row.id); return { status: x?.status ?? 'جارٍ التنفيذ', progress: String(x?.progress ?? ''), note: '', files: [] } })
  const [back, setBack] = useState('')
  const [outcome, setOutcome] = useState<ExtCloseOutcome>('complete')
  const [rdPurpose, setRdPurpose] = useState('')
  const [rdDecision, setRdDecision] = useState('')
  const [rdFile, setRdFile] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  if (!viaEhsan(row.id)) return null
  const g = ehGate(row.id)
  const m = ehMoney(row.id)
  const plan = planOfProject(row.id)
  const sched = ehScheduleOf(row.id)
  const sup = role.key === 'supervisor'
  const auth = EXT_CREATE.includes(role.key)
  const fin = role.key === 'finance'
  const mgr = role.key === 'grants-manager'
  const cl = ehCloseOf(row.id)
  const closed = Boolean(cl?.closedAt)
  const paid = paidOf(row.id)
  const started = payRequests.some((x) => x.projectId === row.id)
  const vals = flowOf(row.id).versions[0]?.values ?? {}
  const exec = ehExecOf(row.id)
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })

  return (
    <>
      <Glass>
        <Head title={EXT_KIND} meta={<Tag tone="teal">{closed ? 'مغلق' : 'بلا اتفاقية داخلية ولا خطة'}</Tag>} />
        <KV rows={[
          { k: 'الجهة الخارجية', v: <Link className="tlink" to={ROUTES.entity(row.externalId ?? row.entityId)}>{row.platform}</Link> },
          ...(vals.method ? [{ k: 'طريقة التحويل أو التنفيذ', v: vals.method }] : []),
          ...(vals.funding ? [{ k: 'مصدر التمويل', v: vals.funding }] : []),
          { k: 'الاتفاقية الداخلية', v: <span className="sub">لا تلزم</span> },
          /* v3 · 12.2.1 · 11.4.5 · an external project has no plan · a plan from before stays readable */
          { k: 'الخطة', v: plan ? <Link className="tlink" to={ROUTES.plan(plan.id)}>خطة سابقة للاطلاع</Link> : <span className="sub">لا تلزم</span> },
          /* v3 · 11.2.6 · the external agreement or memorandum (perhaps tripartite) kept as a reference */
          { k: 'الوثيقة الخارجية', v: (
            <span className="rowf gp-2">
              {extDocsOf(row.id).length ? extDocsOf(row.id).map((d) => <Tag key={d.file} tone="ok"><Icon name={icons.clip} size="sm" /> {d.file}</Tag>) : <span className="sub">لم تُسجَّل</span>}
              {auth && !closed && <UploadButton label="سجّل الاتفاقية أو المذكرة (PDF)" onPick={(f) => r(addExtDoc(row.id, f.name, user.name), 'الوثيقة الخارجية')} />}
            </span>
          ) },
          ...(extFilesOf(row.id).length ? [{ k: 'المرفقات', v: extFilesOf(row.id).join('، ') }] : []),
          { k: 'قيمة المشروع', v: <Money sm>{m.value}</Money> },
          { k: 'صُرف بأذونات النظام', v: <Money sm>{paid}</Money> },
          { k: 'المتبقي', v: <Money sm>{Math.max(0, m.value - paid)}</Money> },
        ]} />
        <Said said={said} />
      </Glass>

      <Glass>
        <Head title="جدول الدفعات" />
        {g.schedule
          ? <SlotsEditor slots={sched} total={m.value} terms upTo locked={!auth || closed || started} onSave={(s) => saveEhSchedule(row.id, s, user.name)} />
          : <p className="sub cnote">{g.why}</p>}
        <div className="apv-row mt-2">
          <ButtonLink variant="2" size="sm" to={ROUTES.paymentNew(row.id)}>ارفع متطلبات الدفعة نيابةً عن الجهة</ButtonLink>
        </div>
      </Glass>

      <Glass>
        <Head title="حالة التنفيذ" meta={exec ? <Tag tone={exec.status === 'منجز' ? 'ok' : exec.status === 'متعثر' ? 'no' : 'warn'}>{exec.status} · {nf.format(exec.progress)} بالمئة</Tag> : <Tag tone="mute">لم تُسجَّل</Tag>} />
        {ehExecLog(row.id).length > 0 && (
          <ul className="plchg">
            {ehExecLog(row.id).slice().reverse().map((x, i) => (
              <li key={`${x.at}-${i}`}>
                <div className="plchg-h"><Tag tone="mute"><DateText>{x.at}</DateText></Tag><span className="sub">{x.status} · {nf.format(x.progress)} بالمئة · {x.by}</span></div>
                <p className="plchg-t">{x.note || '—'}{x.files.length ? ` · ${x.files.join('، ')}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
        {auth && !closed && (
          <div className="regfields mt-3">
            <FormField label="الحالة"><FieldSelect value={ex.status} onChange={(v) => setEx((x) => ({ ...x, status: v }))} label="حالة التنفيذ" options={[...EXEC_STATES]} /></FormField>
            <FormField label="نسبة الإنجاز"><FieldBox><input inputMode="numeric" value={ex.progress} onChange={(e) => setEx((x) => ({ ...x, progress: e.target.value.replace(/[^\d]/g, '') }))} aria-label="نسبة الإنجاز" /></FieldBox></FormField>
            <FormField label="ما ورد من الجهة" className="ptn-wide"><FieldBox><input value={ex.note} onChange={(e) => setEx((x) => ({ ...x, note: e.target.value }))} aria-label="ملاحظة التنفيذ" /></FieldBox></FormField>
            <span className="rowf gp-2">
              <span className="sub">{ex.files.length ? ex.files.join(' · ') : 'إثبات التنفيذ'}</span>
              <UploadButton label="إثبات" onPick={(f) => setEx((x) => ({ ...x, files: [...x.files, f.name] }))} />
              <Button type="button" variant="2" size="sm" onClick={() => { const out = recordExec(row.id, { status: ex.status as ExecState, progress: Number(ex.progress) || 0, note: ex.note, files: ex.files }, user.name, role.key); r(out, 'حالة التنفيذ'); if (!out.length) setEx((x) => ({ ...x, note: '', files: [] })) }}>حدّث الحالة</Button>
            </span>
          </div>
        )}
      </Glass>

      {/* a party that executes on its own platform · its operations recorded after the permit's transfer */}
      {(paysOf({ kind: 'project', projectId: row.id }).length > 0 || vals.method === 'تنفيذ عبر منصة الجهة الخارجية' || row.externalId === '860') && (
        <Glass>
          <Head title="عمليات منصة الجهة الخارجية" />
          <PayList list={paysOf({ kind: 'project', projectId: row.id })} finance={fin} />
          {sup && !closed && (g.pay ? <PayForm target={{ kind: 'project', projectId: row.id }} max={m.left} /> : <p className="sub cnote">{g.why}</p>)}
        </Glass>
      )}

      <Glass>
        <Head title="متابعة المشروع" />
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
            <FormField label="النوع"><FieldSelect value={kind} onChange={setKind} label="نوع المتابعة" options={['زيارة ميدانية', 'عملية على المنصة', 'ملاحظة']} /></FormField>
            <FormField label="المرجع"><FieldBox><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="مرجع المتابعة" /></FieldBox></FormField>
            <FormField label="ما جرى" className="ptn-wide"><FieldBox><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ما جرى" /></FieldBox></FormField>
            <Button type="button" variant="2" size="sm" onClick={() => { const out = addEhOp(row.id, kind, note, user.name, ref || undefined); r(out, 'المتابعة'); if (!out.length) { setNote(''); setRef('') } }}>سجّل</Button>
          </div>
        )}
      </Glass>

      <Glass>
        <Head title="إغلاق المشروع" meta={closed ? <Tag tone="ok">أُغلق <DateText>{cl!.closedAt!}</DateText></Tag> : cl?.state === 'manager' ? <Tag tone="teal">عند مدير المنح</Tag> : cl?.state === 'returned' ? <Tag tone="ret">معاد لاستكمال المتطلبات</Tag> : <Tag tone="mute">يجمعه المشرف · يعتمده مدير المنح</Tag>} />
        <Checks items={ehCloseChecks(row.id)} />
        {cl?.note && cl.state === 'returned' && <p className="bad cnote">ملاحظة مدير المنح: {cl.note}</p>}
        {sup && !closed && cl?.state !== 'manager' && (
          <>
            <FormField label="ملخص الإغلاق" className="mt-3"><FieldBox><textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} aria-label="ملخص الإغلاق" placeholder="ما نُفّذ وما صُرف · دون تقرير ختامي اعتيادي" /></FieldBox></FormField>
            <div className="apv-row mt-2">
              <span className="sub">{evidence.length ? evidence.join(' · ') : 'إثباتات التحويل والتنفيذ'}</span>
              <UploadButton label="إثبات" onPick={(f) => setEvidence((x) => [...x, f.name])} />
              <Button type="button" variant="2" size="sm" onClick={() => r(saveEhReport(row.id, report, evidence, user.name), 'ملخص الإغلاق')}>احفظ</Button>
              <Button type="button" variant="p" size="sm" onClick={() => r(closeEhsanProject(row.id, user.name, report, evidence), 'إحالة الإغلاق إلى مدير المنح')}>ارفع الإغلاق لمدير المنح</Button>
            </div>
          </>
        )}
        {mgr && cl?.state === 'manager' && (
          <>
            {/* v3 · 11.2.14 · the outcome at the approval · complete (or with savings) · cancelled · redirected */}
            <div className="cfgchips mt-3" role="radiogroup" aria-label="نتيجة الإغلاق">
              {(Object.keys(EXT_CLOSE_OUTCOME_SAY) as ExtCloseOutcome[]).map((k) => (
                <Button plain key={k} type="button" role="radio" aria-checked={outcome === k} className={`cfgchip${outcome === k ? ' on' : ''}`} onClick={() => setOutcome(k)}>{EXT_CLOSE_OUTCOME_SAY[k]}</Button>
              ))}
            </div>
            {outcome === 'redirect' && (
              <div className="apv-row mt-2">
                <FieldBox><input value={rdPurpose} onChange={(e) => setRdPurpose(e.target.value)} aria-label="الغرض الجديد للدعم" placeholder="الغرض الجديد" /></FieldBox>
                <FieldBox><input value={rdDecision} onChange={(e) => setRdDecision(e.target.value)} aria-label="رقم قرار إعادة التوجيه" placeholder="رقم القرار" /></FieldBox>
                <UploadButton label={rdFile || 'مستند القرار'} onPick={(f) => setRdFile(f.name)} />
              </div>
            )}
            <div className="apv-row mt-2">
              <FieldBox><input value={back} onChange={(e) => setBack(e.target.value)} aria-label="ملاحظة الإعادة" placeholder={outcome === 'cancel' ? 'سبب الإلغاء · أو ما ينقص عند الإعادة' : 'ما ينقص · عند الإعادة'} /></FieldBox>
              <Button type="button" variant="2" size="sm" onClick={() => r(decideExternalClosing(row.id, 'return', back, user.name, role.key), 'إعادة الإغلاق للمشرف')}>أعده للمشرف</Button>
              <Button type="button" variant="p" size="sm" onClick={() => r(decideExternalClosing(row.id, 'approve', outcome === 'complete' ? '' : back, user.name, role.key, outcome, outcome === 'redirect' ? { purpose: rdPurpose, decision: rdDecision, file: rdFile } : undefined), 'اعتماد الإغلاق')}>اعتمد الإغلاق</Button>
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
  const pfs = pfOfEntity(entityId)
  return (
    <Glass>
      {/* Re-audit 7 Oct · the card names its entity · the hub listed identical «الشراكة الاستراتيجية» cards */}
      <Head title={<>الشراكة الاستراتيجية · <Link className="tlink" to={ROUTES.entity(entityId)}>{p.name || entityById(entityId)?.name || entityId}</Link></>} meta={<Tag tone={p.state === 'approved' ? 'ok' : p.state === 'review' ? 'warn' : 'no'}>{p.state === 'approved' ? 'شريك استراتيجي معتمد' : p.state === 'review' ? 'بانتظار اعتماد مدير المنح' : 'مرفوض'}</Tag>} />
      <KV rows={[
        { k: 'نوع الشراكة', v: 'شريك استراتيجي' },
        { k: 'الدفعات', v: 'على مستوى المحفظة' },
        { k: 'أنواع المشاريع المسموحة', v: p.allowed.map((t) => PTYPE_SAY[t]).join(' · ') },
        { k: 'المحافظ', v: pfs.length ? <span className="ptn-chips">{pfs.map((x) => <Link key={x.id} className="tlink" to={ROUTES.portfolio(x.id)}>{x.name} <Tag tone={PF_STAGE_TONE[x.stage]}>{PF_STAGE_SAY[x.stage]}</Tag></Link>)}</span> : <span className="sub">لا محافظ بعد</span> },
      ]} />
      {mgr && p.state === 'approved' && (
        <div className="apv-row mt-3">
          <FieldMultiSelect
            values={p.allowed}
            options={(['independent', 'portfolio'] as PType[]).map((t) => ({ value: t, label: PTYPE_SAY[t] }))}
            label="الأنواع المسموحة"
            placeholder="الأنواع المسموحة"
            onChange={(xs) => {
              if (!xs.length) { setSaid({ bad: ['نوع واحد على الأقل'] }); return }
              setPartnerTypes(entityId, xs as PType[], user.name)
              setSaid({ ok: 'الأنواع المسموحة' })
            }}
          />
        </div>
      )}
      {mgr && p.state === 'review' && (
        <div className="apv-row mt-3">
          <Button type="button" variant="p" size="sm" onClick={() => { decidePartner(entityId, 'approve', '', user.name); setSaid({ ok: 'اعتماد الشريك' }) }}>اعتمد الشريك</Button>
          <Button type="button" variant="2" size="sm" onClick={() => { decidePartner(entityId, 'reject', 'لا تنطبق شروط الشراكة', user.name); setSaid({ ok: 'رفض الشريك' }) }}>ارفض</Button>
        </div>
      )}
      {p.state === 'approved' && p.allowed.includes('portfolio') && role.key === 'supervisor' && (
        <div className="apv-row mt-3"><ButtonLink variant="2" size="sm" to={`${ROUTES.portfolioNew}?entity=${entityId}`}>محفظة جديدة</ButtonLink></div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/** A project's agreement tab when the support goes through an external party · the exemption, said (11.2.6) */
export function EhsanNoAgreement({ children }: { children?: ReactNode }) {
  return (
    <Glass>
      <Head title="الاتفاقية" meta={<Tag tone="teal">لا تلزم</Tag>} />
      {children}
    </Glass>
  )
}
