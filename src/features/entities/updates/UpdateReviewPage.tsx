import { activationSay } from '@/data/shared/decisions'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DateText, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Mono, Num, Person, Tag } from '@/components/ui'
import { DocList } from '@/components/docs'
import { Crumbs } from '@/components/shell'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { entityById } from '@/data/mock/entities'
import { activationTone } from '@/lib/tone'
import { isolate } from '@/lib/format'
import { ibanValid } from '@/lib/iban'
import { BANK_REJECTS } from '@/data/mock/registration'
import { meOf, readRole, roleByKey } from '@/data/roles'
import { ENTITY_RULES } from '@/data/entities/rules'
import { duplicates } from '@/data/entities/validate'
import {
  UPD_STATE_SAY, canDecide, decideUpdate, updById, useEntityFlow,
} from '@/data/entities/store'

/* Reviewing an entity's update request (2.3.upd-9 – 2.3.upd-13).

   The reviewer reads a comparison, not a form: every changed field with its value before and the
   value asked for, side by side, with what already applied marked as such. Approving applies the
   waiting rows and keeps the old values in the entity's log; returning sends it back with a note;
   rejecting leaves the file as it was. Either way the pause on the entity's activity ends. */

/** A value as the file shows it · a date through `DateText`, the rest isolated for RTL */
const show = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? <DateText>{v}</DateText> : isolate(v || '—'))

