// ═══ محرّك المساعد المشترك ═══
// نفس السلوك في شاشة المساعد الكاملة وفي اللوح الجانبي على أي صفحة.

import { useState, useEffect, useRef, useCallback } from 'react'
import { respond } from '../data/chat.js'
import { Icon, icons, Riyal, nf } from './ui.jsx'

const THINK_STEP_MS = 620
const TYPE_CHARS = 3
const TYPE_MS = 14

export function useAssistant() {
  const [msgs, setMsgs] = useState([])
  const busy = msgs.some((m) => m.state && m.state !== 'done')

  const send = useCallback((text) => {
    const q = String(text || '').trim()
    if (!q) return
    setMsgs((m) => [...m, { who: 'me', text: q }, { who: 'ai', ...respond(q), state: 'think', step: 0, chars: 0 }])
  }, [])

  /* خطوات التفكير واحدة ورا التانية، بعدين الكتابة حرف حرف */
  useEffect(() => {
    const i = msgs.findIndex((m) => m.state && m.state !== 'done')
    if (i === -1) return
    const m = msgs[i]
    const patch = (p) => setMsgs((all) => all.map((x, j) => (j === i ? { ...x, ...p } : x)))

    if (m.state === 'think') {
      const steps = m.think || []
      if (m.step < steps.length) {
        const t = setTimeout(() => patch({ step: m.step + 1 }), THINK_STEP_MS)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => patch({ state: 'type' }), 260)
      return () => clearTimeout(t)
    }
    if (m.state === 'type') {
      const full = m.text || ''
      if (m.chars < full.length) {
        const t = setTimeout(() => patch({ chars: Math.min(full.length, m.chars + TYPE_CHARS) }), TYPE_MS)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => patch({ state: 'done' }), 200)
      return () => clearTimeout(t)
    }
  }, [msgs])

  const stop = () =>
    setMsgs((all) => all.map((m) => (m.state && m.state !== 'done' ? { ...m, state: 'done', chars: (m.text || '').length } : m)))

  const reset = () => setMsgs([])

  return { msgs, send, stop, reset, busy }
}

