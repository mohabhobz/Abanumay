import { LogTab } from '@/features/projects/tabs'
import { recordLog } from '@/features/shared/recordLog'
import { RecordFiles } from '@/features/shared/RecordFiles'
import { holds } from '@/data/shared/decisions'
import { useState } from 'react'
import { payBlock } from '@/data/entities/store'
import { portfolioAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ButtonLink, FormField, FieldBox, Button, GateArc, FieldMultiSelect,
  BackTo, DateText, DockActions, Empty, FieldSelect, Glass, Head, Icon, KV, Money, MoneyField, Person, SearchBox, Stat, Tabs, Tag, icons, MultiSelect } from '@/components/ui'
import { CHART_COLORS, Legend, RankBars, StackBar, type Slice } from '@/components/charts'
import { UploadButton } from '@/components/docs'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { REGIONS } from '@/data/mock/taxonomy'
import { entityById } from '@/data/mock/entities'
import { isolate, nf, pct } from '@/lib/format'
import { HOLD_STAGE_SAY, linkOf, usableLines } from '@/data/budget/store'
import {
  PF_STAGE_SAY, PF_STAGE_TONE, SUB_STATE_SAY, SUB_STATE_TONE, actOnPfAgreement, actOnPortfolio, addSub, capIssue,
  decideSubs, dropSub, pfActions, pfById, pfCloseChecks, pfIndicators, pfMoney, pfStops, savePfSchedule,
  sendSubs, subsGate, submitPfReport, usePartners, profileOf,
  type PortfolioRec, type SubProject, pfActivities, pfActivityProgress, PF_ACTIVITY_MODE, setPfActivityMode, linkSubActivity,
  PF_CLOSE_SAY, PF_REQ_SAY, SUB_FIELDS_DEFAULT, SUB_FIELD_SAY, actOnPfClose, actOnPfEval, attachPfCriteria, attachPfMinutes, cancelPortfolio,
  excludeSub, isLiveSub, pfApproverOf, pfEvalScore, pfSessions, pfToSession, recommendSubs, recordPfReceipt, savePfEval, savePfForm, setPfReliable, stallSub, studySubs,
  type SubField, type SubState, pfStudyIssues, pfStudyScore, savePfStudy,
} from '@/data/partners/store'
import { CRITERIA, GROUP_SAY, type Criterion } from '@/data/intake/criteria'
import { SESSIONS } from '@/data/approvals/store'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import { Checks, Said, SlotsEditor } from '@/features/partners/parts'
import type { Reading } from '@/components/assistant/reading'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { authorityFor, type Holder } from '@/data/holders'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { outcomeMatches, outcomeOptions, portfolioOutcome, subOutcome } from '@/data/shared/outcome'

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

