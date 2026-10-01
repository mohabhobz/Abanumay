import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Blockers, DateField, BackTo, Empty, FieldSelect, Glass, Head, Icon, icons, Money, Mono, Nil, Num, Riyal, Tag, DockWhy,
} from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { ROUTES } from '@/app/routes'
import { assistFor } from '@/data/mock/assistant'
import { nf, NOUN, nounAfter } from '@/lib/format'
import {
  KIND_NOTE, KIND_SAY, KIND_UNDER, childrenOf, docTitle, fiscalYears,
  flatten, fundSources, hasChildren, kindFits, kindUnder, levelOf, moneyOf, outlineOf, pathOf,
  publicName, rootOf, sumChildren, treeIssues, yearById, yearSourceTaken,
  type BudgetDoc, type BudgetNode, type LineKind,
} from '@/data/mock/budgetTree'
import { allBudgets, budgetDocOf } from '@/data/mock/chain'

/* Budget - create and edit, one screen.

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

   Note: this reasoning used to be written here while the code beneath it did the opposite. The
   first version hid the "item type" and "parent item" fields entirely when the tree was empty,
   wrote `kind: 'main'` without checking the user's choice at all, and the button on the empty
   screen was labeled "add the root item" - an instruction, not a choice. So the principle sat in
   the header while the implementation contradicted it a hundred lines down - a principle stated
   without a check stays a good intention. Choice is now open from the first item, and the rule in
   `rootRule` is shown in the modal before saving. */

type Draft = Omit<BudgetDoc, 'id'> & { id?: string }

/**
 * Comma-formatted numbers in an input field - `type=number` doesn't add thousands separators, and a
 * number in the millions with no separators is easy to misread at a glance.
 */
const digits = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0

const BLANK: Draft = {
  yearId: '',
  sourceCode: '',
  from: '',
  to: '',
  total: 0,
  state: 'draft',
  nodes: [],
}

