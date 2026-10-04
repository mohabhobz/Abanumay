import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateField, DateText, Empty, Glass, Head, Icon, KV, Money, MultiSelect, Num, Person, Tabs, Tag, icons } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ExportMenu } from '@/components/export'
import { type Sheet } from '@/lib/export'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { useQueryParams } from '@/hooks/useQueryParams'
import { nf } from '@/lib/format'
import { projectRows } from '@/data/mock/projects'
import { HOLDER_LABEL } from '@/data/holders'
import { capOf } from '@/data/approval'
import { readRole, roleByKey } from '@/data/roles'
import { APPROVAL_RULES } from '@/data/approvals/rules'
import {
  OUTCOME_SAY, SESSIONS, awaitingSession, levelCap, mayRecord, nextSessionId, saveSession, useApprovals,
  type Session,
} from '@/data/approvals/store'
import { liveBudgets } from '@/data/budget/store'
import { moneyOf, rootOf } from '@/data/mock/budgetTree'

/* The executive committee's and the board's desk (BPD-006 · BPD-007) · what's referred to them and
   waiting for a session, their sessions (planned, then closed and locked), and for the board the
   periodic oversight pack (7.1.importance-1). A session is the only place these two bodies decide:
   its agenda, each member's vote, the minutes, and the decision the votes carry. */

