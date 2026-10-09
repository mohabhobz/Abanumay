import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DateText, Empty, Glass, Head, MultiSelect, Num, Pager, SearchBox, Select, Tabs, Tag } from '@/components/ui'
import { DockSlotProvider, SaveBar, useDockSlot } from '@/components/shell'
import { AppLayout } from '@/app/layout/AppLayout'
import { useRole } from '@/hooks/useRole'
import { assistFor } from '@/data/mock/assistant'
import { mask } from '@/data/entities/auth'
import { CHANNEL_SAY, type EscChannel } from '@/data/shared/escRules'
import {
  AUDIENCE_SAY, NOTIFY_RULES, TOPIC_SAY, outbox, saveNotifyRules, type Audience, type NotifyRules, type Topic,
  PLACEHOLDERS, TEMPLATES, fillTemplate, saveTemplates, smsSegments, type Message, type Templates,
} from '@/data/shared/notify'
import { Who } from './parts'
import { useAllStores } from './useAllStores'

/* Notifications · cross «الإشعارات».

   Two tabs. «القنوات»: which channel each audience gets per topic · in-app is always on, email and
   SMS are the admin's choice (clause 1 of the notifications feature: external channels beside the
   in-app notice). «سجل الإرسال»: every message the system sent, per channel, with the address it
   went to · so «did the entity get told?» has an answer, not a guess. */

const TABS = [
  { slug: 'outbox', label: 'سجل الإرسال' },
  { slug: 'channels', label: 'القنوات' },
  { slug: 'templates', label: 'القوالب والبوابة' },
] as const
const STATE_SAY: Record<Message['state'], { say: string; tone: 'ok' | 'no' | 'warn' | 'teal' }> = {
  sent: { say: 'أُرسلت', tone: 'ok' }, failed: { say: 'لا عنوان', tone: 'no' },
  logged: { say: 'سُجّلت · البوابة غير مربوطة', tone: 'warn' }, queued: { say: 'في طابور البوابة', tone: 'teal' },
}
const CHNL = (Object.keys(CHANNEL_SAY) as EscChannel[]).map((k) => ({ value: k, label: CHANNEL_SAY[k] }))
const TOPICS = Object.keys(TOPIC_SAY) as Topic[]
const AUDS = Object.keys(AUDIENCE_SAY) as Audience[]
const PAGE = 25

