import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { closeScore } from '@/data/shared/ai'
import { Related } from '@/components/related/Related'
import { useMemo, useRef, useState } from 'react'
import { closingAi } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TONE } from '@/lib/tone'
import { type TabItem, Tabs,
  BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, Mono, Num, StepArc, Tag,
  icons, type GateStep,
} from '@/components/ui'
import { AnalysisCard } from '@/components/assistant/AnalysisCard'
import { DocList, UploadButton, type DocRow } from '@/components/docs'
import { ChatDock } from '@/components/thread'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { useFillHeight } from '@/hooks/useFillHeight'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { assistFor } from '@/data/mock/assistant'
import { isolate, MISSING_ITEM, nf, NOUN, nounAfter, pct, unitAfter, withUnit } from '@/lib/format'
import {
  CLOSE_DOCS, CLOSE_LIMIT, CLOSE_STAGES, canStartEval,
  closeById, closeCycle, closeStageLabel, closeStageWho, evalApproved, reportApproved,
  STOPPED_DOCS, needsComms, reportBlockers, reportGap,
} from '@/data/mock/closing'
import {
  actOnClosing, approverFor, attachDoc, closeActions, closeSayOf, closeStops, evalScore, sendClosingReport, useClosing, type CloseAct,
} from '@/data/closing/store'
import { ExceptionCard, FeedbackCard, FinanceCard, LogsCard, RecoveryCard, RedirectCard, ReopenCard, RequirementsCard, VersionsCard } from './parts'
import { ReportFiles, TargetActual } from './report'
import { closeKindSay } from './reportData'
import { projectById } from '@/data/mock/projects'
import { closeReadings } from './readings'
import { CloseActionDock } from './CloseActionDock'
import { SealedTitle } from '@/components/soul'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { closeOutcome } from '@/data/shared/outcome'

/* Closing page.

   Note: the page answers one question: how far is actual from approved. Not "what does the report
   contain" - that's in the table. Rule 4 requires reporting actual beneficiaries, budget, execution
   time, and outputs, and all four only mean something in their difference from what was approved,
   not in their raw value. "780 beneficiaries" isn't information; "780 against an approved 1,000"
   is.

   Note: two cycles, not one ladder - rule 17. So the stepper splits: report stages, then evaluation
   stages, with rule 6 as the line between them (evaluation doesn't start before executive
   approval).

   Note: one screen, two viewpoints, not two screens - same principle as the plan page: the entity
   and the institution look at the same report and the same attachments; what differs is the actions
   available. The entity uploads and submits; the institution reviews and approves.

   Note: after `closed` the page is read-only - rule 21: any change after final closure needs a new
   procedure, so there's no footer and no upload. */

/** Report-cycle stages - for the stepper. */
const REPORT_PATH = ['draft', 'supervisor', 'comms', 'manager', 'executive'] as const
/** Evaluation-cycle stages - a separate record (rule 17). */
const EVAL_PATH = ['evalDraft', 'evalManager', 'evalExecutive', 'closed'] as const

/** Short line under each holder inside the fan sector. */
const CAP: Record<string, string> = {
  draft: 'التقرير الختامي',
  supervisor: 'المراجعة',
  comms: 'النشر الإعلامي',
  manager: 'الاعتماد',
  executive: 'الاعتماد النهائي',
  evalDraft: 'إعداد التقييم',
  evalManager: 'اعتماد التقييم',
  evalExecutive: 'اعتماد التقييم',
  closed: 'مكتمل',
}

