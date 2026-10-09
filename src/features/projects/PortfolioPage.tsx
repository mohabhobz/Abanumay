import { useState } from 'react'
import { portfolioAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BackTo, DateField, DateText, Empty, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, Steps, Tag, icons, type StepItem,
} from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { REGIONS } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { isolate, nf, pct } from '@/lib/format'
import { noteFirst } from '@/lib/dock'
import { HOLD_STAGE_SAY, linkOf, usableLines } from '@/data/budget/store'
import {
  PF_STAGE_SAY, PF_STAGE_TONE, SUB_STATE_SAY, SUB_STATE_TONE, actOnPfAgreement, actOnPfPlan, actOnPfReq, actOnPortfolio, addSub, capIssue,
  closePortfolio, decideSubs, dropSub, pfActions, pfById, pfCloseChecks, pfIndicators, pfMoney, pfStops, savePfPlan, savePfSchedule,
  sendSubs, subMoney, subsGate, submitPfReport, updateSubExec, usePartners, paysOf, requestPfPay, pfReqIssue, profileOf,
  type PfPhase, type PortfolioRec, type SubExec, type SubProject,
} from '@/data/partners/store'
import { Checks, PayForm, PayList, Said, SlotsEditor } from '@/features/partners/parts'
import type { Reading } from '@/components/assistant/reading'

/* A portfolio · a strategic partner's parent record with sub-projects under it (BPD-013).

   The page follows the portfolio's life in order, and each card says what it waits on:
   · approval as a whole · supervisor → grants manager → CEO, the total held once on the budget
     when the supervisor recommends and fixed at the final approval (13.2.6 · 13.2.7)
   · then the plan and the agreement · nothing below opens before both (13.2.8 – 13.2.10)
   · the sub-projects · added gradually by the supervisor or the partner, sent one or many at a
     time, each decided on its own by the grants manager within the portfolio's ceiling; a pending
     one holds its value inside the portfolio, a rejected one gives it back (13.2.11 – 13.2.19)
   · the money · Ehsan executes and the supervisor records per sub-project, or the portfolio asks
     for its scheduled payments; finance confirms either; the sub-projects' values split the total,
     they are not what's paid against (13.2.23 – 13.2.25)
   · execution and results the partner reports, then its final report and the closing once every
     approved sub-project meets its requirements (13.2.20 – 13.2.30)
   The partner opens the same page with `?as=partner`: it adds and follows its own sub-projects,
   signs the agreement and files the final report · it decides nothing. */

const sumOf = (xs: { cost: number }[]) => xs.reduce((s, x) => s + x.cost, 0)

