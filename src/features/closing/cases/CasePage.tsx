import { LogTab } from '@/features/projects/tabs'
import { recordLog } from '@/features/shared/recordLog'
import { RecordFiles } from '@/features/shared/RecordFiles'
import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Tabs, BackTo, DateText, DockActions, Empty, Glass, Head, Icon, KV, Money, MoneyField, Mono, Person, Tag, icons } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { isolate } from '@/lib/format'
import {
  CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, actOnCase, attachCaseDoc, caseActions, caseById, caseStops,
  settleCase, stopPhase, useClosing,
  OUTCOME_SAY, cancelBlockers, DIRECT_PATH,
} from '@/data/closing/store'
import { RecoveryCard } from '../parts'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { readCase } from '@/data/recordReadings'
import { cancelOpenRequests, usePayments } from '@/data/payments/store'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { caseOutcome } from '@/data/shared/outcome'

/* A distress case · 10.9.

   The page answers what the decision does to the money: what was paid, what the entity actually
   spent (a stop after money went out needs its report and invoices first, 10.9.3), and what it
   owes back. The approvals move it supervisor → grants manager → CEO; the CEO's approval is what
   changes the project, its requests, its schedule and its hold. After that the recovery card takes
   over until the money is back or a final decision closes what can't be recovered, and the CEO
   closes the case. The entity opens the same page from its portal (`?as=entity`) to upload its
   settlement files and follow the claim. */

