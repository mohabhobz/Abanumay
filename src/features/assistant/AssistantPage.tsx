import { useNavigate } from 'react-router-dom'
import { Background, MobileTop, Rail } from '@/components/shell'
import { roles, type AssistantRole } from '@/data/mock/assistant'
import { fixtures } from '@/data/repository'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { ROUTES } from '@/app/routes'
import { signOut } from '@/data/session'
import { AssistantScreen } from './AssistantScreen'

/**
 * مساعد أبانمي · الشاشة الكاملة على مسارها.
 *
 * الصفحة دي بقت **إطارًا**: خلفية وريل وشاشة المساعد. كل اللي
 * كان مكتوبًا هنا (القايمة والترويسة والترحيب والكتابة والكروت)
 * نزل `AssistantScreen`، لأن اللوح اللي بيفتح من أي صفحة بقى
 * بيعرض **نفس الشاشة** · فلو فضلت مكتوبة هنا، لازم تتكتب هناك
 * تاني، وأي تعديل بعد كده يتعمل مرتين.
 *
 * ومحكومة بثلاث قواعد من الوثيقة والمكالمة:
 * 1 · مخرجات AI مساندة وغير مُلزِمة، فكل إجابة فيها قرار بتتعلّم في الواجهة.
 * 2 · «لو الـAI هو المدخل الوحيد، اليوزر ممكن يتسحل في فلو ما يجاوبوش»،
 *     فالكروت اختصارات نتيجتها معروفة مش دعوات لمحادثة مفتوحة.
 * 3 · التثبيت والبحث في المحادثات جزء أساسي مش زينة.
 */
export default function AssistantPage() {
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const role = roles[0] as AssistantRole
  const out = () => { signOut(); navigate(ROUTES.login, { replace: true }) }

  return (
    <>
      <Background />
      <div className="app">
        {mobile && <MobileTop user={fixtures.currentUser} onSignOut={out} />}

        <div className="shell">
          {/* شاشة المساعد كلها للمحادثة · الشريط مقفول هنا دايمًا */}
          <Rail user={fixtures.currentUser} onSignOut={out} shut />

          <AssistantScreen
            greet={role.greet}
            /* المدى هنا السيستم كله · دي الصفحة اللي مالهاش سياق
               صفحة قبلها، فالسؤال مفتوح */
            sub="كيف أقدر أساعدك اليوم؟"
            cards={role.cards}
            onClose={() => navigate(-1)}
            focusOnMount
          />
        </div>
      </div>
    </>
  )
}
