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
] as const
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
                            <td><Link className="tlink" to={m.notice.href}>{m.notice.title}</Link><div className="sub trim1">{TOPIC_SAY[m.notice.topic]} · {m.notice.context}</div></td>
                            <td><span className="rowf gp-2"><Who name={m.notice.to} /><span className="sub">{AUDIENCE_SAY[m.audience]}</span></span></td>
                            <td><Tag tone={m.channel === 'app' ? 'mute' : 'teal'}>{CHANNEL_SAY[m.channel]}</Tag></td>
                            <td className="sub"><bdi>{m.channel === 'app' ? 'صندوق الإشعارات' : mask(m.address)}</bdi></td>
                            <td><Tag tone={m.state === 'sent' ? 'ok' : 'no'}>{m.state === 'sent' ? 'أُرسلت' : 'لا عنوان'}</Tag></td>
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
