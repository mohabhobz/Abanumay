import { useEffect, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { onToast, toast, type ToastMsg } from '@/data/feedback'

/* The one place a toast is drawn · bottom of the screen, above the decision bar · three at most,
   each gone after a few seconds or on a press · announced to a screen reader (aria-live) */
const LIFE = 3600

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([])
  useEffect(() => onToast((m) => {
    setList((x) => [...x.slice(-2), m])
    window.setTimeout(() => setList((x) => x.filter((y) => y.id !== m.id)), LIFE)
  }), [])
  /* A press on a control that can't act now is answered too · with its own reason (its title, the
     switch's lock note) instead of silence · pointer events still reach a disabled control */
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('button:disabled, [aria-disabled="true"], .swrow.off, .fsel.off')
      if (!el) return
      const why = el.getAttribute('title') || el.querySelector('.swrow-n')?.textContent || el.getAttribute('aria-label')
      toast(why ? `غير متاح الآن · ${why}` : 'غير متاح الآن', 'info')
    }
    document.addEventListener('pointerup', onUp, true)
    return () => document.removeEventListener('pointerup', onUp, true)
  }, [])
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((m) => (
        <button type="button" key={m.id} className={`toast toast-${m.tone}`} onClick={() => setList((x) => x.filter((y) => y.id !== m.id))} aria-label={`${m.text} · إغلاق`}>
          <Icon name={m.tone === 'ok' ? icons.check : m.tone === 'bad' ? icons.close : icons.info} size="sm" />
          <span>{m.text}</span>
        </button>
      ))}
    </div>
  )
}
