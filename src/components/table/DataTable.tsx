import { useState, type ReactNode } from 'react'
import { useMenu } from '@/hooks/useMenu'
import { Icon, icons, MenuOpt, MenuPanel } from '@/components/ui'
import { nf } from '@/lib/format'
import {
  aggregate, allPaths, countLeaves, defaultCols, groupTree, orderCols,
  type Col, type GroupBy, type GroupNode,
} from './model'
import { useColumnResize, type ColumnResize } from './useColumnResize'

export interface DataTableProps<T> {
  rows: T[]
  /** كل الأعمدة المعرَّفة للكيان ده */
  all: Col<T>[]
  /** مفاتيح الأعمدة الظاهرة */
  cols: string[]
  onCols: (keys: string[]) => void
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * تحديد/إلغاء **صفوف الجدول اللي اتضغط فيه بس**.
   *
   * مع التجميع، كل مجموعة جدول بترويسته. الصندوق اللي فوق مجموعة
   * «القصيم» يقصد أربعة صفوف القصيم لا الثلاثين كلهم · الأب بيحدّد
   * أولاده. فبيبعت معرّفات صفوفه، والصفحة بتضمّها أو تشيلها من
   * المحدَّد بدل ما تستبدله.
   */
  onSelectAll?: (on: boolean, ids: string[]) => void
  /** فتح الصف · بيخلي الصف كله كليكبول */
  onOpen?: (r: T) => void
  /**
   * سلسلة التجميع · بدونها جدول واحد.
   *
   * ⚠️ **سلسلة لا بُعد واحد (ي-1).** والترتيب فيها هو الهرم:
   * الأول أب واللي بعده ابن · وعكسه سؤال تاني خالص (ي-2).
   */
  group?: GroupBy<T>[]
  /** اسم الوحدة في الإجماليات: «6 مشاريع» */
  count: (n: number) => string
  /** اسم الجدول · بيتخزّن عليه عرض الأعمدة اللي المستخدم سحبها */
  table?: string
}

/**
 * جدول عام.
 *
 * كل جداول السيستم بتستخدمه: نفس الإجماليات ونفس التجميع ونفس
 * منتقي الأعمدة ونفس سلوك الصف. الموديول بيجيب أعمدته وبس.
 */
/* ═══════════════════════════════════════════════════════════
   ي-3 · طيّ وفتح المجموعات

   ⚠️ **والافتراضي مقفول.** التجميع مش تلوين للجدول، هو **سؤال**:
   «الفلوس رايحة فين؟» · والإجابة هي سطور المجاميع. لمّا الجدول
   بيفضل مفتوح بعد التجميع، تلاتين صفًّا بيفضلوا على الشاشة والسطر
   اللي بيجاوب بيضيع بينهم، فالمستخدم بيقعد يزحلق يدوّر على اللي
   طلبه هو.

   فأول ما التجميع يتشغّل: **المجاميع بس**، والمستخدم بيفتح اللي
   يخصّه · «كإنك عملت تقريرًا في ثانية» (ي-4).

   ⚠️ **وكل حاجة على مستوى المجموعة مكانها سطر المجموعة.** صندوق
   «حدّد الكل» ومنتقي الأعمدة كانوا في ترويسة الجدول · والجدول
   دلوقتي ممكن يكون مقفولًا، فالاتنين كانوا هيختفوا والمستخدم ما
   يعرفش ليه. فالصندوق نزل لسطر المجموعة، والمنتقي طلع لشريط فوق
   المجموعات · ومحدش منهم بيتكرّر في الاتنين.
   ═══════════════════════════════════════════════════════════ */
const NONE: ReadonlySet<string> = new Set()

