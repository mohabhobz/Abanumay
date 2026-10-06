import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BackTo, DateText, Empty, Glass, Head, Icon, KV, Money, MoneyField, Mono, Person, Tag, icons } from '@/components/ui'
import { UploadButton } from '@/components/docs'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { isolate, nf } from '@/lib/format'
import { noteFirst } from '@/lib/dock'
import {
  CASE_KIND_SAY, CASE_STAGE_SAY, CASE_STAGE_TONE, actOnCase, attachCaseDoc, caseActions, caseById, caseStops,
  settleCase, stopPhase, useClosing,
} from '@/data/closing/store'
import { RecoveryCard } from '../parts'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { readCase } from '@/data/recordReadings'

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
  const [params] = useSearchParams()
  const asEntity = params.get('as') === 'entity'
  const { role, user } = useRole()
  useClosing()
  const c = caseById(id)
  const [note, setNote] = useState('')
  const [actual, setActual] = useState('')
  const [said, setSaid] = useState<{ ok?: string; bad?: string[] }>({})

  if (!c) {
    return (
      <AppLayout assistantContext={assistFor.page('حالة تعثّر')}>
        <div className="viewstack"><div className="screen col">
          <BackTo label="حالات التعثر" onClick={() => navigate(ROUTES.distresses)} />
          <Glass><Empty title="لا توجد حالة بهذا الرقم." note="ارجع إلى قائمة حالات التعثر." /></Glass>
        </div></div>
      </AppLayout>
    )
  }

  const actions = caseActions(c, role.key, asEntity)
  const phase = stopPhase(c.projectId)
  const s = c.settlement
  const needNote = actions.some((a) => a.needsNote)
  const act = (a: (typeof actions)[number]) => {
    const out = actOnCase(c.id, a.act, note, user.name, role.key)
    setSaid(out.length ? { bad: out } : { ok: a.label })
    if (!out.length) setNote('')
  }

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
              <div className="gt-tag"><Tag tone={CASE_STAGE_TONE[c.stage]}>{CASE_STAGE_SAY[c.stage]}</Tag></div>
            </div>
          </header>

          {c.note && (c.stage === 'returned' || c.stage === 'manager' || c.stage === 'rejected') && (
            <Glass>
              <Head title={c.stage === 'rejected' ? 'سبب الرفض' : 'ملاحظات الإعادة'} meta={<Tag tone={c.stage === 'rejected' ? 'no' : 'warn'}>{c.stage === 'rejected' ? 'مرفوض' : 'للاستكمال'}</Tag>} />
              <div className="payq-note"><Icon name={icons.chat} size="sm" /><span>{isolate(c.note)}</span></div>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              <Glass>
                <Head title="القرار" meta={<Person name={c.openedBy} />} />
                <KV
                  rows={[
                    { k: 'السبب', v: isolate(c.reason) },
                    { k: 'قيمة المنحة عند الفتح', v: <Money sm>{c.granted}</Money> },
                    { k: 'المصروف عند الفتح', v: <Money sm>{c.paid}</Money> },
                    ...(c.kind === 'stop' ? [{ k: 'موضع الإيقاف', v: phase.say }] : []),
                    ...(c.newAmount !== undefined ? [{ k: 'القيمة الجديدة', v: <Money sm>{c.newAmount}</Money> }] : []),
                    ...(c.kind === 'reduce' ? [{ k: 'ملحق الاتفاقية', v: c.annex ?? <span className="bad">لم يُرفع</span> }] : []),
                    ...(c.extra ? [{ k: 'الدفعة الإضافية', v: <><Money sm>{c.extra.amount}</Money> · <DateText>{c.extra.dueAt}</DateText></> }] : []),
                    ...(c.decidedAt ? [{ k: 'تاريخ القرار', v: <DateText>{c.decidedAt}</DateText> }] : []),
                  ]}
                />
                {c.kind === 'reduce' && !c.annex && !asEntity && role.key === 'supervisor' && (
                  <div className="act-a"><UploadButton label="ملحق الاتفاقية" onPick={(f) => attachCaseDoc(c.id, 'annex', f.name, user.name)} /></div>
                )}
              </Glass>

              {/* 10.9.3 · 10.9.4 · a stop after money went out · the entity's report and invoices, then the spend approved */}
              {s && (
                <Glass>
                  <Head title="تسوية المصروف الفعلي" meta={s.actual != null ? <Tag tone="ok">اعتُمد المصروف</Tag> : <Tag tone="warn">بانتظار التسوية</Tag>} />
                  <ul className="payq-ck">
                    {(['report', 'invoices'] as const).map((k) => (
                      <li key={k} className={s[k] ? 'ok' : 'no'}>
                        <Icon name={s[k] ? icons.check : icons.alert} size="sm" />
                        <span>{k === 'report' ? 'تقرير التنفيذ' : 'الفواتير'}{s[k] ? ` · ${s[k]}` : ''}</span>
                        {asEntity && !s[k] && c.stage === 'settle' && <UploadButton label={k === 'report' ? 'تقرير التنفيذ' : 'الفواتير'} onPick={(f) => attachCaseDoc(c.id, k, f.name, c.entityName)} />}
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
                      <button type="button" className="btn btn-2 btn-sm" disabled={actual === '' || !s.report || !s.invoices} onClick={() => { const out = settleCase(c.id, Number(actual), user.name); setSaid(out.length ? { bad: out } : { ok: 'اعتماد المصروف الفعلي' }) }}>
                        اعتمد المصروف الفعلي
                      </button>
                    </div>
                  )}
                  <p className="sub cnote">يُطلب من الجهة تقرير تنفيذ وفواتير، ويعتمد المشرف ما صُرف فعلًا من {nf.format(c.paid)} · والفرق يُسترد ويعود إلى مخصص المجال.</p>
                </Glass>
              )}

              {c.recovery && <RecoveryCard rec={c.recovery} owner={{ kind: 'case', id: c.id }} asEntity={asEntity} />}
              <Glass>
                <Head title="سجلّ الحالة" meta={<span className="sub">مشرف المنح · مدير المنح · الرئيس التنفيذي</span>} />
                <ul className="plchg">
                  {c.log.map((a, i) => (
                    <li key={`${a.at}-${i}`}>
                      <div className="plchg-h"><Tag tone="mute"><DateText>{a.at}</DateText></Tag><span className="sub">{a.by}</span></div>
                      <p className="plchg-t">{isolate(a.what)}</p>
                    </li>
                  ))}
                </ul>
              </Glass>
            </div>

            <AssistantAside title="قراءة الحالة" cta="اقرأ الحالة" empty="لا ملاحظات على هذه الحالة الآن." readings={readCase(c)} ask={!asEntity} />
          </div>
        </div>

        {actions.length > 0 && (
          <div className="decdock">
            <div className="chrome decbar payact">
              <div className="rowf gp-3 payact-w">
                <Person name={user.name} size="lg" quiet={false} />
                <span className="decsent">قرارك في <b>{CASE_KIND_SAY[c.kind]}</b><span className="decsep" />{c.projectName}</span>
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
                    const stop = a.needsNote && !note.trim() ? 'اكتب الملاحظة أولًا' : caseStops(c, a.act)[0] ?? ''
                    return (
                      <button key={a.label} type="button" className={`btn ${a.kind}`} data-needs-note={a.needsNote ? '' : undefined} disabled={Boolean(stop)} title={stop || '10.9'} onClick={() => act(a)}>
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
