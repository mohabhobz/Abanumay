import { useMemo, useState } from 'react'
import { isPortalPreview } from '@/data/session'
import { ReadOnly } from '@/components/shell/ReadOnly'
import { Link, useNavigate } from 'react-router-dom'
import { DateField, DateText, Glass, Head, Icon, KV, Mono, Num, Tag, icons } from '@/components/ui'
import { DocList, UploadButton } from '@/components/docs'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { isolate } from '@/lib/format'
import { entityById } from '@/data/mock/entities'
import { entityDetail } from '@/data/mock/entityDetail'
import { ENTITY_DOCS } from '@/data/mock/taxonomy'
import { REG_STAGES, bankIssues, citiesOf, type RegBank, type RegField } from '@/data/mock/registration'
import { FILE_FIELDS, needsApproval } from '@/data/entities/rules'
import { duplicates, formatIssue, todayIso } from '@/data/entities/validate'
import {
  UPD_STATE_SAY, nextUpdId, openUpdateOf, saveUpdate, updById, useEntityFlow, type UpdDoc,
} from '@/data/entities/store'
import { Field } from '../register/Field'
import { BankRows } from '../register/BankRows'
import { OtpPanel } from '../OtpPanel'

/* Updating an approved entity's file · the entity's own screen, opened from its portal (2.3.upd-1 –
   2.3.upd-17).

   One form for the whole file, each field marked with what happens when it changes: «فوري» applies
   on sending (contact and people), «باعتماد» waits for the foundation (identity, license, dates).
   New bank accounts and renewed documents always wait. While anything waits the entity's activity
   is paused (2.3.upd-16), and the screen says so before the button, not after.

   A new email or mobile is proved by a code sent to it (2.3.upd-17) — a typo in a mobile number
   would otherwise send every future code to a stranger. */

const GROUPS: { key: string; label: string }[] = [
  { key: 'id', label: 'التعريف والترخيص' },
  { key: 'dates', label: 'التواريخ' },
  { key: 'contact', label: 'الاتصال' },
  { key: 'people', label: 'الأشخاص' },
]

const REG_FIELD = (key: string): RegField | undefined => REG_STAGES.flatMap((s) => s.fields).find((f) => f.key === key)

/** The eight documents of the file · license and board carry an expiry the entity states */
const DOC_KEYS: { key: string; label: string; expiry: boolean }[] = ENTITY_DOCS.map((label, i) => ({
  key: i === 0 ? 'license' : i === 5 ? 'board' : `doc${i}`, label, expiry: i === 0 || i === 5,
}))

type Phase = 'form' | 'otp' | 'sent'

const show = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? <DateText>{v}</DateText> : isolate(v || '—'))