export default function UpdateReviewPage() {
  useEntityFlow()
  const { id } = useParams()
  const navigate = useNavigate()
  const u = id ? updById(id) : undefined
  const [note, setNote] = useState('')
  /* Re-audit 7 Oct · each new account is decided on its own · approving the request accepted them all */
  const [bankNo, setBankNo] = useState<Record<string, string>>({})
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
              <Empty title="الطلب غير موجود." note="ربما الرابط قديم · علمًا بأن الطلبات لا تُحذف."
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
  const dups = duplicates(
    Object.fromEntries(u.changes.map((c) => [c.key, c.to])) as Record<string, string>,
    u.banks, { exceptEntity: u.entityId },
  )
  const badIban = u.banks.filter((b) => !bankNo[b.id] && !ibanValid(b.iban))
  const blocked = dups.length > 0 || badIban.length > 0
  const open = u.state === 'review'
  const deciders = ENTITY_RULES.updateBy.map((k) => roleByKey(k).title).join(' أو ')

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
            <Tag tone="mute">{UPD_STATE_SAY[u.state]}</Tag>
          </header>

          <div className="g2">
            <div className="col">
              <Glass>
                <Head
                  title="التعديلات"
                  meta={<span className="sub"><Num>{waiting.length}</Num> بانتظار الاعتماد · <Num>{direct.length}</Num> طُبّق مباشرة</span>}
                />
                {u.changes.length === 0
                  ? <p className="sub cnote">لا تعديل على الحقول · الطلب يضيف حسابات أو وثائق فقط.</p>
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
                  <p className="bad cnote">{dups.map((d) => `${d.label} مسجَّل لـ«${d.who}»`).join(' · ')} · قاعدة 10</p>
                )}
              </Glass>

              {u.banks.length > 0 && (
                <Glass>
                  <Head title="حسابات بنكية جديدة أو معدَّلة" meta={<span className="sub"><Num>{u.banks.length}</Num> حساب</span>} />
                  <ul className="rgbanks">
                    {u.banks.map((b, i) => (
                      <li key={b.id}>
                        <span className="rgbank-n num">{i + 1}</span>
                        <div className="rgbank-b">
                          <div className="rgbank-t"><b>{b.bankName}</b><span className="sub">· {b.bankHolder} · {b.shortName}</span>{b.replaces && <Tag tone="warn">تعديل لحساب قائم · يُعطَّل الحالي عند القبول</Tag>}</div>
                          <div className="sub"><Mono>{b.iban}</Mono> {!ibanValid(b.iban) && <span className="bad">· الآيبان غير صحيح</span>}</div>
                          <DocList label={`وثيقة ${b.bankName}`} rows={[{ name: b.doc || 'وثيقة الحساب البنكي.pdf', uploaded: Boolean(b.doc), required: true }]} />
                          {open && (
                            <label className="regf mt-2">
                              <span className="lb">قرار الحساب</span>
                              <FieldSelect
                                value={bankNo[b.id] ?? ''}
                                options={[{ value: '', label: 'الحساب مقبول' }, ...BANK_REJECTS.map((x) => ({ value: x, label: `مرفوض · ${x}` }))]}
                                onChange={(x) => setBankNo((m) => ({ ...m, [b.id]: x }))}
                                label={`قرار الحساب ${i + 1}`}
                              />
                            </label>
                          )}
                          {u.bankDecisions && b.id in u.bankDecisions && (
                            <Tag tone={u.bankDecisions[b.id] ? 'no' : 'ok'}>{u.bankDecisions[b.id] ? `مرفوض · ${u.bankDecisions[b.id]}` : 'مقبول'}</Tag>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
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

              {/* The entity now and the log · in the main column, the end column is the assistant's alone */}
              {e && (
                <Glass>
                  <Head title="الجهة الآن" meta={<Tag tone={activationTone(e.activation)}>{activationSay(e.activation)}</Tag>} />
                  <KV rows={[
                    { k: 'صلاحية التقديم', v: e.canApply ? 'مفعّلة' : 'موقوفة حتى القرار' },
                    { k: 'نهاية الترخيص', v: <DateText>{e.licenseEndsAt}</DateText> },
                  ]} />
                  <p className="sub cnote">
                    {open ? 'نشاط الجهة معلّق بهذا الطلب · يعود إلى حالته السابقة عند القرار (القاعدة 16 في إجراء التحديث).' : 'أُغلق الطلب وانتهى تعليق النشاط.'}
                  </p>
                  <Link className="btn btn-2 btn-sm" to={ROUTES.entity(e.id, 'requests')}>
                    <Icon name={icons.entity} size="sm" /> ملف الجهة وطلباتها
                  </Link>
                </Glass>
              )}

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
                      <div className="lgby"><span className="lgwho">{ev.by}</span></div>
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
            </div>

            <AssistantAside
              title="مراجعة طلب التحديث"
              cta="راجع الطلب"
              empty="لا ملاحظات · التعديلات لا تتعارض مع بيانات جهات أخرى."
              readings={[
                ...(waiting.length ? [{ id: 'up-wait', kind: 'note' as const, label: 'يتطلب اعتمادًا', metric: { value: String(waiting.length), unit: 'تعديل' }, text: waiting.map((c) => c.label).join(' · '), src: 'إجراء تحديث البيانات' }] : []),
                ...(dups.length ? [{ id: 'up-dup', kind: 'flag' as const, label: 'تكرار مع جهة أخرى', text: dups.map((d) => `${d.label} مسجَّل لـ«${d.who}»`).join(' · '), src: 'قاعدة 10' }] : []),
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
                  <label className="payact-n">
                    <span className="vis-h">الملاحظة</span>
                    <input value={note} onChange={(x) => setNote(x.target.value)} placeholder="الملاحظة · إلزامية للإعادة والرفض" />
                  </label>
                  <div className="rowf gp-2">
                    <button className="btn btn-2" data-needs-note="" disabled={!note.trim()} onClick={() => decideUpdate(u.id, 'return', note.trim(), me)}>
                      إعادة للاستكمال
                    </button>
                    <button className="btn btn-d" data-needs-note="" disabled={!note.trim()} onClick={() => decideUpdate(u.id, 'reject', note.trim(), me)}>
                      رفض التحديث
                    </button>
                    <button
                      className="btn btn-p"
                      disabled={blocked}
                      title={blocked ? 'بيانات مكرّرة أو آيبان غير صحيح · أعده للاستكمال' : 'تُطبَّق التعديلات وتُحفظ القيم السابقة في سجل الجهة'}
                      onClick={() => decideUpdate(u.id, 'approve', note.trim(), me, bankNo)}
                    >
                      اعتماد وتطبيق
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
