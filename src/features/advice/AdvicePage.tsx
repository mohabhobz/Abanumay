import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FormField, FieldBox, Button, DateText, Glass, Head, Icon, icons, KV, Money, Num, Person, Tag } from '@/components/ui'
import { DocList } from '@/components/docs'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { NOUN, countOf } from '@/lib/format'
import { signOut } from '@/data/session'
import { projectById } from '@/data/mock/projects'
import { consultantByKey } from '@/data/intake/consultants'
import { liveDay } from '@/data/clock'
import { studyScore } from '@/data/intake/criteria'
import { ADVICE_MAX_TRIES, REQUEST_DOCS, adviceUnlocked, flowOf, giveOpinion, referralOpen, unlockAdvice, useFlow, type Referral } from '@/data/intake/flow'

/* The consultant's screen · one referred project, for a limited time (3.2.20 · 3.4.19).

   The consultant is external: no menu, no other projects, the portal's own shell. They read the
   request, the entity's documents (never the internal ones) and the supervisor's recommendation,
   then record an opinion that binds no one. The screen locks on its own when the access window
   ends, and once the opinion is sent it reads back what was sent. */

const VERDICTS: NonNullable<Referral['verdict']>[] = ['مؤيّد', 'مؤيّد بتحفّظ', 'غير مؤيّد']

