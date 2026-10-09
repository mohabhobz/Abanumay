import { useMemo, useState } from 'react'
import { readAllocation } from '@/data/shared/ai'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Blockers, DateField, BackTo, Empty, FieldSelect, Glass, Head, Icon, icons, KV, Money, Mono, MultiSelect, Nil, Num,
  Face, Person, Riyal, Tag, DockWhy,
} from '@/components/ui'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, NOUN, nounAfter } from '@/lib/format'
import {
  BUDGET_STATE_SAY, KIND_SAY, budgetEditable, budgetTone, cascadeActive, childrenOf, docSources, docTitle,
  fiscalYears, flatten, fundSources, hasChildren, levelOf, moneyOf, outlineOf, publicName, rootOf,
  sumChildren, treeIssues, yearById,
  type BudgetDoc, type BudgetNode, type SourceShare,
} from '@/data/mock/budgetTree'
import { APPROVAL_MATRIX } from '@/data/approval'
import { meOf, readRole } from '@/data/roles'
import {
  DIRECTIONS, decideBudget, deleteBlock, directionById, docOf, eventsOf, headIssues, mayAct, nextDocId,
  holdSplit, ownersOf, saveBudget, shareSay, sourceName, stepOf, submitBudget, useBudget, whoActs,
} from '@/data/budget/store'
import { BUDGET_RULES, LEVEL_SAY, type Level } from '@/data/budget/rules'
import { NodeModal } from './doc/NodeModal'
import { LineActModal } from './doc/LineActModal'
import { FlowCard, NoteModal } from './doc/DocFlow'
import { DocRequests, LedgerCard } from './doc/DocLedger'

/* Budget - create, edit, review and run, one screen.

   Note: the screen has two parts, a pattern repeated throughout the system: a header holding the
   fields that identify the record, and below it the line items. Applied here as a general rule for
   any screen with detail, matching the same structure as disbursement orders and agreement payment
   schedules.

   Note: the header constrains the items, not just fields sitting above them. The root item takes
   its amount from the header automatically, so changing the amount up top makes every total below
   it wrong instantly - and the rules state this directly instead of letting the user discover it on
   submission.

   Why the rules are shown rather than enforced: keep the options available so the user can choose,
   and surface an error message - don't hide "sub" from the first item; let them choose and then
   tell them what's wrong and why. Hiding it keeps the user from learning the structure; the message
   teaches it. The panel next to the tree shows every note with the source of each rule.

   The budget's life (BPD-001) runs on this same screen: prepared and saved (1.2.1–1.2.7), sent to
   the grants manager (1.2.8), approved forward or returned by the grants manager, finance and the
   executive director in turn (1.2.9–1.2.11), and active once approved (1.2.12). Only a draft or a
   returned budget is editable; an approved one keeps its structure and changes through operation
   requests, while its lines can still be turned off and its domains assigned. Each step is written
   to the budget's history (1.2.13) and every money change to its ledger (1.4.5). */

type Draft = BudgetDoc

const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

const BLANK: Draft = {
  id: '',
  name: '',
  description: '',
  yearId: '',
  sourceCode: '',
  sources: [],
  directionIds: [],
  from: '',
  to: '',
  total: 0,
  state: 'draft',
  nodes: [],
}

const STEP_SAY = {
  manager: { ok: 'وافق وأحِل إلى الإدارة المالية', back: 'أعد إلى المُعِدّ' },
  finance: { ok: 'وافق وأحِل إلى المدير التنفيذي', back: 'أعد إلى مدير المنح' },
  exec: { ok: 'اعتمد الميزانية وفعّلها', back: 'أعد إلى الإدارة المالية' },
} as const

