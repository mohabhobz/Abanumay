import { useCallback, useEffect, useRef, useState } from 'react'

/* Client 7 Nov · «مايك لأي مكان فيه مساعد أبانمي» · speaking to the assistant instead of typing.

   One hook, every stage the person goes through, each with its own state so the composer can draw it:

   · idle        · the mic waits
   · asking      · the browser asks for the microphone (the first time only)
   · listening   · the mic is open · the live level drives the bars · the words appear as they are
                   heard (interim, quiet) and settle as each phrase is recognised (final)
   · understanding · the person stopped · the last phrase is settled and read back before it lands
   · error       · denied, no microphone, nothing heard, or a browser without speech recognition ·
                   each says what to do, in words

   Recognition is the browser's own (Web Speech API, `ar-SA`) · Chrome, Edge and Safari carry it;
   Firefox doesn't, and the hook says so instead of opening a mic it can't read. The level meter is a
   separate `getUserMedia` stream read through an AnalyserNode · it only draws, it never records or
   uploads. On the server the same contract would stream the audio to the foundation's speech model. */

export type VoiceStage = 'idle' | 'asking' | 'listening' | 'understanding' | 'error'

export interface VoiceState {
  stage: VoiceStage
  /** Settled words, in order */
  finalText: string
  /** The phrase still being heard · shown quieter, it may change */
  interim: string
  /** 0–1 · the microphone's level, smoothed · drives the bars */
  level: number
  /** Seconds since listening began */
  secs: number
  /** What went wrong, in words · set with stage «error» */
  error: string
  supported: boolean
}

/* the browser's recognizer, named loosely · not every TS lib carries the type */
type Rec = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start: () => void; stop: () => void; abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}
const RecCtor = (): (new () => Rec) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const SAY: Record<string, string> = {
  'not-allowed': 'لم يُسمح باستخدام الميكروفون · اسمح به من شريط العنوان ثم حاول مرة أخرى',
  'service-not-allowed': 'لم يُسمح باستخدام الميكروفون · اسمح به من شريط العنوان ثم حاول مرة أخرى',
  'audio-capture': 'لا يوجد ميكروفون متصل بالجهاز',
  'no-speech': 'لم نسمع شيئًا · تحدّث بعد ظهور «أستمع إليك»',
  network: 'تعذّر الاتصال بخدمة التعرّف على الكلام · تحقّق من الاتصال',
  unsupported: 'المتصفح لا يدعم الإملاء الصوتي · استخدم Chrome أو Edge أو Safari',
}

/** How long a silence closes the mic by itself, in ms */
const SILENCE_MS = 2600

export function useVoice({ onDone }: { onDone: (text: string, send: boolean) => void }) {
  const [s, setS] = useState<VoiceState>(() => ({
    stage: 'idle', finalText: '', interim: '', level: 0, secs: 0, error: '', supported: typeof window !== 'undefined' && Boolean(RecCtor()),
  }))
  const rec = useRef<Rec | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const timer = useRef(0)
  const silence = useRef(0)
  const started = useRef(0)
  const text = useRef('')
  const cancelled = useRef(false)
  /* «أرسل» closes the mic and sends · «إيقاف» closes it and leaves the words to review */
  const sendOnEnd = useRef(false)
  const done = useRef(onDone)
  done.current = onDone

  const release = useCallback(() => {
    cancelAnimationFrame(raf.current)
    window.clearInterval(timer.current)
    window.clearTimeout(silence.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    void ctx.current?.close().catch(() => undefined)
    ctx.current = null
  }, [])

  useEffect(() => () => { rec.current?.abort(); release() }, [release])

  const fail = useCallback((code: string) => {
    release()
    rec.current = null
    setS((x) => ({ ...x, stage: 'error', error: SAY[code] ?? 'تعذّر التعرّف على الكلام · حاول مرة أخرى', interim: '', level: 0 }))
  }, [release])

  /* the live level · RMS of the time-domain signal, eased so the bars breathe, not flicker */
  const meter = useCallback(async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new AC()
    ctx.current = ac
    /* a context made after the press may still start suspended on some browsers */
    if (ac.state === 'suspended') await ac.resume().catch(() => undefined)
    const an = ac.createAnalyser()
    an.fftSize = 512
    ac.createMediaStreamSource(stream.current).connect(an)
    const buf = new Uint8Array(an.fftSize)
    let lv = 0
    const tick = () => {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d }
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.2)
      lv = lv * 0.72 + rms * 0.28
      setS((x) => (x.stage === 'listening' ? { ...x, level: lv } : x))
      raf.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const armSilence = useCallback(() => {
    window.clearTimeout(silence.current)
    silence.current = window.setTimeout(() => rec.current?.stop(), SILENCE_MS)
  }, [])

  const start = useCallback(() => {
    const C = RecCtor()
    if (!C) { setS((x) => ({ ...x, stage: 'error', error: SAY.unsupported, supported: false })); return }
    if (rec.current) return
    cancelled.current = false
    sendOnEnd.current = false
    text.current = ''
    const r = new C()
    r.lang = 'ar-SA'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1
    r.onstart = () => {
      started.current = Date.now()
      setS((x) => ({ ...x, stage: 'listening', finalText: '', interim: '', secs: 0, error: '' }))
      timer.current = window.setInterval(() => setS((x) => ({ ...x, secs: Math.floor((Date.now() - started.current) / 1000) })), 250)
      armSilence()
      void meter()
    }
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const t = res[0].transcript
        if (res.isFinal) text.current = `${text.current} ${t}`.replace(/\s+/g, ' ').trim()
        else interim += t
      }
      setS((x) => ({ ...x, finalText: text.current, interim: interim.trim() }))
      armSilence()
    }
    r.onerror = (e) => { if (e.error !== 'aborted') fail(e.error) }
    r.onend = () => {
      release()
      rec.current = null
      if (cancelled.current) { setS((x) => ({ ...x, stage: 'idle', finalText: '', interim: '', level: 0 })); return }
      const got = text.current.trim()
      setS((x) => {
        if (x.stage === 'error') return x
        if (!got) return { ...x, stage: 'error', error: SAY['no-speech'], interim: '', level: 0 }
        return { ...x, stage: 'understanding', interim: '', level: 0 }
      })
      if (!got) return
      /* «يفهم كلامك» · a short beat while the last phrase settles, then the words land in the field */
      window.setTimeout(() => {
        done.current(got, sendOnEnd.current)
        setS((x) => (x.stage === 'understanding' ? { ...x, stage: 'idle', finalText: '' } : x))
      }, 900)
    }
    rec.current = r
    setS((x) => ({ ...x, stage: 'asking', error: '' }))
    try { r.start() } catch { fail('unsupported') }
  }, [armSilence, fail, meter, release])

  /** Close the mic and keep what was said · `send` sends it as soon as it is understood */
  const stop = useCallback((send = false) => { sendOnEnd.current = send; window.clearTimeout(silence.current); rec.current?.stop() }, [])
  /** Close the mic and drop what was said */
  const cancel = useCallback(() => {
    cancelled.current = true
    if (rec.current) rec.current.abort()
    else setS((x) => ({ ...x, stage: 'idle', finalText: '', interim: '', error: '' }))
    release()
  }, [release])
  const dismiss = useCallback(() => setS((x) => ({ ...x, stage: 'idle', error: '' })), [])

  return { ...s, start, stop, cancel, dismiss }
}