const daysLeft = (to: string) => Math.max(0, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${liveDay()}T00:00:00Z`).getTime()) / 86_400_000))

export default function AdvicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useFlow()
  const p = projectById(id ?? '')
  const f = p ? flowOf(p.id) : undefined
  const r = f?.referral
  const c = r ? consultantByKey(r.consultant) : undefined
  const [verdict, setVerdict] = useState<Referral['verdict']>()
  const [text, setText] = useState('')
  const [unlocked, setUnlocked] = useState(() => (p ? adviceUnlocked(p.id) : false))
  const [code, setCode] = useState('')
  const [codeErr, setCodeErr] = useState('')

  const open = referralOpen(r)
  const expired = !!r && !r.opinion && r.expiresAt < liveDay()

  return (
    <>
      <Background />
      <div className="app">
        <div className="shell">
          <div className="viewstack">
            <div className="screen col">
              <div className="regtop">
                <Logo className="mark mark-38" />
                <div>
                  <b>منح أبانمي</b>
                  <span className="sub">شاشة المستشار · وصول مؤقت</span>
                </div>
                <span className="pc-sp" />
                <Button variant="2" size="sm" onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}>
                  <Icon name={icons.logout} size="sm" />
                  تسجيل الخروج
                </Button>
              </div>

              {p && r && !unlocked ? (
                <Glass>
                  <Head title="رمز الوصول" />
                  <form className="apv-row" onSubmit={(e) => { e.preventDefault(); const r = unlockAdvice(p.id, code); if (r.ok) setUnlocked(true); else setCodeErr(r.lockedFor ? `أُوقفت المحاولات ${countOf(r.lockedFor, NOUN.minute)} بعد ${ADVICE_MAX_TRIES} محاولات خاطئة` : `الرمز غير صحيح · بقيت ${countOf(r.left, NOUN.attempt)}`) }}>
                    <FieldBox><input className="num" inputMode="numeric" dir="ltr" value={code} onChange={(e) => { setCode(e.target.value); setCodeErr('') }} aria-label="رمز الوصول" /></FieldBox>
                    <Button type="submit" variant="p" size="sm">ادخل</Button>
                  </form>
                  {codeErr && <p className="sub cnote bad" role="alert">{codeErr}</p>}
                </Glass>
              ) : !p || !r ? (
                <Glass>
                  <Head title="لا توجد إحالة" />
                  <p className="sub cnote">لا يوجد مشروع محال إليك بهذا الرابط.</p>
                </Glass>
              ) : (
                <>
                  <header className="phead">
                    <div className="pmain">
                      <h1 className="ptitle">{p.name}</h1>
                      <p className="sub mt-1">
                        {p.entityName} · {p.field} · المبلغ المطلوب <Money>{p.amountRequested}</Money>
                      </p>
                      <div className="gt-tag">
                        {r.opinion
                          ? <Tag tone="ok">أُرسل الرأي · <DateText>{r.opinionAt ?? ''}</DateText></Tag>
                          : expired
                            ? <Tag tone="no">انتهت مدة الوصول · <DateText>{r.expiresAt}</DateText></Tag>
                            : <Tag tone="warn">متبقٍّ <Num>{daysLeft(r.expiresAt)}</Num> أيام · حتى <DateText>{r.expiresAt}</DateText></Tag>}
                      </div>
                    </div>
                  </header>

                  <div className="col">
                    <div className="col">
                      <Glass>
                        <Head title="الطلب" />
                        <KV
                          rows={[
                            { k: 'الجهة', v: p.entityName },
                            { k: 'المسار والمجال', v: `${p.track} · ${p.field}` },
                            { k: 'الهدف', v: p.goal },
                            { k: 'المستفيدون', v: <Num>{p.beneficiaries}</Num> },
                            { k: 'المنطقة', v: `${p.region} · ${p.city}` },
                          ]}
                        />
                        {f!.objectives.length > 0 && (
                          <ol className="rqobj mt-3">{f!.objectives.map((o) => <li key={o}>{o}</li>)}</ol>
                        )}
                      </Glass>
                      <Glass>
                        <Head title="مرفقات الجهة" />
                        <DocList
                          label="مرفقات الجهة"
                          rows={REQUEST_DOCS.filter((d) => d.audience === 'entity').map((d) => {
                            const file = f!.docs.find((x) => x.kind === d.key)
                            return { name: file?.name ?? d.label, uploaded: Boolean(file), required: d.required }
                          })}
                        />
                      </Glass>

                      {/* One column · an outside consultant has no assistant, and the end column is the assistant's alone */}
                      {f!.study && (
                        <Glass>
                          <Head title="توصية مشرف المنح" meta={<Tag tone="mute"><Num>{studyScore(f!.study.scores)}</Num> من <Num>{100}</Num></Tag>} />
                          <p className="cnote"><b>{f!.study.recommendation === 'approve' ? 'الموافقة' : 'الاعتذار'}</b> · {f!.study.justification}</p>
                          <p className="sub cnote"><Person name={f!.study.by} /></p>
                        </Glass>
                      )}

                      <Glass>
                        <Head title="رأيك" meta={<Tag tone="mute">استشاري · غير ملزم</Tag>} />
                        {r.opinion ? (
                          <>
                            <p className="cnote"><b>{r.verdict}</b></p>
                            <p className="cnote">{r.opinion}</p>
                          </>
                        ) : expired ? (
                          <p className="sub cnote">انتهت مدة وصولك إلى هذا المشروع.</p>
                        ) : (
                          <>
                            <div className="cfgchips" role="radiogroup" aria-label="الرأي">
                              {VERDICTS.map((v) => (
                                <Button plain key={v} type="button" role="radio" aria-checked={verdict === v} className={`cfgchip${verdict === v ? ' on' : ''}`} onClick={() => setVerdict(v)}>
                                  {v}
                                </Button>
                              ))}
                            </div>
                            <FormField label="الملاحظات" required wide className="mt-3">
                              <FieldBox area>
                                <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="ملاحظات المستشار" placeholder="ما تراه في جدوى المشروع وأثره وما يلزم تعديله" />
                              </FieldBox>
                            </FormField>
                            <div className="regfoot">
                              <span className="decsent">{c?.name ?? ''}</span>
                              <span className="pc-sp" />
                              <Button variant="p" disabled={!open || !verdict || !text.trim()} onClick={() => verdict && giveOpinion(p.id, text.trim(), verdict, c?.name ?? 'المستشار')}>
                                أرسل الرأي
                              </Button>
                            </div>
                          </>
                        )}
                      </Glass>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