export default function ClosePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { role, user } = useRole()
  const mobile = useIsMobile()
  const asEntity = params.get('as') === 'entity'
  const ver = useClosing()
  const c = closeById(id)
  const [note, setNote] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})
  /* Approval moment - which stage was just approved, and whether this decision is the closing seal. */
  const [fresh, setFresh] = useState<{ step: number; sealed: boolean } | null>(null)
  const tick = ver

  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 320 })

  const readings = useMemo(() => (c ? [...closeReadings(c), ...closingAi(c)] : []), [c, tick])

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('طلب إغلاق غير موجود')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الإغلاق" onClick={() => navigate(ROUTES.closings)} />
            <Glass>
              <Empty
                title="لا يوجد طلب إغلاق بهذا الرقم."
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.closings)}>
                    افتح صندوق الإغلاق
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const pr = projectById(c.projectId)
  const cycle = closeCycle(c)
  const missing = reportBlockers(c)
  const closed = evalApproved(c)
  const gaps = reportGap(c)
  /* The exits and what stops them come from the closing store · the dock names the first stop */
  const actions = asEntity ? [] : closeActions(c, role.key)

  /* Note: the stepper's stages come from the spec, not from screen state - and `comms` is skipped
     when coverage isn't required, and it's stated as skipped rather than hidden (our absence rule,
     plus rule 9: "when it was required"). */
  /* v3 · 10.4.11 · the executive's station shows only when the matrix makes him the last approver */
  /* Verifier · 16 Oct · the stage the record sits at stays on the path, whatever the matrix says now */
  const path: readonly string[] = (cycle === 'report' ? REPORT_PATH : EVAL_PATH).filter((k) => k === c.stage ||
    ((k !== 'executive' || approverFor('report', c.projectId) === 'ceo') && (k !== 'evalExecutive' || approverFor('eval', c.projectId) === 'ceo')))
  /* A returned report sits with whoever it went back to; an approved report waits on the
     supervisor to open the evaluation. */
  const here: string =
    c.stage === 'returned' ? (c.returnedTo ?? 'draft')
      : c.stage === 'reportDone' ? 'evalDraft'
        : c.stage
  const at = closed ? path.length : path.indexOf(here)
  const openDays = Math.round(c.hoursInStage / 24)
  const limit = CLOSE_LIMIT[c.stage]

  /* Same fan as the project header, driven by the closing cycle's own steps. */
  const steps: GateStep[] = path.map((k, i): GateStep => {
    const meta = CLOSE_STAGES.find((s) => s.key === k)
    const label = k === 'closed' ? 'الإغلاق' : k === 'comms' ? 'الاتصال المؤسسي' : meta?.who ?? k
    const base = { label, title: meta?.label ?? k, cap: CAP[k] ?? '' }
    if (k === 'comms' && !needsComms(c)) {
      return {
        ...base,
        cap: 'لا ينطبق',
        state: 'skip',
        lines: ['لا تشترط الاتفاقية نشرًا إعلاميًا', <>تُتخطّى المرحلة{/* doc rule 9 */}</>],
        src: 'المصدر: شروط الاتفاقية',
      }
    }
    if (i === at) {
      return {
        ...base,
        state: 'now',
        lines: [
          <><b>{meta?.who}</b> · مفتوح منذ <b>{openDays}</b> {nounAfter(openDays, NOUN.day)}</>,
          limit > 0
            ? <><b>{nf.format(c.hoursInStage)}</b> ساعة مقابل حدّ <b>{nf.format(limit)}</b></>
            : meta?.note,
        ],
        src: 'المصدر: سجل الإغلاق',
      }
    }
    return {
      ...base,
      state: i < at ? 'done' : 'pending',
      lines: [meta?.note, i < at ? null : 'تبدأ بعد اكتمال المرحلة السابقة'],
      src: i < at ? 'المصدر: سجل الإغلاق' : 'المصدر: مسار الإغلاق',
    }
  })

  const holder = closed
    ? { k: 'اكتمل الإغلاق', t: 'المشروع مغلق' }
    : { k: 'صاحب القرار الآن', t: steps[at]?.label ?? closeStageWho(c.stage) }
  const holderRest = [
    <>دورة <b className="num">{cycle === 'report' ? 1 : 2}</b> من <b className="num">2</b> ·{' '}
      {cycle === 'report' ? 'مسار التقرير الختامي' : 'مسار تقييم المشروع'}</>,
  ]

  /* Attachments - one `DocList`, not a hand-built table. */
  /* v3 · 10.4.5 · 10.4.6 · a stopped project's own requirements · the invoices only when asked for */
  /* Client 21 Oct (#8) · the invoices are never required · shown only when the entity attached them */
  const reqOf = (k: string, req?: boolean) => (c.basis === 'stopped' ? STOPPED_DOCS.includes(k) : Boolean(req))
  const docRows: DocRow[] = CLOSE_DOCS.filter((d) => d.key !== 'invoices' || c.report.docs.includes('invoices')).map((d) => ({
    name: c.report.files?.[d.key] ?? `${d.label}.pdf`,
    meta: reqOf(d.key, d.req) ? /* doc rule 4 */ 'مستند إلزامي' : /* doc rule 5 */ 'مستند داعم',
    uploaded: c.report.docs.includes(d.key),
    required: reqOf(d.key, d.req),
    /* v3 · 10.4.23 · the version locks once sent · files change, or are replaced, before sending or after a formal return */
    action: asEntity && (c.stage === 'draft' || c.stage === 'returned')
      ? (
        <UploadButton
          label={c.report.docs.includes(d.key) ? `استبدل ${d.label}` : `ارفع ${d.label}`}
          onPick={(f) => attachDoc(c.id, d.key, c.entityName, f.name)}
        />
      )
      : undefined,
  }))

  const take = (a: CloseAct, file?: string, n?: string): string[] => {
    const out = actOnClosing(c.id, a, n ?? note, user.name, role.key, file)
    if (out.length) return out
    /* A return isn't approval - no step fills in, no seal. */
    setFresh(a.act === 'return' ? null : { step: at, sealed: evalApproved(c) })
    setSaid({ ok: a.label })
    setNote('')
    return []
  }

  /* 17 Oct · the assistant suggests · the report's own gaps decide between approving and returning */
  const nextPlan = suggestNext(actions, {
    issues: c.stage === 'supervisor' ? reportBlockers(c).map((x) => `ينقص في التقرير: ${x}`) : [],
    stops: (a) => closeStops(c, a),
    good: [`درجة الإغلاق ${closeScore(c).score} من 100`, gaps.every((g) => g.actual !== null) ? 'كل المؤشرات لها قيمة فعلية' : ''],
  })
  const nextExec = (a: CloseAct, n: string) => {
    const out = actOnClosing(c.id, a, n, user.name, role.key)
    if (!out.length) { setFresh(a.act === 'return' ? null : { step: at, sealed: evalApproved(c) }); setNote('') }
    return out
  }

  const tabs: TabItem[] = [
    { slug: 'report', label: 'التقرير الختامي' },
    { slug: 'eval', label: 'التقييم' },
    { slug: 'needs', label: 'المتطلبات والمالية' },
    { slug: 'versions', label: 'الإصدارات' },
    { slug: 'log', label: 'السجل' },
  ]
  const tab = tabs.find((t) => t.slug === params.get('tab'))?.slug ?? 'report'
  const goTab = (slug: string) => {
    const next = new URLSearchParams(params)
    if (slug === 'report') next.delete('tab'); else next.set('tab', slug)
    setParams(next, { replace: true })
  }

  return (
    <AppLayout assistantContext={assistFor.page(`إغلاق ${c.projectName}`)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <BackTo
            label={asEntity ? 'البوابة' : 'الإغلاق'}
            onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${c.entityId}` : ROUTES.closings)}
          />
          {said.ok && <p className="ok-ink cnote" role="status">سُجّل: <b>{said.ok}</b> · أُرسل الإشعار إلى أطراف الإجراء</p>}
          {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          {/* Header laid out like the project page: title and amount, the fan at the end. */}
          <header className="phead">
            <div className="pmain">
              {/* The seal sits next to the title once closing is complete - the tag stays in its
                  place. */}
              <SealedTitle sealed={closed} fresh={fresh?.sealed}>إغلاق {c.projectName}</SealedTitle>
              <p className="sub mt-1">
                <Mono>{c.id}</Mono> ·{' '}
                <Link to={ROUTES.entity(c.entityId)} className="tlink">{c.entityName}</Link> ·{' '}
                فُتح الطلب <DateText>{c.openedAt}</DateText>
                {/* Client 21 Oct (#11) · the closing follows the project's type · named on the page */}
                {' · '}{closeKindSay(c)}
                {c.versions.length > 1 && (
                  <> · الإصدار <span className="num">{c.versions.length}</span></>
                )}
              </p>
              <Related plain={asEntity} links={[{ kind: 'project', id: c.projectId, label: c.projectName }, { kind: 'entity', id: c.entityId, label: c.entityName }]} />
              <div className="gt-tag rowf gp-2">
                <Tag tone="mute">{closeSayOf(c)}</Tag>
                {/* Client sheet 24 Oct (#95) · the closing's outcome once it ends */}
                <OutcomeTag outcome={closeOutcome(c.stage)} />
              </div>

              {pr && (
                <div className="pamt">
                  <div className="lb">قيمة المنحة</div>
                  <div className="v"><Money sm>{pr.amountGranted || pr.amountRequested}</Money></div>
                  <div className="sub">
                    التقرير الختامي {reportApproved(c) ? 'معتمد' : 'قيد الاعتماد'}
                    {c.report.budget !== null && (
                      <> · دعم المؤسسة الفعلي <Num>{c.report.budget}</Num></>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pgates">
              <StepArc
                steps={steps}
                compact={mobile}
                aria={`مسار الإغلاق، ${holder.t}`}
                holderKey={holder.k}
                holder={holder.t}
                rest={holderRest}
              />
            </div>
          </header>

          {/* Note: the entity needs to know the institution is comparing, not just receiving. This
              is the most likely misunderstanding here: the entity uploads its actual figures and
              assumes this is administrative, while the review actually compares them against the
              agreement and plan's approved figures (output 2). The sentence is stated up front, not
              left to be inferred from a small tag. */}
          {c.note && c.stage !== 'closed' && (
            <Glass>
              <Head title="ملاحظات الإعادة" meta={<Tag tone="warn">{c.stage === 'returned' ? 'على الجهة' : 'للمراجعة'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(c.note)}</span></div>
            </Glass>
          )}



          {/* Client 26 Oct · a record with this much in it reads in pinned tabs, the project's component */}
          <Tabs items={tabs} active={tab} onChange={goTab} />

          <div className="g2">
            <div className="col">
              {tab === 'report' && <>
              {/* Actual vs. approved - the core of the screen */}
              <Glass>
                <Head
                  title="المستهدف والفعلي"
                  meta={missing.length > 0
                    ? <Tag tone={TONE.missing}><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</Tag>
                    : <Tag tone="ok">الحدّ الأدنى مكتمل</Tag>}
                />

                {/* Client 21 Oct (#5 · #6) · the same table the entity filled · target, actual and the gap */}
                {c.basis !== 'stopped' && <TargetActual c={c} />}
                <KV
                  rows={[
                    ...(c.report.outcomes ? [{ k: 'أبرز النتائج المحققة', v: <>{isolate(c.report.outcomes)}</> }] : []),
                    ...(c.report.risks ? [{ k: 'التحديات', v: <>{isolate(c.report.risks)}</> }] : []),
                    ...(c.report.contribution ? [{ k: 'علاقة مساهمة المؤسسة بما تحقق', v: <>{isolate(c.report.contribution)}</> }] : []),
                    { k: 'نموذج التقرير', v: c.report.template === 'foundation' ? 'قالب المؤسسة' : 'نموذج الجهة الخاص' },
                  ]}
                />

                {(!asEntity || !closed) && (
                  <div className="act-a">
                    <Link className="btn btn-2 btn-sm" to={ROUTES.closingReport(c.id)}>
                      {closed ? 'اعرض التقرير' : 'حرّر التقرير الختامي'}
                      <Icon name={icons.chevron} size="sm" />
                    </Link>
                  </div>
                )}
              </Glass>

              {/* Supporting documents - rule 5 */}
              <Glass>
                <Head
                  title="المستندات الداعمة"
                  meta={
                    <span className="sub">
                      <Num>{c.report.docs.length}</Num> من <Num>{CLOSE_DOCS.length}</Num>
                      {c.report.links.length > 0 && (
                        <> · <Num>{c.report.links.length}</Num> رابط سحابي</>
                      )}
                    </span>
                  }
                />
                <DocList rows={docRows} label="المستندات الداعمة للتقرير الختامي وحالتها" />

                {/* Note: a cloud link is a different attachment type, not a substitute for one -
                    rule 5 names "approved cloud storage links (e.g. Google Drive)" explicitly, for
                    a practical reason: videos and media files exceed any upload limit. */}
                {c.report.links.length > 0 && (
                  <ul className="plchg">
                    {c.report.links.map((l) => (
                      <li key={l.url}>
                        <div className="plchg-h">
                          <Tag tone="teal">رابط سحابي</Tag>
                          {/* doc rule 5 */}
                        </div>
                        <p className="plchg-t">{isolate(l.label)}</p>
                        <p className="sub">{l.url}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Glass>

              {/* Client 21 Oct (#7) · the execution files in the foundation's storage · the reviewer opens them in place */}
              <ReportFiles c={c} edit={asEntity && (c.stage === 'draft' || c.stage === 'returned')} by={asEntity ? c.entityName : user.name} />

              <FeedbackCard c={c} asEntity={asEntity} />
              <ReopenCard c={c} asEntity={asEntity} />
              </>}

              {tab === 'eval' && <>
              {/* Evaluation - second cycle */}
              <Glass>
                <Head
                  title="تقييم المشروع"
                  meta={c.evaluation
                    ? <Tag tone={closed ? 'ok' : 'teal'}>
                      {closed ? 'معتمَد' : closeStageLabel(c.stage)}
                    </Tag>
                    : <Tag tone="mute">{canStartEval(c) ? 'جاهز للبدء' : 'لم يبدأ'}</Tag>}
                />

                {c.evaluation ? (
                  <>
                    <KV
                      rows={c.evaluation.indicators.map((i) => ({
                        k: `${i.name} · المستهدف ${withUnit(i.target, i.unit)}`,
                        v: i.actual === null
                          ? <span className="sub">بلا قيمة متحقّقة</span>
                          : <span className={i.actual < i.target ? 'bad' : undefined}>
                            {/* "%" stays inside the number's own block - it used to be a word in
                                `.sub` and would flip direction. */}
                            <span className="num">{i.unit === '%' ? pct(i.actual) : nf.format(i.actual)}</span>
                            {i.unit !== '%' && <span className="sub"> {unitAfter(i.actual, i.unit)}</span>}
                          </span>,
                      })).concat([
                        {
                          k: c.evaluation.criteria?.length ? 'الدرجة الموزونة' : 'التقدير العام · استرشادي',
                          v: evalScore(c.evaluation) === null
                            ? <span className="sub">لم يُحدَّد</span>
                            : <><span className="num">{evalScore(c.evaluation)}</span>
                              <span className="sub"> من 100{/* doc 10.4.31 */}</span></>,
                        },
                        ...(c.evaluation.criteria ?? []).map((k) => ({
                          k: `${k.label} · الوزن ${nf.format(k.weight)}`,
                          v: k.rating === null ? <span className="sub">لم يُقيَّم</span> : <><span className="num">{k.rating}</span><span className="sub"> من 5</span></>,
                        })),
                        /* audit P07 · rows of the list, like the report's outcomes */
                        ...(c.evaluation.impact ? [{ k: 'الأثر المرصود', v: <>{isolate(c.evaluation.impact)}</> }] : []),
                        ...(c.evaluation.lessons ? [{ k: 'الدروس المستفادة', v: <>{isolate(c.evaluation.lessons)}</> }] : []),
                      ])}
                    />
                    {!asEntity && !closed && (
                      <div className="act-a">
                        <Link className="btn btn-2 btn-sm" to={ROUTES.closingEval(c.id)}>
                          حرّر التقييم
                          <Icon name={icons.chevron} size="sm" />
                        </Link>
                      </div>
                    )}
                  </>
                ) : null}
              </Glass>

              </>}

              {tab === 'needs' && <>
              {/* 10.4.8 · 10.4.18 · the requirements, named · the financial report and its savings */}
              <ExceptionCard c={c} asEntity={asEntity} />
              <RequirementsCard c={c} asEntity={asEntity} />
              <FinanceCard c={c} asEntity={asEntity} />
              {c.recovery && <RecoveryCard rec={c.recovery} owner={{ kind: 'close', id: c.id }} asEntity={asEntity} />}
              <RedirectCard c={c} asEntity={asEntity} />
              </>}

              {/* Versions with their content and the two separate logs - rules 11, 15, 17 and 19 */}
              {tab === 'versions' && <VersionsCard c={c} />}
              {tab === 'log' && <LogsCard c={c} />}


              {/* Correspondence · client 21 Oct (#2) · a floating chat over the page instead of a card at
                  its foot · the same thread as the project and the portal, kept per closing case */}
              <ChatDock
                title={asEntity ? 'التواصل مع المؤسسة' : 'التواصل مع الجهة'}
                channel={`close:${c.id}`}
                by={asEntity ? c.entityName : user.name}
                messages={[]}
                entityName={c.entityName}
                me={asEntity ? 'entity' : 'staff'}
                placeholder="اكتب ملاحظتك على التقرير الختامي…"
                emptyTitle="لا توجد مراسلات على الإغلاق"
                emptyNote="تُفتح القناة حين يتوقف إجراء على أحد الطرفين، مثل ملاحظة على التقرير أو مستند ناقص."
              />
            </div>

            <div className="col aiside" ref={aside}>
              <AnalysisCard
                title="قراءة التقرير الختامي"
                suggest={actions.length > 0 ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
                cta="اقرأ التقرير"
                empty="لا توجد ملاحظات على هذا الطلب حاليًا."
                readings={readings}
                onAsk={() => window.dispatchEvent(
                  new KeyboardEvent('keydown', { key: 'k', metaKey: true }),
                )}
              />
            </div>
          </div>

        </div>

        {/* Note: the entity's actions live on the screen, not in the footer - same as the plan
            page: the entity uploads and submits, the footer is for the administrative decision. */}
        {asEntity ? (
          !closed && (
            <div className="decdock">
              <div className="chrome decbar">
                <div className="rowf gp-3">
                  <Icon name={icons.doc} size="md" />
                  <span className="decsent">
                    {missing.length === 0
                      ? <>التقرير مكتمل · يمكن إرساله إلى مشرف المنح للمراجعة</>
                      : <><b><Num>{missing.length}</Num> {nounAfter(missing.length, MISSING_ITEM)}</b> قبل الإرسال
                        <span className="decsep" />
                        {missing[0]}</>}
                  </span>
                </div>
                <button
                  className="btn btn-p"
                  disabled={missing.length > 0 || (c.stage !== 'draft' && c.stage !== 'returned')}
                  title={missing.length > 0 ? /* doc rule 3 */ `ينقص: ${missing[0]}` : 'أرسل التقرير إلى مشرف المنح للمراجعة'}
                  onClick={() => { const out = sendClosingReport(c.id, c.entityName); setSaid(out.length ? { bad: out } : { ok: 'أُرسل التقرير إلى مشرف المنح' }) }}
                >
                  أرسل التقرير للمراجعة
                </button>
              </div>
            </div>
          )
        ) : (
          <CloseActionDock
            user={user}
            row={c}
            actions={actions}
            onAct={take}
          />
        )}
      </div>
    </AppLayout>
  )
}

/** Total attachments uploaded - for quick viewing. */
export const docsDone = (uploaded: string[]): string =>
  `${uploaded.length} من ${CLOSE_DOCS.length}`

/** Stage name and owner in one line - for use in the tab and portal. */
export const closeWhere = (stage: string): string => {
  const who = closeStageWho(stage as never)
  return who ? `${closeStageLabel(stage as never)} · عند ${who}` : closeStageLabel(stage as never)
}

/** Grant value - for quick comparison outside the screen. */
export const grantOf = (projectId: string): number =>
  projectById(projectId)?.amountGranted ?? 0
