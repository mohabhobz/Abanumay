import { useEffect, useState, type CSSProperties } from 'react'
import { Icon, icons } from '@/components/ui'
import { EvidenceBlock } from './EvidenceBlock'
import { md } from './md'
import type { AiMessageModel } from './types'

/**
 * رسالة المساعد.
 * التفكير بيقول للمستخدم إيه المصادر اللي اتفتحت — دي مش زينة،
 * دي اللي بتخلّي الإجابة قابلة للتصديق.
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

  // خطوات التفكير بتتطوي لوحدها لما الإجابة تكمل
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
            <span className="aispark th-spark" />
            <span>{thinking ? 'يفكّر' : `فكّر في ${message.think.length} خطوات`}</span>
            {thinking && (
              <span className="dots"><i /><i /><i /></span>
            )}
            <Icon
              path={icons.chevron}
              size={16}
              style={{ transform: openThink ? 'rotate(-90deg)' : 'rotate(90deg)' }}
            />
          </button>

          {openThink && (
            <div className="th-body">
              {message.think
                .slice(0, thinking ? message.step : message.think.length)
                .map((step, i) => (
                  <div className="th-step" key={i} style={{ '--d': `${i * 60}ms` } as CSSProperties}>
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
          <Icon path={icons.alert} size={16} />
          قراءة استرشادية — القرار والتوقيع يفضلوا عليك.
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
            <Icon path={copied ? icons.check : icons.copy} size={16} />
          </button>
          <button className="iact" title="إعادة توليد" aria-label="إعادة توليد">
            <Icon path={icons.redo} size={16} />
          </button>
          <button className="iact" title="مفيدة" aria-label="مفيدة">
            <Icon path={icons.up} size={16} />
          </button>
          <button className="iact" title="غير مفيدة" aria-label="غير مفيدة">
            <Icon path={icons.downv} size={16} />
          </button>
        </div>
      )}

      {done && message.follow && message.follow.length > 0 && (
        <div className="chips rise" style={{ marginTop: '.9rem' }}>
          {message.follow.map((f) => (
            <button className="chip" key={f} onClick={() => onFollow(f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  )
}
