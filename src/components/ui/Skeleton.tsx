/* 26 Nov · audit #60 · one loading language for the whole system.

   A page used to show nothing (or a bare «جارٍ التحميل…») until its records were read, so a slow
   machine sat on an empty field for seconds. Now every screen opens on its own outline at once:

   · `PageSkeleton` · the shape of the page that's coming · its title, its tabs, then the body it
     will have (a list's table, a record's two columns, a board's tiles, the assistant's thread),
     picked from the path so the outline matches what replaces it
   · `Skel` · one placeholder bar · for any smaller part that waits on its own
   · the same outline is drawn in `index.html` before the code arrives, so the first open is
     covered too

   It shows through `AppLayout` (src/app/layout/AppLayout.tsx), which every internal screen sits
   in: the page's body is drawn one frame after the outline, so a new page answers at once instead
   of freezing on the old one. The outline fades in only after a short delay, so a page that's
   ready at once never flashes it. Nothing here is page-specific · a new page gets it for free. */

import type { CSSProperties } from 'react'

export function Skel({ w, h, r, className = '' }: { w?: number | string; h?: number | string; r?: 'pill' | 'box' | 'dot'; className?: string }) {
  const style: CSSProperties = { inlineSize: typeof w === 'number' ? `${w}px` : w, blockSize: typeof h === 'number' ? `${h}px` : h }
  return <span className={`sk${r ? ` sk-${r}` : ''} ${className}`} style={style} aria-hidden="true" />
}

export type SkeletonKind = 'list' | 'record' | 'board' | 'chat'

/** The outline a path will have · a record id in the path is a record, the home/report boards are
    boards, the assistant is a thread, anything else is a list */
export function skeletonKind(path: string): SkeletonKind {
  if (/^\/assistant/.test(path)) return 'chat'
  if (path === '/' || /^\/(today-v2|overview|reports|board|journey)(\/|$)/.test(path)) return 'board'
  const segs = path.split('/').filter(Boolean)
  if (segs.length > 1 && segs.slice(1).some((s) => /\d/.test(s))) return 'record'
  return 'list'
}

const Lines = ({ n = 3, last = '60%' }: { n?: number; last?: string }) => (
  <div className="sk-lines">
    {Array.from({ length: n }, (_, i) => <Skel key={i} w={i === n - 1 ? last : '100%'} h={10} />)}
  </div>
)

function Head({ tabs = true }: { tabs?: boolean }) {
  return (
    <>
      <div className="sk-head">
        <div className="sk-lines"><Skel w={240} h={28} /><Skel w={340} h={12} /></div>
        <Skel w={128} h={40} r="box" />
      </div>
      {tabs && <div className="sk-tabs">{[84, 110, 92, 120, 76].map((w, i) => <Skel key={i} w={w} h={14} />)}</div>}
    </>
  )
}

function Card({ lines = 3, h }: { lines?: number; h?: string }) {
  return (
    <div className="glass sk-card" style={h ? { minBlockSize: h } : undefined}>
      <Skel w={160} h={16} />
      <Lines n={lines} />
    </div>
  )
}

export function PageSkeleton({ kind }: { kind: SkeletonKind }) {
  return (
    <div className="viewstack">
      <div className="screen col sk-page" role="status" aria-busy="true" aria-live="polite">
        <span className="nsr">جارٍ تجهيز الصفحة</span>
        {kind === 'chat' ? (
          <div className="sk-chat">
            <Skel w={220} h={28} />
            <Skel w={320} h={12} />
            <div className="sk-chat-grid">{[0, 1, 2, 3].map((i) => <Card key={i} lines={2} />)}</div>
            <Skel w="100%" h={56} r="box" />
          </div>
        ) : (
          <>
            <Head tabs={kind !== 'board'} />
            {kind === 'board' && (
              <>
                <div className="sk-kpis">{[0, 1, 2, 3].map((i) => <div key={i} className="glass sk-card"><Skel w={90} h={12} /><Skel w={120} h={30} /></div>)}</div>
                <div className="sk-grid2"><Card lines={4} h="220px" /><Card lines={4} h="220px" /></div>
                <div className="sk-grid4">{[0, 1, 2, 3].map((i) => <Card key={i} lines={3} />)}</div>
              </>
            )}
            {kind === 'list' && (
              <>
                <div className="sk-tools"><Skel w={300} h={40} r="box" /><Skel w={96} h={40} r="box" /><Skel w={96} h={40} r="box" /><Skel w={96} h={40} r="box" className="sk-end" /></div>
                <div className="glass sk-table">
                  {Array.from({ length: 9 }, (_, i) => (
                    <div key={i} className={`sk-row${i === 0 ? ' sk-row-h' : ''}`}>
                      <Skel w="70%" h={i === 0 ? 10 : 12} /><Skel w="55%" h={i === 0 ? 10 : 12} /><Skel w="80%" h={i === 0 ? 10 : 12} /><Skel w="45%" h={i === 0 ? 10 : 12} /><Skel w="60%" h={i === 0 ? 10 : 12} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {kind === 'record' && (
              <div className="sk-g2">
                <div className="sk-col"><Card lines={4} /><Card lines={3} /><Card lines={5} /></div>
                <div className="sk-col"><Card lines={6} h="360px" /></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
