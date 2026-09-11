import { useEffect, useState } from 'react'
import { Icon, icons } from '@/components/ui'
import { Background } from '@/components/shell'
import type { AssistantContext } from '@/components/assistant'
import { fixtures } from '@/data/repository'
import { AssistantScreen } from './AssistantScreen'

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

export interface AssistantOverlayProps {
  open: boolean
  onClose: () => void
  /** ترحيب الصفحة وكروتها · **ده وحده اللي بيتغيّر من صفحة لصفحة** */
  ctx?: AssistantContext
}

/**
 * مساعد أبانمي فوق الصفحة اللي أنت فيها.
 *
 * ═══ نفس الشاشة، مش شاشة تانية ═══
 *
 * اللي كان هنا لوحًا جانبيًّا بترويسة خاصة وبلا قايمة محادثات ·
 * يعني المستخدم اللي بيدوس «اسأل أبانمي» من صفحة المشروع كان
 * بيدخل مساعدًا **تانيًا**: محادثاته المحفوظة مش معاه، والشكل مش
 * اللي شافه أول ما دخل النظام. دلوقتي بيفتح `AssistantScreen`
 * نفسها اللي على `/assistant` · نفس القايمة ونفس الترويسة ونفس
 * الترحيب ونفس الكروت.
 *
 * **واللي بيتغيّر الكونتنت وحده:** سطر المدى («كيف أقدر أساعدك في
 * «اسم المشروع»؟») والكروت الأربعة. الترحيب الشخصي بييجي من
 * المستخدم لأنه ثابت في كل الصفحات، والتشكيل ما بيتغيّرش خالص.
 *
 * ═══ بيفتح كامل، والزرار بيصغّره ═══
 *
 * الفتحة بتبدأ على المساحة الكاملة (السؤال محتاج مكان)، والزرار
 * بيصغّره للوح جانبي لمّا المستخدم يحبّ يشوف الصفحة وهو بيسأل ·
 * يعني الزرار **مبدّل مقاس** لا انتقال، والحالتان في نفس المحادثة
 * ونفس المكوّن. والصغير بيخفي القايمة بس · مش شكلًا تالتًا.
 *
 * وكل فتحة جديدة بتبدأ كاملة، واللي قبلها بيتصفّر خالص
 * (`key={runs}`): اللي صغّره المرة اللي فاتت كان بيصغّره لسبب في
 * وقته، والسؤال اللي سأله كان عن صفحة تانية.
 */
export function AssistantOverlay({ open, onClose, ctx = FALLBACK_CONTEXT }: AssistantOverlayProps) {
  const [wide, setWide] = useState(true)
  /* عدّاد الفتحات · بيتغيّر مع كل فتحة فالشاشة بتتبني من جديد
     بحالتها الابتدائية، من غير ما المكوّن يعرف إنه في لوح */
  const [runs, setRuns] = useState(0)
  useEffect(() => {
    if (!open) return
    setWide(true)
    setRuns((n) => n + 1)
  }, [open])

  const first = fixtures.currentUser.name.split(' ')[0]

  return (
    <>
      {/* التعتيم للوح الضيّق وحده · الكامل مش لوح فوق صفحة، هو
          الشاشة نفسها والريل جنبه شغّال، فتعتيمه بيقول غير الحقيقة */}
      <div
        className={`ascrim${open && !wide ? ' on' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`apanel${open ? ' on' : ''}${wide ? ' wide' : ''}`}
        role="dialog"
        aria-label={`مساعد · ${ctx.title}`}
        aria-hidden={!open}
      >
        {open && wide && <Background />}
        {open && (
          <AssistantScreen
            key={runs}
            greet={`أهلًا ${first}`}
            sub={ctx.scope}
            cards={ctx.cards}
            onClose={onClose}
            focusOnMount
            headExtra={(
              <button
                className="aclose"
                onClick={() => setWide((v) => !v)}
                title={wide ? 'تصغير للوح الجانبي' : 'فرد على الشاشة'}
                aria-label={wide ? 'تصغير للوح الجانبي' : 'فرد على الشاشة'}
                aria-pressed={wide}
              >
                <Icon name={wide ? icons.shrink : icons.expand} size={16} />
              </button>
            )}
          />
        )}
      </aside>
    </>
  )
}