export function DataTable<T>({
  rows, all, cols, onCols, id, selected, onSelect, onSelectAll, onOpen, group, count, table,
}: DataTableProps<T>) {
  const resize = useColumnResize(table)
  const bys = group ?? []
  const on = bys.length > 0

  /* الأعمدة اللي بنجمّع بيها بتتشال: قيمتها مكتوبة مرة في سطر
     المجموعة، وتكرارها في كل صف عمود ضايع. */
  const keys = new Set(bys.map((b) => b.key))
  const shown = orderCols(all, cols).filter((c) => !keys.has(c.key))
  const tree = on ? groupTree(rows, bys) : []

  /* ⚠️ الحالة متربطة **بالسلسلة نفسها**: لو المستخدم غيّر من
     «المنطقة» لـ«الجهة»، أو حتى قلب ترتيب نفس البُعدين، المسارات
     المفتوحة القديمة مالهاش معنى · والمقارنة في الرندر بدل
     `useEffect` عشان ما يحصلش رندر أول بحالة قديمة. */
  const dim = bys.map((b) => b.key).join(',')
  const [open, setOpen] = useState<{ dim: string; keys: ReadonlySet<string> }>({ dim, keys: NONE })
  const openKeys = open.dim === dim ? open.keys : NONE

  const toggle = (k: string) =>
    setOpen(() => {
      const next = new Set(openKeys)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return { dim, keys: next }
    })

  const every = on ? allPaths(tree) : []
  const allOpen = every.length > 0 && every.every((p) => openKeys.has(p))

  return (
    <div className="tblwrap">
      {on && (
        <div className="tgbar">
          <span className="tgbar-t">
            مجمَّع حسب
            {/* ⚠️ السلسلة بترتيبها معروضة **كسلسلة** · «المنطقة ثم
                الجهة» غير «الجهة ثم المنطقة»، ولو الشريط قال
                الاتنين بنفس الشكل المستخدم ما بيعرفش هو في أنهي
                سؤال (ي-2). */}
            {bys.map((b, i) => (
              <span key={b.key} className="tgbar-s">
                {i > 0 && <Icon name={icons.chevron} size={13} />}
                <b>{b.label}</b>
              </span>
            ))}
            <span className="pc-dot" />
            <span className="num">{tree.length}</span> مجموعة
            {bys.length > 1 && (
              <>
                <span className="pc-dot" />
                <span className="num">{countLeaves(tree)}</span> مجموعة فرعية
              </>
            )}
            <span className="pc-dot" />
            <span className="num">{openKeys.size}</span> مفتوحة
          </span>
          <span className="pc-sp" />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen({ dim, keys: allOpen ? NONE : new Set(every) })}
          >
            <Icon name={allOpen ? icons.shrink : icons.expand} size={14} />
            {allOpen ? 'اقفل الكل' : 'افتح الكل'}
          </button>
          <ColumnPicker all={all} cols={cols} onCols={onCols} />
        </div>
      )}

      {on
        ? tree.map((n) => (
            <Branch
              key={n.path}
              node={n}
              cols={shown}
              id={id}
              selected={selected}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              onOpen={onOpen}
              count={count}
              resize={resize}
              openKeys={openKeys}
              onToggle={toggle}
            />
          ))
        : (
          <Block
            rows={rows}
            cols={shown}
            id={id}
            selected={selected}
            onSelect={onSelect}
            onSelectAll={onSelectAll}
            onOpen={onOpen}
            count={count}
            resize={resize}
            picker={{ all, cols, onCols }}
          />
        )}

      {/* الإجمالي الكلي بعد المجموعات: من غيره المستخدم بيجمع
          إجماليات المجموعات في دماغه. */}
      {on && tree.length > 1 && (
        <div className="tgrand">
          <span className="tgrand-k">الإجمالي الكلي · {count(rows.length)}</span>
          <span className="tgrand-v">
            {shown.filter((c) => c.agg).map((c) => (
              <span key={c.key}>
                <span className="sub">{c.label}</span>{' '}
                <b className="num">{nf.format(aggregate(c, rows) ?? 0)}</b>
                {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                  <small className="sub"> {c.aggSay ?? 'وسطي'}</small>
                )}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * فرع من شجرة التجميع.
 *
 * ⚠️ **العقدة الوسيطة ما بتفتحش جدولًا، بتفتح أولادها.** ودي
 * الفكرة كلها: «الرياض» بتفتح على جمعياتها بمجاميعها، والجمعية هي
 * اللي بتفتح على صفوفها. لو كل مستوى فتح جدولًا، التداخل كان بيبقى
 * تكرارًا للجدول بعدد المستويات لا تلخيصًا.
 */
function Branch<T>({
  node, cols, id, selected, onSelect, onSelectAll, onOpen, count, resize, openKeys, onToggle,
}: {
  node: GroupNode<T>
  cols: Col<T>[]
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  onSelectAll?: (on: boolean, ids: string[]) => void
  onOpen?: (r: T) => void
  count: (n: number) => string
  resize: ColumnResize
  openKeys: ReadonlySet<string>
  onToggle: (path: string) => void
}) {
  const shut = !openKeys.has(node.path)
  const leaf = node.kids.length === 0

  /* العقدة الوسيطة المفتوحة أولادها تحتها مباشرةً، فسطرها ما
     بيلزقش بجدول · و`.tcap` المفتوح بيلزق بجدوله. */
  const cap = (
    <Cap
      node={node}
      cols={cols}
      shut={shut}
      pick={Boolean(selected && onSelect)}
      selected={selected}
      id={id}
      onSelectAll={onSelectAll}
      onToggle={() => onToggle(node.path)}
      leafOpen={leaf && !shut}
    />
  )

  if (leaf) {
    return (
      <Block
        caption={cap}
        rows={node.rows}
        cols={cols}
        id={id}
        selected={selected}
        onSelect={onSelect}
        onSelectAll={onSelectAll}
        onOpen={onOpen}
        count={count}
        resize={resize}
        shut={shut}
      />
    )
  }

  return (
    <div className="tbranch">
      {cap}
      {!shut && (
        <div className="tkids">
          {node.kids.map((k) => (
            <Branch
              key={k.path}
              node={k}
              cols={cols}
              id={id}
              selected={selected}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              onOpen={onOpen}
              count={count}
              resize={resize}
              openKeys={openKeys}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * سطر المجموعة · تلخيص لا عنوان.
 *
 * ⚠️ قبل الطيّ كان عنوانًا فوق جدول ظاهر دايمًا، والمجاميع تحت في
 * `tfoot` · يعني المجموعة المطويّة كانت هتبقى اسمًا بلا إجابة.
 */
function Cap<T>({
  node, cols, shut, pick, selected, id, onSelectAll, onToggle, leafOpen,
}: {
  node: GroupNode<T>
  cols: Col<T>[]
  shut: boolean
  pick: boolean
  selected?: Set<string>
  id: (r: T) => string
  onSelectAll?: (on: boolean, ids: string[]) => void
  onToggle: () => void
  /** آخر مستوى ومفتوح · وساعتها بيلزق بجدوله */
  leafOpen: boolean
}) {
  const allOn = pick && node.rows.length > 0 && node.rows.every((r) => selected!.has(id(r)))

  return (
    <div
      className={`tcap${shut ? ' shut' : ''}${leafOpen ? ' ontbl' : ''}`}
      data-lv={node.level}
    >
      {pick && (
        <input
          type="checkbox"
          className="tcap-x"
          checked={allOn}
          onChange={(e) => onSelectAll?.(e.target.checked, node.rows.map(id))}
          aria-label={`تحديد كل صفوف ${node.key}`}
        />
      )}

      <button
        type="button"
        className="tcap-b"
        aria-expanded={!shut}
        onClick={onToggle}
        title={shut ? `افتح ${node.key}` : `اقفل ${node.key}`}
      >
        <Icon name={icons.chevronDown} size={15} />
        <span className="tcap-k">
          <span className="sub">{node.by.label}:</span> {node.key}
        </span>
        <span className="tcap-n sub num">{node.rows.length}</span>
      </button>

      <span className="pc-sp" />

      {/* ⚠️ **المجاميع هنا وقت الطيّ بس.** لمّا المجموعة مفتوحة على
          جدول، نفس الأرقام في `tfoot` **تحت أعمدتها** · وده أنفع من
          شريحة في سطر فوق. بس العقدة الوسيطة المفتوحة مالهاش
          `tfoot`، فمجاميعها بتفضل هنا. */}
      {(shut || !leafOpen) && (
        <span className="tcap-v">
          {cols.filter((c) => c.agg).map((c) => (
            <span key={c.key}>
              <span className="sub">{c.label}</span>{' '}
              <b className="num">{nf.format(aggregate(c, node.rows) ?? 0)}</b>
              {/* نفس كلمة `tfoot` · الرقم اللي في الترويسة المطويّة
                  واللي في الإجماليات لازم يقولوا نفس الحاجة */}
              {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                <small className="sub"> {c.aggSay ?? 'وسطي'}</small>
              )}
            </span>
          ))}
        </span>
      )}
    </div>
  )
}

function Block<T>({
  caption, rows, cols, id, selected, onSelect, onSelectAll, onOpen, picker, count, resize,
  shut,
}: {
  /** سطر المجموعة · مرسوم في `Cap` لأنه بيتشارك مع العقد الوسيطة */
  caption?: ReactNode
  /** المجموعة مطويّة · سطر المجاميع بس */
  shut?: boolean
  rows: T[]
  cols: Col<T>[]
  id: (r: T) => string
  selected?: Set<string>
  onSelect?: (id: string, on: boolean) => void
  /**
   * تحديد/إلغاء **صفوف الجدول اللي اتضغط فيه بس**.
   *
   * مع التجميع، كل مجموعة جدول بترويسته. الصندوق اللي فوق مجموعة
   * «القصيم» يقصد أربعة صفوف القصيم لا الثلاثين كلهم · الأب بيحدّد
   * أولاده. فبيبعت معرّفات صفوفه، والصفحة بتضمّها أو تشيلها من
   * المحدَّد بدل ما تستبدله.
   */
  onSelectAll?: (on: boolean, ids: string[]) => void
  onOpen?: (r: T) => void
  picker?: { all: Col<T>[]; cols: string[]; onCols: (k: string[]) => void }
  count: (n: number) => string
  resize: ColumnResize
}) {
  const pick = Boolean(selected && onSelect)
  const allOn = pick && rows.length > 0 && rows.every((r) => selected!.has(id(r)))
  const hasTotals = cols.some((c) => c.agg)

  const { widths, dragging, start, reset } = resize

  /* خط الحدّ: بيبان بمجرّد الهوفر على المقبض، وبيمتدّ على طول الجدول
     لا على الترويسة لوحدها · الحدّ اللي هتسحبه بيقع على الصفوف،
     فالمستخدم لازم يشوفه عليها قبل ما يسحب. وموضعه بيتقاس من حافة
     الترويسة نفسها لا من موضع المؤشّر: المؤشّر ممكن يكون في أي مكان
     جوّه مساحة اللمس (١١px)، فالخط كان بينحرف عن الحدّ الحقيقي. */
  const [hover, setHover] = useState<number | null>(null)

  const edgeOf = (el: HTMLElement): number | null => {
    const th = el.closest('th')
    const host = el.closest('.tblock')
    if (!th || !host) return null
    const t = th.getBoundingClientRect()
    const h = host.getBoundingClientRect()
    return (getComputedStyle(th).direction === 'rtl' ? t.left : t.right) - h.left
  }

  const guide = dragging ? dragging.x : hover

  return (
    <div className={`tblock${dragging ? ' resizing' : ''}`}>
      {guide !== null && (
        <span
          className={`tguide${dragging ? ' on' : ''}`}
          style={{ left: guide }}
          aria-hidden="true"
        />
      )}

      {caption}

      {shut ? null : (
      <table className="tbl">
        {/* العروض في `colgroup` لا على الخلايا: خانة واحدة لكل عمود
            بدل تكرارها في كل صف، والمتصفح بيقراها مرة قبل الرسم. */}
        <colgroup>
          {pick && <col style={{ width: 44 }} />}
          {cols.map((c) => (
            <col key={c.key} style={{ width: widths[c.key] ?? c.w ?? 120 }} />
          ))}
          <col style={{ width: 38 }} />
        </colgroup>

        <thead>
          <tr>
            {/* مع التجميع الصندوق ده نزل لسطر المجموعة · الخانة
                بتفضل عشان أعمدة الصفوف تحتها ما تزحلقش */}
            {pick && (
              <th className="tchk">
                {!caption && (
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => onSelectAll?.(e.target.checked, rows.map(id))}
                    aria-label="تحديد كل الصفوف المعروضة"
                  />
                )}
              </th>
            )}
            {cols.map((c, i) => (
              <th key={c.key} className={c.n ? 'n' : undefined} title={c.label}>
                <span className="th-t">{c.label}</span>
                {/* المقبض على حافة العمود الداخلية · يعني الحدّ بينه
                    وبين اللي بعده. آخر عمود ما لهوش مقبض: مفيش حدّ
                    بعده يتسحب، وخانة منتقي الأعمدة جنبه. */}
                {i < cols.length - 1 && (
                  <span
                    className={`thgrip${dragging?.key === c.key ? ' on' : ''}`}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`تغيير عرض عمود ${c.label}`}
                    onPointerDown={(e) => start(c.key, e)}
                    onPointerEnter={(e) => setHover(edgeOf(e.currentTarget))}
                    onPointerLeave={() => setHover(null)}
                    onDoubleClick={() => reset(c.key)}
                    title="اسحب لتغيير العرض · دبل كليك للعرض الافتراضي"
                  />
                )}
              </th>
            ))}
            <th className="tcolx">
              {picker && <ColumnPicker {...picker} />}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const rid = id(r)
            return (
              <tr
                key={rid}
                className={`${pick && selected!.has(rid) ? 'sel' : ''}${onOpen ? ' clickable' : ''}`}
                /* الصف كله يفتح، مش الاسم بس: الهدف الصغير بيخلي
                   المستخدم يصوّب بالماوس بدل ما يقرا. والضغط على
                   صندوق التحديد أو رابط جوّه الصف ما يفتحش. */
                onClick={
                  onOpen
                    ? (e) => {
                        const t = e.target as HTMLElement
                        if (t.closest('a,button,input,label')) return
                        onOpen(r)
                      }
                    : undefined
                }
              >
                {pick && (
                  <td className="tchk">
                    <input
                      type="checkbox"
                      checked={selected!.has(rid)}
                      onChange={(e) => onSelect!(rid, e.target.checked)}
                      aria-label={`تحديد ${rid}`}
                    />
                  </td>
                )}
                {cols.map((c) => (
                  /* العنوان هو نصّ التصدير نفسه: الخلية بتتقصّ لما
                     العمود يضيق، والتلميح بيرجّع اللي اتقصّ من غير
                     ما الصفّ يلفّ سطرًا. */
                  <td key={c.key} className={c.n ? 'n num' : undefined} title={c.text(r)}>
                    {c.cell(r)}
                  </td>
                ))}
                {/* خانة المنتقي · ملزوقة بالحافّة زي ترويستها (ي-7) */}
                <td className="tcolx" />
              </tr>
            )
          })}
        </tbody>

        {/* الإجماليات جوّه `tfoot`: المتصفح بيثبّتها عند الطباعة،
            وقارئ الشاشة بيقول إنها تلخيص لا بيان. */}
        {hasTotals && rows.length > 0 && (
          <tfoot>
            <tr>
              {pick && <td />}
              {cols.map((c, i) => {
                const total = aggregate(c, rows)
                return (
                  <td key={c.key} className={c.n ? 'n' : undefined}>
                    {total !== null ? (
                      /* الرقم والكلمة في مجموعة عربية، والعزل نازل على
                         الأرقام وحدها · نفس قاعدة `Money`. الخلية اللي
                         كانت `.num` كانت بتحطّ الاتنين في مجرى إنجليزي،
                         فـ«وسطي» بتقع على الجنب الغلط ومش متسطّرة مع
                         الرقم اللي فوقها في العمود. */
                      <span className="tfv">
                        <b className="num">{nf.format(total)}</b>
                        {/* الكلمة من العمود · و«وسطي» هي الافتراضية
                            للمتوسّط وحده. شوف `aggSay` في `model.ts`. */}
                        {(c.aggSay ?? (c.agg === 'avg' ? 'وسطي' : '')) && (
                          <small className="sub">{c.aggSay ?? 'وسطي'}</small>
                        )}
                      </span>
                    ) : i === 0 ? (
                      <span className="sub">{count(rows.length)}</span>
                    ) : null}
                  </td>
                )
              })}
              <td className="tcolx" />
            </tr>
          </tfoot>
        )}
      </table>
      )}
    </div>
  )
}

/** منتقي الأعمدة · زرار في آخر ترويسة الجدول */
function ColumnPicker<T>({
  all, cols, onCols,
}: { all: Col<T>[]; cols: string[]; onCols: (k: string[]) => void }) {
  const { open, setOpen, box } = useMenu<HTMLDivElement>()

  const toggle = (key: string) =>
    onCols(cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key])

  return (
    <div className="tcolp" ref={box}>
      <button
        type="button"
        className="tcolb"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="الأعمدة"
        onClick={() => setOpen((x: boolean) => !x)}
      >
        <Icon name={icons.plus} size={15} />
      </button>

      {open && (
        <MenuPanel
          extra="tcolm"
          foot={
            <button type="button" className="fclear" onClick={() => onCols(defaultCols(all))}>
              أعِد الأعمدة الافتراضية
            </button>
          }
        >
          {all.map((c) => (
            <MenuOpt
              key={c.key}
              on={cols.includes(c.key)}
              fix={c.fixed}
              off={c.fixed}
              onPick={() => toggle(c.key)}
            >
              {c.label}
            </MenuOpt>
          ))}
        </MenuPanel>
      )}
    </div>
  )
}
