import { useEffect, useRef, useState } from 'react'
import { Button, Icon, icons } from '@/components/ui'
import type { useVoice } from '@/hooks/useVoice'

/* Client 7 Nov · the assistant's voice input · the mic in the composer's row, and, while the mic is
   in use, the composer itself becomes one voice row (the client's reference): a prompt line above,
   then the mic, the timer, a running waveform of the voice, a pause and a send.

   · asking · «اسمح باستخدام الميكروفون» while the browser's prompt is open · the waveform lies flat
   · listening · «كيف أقدر أساعدك؟» · the waveform scrolls in from the mic as the voice arrives, a
     slow breath between words · the words heard so far under it, the phrase still being heard quieter
     · pause stops and leaves the words in the field to review · send stops and sends · the mic
     cancels · Esc cancels, Enter sends · a silence stops by itself
   · understanding · «أفهم كلامك» · the waveform settles into a travelling wave and the words read
     once from start to end, then they land (or go, after send)
   · error · a line that says what happened and what to do, with «حاول مرة أخرى» */

type Voice = ReturnType<typeof useVoice>

/* the history kept · more than the widest row draws · the row shows as many as fit (a bar and its gap, 4px) */
const N = 480
const STEP = 4
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

export function MicButton({ v, disabled }: { v: Voice; disabled?: boolean }) {
  return (
    <Button plain type="button" className="iact vmic" disabled={disabled}
      aria-label="تحدّث بدل الكتابة" title={v.supported ? 'تحدّث بدل الكتابة' : 'المتصفح لا يدعم الإملاء الصوتي'}
      onClick={() => v.start()}>
      <Icon name={icons.mic} size="sm" />
    </Button>
  )
}

/** The voice row · replaces the text box while the mic is open */
export function VoiceBar({ v }: { v: Voice }) {
  const listening = v.stage === 'listening'
  const understanding = v.stage === 'understanding'
  const lv = useRef(v.level)
  useEffect(() => { lv.current = v.level }, [v.level])
  /* the waveform's history · a sample every 70 ms, the newest beside the mic */
  const [hist, setHist] = useState<number[]>(() => Array(N).fill(0))
  /* Client 7 Nov · the waveform runs the whole row · a flat line to the far end until the voice
     fills it from the mic side, then it scrolls on */
  const wave = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState(56)
  useEffect(() => {
    const el = wave.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setFit(Math.max(8, Math.min(N, Math.floor((e.contentRect.width + 2) / STEP)))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!listening) return
    let k = 0
    const id = window.setInterval(() => {
      k++
      const breath = 0.1 + 0.08 * Math.abs(Math.sin(k * 0.45))
      const val = Math.min(1, Math.max(breath, lv.current * (0.75 + Math.random() * 0.5) * 1.8))
      setHist((h) => [val, ...h.slice(0, N - 1)])
    }, 70)
    return () => window.clearInterval(id)
  }, [listening])

  /* Esc cancels · Enter sends · only while the mic is open */
  useEffect(() => {
    if (v.stage !== 'listening' && v.stage !== 'asking') return
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); v.cancel() }
      if (e.key === 'Enter' && v.stage === 'listening') { e.preventDefault(); v.stop(true) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [v])

  const said = v.finalText || v.interim
  return (
    <div className={`vbar s-${v.stage}`} aria-live="polite">
      <p className="vbar-say">
        {v.stage === 'asking' ? 'اسمح باستخدام الميكروفون' : understanding ? 'أفهم كلامك…' : 'كيف أقدر أساعدك؟'}
      </p>
      <div className="vbar-row">
        <Button plain type="button" className="vround vmic-live" aria-label="إلغاء التسجيل" title="إلغاء · Esc" disabled={understanding} onClick={() => v.cancel()}>
          <Icon name={icons.mic} size="sm" />
        </Button>
        <span className="vbar-t num">{mmss(v.secs)}</span>
        <span className="vwave" aria-hidden="true" ref={wave}>
          {hist.slice(0, fit).map((h, i) => (
            <i key={i} style={understanding ? { animationDelay: `${(i % 14) * 50}ms` } : { transform: `scaleY(${Math.max(0.08, h)})` }} />
          ))}
        </span>
        <Button plain type="button" className="vround" aria-label="إيقاف ومراجعة الكلام" title="إيقاف · راجع الكلام قبل الإرسال"
          disabled={!listening} onClick={() => v.stop(false)}>
          <span className="vpause" aria-hidden="true"><i /><i /></span>
        </Button>
        <Button plain type="button" className="vround vsend" aria-label="أرسل" title="أرسل · Enter" disabled={!listening || !said} onClick={() => v.stop(true)}>
          <Icon name={icons.send} size="sm" />
        </Button>
      </div>
      {said && <p className={`vtext${understanding ? ' reading' : ''}`}>{v.finalText}{v.finalText && v.interim ? ' ' : ''}{v.interim && <span className="vint">{v.interim}</span>}</p>}
    </div>
  )
}

/** What went wrong · above the text box, which stays usable */
export function VoiceError({ v }: { v: Voice }) {
  if (v.stage !== 'error') return null
  return (
    <div className="vstrip err" role="alert">
      <Icon name={icons.alert} size="sm" />
      <span className="vstrip-say">{v.error}</span>
      <span className="pc-sp" />
      {v.supported && <Button type="button" variant="2" size="sm" onClick={() => v.start()}>حاول مرة أخرى</Button>}
      <Button plain type="button" className="iact" aria-label="إغلاق" onClick={() => v.dismiss()}><Icon name={icons.close} size="sm" /></Button>
    </div>
  )
}
