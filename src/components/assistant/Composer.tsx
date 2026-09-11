import { useEffect, useRef, type RefObject } from 'react'
import { Icon, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { Disclaimer } from './Disclaimer'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
  onStop: () => void
  busy: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
  /** مثبّت أسفل الشاشة بعد أول سؤال */
  docked?: boolean
}

/** مربع الكتابة · بيكبر مع النص، وبيحسّ بالماوس قبل ما توصله */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  inputRef,
  docked,
}: ComposerProps) {
  const area = useRef<HTMLTextAreaElement | null>(null)
  const box = useRef<HTMLDivElement | null>(null)

  useProximity(box)

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`
  }, [value])

  return (
    <div className={`composer${docked ? ' docked' : ''}`}>
      <div className="cbox chrome float" ref={box}>
        <textarea
          ref={(el) => {
            area.current = el
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
          <button className="iact" title="إرفاق ملف" aria-label="إرفاق ملف">
            <Icon name={icons.clip} size={16} />
          </button>
          {busy ? (
            <button className="go stop" onClick={onStop} title="إيقاف" aria-label="إيقاف">
              <span className="sq" />
            </button>
          ) : (
            <button
              className="go"
              onClick={() => onSend(value)}
              disabled={!value.trim()}
              title="إرسال"
              aria-label="إرسال"
            >
              <Icon name={icons.send} />
            </button>
          )}
        </div>
      </div>

      {docked && <Disclaimer />}
    </div>
  )
}