export default function NotifyHubPage() {
  useAllStores()
  const dock = useDockSlot()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.slug === params.get('tab'))?.slug ?? 'outbox'
  const { role, user } = useRole()
  const admin = role.key === 'admin'

  const [saved, setSaved] = useState<NotifyRules['channels']>(() => structuredClone(NOTIFY_RULES.channels))
  const [d, setD] = useState<NotifyRules['channels']>(saved)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const [tSaved, setTSaved] = useState<Templates>(() => structuredClone(TEMPLATES))
  const [tp, setTp] = useState<Templates>(() => structuredClone(TEMPLATES))
  const tDirty = JSON.stringify(tp) !== JSON.stringify(tSaved)
  const [tTopic, setTTopic] = useState<Topic>('payment')
  const [ping, setPing] = useState('')

  const [q, setQ] = useState('')
  const [aud, setAud] = useState<string | undefined>()
  const [chn, setChn] = useState<string | undefined>()
  const [top, setTop] = useState<string | undefined>()
  const [page, setPage] = useState(1)

  const all = outbox()
  const rows = all.filter((m) =>
    (!aud || m.audience === aud) && (!chn || m.channel === chn) && (!top || m.notice.topic === top) &&
    (!q.trim() || `${m.notice.title} ${m.notice.context} ${m.notice.to}`.includes(q.trim())))
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const external = all.filter((m) => m.channel !== 'app').length

  return (
    <AppLayout assistantContext={assistFor.page('الإشعارات')}>
      <DockSlotProvider value={dock.value}>
      <div className={`viewstack${dock.on ? ' hasdock' : ''}`}>
        <div className="screen col">
          <header className="phead">
            <div className="pmain">
              <h1 className="ptitle">الإشعارات</h1>
              <p className="sub mt-1">
                <Num>{all.length}</Num> رسالة منها <Num>{external}</Num> عبر البريد والرسائل النصية · القنوات يضبطها مدير النظام
              </p>
            </div>
            {!admin && <Tag tone="mute">القنوات للاطلاع · يحرّرها مدير النظام</Tag>}
          </header>

          <Tabs items={TABS} active={tab} onChange={(s) => setParams({ tab: s })} />

          {tab === 'outbox' && (
            <>
              <Glass className="ftoolbar">
                <div className="ftool-r">
                <div className="ftool-f">
                <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="ابحث في العنوان أو المستلم…" />
                <Select label="الجمهور" all="كل الجمهور" value={aud} options={AUDS.map((a) => ({ value: a, label: AUDIENCE_SAY[a] }))} onChange={(v) => { setAud(v); setPage(1) }} />
                <Select label="القناة" all="كل القنوات" value={chn} options={CHNL} onChange={(v) => { setChn(v); setPage(1) }} />
                <Select label="الموضوع" all="كل الموضوعات" value={top} options={TOPICS.map((t) => ({ value: t, label: TOPIC_SAY[t] }))} onChange={(v) => { setTop(v); setPage(1) }} />
                </div>
                </div>
              </Glass>
              <Glass className="tblcard">
                {rows.length === 0 ? <Empty title="لا رسائل بهذا التصفية." /> : (
                  <div className="tblwrap">
                    <table className="tbl" aria-label="سجل الإرسال">
                      <thead>
                        <tr>
                          <th><span className="th-t">التاريخ</span></th>
                          <th><span className="th-t">الرسالة</span></th>
                          <th><span className="th-t">المستلم</span></th>
                          <th><span className="th-t">القناة</span></th>
                          <th><span className="th-t">العنوان</span></th>
                          <th><span className="th-t">الحالة</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((m) => (
                          <tr key={m.id}>
                            <td><DateText>{m.notice.at}</DateText></td>
                            <td><Link className="tlink" to={m.notice.href}>{m.notice.title}</Link><div className="sub trim1" title={m.text}>{TOPIC_SAY[m.notice.topic]} · {m.channel === 'app' ? m.notice.context : m.text}</div></td>
                            <td><span className="rowf gp-2"><Who name={m.notice.to} /><span className="sub">{AUDIENCE_SAY[m.audience]}</span></span></td>
                            <td><Tag tone={m.channel === 'app' ? 'mute' : 'teal'}>{CHANNEL_SAY[m.channel]}</Tag></td>
                            <td className="sub"><bdi>{m.channel === 'app' ? 'صندوق الإشعارات' : mask(m.address)}</bdi></td>
                            <td><Tag tone={STATE_SAY[m.state].tone}>{STATE_SAY[m.state].say}</Tag></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Glass>
              {rows.length > PAGE && <Pager page={page} pageSize={PAGE} total={rows.length} onPage={setPage} onPageSize={() => undefined} />}
            </>
          )}

          {tab === 'channels' && (
            <Glass className="tblcard">
              <Head title="القنوات حسب الموضوع" meta={<span className="sub">داخل النظام دائمًا · البريد والرسائل اختيار</span>} />
              <div className="tblwrap">
                <table className="tbl cfgtbl" aria-label="قنوات الإشعار">
                  <thead>
                    <tr>
                      <th><span className="th-t">الموضوع</span></th>
                      {AUDS.map((a) => <th key={a}><span className="th-t">{AUDIENCE_SAY[a]}</span></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TOPICS.map((t) => (
                      <tr key={t}>
                        <td>{TOPIC_SAY[t]}</td>
                        {AUDS.map((a) => (
                          <td key={a}>
                            {admin ? (
                              <MultiSelect
                                label={`قنوات ${TOPIC_SAY[t]} · ${AUDIENCE_SAY[a]}`}
                                all="داخل النظام"
                                values={d[a][t]}
                                options={CHNL}
                                onChange={(v) => setD((x) => ({ ...x, [a]: { ...x[a], [t]: (v.includes('app') ? v : ['app', ...v]) as EscChannel[] } }))}
                              />
                            ) : <span className="sub">{d[a][t].map((c) => CHANNEL_SAY[c]).join('، ')}</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Glass>
          )}

          {tab === 'templates' && (() => {
            const t = tp.list[tTopic]
            const sample = all.find((m) => m.notice.topic === tTopic)?.notice ?? { to: 'جمعية مثال', title: TOPIC_SAY[tTopic], context: 'تفاصيل الإشعار', href: '/' }
            const put = (k: 'subject' | 'body' | 'sms', v: string) => setTp((x) => ({ ...x, list: { ...x.list, [tTopic]: { ...x.list[tTopic], [k]: v } } }))
            return (
              <>
                <Glass>
                  <Head title="بوابة الإرسال" meta={<Tag tone={tp.gateway.mode === 'api' && tp.gateway.endpoint ? 'teal' : 'warn'}>{tp.gateway.mode === 'api' && tp.gateway.endpoint ? 'مربوطة بخدمة الخادم' : 'غير مربوطة · تُسجَّل الرسائل بنصها'}</Tag>} />
                  <p className="sub">البريد والرسائل النصية تمرّ ببوابة واحدة · قبل التعاقد مع مزوّد تُسجَّل كل رسالة بنصها النهائي هنا، وعند ربط خدمة الخادم تُسلَّم لها لترسلها وتعيد حالة التسليم.</p>
                  <div className="apv-row mt-2">
                    <Select label="الوضع" value={tp.gateway.mode} options={[{ value: 'log', label: 'تسجيل فقط' }, { value: 'api', label: 'خدمة الخادم' }]} onChange={(v) => admin && setTp((x) => ({ ...x, gateway: { ...x.gateway, mode: (v ?? 'log') as 'log' | 'api' } }))} />
                    <span className="fld"><input value={tp.gateway.endpoint} disabled={!admin} onChange={(e) => setTp((x) => ({ ...x, gateway: { ...x.gateway, endpoint: e.target.value } }))} aria-label="عنوان خدمة الإرسال" placeholder="https://api…/notify" dir="ltr" /></span>
                    <span className="fld"><input value={tp.gateway.sender} disabled={!admin} onChange={(e) => setTp((x) => ({ ...x, gateway: { ...x.gateway, sender: e.target.value } }))} aria-label="اسم المرسل" placeholder="اسم المرسل" dir="ltr" /></span>
                    <button type="button" className="btn btn-2 btn-sm" disabled={!tp.gateway.endpoint} onClick={() => {
                      setPing('جارٍ الاختبار…')
                      fetch(tp.gateway.endpoint, { method: 'HEAD' }).then((r) => setPing(r.ok ? 'الخدمة تستجيب' : `ردّت الخدمة بالرمز ${r.status}`)).catch(() => setPing('تعذّر الوصول إلى الخدمة'))
                    }}>اختبر الاتصال</button>
                    {ping && <span className="sub">{ping}</span>}
                  </div>
                </Glass>
                <Glass>
                  <Head title="قالب الموضوع" meta={<Select label="الموضوع" value={tTopic} options={TOPICS.map((x) => ({ value: x, label: TOPIC_SAY[x] }))} onChange={(v) => v && setTTopic(v as Topic)} />} />
                  <p className="sub cnote">المتغيّرات: {PLACEHOLDERS.map((x) => <bdi key={x} className="num"> {x}</bdi>)} · تُملأ من الإشعار عند الإرسال</p>
                  <div className="regfields">
                    <label className="regf"><span className="lb">عنوان البريد</span><span className="fld"><input value={t.subject} disabled={!admin} onChange={(e) => put('subject', e.target.value)} aria-label="عنوان البريد" /></span></label>
                    <label className="regf"><span className="lb">نص البريد</span><span className="fld"><textarea rows={6} value={t.body} disabled={!admin} onChange={(e) => put('body', e.target.value)} aria-label="نص البريد" /></span></label>
                    <label className="regf"><span className="lb">الرسالة النصية · <Num>{fillTemplate(t.sms, sample).length}</Num> حرفًا · <Num>{smsSegments(fillTemplate(t.sms, sample))}</Num> رسالة</span><span className="fld"><textarea rows={2} value={t.sms} disabled={!admin} onChange={(e) => put('sms', e.target.value)} aria-label="الرسالة النصية" /></span></label>
                  </div>
                </Glass>
                <Glass>
                  <Head title="معاينة" meta={<span className="sub">على آخر إشعار من هذا الموضوع · {sample.to}</span>} />
                  <p><b>{fillTemplate(t.subject, sample)}</b></p>
                  <p className="sub prose pre">{fillTemplate(t.body, sample)}</p>
                  <p className="sub cnote">الرسالة النصية: {fillTemplate(t.sms, sample)}</p>
                </Glass>
                {admin && tDirty && (
                  <SaveBar
                    count={1}
                    sentence={<>قوالب الإشعارات والبوابة<span className="decsep" /><span className="sub">تُطبَّق على الرسائل التالية فور الحفظ</span></>}
                    onSave={() => { saveTemplates(tp, user.name); setTSaved(structuredClone(tp)) }}
                    onDiscard={() => setTp(structuredClone(tSaved))}
                  />
                )}
              </>
            )
          })()}

          {admin && dirty && (
            <SaveBar
              count={1}
              sentence={<>قنوات الإشعار<span className="decsep" /><span className="sub">تُطبَّق على الرسائل التالية فور الحفظ</span></>}
              onSave={() => { saveNotifyRules({ channels: d }, user.name); setSaved(structuredClone(d)) }}
              onDiscard={() => setD(saved)}
            />
          )}
        </div>
        <div className="dockslot" ref={dock.setEl} />
      </div>
      </DockSlotProvider>
    </AppLayout>
  )
}
