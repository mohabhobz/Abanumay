import { useEffect, useRef, type RefObject } from 'react'
import { Button, Icon, icons } from '@/components/ui'
import { useProximity } from '@/hooks/useProximity'
import { Disclaimer } from './Disclaimer'
import { toast } from '@/data/feedback'

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
  onStop: () => void
  busy: boolean
  inputRef?: RefObject<HTMLTextAreaElement | null>
  /** Pinned to the bottom of the screen after the first question. */
  docked?: boolean
  /**
   * Placeholder text in the field.
   * ⚠️ **This component isn't only for the assistant.** The correspondence thread between the
   * entity and the foundation used to draw its own input field (`.ask free`) — one line with two
   * buttons off to the side, which isn't the system's writing pattern or direction. The one shape
   * is this: a box that grows with the text, with the buttons in a row underneath.
   */
  placeholder?: string
  /** The correspondence thread takes the picked file itself (kept with the message) instead of
      writing its name into the text · the assistant keeps the name-in-text behavior */
  onAttach?: (file: File) => void
  /** Send is allowed without text · a message that carries only files */
  canSend?: boolean
}

/** Input box — grows with the text, and responds to the mouse before you reach it. */
export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  inputRef,
  docked,
  placeholder = 'اسأل عن مشروع، جهة، بند ميزانية…',
  onAttach,
  canSend,
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
          placeholder={placeholder}
          aria-label="اكتب رسالتك"
        />

        <div className="cbox-b">
          {/* 17 Oct · the attach button opens the picker and the file joins the message by name */}
          <label className="iact upbtn" title="إرفاق ملف" aria-label="إرفاق ملف">
            <Icon name={icons.clip} size="sm" />
            <input type="file" multiple={Boolean(onAttach)} onChange={(e) => {
              if (onAttach) {
                for (const f of Array.from(e.target.files ?? [])) onAttach(f)
                e.target.value = ''
                return
              }
              const f = e.target.files?.[0]
              if (!f) return
              onChange(`${value ? `${value} ` : ''}[مرفق: ${f.name}]`)
              toast(`أُرفق «${f.name}» · يُرسل مع رسالتك`)
              e.target.value = ''
            }} />
          </label>
          {busy ? (
            <Button plain className="go stop" onClick={onStop} title="إيقاف" aria-label="إيقاف">
              <span className="sq" />
            </Button>
          ) : (
            <Button plain
              className="go"
              onClick={() => onSend(value)}
              disabled={!value.trim() && !canSend}
              title="إرسال"
              aria-label="إرسال"
            >
              <Icon name={icons.send} />
            </Button>
          )}
        </div>
      </div>

      {docked && <Disclaimer />}
    </div>
  )
}