export default function BudgetDocPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  /* `?line=` comes from "view the budget document" in the project decision step · the row with
     that id is marked, and the hash scrolls to it. */
  const [query] = useSearchParams()
  const focus = query.get('line') ?? ''
  const existing = id ? budgetDocOf(id) : undefined
  const missing = Boolean(id) && !existing

  const [doc, setDoc] = useState<Draft>(() => (existing ? { ...existing } : { ...BLANK }))
  const [shut, setShut] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [under, setUnder] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  /* Modal fields. */
  const [nLabel, setNLabel] = useState('')
  const [nKind, setNKind] = useState<LineKind>('base')
  const [nAmount, setNAmount] = useState('')
  const [nParent, setNParent] = useState('')
  /* Display name, visibility, and activation. */
  const [nAlias, setNAlias] = useState('')
  const [nShow, setNShow] = useState(true)
  const [nActive, setNActive] = useState(true)
  /**
   * Note: the item being edited - `null` means add.
   *
   * The old version had a modal for adding only, and editing was an inline amount field in the row
   * - but the root item's amount comes from the header, so that field was hidden for it. The
   * result: the top-level item had no way to be edited at all - not its name, activation, or type.
   *
   * The fix isn't a third edit button; it's one modal for both: same fields, same rules, same
   * messages - otherwise any new rule would need to be written twice, and one copy would get
   * missed.
   */
  const [editId, setEditId] = useState<string | null>(null)
  /** The rule message that blocked adding - shown in the modal, not after saving. */
  const [blocked, setBlocked] = useState('')

  const nodes = doc.nodes
  const root = rootOf(nodes)
  const issues = useMemo(
    () => (doc.yearId ? treeIssues({ ...doc, id: doc.id ?? 'new' }) : []),
    [doc],
  )

  /* (year + source) can't repeat - the header's only rule. */
  const clash = useMemo(
    () =>
      doc.yearId && doc.sourceCode
        /* Validated against every budget, not just the fixture - otherwise (year + source) could
           pass while duplicating a seeded budget. */
        ? yearSourceTaken(allBudgets, doc.yearId, doc.sourceCode, doc.id)
        : undefined,
    [doc.yearId, doc.sourceCode, doc.id],
  )

  const headReady =
    Boolean(doc.yearId) && Boolean(doc.sourceCode) && doc.total > 0 && !clash
  const canSubmit = headReady && issues.length === 0 && nodes.length > 0

  const rows = useMemo(() => flatten(nodes, null, shut), [nodes, shut])

  const toggle = (nid: string) =>
    setShut((s) => {
      const next = new Set(s)
      if (next.has(nid)) next.delete(nid)
      else next.add(nid)
      return next
    })

  /** Opens the modal for adding - the parent is pre-selected if it came from a button inside a row. */
  const openAdd = (parentId: string | null) => {
    setEditId(null)
    setUnder(parentId)
    setNParent(parentId ?? '')
    setNLabel('')
    setNAlias('')
    setNShow(true)
    setNActive(true)
    setNAmount('')
    /* Note: the default type isn't inferred - the user can change it, and the rules will flag it if
       wrong. The default just saves a step. Order is top -> main -> sub, so a child's type follows
       its parent's. */
    const up = parentId ? nodes.find((x) => x.id === parentId) : undefined
    setNKind(nodes.length === 0 ? 'base' : kindUnder(up?.kind))
    setBlocked('')
    setOpen(true)
  }

  /** Opens the modal for editing - and this works on the top-level item like any other. */
  const openEdit = (nid: string) => {
    const x = nodes.find((k) => k.id === nid)
    if (!x) return
    setEditId(nid)
    setUnder(x.parentId)
    setNParent(x.parentId ?? '')
    setNLabel(x.label)
    setNAlias(x.alias ?? '')
    setNShow(x.showLabel)
    setNActive(x.active)
    setNAmount(String(x.allocated))
    setNKind(x.kind)
    setBlocked('')
    setOpen(true)
  }

  /**
   * Note: this condition fixes an earlier problem, where the code did exactly the opposite.
   *
   * The rule: keep the options available so users can choose, and show an error message. That
   * principle used to be written at the top of this file while the code below it hid the type and
   * parent fields on the first item and wrote `kind: 'main'` without checking the user's choice -
   * the file contradicted itself.
   *
   * Choice is now open from the first item, and the rule is shown before saving, not after: the
   * message appears in the modal and the add button is disabled with the reason written out, so
   * users learn the structure instead of the screen hiding it from them.
   */
  /**
   * The rule is shown before saving, not after.
   *
   * Note: it now applies across the whole hierarchy, not sub-items alone. The old version only
   * checked "sub with no parent" and "sub under a sub" - so a top-level item nested under a path
   * passed, and a main item with no parent passed too. The order top -> main -> sub means each type
   * has exactly one valid position, and the rule is measured from rank rather than a list of
   * hand-written cases.
   */
  const shapeRule = (
    kind: LineKind,
    parentId: string | null,
    show: boolean,
    alias: string,
  ): string => {
    if (!show && !alias.trim()) {
      return 'اسم البند مخفي عن الخارج · أدخل الاسم الظاهر للمستخدم حتى لا يظهر البند بلا اسم.'
    }

    const others = nodes.filter((x) => x.id !== editId)
    const up = parentId ? nodes.find((x) => x.id === parentId) : undefined

    if (kind === 'base') {
      if (parentId) return 'البند الأساسي هو الميزانية نفسها · لا يتبع أي بند.'
      const otherBase = others.find((x) => x.kind === 'base')
      if (otherBase) return `يوجد بند أساسي بالفعل («${otherBase.label}») · للميزانية بند أساسي واحد فقط.`
      return ''
    }

    if (!parentId) {
      return `يلزم أن يتبع البند من نوع «${KIND_SAY[kind]}» بندًا آخر · البند الذي لا يتبع أي بند نوعه أساسي.`
    }
    if (!up) return 'اختر البند الذي يتبعه.'
    if (!kindFits(kind, up.kind)) {
      return `لا يمكن وضع «${KIND_SAY[kind]}» تحت «${KIND_SAY[up.kind]}» · مكانه تحت ${KIND_UNDER[kind].map((k) => KIND_SAY[k]).join(' أو ')}.`
    }
    /* An item can't be its own parent or its own grandparent - possible during editing alone, and
       it would produce a tree with a closed loop. */
    if (editId) {
      if (parentId === editId) return 'لا يمكن أن يتبع البند نفسه.'
      let cur: string | null = parentId
      while (cur) {
        if (cur === editId) return 'لا يمكن أن يتبع البند أحد أبنائه.'
        cur = nodes.find((x) => x.id === cur)?.parentId ?? null
      }
    }
    return ''
  }

  const saveNode = () => {
    const parentId = nParent || null
    const stop = shapeRule(nKind, parentId, nShow, nAlias)
    if (stop) { setBlocked(stop); return }

    const amount = Number(nAmount) || 0
    /* The top-level item takes the budget amount from the header, not from the user. */
    const base = nKind === 'base'
    const alias = nAlias.trim() || undefined

    if (editId) {
      setDoc((d) => ({
        ...d,
        nodes: d.nodes.map((x) =>
          x.id === editId
            ? {
                ...x,
                label: nLabel.trim(),
                alias,
                showLabel: nShow,
                active: nActive,
                kind: nKind,
                parentId,
                allocated: base ? d.total : amount,
                /* Note: available can't exceed the new allocation - if the user lowers the
                   allocation, an available figure larger than it would claim money that doesn't
                   exist. */
                available: Math.min(x.available, base ? d.total : amount),
              }
            : x),
      }))
      setOpen(false)
      return
    }

    const node: BudgetNode = {
      id: `n-${Date.now()}`,
      label: nLabel.trim(),
      alias,
      showLabel: nShow,
      kind: nKind,
      parentId,
      allocated: base ? doc.total : amount,
      available: base ? doc.total : amount,
      active: nActive,
    }
    setDoc((d) => ({ ...d, nodes: [...d.nodes, node] }))
    setOpen(false)
  }

  const removeNode = (nid: string) => {
    /* Remove the item and all its descendants - not a delete from the record; this is still a draft
       that hasn't been submitted, and deletion after submission is blocked by dependents. */
    const kill = new Set<string>([nid])
    let grew = true
    while (grew) {
      grew = false
      for (const x of nodes) {
        if (x.parentId && kill.has(x.parentId) && !kill.has(x.id)) {
          kill.add(x.id)
          grew = true
        }
      }
    }
    setDoc((d) => ({ ...d, nodes: d.nodes.filter((x) => !kill.has(x.id)) }))
  }

  const setAmount = (nid: string, value: number) =>
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((x) =>
        x.id === nid ? { ...x, allocated: value, available: value } : x,
      ),
    }))

  const setTotal = (value: number) =>
    setDoc((d) => ({
      ...d,
      total: value,
      /* The root moves with the header - leaving its old value would put the error in two places,
         and the list would report the same cause twice. */
      nodes: d.nodes.map((x) =>
        x.parentId === null ? { ...x, allocated: value, available: value } : x,
      ),
    }))

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
                actions={
                  <button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>
                    ارجع إلى الميزانية
                  </button>
                }
              />
            </Glass>
          </div>
        </div>
      </AppLayout>
    )
  }

  const title = existing ? docTitle(existing) : 'ميزانية جديدة'
  /* Eligible parents - a sub-item can't sit under another sub-item (rule 4). */
  /* Eligible parents - whichever rank can be a parent for the selected type, excluding the item
     itself while editing. */
  const parents = nodes.filter((x) => x.id !== editId && kindFits(nKind, x.kind))

  return (
    <AppLayout assistantContext={assistFor.page(title)}>
      <div className="viewstack hasdock">
        {/* Note: `hasg2` is left off here - that class gives the grid's first column a sticky
            bottom margin, which is correct when the grid is the last thing on the page. Here the
            tree sits below it, so the margin turns into dead space between the data card and the
            table. */}
        <div className="screen col">
          <BackTo label="الميزانية" onClick={() => navigate(ROUTES.budget)} />

          <header>
            <div>
              <h1 className="ptitle">{title}</h1>
              <p className="sub mt-1">
                تُعرَّف الميزانية بـ<b>سنة مالية + مصدر تمويل</b> · والبنود شجرة،
                والصرف يكون على آخر مستوياتها
              </p>
            </div>
            {/* Page header - a neutral label. */}
            <Tag tone="mute">
              {doc.state === 'draft' ? 'مسودة' : 'مرسَلة'}
            </Tag>
          </header>

          <div className="g2">
            <div className="col">
              {/* Section 1 - header */}
              <Glass>
                <Head
                  title="بيانات الميزانية"
                  meta={<span className="sub">القسم الأول · ويحكم البنود التي تحته</span>}
                />
                <div className="regfields">
                  <label className="regf">
                    <span className="lb">السنة المالية<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <FieldSelect
                      value={doc.yearId}
                      label="السنة المالية"
                      options={fiscalYears.map((y) => ({ value: y.id, label: y.name }))}
                      onChange={(v) => {
                        const y = yearById(v)
                        setDoc((d) => ({ ...d, yearId: v, from: y?.from ?? d.from, to: y?.to ?? d.to }))
                      }}
                    />
                    {/* Note: the year brings its own range with it - the two dates below fill in on
                        their own and stay editable, since a quarterly budget within the fiscal year
                        is valid. */}
                    <span className="sub regf-h">تُعرَّف في الإعدادات، ويُملأ مداها تلقائيًا</span>
                  </label>

                  <label className="regf">
                    <span className="lb">مصدر التمويل<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <FieldSelect
                      value={doc.sourceCode}
                      label="مصدر التمويل"
                      options={fundSources.map((s) => ({ value: s.code, label: s.name }))}
                      onChange={(v) => setDoc((d) => ({ ...d, sourceCode: v }))}
                    />
                  </label>

                  <label className="regf">
                    <span className="lb">من تاريخ</span>
                    <DateField
                      value={doc.from}
                      onChange={(x) => setDoc((d) => ({ ...d, from: x }))}
                      label="من تاريخ"
                    />
                  </label>

                  <label className="regf">
                    <span className="lb">إلى تاريخ</span>
                    <DateField
                      value={doc.to}
                      onChange={(x) => setDoc((d) => ({ ...d, to: x }))}
                      label="إلى تاريخ"
                      min={doc.from || undefined}
                    />
                  </label>

                  <label className="regf">
                    <span className="lb">المبلغ الإجمالي<b className="regf-r" aria-label="إلزامي">*</b></span>
                    <span className="fld">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={doc.total ? nf.format(doc.total) : ''}
                        onChange={(e) => setTotal(digits(e.target.value))}
                        aria-label="المبلغ الإجمالي"
                      />
                      <Riyal />
                    </span>
                    <span className="sub regf-h">يأخذه الجذر كاملًا</span>
                  </label>
                </div>

                {/* The header's rule - validated in the field, not after submission. */}
                {clash && (
                  <p className="bad cnote">
                    <b>{yearById(doc.yearId)?.name}</b> لها ميزانية بالمصدر نفسه بالفعل
                    (<Mono>{clash.id}</Mono>) · لا يتكرر الجمع بين السنة ومصدر التمويل.
                    ويمكن إنشاء ميزانية للسنة نفسها بمصدر آخر.
                  </p>
                )}
              </Glass>

            </div>

            <div className="col">
              {/* Rules - shown, not enforced */}
              <Blockers
                items={issues.map((i) => ({ text: i.text, why: i.why }))}
                empty={nodes.length === 0 ? 'الشجرة فاضية · أضف أول بند تحت الجذر، والتحقّق يبدأ من أول بند.' : undefined}
                ready="كل أب يساوي مجموع أبنائه، وكل بند في مكانه · الشجرة جاهزة للإرسال."
              />

              <Glass>
                <Head title="كيف تُبنى الشجرة" />
                <p className="sub cnote">
                  يأخذ الجذر مبلغ الميزانية كاملًا · وتحته <b>رئيسي</b> (مسار ثم
                  مجال) · وآخر الشجرة <b>فرعي</b> وهو الهدف.
                </p>
                <p className="sub cnote">
                  ومجموع الأبناء يساوي مخصص الأب في كل مستوى · فتغيير رقم في
                  المستوى الأخير ينعكس صعودًا حتى الجذر.
                </p>
                {/* Note: this sentence is the most important part of the screen - it explains why
                    an item can have a valid number and still not be actionable. */}
                <p className="sub cnote">
                  <b>الحجز والصرف على البنود الفرعية وحدها</b> · وما فوقها للتقارير،
                  فالبند الذي تتبعه بنود لا يُصرف منه مباشرةً.
                </p>
                <p className="sub cnote">
                  والمستويات مفتوحة · ثلاثة أو خمسة، ما دام كل بند تابع لبند أعلى منه.
                </p>
              </Glass>
            </div>
          </div>

          {/* Note: the tree sits outside the grid, deliberately. It used to sit inside the main
              column, taking two thirds of the width, and the first column (item name) got truncated
              from the third level on - "education track" became "1 m...". A table with depth
              indentation needs the full page width, not a column next to a card. */}
              <Glass className="tblcard">
                <Head
                  title="بنود الميزانية"
                  meta={
                    <span className="sub">
                      <Num>{nodes.length}</Num> {nounAfter(nodes.length, NOUN.line)} · الحجز والصرف على البنود الفرعية
                    </span>
                  }
                />

                {nodes.length === 0 ? (
                  <Empty
                    art={{ done: 0, total: 3 }}
                    title="لا توجد بنود في الشجرة بعد."
                    note={
                      headReady
                        ? 'أضف أول بند واختر نوعه · يأخذ أول بند المبلغ الإجمالي كاملًا.'
                        : 'أكمل بيانات الميزانية أعلاه أولًا · يأخذ أول بند مبلغها.'
                    }
                    actions={
                      /* "Add item", not "add the root item" - the second label implied there was
                         only one choice, which isn't true: the choice is open, and the rule governs
                         it. */
                      <button
                        className="btn btn-p"
                        disabled={!headReady}
                        title={headReady ? 'أضف بندًا إلى الشجرة' : 'أكمل بيانات الميزانية أولًا'}
                        onClick={() => openAdd(null)}
                      >
                        <Icon name={icons.plus} size="sm" />
                        أضف بندًا
                      </button>
                    }
                  />
                ) : (
                  <>
                    <div className="btree">
                      <div className="btree-h">
                        <span>البند</span>
                        <span>مستوى البند</span>
                        <span className="tnum">المبلغ المخصص</span>
                        <span className="tnum">المبلغ المحتجز</span>
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
                        return (
                          <div
                            key={x.id}
                            id={`line-${x.id}`}
                            aria-current={x.id === focus ? 'true' : undefined}
                            className={`btree-r${bad ? ' no' : ''}${x.active ? '' : ' off'}`}
                          >
                            {/* Indentation via a class, not an inline variable - depth beyond six
                                takes the last step, since the eye can't tell the difference past
                                that. */}
                            <span className={`btree-n l${Math.min(lvl, 6)}`}>
                              {kids ? (
                                <button
                                  className="btree-x"
                                  onClick={() => toggle(x.id)}
                                  aria-label={shut.has(x.id) ? 'افتح البند' : 'اطوِ البند'}
                                  aria-expanded={!shut.has(x.id)}
                                >
                                  <Icon
                                    name={shut.has(x.id) ? icons.chevronDown : icons.chevronUp}
                                    size="sm"
                                  />
                                </button>
                              ) : (
                                <span className="btree-x" />
                              )}
                              {/* The folder and page icons aren't decorative: the page is what
                                  carries the reservation and disbursement, and the folder is for
                                  reports - the difference reads from the icon before a user tries
                                  it and gets stuck. */}
                              <Icon name={kids ? icons.folder : icons.doc} size="sm" />
                              {out && <span className="btree-o num">{out}</span>}
                              <span className="btree-l">{x.label}</span>
                              {/* Note: the public-facing name sits next to the internal one, not in
                                  its place. Whoever builds the tree needs to see both on the same
                                  line: the name they're working with, and the name the entity will
                                  actually read. A closed eye icon means the internal name is
                                  hidden. */}
                              {!x.showLabel && (
                                <span className="btree-hid" title="الاسم الداخلي مخفي عن الخارج">
                                  <Icon name={icons.eyeOff} size="sm" />
                                </span>
                              )}
                              {x.alias && (
                                <span className="btree-al sub" title={`الظاهر للمستخدم: ${publicName(x)}`}>
                                  {x.alias}
                                </span>
                              )}
                            </span>

                            <span>
                              <Tag tone="mute">
                                {KIND_SAY[x.kind]} · <Num>{lvl}</Num>
                              </Tag>
                            </span>

                            <span className="tnum" data-k="المخصص">
                              {/* The root's figure comes from the header, and any item with
                                  children must equal their sum - so editing here applies to both
                                  leaf items and parents, with the check written out. */}
                              {x.parentId === null ? (
                                <span className="num">{nf.format(x.allocated)}</span>
                              ) : (
                                <input
                                  className="btree-a num"
                                  type="text"
                                  inputMode="numeric"
                                  value={x.allocated ? nf.format(x.allocated) : ''}
                                  onChange={(e) => setAmount(x.id, digits(e.target.value))}
                                  aria-label={`مخصص ${x.label}`}
                                />
                              )}
                            </span>

                            {/* Held and paid live on the leaf; a parent shows its children's sums,
                                and available is always allocated − held − paid. */}
                            <span className="tnum" data-k="المحتجز">
                              {x.active ? <Num>{m.held}</Num> : <Nil />}
                            </span>
                            <span className="tnum" data-k="المدفوع">
                              {x.active ? <Num>{m.paid}</Num> : <Nil />}
                            </span>
                            <span className="tnum" data-k="المتاح">
                              {x.active ? <Num>{m.available}</Num> : <Nil />}
                            </span>

                            <span>
                              <Tag tone={x.active ? 'ok' : 'mute'}>
                                {x.active ? 'نشط' : 'غير نشط'}
                              </Tag>
                            </span>

                            <span className="btree-act">
                              {/* Note: editing applies to every item, including the top-level one.
                                  Editing used to be an inline amount field, and the top-level
                                  item's amount came from the header so that field was hidden for it
                                  - meaning the top-level item had no way to be edited at all: not
                                  its name, activation, or public-facing name. */}
                              <button
                                className="btn btn-ghost btn-sm"
                                title={`عدّل ${x.label}`}
                                aria-label={`عدّل ${x.label}`}
                                onClick={() => openEdit(x.id)}
                              >
                                <Icon name={icons.edit} size="sm" />
                              </button>
                              {/* A sub-item is the end of the tree, so there's no "add under it". */}
                              {x.kind !== 'sub' && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={`أضف بندًا تحت ${x.label}`}
                                  onClick={() => openAdd(x.id)}
                                >
                                  <Icon name={icons.plus} size="sm" />
                                </button>
                              )}
                              {/* Note: the cell stays reserved even when the action isn't available
                                  - otherwise "delete" would jump columns between a row that has
                                  "add under" and one that doesn't, and the icons wouldn't line up. */}
                              {x.kind === 'sub' && <span className="act-slot" aria-hidden="true" />}
                              {x.parentId === null && <span className="act-slot" aria-hidden="true" />}
                              {x.parentId !== null && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={kids ? 'احذف البند وكل ما تحته' : 'احذف البند'}
                                  onClick={() => removeNode(x.id)}
                                >
                                  <Icon name={icons.close} size="sm" />
                                </button>
                              )}
                            </span>
                          </div>
                        )
                      })}

                      {root && (() => {
                        /* Totals row · the sums of the root's direct children, so a gap against
                           the root row above reads in the same column. */
                        const top = childrenOf(nodes, root.id).filter((k) => k.active).map((k) => moneyOf(nodes, k.id))
                        const t = (f: keyof typeof top[number]) => top.reduce((a, k) => a + k[f], 0)
                        return (
                          <div className="btree-r btree-f">
                            <span className="btree-n" title="مجموع بنود المستوى الأول"><b>الإجمالي</b></span>
                            <span />
                            <span className="tnum" data-k="المخصص"><b><Num>{t('allocated')}</Num></b></span>
                            <span className="tnum" data-k="المحتجز"><b><Num>{t('held')}</Num></b></span>
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
                        مجموع أبناء الجذر <Mono>{nf.format(sumChildren(nodes, root.id))}</Mono> ومخصصه{' '}
                        <Mono>{nf.format(root.allocated)}</Mono> ·{' '}
                        {sumChildren(nodes, root.id) === root.allocated
                          ? 'متوازن'
                          : 'يلزم تسوية الفرق قبل الإرسال'}
                      </p>
                    )}
                  </>
                )}
              </Glass>
        </div>

        {/* Footer - save and submit */}
        <div className="decdock">
          <div className="chrome decbar payact">
            <div className="rowf gp-3 payact-w">
              <span className="decsent">
                {sent
                  ? <>أُرسلت · الحالة <b>مرسَلة</b></>
                  : doc.state === 'draft' && doc.id
                    ? <>حُفظت <b>كمسودة</b> · يمكن استكمالها في أي وقت</>
                    : <>
                        {headReady && root
                          ? <>الإجمالي <Money>{doc.total}</Money></>
                          : 'أكمل السنة ومصدر التمويل والمبلغ'}
                        {/* An empty tree is also a reason to disable - the button used to be grayed
                            out with no explanation. */}
                        {headReady && nodes.length === 0
                          ? <><span className="decsep" /><span className="sub">أضف أول بند قبل الإرسال</span></>
                          : <DockWhy n={issues.length} noun={NOUN.note} />}
                      </>}
              </span>
            </div>

            <div className="rowf gp-2">
              {!sent && (
                <>
                  <button
                    className="btn btn-2"
                    disabled={!headReady}
                    title={headReady ? 'احفظ كمسودة' : 'أكمل بيانات الميزانية أولًا'}
                    onClick={() => setDoc((d) => ({ ...d, id: d.id ?? 'BG-NEW', state: 'draft' }))}
                  >
                    احفظ المسودة
                  </button>
                  <button
                    className="btn btn-p"
                    disabled={!canSubmit}
                    title={
                      clash
                        ? 'السنة ومصدر التمويل مكرّران'
                        : !headReady
                          ? 'أكمل بيانات الميزانية'
                          : issues.length
                            ? `${issues.length} ملاحظة على الشجرة`
                            : 'أرسل الميزانية'
                    }
                    onClick={() => setSent(true)}
                  >
                    أرسل الميزانية
                  </button>
                </>
              )}
              {sent && (
                <button className="btn btn-2" onClick={() => navigate(ROUTES.budget)}>
                  ارجع إلى الميزانية
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add item - modal
          Note: a modal, not an empty row in the table. An empty row lets the tree shift under the
          user's hand while typing, and an item with no name yet takes up a numbering slot. The
          modal lets the item enter the tree complete. */}
      {open && (
        <div className="bmask" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="chrome modal"
            role="dialog"
            aria-modal="true"
            aria-label={editId ? 'تعديل بند' : 'إضافة بند'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <Icon name={editId ? icons.edit : icons.plus} size="md" />
              <b>{editId ? 'تعديل بند' : 'إضافة بند'}</b>
              <span className="pc-sp" />
              {under && <span className="sub trim1">تحت {pathOf(nodes, under)}</span>}
            </div>

            <div className="mb col">
              <label className="regf">
                <span className="lb">اسم البند<b className="regf-r" aria-label="إلزامي">*</b></span>
                <span className="fld">
                  <input
                    value={nLabel}
                    onChange={(e) => setNLabel(e.target.value)}
                    placeholder="مثال: مسار التعليم"
                    aria-label="اسم البند"
                  />
                </span>
                <span className="sub regf-h">الاسم الداخلي الذي تعمل به المؤسسة</span>
              </label>

              {/* Public-facing name
                  Note: this isn't a translation of the name, it's a different name for a different
                  purpose. The internal name is written for accounting ("Specific grants - education
                  - university"), and an entity reading its report wouldn't understand it. */}
              <label className="regf">
                <span className="lb">
                  الاسم الظاهر للمستخدم
                  {!nShow && <b className="regf-r" aria-label="إلزامي">*</b>}
                </span>
                <span className="fld">
                  <input
                    value={nAlias}
                    onChange={(e) => {
                      setNAlias(e.target.value)
                      setBlocked(shapeRule(nKind, nParent || null, nShow, e.target.value))
                    }}
                    placeholder="مثال: المنح التعليمية"
                    aria-label="الاسم الظاهر للمستخدم"
                  />
                </span>
                <span className="sub regf-h">
                  {nShow
                    ? 'اختياري · يظهر للخارج بدل الاسم الداخلي عند إدخاله'
                    : 'إلزامي · الاسم الداخلي مخفي، فهذا الاسم هو الذي سيظهر'}
                </span>
              </label>

              {/* Note: the two checkboxes go together, with the check between them written out.
                  Hiding the name with no fallback would make the item appear to the entity with no
                  name at all - a user who turns off visibility means to hide the internal label,
                  not the item itself. */}
              <div className="bchk">
                <label className="bchk-i">
                  <input
                    type="checkbox"
                    checked={nShow}
                    onChange={(e) => {
                      setNShow(e.target.checked)
                      setBlocked(shapeRule(nKind, nParent || null, e.target.checked, nAlias))
                    }}
                  />
                  <span>
                    <b>أظهر اسم البند للخارج</b>
                    <span className="sub">عند إلغائه يصبح الاسم الظاهر للمستخدم إلزاميًا</span>
                  </span>
                </label>

                <label className="bchk-i">
                  <input
                    type="checkbox"
                    checked={nActive}
                    onChange={(e) => setNActive(e.target.checked)}
                  />
                  <span>
                    <b>البند نشط</b>
                    <span className="sub">
                      يبقى البند غير النشط في الشجرة، لكنه لا يدخل في المجاميع ولا يُحجز عليه
                    </span>
                  </span>
                </label>
              </div>

              {/* Note: these fields used to be hidden on the first item - that was the actual
                  violation. Keeping the options available so users can choose means the choice
                  stays visible even when it's wrong; the message below is what states the error,
                  not the field's absence. */}
              <>
                  <label className="regf">
                    <span className="lb">نوع البند</span>
                    {/* The order in the dropdown matches the order in the hierarchy - a randomly
                        ordered list makes users learn the structure by trial and error. */}
                    <FieldSelect
                      value={nKind}
                      label="نوع البند"
                      options={[
                        { value: 'base', label: 'أساسي' },
                        { value: 'main', label: 'رئيسي' },
                        { value: 'sub', label: 'فرعي' },
                      ]}
                      onChange={(v) => {
                        const k = v as LineKind
                        setNKind(k)
                        setBlocked(shapeRule(k, nParent || null, nShow, nAlias))
                      }}
                    />
                    <span className="sub regf-h">{KIND_NOTE[nKind]}</span>
                  </label>

                  {/* The parent shown with its full path - "education track" alone isn't a unique
                      label; it could sit under two different paths. */}
                  <label className="regf">
                    <span className="lb">تابع لبند</span>
                    <FieldSelect
                      value={nParent}
                      label="تابع لبند"
                      placeholder="لا يتبع بندًا · بند أساسي"
                      options={parents.map((p) => ({ value: p.id, label: pathOf(nodes, p.id) }))}
                      onChange={(v) => {
                        setNParent(v)
                        setBlocked(shapeRule(nKind, v || null, nShow, nAlias))
                      }}
                    />
                  </label>

                  <label className="regf">
                    <span className="lb">المبلغ المخصص</span>
                    <span className="fld">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={nAmount ? nf.format(Number(nAmount)) : ''}
                        onChange={(e) => setNAmount(String(digits(e.target.value) || ''))}
                        aria-label="المبلغ المخصص"
                      />
                      <Riyal />
                    </span>
                    {nParent && (
                      <span className="sub regf-h">
                        المتبقّي في «{nodes.find((x) => x.id === nParent)?.label}»{' '}
                        <span className="num">
                          {nf.format(
                            (nodes.find((x) => x.id === nParent)?.allocated ?? 0) -
                              sumChildren(nodes, nParent),
                          )}
                        </span>
                      </span>
                    )}
                  </label>
              </>

              {/* The rule is shown where the decision happens, not as a toast after clicking or a
                  message that appears once the screen is submitted. */}
              {blocked
                ? <p className="bad cnote">{blocked}</p>
                : nodes.length === 0 && (
                  <p className="sub cnote">
                    أول بند هو <b>جذر الشجرة</b> · يأخذ المبلغ الإجمالي{' '}
                    <span className="num">{nf.format(doc.total)}</span> كاملًا،
                    وتوضع البنود التالية تحته.
                  </p>
                )}
            </div>

            <div className="mf">
              <button
                className="btn btn-p"
                disabled={!nLabel.trim() || Boolean(blocked)}
                title={
                  blocked || (nLabel.trim()
                    ? (editId ? 'احفظ التعديل' : 'أضف البند')
                    : 'أدخل اسم البند')
                }
                onClick={saveNode}
              >
                {editId ? 'احفظ التعديل' : 'أضف البند'}
              </button>
              <button className="btn btn-2" onClick={() => setOpen(false)}>إلغاء</button>
              <span className="pc-sp" />
              <span className="sub">
                {childrenOf(nodes, nParent || null).length > 0 && (
                  <>تحته <Num>{childrenOf(nodes, nParent || null).length}</Num> {nounAfter(childrenOf(nodes, nParent || null).length, NOUN.line)}</>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