export default function PortfolioPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const asPartner = params.get('as') === 'partner'
  /* opened from the partners hub (`?from=partners`) · the way back returns there, otherwise to the projects */
  const fromPartners = params.get('from') === 'partners'
  usePartners()
  const { role, user } = useRole()
  const mobile = useIsMobile()
  const pf = id ? pfById(id) : undefined
  const [line, setLine] = useState('')
  const [split, setSplit] = useState<{ key: string; amount: string }[]>([])
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  if (!pf) {
    return (
      <AppLayout assistantContext={assistFor.page('المحافظ')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="المشاريع" onClick={() => navigate(ROUTES.projects)} />
          <Glass><Empty title="المحفظة غير موجودة." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const m = pfMoney(pf)
  const gate = subsGate(pf)
  const actions = pfActions(pf, role.key, asPartner)
  const lines = usableLines('fy-2026')
  /* the partners' portfolios allocation first · then the partnerships' other allocation · then any line that covers it */
  const preferred = lines.find((l) => l.node.id === 'tPg2' && l.free >= pf.total) ?? lines.find((l) => l.node.id === 'tPg1' && l.free >= pf.total) ?? lines.find((l) => l.free >= pf.total)
  const lineKey = line || preferred?.key || ''
  const pick = lines.find((l) => l.key === lineKey)
  /* Batch 6 · 8 Oct · the hold can split across lines, in one budget or several (13.2.7) · the parts
     add up to the portfolio's value */
  const splitShares = split.map((x) => { const l = lines.find((y) => y.key === x.key); return l ? { docId: l.doc.id, nodeId: l.node.id, amount: Number(x.amount) || 0 } : undefined }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  const shares = split.length ? splitShares : pick ? [{ docId: pick.doc.id, nodeId: pick.node.id, amount: pf.total }] : undefined
  const link = linkOf(pf.id)
  const partner = pf.entityId


  /* Client 27 Oct · a portfolio passes every approval seat a regular project does · the same arc, the
     seat read from its stage, the amount its value */
  const PF_SEAT: Partial<Record<typeof pf.stage, Holder>> = { draft: 'supervisor', returned: 'supervisor', supervisor: 'supervisor', manager: 'manager', ceo: 'exec', committee: 'committee', board: 'board' }
  const pfBase = authorityFor(pf.total, PF_SEAT[pf.stage] ?? null)
  /* each seat reads the portfolio's value at it, like a project's stage amounts */
  const pfAuthority = { ...pfBase, roles: pfBase.roles.map((r) => ({ ...r, amount: r.kind === 'submit' || r.state === 'done' || r.state === 'now' ? pf.total : null })) }
  const ended = portfolioOutcome(pf.stage)

  /* The tabs open with the portfolio's life · the plan, agreement, indicators, payments and closing
     exist once it is finally approved, and the partner never sees the study and the hold */
  const post = pf.stage === 'approved' || pf.stage === 'closing' || pf.stage === 'closed' || pf.stage === 'cancelled'
  const tabs = [
    { slug: 'data', label: 'بيانات المحفظة' },
    ...(asPartner ? [] : [{ slug: 'study', label: 'الدراسة والاعتماد' }]),
    { slug: 'subs', label: 'المشاريع الفرعية', count: pf.items.length },
    ...(post ? [
      { slug: 'ind', label: 'المؤشرات' },
      { slug: 'plan', label: 'الخطة' },
      { slug: 'agreement', label: 'الاتفاقية' },
      { slug: 'pays', label: 'الدفعات' },
      { slug: 'close', label: 'الإغلاق' },
    ] : []),
    /* Client 27 Oct · the attachments and the log close every record's tabs */
    { slug: 'files', label: 'المرفقات' },
    { slug: 'log', label: 'سجل المحفظة' },
  ]
  /* the study is where a portfolio waiting on the supervisor or a body stands · the sub-projects once it's approved */
  const fallback = !asPartner && ['supervisor', 'manager', 'ceo', 'committee', 'board'].includes(pf.stage) ? 'study' : post ? 'subs' : 'data'
  const active = tabs.find((t) => t.slug === params.get('tab'))?.slug ?? fallback
  /* «?tab=all» lays every pane out in order · the end-to-end runs read the whole portfolio in one pass */
  const on = (slug: string) => params.get('tab') === 'all' ? tabs.some((t) => t.slug === slug) : active === slug
  const goTab = (slug: string) => { const next = new URLSearchParams(params); next.set('tab', slug); setParams(next, { replace: true }) }

  const readings: Reading[] = [
    ...(pf.stage === 'supervisor' && !link ? [{ id: 'pf-hold', kind: 'flag' as const, label: 'الحجز', text: 'اختر بند الميزانية قبل التوصية · تُحجز القيمة كاملةً مرة واحدة.', src: /* doc 13.2.7 */ '' }] : []),
    ...(!gate.ok && pf.stage === 'approved' ? [{ id: 'pf-gate', kind: 'flag' as const, label: 'المشاريع الفرعية', text: gate.why, src: /* doc 13.2.10 */ '' }] : []),
    ...(m.pending ? [{ id: 'pf-pend', kind: 'note' as const, label: 'قيد الاعتماد', metric: { value: nf.format(m.pending), unit: 'ريال' }, text: `${pf.items.filter((x) => x.state === 'pending').length} مشروع بانتظار قرار مدير المنح · قيمتها محجوزة داخل المحفظة.`, src: /* doc 13.4.16 */ '' }] : []),
    { id: 'pf-avail', kind: m.available < 0 ? 'flag' as const : 'note' as const, label: 'الرصيد المتاح', metric: { value: nf.format(Math.max(0, m.available)), unit: 'ريال' }, text: `من ${nf.format(pf.total)} · معتمد ${nf.format(m.approved)} وقيد الاعتماد ${nf.format(m.pending)}.`, src: /* doc 13.2.18 */ '', bar: { value: m.approved + m.pending, limit: pf.total, valueLabel: 'المعتمد وقيد الاعتماد', limitLabel: 'المحفظة', unit: 'ريال' } },
    ...(m.recorded > m.confirmed ? [{ id: 'pf-fin', kind: 'flag' as const, label: 'المراجعة المالية', metric: { value: nf.format(m.recorded - m.confirmed), unit: 'ريال' }, text: 'دفعات مسجلة لم تؤكدها المالية بعد.', src: /* doc 11.2.13 */ '' }] : []),
    /* Cross · the periodic summary, the early delay forecast and the fit with the portfolio's goals */
    ...(asPartner ? [] : portfolioAi(pf)),
  ]

  return (
    <AppLayout assistantContext={assistFor.page(pf.name)}>
      <div className={`viewstack${actions.length ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          {/* client meeting 20 Oct · a portfolio opened from the projects list went back to «الشركاء», which
              read as a module the user never passed through · the way back follows where it was opened from */}
          <BackTo label={asPartner ? 'البوابة' : fromPartners ? 'الشركاء' : 'المشاريع'} onClick={() => navigate(asPartner ? `${ROUTES.entityPortal}?entity=${partner}` : fromPartners ? ROUTES.partnersTab('portfolios') : `${ROUTES.projects}?tab=portfolios`)} />
          <Said said={said} />

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{pf.name}</h1>
              <p className="sub mt-1">
                <span className="num">{pf.id}</span> · {asPartner ? 'محفظتك' : <Link className="tlink" to={ROUTES.entity(partner)}>{entityName(pf)}</Link>} · {pf.track} · {pf.field} · فُتحت <DateText>{pf.openedAt}</DateText>
              </p>
              {/* Client 27 Oct · an ended portfolio reads its outcome in the arc's centre, not here */}
              {!ended && (
                <div className="gt-tag rowf gp-2">
                  <Tag tone={PF_STAGE_TONE[pf.stage]}>{PF_STAGE_SAY[pf.stage]}</Tag>
                </div>
              )}
            </div>
            <div className="pgates">
              <GateArc amount={pf.total} authority={pfAuthority} compact={mobile} outcome={ended} />
            </div>
          </header>

          {pf.note && (pf.stage === 'returned' || pf.stage === 'rejected' || pf.stage === 'supervisor' || pf.stage === 'manager') && (
            <Glass>
              <Head title={pf.stage === 'rejected' ? 'سبب الرفض' : 'ملاحظات الإعادة'} meta={<Tag tone={pf.stage === 'rejected' ? 'no' : 'warn'}>{pf.stage === 'rejected' ? 'مرفوضة' : 'للاستكمال'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(pf.note)}</span></div>
            </Glass>
          )}

          {/* Client 20 Oct (#21) · the portfolio is a project from its study on · the same tabbed page
              as a regular project, each tab one question, the side reading fixed beside them */}
          <Tabs items={tabs} active={active} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {on('data') && (
                <>
                  <Glass>
                    <Head title="بيانات المحفظة" />
                    <KV rows={[
                      { k: 'الشريك', v: entityName(pf) },
                      { k: 'قيمة المحفظة', v: <Money>{pf.total}</Money> },
                      { k: 'المسار والمجال', v: `${pf.track} · ${pf.field}` },
                      { k: 'الأهداف', v: isolate(pf.goals) },
                      { k: 'المرفقات', v: pf.files.join(' · ') || '—' },
                      { k: 'مشرف المنح', v: <Person name={pf.owner} /> },
                    ]} />
                  </Glass>

                  {!asPartner && <SettingsCard pf={pf} asPartner={asPartner} />}
                </>
              )}

              {on('study') && (
                <>
                  {(pf.stage === 'supervisor' || pf.study) && <StudyCard pf={pf} />}
                  <HoldCard pf={pf} lineKey={lineKey} setLine={setLine} lines={lines} link={link} split={split} setSplit={setSplit} />
                  {(pf.stage === 'committee' || pf.stage === 'board') && <SessionCard pf={pf} />}
                </>
              )}

              {on('subs') && <SubsCard pf={pf} asPartner={asPartner} />}

              {on('ind') && <IndicatorsCards pf={pf} />}

              {on('plan') && <PlanCard pf={pf} asPartner={asPartner} />}

              {on('agreement') && <AgreementCard pf={pf} asPartner={asPartner} />}

              {on('pays') && <PaysCard pf={pf} asPartner={asPartner} />}

              {on('close') && (
                <>
                  <CloseCard pf={pf} asPartner={asPartner} />
                  <CancelCard pf={pf} asPartner={asPartner} />
                </>
              )}

              {on('files') && <RecordFiles record={`portfolio:${pf.id}`} me={asPartner ? entityName(pf) : user.name} canUpload={pf.stage !== 'cancelled' && pf.stage !== 'closed'}
                seed={pf.files.map((n) => ({ name: n, meta: 'مرفقات المحفظة' }))} />}
              {on('log') && <LogTab title="سجل المحفظة" events={recordLog(`pf-${pf.id}`, 'المحافظ', pf.log)} entityName={entityName(pf)} />}
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
              {/* Client 26 Oct · the bar holds the buttons only · each one confirms in its popup, with the reason there */}
              <div className="payact-g">
                <DockActions
                  actions={actions.map((a) => ({ ...a, stops: pfStops(pf, a.act, a.act === 'recommend' ? shares : undefined), why: /* doc 13.2.6 */ '' }))}
                  subject={<>المحفظة · {nf.format(pf.total)} ريال</>}
                  placeholder="سبب الإعادة أو الرفض · يصل مع القرار"
                  onRun={(a, n) => { const out = actOnPortfolio(pf.id, a.act, n, user.name, a.act === 'recommend' ? shares : undefined); if (!out.length) setSaid({ ok: a.label }); return out }}
                />
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
/* ── v3 · 13.2.6 · 13.4.4 · the portfolio is studied by the same weighted criteria as a project ──
   The supervisor rates each criterion 1 – 5 at the study stage · the weights are the settings' («معايير
   التقييم») · the recommendation waits for a complete study · the score travels up the approval steps. */
const STUDY_GROUPS: Criterion['group'][] = ['فني', 'مالي', 'إداري']
const STUDY_SCALE = [1, 2, 3, 4, 5] as const
function StudyCard({ pf }: { pf: PortfolioRec }) {
  const { role, user } = useRole()
  const editable = pf.stage === 'supervisor' && role.key === 'supervisor'
  const [scores, setScores] = useState<Record<string, number>>(() => ({ ...(pf.study?.scores ?? {}) }))
  const [note, setNote] = useState(pf.study?.note ?? '')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const score = pfStudyScore({ ...pf, study: { scores, note, by: '', at: '' } }) ?? 0
  const missing = editable ? pfStudyIssues({ ...pf, study: { scores, note, by: '', at: '' } }) : []
  return (
    <Glass>
      <Head title="دراسة المحفظة بمعايير التقييم" meta={<Tag tone={score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'mute'}>{score} من 100</Tag>} />
      {!editable && (
        <p className="sub cnote">
          {pf.study ? <>دراسة <Person name={pf.study.by} /> · <DateText>{pf.study.at}</DateText></> : 'لم تُسجَّل دراسة بعد.'}
        </p>
      )}
      {STUDY_GROUPS.map((g) => (
        <div key={g} className="stdy-g">
          <h3 className="stdy-h">الدراسة {GROUP_SAY[g].study}</h3>
          <ul className="stdy-list">
            {CRITERIA.list.filter((c) => c.group === g).map((c) => (
              <li key={c.key}>
                <span className="stdy-l">{c.label}</span>
                <span className="sub">{pct(c.weight)}</span>
                <span className="pc-sp" />
                <span className="stdy-scale" role="radiogroup" aria-label={`${c.label} · المحفظة`}>
                  {STUDY_SCALE.map((n) => (
                    <Button plain key={n} type="button" role="radio" aria-checked={scores[c.key] === n} className={`cfgchip${scores[c.key] === n ? ' on' : ''}`}
                      disabled={!editable} onClick={() => { setScores((x) => ({ ...x, [c.key]: n })); setSaid({}) }}>
                      <span className="num">{n}</span>
                    </Button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {(editable || note) && (
        <FormField label="ملاحظات الدراسة" wide>
          <FieldBox area><textarea rows={3} value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)} aria-label="ملاحظات دراسة المحفظة" /></FieldBox>
        </FormField>
      )}
      {editable && (
        <div className="apv-row mt-3">
          <Button type="button" variant="p" size="sm" onClick={() => { const out = savePfStudy(pf.id, scores, note, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'دراسة المحفظة' }) }}>احفظ الدراسة</Button>
          {missing.length > 0 && <span className="sub">{missing[0]}</span>}
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

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
          { k: link.shares.length > 1 ? 'البنود' : 'البند', v: link.shares.map((s) => `${s.nodeId === 'tPg1' ? 'مخصص الشراكات' : s.nodeId === 'tPg2' ? 'مخصص محافظ الشركاء' : label(`${s.docId}/${s.nodeId}`)}${link.shares.length > 1 ? ` · ${nf.format(s.amount)}` : ''}`).join(' · ') },
          { k: 'المحجوز', v: <Money sm>{link.amount}</Money> },
          { k: 'المصروف منه', v: <Money sm>{link.shares.reduce((s, x) => s + x.paid, 0)}</Money> },
        ]} />
      ) : pickable && split.length ? (
        <div className="regfields">
          {split.map((x, i) => (
            <div className="rowf gp-2" key={i}>
              <FormField label={<>البند {i + 1}</>}>
                <FieldSelect value={x.key} onChange={(k) => setSplit(split.map((y, j) => (j === i ? { ...y, key: k } : y)))} label={`بند الحجز ${i + 1}`}
                  options={lines.filter((l) => l.key === x.key || !split.some((y) => y.key === l.key)).map((l) => ({ value: l.key, label: `${l.doc.name ?? l.doc.id} · ${l.node.label} · متاح ${nf.format(l.free)}` }))} />
              </FormField>
              <FormField label="المبلغ">
                <FieldBox><input inputMode="numeric" value={x.amount} onChange={(e) => setSplit(split.map((y, j) => (j === i ? { ...y, amount: e.target.value.replace(/[^\d]/g, '') } : y)))} aria-label={`مبلغ بند الحجز ${i + 1}`} /></FieldBox>
              </FormField>
              <Button type="button" variant="ghost" size="sm" aria-label={`احذف البند ${i + 1}`} onClick={() => setSplit(split.filter((_, j) => j !== i))}><Icon name={icons.close} size="sm" /></Button>
            </div>
          ))}
          <div className="rowf gp-2">
            <Button type="button" variant="2" size="sm" onClick={() => setSplit([...split, { key: '', amount: '' }])}><Icon name={icons.plus} size="sm" />أضف بندًا</Button>
            <span className={sum === pf.total ? 'sub' : 'bad'}>المجموع {nf.format(sum)} من {nf.format(pf.total)}</span>
          </div>
        </div>
      ) : pickable ? (
        <>
        <FormField label="بند الميزانية">
          <FieldSelect value={lineKey} onChange={setLine} label="بند الميزانية" options={lines.filter((l) => l.free >= pf.total).map((l) => ({ value: l.key, label: `${l.node.label} · متاح ${nf.format(l.free)}` }))} />
        </FormField>
        <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setSplit([{ key: lineKey, amount: '' }, { key: '', amount: '' }])}>وزّع الحجز على أكثر من بند أو ميزانية</Button>
        </>
      ) : null}
    </Glass>
  )
}

/* ── The portfolio's plan · client 18 Oct (#32) · it runs through the plans module (BPD-012) ──
   Drafting, the supervisor's review, the grants manager's approval, execution and change requests are
   the plans module's · this card shows where the plan stands and opens it there. */
function PlanCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role } = useRole()
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const tone = pf.plan.state === 'approved' ? 'ok' : pf.plan.state === 'review' || pf.plan.state === 'supervisor' ? 'warn' : pf.plan.state === 'returned' ? 'ret' : 'mute'
  const say = { none: 'لم تُعدّ', draft: 'مسودة', supervisor: 'بانتظار مراجعة المشرف', review: 'بانتظار مدير المنح', approved: 'معتمدة', returned: 'معادة' }[pf.plan.state]
  const id = pf.plan.planId
  /* the drafter writes it · the partner from the portal, the supervisor on its behalf */
  const writes = (pf.plan.state === 'none' || pf.plan.state === 'draft' || pf.plan.state === 'returned') && (asPartner || role.key === 'supervisor')
  return (
    <Glass>
      <Head title="خطة المحفظة" meta={<Tag tone={tone}>{say}</Tag>} />
      {pf.plan.note && pf.plan.state === 'returned' && <p className="bad cnote">{pf.plan.note}</p>}
      <ul className="ptn-slots">
        {pf.plan.phases.map((p) => <li key={p.id}><span>{p.name}</span><span className="sub"><DateText>{p.from}</DateText> – <DateText>{p.to}</DateText>{p.activities?.length ? ` · ${p.activities.map((a) => `${a.name}${a.output ? ` (${a.output})` : ''}`).join('، ')}` : ''}</span><Money sm>{p.cost}</Money></li>)}
        {/* v3 · 12.4.13 · each activity read from the sub-projects that serve it */}
        {pfActivities(pf).filter((a) => pfActivityProgress(pf, a.id).linked > 0).map((a) => <li key={`pr-${a.id}`}><span>{a.label}</span><span className="sub">{pfActivityProgress(pf, a.id).say}</span></li>)}
        {!pf.plan.phases.length && <li className="sub">لا مراحل بعد.</li>}
      </ul>
      {id && (
        <div className="apv-row mt-3">
          {writes && <ButtonLink variant="p" size="sm" to={`${ROUTES.planEdit(id)}${asPartner ? '?as=entity' : ''}`}>{pf.plan.phases.length ? 'أكمل الخطة' : 'أعدّ الخطة'}</ButtonLink>}
          <ButtonLink variant={writes ? '2' : 'p'} size="sm" to={`${ROUTES.plan(id)}${asPartner ? '?as=entity' : ''}`}>افتح الخطة · <bdi>{id}</bdi></ButtonLink>
        </div>
      )}
      {!asPartner && role.key === 'grants-manager' && pfActivities(pf).length > 0 && (
        <div className="cfgchips mt-2" role="radiogroup" aria-label="أثر اكتمال المشروع الفرعي على النشاط">
          {(['update', 'evidence'] as const).map((m) => (
            <Button plain key={m} type="button" role="radio" aria-checked={PF_ACTIVITY_MODE.mode === m} className={`cfgchip${PF_ACTIVITY_MODE.mode === m ? ' on' : ''}`} onClick={() => { setPfActivityMode(m); setSaid({ ok: 'الإعداد' }) }}>
              {m === 'update' ? 'اكتمال المشاريع الفرعية يحدّث إنجاز النشاط' : 'اكتمالها دليل على النشاط فقط'}
            </Button>
          ))}
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The agreement · drafted, approved, signed by the partner; the payment schedule rides on it (13.2.9 · 13.2.24) ── */
function AgreementCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()

  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const a = pf.agreement
  const say = { none: 'لم تُعدّ', draft: 'مسودة · مشرف المنح', manager: 'بانتظار مدير المنح', executive: 'بانتظار المدير التنفيذي', partner: 'بانتظار توقيع الشريك', foundation: 'بانتظار توقيع ممثل المؤسسة', signed: 'موقّعة وسارية', returned: 'معادة' }[a.state]
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  const sup = !asPartner && role.key === 'supervisor'
  return (
    <Glass>
      <Head title="اتفاقية المحفظة" meta={<Tag tone={a.state === 'signed' ? 'ok' : a.state === 'none' ? 'mute' : 'warn'}>{say}</Tag>} />
      {a.file && <p className="sub cnote">{a.file}</p>}
      {/* Batch 7 · partners#12 · the agreement's own text, from the template with the portfolio's terms */}
      {a.body && (
        <details className="mt-2">
          <summary className="lnk">نص الاتفاقية{a.versions && a.versions.length > 1 ? ` · الإصدار ${a.versions.length}` : ''}</summary>
          <ol className="rqobj">{a.body.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </details>
      )}
      {a.note && a.state === 'returned' && <p className="bad cnote">{a.note}</p>}
      {pf.channel === 'direct' && (
        <>
          <h4 className="ptn-sub">جدول دفعات المحفظة</h4>
          <SlotsEditor slots={pf.schedule} total={pf.total} locked={!sup || a.state === 'signed' || pf.requests.length > 0} onSave={(s) => savePfSchedule(pf.id, s, user.name)} />
        </>
      )}
      <div className="apv-row mt-3">
        {sup && (a.state === 'none' || a.state === 'returned') && <Button type="button" variant="2" size="sm" onClick={() => r(actOnPfAgreement(pf.id, 'draft', '', user.name), 'مسودة الاتفاقية')}>أعدّ المسودة من النموذج</Button>}
        {sup && a.state === 'draft' && <Button type="button" variant="p" size="sm" onClick={() => r(actOnPfAgreement(pf.id, 'send', '', user.name), 'إرسال الاتفاقية')}>أرسل لمدير المنح</Button>}
        {!asPartner && ((role.key === 'grants-manager' && a.state === 'manager') || (role.key === 'ceo' && a.state === 'executive')) && (
          /* Client 26 Oct · the decision confirms in its popup · the return's reason there */
          <DockActions
            actions={[
              { label: 'أعد', kind: 'btn-2 btn-sm', needsNote: true, act: 'return' as const },
              { label: a.state === 'manager' ? 'اعتمد وأحل للمدير التنفيذي' : 'اعتمد وأرسل للشريك', kind: 'btn-p btn-sm', act: 'approve' as const },
            ]}
            subject={<>اتفاقية المحفظة · {pf.name}</>}
            placeholder="سبب الإعادة"
            onRun={(x, n) => { const out = actOnPfAgreement(pf.id, x.act, n, user.name); r(out, x.act === 'return' ? 'إعادة الاتفاقية' : 'اعتماد الاتفاقية'); return out }}
          />
        )}
        {!asPartner && (role.key === 'grants-manager' || role.key === 'ceo') && a.state === 'foundation' && (
          <Button type="button" variant="p" size="sm" onClick={() => r(actOnPfAgreement(pf.id, 'countersign', '', user.name), 'توقيع ممثل المؤسسة')}>وقّع عن المؤسسة · تسري الاتفاقية</Button>
        )}
        {asPartner && a.state === 'partner' && <UploadButton label="الاتفاقية الموقعة" onPick={(f) => r(actOnPfAgreement(pf.id, 'sign', '', user.name, f.name), 'توقيع الاتفاقية')} />}
      </div>
      <Said said={said} />
    </Glass>
  )
}

/* ── Sub-projects · added, sent, studied, recommended and decided one by one within the ceiling (13.2.11 – 13.2.19) ── */
const FILTERS: { key: string; label: string; test: (x: SubProject) => boolean }[] = [
  { key: 'all', label: 'الكل', test: () => true },
  { key: 'draft', label: 'مسودة', test: (x) => x.state === 'draft' },
  { key: 'study', label: 'مرفوع وقيد الدراسة', test: (x) => x.state === 'submitted' || x.state === 'study' },
  { key: 'pending', label: 'بانتظار الاعتماد', test: (x) => x.state === 'pending' },
  { key: 'live', label: 'معتمد', test: (x) => x.state === 'approved' || x.state === 'closing' || x.state === 'stalled' },
  { key: 'done', label: 'مكتمل', test: (x) => x.state === 'done' },
  { key: 'out', label: 'مرفوض أو مستبعد', test: (x) => x.state === 'rejected' || x.state === 'excluded' },
]
const EMPTY = { name: '', region: '', city: '', amount: '', beneficiaries: '', outputs: '', files: [] as string[], activityId: '' }
function SubsCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [d, setD] = useState(EMPTY)
  const [sel, setSel] = useState<string[]>([])
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const [one, setOne] = useState('')
  const [adding, setAdding] = useState(false)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  /* Client 20 Oct (#21) · the sub-projects filtered like a project list · by state, and by name or region */
  const [flt, setFlt] = useState('all')
  const [q, setQ] = useState('')
  /* Client sheet 24 Oct (#95) · the sub-project's outcome · مكتمل / مرفوض / ملغي, or still under way */
  const [res, setRes] = useState<string[]>([])
  const test = FILTERS.find((f) => f.key === flt)?.test ?? (() => true)
  const inQ = pf.items.filter((x) => test(x) && (!q.trim() || `${x.name} ${x.region} ${x.city ?? ''}`.includes(q.trim())))
  const shown = inQ.filter((x) => outcomeMatches(subOutcome(x.state), res))
  const gate = subsGate(pf)
  const adder = gate.ok && (asPartner || role.key === 'supervisor')
  const sup = !asPartner && role.key === 'supervisor'
  const mgr = !asPartner && role.key === 'grants-manager'
  const dropper = (asPartner || role.key === 'supervisor') && (gate.ok || pf.stage === 'closing')
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const count = (s: SubState) => pf.items.filter((x) => x.state === s).length
  /* v3 · 0.sub.1 – 0.sub.3 · each seat selects what waits on it */
  const selectable = (x: SubProject) => (mgr ? x.state === 'pending' : sup ? x.state === 'draft' || x.state === 'submitted' || x.state === 'study' : adder && x.state === 'draft')
  const pool = pf.items.filter(selectable)
  const picked = pf.items.filter((x) => sel.includes(x.id))
  const drafts = picked.filter((x) => x.state === 'draft')
  const sent = picked.filter((x) => x.state === 'submitted')
  const studied = picked.filter((x) => x.state === 'study' || x.state === 'submitted')
  /* Client 18 Oct (#40) · a selection in different states has no common action */
  const mixed = new Set(picked.map((x) => x.state)).size > 1
  const cap = capIssue(pf, drafts.map((x) => x.id))
  const req = pf.subFields ?? SUB_FIELDS_DEFAULT
  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }); if (!out.length) setSel([]) }
  const add = () => {
    const out = addSub(pf.id, { name: d.name, region: d.region, city: d.city || undefined, amount: Number(d.amount) || 0, beneficiaries: Number(d.beneficiaries) || 0, outputs: d.outputs, files: d.files, activityId: d.activityId || undefined }, asPartner ? entityName(pf) : user.name)
    if (out.errors.length) { setSaid({ bad: [`ينقص: ${out.errors.join('، ')}`] }); return }
    setSaid({ ok: 'المشروع الفرعي · مسودة' })
    setD(EMPTY)
    setAdding(false)
  }
  const decide = (outcome: 'approve' | 'reject') => r(decideSubs(pf.id, sel.map((subId) => ({ subId, outcome, reason: reasons[subId], note: outcome === 'approve' ? reasons[subId] : undefined })), user.name, role.key), outcome === 'approve' ? 'اعتماد المحدد' : 'رفض المحدد')
  const recommend = (outcome: 'approve' | 'reject') => r(recommendSubs(pf.id, studied.map((x) => ({ subId: x.id, outcome, note: reasons[x.id] ?? '' })), user.name, role.key), outcome === 'approve' ? 'التوصية بالاعتماد' : 'التوصية بالرفض')
  return (
    <Glass className="tblcard">
      <Head title="المشاريع الفرعية" meta={<span className="sub">{pf.items.filter(isLiveSub).length} معتمد · {count('submitted') + count('study')} مرفوع وقيد الدراسة · {count('pending')} بانتظار الاعتماد · {count('draft')} مسودة</span>} />
      {!gate.ok && <p className="sub cnote"><Icon name={icons.lock} size="sm" /> {gate.why}</p>}
      {pf.items.length > 0 && (
        <div className="ftool-f mb-2">
          <div className="cfgchips" role="radiogroup" aria-label="حالة المشروع الفرعي">
            {FILTERS.map((f) => {
              const n = pf.items.filter(f.test).length
              return (n > 0 || f.key === 'all') && (
                <Button plain key={f.key} type="button" role="radio" aria-checked={flt === f.key} className={`cfgchip${flt === f.key ? ' on' : ''}`} onClick={() => setFlt(f.key)}>
                  {f.label} <span className="num">{n}</span>
                </Button>
              )
            })}
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="ابحث باسم المشروع الفرعي أو المنطقة" />
          <MultiSelect values={res} all="كل النتائج" options={outcomeOptions(inQ, (x) => subOutcome(x.state))} onChange={setRes} />
        </div>
      )}
      {pf.items.length > 0 && !shown.length && <p className="sub cnote">لا مشاريع فرعية تطابق الفلتر.</p>}
      {shown.length > 0 && (
        <div className="tblwrap">
          <table className="tbl subtbl" aria-label="المشاريع الفرعية">
            <thead>
              <tr>
                <th className="tchk">{pool.length > 0 && <input type="checkbox" aria-label="تحديد الكل" checked={sel.length === pool.length} onChange={(e) => setSel(e.target.checked ? pool.map((x) => x.id) : [])} />}</th>
                <th><span className="th-t">المشروع · المنطقة · المستهدف</span></th>
                <th className="n"><span className="th-t">القيمة</span></th>
                <th><span className="th-t">الحالة</span></th>
                <th><span className="th-t">التوصية والملاحظة</span></th>
                <th><span className="th-t">النتيجة</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id} id={x.id}>
                  <td className="tchk">{selectable(x) && <input type="checkbox" aria-label={`تحديد ${x.name}`} checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />}</td>
                  <td><Link className="tlink" to={`${ROUTES.subProject(pf.id, x.id)}${asPartner ? '?as=partner' : ''}`}><b>{x.name}</b></Link><div className="sub"><span className="num">{x.serial ?? x.id}</span> · {x.field ?? pf.field} · {x.region}{x.city ? ` · ${x.city}` : ''} · {nf.format(x.beneficiaries)} مستفيد · {x.outputs} · {x.files.join('، ')}{x.activityId ? ` · النشاط: ${pfActivities(pf).find((a) => a.id === x.activityId)?.label ?? x.activityId}` : ''}</div>
                    {(asPartner || role.key === 'supervisor') && pfActivities(pf).length > 0 && x.state !== 'rejected' && x.state !== 'excluded' && (
                      <FieldSelect value={x.activityId ?? ''} label={`نشاط خطة المحفظة · ${x.name}`} placeholder="اربط بنشاط" options={[{ value: '', label: 'بلا نشاط' }, ...pfActivities(pf).map((a) => ({ value: a.id, label: a.label }))]} onChange={(v) => r(linkSubActivity(pf.id, x.id, v, asPartner ? entityName(pf) : user.name), 'ربط النشاط')} />
                    )}</td>
                  <td className="n"><Money sm>{x.amount}</Money></td>
                  <td className="subst">
                    {/* Client 20 Oct (#30) · the state tag stays whole and the seat's note sits under it on one
                        line, cut with its full text on hover · it spilled out of the table beside the tag */}
                    <span className="tagfit"><Tag tone={SUB_STATE_TONE[x.state]}>{SUB_STATE_SAY[x.state]}</Tag></span>
                    {x.exec && isLiveSub(x) && <div className="sub">إنجاز <span className="num">{pct(x.exec.progress)}</span> · <span className="num">{nf.format(x.exec.reached)}</span> مستفيد</div>}
                    {(mgr || sup) && sel.includes(x.id) && x.state !== 'draft' && (
                      <FieldBox className="mt-1"><input value={reasons[x.id] ?? ''} onChange={(e) => setReasons((r0) => ({ ...r0, [x.id]: e.target.value }))} aria-label={`ملاحظة على ${x.name}`} placeholder={mgr ? 'سبب الرفض أو ملاحظة الاعتماد' : 'ملاحظة التوصية · إلزامية للرفض'} /></FieldBox>
                    )}
                    {dropper && x.state === 'draft' && <Button type="button" variant="ghost" size="sm" onClick={() => { dropSub(pf.id, x.id, asPartner ? entityName(pf) : user.name); r([], 'حذف المسودة') }}>حذف المسودة</Button>}
                  </td>
                  {/* Client sheet 26 Oct (#113) · the recommendation and the note in their own column */}
                  <td>{(() => {
                    const why = [
                      x.rec && x.state === 'pending' ? `توصية المشرف: ${x.rec.outcome === 'approve' ? 'اعتماد' : 'رفض'}${x.rec.note ? ` · ${x.rec.note}` : ''}` : '',
                      x.reason ?? '', x.note ?? '', x.outcome && (x.state === 'stalled' || x.state === 'excluded') ? x.outcome.note : '',
                    ].filter(Boolean).join(' · ')
                    return why ? <span className="sub trim1" title={why}>{why}</span> : <span className="sub">—</span>
                  })()}</td>
                  <td><OutcomeTag outcome={subOutcome(x.state)} pending /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sel.length > 0 && (
        <div className="apv-row mt-3">
          <span className="sub">{sel.length} محدد · <span className="num">{nf.format(picked.reduce((s, x) => s + x.amount, 0))}</span></span>
          {mixed && <span className="sub">اختر طلبات بنفس الحالة لتظهر الإجراءات</span>}
          {!mixed && <>
          {cap && drafts.length > 0 && <span className="bad">{cap}</span>}
          {(asPartner || sup) && drafts.length > 0 && <Button type="button" variant="p" size="sm" disabled={Boolean(cap)} onClick={() => r(sendSubs(pf.id, drafts.map((x) => x.id), asPartner ? entityName(pf) : user.name), 'رفع المحدد للمراجعة')}>ارفع للمراجعة</Button>}
          {sup && sent.length > 0 && <Button type="button" variant="2" size="sm" onClick={() => r(studySubs(pf.id, sent.map((x) => x.id), user.name, role.key), 'بدء الدراسة')}>ابدأ الدراسة</Button>}
          {sup && studied.length > 0 && <Button type="button" variant="2" size="sm" onClick={() => recommend('reject')}>أوصِ بالرفض</Button>}
          {sup && studied.length > 0 && <Button type="button" variant="p" size="sm" onClick={() => recommend('approve')}>أوصِ بالاعتماد</Button>}
          {mgr && <Button type="button" variant="2" size="sm" onClick={() => decide('reject')}>ارفض المحدد</Button>}
          {mgr && <Button type="button" variant="p" size="sm" onClick={() => decide('approve')}>اعتمد المحدد</Button>}
          </>}
        </div>
      )}
      {/* v3 · 0.sub.7 · 0.sub.8 · 13.4.14 · a substantive change · stalled, or excluded with its value back */}
      {(sup || mgr) && pf.items.some((x) => ['pending', 'approved', 'closing', 'stalled'].includes(x.state)) && (
        <div className="apv-row mt-3">
          <FieldSelect value={one} onChange={setOne} label="مشروع فرعي للاستبعاد أو التعثر" placeholder="اختر مشروعًا فرعيًّا" options={pf.items.filter((x) => ['pending', 'approved', 'closing', 'stalled'].includes(x.state)).map((x) => ({ value: x.id, label: `${x.name} · ${SUB_STATE_SAY[x.state]}` }))} />
          {/* Client 26 Oct · the reason in the decision's popup */}
          <DockActions
            actions={[
              ...(['approved', 'closing'].includes(pf.items.find((x) => x.id === one)?.state ?? '') ? [{ label: 'متعثر', kind: 'btn-2 btn-sm', needsNote: true, act: 'stall' as const }] : []),
              { label: 'استبعد · تعود القيمة للرصيد', kind: 'btn-d btn-sm', needsNote: true, act: 'exclude' as const, stops: one ? [] : ['اختر المشروع الفرعي أولًا'] },
            ]}
            subject={<>{pf.items.find((x) => x.id === one)?.name ?? 'المشروع الفرعي'} · {pf.name}</>}
            placeholder="سبب الاستبعاد أو التعثر"
            onRun={(x, n) => { const out = x.act === 'stall' ? stallSub(pf.id, one, n, user.name, role.key) : excludeSub(pf.id, one, n, user.name, role.key); r(out, x.act === 'stall' ? 'متعثر' : 'استبعاد المشروع الفرعي'); if (!out.length) setOne(''); return out }}
          />
        </div>
      )}
      {adder && !adding && <div className="apv-row mt-3"><Button type="button" variant="2" size="sm" onClick={() => setAdding(true)}>أضف مشروعًا فرعيًّا</Button><span className="sub">الرصيد المتاح <span className="num">{nf.format(Math.max(0, pfMoney(pf).available))}</span></span></div>}
      {adder && adding && (
        <div className="ptn-form mt-3">
          <div className="regfields">
            <FormField label="اسم المشروع الفرعي"><FieldBox><input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="اسم المشروع الفرعي" /></FieldBox></FormField>
            <FormField label="المنطقة"><FieldSelect value={d.region} onChange={(v) => setD({ ...d, region: v })} label="المنطقة" options={[...new Set(['عموم المملكة', ...REGIONS])]} /></FormField>
            <FormField label="القيمة"><MoneyField value={d.amount} onChange={(v) => setD({ ...d, amount: v })} label="قيمة المشروع الفرعي" /></FormField>
            <FormField label={<>المستفيدون المستهدفون{req.includes('beneficiaries') ? '' : ' · اختياري'}</>}><FieldBox><input inputMode="numeric" value={d.beneficiaries} onChange={(e) => setD({ ...d, beneficiaries: e.target.value.replace(/\D/g, '') })} aria-label="المستفيدون المستهدفون" /></FieldBox></FormField>
            <FormField label={<>المدينة{req.includes('city') ? '' : ' · اختياري'}</>}><FieldBox><input value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} aria-label="المدينة" /></FieldBox></FormField>
            <FormField label={<>المخرجات المستهدفة{req.includes('outputs') ? '' : ' · اختياري'}</>} className="ptn-wide"><FieldBox><input value={d.outputs} onChange={(e) => setD({ ...d, outputs: e.target.value })} aria-label="المخرجات المستهدفة" /></FieldBox></FormField>
            {/* v3 · 12.4.13 · the plan activity it serves · several sub-projects may serve one */}
            {pfActivities(pf).length > 0 && (
              <FormField label={<>نشاط خطة المحفظة{req.includes('activity') ? '' : ' · اختياري'}</>}><FieldSelect value={d.activityId} onChange={(v) => setD({ ...d, activityId: v })} label="نشاط خطة المحفظة" placeholder="اختياري" options={pfActivities(pf).map((a) => ({ value: a.id, label: a.label }))} /></FormField>
            )}
          </div>
          <div className="apv-row mt-2">
            <span className="sub">{d.files.length ? d.files.join(' · ') : `مرفقات المشروع الفرعي${req.includes('files') ? '' : ' · اختياري'}`}</span>
            <UploadButton label="مرفق" onPick={(f) => setD((x) => ({ ...x, files: [...x.files, f.name] }))} />
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setD(EMPTY) }}>إلغاء</Button>
            <Button type="button" variant="p" size="sm" onClick={add}>احفظ مسودة</Button>
          </div>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.4.16 · 13.4.17 · 13.4.30 · the portfolio's own settings · its sub-project form, its criteria, its values' reliability ── */
function SettingsCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const may = !asPartner && (role.key === 'supervisor' || role.key === 'grants-manager')
  const [fields, setFields] = useState<SubField[]>(pf.subFields ?? SUB_FIELDS_DEFAULT)
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  return (
    <Glass>
      <Head title="إعدادات المحفظة" />
      <KV rows={[
        { k: 'حقول المشروع الفرعي الإلزامية', v: <FieldMultiSelect disabled={!may} values={fields} options={(Object.keys(SUB_FIELD_SAY) as SubField[]).map((f) => ({ value: f, label: SUB_FIELD_SAY[f] }))} label="حقول المشروع الفرعي الإلزامية" placeholder="الحقول الإلزامية" onChange={(xs) => setFields(xs as SubField[])} /> },
        { k: 'معايير المحفظة المعتمدة', v: <span className="rowf gp-2">{pf.criteria ? <Tag tone="ok"><Icon name={icons.clip} size="sm" /> {pf.criteria.file}</Tag> : <span className="sub">لم تُحفظ</span>}{may && <UploadButton label="احفظ المعايير (PDF)" onPick={(f) => r(attachPfCriteria(pf.id, f.name, user.name, role.key), 'معايير المحفظة')} />}</span> },
        { k: 'قيم المشاريع الفرعية للتوزيع الجغرافي للتكلفة', v: may ? <Button type="button" variant={pf.reliable ? '2' : 'ghost'} size="sm" aria-pressed={Boolean(pf.reliable)} onClick={() => { setPfReliable(pf.id, !pf.reliable, user.name); setSaid({ ok: 'موثوقية القيم' }) }}>{pf.reliable ? 'موثوقة · تُستخدم' : 'غير موثوقة · لا تُستخدم'}</Button> : <span className="sub">{pf.reliable ? 'موثوقة' : 'لا تُستخدم للتكلفة'}</span> },
      ]} />
      {may && <div className="apv-row mt-3"><Button type="button" variant="p" size="sm" onClick={() => r(savePfForm(pf.id, fields, user.name, role.key), 'نموذج المشروع الفرعي')}>احفظ النموذج</Button></div>}
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.2.6 · the body's session · the minutes, then the decision the CEO records (client 18 Oct · decisions 14 · 33) ── */
function SessionCard({ pf }: { pf: PortfolioRec }) {
  const { role, user } = useRole()
  const [sid, setSid] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const body = pf.stage === 'board' ? 'board' : 'committee'
  const secretary = (body === 'committee' ? APPROVAL_RULES.committeeBy : APPROVAL_RULES.boardBy).includes(role.key)
  const it = pf.session
  const ss = it ? SESSIONS.find((x) => x.id === it.id) : undefined
  const r = (out: string[], ok: string) => setSaid(out.length ? { bad: out } : { ok })
  return (
    <Glass>
      <Head title={body === 'committee' ? 'جلسة اللجنة التنفيذية' : 'جلسة مجلس الأمناء'} meta={it ? <Tag tone="teal">{it.id}</Tag> : <Tag tone="warn">لم تُدرج</Tag>} />
      {!it ? (
        secretary && (
          <div className="apv-row">
            <FieldSelect value={sid} onChange={setSid} label="الجلسة" placeholder="اختر جلسة قادمة" options={pfSessions(pf).map((x) => ({ value: x.id, label: `${x.title} · ${x.date}` }))} />
            <Button type="button" variant="p" size="sm" onClick={() => r(pfToSession(pf.id, sid, user.name, role.key), 'الإدراج على الجلسة')}>أدرج على الجلسة</Button>
          </div>
        )
      ) : (
        <>
          <KV rows={[
            ...(ss ? [{ k: 'الجلسة', v: `${ss.title} · ${ss.date}` }] : []),
            { k: 'المحضر', v: it.minutes ?? <span className="sub">لم يُرفق</span> },
          ]} />
          {secretary && !it.minutes && <div className="apv-row mt-2"><UploadButton label="محضر الجلسة" onPick={(f) => r(attachPfMinutes(pf.id, f.name, user.name), 'المحضر')} /></div>}
        </>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── The money · client 20 Oct (#25) · read-only here ──
   A portfolio's payment is never entered from the portfolio: it's filed and approved in the
   disbursement procedure (the partners' finance desk) and reflects here · this tab shows each
   scheduled payment and where it stands, with no action on it. */
function PaysCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  return (
    <Glass>
      <Head title="دفعات المحفظة" />
      <ul className="ptn-slots">
        {pf.schedule.map((s) => {
          const rq = pf.requests.filter((r) => r.no === s.no).at(-1)
          return (
            <li key={s.no}>
              <span>الدفعة <span className="num">{s.no}</span> · <DateText>{s.dueAt}</DateText></span>
              <Money sm>{s.amount}</Money>
              {rq ? <Tag tone={rq.state === 'paid' ? 'ok' : rq.state === 'returned' ? 'ret' : 'warn'}>{PF_REQ_SAY[rq.state]}{rq.state === 'paid' ? ` · ${rq.ref}` : ''}</Tag> : <Tag tone="mute">لم تُطلب</Tag>}
              {rq?.why && <span className="sub">{rq.why}{rq.docs?.length ? ` · ${rq.docs.join('، ')}` : ''}</span>}
            </li>
          )
        })}
        {!pf.schedule.length && <li className="sub">لا جدول دفعات بعد.</li>}
      </ul>
      {/* v3 · 0.ent.8 · 2.4.22 · the partner's account decides whether its portfolio is paid */}
      {payBlock(entityById(pf.entityId)) && <p className="bad cnote">{payBlock(entityById(pf.entityId))}</p>}
      {!asPartner && (
        <div className="apv-row mt-3">
          <ButtonLink variant="2" size="sm" to={ROUTES.partnersTab('finance')}>افتح إجراء الصرف</ButtonLink>
        </div>
      )}
    </Glass>
  )
}

/* ── Client 20 Oct (#22 · #23 · #24 · #28) · the portfolio's indicators ──
   The financial position as figures with one ruler under them, the execution as one labelled tile per
   state (it read «1 · 0 · 3 · 0» under a four-word label), the beneficiaries against their target, and
   the sub-projects' values by region. Each approved sub-project moves these as it's recorded, and on
   the portfolio's closing they are the sum of its sub-projects. */
function IndicatorsCards({ pf }: { pf: PortfolioRec }) {
  const m = pfMoney(pf)
  const ind = pfIndicators(pf)
  const live = pf.items.filter(isLiveSub)
  const reach = ind.target ? Math.min(100, Math.round((ind.reached / ind.target) * 100)) : 0
  const regions = new Map<string, { value: number; n: number }>()
  for (const x of live) { const r = regions.get(x.region) ?? { value: 0, n: 0 }; regions.set(x.region, { value: r.value + x.amount, n: r.n + 1 }) }
  const geo = [...regions].sort((a, b) => b[1].value - a[1].value).map(([r, v]) => ({ key: r, label: `${r} · ${v.n} ${v.n === 1 ? 'مشروع' : 'مشاريع'}`, value: v.value }))
  const split: Slice[] = [
    { key: 'approved', label: 'معتمد للمشاريع الفرعية', value: m.approved, color: CHART_COLORS[0] },
    { key: 'pending', label: 'قيد الاعتماد', value: m.pending, color: CHART_COLORS[2] },
    { key: 'free', label: 'الرصيد المتاح', value: Math.max(0, m.available), color: CHART_COLORS[4] },
  ]
  const paid: Slice[] = [
    { key: 'paid', label: 'المصروف', value: m.confirmed, color: CHART_COLORS[1] },
    { key: 'open', label: 'مسجّل بانتظار المالية', value: Math.max(0, m.recorded - m.confirmed), color: CHART_COLORS[3] },
    { key: 'rest', label: 'المتبقي للصرف', value: Math.max(0, pf.total - m.recorded), color: CHART_COLORS[5] },
  ]
  const STATES: { key: SubState; label: string }[] = [
    { key: 'approved', label: 'معتمد · قيد التنفيذ' }, { key: 'closing', label: 'قيد الإغلاق' }, { key: 'done', label: 'مكتمل' }, { key: 'stalled', label: 'متعثر' },
  ]
  return (
    <>
      <Glass>
        <Head title="الموقف المالي" />
        <div className="pfi-kpi">
          <Stat label="قيمة المحفظة المعتمدة" value={<Money>{m.total}</Money>} note={`${m.approvedCount} مشروع فرعي معتمد`} />
          <Stat label="المعتمد للمشاريع الفرعية" value={<Money>{m.approved}</Money>} note={`${pct(m.total ? Math.round((m.approved / m.total) * 100) : 0)} من المحفظة`} />
          <Stat label="قيد الاعتماد" value={<Money>{m.pending}</Money>} />
          <Stat label="الرصيد المتاح" value={<Money>{Math.max(0, m.available)}</Money>} />
          <Stat label="المصروف" value={<Money>{m.confirmed}</Money>} />
          <Stat label="المتبقي" value={<Money>{m.remaining}</Money>} />
        </div>
        <h4 className="ptn-sub">توزيع قيمة المحفظة</h4>
        <StackBar parts={split} total={m.total} />
        <Legend items={split} format={(v) => nf.format(v)} />
        <h4 className="ptn-sub">الصرف</h4>
        <StackBar parts={paid} total={m.total} />
        <Legend items={paid} format={(v) => nf.format(v)} />
      </Glass>

      <Glass>
        <Head title="مؤشرات التنفيذ" meta={<span className="sub">{ind.count} مشروع فرعي معتمد</span>} />
        <dl className="ptn-ind">
          {STATES.map((s) => <div key={s.key}><dt>{s.label}</dt><dd className="num">{live.filter((x) => x.state === s.key).length}</dd></div>)}
        </dl>
        <div className="pfi-two mt-3">
          <Stat label="متوسط الإنجاز" value={<span className="num">{pct(ind.progress)}</span>} bar={{ w: `${ind.progress}%`, c: CHART_COLORS[0] }} />
          <Stat label="المستفيدون الفعليون من المستهدف" value={<span className="num">{nf.format(ind.reached)}</span>} unit={`من ${nf.format(ind.target)}`} bar={{ w: `${reach}%`, c: CHART_COLORS[1] }} note={`${pct(reach)} من المستهدف`} />
        </div>
        <h4 className="ptn-sub">التوزيع الجغرافي لقيم المشاريع الفرعية</h4>
        {geo.length ? <RankBars rows={geo} total={m.approved} hue="c1" /> : <p className="sub cnote">لا مشاريع فرعية معتمدة بعد.</p>}
      </Glass>
    </>
  )
}

/* ── Closing · the comprehensive report, the evaluation, the requirements · by the closing procedure (13.2.28 – 13.2.31) ── */
function CloseCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()
  const [report, setReport] = useState(pf.close.report)
  const [evidence, setEvidence] = useState<string[]>(pf.close.evidence)

  const [crit, setCrit] = useState(() => pf.close.evaluation?.criteria ?? [])
  const [evNotes, setEvNotes] = useState(pf.close.evaluation?.notes ?? '')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const checks = pfCloseChecks(pf)
  const st = pf.close.stage
  const r = (out: string[], ok: string) => { setSaid(out.length ? { bad: out } : { ok }) }
  const seat = st === 'supervisor' || st === 'evalDraft' ? 'supervisor' : st === 'manager' || st === 'evalManager' ? 'grants-manager' : st === 'executive' || st === 'evalExecutive' ? 'ceo' : ''
  const mine = !asPartner && role.key === seat
  const evalStage = st === 'evalDraft' || st === 'evalManager' || st === 'evalExecutive'
  const criteria = pf.close.evaluation?.criteria ?? []
  return (
    <Glass>
      <Head title="إغلاق المحفظة" meta={pf.stage === 'closed' ? <Tag tone="ok">أُغلقت <DateText>{pf.close.closedAt!}</DateText></Tag> : st ? <Tag tone="warn">{PF_CLOSE_SAY[st]}</Tag> : <Tag tone="mute">بعد آخر مشروع</Tag>} />
      <Checks items={checks} />
      {pf.close.note && (st === 'returned' || st === 'evalDraft' || st === 'evalManager') && <p className="bad cnote">{pf.close.note}</p>}
      {asPartner && (pf.stage === 'approved' || (pf.stage === 'closing' && st === 'returned')) && (
        <>
          <FormField label="التقرير الشامل للمحفظة" className="mt-3"><FieldBox><textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} aria-label="التقرير الختامي للمحفظة" /></FieldBox></FormField>
          <div className="apv-row mt-2">
            <span className="sub">{evidence.length ? evidence.join(' · ') : 'الشواهد'}</span>
            <UploadButton label="شاهد" onPick={(f) => setEvidence((x) => [...x, f.name])} />
            <Button type="button" variant="p" size="sm" onClick={() => r(submitPfReport(pf.id, report, evidence, entityName(pf)), 'التقرير الشامل')}>ارفع التقرير</Button>
          </div>
        </>
      )}
      {!asPartner && pf.close.report && <p className="prose mt-2">{isolate(pf.close.report)}{pf.close.evidence.length ? ` · ${pf.close.evidence.join('، ')}` : ''}</p>}
      {mine && !evalStage && st && st !== 'returned' && (
        <div className="apv-row mt-3">
          {/* Client 26 Oct · the decision confirms in its popup · the return's reason there */}
          <DockActions
            actions={[
              { label: 'أعده للشريك', kind: 'btn-2 btn-sm', needsNote: true, act: 'return' as const },
              { label: 'اعتمد التقرير الشامل', kind: 'btn-p btn-sm', act: 'approve' as const },
            ]}
            subject={<>التقرير الشامل · {pf.name}</>}
            placeholder="سبب الإعادة"
            onRun={(x, n) => { const out = actOnPfClose(pf.id, x.act, n, user.name, role.key); r(out, x.act === 'return' ? 'إعادة التقرير للشريك' : 'اعتماد التقرير الشامل'); return out }}
          />
        </div>
      )}
      {/* v3 · 13.2.30 · the portfolio's evaluation · the closing procedure's questions and weights, out of 100 */}
      {evalStage && (
        <>
          <h4 className="ptn-sub">تقييم المحفظة{pfEvalScore(pf) !== null ? ` · ${pfEvalScore(pf)} من 100` : ''}</h4>
          {mine && st === 'evalDraft' ? (
            <div className="regfields">
              {(crit.length ? crit : criteria).map((c, i) => (
                <FormField key={c.key} label={<>{c.label} · الوزن {nf.format(c.weight)}</>}><FieldSelect value={c.rating ? String(c.rating) : ''} onChange={(v) => setCrit((x) => (x.length ? x : criteria).map((y, j) => (j === i ? { ...y, rating: Number(v) || null } : y)))} label={`تقييم ${c.label}`} placeholder="من 5" options={['1', '2', '3', '4', '5']} /></FormField>
              ))}
              <FormField label="ملاحظات التقييم" className="ptn-wide"><FieldBox><input value={evNotes} onChange={(e) => setEvNotes(e.target.value)} aria-label="ملاحظات تقييم المحفظة" /></FieldBox></FormField>
            </div>
          ) : (
            <KV rows={criteria.map((c) => ({ k: `${c.label} · الوزن ${nf.format(c.weight)}`, v: c.rating === null ? <span className="sub">لم يُقيَّم</span> : `${c.rating} من 5` }))} />
          )}
          {mine && (
            <div className="apv-row mt-3">
              {st === 'evalDraft' && <Button type="button" variant="2" size="sm" onClick={() => r(savePfEval(pf.id, crit.length ? crit : criteria, evNotes, user.name, role.key), 'حفظ التقييم')}>احفظ التقييم</Button>}
              {st === 'evalDraft' && <Button type="button" variant="p" size="sm" onClick={() => { savePfEval(pf.id, crit.length ? crit : criteria, evNotes, user.name, role.key); r(actOnPfEval(pf.id, 'send', '', user.name, role.key), 'إرسال التقييم لمدير المنح') }}>أرسل لمدير المنح</Button>}
              {/* Client 26 Oct · the decision confirms in its popup · the return's reason there */}
              {st !== 'evalDraft' && (
                <DockActions
                  actions={[
                    { label: 'أعد التقييم', kind: 'btn-2 btn-sm', needsNote: true, act: 'return' as const },
                    { label: st === 'evalManager' && pfApproverOf(pf, 'eval') === 'ceo' ? 'اعتمد وأحل للمدير التنفيذي' : 'اعتمد التقييم والإغلاق النهائي', kind: 'btn-p btn-sm', act: 'approve' as const },
                  ]}
                  subject={<>تقييم المحفظة · {pf.name}</>}
                  placeholder="سبب الإعادة"
                  onRun={(x, n) => { const out = actOnPfEval(pf.id, x.act, n, user.name, role.key); r(out, x.act === 'return' ? 'إعادة التقييم' : 'اعتماد التقييم'); return out }}
                />
              )}
            </div>
          )}
        </>
      )}
      <Said said={said} />
    </Glass>
  )
}

/* ── v3 · 13.4.43 · cancelling an approved portfolio · its recovery on the portfolio's relationship ── */
function CancelCard({ pf, asPartner }: { pf: PortfolioRec; asPartner: boolean }) {
  const { role, user } = useRole()

  const [recover, setRecover] = useState('')
  const [amount, setAmount] = useState('')
  const [ref, setRef] = useState('')
  const [file, setFile] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  const rc = pf.recovery
  const ceo = !asPartner && holds('portfolioCancelBy', role.key) && (pf.stage === 'approved' || pf.stage === 'closing')
  if (!ceo && !pf.cancel) return null
  const got = rc ? rc.receipts.reduce((n, x) => n + x.amount, 0) : 0
  return (
    <Glass>
      <Head title="إلغاء المحفظة والاسترداد" meta={pf.cancel ? <Tag tone="no">ملغاة</Tag> : undefined} />
      {pf.cancel ? (
        <KV rows={[
          { k: 'السبب', v: pf.cancel.reason },
          { k: 'ألغاها', v: <><Person name={pf.cancel.by} /> · <DateText>{pf.cancel.at}</DateText></> },
          ...(rc ? [{ k: 'المسترد على مستوى المحفظة', v: <><Money sm>{got}</Money> <span className="sub">من <Money sm>{rc.due}</Money></span></> }] : []),
        ]} />
      ) : (
        <div className="apv-row">
          <MoneyField value={recover} onChange={setRecover} label="المبلغ المطلوب استرداده" placeholder="0" />
          {/* Client 26 Oct · the reason in the decision's popup */}
          <DockActions
            actions={[{ label: 'ألغِ المحفظة', kind: 'btn-d btn-sm', needsNote: true }]}
            subject={<>{pf.name} · الاسترداد المطلوب {nf.format(Number(recover) || 0)} ريال</>}
            placeholder="سبب الإلغاء"
            onRun={(_x, n) => { const out = cancelPortfolio(pf.id, n, Number(recover) || 0, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'إلغاء المحفظة' }); return out }}
          />
        </div>
      )}
      {rc && got < rc.due && !asPartner && (role.key === 'finance' || role.key === 'supervisor') && (
        <div className="apv-row mt-3">
          <MoneyField value={amount} onChange={setAmount} label="المبلغ المستلم" />
          <FieldBox><input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="مرجع التحويل" placeholder="مرجع التحويل" /></FieldBox>
          <UploadButton label={file || 'إشعار التحويل'} onPick={(f) => setFile(f.name)} />
          <Button type="button" variant="p" size="sm" onClick={() => { const out = recordPfReceipt(pf.id, Number(amount) || 0, ref, file, user.name, role.key); setSaid(out.length ? { bad: out } : { ok: 'استلام المبلغ' }) }}>سجّل الاستلام</Button>
        </div>
      )}
      <Said said={said} />
    </Glass>
  )
}
