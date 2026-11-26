import { nf } from '@/lib/format'
import { Icon, Money, Riyal, Tag, icons } from '@/components/ui'
import { EntityMark } from '@/components/ui/EntityMark'
import type { EvidenceBlock as Block } from './types'

/**
 * Evidence block under an assistant answer.
 * Each shape answers a different question, so there's no single block for every case.
 */
export function EvidenceBlock({ block, onPick }: { block: Block; onPick?: (prompt: string) => void }) {
  switch (block.kind) {
    /* Audit 26 Nov · the likely projects or entities as cards to pick from · the whole card is the
       button, and picking asks the same question about that one */
    case 'pick':
      return (
        <div className={`pick rise pick-${block.what}`} role="list">
          {block.items.map((it, i) => (
            <button key={it.id} type="button" role="listitem" className="pick-c" style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => onPick?.(it.prompt)} aria-label={`اختر ${it.title}`}>
              <span className="pick-h">
                {block.what === 'entity'
                  ? <EntityMark size="sm" />
                  : <span className="pick-id num" dir="ltr">PRJ-{it.id}</span>}
                {it.tag && <Tag tone={it.tag.tone}>{it.tag.t}</Tag>}
              </span>
              <b className="pick-t">{it.title}</b>
              <span className="pick-s sub">{it.sub}</span>
              {it.bar && (
                <span className={`pick-bar t-${it.bar.tone}`}>
                  <i style={{ inlineSize: `${Math.round(it.bar.v * 100)}%` }} />
                  <small>{it.bar.label}</small>
                </span>
              )}
              <span className="pick-f">
                {it.figs.map((f) => (
                  <span key={f.k}>
                    <small className="sub">{f.k}</small>
                    <b className="num">{f.v}{f.money && <Riyal />}</b>
                  </span>
                ))}
                <span className="pick-go" aria-hidden="true"><Icon name={icons.chevron} size="sm" /></span>
              </span>
            </button>
          ))}
        </div>
      )

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
              {/* Client 27 Oct · a unit (one word, or the riyal) sits beside the number · a note under it */}
              {s.u && (s.u === '\u20C1' || !/\s/.test(s.u.trim()))
                ? <div className="cb-n"><span className="num">{s.v}</span>{s.u === '\u20C1' ? <Riyal /> : <small>{s.u}</small>}</div>
                : <>
                    <div className="cb-n"><span className="num">{s.v}</span></div>
                    {s.u && <div className="sub">{s.u}</div>}
                  </>}
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
                  <Money>{r.v}</Money>
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
                  <span className="num">{it.real}%</span>
                </div>
                <div className="bar">
                  <i style={{ width: `${it.real}%`, background: 'var(--teal)' }} />
                </div>
              </div>
            ))}
          </div>
          {block.note && <div className="sub mt-2">{block.note}</div>}
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
