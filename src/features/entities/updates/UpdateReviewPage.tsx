import { NextStep } from '@/components/assistant/NextStep'
import { suggestNext } from '@/data/shared/agent'
import { accountLine, accountSay } from '@/data/shared/decisions'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BankGrid, BankCard, StopsPopup, DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Num, Person, Tabs, Tag, blockerCount, type Blocker } from '@/components/ui'
import { DocList } from '@/components/docs'
import { Crumbs } from '@/components/shell'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { entityById } from '@/data/mock/entities'
import { activationTone } from '@/lib/tone'
import { isolate, nounAfter } from '@/lib/format'
import { useQueryParams } from '@/hooks/useQueryParams'
import { pickedSay, type PickedReason } from '@/data/entities/reasons'
import { ReasonDialog } from '@/features/entities/ReasonDialog'
import { REQ_TABS, STOP_NOUN } from '@/features/entities/register/reqTabs'
import { ibanValid } from '@/lib/iban'
import { BANK_REJECTS } from '@/data/mock/registration'
import { meOf, readRole, roleByKey } from '@/data/roles'
import { ENTITY_RULES } from '@/data/entities/rules'
import { duplicates, licenseDup } from '@/data/entities/validate'
import {
  UPD_STATE_SAY, canDecide, decideUpdate, updById, useEntityFlow,
} from '@/data/entities/store'
import { OutcomeTag } from '@/features/shared/OutcomeTag'
import { regOutcome } from '@/data/shared/outcome'

/* Reviewing an entity's update request (2.3.upd-9 – 2.3.upd-13).

   The reviewer reads a comparison, not a form: every changed field with its value before and the
   value asked for, side by side, with what already applied marked as such. Approving applies the
   waiting rows and keeps the old values in the entity's log; returning sends it back with a note;
   rejecting leaves the file as it was. Either way the pause on the entity's activity ends.

   Client meeting 23 Oct · return and reject ask their reason in a popup fed by the entity settings
   (or «أخرى» with a written reason) · the reason lands in the request's log with who and when. */

/** A value as the file shows it · a date through `DateText`, the rest isolated for RTL */
const show = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? <DateText>{v}</DateText> : isolate(v || '—'))

