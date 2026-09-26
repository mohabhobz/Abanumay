import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons, Money, Num, Tag } from '@/components/ui'
import { childSum, nodeAt, PLAN_LEVELS, type Imbalance, type PlanNode } from '@/data/budgetPlan'

/**
 * Gap-detail dialog - the answer comes to you, you don't go looking for it.
 *
 * Clicking an item in the balance check used to change the tree's route and scroll the page down.
 * That's off for two reasons:
 * - the click promised an answer and instead moved you somewhere: whoever clicked is asking "so
 * where's this gap?" and ends up in the middle of the page facing a table they have to read from
 * scratch.
 * - the tree shows the children, not the gap. The gap between a parent and its children needs both
 * figures in one glance, and the tree only gives one of them.
 *
 * The dialog puts both figures side by side, along with every child and its share, so the question
 * gets answered where it was asked. A button to go work in the tree is still there for anyone who
 * wants it.
 *
 * Rendered via a portal on `body`: any ancestor with `backdrop-filter` becomes the containing block
 * for `position:fixed`, so the dialog would have landed next to the card instead of the center of
 * the screen.
 */
export function GapPeek({
  gap, root, onGoTree, onClose,
}: {
  gap: Imbalance
  root: PlanNode
  onGoTree: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const node = nodeAt(root, gap.path)
  const kids = node?.children ?? []
  const over = gap.gap > 0
  /* The largest child allocation sets the scale - the bar shows relative share without writing a
   second percentage next to every row. */
  const max = Math.max(...kids.map((k) => k.alloc), 1)

  return createPortal(
    <>
      <div className="ascrim on" onClick={onClose} aria-hidden="true" />

      <div className="gpeek chrome" role="dialog" aria-label={`فرق ${gap.label || root.label}`}>
        <div className="gpeek-h">
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="sub">{PLAN_LEVELS[gap.level]}</span>
            <div className="atitle">{gap.label || root.label}</div>
          </div>
          <button className="aclose" onClick={onClose} aria-label="أغلق النافذة">
            <Icon name={icons.close} size="sm" />
          </button>
        </div>

        {/* Both figures in one glance - what the tree wasn't giving. */}
        <div className="gpeek-n">
          <span className="gpeek-c">
            <span className="sub">مخصص للبند</span>
            <b><Money sm>{gap.alloc}</Money></b>
          </span>
          <span className="gpeek-op" aria-hidden="true">−</span>
          <span className="gpeek-c">
            <span className="sub">مجموع أبنائه</span>
            <b><Money sm>{gap.childSum}</Money></b>
          </span>
          <span className="gpeek-op" aria-hidden="true">=</span>
          <span className="gpeek-c">
            <span className="sub">الفرق</span>
            <Tag tone={over ? 'no' : 'warn'}>
              {over ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(gap.gap)}</Money>
            </Tag>
          </span>
        </div>

        <p className="mut gpeek-w">
          {over
            ? 'خُصِّص للأبناء أكثر من مخصص أبيهم، فهذه الزيادة مصروفة من بند آخر بلا قيد.'
            : 'مخصص البند أكبر من مجموع أبنائه، فهذا الفرق غير موزَّع وغير مربوط بهدف.'}
        </p>

        <div className="gpeek-b">
          <div className="gpeek-lb">
            <span>الأبناء</span>
            <span className="sub"><Num>{kids.length}</Num></span>
          </div>
          {kids.length === 0 ? (
            <p className="mut" style={{ margin: 0 }}>لا توجد أبناء لهذا البند في الخطة.</p>
          ) : (
            <ul className="gpeek-l">
              {kids.map((k) => (
                <li key={k.id}>
                  <span className="gpeek-k" title={k.label}>{k.label}</span>
                  <span className="gpeek-t" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, Math.round((k.alloc / max) * 100))}%` }} />
                  </span>
                  <span className="gpeek-v"><Money sm>{k.alloc}</Money></span>
                </li>
              ))}
              <li className="gpeek-sum">
                <span className="gpeek-k">المجموع</span>
                <span className="gpeek-t empty" aria-hidden="true" />
                <span className="gpeek-v"><Money sm>{node ? childSum(node) : gap.childSum}</Money></span>
              </li>
            </ul>
          )}
        </div>

        {/* The primary action here is jumping to the tree - "done" is just a dismiss, so it sits after it,
   not before. */}
        <div className="gpeek-f">
          <button className="btn btn-p" onClick={onGoTree}>
            <Icon name={icons.chart} size="sm" />
            افتحه في شجرة التخصيص
          </button>
          <button className="btn btn-2" onClick={onClose}>أغلق</button>
        </div>
      </div>
    </>,
    document.body,
  )
}
