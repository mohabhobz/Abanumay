import { Tag } from '@/components/ui'
import { AppLayout } from '@/app/layout/AppLayout'
import { assistFor } from '@/data/mock/assistant'
import { AssistantAside } from '@/features/shared/AssistantAside'
import { boardReadings } from './model'
import { BoardBody } from './BoardBody'

/* The glass board · a trial (client, 6 Oct).

   Modelled on an infographic sheet the client sent: a hero map with glowing points and arcs, a
   column of progress rings, gradient bars, a region spotlight with a stage timeline, and
   overlapping area waves. The look is taken, the rules stay ours:
   · rings are donuts with the percent written on the arc (a knob at the arc's end), never a gauge
   · one axis on the waves (all three series are counts), time running right to left
   · colors from the chart tokens only, status colors kept for status
   · every shape has its number in text beside it, and the assistant keeps the end column alone
   It's the whole foundation's numbers, the same for every role. */

export default function GlassBoard() {
  return (
    <AppLayout assistantContext={assistFor.page('لوحة المؤشرات')}>
      <div className="viewstack">
        <div className="screen col hasg2">
          <header>
            <div>
              <h1 className="ptitle">لوحة المؤشرات <Tag tone="mute">تجريبية</Tag></h1>
              <p className="sub mt-1">أرقام المؤسسة كلها في صفحة واحدة · محسوبة من نفس سجلات الوحدات</p>
            </div>
          </header>
          <div className="g2">
            <BoardBody />
            <AssistantAside title="قراءة اللوحة" cta="اقرأ اللوحة" empty="لا ملاحظات على الأرقام الآن." readings={boardReadings()} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