export default function BudgetDocPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ver = useBudget()
  const role = readRole()
  const me = meOf(role)

  /* `?line=` comes from "view the budget document" in the project decision step · the row with
     that id is marked, and the hash scrolls to it. */
  const [query] = useSearchParams()
  const focus = query.get('line') ?? ''
  const existing = id ? docOf(id) : undefined
  const missing = Boolean(id) && !existing

  const canPrepare = mayAct('prepare', role)
  const editable = (!existing || budgetEditable(existing.state)) && canPrepare
  const [draft, setDraft] = useState<Draft>(() => (existing ? structuredClone(existing) : structuredClone(BLANK)))
  /* Read-only states read the live record, so a decision taken elsewhere shows at once */
  const doc: Draft = editable ? draft : existing ?? draft
  const setDoc = (f: (d: Draft) => Draft) => setDraft((d) => f(d))

  const [shut, setShut] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<{ edit: string | null; under: string | null } | null>(null)
  const [act, setAct] = useState<BudgetNode | null>(null)
  const [decide, setDecide] = useState<'ok' | 'back' | null>(null)
  const [flash, setFlash] = useState('')

  const nodes = doc.nodes
  const root = rootOf(nodes)
  const sources = docSources(doc)
  const many = sources.length > 1
  const head = useMemo(() => { void ver; return headIssues({ ...doc, id: doc.id || 'new' }) }, [doc, ver])
  const issues = useMemo(() => (doc.yearId ? treeIssues({ ...doc, id: doc.id || 'new' }) : []), [doc])
  const headReady = Boolean(doc.yearId) && doc.total > 0 && sources.length > 0
  const canSubmit = head.length === 0 && issues.length === 0 && nodes.length > 0
  const rows = useMemo(() => flatten(nodes, null, shut), [nodes, shut])
  const live = existing?.state === 'approved'
  const step = existing ? stepOf(existing.state) : null
  const myStep = step === 'manager' || step === 'finance' || step === 'exec' ? (mayAct(step, role) ? step : null) : null
  const mayStatus = live && mayAct('status', role)

  const toggle = (nid: string) =>
    setShut((s) => {
      const next = new Set(s)
      if (next.has(nid)) next.delete(nid)
      else next.add(nid)
      return next
    })

  /* The year brings its range · and the single-source budget's amount follows the total */
  const setYear = (v: string) => {
    const y = yearById(v)
    setDoc((d) => ({ ...d, yearId: v, from: y?.from ?? d.from, to: y?.to ?? d.to }))
  }
  const setSources = (next: SourceShare[]) =>
    setDoc((d) => {
      const fixed = next.length === 1 ? [{ ...next[0], amount: d.total }] : next
      return { ...d, sources: fixed, sourceCode: fixed[0]?.code ?? '' }
    })
  const setTotal = (value: number) =>
    setDoc((d) => ({
      ...d,
      total: value,
      sources: (d.sources?.length ?? 0) === 1 ? [{ ...d.sources![0], amount: value }] : d.sources,
      /* The root moves with the header - leaving its old value would put the error in two places,
         and the list would report the same cause twice. */
      nodes: d.nodes.map((x) => (x.parentId === null ? { ...x, allocated: value, available: value } : x)),
    }))

  const saveNode = (node: BudgetNode) =>
    setDoc((d) => {
      const list = d.nodes.some((x) => x.id === node.id)
        ? d.nodes.map((x) => (x.id === node.id ? node : x))
        : [...d.nodes, node]
      const next = list.map((x) => ({ ...x }))
      /* Off carries down; on brings back what this line turned off (1.4.39) */
      const before = d.nodes.find((x) => x.id === node.id)
      if (before && before.active !== node.active) {
        const self = next.find((x) => x.id === node.id)!
        self.active = !node.active
        cascadeActive(next, node.id, node.active)
      } else if (!before && !node.active) cascadeActive(next, node.id, false)
      return { ...d, nodes: next }
    })

  /* Remove a line · blocked while it carries children, projects or movements (1.4.19) */
  const removeNode = (nid: string) => setDoc((d) => ({ ...d, nodes: d.nodes.filter((x) => x.id !== nid) }))

  const setAmount = (nid: string, value: number) =>
    setDoc((d) => ({ ...d, nodes: d.nodes.map((x) => (x.id === nid ? { ...x, allocated: value, available: value } : x)) }))

  const persist = (send: boolean) => {
    const theId = doc.id || nextDocId(doc.yearId)
    const rec: BudgetDoc = { ...doc, id: theId, sourceCode: sources[0]?.code ?? '', sources }
    saveBudget(rec, me)
    if (send) submitBudget(theId, me)
    setDraft(structuredClone(docOf(theId) ?? rec))
    setFlash(send ? 'أُرسلت إلى مدير المنح للمراجعة' : 'حُفظت المسودة')
    if (!id) navigate(ROUTES.budgetDoc(theId), { replace: true })
  }

  if (missing) {
    return (
      <AppLayout assistantContext={assistFor.page('الميزانية')}>
        <div className="viewstack">
          <div className="screen col">
            <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />
            <Glass>
              <Empty
                title="الميزانية غير موجودة."
                note="ربما يكون الرابط قديمًا · ولا تُحذف الميزانية ما دامت عليها مشاريع."
                actions={<button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>ارجع إلى الميزانية</button>}
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const title = existing ? docTitle(existing) : doc.name?.trim() || 'ميزانية جديدة'
  const ro = !editable
  const dirOpts = DIRECTIONS.filter((d) => d.active || doc.directionIds?.includes(d.id)).map((d) => ({ value: d.id, label: d.name }))

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack hasdock">
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                {doc.description?.trim() || <>للميزانية سنة مالية ومصدر تمويل أو أكثر · والبنود شجرة، والصرف يكون على آخر مستوياتها</>}
              </p>
            </div>
            <Tag tone={budgetTone(doc.state)}>{BUDGET_STATE_SAY[doc.state]}</Tag>
          </header>

          {existing?.state === 'returned' && eventsOf(existing.id)[0]?.note && (
            <Glass>
              <Head title="ملاحظات الإعادة" meta={<Tag tone="ret">للاستكمال</Tag>} />
              <p className="sub cnote">«{eventsOf(existing.id)[0].note}» · <Person name={eventsOf(existing.id)[0].by} /></p>
            </Glass>
          )}

          <div className="g2">
            <div className="col">
              {/* Section 1 - header */}
              <Glass>
                <Head title="بيانات الميزانية" meta={<span className="sub">القسم الأول · ويحكم البنود التي تحته</span>} />
                <div className="regfields">
                  <label className="regf regf-w">
                    <span className="lb">اسم الميزانية<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <input disabled={ro} value={doc.name ?? ''} onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))} placeholder="مثال: ميزانية المنح 2027" aria-label="اسم الميزانية" />
                    </span>
                    <span className="sub regf-h">لكل ميزانية اسمها · ويمكن أكثر من ميزانية مستقلة في السنة نفسها</span>
                  </label>

                  <label className="regf regf-w">
                    <span className="lb">تعريف الميزانية</span>
                    <span className="fld fld-a">
                      <textarea rows={2} disabled={ro} value={doc.description ?? ''} onChange={(e) => setDoc((d) => ({ ...d, description: e.target.value }))} aria-label="تعريف الميزانية" />
                    </span>
                  </label>

                  <label className="regf">
                    <span className="lb">السنة المالية<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <FieldSelect
                      value={doc.yearId}
                      label="السنة المالية"
                      disabled={ro}
                      options={fiscalYears.map((y) => ({ value: y.id, label: y.name }))}
                      onChange={setYear}
                    />
                    <span className="sub regf-h">تُعرَّف في الإعدادات، ويُملأ مداها تلقائيًا</span>
                  </label>

                  <label className="regf">
                    <span className="lb">المبلغ الإجمالي<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <input type="text" inputMode="numeric" disabled={ro} value={doc.total ? nf.format(doc.total) : ''} onChange={(e) => setTotal(digits(e.target.value))} aria-label="المبلغ الإجمالي" />
                      <Riyal />
                    </span>
                    <span className="sub regf-h">يأخذه الجذر كاملًا</span>
                  </label>

                  <label className="regf">
                    <span className="lb">من تاريخ</span>
                    <DateField disabled={ro} value={doc.from} onChange={(x) => setDoc((d) => ({ ...d, from: x }))} label="من تاريخ" />
                  </label>

                  <label className="regf">
                    <span className="lb">إلى تاريخ</span>
                    <DateField disabled={ro} value={doc.to} onChange={(x) => setDoc((d) => ({ ...d, to: x }))} label="إلى تاريخ" min={doc.from || undefined} />
                  </label>

                  <label className="regf regf-w">
                    <span className="lb">التوجهات الاستراتيجية<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <MultiSelect
                      all="اختر التوجهات"
                      wide
                      disabled={ro}
                      values={doc.directionIds ?? []}
                      options={dirOpts}
                      onChange={(v) => setDoc((d) => ({ ...d, directionIds: v }))}
                    />
                    <span className="sub regf-h">الأهداف والتوجهات التي تُبنى عليها الميزانية · تُعرَّف في الإعدادات</span>
                  </label>
                </div>

                {/* Funding sources · one or more, each with its amount (1.2.2 · 1.4.4) */}
                <h3 className="stdy-h mt-3">مصادر التمويل</h3>
                <ul className="bgsrc">
                  {sources.map((s, i) => (
                    <li key={`${s.code}-${i}`}>
                      <FieldSelect
                        value={s.code}
                        label={`مصدر التمويل ${i + 1}`}
                        disabled={ro}
                        options={fundSources.filter((f) => f.code === s.code || !sources.some((x) => x.code === f.code)).map((f) => ({ value: f.code, label: f.name }))}
                        onChange={(v) => setSources(sources.map((x, j) => (j === i ? { ...x, code: v } : x)))}
                      />
                      {many && (
                        <span className="fld">
                          <input type="text" inputMode="numeric" disabled={ro} value={s.amount ? nf.format(s.amount) : ''} onChange={(e) => setSources(sources.map((x, j) => (j === i ? { ...x, amount: digits(e.target.value) } : x)))} aria-label={`مبلغ ${sourceName(s.code)}`} />
                          <Riyal />
                        </span>
                      )}
                      {!ro && sources.length > 1 && (
                        <button className="btn btn-ghost btn-sm" aria-label={`احذف ${sourceName(s.code)}`} title="احذف المصدر" onClick={() => setSources(sources.filter((_, j) => j !== i))}>
                          <Icon name={icons.close} size="sm" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {!ro && sources.length < fundSources.length && (
                  <button
                    className="btn btn-2 btn-sm"
                    onClick={() => {
                      const free = fundSources.find((f) => !sources.some((x) => x.code === f.code))
                      if (free) setSources([...sources, { code: free.code, amount: sources.length ? 0 : doc.total }])
                    }}
                  >
                    <Icon name={icons.plus} size="sm" />
                    {sources.length ? 'أضف مصدرًا آخر' : 'اختر مصدر التمويل'}
                  </button>
                )}
                {many && (
                  <p className="sub cnote">
                    مجموع المصادر <Money sm>{sources.reduce((a, x) => a + x.amount, 0)}</Money> من <Money sm>{doc.total}</Money> · ويوزَّع كل بند على هذه المصادر.
                  </p>
                )}
              </Glass>

              {/* Rules, approvals and limits · in the main column, the end column is the assistant's alone */}
              {/* Rules - shown, not enforced · only while the budget can still change */}
              {editable && <Blockers
                items={[
                  ...head.map((t) => ({ text: t, why: 'بيانات الميزانية' })),
                  ...issues.map((i) => ({ text: i.text, why: i.why })),
                ]}
                empty={nodes.length === 0 && head.length === 0 ? 'الشجرة فاضية · أضف أول بند تحت الجذر، والتحقّق يبدأ من أول بند.' : undefined}
                ready="كل أب يساوي مجموع أبنائه، وكل بند في مكانه ومصدره · الميزانية جاهزة للإرسال."
              />}

              {existing && <FlowCard state={existing.state} events={eventsOf(existing.id)} />}

              <Glass>
                <Head title="حدود الاعتماد والصرف" meta={<Link className="lnk sub" to={`${ROUTES.budgetSettings}?tab=limits`}>الإعدادات</Link>} />
                <KV rows={(['manager', 'exec', 'committee', 'board'] as Level[]).map((l) => {
                  const a = APPROVAL_MATRIX.find((r) => r.key === l)?.upTo
                  const sp = BUDGET_RULES.spendCaps[l]
                  return {
                    k: LEVEL_SAY[l],
                    v: <span className="sub">اعتماد {a == null ? 'بلا حدّ' : <span className="num">{nf.format(a)}</span>} · صرف {sp == null ? 'بلا حدّ' : <span className="num">{nf.format(sp)}</span>}</span>,
                  }
                })} />
              </Glass>

              {!existing && (
                <Glass>
                  <Head title="كيف تُبنى الشجرة" />
                  <p className="sub cnote">يأخذ الجذر مبلغ الميزانية كاملًا · وتحته <b>رئيسي</b> (مسار ثم مجال) · وآخر الشجرة <b>فرعي</b> وهو الهدف.</p>
                  <p className="sub cnote">ومجموع الأبناء يساوي مخصص الأب في كل مستوى · فتغيير رقم في المستوى الأخير ينعكس صعودًا حتى الجذر.</p>
                  {/* Note: this sentence is the most important part of the screen - it explains why an
                      item can have a valid number and still not be actionable. */}
                  <p className="sub cnote"><b>الحجز والصرف على البنود الفرعية وحدها</b> · وما فوقها للتقارير، فالبند الذي تتبعه بنود لا يُصرف منه مباشرةً.</p>
                  <p className="sub cnote">والمستويات مفتوحة · ثلاثة أو خمسة، ما دام كل بند تابع لبند أعلى منه.</p>
                </Glass>
              )}
            </div>

            <AssistantAside
              title="مراجعة الميزانية"
              cta="راجع الميزانية"
              empty="كل أب يساوي مجموع أبنائه، وكل بند في مكانه ومصدره."
              readings={editable ? [
                ...head.map((t, i) => ({ id: `bd-h${i}`, kind: 'flag' as const, label: 'بيانات الميزانية', text: t, src: 'القسم الأول' })),
                ...issues.map((x, i) => ({ id: `bd-i${i}`, kind: 'flag' as const, label: 'البنود', text: x.text, src: x.why })),
                ...(doc.total > 0 ? [readAllocation(doc.total)] : []),
              ] : []}
            />
          </div>

          {/* Note: the tree sits outside the grid, deliberately. A table with depth indentation
              needs the full page width, not a column next to a card. */}
          <Glass className="tblcard">
            <Head
              title="بنود الميزانية"
              meta={<span className="sub"><Num>{nodes.length}</Num> {nounAfter(nodes.length, NOUN.line)} · الحجز والصرف على البنود الفرعية</span>}
            />

            {nodes.length === 0 ? (
              <Empty
                art={{ done: 0, total: 3 }}
                title="لا توجد بنود في الشجرة بعد."
                note={headReady ? 'أضف أول بند واختر نوعه · يأخذ أول بند المبلغ الإجمالي كاملًا.' : 'أكمل بيانات الميزانية أعلاه أولًا · يأخذ أول بند مبلغها.'}
                actions={editable ? (
                  /* "Add item", not "add the root item" - the choice is open, and the rule governs it. */
                  <button className="btn btn-p" disabled={!headReady} title={headReady ? 'أضف بندًا إلى الشجرة' : 'أكمل بيانات الميزانية أولًا'} onClick={() => setModal({ edit: null, under: null })}>
                    <Icon name={icons.plus} size="sm" />
                    أضف بندًا
                  </button>
                ) : undefined}
              />
            ) : (
              <>
                <div className="btree">
                  <div className="btree-h">
                    <span>البند</span>
                    <span>مستوى البند</span>
                    <span className="tnum">المبلغ المخصص</span>
                    <span className="tnum">المبلغ المحتجز</span>
                    <span className="tnum">الملتزم به</span>
                    <span className="tnum">المبلغ المدفوع</span>
                    <span className="tnum">المبلغ المتاح</span>
                    <span>الحالة</span>
                    <span />
                  </div>

                  {rows.map((x) => {
                    const kids = hasChildren(nodes, x.id)
                    const lvl = levelOf(nodes, x.id)
                    const bad = issues.some((i) => i.nodeId === x.id)
                    const out = outlineOf(nodes, x.id)
                    const m = moneyOf(nodes, x.id)
                    const sp = holdSplit(doc, x.id)
                    const block = x.parentId === null ? '' : deleteBlock(doc, x.id)
                    const owners = ownersOf(x)
                    const dir = x.directionId ? directionById(x.directionId) : undefined
                    return (
                      <div key={x.id} id={`line-${x.id}`} aria-current={x.id === focus ? 'true' : undefined} className={`btree-r${bad ? ' no' : ''}${x.active ? '' : ' off'}`}>
                        {/* Indentation via a class, not an inline variable. */}
                        <span className={`btree-n l${Math.min(lvl, 6)}`}>
                          {kids ? (
                            <button className="btree-x" onClick={() => toggle(x.id)} aria-label={shut.has(x.id) ? 'افتح البند' : 'اطوِ البند'} aria-expanded={!shut.has(x.id)}>
                              <Icon name={shut.has(x.id) ? icons.chevronDown : icons.chevronUp} size="sm" />
                            </button>
                          ) : (
                            <span className="btree-x" />
                          )}
                          {/* The page is what carries holding and disbursement, the folder is for reports. */}
                          <Icon name={kids ? icons.folder : icons.doc} size="sm" />
                          {out && <span className="btree-o num">{out}</span>}
                          <span className="btree-l" title={[x.sources?.length ? shareSay(x.sources) : '', dir?.name ?? ''].filter(Boolean).join(' · ') || undefined}>{x.label}</span>
                          {!x.showLabel && (
                            <span className="btree-hid" title="الاسم الداخلي مخفي عن الخارج"><Icon name={icons.eyeOff} size="sm" /></span>
                          )}
                          {x.alias && <span className="btree-al sub" title={`الظاهر للمستخدم: ${publicName(x)}`}>{x.alias}</span>}
                          {x.owners?.length ? <span className="btree-ow" title={`مشرف المجال: ${owners.join('، ')}`}><Face name={owners[0]} /></span> : null}
                        </span>

                        <span><Tag tone="mute">{KIND_SAY[x.kind]} · <Num>{lvl}</Num></Tag></span>

                        <span className="tnum" data-k="المخصص">
                          {x.parentId === null || ro ? (
                            <span className="num">{nf.format(x.allocated)}</span>
                          ) : (
                            <input className="btree-a num" type="text" inputMode="numeric" value={x.allocated ? nf.format(x.allocated) : ''} onChange={(e) => setAmount(x.id, digits(e.target.value))} aria-label={`مخصص ${x.label}`} />
                          )}
                        </span>
                        {/* Held, committed and paid live on the leaf; a parent shows its children's
                            sums, and available is allocated − held − committed − paid. An inactive line
                            keeps them (1.4.38) · it only stops taking new projects. */}
                        {/* 1.4.41 · the held figure split by stage · initial while the project climbs the path */}
                        <span className="tnum" data-k="المحتجز" title={sp.initial ? `مبدئي ${nf.format(sp.initial)} · نهائي ${nf.format(sp.final)}` : undefined}>
                          <Num>{m.held}</Num>
                          {sp.initial > 0 && <span className="sub btree-hs">مبدئي <Num>{sp.initial}</Num></span>}
                        </span>
                        <span className="tnum" data-k="الملتزم به">{m.committed ? <Num>{m.committed}</Num> : <Nil />}</span>
                        <span className="tnum" data-k="المدفوع"><Num>{m.paid}</Num></span>
                        <span className="tnum" data-k="المتاح">{x.active ? <Num>{m.available}</Num> : <Nil />}</span>

                        <span>
                          <Tag tone={x.active ? 'ok' : 'mute'}>{x.active ? 'نشط' : x.offBy ? 'موقوف مع أبيه' : 'غير نشط'}</Tag>
                        </span>

                        <span className="btree-act">
                          {editable ? (
                            <>
                              <button className="btn btn-ghost btn-sm" title={`عدّل ${x.label}`} aria-label={`عدّل ${x.label}`} onClick={() => setModal({ edit: x.id, under: x.parentId })}>
                                <Icon name={icons.edit} size="sm" />
                              </button>
                              {x.kind !== 'sub' ? (
                                <button className="btn btn-ghost btn-sm" title={`أضف بندًا تحت ${x.label}`} aria-label={`أضف بندًا تحت ${x.label}`} onClick={() => setModal({ edit: null, under: x.id })}>
                                  <Icon name={icons.plus} size="sm" />
                                </button>
                              ) : <span className="act-slot" aria-hidden="true" />}
                              {x.parentId === null ? <span className="act-slot" aria-hidden="true" /> : (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={Boolean(block)}
                                  title={block || 'احذف البند'}
                                  aria-label={block ? `لا يُحذف ${x.label} · ${block}` : `احذف ${x.label}`}
                                  onClick={() => removeNode(x.id)}
                                >
                                  <Icon name={icons.close} size="sm" />
                                </button>
                              )}
                            </>
                          ) : live && x.parentId !== null && (mayStatus || mayAct('status', role) || canPrepare) ? (
                            <button className="btn btn-ghost btn-sm" title={`إجراء على ${x.label}`} aria-label={`إجراء على ${x.label}`} onClick={() => setAct(x)}>
                              <Icon name={icons.dots} size="sm" />
                            </button>
                          ) : null}
                        </span>
                      </div>
                    )
                  })}

                  {root && (() => {
                    /* Totals row · the sums of the root's direct children, so a gap against the root
                       row above reads in the same column. */
                    const top = childrenOf(nodes, root.id).map((k) => moneyOf(nodes, k.id))
                    const t = (f: keyof typeof top[number]) => top.reduce((a, k) => a + k[f], 0)
                    return (
                      <div className="btree-r btree-f">
                        <span className="btree-n" title="مجموع بنود المستوى الأول"><b>الإجمالي</b></span>
                        <span />
                        <span className="tnum" data-k="المخصص"><b><Num>{t('allocated')}</Num></b></span>
                        <span className="tnum" data-k="المحتجز"><b><Num>{t('held')}</Num></b></span>
                        <span className="tnum" data-k="الملتزم به"><b><Num>{t('committed')}</Num></b></span>
                        <span className="tnum" data-k="المدفوع"><b><Num>{t('paid')}</Num></b></span>
                        <span className="tnum" data-k="المتاح"><b><Num>{t('available')}</Num></b></span>
                        <span />
                        <span />
                      </div>
                    )
                  })()}
                </div>

                {root && (
                  <p className="sub cnote">
                    مجموع أبناء الجذر <Mono>{nf.format(sumChildren(nodes, root.id))}</Mono> ومخصصه <Mono>{nf.format(root.allocated)}</Mono> ·{' '}
                    {sumChildren(nodes, root.id) === root.allocated ? 'متوازن' : 'يلزم تسوية الفرق قبل الإرسال'}
                    {many && <> · مصادره {shareSay(sources)}</>}
                  </p>
                )}
              </>
            )}
          </Glass>

          {existing && existing.state === 'approved' && (
            <>
              <LedgerCard doc={existing} line={focus || undefined} />
              <DocRequests doc={existing} />
            </>
          )}
        </div>

        {/* Footer - by state and by role */}
        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {flash && existing ? <>{flash} · الحالة <b>{BUDGET_STATE_SAY[existing.state]}</b></>
                  : editable
                    ? <>
                        {headReady && root ? <>الإجمالي <Money>{doc.total}</Money></> : 'أكمل اسم الميزانية وسنتها ومصدرها ومبلغها'}
                        {headReady && nodes.length === 0
                          ? <><span className="decsep" /><span className="sub">أضف أول بند قبل الإرسال</span></>
                          : <DockWhy n={issues.length + head.length} noun={NOUN.note} />}
                      </>
                    : live ? <>معتمدة ومفعّلة · متاحة لربط المشاريع والحجز<span className="decsep" /><span className="sub">تتغيّر مبالغها بطلب عملية</span></>
                      : myStep ? <>بانتظار قرارك · <b>{STEP_SAY[myStep].ok}</b> أو إعادتها بملاحظة</>
                        : existing ? <>بانتظار <b>{whoActs(existing.state) || 'المُعِدّ'}</b></> : null}
              </span>
            </div>

            <div className="rowf gp-2">
              {editable && (
                <>
                  <button className="btn btn-2" disabled={!headReady || !doc.name?.trim()} title={headReady ? 'احفظ كمسودة' : 'أكمل بيانات الميزانية أولًا'} onClick={() => persist(false)}>
                    احفظ المسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!canSubmit}
                    title={head[0] ?? (issues.length ? `${issues.length} ملاحظة على الشجرة` : 'أرسل إلى مدير المنح')}
                    onClick={() => persist(true)}
                  >
                    أرسل إلى مدير المنح
                  </button>
                </>
              )}
              {myStep && existing && (
                <>
                  <button className="btn btn-p" onClick={() => setDecide('ok')}>{STEP_SAY[myStep].ok}</button>
                  <button className="btn btn-2" onClick={() => setDecide('back')}>{STEP_SAY[myStep].back}</button>
                </>
              )}
              {live && existing && (
                <Link className="btn btn-2" to={`${ROUTES.budgetOpNew}?doc=${existing.id}`}>
                  <Icon name={icons.redo} size="sm" />
                  طلب مناقلة أو تعزيز
                </Link>
              )}
              {!editable && !myStep && !live && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>ارجع إلى الميزانية</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && editable && (
        <NodeModal doc={doc} editId={modal.edit} under={modal.under} onClose={() => setModal(null)} onSave={saveNode} />
      )}
      {act && existing && (
        <LineActModal doc={existing} node={act} me={me} mayStatus={mayStatus} onClose={() => setAct(null)} />
      )}
      {decide && myStep && existing && (
        <NoteModal
          title={`${STEP_SAY[myStep][decide]} · ${docTitle(existing)}`}
          cta={STEP_SAY[myStep][decide]}
          tone={decide === 'ok' ? 'btn-p' : 'btn-2'}
          required={decide === 'back'}
          hint={decide === 'back' ? 'الإعادة بملاحظة توضّح المطلوب · تظهر للمُعِدّ في رأس الميزانية.' : undefined}
          onClose={() => setDecide(null)}
          onDone={(note) => { decideBudget(existing.id, decide === 'ok' ? 'approve' : 'return', note, me); setFlash(decide === 'ok' ? 'سُجّلت الموافقة' : 'أُعيدت') }}
        />
      )}
    </AppLayout>
  )
}