export default function BodyPage({ body }: { body: Session['body'] }) {
  useApprovals()
  const role = readRole()
  const me = roleByKey(role).name
  const may = mayRecord(body, role)
  const { values: v, set } = useQueryParams(['tab'])
  const TABS = [
    { slug: 'queue', label: 'بانتظار العرض' },
    { slug: 'sessions', label: 'الجلسات' },
    ...(body === 'board' ? [{ slug: 'pack', label: 'تقارير الإشراف' }] : []),
  ]
  const tab = TABS.some((t) => t.slug === v.tab) ? (v.tab as string) : 'queue'
  const name = HOLDER_LABEL[body]
  const waiting = awaitingSession(body)
  const planned = SESSIONS.filter((s) => s.body === body && s.state === 'planned')
  const onAgenda = (id: string) => planned.find((s) => s.items.some((i) => i.projectId === id))
  const sessions = SESSIONS.filter((s) => s.body === body).sort((a, b) => b.date.localeCompare(a.date))

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [members, setMembers] = useState<string[]>(body === 'committee' ? APPROVAL_RULES.committeeMembers : APPROVAL_RULES.boardMembers)
  const [pick, setPick] = useState<string[]>([])

  const create = () => {
    const id = nextSessionId(body)
    saveSession({ id, body, title: title.trim(), date, members, items: pick.map((projectId) => ({ projectId, votes: {} })), state: 'planned', by: me })
    setTitle(''); setDate(''); setPick([])
  }

  return (
    <AppLayout assistantContext={assistFor.page(name)}>
      <div className="viewstack">
        <div className="screen col">
          <header>
            <div>
              <h1 className="ptitle">{name}</h1>
              <p className="sub mt-1">
                {body === 'committee'
                  ? <>تعتمد حتى <Num>{capOf('committee')}</Num> · وما فوقه يُحال لمجلس الأمناء · القرار جماعي في جلسة بتصويت ومحضر</>
                  : 'أعلى جهة اعتماد · القرار في جلسة بتصويت ومحضر معتمد'}
              </p>
            </div>
            {!may && <Tag tone="mute">يسجّل الجلسات {(body === 'committee' ? APPROVAL_RULES.committeeBy : APPROVAL_RULES.boardBy).map((k) => roleByKey(k).title).join(' أو ')}</Tag>}
          </header>

          <Tabs items={TABS} active={tab} onChange={(x) => set({ tab: x === 'queue' ? undefined : x })} />

          {tab === 'queue' && (
            <>
              <Glass className="tblcard">
                <Head title="المشاريع المحالة" meta={<span className="sub"><Num>{waiting.length}</Num> مشروع</span>} />
                {waiting.length === 0 ? <Empty title="لا مشاريع محالة الآن." note={`تصل المشاريع هنا بإحالة ${body === 'committee' ? 'المدير التنفيذي' : 'اللجنة التنفيذية'}.`} /> : (
                  <div className="tblwrap">
                    <table className="tbl">
                      <thead><tr><th>المشروع</th><th>الجهة</th><th className="n">المبلغ</th><th>الحد</th><th>الجلسة</th></tr></thead>
                      <tbody>
                        {waiting.map((p) => {
                          const s = onAgenda(p.id)
                          return (
                            <tr key={p.id}>
                              <td><Link className="lnk" to={ROUTES.projectTab(p.id, 'approval')}>{p.name}</Link></td>
                              <td className="trim1">{p.entityName}</td>
                              <td className="n"><Money sm>{p.amountRequested}</Money></td>
                              <td>{p.amountRequested > levelCap(body) ? <Tag tone="warn">فوق حدها · يُحال</Tag> : <Tag tone="ok">ضمن حدها</Tag>}</td>
                              <td>{s ? <Link className="lnk" to={ROUTES.approvalSession(s.id)}>{s.title} · <DateText>{s.date}</DateText></Link> : <span className="sub">لم يُدرج بعد</span>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Glass>
              {may && (
                <Glass>
                  <Head title="جلسة جديدة" meta={<span className="sub"><bdi>{body === 'committee' ? '6.3.1' : '7.3.1'}</bdi> · الاجتماع الدوري</span>} />
                  <div className="regfields">
                    <label className="regf regf-w">
                      <span className="lb">عنوان الجلسة<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <span className="fld"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={body === 'committee' ? 'الاجتماع الدوري للجنة التنفيذية' : 'اجتماع مجلس الأمناء'} aria-label="عنوان الجلسة" /></span>
                    </label>
                    <label className="regf">
                      <span className="lb">الموعد<b className="regf-r" aria-label="إلزامي">*</b></span>
                      <DateField value={date} onChange={setDate} label="موعد الجلسة" />
                    </label>
                    <label className="regf">
                      <span className="lb">الأعضاء</span>
                      <MultiSelect label="الأعضاء" all="اختر الأعضاء" people values={members} options={(body === 'committee' ? APPROVAL_RULES.committeeMembers : APPROVAL_RULES.boardMembers).map((m) => ({ value: m, label: m }))} onChange={setMembers} />
                    </label>
                  </div>
                  <h3 className="stdy-h mt-3">جدول الأعمال</h3>
                  <ul className="apv-list">
                    {waiting.filter((p) => !onAgenda(p.id)).map((p) => (
                      <li key={p.id}>
                        <label className="bchk-i">
                          <input type="checkbox" checked={pick.includes(p.id)} onChange={(e) => setPick((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} />
                          <span><b>{p.name}</b><span className="sub"><Money sm>{p.amountRequested}</Money> · {p.entityName}</span></span>
                        </label>
                      </li>
                    ))}
                    {waiting.every((p) => onAgenda(p.id)) && <li className="sub">كل المحال مدرج على جلسة قائمة · تُنشأ الجلسة وتُضاف إليها المشاريع لاحقًا.</li>}
                  </ul>
                  <div className="regfoot">
                    <span className="decsent">{members.length < APPROVAL_RULES.quorum ? `النصاب ${nf.format(APPROVAL_RULES.quorum)} أعضاء` : `${nf.format(members.length)} عضو · ${nf.format(pick.length)} مشروع`}</span>
                    <span className="pc-sp" />
                    <button className="btn btn-p" disabled={!title.trim() || !date || members.length < APPROVAL_RULES.quorum} onClick={create}>
                      <Icon name={icons.plus} size="sm" />أنشئ الجلسة
                    </button>
                  </div>
                </Glass>
              )}
            </>
          )}

          {tab === 'sessions' && (
            <Glass className="tblcard">
              <Head title="الجلسات" meta={<span className="sub"><Num>{sessions.length}</Num> جلسة</span>} />
              <ul className="eprq">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link className="eprq-r well" to={ROUTES.approvalSession(s.id)}>
                      <Icon name={icons.users} size="sm" />
                      <span className="eprq-b">
                        <b>{s.title}</b>
                        <span className="sub"><DateText>{s.date}</DateText> · <Num>{s.items.length}</Num> مشروع · <Num>{s.members.length}</Num> عضو</span>
                      </span>
                      <span className="pc-sp" />
                      <Tag tone={s.state === 'closed' ? 'mute' : 'warn'}>{s.state === 'closed' ? 'مقفلة' : 'مجدولة'}</Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            </Glass>
          )}

          {tab === 'pack' && <BoardPack />}
        </div>
      </div>
    </AppLayout>
  )
}

/** The board's periodic oversight pack · what was approved, what waits, what passed which cap, and
    the budgets' use · one export ready for the meeting (7.1.importance-1) */
function BoardPack() {
  const year = '2026'
  const approved = projectRows.filter((p) => p.supportStatus === 'معتمد' && (p.decidedAt ?? '').startsWith(year))
  const pending = projectRows.filter((p) => p.stage === 'دراسة المشروع' && p.holder && p.holder !== 'supervisor')
  const above = pending.filter((p) => p.amountRequested > levelCap('exec'))
  const decided = SESSIONS.filter((s) => s.body === 'board').flatMap((s) => s.items.filter((i) => i.outcome).map((i) => ({ s, i })))
  const budgets = liveBudgets().map((d) => { const r = rootOf(d.nodes); return { d, m: r ? moneyOf(d.nodes, r.id) : undefined } })
  const sheet: Sheet = {
    file: 'abanumay-board-pack',
    title: 'حزمة مجلس الأمناء · تقرير الإشراف الدوري',
    headers: ['البند', 'العدد', 'القيمة'],
    rows: [
      ['مشاريع اعتُمدت هذا العام', String(approved.length), String(approved.reduce((a, p) => a + p.amountGranted, 0))],
      ['مشاريع في مسار الاعتماد', String(pending.length), String(pending.reduce((a, p) => a + p.amountRequested, 0))],
      ['منها فوق حد المدير التنفيذي', String(above.length), String(above.reduce((a, p) => a + p.amountRequested, 0))],
      ...budgets.map(({ d, m }) => [`${d.name ?? d.id} · المصروف من المخصص`, '', `${m?.paid ?? 0} / ${m?.allocated ?? 0}`]),
    ],
  }
  return (
    <>
      <div className="ftool-r"><div className="ftool-f" /><div className="ftool-a"><ExportMenu sheet={sheet} note={sheet.title} /></div></div>
      <Glass>
        <Head title="ملخص المحفظة" meta={<span className="sub">سنة <span className="num">{year}</span></span>} />
        <KV rows={[
          { k: 'اعتُمد هذا العام', v: <><Num>{approved.length}</Num> مشروع · <Money sm>{approved.reduce((a, p) => a + p.amountGranted, 0)}</Money></> },
          { k: 'في مسار الاعتماد', v: <><Num>{pending.length}</Num> مشروع · <Money sm>{pending.reduce((a, p) => a + p.amountRequested, 0)}</Money></> },
          { k: 'فوق حد المدير التنفيذي', v: <><Num>{above.length}</Num> مشروع</> },
          { k: 'قرارات المجلس المسجّلة', v: <Num>{decided.length}</Num> },
        ]} />
      </Glass>
      <Glass className="tblcard">
        <Head title="استخدام الميزانيات المعتمدة" />
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>الميزانية</th><th className="n">المخصص</th><th className="n">المحجوز</th><th className="n">المصروف</th><th className="n">المتاح</th></tr></thead>
            <tbody>
              {budgets.map(({ d, m }) => (
                <tr key={d.id}>
                  <td><Link className="lnk" to={ROUTES.budgetDoc(d.id)}>{d.name ?? d.id}</Link></td>
                  <td className="n"><Money sm>{m?.allocated ?? 0}</Money></td>
                  <td className="n"><Money sm>{m?.held ?? 0}</Money></td>
                  <td className="n"><Money sm>{m?.paid ?? 0}</Money></td>
                  <td className="n"><Money sm>{m?.available ?? 0}</Money></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Glass>
      <Glass>
        <Head title="ما ينتظر المجلس" />
        {pending.filter((p) => p.holder === 'board').length === 0 ? <p className="sub cnote">لا مشاريع عند المجلس الآن.</p> : (
          <ul className="apv-list">
            {pending.filter((p) => p.holder === 'board').map((p) => (
              <li key={p.id}><span className="apv-t"><Link className="lnk" to={ROUTES.projectTab(p.id, 'approval')}><b>{p.name}</b></Link><span className="sub"><Money sm>{p.amountRequested}</Money> · {p.owner ? <Person name={p.owner} /> : 'بلا مشرف'}</span></span></li>
            ))}
          </ul>
        )}
        {decided.length > 0 && (
          <ul className="apv-list">
            {decided.map(({ s, i }) => <li key={`${s.id}-${i.projectId}`}><span className="apv-t"><b>{projectRows.find((p) => p.id === i.projectId)?.name}</b><span className="sub">{s.title} · {i.outcome ? OUTCOME_SAY[i.outcome] : ''}</span></span></li>)}
          </ul>
        )}
      </Glass>
    </>
  )
}