export default function PortfolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const asPartner = params.get('as') === 'partner'
  usePartners()
  const { role, user } = useRole()
  const pf = id ? pfById(id) : undefined
  const [note, setNote] = useState('')
  const [line, setLine] = useState('')
  const [split, setSplit] = useState<{ key: string; amount: string }[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  if (!pf) {
    return (
      <AppLayout assistantContext={assistFor.page('المحافظ')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="الشركاء" onClick={() => navigate(ROUTES.partners)} />
          <Glass><Empty title="المحفظة غير موجودة." note="تُسجَّل المحافظ للشركاء الاستراتيجيين المعتمدين." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const m = pfMoney(pf)
  const ind = pfIndicators(pf)
  const gate = subsGate(pf)
  const actions = pfActions(pf, role.key, asPartner)
  const needNote = actions.some((a) => a.needsNote)
  const lines = usableLines('fy-2026')
  const preferred = lines.find((l) => l.node.id === (pf.channel === 'ehsan' ? 'tPg1' : 'tPg2'))
  const lineKey = line || preferred?.key || ''
  const pick = lines.find((l) => l.key === lineKey)
  /* Batch 6 · 8 Oct · the hold can split across lines, in one budget or several (13.2.7) · the parts
     add up to the portfolio's value */
  const splitShares = split.map((x) => { const l = lines.find((y) => y.key === x.key); return l ? { docId: l.doc.id, nodeId: l.node.id, amount: Number(x.amount) || 0 } : undefined }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  const shares = split.length ? splitShares : pick ? [{ docId: pick.doc.id, nodeId: pick.node.id, amount: pf.total }] : undefined
  const link = linkOf(pf.id)
  const partner = pf.entityId

  const act = (a: (typeof actions)[number]) => {
    const out = actOnPortfolio(pf.id, a.act, note, user.name, a.act === 'recommend' ? shares : undefined)
    setSaid(out.length ? { bad: out } : { ok: a.label })
    if (!out.length) setNote('')
  }

  const steps: StepItem[] = [
    { label: 'الطلب', note: pf.origin === 'partner' ? 'من بوابة الشريك' : 'مشرف المنح', state: pf.stage === 'draft' || pf.stage === 'returned' ? 'now' : 'done' },
    { label: 'الدراسة والاعتماد', note: 'حسب مصفوفة الاعتماد', state: ['supervisor', 'manager', 'ceo', 'committee', 'board'].includes(pf.stage) ? 'now' : ['draft', 'returned', 'rejected'].includes(pf.stage) ? 'todo' : 'done' },
    { label: 'الخطة والاتفاقية', note: 'قبل أي مشروع فرعي', state: pf.stage !== 'approved' && pf.stage !== 'closing' && pf.stage !== 'closed' ? 'todo' : gate.ok || pf.stage !== 'approved' ? 'done' : 'now' },
    { label: 'المشاريع الفرعية', note: `${m.approvedCount} معتمد`, state: gate.ok ? 'now' : pf.stage === 'closing' || pf.stage === 'closed' ? 'done' : 'todo' },
    { label: 'الإغلاق', note: 'بعد آخر مشروع', state: pf.stage === 'closed' ? 'done' : pf.stage === 'closing' ? 'now' : 'todo' },
  ]

  const readings: Reading[] = [
    ...(pf.stage === 'supervisor' && !link ? [{ id: 'pf-hold', kind: 'flag' as const, label: 'الحجز', text: 'اختر بند الميزانية قبل التوصية · تُحجز القيمة كاملةً مرة واحدة.', src: '13.2.7' }] : []),
    ...(!gate.ok && pf.stage === 'approved' ? [{ id: 'pf-gate', kind: 'flag' as const, label: 'المشاريع الفرعية', text: gate.why, src: '13.2.10' }] : []),
    ...(m.pending ? [{ id: 'pf-pend', kind: 'note' as const, label: 'قيد الاعتماد', metric: { value: nf.format(m.pending), unit: 'ريال' }, text: `${pf.items.filter((x) => x.state === 'pending').length} مشروع بانتظار قرار مدير المنح · قيمتها محجوزة داخل المحفظة.`, src: '13.4.16' }] : []),
    { id: 'pf-avail', kind: m.available < 0 ? 'flag' as const : 'note' as const, label: 'الرصيد المتاح', metric: { value: nf.format(Math.max(0, m.available)), unit: 'ريال' }, text: `من ${nf.format(pf.total)} · معتمد ${nf.format(m.approved)} وقيد الاعتماد ${nf.format(m.pending)}.`, src: '13.2.18', bar: { value: m.approved + m.pending, limit: pf.total, valueLabel: 'المعتمد وقيد الاعتماد', limitLabel: 'المحفظة', unit: 'ريال' } },
    ...(m.recorded > m.confirmed ? [{ id: 'pf-fin', kind: 'flag' as const, label: 'المراجعة المالية', metric: { value: nf.format(m.recorded - m.confirmed), unit: 'ريال' }, text: 'دفعات مسجلة لم تؤكدها المالية بعد.', src: '11.2.13' }] : []),
    /* Cross · the periodic summary, the early delay forecast and the fit with the portfolio's goals */
    ...(asPartner ? [] : portfolioAi(pf)),
  ]

  return (
    <AppLayout assistantContext={assistFor.page(pf.name)}>
      <div className={`viewstack${actions.length ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo label={asPartner ? 'البوابة' : 'الشركاء'} onClick={() => navigate(asPartner ? `${ROUTES.entityPortal}?entity=${partner}` : ROUTES.partnersTab('portfolios'))} />
          <Said said={said} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{pf.name}</h1>
              <p className="sub mt-1">
                <span className="num">{pf.id}</span> · {asPartner ? 'محفظتك' : <Link className="tlink" to={ROUTES.entity(partner)}>{entityName(pf)}</Link>} · {pf.track} · {pf.field} · فُتحت <DateText>{pf.openedAt}</DateText>
              </p>
              <div className="gt-tag rowf gp-2">
                <Tag tone={PF_STAGE_TONE[pf.stage]}>{PF_STAGE_SAY[pf.stage]}</Tag>
                <Tag tone="mute">{pf.channel === 'ehsan' ? 'الدفعات عبر منصة إحسان' : 'دفعات على مستوى المحفظة'}</Tag>
              </div>
            </div>
          </header>

          {pf.note && (pf.stage === 'returned' || pf.stage === 'rejected' || pf.stage === 'supervisor' || pf.stage === 'manager') && (
            <Glass>
              <Head title={pf.stage === 'rejected' ? 'سبب الرفض' : 'ملاحظات الإعادة'} meta={<Tag tone={pf.stage === 'rejected' ? 'no' : 'warn'}>{pf.stage === 'rejected' ? 'مرفوضة' : 'للاستكمال'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(pf.note)}</span></div>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="مسار المحفظة" meta={<span className="sub">المسار المعتاد والصلاحيات المالية</span>} />
                <Steps items={steps} flow="ladder" />
              </Glass>

              <Glass>
                <Head title="بيانات المحفظة" />
                <KV rows={[
                  { k: 'الشريك', v: entityName(pf) },
                  { k: 'قيمة المحفظة', v: <Money>{pf.total}</Money> },
                  { k: 'المسار والمجال', v: `${pf.track} · ${pf.field} · يرثهما كل مشروع فرعي` },
                  { k: 'الأهداف', v: isolate(pf.goals) },
                  { k: 'المرفقات', v: pf.files.join(' · ') || '—' },
                  { k: 'مشرف المنح', v: <Person name={pf.owner} /> },
                ]} />
              </Glass>

              {!asPartner && <HoldCard pf={pf} lineKey={lineKey} setLine={setLine} lines={lines} link={link} split={split} setSplit={setSplit} />}

              {(pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed') && (
                <>
                  <PlanCard pf={pf} asPartner={asPartner} />
                  <AgreementCard pf={pf} asPartner={asPartner} />
                </>
              )}

              <SubsCard pf={pf} asPartner={asPartner} />

              {(pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed') && (
                <>
                  <Glass>
                    <Head title="الموقف المالي" meta={<span className="sub">المحفظة ككل</span>} />
                    <KV rows={[
                      { k: 'المعتمد للمحفظة', v: <Money sm>{m.total}</Money> },
                      { k: 'المشاريع المعتمدة', v: <><Money sm>{m.approved}</Money> <span className="sub">· {m.approvedCount} مشروع</span></> },
                      { k: 'قيد الاعتماد', v: <Money sm>{m.pending}</Money> },
                      { k: 'الرصيد المتاح', v: <Money sm>{m.available}</Money> },
                      { k: 'الدفعات المسجلة', v: <Money sm>{m.recorded}</Money> },
                      { k: 'الدفعات المؤكدة · المصروف', v: <Money sm>{m.confirmed}</Money> },
                      { k: 'المتبقي', v: <Money sm>{m.remaining}</Money> },
                    ]} />
                  </Glass>

                  <Glass>
                    <Head title="مؤشرات التنفيذ" meta={<span className="sub">المشاريع المعتمدة</span>} />
                    <dl className="ptn-ind">
                      <div><dt>المشاريع</dt><dd className="num">{ind.count}</dd></div>
                      <div><dt>مكتمل · تحت التنفيذ · لم يبدأ</dt><dd className="num">{ind.done} · {ind.running} · {ind.waiting}</dd></div>
                      <div><dt>متوسط الإنجاز</dt><dd className="num">{pct(ind.progress)}</dd></div>
                      <div><dt>المستفيدون · فعلي من مستهدف</dt><dd className="num">{nf.format(ind.reached)} / {nf.format(ind.target)}</dd></div>
                    </dl>
                    <p className="sub cnote">التوزيع الجغرافي · {ind.regions.length ? ind.regions.map(([r, n]) => `${r} ${n}`).join(' · ') : 'لا مشاريع معتمدة بعد'}</p>
                  </Glass>

                  <PaysCard pf={pf} asPartner={asPartner} />
                  <ExecCard pf={pf} asPartner={asPartner} />
                  <CloseCard pf={pf} asPartner={asPartner} />
                </>
              )}

              <Glass>
                <Head title="سجلّ المحفظة" />
                <ul className="plchg">
                  {pf.log.slice().reverse().map((a, i) => (
                    <li key={`${a.at}-${i}`}>
                      <div className="plchg-h"><Tag tone="mute"><DateText>{a.at}</DateText></Tag><span className="sub">{a.by}</span></div>
                      <p className="plchg-t">{isolate(a.what)}</p>
                    </li>
                  ))}
                </ul>
              </Glass>
            </div>

            <AssistantAside title="قراءة المحفظة" cta="اقرأ المحفظة" empty="المحفظة في مسارها · لا ملاحظات." readings={readings} ask={!asPartner} />
          </div>
        </div>

        {actions.length > 0 && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <Person name={user.name} size="lg" quiet={false} />
                <span className="decsent">قرارك في <b>المحفظة</b><span className="decsep" />{nf.format(pf.total)} ريال</span>
              </div>
              <div className="payact-g">
                {needNote && (
                  <label className="payact-n">
                    <span className="vis-h">الملاحظة</span>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب الإعادة أو الرفض · إلزامي" />
                  </label>
                )}
                <div className="rowf gp-2">
                  {noteFirst(actions).map((a) => {
                    const stop = a.needsNote && !note.trim() ? 'اكتب الملاحظة أولًا' : pfStops(pf, a.act, a.act === 'recommend' ? shares : undefined)[0] ?? ''
                    return (
                      <button key={a.label} type="button" className={`btn ${a.kind}`} data-needs-note={a.needsNote ? '' : undefined} disabled={Boolean(stop)} title={stop || '13.2.6'} onClick={() => act(a)}>
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const entityName = (pf: PortfolioRec) => profileOf(pf.entityId)?.name ?? entityById(pf.entityId)?.name ?? pf.entityId

/* ── The budget hold · the total, once, from one line or more (13.2.7) ── */
function HoldCard({ pf, lineKey, setLine, lines, link, split, setSplit }: {
  pf: PortfolioRec; lineKey: string; setLine: (k: string) => void; lines: ReturnType<typeof usableLines>; link: ReturnType<typeof linkOf>
  split: { key: string; amount: string }[]; setSplit: (x: { key: string; amount: string }[]) => void
}) {
  const sum = split.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const label = (k: string) => { const l = lines.find((y) => y.key === k); return l ? `${l.doc.name ?? l.doc.id} · ${l.node.label}` : k }
  const { role } = useRole()
  const pickable = pf.stage === 'supervisor' && role.key === 'supervisor'
  return (
    <Glass>
      <Head title="حجز قيمة المحفظة" meta={link ? <Tag tone={link.stage === 'final' ? 'ok' : 'warn'}>{HOLD_STAGE_SAY[link.stage]}</Tag> : <Tag tone="mute">لم يُحجز</Tag>} />
      {link ? (
        <KV rows={[
          { k: link.shares.length > 1 ? 'البنود' : 'البند', v: link.shares.map((s) => `${s.nodeId === 'tPg1' ? 'مخصص منصة إحسان' : s.nodeId === 'tPg2' ? 'مخصص محافظ الشركاء' : label(`${s.docId}/${s.nodeId}`)}${link.shares.length > 1 ? ` · ${nf.format(s.amount)}` : ''}`).join(' · ') },
          { k: 'المحجوز', v: <Money sm>{link.amount}</Money> },
          { k: 'المصروف منه', v: <Money sm>{link.shares.reduce((s, x) => s + x.paid, 0)}</Money> },
        ]} />
      ) : pickable && split.length ? (
        <div className="regfields">
          {split.map((x, i) => (
            <div className="rowf gp-2" key={i}>
              <label className="regf">
                <span className="lb">البند {i + 1}</span>
                <FieldSelect value={x.key} onChange={(k) => setSplit(split.map((y, j) => (j === i ? { ...y, key: k } : y)))} label={`بند الحجز ${i + 1}`}
                  options={lines.filter((l) => l.key === x.key || !split.some((y) => y.key === l.key)).map((l) => ({ value: l.key, label: `${l.doc.name ?? l.doc.id} · ${l.node.label} · متاح ${nf.format(l.free)}` }))} />
              </label>
              <label className="regf">
                <span className="lb">المبلغ</span>
                <span className="fld"><input inputMode="numeric" value={x.amount} onChange={(e) => setSplit(split.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d]/g, '') } : y)))} aria-label={`مبلغ بند الحجز ${i + 1}`} /></span>
              </label>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`احذف البند ${i + 1}`} onClick={() => setSplit(split.filter((_, j) => j !== i))}><Icon name={icons.close} size="sm" /></button>
            </div>
          ))}
          <div className="rowf gp-2">
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setSplit([...split, { key: '', amount: '' }])}><Icon name={icons.plus} size="sm" />أضف بندًا</button>
            <span className={sum === pf.total ? 'sub' : 'bad'}>المجموع {nf.format(sum)} من {nf.format(pf.total)}</span>
          </div>
        </div>
      ) : pickable ? (
        <>
        <label className="regf">
          <span className="lb">بند الميزانية</span>
          <FieldSelect value={lineKey} onChange={setLine} label="بند الميزانية" options={lines.filter((l) => l.free >= pf.total).map((l) => ({ value: l.key, label: `${l.node.label} · متاح ${nf.format(l.free)}` }))} />
          <span className="sub regf-h">تُحجز القيمة كاملةً مرة واحدة مع التوصية · وقيم المشاريع الفرعية توزيع داخلي لا حجز جديد (13.2.19)</span>
        </label>
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setSplit([{ key: lineKey, amount: '' }, { key: '', amount: '' }])}>وزّع الحجز على أكثر من بند أو ميزانية</button>
        </>
      ) : (
        <p className="sub cnote">يُحجز إجمالي المحفظة مع توصية المشرف ويُثبَّت بالاعتماد النهائي.</p>
      )}
    </Glass>
  )
}

/* ── The portfolio's plan · prepared on the plans procedure's terms, approved by the grants manager (13.2.8 · 13.2.9) ── */
function PlanCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [rows, setRows] = useState<PfPhase[]>(() => (pf.plan.phases.length ? pf.plan.phases : [{ id: 'ph1', name: '', from: '', to: '', cost: 0 }]))
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  /* Batch 6 · the partner drafts its plan too (12.2.4) · its draft goes to the supervisor first */
  const mine = pf.plan.drafter === undefined || (pf.plan.drafter === 'partner') === asPartner
  const editable = pf.stage === 'approved' && (asPartner || role.key === 'supervisor')
    && (pf.plan.state === 'none' || ((pf.plan.state === 'draft' || pf.plan.state === 'returned') && mine))
  const who = asPartner ? (entityById(pf.entityId)?.name ?? profileOf(pf.entityId)?.name ?? user.name) : user.name
  const tone = pf.plan.state === 'approved' ? 'ok' : pf.plan.state === 'review' || pf.plan.state === 'supervisor' ? 'warn' : pf.plan.state === 'returned' ? 'ret' : 'mute'
  const say = { none: 'لم تُعدّ', draft: 'مسودة', supervisor: 'بانتظار مراجعة المشرف', review: 'بانتظار مدير المنح', approved: 'معتمدة', returned: 'معادة' }[pf.plan.state]
  return (
    <Glass>
      <Head title="خطة المحفظة" meta={<Tag tone={tone}>{say}</Tag>} />
      {pf.plan.note && pf.plan.state === 'returned' && <p className="bad cnote">{pf.plan.note}</p>}
      {editable ? (
        <div className="ptn-form">
          {rows.map((r, i) => (
            <div key={r.id} className="regfields">
              <label className="regf"><span className="lb">المرحلة {i + 1}</span><span className="fld"><input value={r.name} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} aria-label={`اسم المرحلة ${i + 1}`} /></span></label>
              <label className="regf"><span className="lb">من</span><DateField value={r.from} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, from: v } : y)))} label={`بداية المرحلة ${i + 1}`} /></label>
              <label className="regf"><span className="lb">إلى</span><DateField value={r.to} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, to: v } : y)))} label={`نهاية المرحلة ${i + 1}`} /></label>
              <label className="regf"><span className="lb">التكلفة</span><MoneyField value={r.cost ? String(r.cost) : ''} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, cost: Number(v) || 0 } : y)))} label={`تكلفة المرحلة ${i + 1}`} /></label>
            </div>
          ))}
          <div className="apv-row mt-2">
            <span className={`sub${sumOf(rows) !== pf.total ? ' bad' : ''}`}>المجموع <span className="num">{nf.format(sumOf(rows))}</span> من <span className="num">{nf.format(pf.total)}</span></span>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => setRows((x) => [...x, { id: `ph${x.length + 1}`, name: '', from: '', to: '', cost: 0 }])}>مرحلة أخرى</button>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => { savePfPlan(pf.id, rows, who); setSaid({ ok: 'مسودة الخطة' }) }}>احفظ</button>
            <button type="button" className="btn btn-p btn-sm" onClick={() => { savePfPlan(pf.id, rows, who); const out = actOnPfPlan(pf.id, 'send', '', who); setSaid(out.length ? { bad: out } : { ok: asPartner ? 'إرسال الخطة لمشرف المنح' : 'إرسال الخطة لمدير المنح' }) }}>{asPartner ? 'أرسل لمشرف المنح' : 'أرسل للاعتماد'}</button>
          </div>
        </div>
      ) : (
        <ul className="ptn-slots">
          {pf.plan.phases.map((p) => <li key={p.id}><span>{p.name}</span><span className="sub"><DateText>{p.from}</DateText> – <DateText>{p.to}</DateText></span><Money sm>{p.cost}</Money></li>)}
          {!pf.plan.phases.length && <li className="sub">يعدّها الشريك أو مشرف المنح بعد الاعتماد النهائي.</li>}
        </ul>
      )}
      {!asPartner && role.key === 'supervisor' && pf.plan.state === 'supervisor' && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة المشرف على الخطة" placeholder="سبب الإعادة للشريك" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'return', note, user.name); setSaid(out.length ? { bad: out } : { ok: 'إعادة الخطة للشريك' }) }}>أعدها للشريك</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'toManager', '', user.name); setSaid(out.length ? { bad: out } : { ok: 'إحالة الخطة لمدير المنح' }) }}>أحلها لمدير المنح</button>
        </div>
      )}
      {!asPartner && role.key === 'grants-manager' && pf.plan.state === 'review' && (
        <div className="apv-row mt-3">
          <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الخطة" placeholder="سبب الإعادة" /></span>
          <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'return', note, user.name); setSaid(out.length ? { bad: out } : { ok: 'إعادة الخطة' }) }}>أعد الخطة</button>
          <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfPlan(pf.id, 'approve', '', user.name); setSaid(out.length ? { bad: out } : { ok: 'اعتماد الخطة' }) }}>اعتمد الخطة</button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The agreement · drafted, approved, signed by the partner; the payment schedule rides on it (13.2.9 · 13.2.24) ── */
function AgreementCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const a = pf.agreement
  const say = { none: 'لم تُعدّ', draft: 'مسودة · مشرف المنح', manager: 'بانتظار مدير المنح', executive: 'بانتظار المدير التنفيذي', partner: 'بانتظار توقيع الشريك', foundation: 'بانتظار توقيع ممثل المؤسسة', signed: 'موقّعة وسارية', returned: 'معادة' }[a.state]
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  const sup = !asPartner && role.key === 'supervisor'
  return (
    <Glass>
      <Head title="اتفاقية المحفظة" meta={<Tag tone={a.state === 'signed' ? 'ok' : a.state === 'none' ? 'mute' : 'warn'}>{say}</Tag>} />
      <p className="sub cnote">اتفاقية على مستوى المحفظة ككل · تحكم المشاريع الفرعية كلها ولا تتكرر لكل مشروع.{a.file ? ` · ${a.file}` : ''}</p>
      {a.note && a.state === 'returned' && <p className="bad cnote">{a.note}</p>}
      {pf.channel === 'direct' && (
        <>
          <h4 className="ptn-sub">جدول دفعات المحفظة</h4>
          <SlotsEditor slots={pf.schedule} total={pf.total} locked={!sup || a.state === 'signed' || pf.requests.length > 0} onSave={(s) => savePfSchedule(pf.id, s, user.name)} />
        </>
      )}
      <div className="apv-row mt-3">
        {sup && (a.state === 'none' || a.state === 'returned') && <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'draft', '', user.name), 'مسودة الاتفاقية')}>أعدّ المسودة من النموذج</button>}
        {sup && a.state === 'draft' && <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'send', '', user.name), 'إرسال الاتفاقية')}>أرسل لمدير المنح</button>}
        {!asPartner && ((role.key === 'grants-manager' && a.state === 'manager') || (role.key === 'ceo' && a.state === 'executive')) && (
          <>
            <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظة على الاتفاقية" placeholder="سبب الإعادة" /></span>
            <button type="button" className="btn btn-2 btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'return', note, user.name), 'إعادة الاتفاقية')}>أعد</button>
            <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'approve', '', user.name), 'اعتماد الاتفاقية')}>{a.state === 'manager' ? 'اعتمد وأحل للمدير التنفيذي' : 'اعتمد وأرسل للشريك'}</button>
          </>
        )}
        {!asPartner && (role.key === 'grants-manager' || role.key === 'ceo') && a.state === 'foundation' && (
          <button type="button" className="btn btn-p btn-sm" onClick={() => r(actOnPfAgreement(pf.id, 'countersign', '', user.name), 'توقيع ممثل المؤسسة')}>وقّع عن المؤسسة · تسري الاتفاقية</button>
        )}
        {asPartner && a.state === 'foundation' && <span className="sub">وقّعتها · بانتظار توقيع ممثل المؤسسة</span>}
        {asPartner && a.state === 'partner' && <UploadButton label="الاتفاقية الموقعة" onPick={(f) => r(actOnPfAgreement(pf.id, 'sign', '', user.name, f.name), 'توقيع الاتفاقية')} />}
        {!asPartner && a.state === 'partner' && <span className="sub">يوقّعها الشريك من بوابته</span>}
      </div>
      <Said said={said} />
    </Glass>
  )
}

/* ── Sub-projects · added, sent, decided one by one within the ceiling (13.2.11 – 13.2.19) ── */
const EMPTY = { name: '', region: '', amount: '', beneficiaries: '', outputs: '', files: [] as string[] }
function SubsCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [d, setD] = useState(EMPTY)
  const [sel, setSel] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const gate = subsGate(pf)
  const adder = gate.ok && (asPartner || role.key === 'supervisor')
  const decider = !asPartner && role.key === 'grants-manager'
  const dropper = (asPartner || role.key === 'supervisor') && (gate.ok || pf.stage === 'closing')
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const drafts = pf.items.filter((x) => x.state === 'draft')
  const pending = pf.items.filter((x) => x.state === 'pending')
  const selectable = (x: SubProject) => (decider ? x.state === 'pending' : adder && x.state === 'draft')
  const pool = pf.items.filter(selectable)
  const cap = capIssue(pf, sel)
  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }); if (!out.length) setSel([]) }
  const add = () => {
    const out = addSub(pf.id, { name: d.name, region: d.region, amount: Number(d.amount) || 0, beneficiaries: Number(d.beneficiaries) || 0, outputs: d.outputs, files: d.files }, user.name)
    if (out.errors.length) { setSaid({ bad: [`ينقص: ${out.errors.join('، ')}`] }); return }
    setSaid({ ok: 'المشروع الفرعي · مسودة' })
    setD(EMPTY)
    setAdding(false)
  }
  const decide = (outcome: 'approve' | 'reject') => r(decideSubs(pf.id, sel.map((subId) => ({ subId, outcome, reason: reasons[subId] })), user.name), outcome === 'approve' ? 'اعتماد المحدد' : 'رفض المحدد')
  return (
    <Glass className="tblcard">
      <Head title="المشاريع الفرعية" meta={<span className="sub">{pf.items.filter((x) => x.state === 'approved').length} معتمد · {pending.length} قيد الاعتماد · {drafts.length} مسودة</span>} />
      {!gate.ok && <p className="sub cnote"><Icon name={icons.lock} size="sm" /> {gate.why}</p>}
      {pf.items.length > 0 && (
        <div className="tblwrap">
          <table className="tbl" aria-label="المشاريع الفرعية">
            <thead>
              <tr>
                <th>{pool.length > 0 && <input type="checkbox" aria-label="تحديد الكل" checked={sel.length === pool.length} onChange={(e) => setSel(e.target.checked ? pool.map((x) => x.id) : [])} />}</th>
                <th><span className="th-t">المشروع · المنطقة · المستهدف</span></th>
                <th className="n"><span className="th-t">القيمة</span></th>
                <th><span className="th-t">الاعتماد</span></th>
                <th className="n"><span className="th-t">المؤكد · المتبقي</span></th>
              </tr>
            </thead>
            <tbody>
              {pf.items.map((x) => {
                const sm = subMoney(pf, x)
                return (
                  <tr key={x.id} id={x.id}>
                    <td>{selectable(x) && <input type="checkbox" aria-label={`تحديد ${x.name}`} checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />}</td>
                    <td><b>{x.name}</b><div className="sub">{x.field ?? pf.field} · {x.region} · {nf.format(x.beneficiaries)} مستفيد · {x.outputs} · {x.files.join('، ')}</div></td>
                    <td className="n"><Money sm>{x.amount}</Money></td>
                    <td>
                      <Tag tone={SUB_STATE_TONE[x.state]}>{SUB_STATE_SAY[x.state]}</Tag>
                      {x.reason && <span className="sub"> · {x.reason}</span>}
                      {decider && x.state === 'pending' && sel.includes(x.id) && (
                        <span className="fld mt-1"><input value={reasons[x.id] ?? ''} onChange={(e) => setReasons((r0) => ({ ...r0, [x.id]: e.target.value }))} aria-label={`سبب رفض ${x.name}`} placeholder="سبب الرفض إن رُفض" /></span>
                      )}
                      {dropper && x.state === 'draft' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => dropSub(pf.id, x.id, user.name)}>حذف المسودة</button>}
                    </td>
                    <td className="n">{x.state === 'approved' ? <><Money sm>{sm.confirmed}</Money><span className="sub"> · <Money sm>{sm.remaining}</Money></span></> : <span className="sub">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {sel.length > 0 && (
        <div className="apv-row mt-3">
          <span className="sub">{sel.length} محدد · <span className="num">{nf.format(pf.items.filter((x) => sel.includes(x.id)).reduce((s, x) => s + x.amount, 0))}</span></span>
          {cap && !decider && <span className="bad">{cap}</span>}
          {!decider && <button type="button" className="btn btn-p btn-sm" disabled={Boolean(cap)} onClick={() => r(sendSubs(pf.id, sel, user.name), 'طلب الاعتماد')}>أرسل للاعتماد</button>}
          {decider && <button type="button" className="btn btn-2 btn-sm" onClick={() => decide('reject')}>ارفض المحدد</button>}
          {decider && <button type="button" className="btn btn-p btn-sm" onClick={() => decide('approve')}>اعتمد المحدد</button>}
        </div>
      )}
      {adder && !adding && <div className="apv-row mt-3"><button type="button" className="btn btn-2 btn-sm" onClick={() => setAdding(true)}>أضف مشروعًا فرعيًّا</button><span className="sub">الرصيد المتاح <span className="num">{nf.format(Math.max(0, pfMoney(pf).available))}</span></span></div>}
      {adder && adding && (
        <div className="ptn-form mt-3">
          <div className="regfields">
            <label className="regf"><span className="lb">اسم المشروع الفرعي</span><span className="fld"><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="اسم المشروع الفرعي" /></span></label>
            <label className="regf"><span className="lb">المنطقة</span><FieldSelect value={d.region} onChange={(v) => setD({ ...d, region: v })} label="المنطقة" options={[...new Set(['عموم المملكة', ...REGIONS])]} /></label>
            <label className="regf"><span className="lb">القيمة</span><MoneyField value={d.amount} onChange={(v) => setD({ ...d, amount: v })} label="قيمة المشروع الفرعي" /></label>
            <label className="regf"><span className="lb">المستفيدون المستهدفون</span><span className="fld"><input inputMode="numeric" value={d.beneficiaries} onChange={(e) => setD({ ...d, beneficiaries: e.target.value.replace(/\D/g, '') })} aria-label="المستفيدون المستهدفون" /></span></label>
            <label className="regf ptn-wide"><span className="lb">المخرجات المستهدفة</span><span className="fld"><input value={d.outputs} onChange={(e) => setD({ ...d, outputs: e.target.value })} aria-label="المخرجات المستهدفة" /></span></label>
          </div>
          <div className="apv-row mt-2">
            <span className="sub">{d.files.length ? d.files.join(' · ') : 'مرفقات المشروع الفرعي · مستقلة عن مرفقات المحفظة'}</span>
            <UploadButton label="مرفق" onPick={(f) => setD((x) => ({ ...x, files: [...x.files, f.name] }))} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setD(EMPTY) }}>إلغاء</button>
            <button type="button" className="btn btn-p btn-sm" onClick={add}>احفظ مسودة</button>
          </div>
          <p className="sub cnote">يرث المسار والمجال من المحفظة ({pf.track} · {pf.field}) · ويُرسل للاعتماد وحده أو مع غيره.</p>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The money · Ehsan's executed payments per sub-project, or the portfolio's own requests (13.2.23 – 13.2.25) ── */
function PaysCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [sub, setSub] = useState('')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const approved = pf.items.filter((x) => x.state === 'approved')
  const target = approved.find((x) => x.id === sub) ?? approved[0]
  const fin = !asPartner && role.key === 'finance'
  const sup = !asPartner && role.key === 'supervisor'
  const open = pf.stage === 'approved'
  if (pf.channel === 'ehsan') {
    const list = approved.flatMap((x) => paysOf({ kind: 'sub', pfId: pf.id, subId: x.id }))
    return (
      <Glass>
        <Head title="دفعات المحفظة عبر إحسان" meta={<span className="sub">تنفّذها المنصة · يسجّلها المشرف لكل مشروع فرعي · تؤكّدها المالية</span>} />
        <PayList list={list} finance={fin} />
        {sup && open && target && (
          <>
            <label className="regf mt-3"><span className="lb">المشروع الفرعي</span><FieldSelect value={target.id} onChange={setSub} label="المشروع الفرعي" options={approved.map((x) => ({ value: x.id, label: `${x.name} · متبقٍّ ${nf.format(x.amount - subMoney(pf, x).recorded)}` }))} /></label>
            <PayForm target={{ kind: 'sub', pfId: pf.id, subId: target.id }} max={target.amount - subMoney(pf, target).recorded} />
          </>
        )}
        <p className="sub cnote">الدفعة لا تتجاوز قيمة المشروع الفرعي ولا قيمة المحفظة · وتُقيَّد كعملية نفّذتها المنصة، لا صرفًا جديدًا (11.4.23).</p>
      </Glass>
    )
  }
  const next = pf.schedule.find((s) => !pf.requests.some((r) => r.no === s.no && r.state !== 'returned'))
  return (
    <Glass>
      <Head title="دفعات المحفظة" meta={<span className="sub">تُطلب على مستوى المحفظة وفق الجدول · لا لكل مشروع فرعي</span>} />
      <ul className="ptn-slots">
        {pf.schedule.map((s) => {
          const rq = pf.requests.filter((r) => r.no === s.no).at(-1)
          return (
            <li key={s.no}>
              <span>الدفعة <span className="num">{s.no}</span> · <DateText>{s.dueAt}</DateText></span>
              <Money sm>{s.amount}</Money>
              {rq ? <Tag tone={rq.state === 'paid' ? 'ok' : rq.state === 'finance' ? 'warn' : 'ret'}>{rq.state === 'paid' ? `صُرفت · ${rq.ref}` : rq.state === 'finance' ? 'لدى المالية' : `معادة · ${rq.note}`}</Tag> : <Tag tone="mute">لم تُطلب</Tag>}
              {fin && rq?.state === 'finance' && (
                <span className="rowf gp-2">
                  <span className="fld"><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="رقم أمر التحويل" placeholder="رقم أمر التحويل" /></span>
                  <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = actOnPfReq(pf.id, rq.id, 'pay', '', user.name, ref); setSaid(out.length ? { bad: out } : { ok: 'صرف الدفعة' }) }}>صرف</button>
                  <span className="fld"><input value={note} onChange={(e) => setNote(e.target.value)} aria-label="سبب الإعادة" placeholder="سبب الإعادة" /></span>
                  <button type="button" className="btn btn-2 btn-sm" onClick={() => { const out = actOnPfReq(pf.id, rq.id, 'return', note, user.name); setSaid(out.length ? { bad: out } : { ok: 'إعادة الطلب' }) }}>أعد</button>
                </span>
              )}
            </li>
          )
        })}
        {!pf.schedule.length && <li className="sub">يُحدَّد الجدول مع الاتفاقية.</li>}
      </ul>
      {/* Re-audit 7 Oct · 13.2.23 · the partner asks for its portfolio's payment from its own account · the
          supervisor may still file it on its behalf */}
      {(sup || asPartner) && open && next && (
        <div className="apv-row mt-3">
          {pfReqIssue(pf, next.no, next.amount) ? <span className="sub">{pfReqIssue(pf, next.no, next.amount)}</span> : null}
          <button type="button" className="btn btn-p btn-sm" disabled={Boolean(pfReqIssue(pf, next.no, next.amount)) || pf.agreement.state !== 'signed'} title={pf.agreement.state !== 'signed' ? 'بعد توقيع الاتفاقية' : ''} onClick={() => { const out = requestPfPay(pf.id, next.no, next.amount, user.name); setSaid(out.length ? { bad: out } : { ok: `طلب الدفعة ${next.no}` }) }}>اطلب الدفعة {next.no}</button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── Execution and results the partner reports on each approved sub-project (13.2.20 · 13.2.21) ── */
function ExecCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [open, setOpen] = useState<string | null>(null)
  const [e, setE] = useState<Omit<SubExec, 'at' | 'by'>>({ status: 'لم يبدأ', progress: 0, reached: 0, results: '', evidence: [] })
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const approved = pf.items.filter((x) => x.state === 'approved')
  const editor = (asPartner || role.key === 'supervisor') && pf.stage === 'approved'
  if (!approved.length) return null
  return (
    <Glass>
      <Head title="تنفيذ المشاريع الفرعية ونتائجها" meta={<span className="sub">يحدّثها الشريك · المستهدف مسودة والفعلي يُدخل مقابله</span>} />
      <ul className="ptn-exec">
        {approved.map((x) => (
          <li key={x.id}>
            <div className="ptn-exec-h">
              <b>{x.name}</b>
              <Tag tone={x.exec?.status === 'مكتمل' ? 'ok' : x.exec?.status === 'تحت التنفيذ' ? 'teal' : 'mute'}>{x.exec?.status ?? 'لم يبدأ'}</Tag>
              <span className="sub">إنجاز <span className="num">{pct(x.exec?.progress ?? 0)}</span> · مستفيدون <span className="num">{nf.format(x.exec?.reached ?? 0)}</span> من <span className="num">{nf.format(x.beneficiaries)}</span></span>
              {editor && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(open === x.id ? null : x.id); setE({ status: x.exec?.status ?? 'لم يبدأ', progress: x.exec?.progress ?? 0, reached: x.exec?.reached ?? 0, results: x.exec?.results ?? '', evidence: x.exec?.evidence ?? [] }) }}>{open === x.id ? 'إغلاق' : 'حدّث'}</button>}
            </div>
            {x.exec?.results && <p className="sub">{isolate(x.exec.results)}{x.exec.evidence.length ? ` · ${x.exec.evidence.join('، ')}` : ''}</p>}
            {open === x.id && (
              <div className="ptn-form mt-2">
                <div className="regfields">
                  <label className="regf"><span className="lb">الحالة</span><FieldSelect value={e.status} onChange={(v) => setE({ ...e, status: v as SubExec['status'] })} label="حالة التنفيذ" options={['لم يبدأ', 'تحت التنفيذ', 'مكتمل']} /></label>
                  <label className="regf"><span className="lb">نسبة الإنجاز</span><span className="fld"><input inputMode="numeric" value={String(e.progress)} onChange={(v) => setE({ ...e, progress: Number(v.target.value.replace(/\D/g, '')) || 0 })} aria-label="نسبة الإنجاز" /></span></label>
                  <label className="regf"><span className="lb">المستفيدون الفعليون</span><span className="fld"><input inputMode="numeric" value={String(e.reached)} onChange={(v) => setE({ ...e, reached: Number(v.target.value.replace(/\D/g, '')) || 0 })} aria-label="المستفيدون الفعليون" /></span></label>
                  <label className="regf ptn-wide"><span className="lb">النتائج الفعلية</span><span className="fld"><input value={e.results} onChange={(v) => setE({ ...e, results: v.target.value })} aria-label="النتائج الفعلية" placeholder={`المستهدف: ${x.outputs}`} /></span></label>
                </div>
                <div className="apv-row mt-2">
                  <span className="sub">{e.evidence.length ? e.evidence.join(' · ') : 'الشواهد'}</span>
                  <UploadButton label="شاهد" onPick={(f) => setE((y) => ({ ...y, evidence: [...y.evidence, f.name] }))} />
                  <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = updateSubExec(pf.id, x.id, e, user.name); setSaid(out.length ? { bad: out } : { ok: `تنفيذ «${x.name}»` }); if (!out.length) setOpen(null) }}>احفظ</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Said said={said} />
    </Glass>
  )
}

/* ── Closing · the partner's final report, every sub-project's requirements, then the close (13.2.28 – 13.2.30) ── */
function CloseCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [report, setReport] = useState(pf.close.report)
  const [evidence, setEvidence] = useState<string[]>(pf.close.evidence)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const checks = pfCloseChecks(pf)
  return (
    <Glass>
      <Head title="إغلاق المحفظة" meta={pf.stage === 'closed' ? <Tag tone="ok">أُغلقت <DateText>{pf.close.closedAt!}</DateText></Tag> : <Tag tone="mute">بعد آخر مشروع</Tag>} />
      <Checks items={checks} />
      {asPartner && (pf.stage === 'approved' || pf.stage === 'closing') && (
        <>
          <label className="regf mt-3"><span className="lb">التقرير الختامي</span><span className="fld"><textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} aria-label="التقرير الختامي للمحفظة" /></span></label>
          <div className="apv-row mt-2">
            <span className="sub">{evidence.length ? evidence.join(' · ') : 'الشواهد'}</span>
            <UploadButton label="شاهد" onPick={(f) => setEvidence((x) => [...x, f.name])} />
            <button type="button" className="btn btn-p btn-sm" onClick={() => { const out = submitPfReport(pf.id, report, evidence, user.name); setSaid(out.length ? { bad: out } : { ok: 'التقرير الختامي' }) }}>ارفع التقرير</button>
          </div>
        </>
      )}
      {!asPartner && pf.close.report && <p className="prose mt-2">{isolate(pf.close.report)}</p>}
      {!asPartner && (role.key === 'supervisor' || role.key === 'grants-manager') && pf.stage === 'closing' && (
        <div className="apv-row mt-3">
          <button type="button" className="btn btn-p btn-sm" disabled={checks.some((c) => !c.ok)} onClick={() => { const out = closePortfolio(pf.id, user.name); setSaid(out.length ? { bad: out } : { ok: 'إغلاق المحفظة' }) }}>أغلق المحفظة</button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}
