import { useEffect, useState } from 'react'
import { Button, Icon, icons } from '@/components/ui'
import { onToast, onToastGone, toast, type ToastMsg, type ToastTone } from '@/data/feedback'

/* The one place a message is drawn, for the whole system · the foot of the screen, centred, above
   the decision bar · three at most · announced to a screen reader.

   Audit 26 Nov · one shape for every message: the same capsule, the same icon for the same tone, a
   close (×) at its end · the sign-in screens used to draw their own (a red strip over the logo, a
   pill at the top) with other icons · they now send their messages here too.
   · a passing note leaves on its own after a few seconds
   · a sticky one (an error the user must read) stays until closed, or until its screen takes it
     back (`dismissToast(key)`) · a new one with the same key replaces it */
const LIFE = 3600
const ICON: Record<ToastTone, typeof icons.check> = { ok: icons.check, warn: icons.alert, bad: icons.alert, info: icons.info }

export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([])
  const drop = (id: number) => setList((x) => x.filter((y) => y.id !== id))
  useEffect(() => onToast((m) => {
    setList((x) => [...x.filter((y) => !m.key || y.key !== m.key).slice(-2), m])
    if (!m.sticky) window.setTimeout(() => drop(m.id), LIFE)
  }), [])
  useEffect(() => onToastGone((key) => setList((x) => x.filter((y) => y.key !== key))), [])
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
    <div className="toasts" aria-live="polite">
      {list.map((m) => (
        <div key={m.id} className={`toast toast-${m.tone}`} role={m.tone === 'bad' ? 'alert' : 'status'}>
          <Icon name={ICON[m.tone]} size="sm" />
          <span>{m.text}</span>
          <Button plain type="button" className="toast-x" aria-label="إغلاق الرسالة" onClick={() => drop(m.id)}>
            <Icon name={icons.close} size="sm" />
          </Button>
        </div>
      ))}
    </div>
  )
}
