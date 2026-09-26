import { useEffect, useRef, useState } from 'react'
import { Glass } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { icons } from '@/components/ui/icons'
import { useOnScreen } from '@/hooks/useOnScreen'
import { useTypedBlocks } from '@/hooks/useTypedBlocks'
import { ReadingBlock, ReadingPeek } from './ReadingBlock'
import type { Reading } from './reading'
import { AbLeaf } from '@/components/soul'

/**
 * The assistant thinks for a moment before it starts writing, so the reply reads as produced, not
 * retrieved from cache.
 */
const THINK_MS = 900

export interface QuickReadProps {
  readings: Reading[]
  /**
   * `panel` = a full card in the context column (Today and the entity page).
   * `bar`   = a single line above the results that expands (list screens).
   */
  variant?: 'panel' | 'bar'
  title?: string
  /** Opens the full assistant panel. */
  onAsk?: () => void
  /**
   * The message shown when there are no notes in the current scope.
   * ⚠️ **The assistant doesn't disappear — it says there's nothing.** The component used to return
   * `null` when readings were empty, and readings are computed from **the filtered rows** — so as
   * soon as the user narrows scope to rows with no issues, the bar would vanish and the layout
   * would jump.
   * Worse than the jump: the disappearance reads as **a bug** — a user who watched the assistant
   * while filtering assumes something broke, not that they reached a clean scope. A "no notes" line
   * is an answer; absence isn't.
   */
  empty?: string
}

/**
 * Quick read — the assistant's voice on any screen.
 * It wears the same glass as any other card in the system: the assistant is part of the interface,
 * not a layer on top of it, and the distinction comes from **the spark and the live writing**, not
 * a different-colored surface.
 * Every reading opens with its number large: a reading whose number sits inside a sentence gets
 * read; one whose number leads gets seen.
 */
export function QuickRead({
  readings,
  variant = 'panel',
  title = 'قراءة سريعة',
  onAsk,
  empty,
}: QuickReadProps) {
  const box = useRef<HTMLDivElement>(null)
  const onScreen = useOnScreen(box)
  const [thought, setThought] = useState(false)
  const [open, setOpen] = useState(variant === 'panel')

  useEffect(() => {
    if (!onScreen || thought) return
    const id = setTimeout(() => setThought(true), THINK_MS)
    return () => clearTimeout(id)
  }, [onScreen, thought])

  /* ⚠️ The empty-state reading is **built here, not per screen** — several screens would otherwise
     write the same line, and any one that's forgotten goes back to just disappearing. */
  const calm: Reading[] = [{
    id: 'qr-calm',
    kind: 'note',
    text: empty ?? 'لا توجد ملاحظات في النطاق الحالي. وسّع الفلتر لعرض المزيد.',
  }]
  const list = readings.length > 0 ? readings : calm

  const shown = open ? list : list.slice(0, 1)
  const { block, chars, done } = useTypedBlocks(shown.map((r) => r.text), thought)

  const head = (
    <>
      <span className={`badge badge-30${done ? ' breath' : ''}`}>
        <AbLeaf className="aispark live" />
      </span>
      <span className="qr-title">{title}</span>
      {/* ⚠️ **No tags in the header.** "2 need attention" and "3 readings" used to be colored tags
          above every reading on every page — the assistant is a voice that explains, not an alert
          panel. The readings themselves are below. */}
    </>
  )

  /* -- Compact view: a single line above the results -- */
  if (variant === 'bar') {
    return (
      <Glass className={`qread strip${open ? ' open' : ''}`} ref={box}>
        <button className="qr-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {head}
          <span className="qr-sp" />
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size="sm" />
        </button>

        {!open && list[0] && <ReadingPeek reading={list[0]} />}

        {open && (
          <div className="qr-list">
            {shown.map((r, i) => (
              <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
            ))}
          </div>
        )}
      </Glass>
    )
  }

  /* -- Full view: a card in the context column --
     Opens and closes like the compact one. It used to open expanded and take the full screen height
     in the side column, so the user hit a long scroll before deciding whether they wanted to read
     it at all.
     When closed, the header keeps its counter, so what needs attention is visible without opening
     the card. */
  return (
    <Glass className={`qread panel aicard${open ? ' open' : ''}`} ref={box}>
      {/* The header is a row, not a button: it contains an "Ask" button, and a button inside a
          button is invalid markup that browsers parse inconsistently. The collapse has its own
          button, same as `.aifold` in the analysis card. */}
      <div className="qr-head static">
        {head}
        <span className="qr-sp" />
        {onAsk && (
          <button className="btn btn-2 btn-sm" onClick={onAsk} disabled={!done}>
            اسأل
          </button>
        )}
        <button
          className="qr-fold"
          aria-expanded={open}
          aria-label={open ? 'إخفاء القراءة' : 'إظهار القراءة'}
          onClick={() => setOpen((x) => !x)}
        >
          <Icon name={open ? icons.chevronUp : icons.chevronDown} size="sm" />
        </button>
      </div>

      {open && onScreen && !thought && (
        <div className="skel" aria-hidden="true">
          <span style={{ width: '38%' }} />
          <span style={{ width: '86%' }} />
          <span style={{ width: '64%' }} />
        </div>
      )}

      {!open && list[0] && <ReadingPeek reading={list[0]} />}

      {open && (
        <>
          <div className="qr-list">
            {shown.map((r, i) => (
              <ReadingBlock key={r.id} reading={r} typing={i === block} chars={chars} hidden={i > block} />
            ))}
          </div>

          <div className="qr-foot">قراءة آلية · استرشادية غير مُلزِمة</div>
        </>
      )}
    </Glass>
  )
}
