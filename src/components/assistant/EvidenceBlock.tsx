import { nf } from '@/lib/format'
import { Riyal } from '@/components/ui'
import type { EvidenceBlock as Block } from './types'

/**
 * بلوك الأدلة تحت إجابة المساعد.
 * كل شكل بيجاوب على سؤال مختلف، فمفيش بلوك واحد لكل الحالات.
 */
export function EvidenceBlock({ block }: { block: Block }) {
  switch (block.kind) {
    case 'meter': {
      const pct = Math.round((block.limit / block.value) * 100)
      return (
        <div className="cblock rise">
          <div className="cb-h">
            <span className="lb">{block.label}</span>
            <span className="cb-v num">
              {nf.format(block.value)} <small>ساعة</small>
            </span>
          </div>
          <div className="bar over">
            <i style={{ width: '100%' }} />
            <u style={{ insetInlineStart: `${pct}%` }} />
          </div>
          <div className="cb-f">
            <span className="sub">
              الحدّ <span className="num">{nf.format(block.limit)}</span>
            </span>
            <span className="sub bad">{block.note}</span>
          </div>
        </div>
      )
    }

    case 'stats':
      return (
        <div className="cblock rise cb-stats">
          {block.items.map((s) => (
            <div key={s.k}>
              <div className="lb">{s.k}</div>
              <div className="cb-n num">{s.v}</div>
              {s.u && <div className="sub">{s.u}</div>}
            </div>
          ))}
        </div>
      )

    case 'ledger':
      return (
        <div className="cblock rise">
          <div className="cb-led">
            {block.rows.map((r) => (
              <div key={r.k} className={r.strong ? 'strong' : ''}>
                <span>{r.k}</span>
                <span className="num">
                  {r.v} <Riyal />
                </span>
              </div>
            ))}
          </div>
        </div>
      )

    case 'bars':
      return (
        <div className="cblock rise">
          <div className="cb-bars">
            {block.items.map((it) => (
              <div key={it.k}>
                <div className="cb-bl">
                  <span>{it.k}</span>
                  <span className="num">{it.real}٪</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${it.real}%`, background: 'var(--teal)' }} />
                </div>
              </div>
            ))}
          </div>
          {block.note && <div className="sub" style={{ marginTop: '.6rem' }}>{block.note}</div>}
        </div>
      )

    case 'list':
      return (
        <div className="cblock rise">
          <div className="cb-list">
            {block.items.map((it) => (
              <div key={it.t}>
                <span className={`cb-dot ${it.tone}`} />
                <div>
                  <div className="cb-t">{it.t}</div>
                  <div className="sub">{it.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
  }
}