/* ═══ رسالة المساعد ═══ */
export function AiMessage({ m, onFollow }) {
  const [openThink, setOpenThink] = useState(true)
  const [copied, setCopied] = useState(false)
  const thinking = m.state === 'think'
  const typing = m.state === 'type'
  const done = m.state === 'done'
  const shown = typing ? (m.text || '').slice(0, m.chars) : m.text || ''

  useEffect(() => {
    if (done) setOpenThink(false)
  }, [done])

  const copy = () => {
    navigator.clipboard?.writeText(m.text || '').catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="cmsg ai">
      {/* التفكير — بيقول إيه المصادر اللي اتفتحت، مش زينة */}
      {m.think?.length > 0 && (
        <div className={`think${thinking ? ' live' : ''}`}>
          <button className="th-head" onClick={() => setOpenThink((v) => !v)}>
            <span className="aispark th-spark" />
            <span>{thinking ? 'يفكّر' : `فكّر في ${m.think.length} خطوات`}</span>
            {thinking && <span className="dots"><i /><i /><i /></span>}
            <Icon path={icons.chevron} size={16} style={{ transform: openThink ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          </button>
          {openThink && (
            <div className="th-body">
              {m.think.slice(0, thinking ? m.step : m.think.length).map((s, i) => (
                <div className="th-step" key={i} style={{ '--d': `${i * 60}ms` }}>
                  <span className="th-dot" />
                  {s}
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

      {done && m.block && <Block b={m.block} />}
      {done && m.more && <div className="ctext rise">{md(m.more)}</div>}

      {done && m.advisory && (
        <div className="advisory rise">
          <Icon path={icons.alert} size={16} />
          قراءة استرشادية — القرار والتوقيع يفضلوا عليك.
        </div>
      )}

      {done && m.sources?.length > 0 && (
        <div className="csrc rise">
          <span className="lb">المصادر</span>
          {m.sources.map((s) => (
            <span className="srcchip" key={s}>{s}</span>
          ))}
        </div>
      )}

      {done && (
        <div className="cact rise">
          {m.actions?.map((a) => (
            <button className={`btn ${a.kind} btn-sm`} key={a.label}>{a.label}</button>
          ))}
          <span className="cact-sp" />
          <button className="iact" onClick={copy} title="نسخ">
            <Icon path={copied ? icons.check : icons.copy} size={16} />
          </button>
          <button className="iact" title="إعادة توليد"><Icon path={icons.redo} size={16} /></button>
          <button className="iact" title="مفيدة"><Icon path={icons.up} size={16} /></button>
          <button className="iact" title="غير مفيدة"><Icon path={icons.downv} size={16} /></button>
        </div>
      )}

      {done && m.follow?.length > 0 && (
        <div className="chips rise" style={{ marginTop: '.9rem' }}>
          {m.follow.map((f) => (
            <button className="chip" key={f} onClick={() => onFollow(f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ═══ بلوكات الأدلة ═══ */
export function Block({ b }) {
  if (b.kind === 'meter') {
    const pct = Math.round((b.limit / b.value) * 100)
    return (
      <div className="cblock rise">
        <div className="cb-h">
          <span className="lb">{b.label}</span>
          <span className="cb-v num">{nf.format(b.value)} <small>ساعة</small></span>
        </div>
        <div className="bar over"><i style={{ width: '100%' }} /><u style={{ insetInlineStart: `${pct}%` }} /></div>
        <div className="cb-f">
          <span className="sub">الحدّ <span className="num">{nf.format(b.limit)}</span></span>
          <span className="sub bad">{b.note}</span>
        </div>
      </div>
    )
  }

  if (b.kind === 'stats') {
    return (
      <div className="cblock rise cb-stats">
        {b.items.map((s) => (
          <div key={s.k}>
            <div className="lb">{s.k}</div>
            <div className="cb-n num">{s.v}</div>
            <div className="sub">{s.u}</div>
          </div>
        ))}
      </div>
    )
  }

  if (b.kind === 'ledger') {
    return (
      <div className="cblock rise">
        <div className="cb-led">
          {b.rows.map((r) => (
            <div key={r.k} className={r.strong ? 'strong' : ''}>
              <span>{r.k}</span>
              <span className="num">{r.v} <Riyal /></span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (b.kind === 'bars') {
    return (
      <div className="cblock rise">
        <div className="cb-bars">
          {b.items.map((it) => (
            <div key={it.k}>
              <div className="cb-bl">
                <span>{it.k}</span>
                <span className="num">{it.real}٪</span>
              </div>
              <div className="bar"><i style={{ width: `${it.real}%`, background: 'var(--teal)' }} /></div>
            </div>
          ))}
        </div>
        {b.note && <div className="sub" style={{ marginTop: '.6rem' }}>{b.note}</div>}
      </div>
    )
  }

  if (b.kind === 'list') {
    return (
      <div className="cblock rise">
        <div className="cb-list">
          {b.items.map((it) => (
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
  return null
}

/* ═══ الكتابة ═══ */
export function Composer({ value, onChange, onSend, onStop, busy, inputRef, docked }) {
  const ta = useRef(null)
  const box = useRef(null)

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 190) + 'px'
  }, [value])

  /* نفس تفاعل شريط القرار: بيحسّ بالماوس قبل ما توصله فيرتفع،
     والضوء بيتبع مكان المؤشر. */
  useEffect(() => {
    const el = box.current
    if (!el) return
    const REACH = 260
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const dy = Math.max(0, r.top - e.clientY)
      el.style.setProperty('--near', Math.max(0, 1 - dy / REACH).toFixed(3))
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    }
    const onLeave = () => el.style.setProperty('--near', '0')
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div className={`composer${docked ? ' docked' : ''}`}>
      <div className="cbox chrome float" ref={box}>
        <textarea
          ref={(el) => {
            ta.current = el
            if (inputRef) inputRef.current = el
          }}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend(value)
            }
          }}
          placeholder="اسأل عن مشروع، جهة، بند ميزانية…"
          aria-label="اكتب رسالتك"
        />
        <div className="cbox-b">
          <button className="iact" title="إرفاق ملف"><Icon path={icons.clip} size={16} /></button>
          <span className="cbox-hint sub">Enter للإرسال · Shift+Enter سطر جديد</span>
          {busy ? (
            <button className="go stop" onClick={onStop} title="إيقاف"><span className="sq" /></button>
          ) : (
            <button className="go" onClick={() => onSend(value)} disabled={!value.trim()} title="إرسال">
              <Icon path={icons.send} />
            </button>
          )}
        </div>
      </div>
      <div className="cdisc sub">قد يخطئ المساعد — راجع الأرقام قبل أي قرار.</div>
    </div>
  )
}

/* ماركداون خفيف: **بولد** وأسطر وبوليت */
export function md(t) {
  return String(t)
    .split('\n')
    .map((line, i) => {
      if (!line.trim()) return <div key={i} className="mdbr" />
      const bullet = line.trim().startsWith('•')
      const parts = line.split('**')
      return (
        <div key={i} className={bullet ? 'mdli' : 'mdp'}>
          {parts.map((p, j) => (j % 2 ? <b key={j}>{p}</b> : <span key={j}>{p}</span>))}
        </div>
      )
    })
}
