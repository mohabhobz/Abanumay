import { useEffect, useRef, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import {
  useAssistant, AiMessage, Composer, Disclaimer, Welcome, type AssistantContext,
} from '@/components/assistant'
import { fixtures } from '@/data/repository'
import { useScrollEdges } from '@/hooks/useScrollEdges'

const FALLBACK_CONTEXT: AssistantContext = {
  title: 'منح أبانمي',
  sub: '',
  scope: 'كيف أقدر أساعدك في السيستم؟',
  cards: [
    {
      icon: 'alert',
      title: 'إيه اللي بانتظار قراري؟',
      sub: 'الواقف عندي أنا لا عند غيري',
      prompt: 'إيه اللي بانتظار قراري؟',
    },
  ],
}

export interface AssistantPanelProps {
  open: boolean
  onClose: () => void
  /** يفتح نفس المحادثة في الشاشة الكاملة */
  onFull: () => void
  /** عنوان اللوح وترحيبه واختصاراته — بتيجي من الصفحة المفتوح منها */
  ctx?: AssistantContext
}

/**
 * لوح المساعد — بيفتح من أي صفحة على الجانب الشمال.
 * العنوان اسم الشيء اللي أنت فيه، مش «مساعد أبانمي»، والاختصارات
 * من نفس السياق — فالمستخدم يسأل عن اللي قدامه بضغطة.
 *
 * وحالته الأولى **هي نفسها** حالة الشاشة الكاملة (`Welcome`): نفس
 * الشرارة ونفس الترحيب ونفس ترتيب الكتابة والكروت. اللي بيتغيّر سطر
 * المدى والكروت — يعني الكلام اللي بيقول هيدوّر فين. قبل كده كان
 * اللوح شكلًا تانيًا أصغر، فالمستخدم يحسّ إنه فتح مساعدًا مختصرًا لا
 * نفس المساعد في مكان أضيق.
 */
export function AssistantPanel({ open, onClose, onFull, ctx = FALLBACK_CONTEXT }: AssistantPanelProps) {
  const { msgs, send, stop, reset, busy } = useAssistant()
  const [draft, setDraft] = useState('')
  const first = fixtures.currentUser.name.split(' ')[0]

  const body = useRef<HTMLDivElement>(null)
  const { edges, measure } = useScrollEdges(body)

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight
    measure()
  }, [msgs, open, measure])

  const ask = (text: string) => {
    if (busy) return
    setDraft('')
    send(text)
  }

  return (
    <>
      <div className={`ascrim${open ? ' on' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside
        className={`apanel chrome${open ? ' on' : ''}`}
        role="dialog"
        aria-label={`مساعد · ${ctx.title}`}
        aria-hidden={!open}
      >
        <div className="ahead">
          <span className="badge badge-30"><span className="aispark" /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="atitle">{ctx.title}</div>
            <div className="sub">{ctx.sub}</div>
          </div>

          {msgs.length > 0 && (
            <button className="aclose" onClick={reset} title="محادثة جديدة" aria-label="محادثة جديدة">
              <Icon path={icons.plus} size={16} />
            </button>
          )}
          <button className="aclose" onClick={onFull} title="فتح كصفحة كاملة" aria-label="فتح كصفحة كاملة">
            <Icon path={icons.expand} size={16} />
          </button>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon path={icons.close} size={16} />
          </button>
        </div>

        {/* بدل الخطوط الفاصلة: تدرّج بيظهر لما يكون في كلام مخفي في اتجاهه */}
        <div className={`abodywrap${edges.top ? ' fadetop' : ''}${edges.bottom ? ' fadebot' : ''}`}>
          <div className="abody" ref={body} onScroll={measure}>
            {msgs.length === 0 ? (
              <Welcome
                compact
                greet={`أهلًا ${first}`}
                sub={ctx.scope}
                cards={ctx.cards}
                onPick={ask}
                composer={
                  <Composer value={draft} onChange={setDraft} onSend={ask} onStop={stop} busy={busy} />
                }
              />
            ) : (
              msgs.map((m, i) =>
                m.who === 'me' ? (
                  <div className="cmsg me" key={i}>{m.text}</div>
                ) : (
                  <AiMessage key={i} message={m} onFollow={ask} />
                ),
              )
            )}
          </div>
        </div>

        {/* مربع الكتابة بينزل للرصيف بعد أول سؤال بس — قبله هو جوّه
            الترحيب زي الشاشة الكاملة، وواحد بيكفي. */}
        <div className="afoot">
          {msgs.length > 0 && (
            <Composer value={draft} onChange={setDraft} onSend={ask} onStop={stop} busy={busy} />
          )}
          <Disclaimer />
        </div>
      </aside>
    </>
  )
}
