import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DateText, Glass, Head, Icon, icons, KV, Money, Num, Person, Tag } from '@/components/ui'
import { DocList } from '@/components/docs'
import { Background } from '@/components/shell'
import Logo from '@/assets/LogoColor'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
import { projectById } from '@/data/mock/projects'
import { consultantByKey } from '@/data/intake/consultants'
import { TODAY } from '@/data/intake/cycle'
import { studyScore } from '@/data/intake/criteria'
import { REQUEST_DOCS, flowOf, giveOpinion, referralOpen, useFlow, type Referral } from '@/data/intake/flow'

/* The consultant's screen · one referred project, for a limited time (3.2.20 · 3.4.19).

   The consultant is external: no menu, no other projects, the portal's own shell. They read the
   request, the entity's documents (never the internal ones) and the supervisor's recommendation,
   then record an opinion that binds no one. The screen locks on its own when the access window
   ends, and once the opinion is sent it reads back what was sent. */

const VERDICTS: NonNullable<Referral['verdict']>[] = ['مؤيّد', 'مؤيّد بتحفّظ', 'غير مؤيّد']

const daysLeft = (to: string) => Math.max(0, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${TODAY}T00:00:00Z`).getTime()) / 86_400_000))

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

  const open = referralOpen(r)
  const expired = !!r && !r.opinion && r.expiresAt < TODAY

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
                <button className="btn btn-2 btn-sm" onClick={() => { signOut(); navigate(ROUTES.login, { replace: true }) }}>
                  <Icon name={icons.logout} size="sm" />
                  تسجيل الخروج
                </button>
              </div>

              {!p || !r ? (
                <Glass>
                  <Head title="لا توجد إحالة" />
                  <p className="sub cnote">لا يوجد مشروع محال إليك بهذا الرابط · تصلك الإحالة من مشرف المنح ومعها رابطها.</p>
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

                  <div className="g2">
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
                        <Head title="مرفقات الجهة" meta={<span className="sub">المرفقات الداخلية لا تظهر هنا</span>} />
                        <DocList
                          label="مرفقات الجهة"
                          rows={REQUEST_DOCS.filter((d) => d.audience === 'entity').map((d) => {
                            const file = f!.docs.find((x) => x.kind === d.key)
                            return { name: file?.name ?? d.label, uploaded: Boolean(file), required: d.required }
                          })}
                        />
                      </Glass>
                    </div>

                    <div className="col">
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
                          <p className="sub cnote">انتهت مدة وصولك إلى هذا المشروع · تُجدَّد الإحالة من مشرف المنح إن لزم.</p>
                        ) : (
                          <>
                            <div className="cfgchips" role="radiogroup" aria-label="الرأي">
                              {VERDICTS.map((v) => (
                                <button key={v} type="button" role="radio" aria-checked={verdict === v} className={`cfgchip${verdict === v ? ' on' : ''}`} onClick={() => setVerdict(v)}>
                                  {v}
                                </button>
                              ))}
                            </div>
                            <label className="regf regf-w mt-3">
                              <span className="lb">الملاحظات<b className="regf-r" aria-label="إلزامي">*</b></span>
                              <span className="fld fld-a">
                                <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="ملاحظات المستشار" placeholder="ما تراه في جدوى المشروع وأثره وما يلزم تعديله" />
                              </span>
                            </label>
                            <div className="regfoot">
                              <span className="decsent">{c?.name ?? ''} · يصل رأيك إلى مشرف المنح</span>
                              <span className="pc-sp" />
                              <button className="btn btn-p" disabled={!open || !verdict || !text.trim()} onClick={() => verdict && giveOpinion(p.id, text.trim(), verdict, c?.name ?? 'المستشار')}>
                                أرسل الرأي
                              </button>
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