export default function CasePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const caseTab = params.get('tab') === 'log' ? 'log' : params.get('tab') === 'files' ? 'files' : 'data'
  const asEntity = params.get('as') === 'entity'
  const { role, user } = useRole()
  useClosing()
  usePayments()
  const c = caseById(id)
  const [, setNote] = useState('')
  const [actual, setActual] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('حالة تعثّر')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="حالات التعثر" onClick={() => navigate(ROUTES.distresses)} />
          <Glass><Empty title="لا توجد حالة بهذا الرقم." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const actions = caseActions(c, role.key, asEntity)
  const phase = stopPhase(c.projectId)
  const s = c.settlement

  /* 17 Oct · the assistant suggests · the case's own exits · a rejection stays human */
  const nextPlan = suggestNext(actions, {
    issues: [],
    good: [`${CASE_KIND_SAY[c.kind]} · ${c.projectName}`, c.reason ? `السبب المسجّل: ${c.reason}` : ''],
  })
  const nextExec = (a: (typeof actions)[number], n: string) => { const out = actOnCase(c.id, a.act, n, user.name, role.key); if (!out.length) setNote(''); return out }

  return (
    <AppLayout assistantContext={assistFor.page(`${CASE_KIND_SAY[c.kind]} ${c.projectName}`)}>
      <div className={`viewstack${actions.length ? ' hasdock' : ''}`}>
        <div className="screen col hasg2">
          <BackTo
            label={asEntity ? 'البوابة' : 'حالات التعثر'}
            onClick={() => navigate(asEntity ? `${ROUTES.entityPortal}?entity=${c.entityId}` : ROUTES.distresses)}
          />
          {said.ok && <p className="ok-ink cnote" role="status">سُجّل: <b>{said.ok}</b> · أُرسل الإشعار</p>}
          {said.bad?.map((b) => <p key={b} className="bad cnote" role="alert">{b}</p>)}

          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">{CASE_KIND_SAY[c.kind]} · {c.projectName}</h1>
              <p className="sub mt-1">
                <Mono>{c.id}</Mono> · {asEntity ? c.entityName : <Link className="tlink" to={ROUTES.project(c.projectId)}>{c.projectId}</Link>} ·
                فُتحت <DateText>{c.openedAt}</DateText>
              </p>
              {/* Client sheet 24 Oct (#95) · the case's outcome once it ends */}
              <div className="gt-tag rowf gp-2"><Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag><OutcomeTag outcome={caseOutcome(c.stage)} /></div>
            </div>
          </header>

          {c.note && (c.stage === 'returned' || c.stage === 'manager' || c.stage === 'ceo' || c.stage === 'rejected') && (
            <Glass>
              <Head title={c.stage === 'rejected' ? 'سبب الرفض' : 'ملاحظات الإعادة'} meta={<Tag tone={c.stage === 'rejected' ? 'no' : 'warn'}>{c.stage === 'rejected' ? 'مرفوض' : 'للاستكمال'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(c.note)}</span></div>
            </Glass>
          )}

          {/* Client 26 Oct · every record reads its data and its log in tabs */}
          <Tabs items={[{ slug: 'data', label: 'بيانات الحالة' }, { slug: 'files', label: 'المرفقات' }, { slug: 'log', label: 'سجل الحالة', count: c.log.length || undefined }]} active={caseTab}
            onChange={(x) => { const n = new URLSearchParams(params); if (x === 'data') n.delete('tab'); else n.set('tab', x); setParams(n, { replace: true }) }} />

          <div className="g2">
            <div className="col">
              {caseTab === 'data' && <>
              <Glass>
                <Head title="القرار" meta={<Person name={c.openedBy} />} />
                <KV
                  rows={[
                    { k: 'السبب', v: isolate(c.reason) },
                    { k: 'قيمة المنحة عند الفتح', v: <Money sm>{c.granted}</Money> },
                    { k: 'المصروف عند الفتح', v: <Money sm>{c.paid}</Money> },
                    ...(c.kind === 'stop' ? [{ k: 'موضع الإيقاف', v: phase.say }] : []),
                    /* Client sheet 24 Oct (#27) · the direct closing · its document, its path, finance's settlement */
                    ...(c.kind === 'direct' ? [
                      { k: 'مستند الإغلاق', v: c.file ?? <span className="sub">—</span> },
                      { k: 'مسار الاعتماد', v: DIRECT_PATH.join(' ← ') },
                      ...(c.finance ? [
                        { k: 'التسوية المالية', v: <><Person name={c.finance.by} /> <span className="sub">· <DateText>{c.finance.at}</DateText>{c.finance.note ? ` · ${c.finance.note}` : ''}</span></> },
                        { k: 'حُرّر إلى بند الميزانية', v: <Money sm>{c.finance.released}</Money> },
                        { k: 'طلبات صرف أُغلقت', v: c.finance.stopped.length ? c.finance.stopped.join('، ') : <span className="sub">لا شيء</span> },
                      ] : [{ k: 'يعود إلى بند الميزانية', v: <Money sm>{Math.max(0, c.granted - c.paid)}</Money> }]),
                    ] : []),
                    ...(c.newAmount !== undefined ? [{ k: 'القيمة الجديدة', v: <Money sm>{c.newAmount}</Money> }] : []),
                    ...(c.kind === 'reduce' ? [{ k: 'ملحق الاتفاقية', v: c.annex ?? <span className="bad">لم يُرفع</span> }] : []),
                    ...(c.extra ? [{ k: 'الدفعة الإضافية', v: <><Money sm>{c.extra.amount}</Money> · <DateText>{c.extra.dueAt}</DateText></> }] : []),
                    ...(c.outcome ? [{ k: 'نتيجة القرار', v: OUTCOME_SAY[c.outcome] }] : []),
                    ...(c.redirect ? [{ k: 'إعادة التوجيه', v: <>{isolate(c.redirect.purpose)} · القرار {c.redirect.decision} · {c.redirect.file}</> }] : []),
                    ...(c.independentId ? [{ k: 'المشروع المستقل', v: <Link className="tlink" to={ROUTES.project(c.independentId)}>{c.independentId}</Link> }] : []),
                    ...(c.decidedAt ? [{ k: 'تاريخ القرار', v: <DateText>{c.decidedAt}</DateText> }] : []),
                  ]}
                />
                {/* Client 18 Oct (sheet V2 · #4) · the cancellation waits for every open operation */}
                {c.kind === 'stop' && c.outcome === 'cancel' && !['approved', 'closed', 'rejected'].includes(c.stage) && cancelBlockers(c.projectId).map((x) => (
                  <p key={x} className="bad cnote" role="alert">لا يُلغى المشروع قبل إلغاء عملياته · {x}</p>
                ))}
                {c.kind === 'stop' && c.outcome === 'cancel' && !['approved', 'closed', 'rejected'].includes(c.stage) && !asEntity && role.key !== 'finance'
                  && cancelBlockers(c.projectId).some((x) => x.startsWith('طلب صرف')) && (
                  <div className="act-a">
                    <Button type="button" variant="2" size="sm" onClick={() => cancelOpenRequests(c.projectId, c.id, user.name)}>ألغِ طلبات الصرف المفتوحة</Button>
                  </div>
                )}
                {c.kind === 'reduce' && !c.annex && !asEntity && role.key === 'supervisor' && (
                  <div className="act-a"><UploadButton label="ملحق الاتفاقية" onPick={(f) => attachCaseDoc(c.id, 'annex', f.name, user.name)} /></div>
                )}
              </Glass>

              {/* 10.9.3 · 10.9.4 · a stop after money went out · the entity's executive financial report and outputs' evidence, then the spend approved (v3) */}
              {s && (
                <Glass>
                  <Head title="تسوية المصروف الفعلي" meta={s.actual != null ? <Tag tone="ok">اعتُمد المصروف</Tag> : <Tag tone="warn">بانتظار التسوية</Tag>} />
                  <ul className="payq-ck">
                    {(['report', 'evidence'] as const).map((k) => (
                      <li key={k} className={s[k] ? 'ok' : 'no'}>
                        <Icon name={s[k] ? icons.check : icons.alert} size="sm" />
                        <span>{k === 'report' ? 'التقرير المالي التنفيذي' : 'أدلة المخرجات لما صُرف'}{s[k] ? ` · ${s[k]}` : k === 'evidence' && s.invoices ? ` · ${s.invoices}` : ''}</span>
                        {asEntity && !s[k] && c.stage === 'settle' && <UploadButton label={k === 'report' ? 'التقرير المالي التنفيذي' : 'أدلة المخرجات'} onPick={(f) => attachCaseDoc(c.id, k, f.name, c.entityName)} />}
                      </li>
                    ))}
                  </ul>
                  <KV
                    rows={[
                      { k: 'المصروف للجهة', v: <Money sm>{c.paid}</Money> },
                      { k: 'المصروف الفعلي المعتمد', v: s.actual == null ? <span className="sub">لم يُعتمد بعد</span> : <><Money sm>{s.actual}</Money> <span className="sub">· {s.approvedBy}</span></> },
                      { k: 'يُطالَب بإعادته', v: s.actual == null ? <span className="sub">بعد اعتماد المصروف</span> : <b className={c.paid - s.actual > 0 ? 'bad' : undefined}><Money sm>{Math.max(0, c.paid - s.actual)}</Money></b> },
                    ]}
                  />
                  {!asEntity && role.key === 'supervisor' && c.stage === 'settle' && (
                    <div className="apv-row mt-3">
                      <MoneyField value={actual} onChange={setActual} label="المصروف الفعلي المعتمد" />
                      <Button type="button" variant="2" size="sm" disabled={actual === '' || !s.report || !(s.evidence || s.invoices)} onClick={() => { const out = settleCase(c.id, Number(actual), user.name); setSaid(out.length ? { bad: out } : { ok: 'اعتماد المصروف الفعلي' }) }}>
                        اعتمد المصروف الفعلي
                      </Button>
                    </div>
                  )}
                </Glass>
              )}

              {c.recovery && <RecoveryCard rec={c.recovery} owner={{ kind: 'case', id: c.id }} asEntity={asEntity} />}
              </>}
              {caseTab === 'files' && <RecordFiles record={`case:${c.id}`} me={asEntity ? c.entityName : user.name} canUpload />}
              {caseTab === 'log' && <LogTab title="سجل الحالة" events={recordLog(`case-${c.id}`, 'حالات الإغلاق', c.log)} entityName={c.entityName} />}
            </div>

            <AssistantAside suggest={actions.length > 0 ? <NextStep s={nextPlan} exec={nextExec} /> : undefined} title="قراءة الحالة" cta="اقرأ الحالة" empty="لا ملاحظات على هذه الحالة الآن." readings={readCase(c)} ask={!asEntity} />
          </div>
        </div>

        {actions.length > 0 && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <Person name={user.name} size="lg" quiet={false} />
                <span className="decsent">قرارك في <b>{CASE_KIND_SAY[c.kind]}</b><span className="decsep" />{c.projectName}</span>
              </div>
              {/* Client 26 Oct · the bar holds the buttons only · each one confirms in its popup, with the reason there */}
              <div className="payact-g">
                <DockActions
                  actions={actions.map((a) => ({ ...a, stops: caseStops(c, a.act), why: '10.9' }))}
                  subject={<>{CASE_KIND_SAY[c.kind]} · {c.projectName}</>}
                  placeholder="سبب الإعادة أو الرفض · يصل مع القرار"
                  onRun={(a, n) => { const out = actOnCase(c.id, a.act, n, user.name, role.key); if (!out.length) setSaid({ ok: a.label }); return out }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
