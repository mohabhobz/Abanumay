import { useEffect, useState, type CSSProperties } from 'react'
import { Icon, icons } from '@/components/ui'
import { EvidenceBlock } from './EvidenceBlock'
import { md } from './md'
import type { AiMessageModel } from './types'
import { AbLeaf } from '@/components/soul'

/**
 * Assistant message.
 * The reasoning tells the user which sources were opened — this isn't decoration, it's what makes
 * the answer credible.
 */
export function AiMessage({
  message,
  onFollow,
}: {
  message: AiMessageModel
  onFollow: (prompt: string) => void
}) {
  const [openThink, setOpenThink] = useState(true)
  const [copied, setCopied] = useState(false)

  const thinking = message.state === 'think'
  const typing = message.state === 'type'
  const done = message.state === 'done'
  const shown = typing ? (message.text ?? '').slice(0, message.chars) : message.text ?? ''

  // Reasoning steps collapse on their own once the answer finishes.
  useEffect(() => {
    if (done) setOpenThink(false)
  }, [done])

  const copy = () => {
    navigator.clipboard?.writeText(message.text ?? '').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="cmsg ai">
      {message.think.length > 0 && (
        <div className={`think${thinking ? ' live' : ''}`}>
          <button className="th-head" onClick={() => setOpenThink((v) => !v)}>
            {/* One breath when the answer finishes, then stillness. */}
            <AbLeaf className={`aispark th-spark${done ? ' breath' : ''}`} />
            <span>{thinking ? 'يفكّر' : `فكّر في ${message.think.length} خطوات`}</span>
            {thinking && (
              <span className="dots"><i /><i /><i /></span>
            )}
            {/* An explicit icon instead of rotating the chevron — the rotation direction was reversed, and
   "up/down" should read the same in code as it looks on screen. */}
            <Icon name={openThink ? icons.chevronUp : icons.chevronDown} size="sm" />
          </button>

          {openThink && (
            <div className="th-body">
              {message.think
                .slice(0, thinking ? message.step : message.think.length)
                .map((step, i) => (
                  <div className="th-step" key={i} style={{ '--d': `calc(var(--mo-stagger) * ${i})` } as CSSProperties}>
                    <span className="th-dot" />
                    {step}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {(typing || done) && (
        <div className="ctext">
          {md(shown)}
          {typing && <span className="caret" />}
        </div>
      )}

      {done && message.block && <EvidenceBlock block={message.block} />}
      {done && message.more && <div className="ctext rise">{md(message.more)}</div>}

      {done && message.advisory && (
        <div className="advisory rise">
          <Icon name={icons.info} size="sm" />
          قراءة استرشادية، والقرار والتوقيع مسؤوليتك.
        </div>
      )}

      {done && message.sources && message.sources.length > 0 && (
        <div className="csrc rise">
          <span className="lb">المصادر</span>
          {message.sources.map((s) => (
            <span className="srcchip" key={s}>{s}</span>
          ))}
        </div>
      )}

      {done && (
        <div className="cact rise">
          {message.actions?.map((a) => (
            <button className={`btn ${a.kind} btn-sm`} key={a.label}>{a.label}</button>
          ))}
          <span className="cact-sp" />
          <button className="iact" onClick={copy} title="نسخ" aria-label="نسخ">
            <Icon name={copied ? icons.check : icons.copy} size="sm" />
          </button>
          <button className="iact" title="أعد توليد الإجابة" aria-label="أعد توليد الإجابة">
            <Icon name={icons.redo} size="sm" />
          </button>
          <button className="iact" title="إجابة مفيدة" aria-label="إجابة مفيدة">
            <Icon name={icons.up} size="sm" />
          </button>
          <button className="iact" title="إجابة غير مفيدة" aria-label="إجابة غير مفيدة">
            <Icon name={icons.downv} size="sm" />
          </button>
        </div>
      )}

      {done && message.follow && message.follow.length > 0 && (
        <div className="chips rise mt-4">
          {message.follow.map((f) => (
            <button className="chip" key={f} onClick={() => onFollow(f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  )
}