export default function UpdateRequestPage() {
  const preview = isPortalPreview()
  useEntityFlow()
  const navigate = useNavigate()
  const { values: q } = useQueryParams(['entity', 'id'])
  const e = q.entity ? entityById(q.entity) : undefined
  const d = e ? entityDetail(e) : undefined
  const existing = q.id ? updById(q.id) : e ? openUpdateOf(e.id) : undefined

  /* The file as it stands · what every change is measured against */
  const cur: Record<string, string> = useMemo((): Record<string, string> => (e && d ? {
    name: e.name, type: e.type, licensor: e.licensor, licenseNo: e.licenseNo, region: e.region, city: e.city,
    licenseEndsAt: e.licenseEndsAt, boardEndsAt: d.boardMandateEndsAt, phone: d.phone, mobile: e.mobile, email: e.email,
    website: d.website, directorName: d.directorName, directorMobile: d.directorMobile, clerkName: d.clerkName,
    clerkMobile: d.clerkMobile, clerkEmail: d.clerkEmail,
  } : {}), [e, d])

  const [val, setVal] = useState<Record<string, string>>(() => ({
    ...cur, ...Object.fromEntries((existing?.changes ?? []).map((c) => [c.key, c.to])),
  }))
  const [banks, setBanks] = useState<RegBank[]>(() => existing?.banks ?? [])
  const [docs, setDocs] = useState<UpdDoc[]>(() => existing?.docs ?? [])
  const [phase, setPhase] = useState<Phase>('form')
  const [reqId] = useState(() => existing?.id ?? nextUpdId())
  const [saved, setSaved] = useState(false)

  if (!e || !d) {
    return (
      <>
        <Background />
        <div className="app"><div className="shell"><div className="viewstack"><div className="screen col">
          <Glass><p className="sub cnote">الجهة غير موجودة · افتح هذه الخدمة من بوابة الجهة.</p></Glass>
        </div></div></div></div>
      </>
    )
  }

  const locked = existing?.state === 'review'
  const changes = FILE_FIELDS
    .filter((f) => (val[f.key] ?? '') !== (cur[f.key] ?? ''))
    .map((f) => ({ key: f.key, label: f.label, from: cur[f.key] ?? '', to: val[f.key] ?? '', direct: !needsApproval(f.key) }))
  const errs: Record<string, string> = Object.fromEntries(changes.map((c) => {
    const f = REG_FIELD(c.key)
    if (f?.req && !c.to.trim()) return [c.key, 'حقل إلزامي · لا يُترك فارغًا.']
    const fx = FILE_FIELDS.find((x) => x.key === c.key)
    return [c.key, formatIssue(c.key, fx?.kind === 'url' ? 'url' : f?.kind ?? 'text', c.to)]
  }).filter(([, m]) => m))
  const dups = duplicates(Object.fromEntries(changes.map((c) => [c.key, c.to])), banks, { exceptEntity: e.id })
  const bankGaps = banks.length ? bankIssues(banks).map((b) => b.say) : []
  const docGaps = docs.filter((x) => DOC_KEYS.find((k) => k.key === x.key)?.expiry && (!x.expires || x.expires <= todayIso()))
    .map((x) => `${x.label}: تاريخ نهاية صلاحية لاحق لليوم`)
  const gaps = [
    ...Object.entries(errs).map(([k, m]) => `${FILE_FIELDS.find((f) => f.key === k)?.label}: ${m}`),
    ...dups.map((x) => `${x.label} مسجَّل لـ«${x.who}»`),
    ...bankGaps, ...docGaps,
  ]
  const nothing = changes.length === 0 && banks.length === 0 && docs.length === 0
  const waits = changes.some((c) => !c.direct) || banks.length > 0 || docs.length > 0
  const otpTo = changes.filter((c) => FILE_FIELDS.find((f) => f.key === c.key)?.otp).map((c) => c.to)
  const expired = d.docs.filter((x) => x.expired).map((x) => x.name)

  const payload = () => ({ id: reqId, entityId: e.id, entityName: e.name, changes, banks, docs, by: d.clerkName || 'مدخل بيانات الجهة', note: existing?.note })
  const send = () => { saveUpdate(payload(), true); setPhase('sent') }

  return (
    <>
      <Background />
      <div className="app">
        <div className="shell">
          <div className="viewstack">
            <div className="screen col">
              <div className="regtop">
                <Logo className="mark mark-38" />
                <div><b>منح أبانمي</b><span className="sub">بوّابة الجهة · تحديث بياناتك</span></div>
                <span className="pc-sp" />
                <Link className="btn btn-2 btn-sm" to={`${ROUTES.entityPortal}?entity=${e.id}`}>
                  <Icon name={icons.chevronBack} size="sm" /> العودة إلى البوابة
                </Link>
              </div>

              <header className="phead">
                <div className="pmain">
                  <h1 className="ptitle">تحديث بيانات {e.name}</h1>
                  <p className="sub mt-1">
                    طلب <Mono>{reqId}</Mono>
                    {existing && <> · {UPD_STATE_SAY[existing.state]}</>}
                    {' · '}بيانات الاتصال والأشخاص تُطبَّق فور الإرسال، والهوية والترخيص والحسابات والوثائق باعتماد المؤسسة
                  </p>
                </div>
              </header>
              {preview && <p className="sub cnote"><Tag tone="mute">معاينة للقراءة فقط</Tag> طلب التحديث ترسله الجهة من حسابها</p>}
              <ReadOnly on={preview}>

              {existing?.state === 'completion' && existing.note && (
                <div className="ptl-res">
                  <Icon name={icons.alert} size="sm" />
                  <div><b>ما طلبته المؤسسة</b><p>{isolate(existing.note)}</p></div>
                </div>
              )}
              {expired.length > 0 && !locked && phase === 'form' && (
                <div className="ptl-res no">
                  <Icon name={icons.alert} size="sm" />
                  <div><b>وثائق منتهية: {expired.join('، ')}</b><p>ارفع النسخة السارية مع تاريخ نهاية صلاحيتها أدناه · تعود الجهة نشطة عند اعتمادها.</p></div>
                </div>
              )}

              {phase === 'sent' ? (
                <Glass>
                  <Head title="أُرسل طلب التحديث" meta={<Tag tone={waits ? 'warn' : 'ok'}>{waits ? 'قيد المراجعة' : 'طُبّق'}</Tag>} />
                  <ul className="payq-ck">
                    {changes.filter((c) => c.direct).length > 0 && (
                      <li className="ok"><Icon name={icons.check} size="sm" /><span>طُبّق فورًا: {changes.filter((c) => c.direct).map((c) => c.label).join('، ')}</span></li>
                    )}
                    {waits && (
                      <li className="no"><Icon name={icons.clock} size="sm" /><span>بانتظار اعتماد المؤسسة: {[...changes.filter((c) => !c.direct).map((c) => c.label), ...banks.map(() => 'حساب بنكي'), ...docs.map((x) => x.label)].join('، ')} · نشاط الجهة معلّق حتى القرار</span></li>
                    )}
                  </ul>
                  <footer className="payq-f">
                    <span className="sub payq-when"><Mono>{reqId}</Mono></span>
                    <button className="btn btn-p" onClick={() => navigate(`${ROUTES.entityPortal}?entity=${e.id}`)}>العودة إلى البوابة</button>
                  </footer>
                </Glass>
              ) : locked ? (
                <Glass>
                  <Head title="طلبك قيد المراجعة" meta={<Tag tone="warn">{UPD_STATE_SAY.review}</Tag>} />
                  <KV rows={existing!.changes.map((c) => ({ k: c.label, v: <>{show(c.from)} ← <b>{show(c.to)}</b>{c.direct ? ' · طُبّق' : ''}</> }))} />
                  <p className="sub cnote">لا يُعدَّل الطلب وهو عند المراجع · ستصلك النتيجة، أو يُعاد إليك للاستكمال.</p>
                </Glass>
              ) : phase === 'otp' ? (
                <Glass>
                  <Head title="تحقّق من بيانات الاتصال الجديدة" meta={<span className="sub">قاعدة 17</span>} />
                  <OtpPanel purpose="update" to={otpTo} onVerified={send} onEdit={() => setPhase('form')} />
                </Glass>
              ) : (
                <>
                  {GROUPS.map((g) => (
                    <Glass key={g.key}>
                      <Head title={g.label} meta={<span className="sub"><Num>{changes.filter((c) => FILE_FIELDS.find((f) => f.key === c.key)?.group === g.key).length}</Num> معدَّل</span>} />
                      <div className="regfields">
                        {FILE_FIELDS.filter((f) => f.group === g.key).map((fx) => {
                          const f = REG_FIELD(fx.key)
                          if (!f) return null
                          const changed = (val[fx.key] ?? '') !== (cur[fx.key] ?? '')
                          return (
                            <Field
                              key={fx.key}
                              f={changed ? { ...f, hint: `الحالي: ${cur[fx.key] || '—'}` } : f}
                              value={val[fx.key] ?? ''}
                              parent={f.dependsOn ? val[f.dependsOn] ?? '' : ''}
                              onChange={(x) => setVal((s) => {
                                const n = { ...s, [fx.key]: x }
                                if (fx.key === 'region' && n.city && !citiesOf(x).includes(n.city)) n.city = ''
                                return n
                              })}
                              error={errs[fx.key]}
                              tag={needsApproval(fx.key)
                                ? <Tag tone="warn">باعتماد</Tag>
                                : <Tag tone="mute">{fx.otp ? 'فوري · برمز تحقّق' : 'فوري'}</Tag>}
                            />
                          )
                        })}
                      </div>
                    </Glass>
                  ))}

                  {/* Batch 3 · 8 Oct · an account on file is edited here too · the edit is a new row
                      tied to the account it replaces, approved like a new account; once approved the
                      old one is deactivated, not overwritten, so its past payments keep their account */}
                  {d.banks.some((b) => b.status === 'مفعل') && (
                    <Glass>
                      <Head title="الحسابات الحالية" meta={<Tag tone="warn">التعديل باعتماد</Tag>} />
                      <ul className="rgbanks">
                        {d.banks.filter((b) => b.status === 'مفعل').map((b, i) => {
                          const editing = banks.some((x) => x.replaces === b.id)
                          return (
                            <li key={b.id}>
                              <span className="rgbank-n num">{i + 1}</span>
                              <div className="rgbank-b">
                                <div className="rgbank-t"><b>{b.bank}</b><span className="sub">· {b.accountName} · {b.shortName}</span></div>
                                <div className="sub"><Mono>{b.iban}</Mono></div>
                              </div>
                              <button
                                type="button"
                                className="btn btn-2 btn-sm"
                                disabled={editing}
                                aria-label={`عدّل الحساب ${b.shortName || b.bank}`}
                                onClick={() => setBanks((s) => [...s, { id: `ed${Date.now()}`, bankName: b.bank, bankHolder: b.accountName, shortName: b.shortName, iban: '', replaces: b.id }])}
                              >
                                {editing ? 'تعديله في الطلب' : 'عدّل الحساب'}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </Glass>
                  )}

                  <Glass>
                    <Head title="حسابات بنكية جديدة أو معدَّلة" meta={<Tag tone="warn">باعتماد</Tag>} />
                    <p className="sub cnote">الحساب المعدَّل يحلّ محلّ الحالي بعد اعتماده ومطابقته بوثيقته · ويُعطَّل الحالي ولا يُحذف.</p>
                    <BankRows banks={banks} onChange={setBanks} min={0} idPrefix="nb" replacing={Object.fromEntries(d.banks.map((b) => [b.id, b.shortName || b.bank]))} />
                  </Glass>

                  <Glass>
                    <Head title="الوثائق الداعمة" meta={<Tag tone="warn">باعتماد</Tag>} />
                    <DocList
                      label="وثائق الجهة · رفع نسخة جديدة"
                      rows={DOC_KEYS.map((k) => {
                        const up = docs.find((x) => x.key === k.key)
                        const was = d.docs.find((x) => x.name === k.label)
                        return {
                          name: up?.file ?? k.label,
                          meta: up ? `${k.label} · بانتظار الإرسال` : was?.expired ? 'منتهية · يلزم التجديد' : was?.uploaded ? 'مرفوعة سابقًا' : 'غير مرفوعة',
                          uploaded: Boolean(up) || Boolean(was?.uploaded && !was.expired),
                          required: Boolean(was?.expired),
                          action: up
                            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDocs((s) => s.filter((y) => y.key !== k.key))}>
                                <Icon name={icons.close} size="sm" /> أزل
                              </button>
                            : <UploadButton label={was?.uploaded && !was.expired ? `استبدل ${k.label}` : `ارفع ${k.label}`} onPick={(file) => setDocs((s) => [...s, { key: k.key, label: k.label, file: file.name }])} />,
                        }
                      })}
                    />
                    {/* The renewed license and board mandate carry the date they now run to · it becomes
                        the file's date on approval, and the entity is active again if nothing else lapsed */}
                    {docs.some((x) => DOC_KEYS.find((k) => k.key === x.key)?.expiry) && (
                      <div className="regfields mt-3">
                        {docs.filter((x) => DOC_KEYS.find((k) => k.key === x.key)?.expiry).map((x) => (
                          <label key={x.key} className="regf">
                            <span className="lb">نهاية صلاحية {x.label}<b className="regf-r" aria-label="إلزامي">*</b></span>
                            <DateField label={`نهاية صلاحية ${x.label}`} value={x.expires ?? ''} min={todayIso()}
                              onChange={(v) => setDocs((s) => s.map((y) => (y.key === x.key ? { ...y, expires: v } : y)))} />
                          </label>
                        ))}
                      </div>
                    )}
                  </Glass>

                  <Glass>
                    <Head title="قبل الإرسال" meta={gaps.length ? <Tag tone="warn"><Num>{gaps.length}</Num> ملاحظة</Tag> : <Tag tone="ok">جاهز</Tag>} />
                    {gaps.length > 0 && <ul className="payq-ck">{gaps.map((x) => <li key={x} className="no"><Icon name={icons.alert} size="sm" /><span>{x}</span></li>)}</ul>}
                    {waits && !gaps.length && <p className="sub cnote">في الطلب ما يحتاج إلى اعتماد · يُعلَّق نشاط الجهة (ومنه تقديم المشاريع) حتى يُبتّ فيه.</p>}
                    {otpTo.length > 0 && !gaps.length && <p className="sub cnote">غيّرت بريدًا أو جوالًا · يُرسل رمز تحقّق إلى القيمة الجديدة قبل الإرسال.</p>}
                    {saved && <p className="sub cnote">حُفظ الطلب مسودة · يُستكمل من البوابة في أي وقت.</p>}
                    <footer className="payq-f">
                      <span className="sub payq-when"><Num>{changes.length}</Num> حقول · <Num>{banks.length}</Num> حسابات · <Num>{docs.length}</Num> وثائق</span>
                      <button className="btn btn-2" disabled={nothing} onClick={() => { saveUpdate(payload(), false); setSaved(true) }}>احفظ مسودة</button>
                      <button
                        className="btn btn-p"
                        disabled={nothing || gaps.length > 0}
                        title={nothing ? 'لم يتغيّر شيء بعد' : gaps.length ? 'صحّح الملاحظات أولًا' : undefined}
                        onClick={() => (otpTo.length ? setPhase('otp') : send())}
                      >
                        <Icon name={icons.send} size="sm" />
                        {existing?.state === 'completion' ? 'أعد إرسال الطلب' : 'أرسل طلب التحديث'}
                      </button>
                    </footer>
                  </Glass>
                </>
              )}

              </ReadOnly>
              <p className="sub tcen cnote">آخر تحديث للملف <DateText>{d.updatedAt}</DateText></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
