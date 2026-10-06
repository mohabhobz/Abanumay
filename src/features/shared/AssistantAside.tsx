import { useRef } from 'react'
import { AnalysisCard, type Reading } from '@/components/assistant'
import { useFillHeight } from '@/hooks/useFillHeight'

/* The assistant's column · the one layout every record page shares (client, 5 Oct).

   The end column (left in RTL) holds the assistant and nothing else; every other card goes in the
   main column. One card in a sticky column is what lets it grow and shrink with the scroll
   (`useFillHeight` measures its distance from the top and the decision bar) without a second
   scroll inside the column — a column of several cards can't stick, and the assistant ends up
   scrolling away from the decision it reads. This is the project page's layout, made one
   component so a page can't drift from it. */

export function AssistantAside({
  readings, title, cta, empty, ask = true,
}: { readings: Reading[]; title?: string; cta?: string; empty?: string; ask?: boolean }) {
  const aside = useRef<HTMLDivElement>(null)
  useFillHeight(aside, { varName: '--ai-fill', reserveSelector: '.decdock, .askfab', min: 240 })
  return (
    <div className="col aiside" ref={aside}>
      <AnalysisCard
        readings={readings}
        title={title}
        cta={cta}
        empty={empty}
        ask={ask}
        onAsk={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
      />
    </div>
  )
}