export default function UpdateReviewPage() {
  useEntityFlow()
  const { id } = useParams()
  const navigate = useNavigate()
  const u = id ? updById(id) : undefined
  const [ask, setAsk] = useState<'return' | 'reject' | null>(null)
  const { values: q, set: setQ } = useQueryParams(['tab'])
  const tab = REQ_TABS.some((t) => t.slug === q.tab) ? (q.tab as string) : 'data'
  /* Re-audit 7 Oct · each new account is decided on its own · approving the request accepted them all */
  const [bankNo, setBankNo] = useState<Record<string, string>>({})
  /* v3 · 2.4.6 · renewed documents are read and confirmed legible before approval */
  const [legible, setLegible] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const role = readRole()
  const me = meOf(role)
  const may = canDecide('update', role)

  if (!u) {
    return (
      <AppLayout assistantContext={assistFor.page('طلبات تحديث بيانات الجهات')}>
        <div className="viewstack">
          <div className="screen col">
            <Crumbs items={[{ label: 'الجهات', to: ROUTES.entities }, { label: 'طلبات التحديث', to: ROUTES.entityUpdates }]} />
            <Glass>
              <Empty title="الطلب غير موجود."
                actions={<button className="btn btn-2" onClick={() => navigate(ROUTES.entityUpdates)}>العودة إلى طلبات التحديث</button>} />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const e = entityById(u.entityId)
  const waiting = u.changes.filter((c) => !c.direct)
  const direct = u.changes.filter((c) => c.direct)
  const asked = Object.fromEntries(u.changes.map((c) => [c.key, c.to])) as Record<string, string>
  /* v3 · 2.4.9 · the license number and classification pair is checked on an update too */
  const lic = licenseDup(u.entityId, { licenseNo: asked.licenseNo, type: asked.type })
  const dups = [...duplicates(asked, u.banks, { exceptEntity: u.entityId }), ...(lic ? [lic] : [])]
  const badIban = u.banks.filter((b) => !bankNo[b.id] && !ibanValid(b.iban))
  const needsRead = u.docs.length > 0
  const blocked = dups.length > 0 || badIban.length > 0 || (needsRead && !legible)
  const open = u.state === 'review'
  /* Client 23 Oct · «الطلب متوقف للأسباب أدناه» · each blocker named by its field */
  const stops: Blocker[] = [
    ...dups.map((d) => ({ head: d.label, text: <>مسجَّل لـ«{d.who}»</> })),
    ...badIban.map((b) => ({ head: `آيبان ${b.bankName}`, text: 'غير صحيح · ارفض الحساب أو أعد الطلب لتصحيحه' })),
    ...(needsRead && !legible ? [{ head: 'الوثائق المجدَّدة', text: 'لم يُؤكَّد وضوحها وقراءتها بعد · أكّده في شريط القرار' }] : []),
  ]
  const nStop = blockerCount(stops)
  const pick = (p: PickedReason) => {
    if (ask) decideUpdate(u.id, ask, pickedSay(p), me)
    setAsk(null)
  }
  const deciders = ENTITY_RULES.updateBy.map((k) => roleByKey(k).title).join(' أو ')
  /* 17 Oct · the assistant suggests · duplicates and a bad IBAN return it · a clean update is applied */
  type UpdAct = { label: string; kind: string }
  const nextPlan = suggestNext<UpdAct>(open && may ? [{ label: 'اعتماد وتطبيق', kind: 'btn-p' }, { label: 'إعادة للاستكمال', kind: 'btn-2' }] : [], {
    issues: [...dups.map((d) => `مكرر مع سجل آخر: ${d.label}`), ...badIban.map((b) => `آيبان غير صحيح: ${b.iban}`)],
    stops: (a) => (a.label === 'اعتماد وتطبيق' && needsRead && !legible ? ['تأكيد وضوح الوثائق المجدَّدة عمل المراجع'] : []),
    good: [`${u.changes.length} تعديلات مقابل ملف الجهة`, 'لا تكرار مع جهة أخرى'],
  })
  const nextExec = (a: UpdAct, n: string) => {
    decideUpdate(u.id, a.label === 'اعتماد وتطبيق' ? 'approve' : 'return', n, me, bankNo)
    return []
  }

  return (
    <AppLayout assistantContext={assistFor.page('مراجعة طلب تحديث', u.entityName)}>
      <div className="viewstack hasdock">
        <div className="screen col hasg2">
          <Crumbs items={[
            { label: 'الجهات', to: ROUTES.entities },
            { label: 'طلبات التحديث', to: ROUTES.entityUpdates },
            { label: u.id },
          ]} />
          <header>
            <div>
              <h1 className="ptitle">{u.entityName}</h1>
              <p className="sub mt-1"><Mono>{u.id}</Mono> · طلب تحديث بيانات · أرسله {u.by}</p>
            </div>
            {/* Client sheet 24 Oct (#95) · a decided request reads its outcome beside its state */}
            {regOutcome(u.state)
              ? <span className="rowf gp-2"><OutcomeTag outcome={regOutcome(u.state)} /><Tag tone="mute">{UPD_STATE_SAY[u.state]}</Tag></span>
              : <Tag tone="mute">{UPD_STATE_SAY[u.state]}</Tag>}
          </header>

          <Tabs items={REQ_TABS} active={tab} onChange={(x) => setQ({ tab: x === 'data' ? undefined : x })} />

          <div className="g2">
            <div className="col">
              {/* Client 23 Oct · «ما يمنع الاعتماد» opens from the action bar (approve, or its count) · not a card in the page */}
              {tab === 'data' && (
                <>
              <Glass>
                <Head
                  title="التعديلات"
                  meta={<span className="sub"><Num>{waiting.length}</Num> بانتظار الاعتماد · <Num>{direct.length}</Num> طُبّق مباشرة</span>}
                />
                {u.changes.length === 0
                  ? <p className="sub cnote">لا تعديل على الحقول.</p>
                  : (
                    <table className="tbl updiff">
                      <thead>
                        <tr><th>الحقل</th><th>القيمة الحالية</th><th>القيمة المطلوبة</th><th>النوع</th></tr>
                      </thead>
                      <tbody>
                        {u.changes.map((c) => (
                          <tr key={c.key}>
                            <td><b>{c.label}</b></td>
                            <td className="updiff-old">{show(c.from)}</td>
                            <td className="updiff-new">{show(c.to)}</td>
                            <td>{c.direct ? <Tag tone="mute">طُبّق مباشرة</Tag> : <Tag tone="warn">يتطلب اعتمادًا</Tag>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                {dups.length > 0 && (
                  <p className="bad cnote">{dups.map((d) => `${d.label} مسجَّل لـ«${d.who}»`).join(' · ')}{/* doc rule 10 */}</p>
                )}
              </Glass>

              {u.banks.length > 0 && (
                <Glass>
                  <Head title="حسابات بنكية جديدة أو معدَّلة" meta={<span className="sub"><Num>{u.banks.length}</Num> حساب</span>} />
                  <BankGrid>
                    {u.banks.map((b, i) => {
                      const dec = u.bankDecisions && b.id in u.bankDecisions ? u.bankDecisions[b.id] : undefined
                      return (
                        <BankCard key={b.id} bank={b.bankName} iban={b.iban} holder={b.bankHolder} purpose={b.shortName} off={Boolean(dec)}
                          status={b.replaces ? 'تعديل لحساب قائم' : 'حساب جديد'}
                          tag={dec !== undefined ? <Tag tone={dec ? 'no' : 'ok'}>{dec ? `مرفوض · ${dec}` : 'مقبول'}</Tag> : undefined}>
                          {!ibanValid(b.iban) && <span className="bad">الآيبان غير صحيح</span>}
                          <DocList label={`وثيقة ${b.bankName}`} rows={[{ name: b.doc || 'وثيقة الحساب البنكي.pdf', uploaded: Boolean(b.doc), required: true }]} />
                          {open && (
                            <label className="regf">
                              <span className="lb">قرار الحساب</span>
                              <FieldSelect
                                value={bankNo[b.id] ?? ''}
                                options={[{ value: '', label: 'الحساب مقبول' }, ...BANK_REJECTS.map((x) => ({ value: x, label: `مرفوض · ${x}` }))]}
                                onChange={(x) => setBankNo((m) => ({ ...m, [b.id]: x }))}
                                label={`قرار الحساب ${i + 1}`}
                              />
                            </label>
                          )}
                        </BankCard>
                      )
                    })}
                  </BankGrid>
                </Glass>
              )}

                </>
              )}
              {tab === 'docs' && (
                <>
              {u.docs.length === 0 && u.banks.length === 0 && <Glass><Empty title="لا مرفقات في هذا الطلب." /></Glass>}
              {u.banks.length > 0 && (
                <Glass>
                  <Head title="وثائق الحسابات البنكية" meta={<span className="sub"><Num>{u.banks.length}</Num> حساب</span>} />
                  <DocList label="وثائق الحسابات البنكية" rows={u.banks.map((b) => ({ name: b.doc || 'وثيقة الحساب البنكي.pdf', uploaded: Boolean(b.doc), required: true, meta: b.bankName }))} />
                </Glass>
              )}
              {u.docs.length > 0 && (
                <Glass>
                  <Head title="الوثائق الداعمة" meta={<span className="sub"><Num>{u.docs.length}</Num> مرفوعة</span>} />
                  <DocList
                    label="وثائق طلب التحديث"
                    heads={['نهاية الصلاحية']}
                    rows={u.docs.map((d) => ({
                      name: d.file, meta: d.label, uploaded: true,
                      extra: [d.expires ? <DateText>{d.expires}</DateText> : null],
                    }))}
                  />
                </Glass>
              )}

                </>
              )}
              {tab === 'data' && e && (
                <Glass>
                  <Head title="الجهة الآن" meta={<Tag tone={activationTone(accountSay(e))}>{accountLine(e)}</Tag>} />
                  <KV rows={[
                    { k: 'صلاحية التقديم', v: e.canApply ? 'مفعّلة' : 'موقوفة حتى القرار' },
                    { k: 'نهاية الترخيص', v: <DateText>{e.licenseEndsAt}</DateText> },
                  ]} />
                  <Link className="btn btn-2 btn-sm" to={ROUTES.entity(e.id, 'requests')}>
                    <Icon name={icons.entity} size="sm" /> ملف الجهة وطلباتها
                  </Link>
                </Glass>
              )}

              {tab === 'log' && (
              <Glass>
                <Head title="سجل الطلب" meta={<span className="sub"><Num>{u.events.length}</Num> إجراء</span>} />
                <ul className="lg">
                  {[...u.events].reverse().map((ev, i) => (
                    <li className="lgi" key={`${ev.at}-${i}`}>
                      <span className={`lgdot ${ev.kind === 'approve' ? 't-ok' : ev.kind === 'reject' ? 't-no' : ev.kind === 'return' ? 't-ret' : 't-mute'}`} />
                      <div className="lghead">
                        <span className="lgact">{ev.action}</span>
                        <span className="pc-sp" />
                        <span className="lgtime sub"><DateText>{ev.at.slice(0, 10)}</DateText> · <Num>{ev.at.slice(11, 16) || '09:00'}</Num></span>
                      </div>
                      <div className="lgby"><span className="lgwho"><Person name={ev.by} size="md" quiet={false} /></span></div>
                      {ev.fields && (
                        <div className="lgfields">
                          {ev.fields.map((f) => <div className="lgf" key={f.k}><span className="lgf-k">{f.k}</span><span className="lgf-v">{isolate(f.v)}</span></div>)}
                        </div>
                      )}
                      {ev.note && <p className="lgnote">{isolate(ev.note)}</p>}
                    </li>
                  ))}
                </ul>
              </Glass>
              )}
            </div>

            <AssistantAside
              title="مراجعة طلب التحديث"
              suggest={open && may ? <NextStep s={nextPlan} exec={nextExec} /> : undefined}
              cta="راجع الطلب"
              empty="لا ملاحظات · التعديلات لا تتعارض مع بيانات جهات أخرى."
              readings={[
                ...(waiting.length ? [{ id: 'up-wait', kind: 'note' as const, label: 'يتطلب اعتمادًا', metric: { value: String(waiting.length), unit: 'تعديل' }, text: waiting.map((c) => c.label).join(' · '), src: 'إجراء تحديث البيانات' }] : []),
                ...(dups.length ? [{ id: 'up-dup', kind: 'flag' as const, label: 'تكرار مع جهة أخرى', text: dups.map((d) => `${d.label} مسجَّل لـ«${d.who}»`).join(' · '), src: /* doc rule 10 */ '' }] : []),
                ...u.banks.filter((b) => !ibanValid(b.iban)).map((b) => ({ id: `up-iban-${b.id}`, kind: 'flag' as const, label: 'آيبان غير صحيح', text: `${b.bankName} · ${b.iban}`, src: 'التحقق من الآيبان' })),
              ]}
            />
          </div>
        </div>

        <div className="decdock">
          <div className="chrome decbar payact">
            {!open ? (
              <div className="rowf gp-3 payact-w">
                <span className="decsent">
                  الطلب <b>{UPD_STATE_SAY[u.state]}</b>
                  {u.state === 'completion' && ' · عند الجهة للاستكمال، وتُتاح القرارات عند إعادة إرساله'}
                  {u.note && <> · {u.note}</>}
                </span>
              </div>
            ) : !may ? (
              <div className="rowf gp-3 payact-w">
                <span className="decsent">قرار طلب التحديث لـ<b>{deciders}</b> · تعرض هذه الشاشة الطلب للاطلاع</span>
              </div>
            ) : (
              <>
                <div className="rowf gp-3 payact-w">
                  <Person name={me} size="lg" quiet={false} />
                  <span className="decsent">قرارك في تحديث <b>{u.entityName}</b></span>
                </div>
                <div className="payact-g">
                  {needsRead && (
                    <label className="rowf gp-2">
                      <input type="checkbox" checked={legible} onChange={(x) => setLegible(x.target.checked)} />
                      <span>راجعتُ الوثائق المجدَّدة وهي واضحة ومقروءة</span>
                    </label>
                  )}
                  <div className="rowf gp-2">
                    <button className="btn btn-2" onClick={() => setAsk('return')}>
                      إعادة للاستكمال
                    </button>
                    <button className="btn btn-d" onClick={() => setAsk('reject')}>
                      رفض التحديث
                    </button>
                    <button
                      className="btn btn-p"
                      title={blocked ? 'يفتح ما يمنع الاعتماد' : 'تُطبَّق التعديلات وتُحفظ القيم السابقة في سجل الجهة'}
                      onClick={() => { if (blocked) { setStopOpen(true); return } decideUpdate(u.id, 'approve', '', me, bankNo) }}
                    >
                      اعتماد وتطبيق
                    </button>
                  </div>
                  {nStop > 0 && <button type="button" className="lnk" onClick={() => setStopOpen(true)}>ما يمنع الاعتماد · <Num>{nStop}</Num> {nounAfter(nStop, STOP_NOUN)}</button>}
                </div>
              </>
            )}
          </div>
        </div>
        {stopOpen && <StopsPopup title={`ما يمنع الاعتماد · ${u.entityName}`} items={stops} noun={STOP_NOUN} onClose={() => setStopOpen(false)} />}
        {ask && (
          <ReasonDialog
            kind={ask === 'return' ? 'updReturn' : 'updReject'}
            title={ask === 'return' ? 'إعادة طلب التحديث للاستكمال' : 'رفض طلب التحديث'}
            subject={u.entityName}
            confirm={ask === 'return' ? 'أعد للاستكمال' : 'ارفض التحديث'}
            tone={ask === 'return' ? 'btn-p' : 'btn-d'}
            onConfirm={pick}
            onClose={() => setAsk(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}
