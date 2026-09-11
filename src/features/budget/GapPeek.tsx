import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, icons, Money, Num, Tag } from '@/components/ui'
import { childSum, nodeAt, PLAN_LEVELS, type Imbalance, type PlanNode } from '@/data/budgetPlan'

/**
 * نافذة الفرق · **الإجابة بتيجي لك، إنت ما بتروحش لها**.
 *
 * الضغط على بند في «فحص التوازن» كان بيغيّر مسار الشجرة ويمرّر
 * الصفحة لتحت. وده مش منطقي من ناحيتين:
 *
 *   · **الضغطة وعدت بإجابة ودّتك لمكان.** اللي دوس بيسأل «طب فين
 *     الفرق ده؟»، فبيلاقي نفسه في نصّ الصفحة قدّام جدول لازم
 *     يقراه من الأول.
 *   · **الشجرة بتوَرّي الأبناء لا الفرق.** الفرق بين الأب وأبنائه
 *     محتاج الرقمين في نفس النظرة، والشجرة بتدّي واحد فيهم بس.
 *
 * النافذة بتحطّ الرقمين جنب بعض ومعاهم **كل ابن ونصيبه**، فالسؤال
 * بيتجاوب في مكانه. واللي عايز يشتغل على الشجرة لسّه ليه زرار.
 *
 * بورتال على الـ`body`: أي أب فيه `backdrop-filter` بيبقى الحاوية
 * لـ`position:fixed`، فالنافذة كانت هتقع جنب الكارت لا في نصّ
 * الشاشة.
 */
export function GapPeek({
  gap, root, onGoTree, onClose,
}: {
  gap: Imbalance
  root: PlanNode
  onGoTree: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const node = nodeAt(root, gap.path)
  const kids = node?.children ?? []
  const over = gap.gap > 0
  /* أكبر مخصص بين الأبناء هو المقياس · الشريط بيقول الحصّة النسبية
     من غير ما نكتب نسبة تانية جنب كل سطر */
  const max = Math.max(...kids.map((k) => k.alloc), 1)

  return createPortal(
    <>
      <div className="ascrim on" onClick={onClose} aria-hidden="true" />

      <div className="gpeek chrome" role="dialog" aria-label={`فرق ${gap.label || root.label}`}>
        <div className="gpeek-h">
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="sub">{PLAN_LEVELS[gap.level]}</span>
            <div className="atitle">{gap.label || root.label}</div>
          </div>
          <button className="aclose" onClick={onClose} aria-label="إغلاق">
            <Icon name={icons.close} size={16} />
          </button>
        </div>

        {/* الرقمان في نظرة واحدة · ده اللي الشجرة ما كانتش بتدّيه */}
        <div className="gpeek-n">
          <span className="gpeek-c">
            <span className="sub">مخصص للبند</span>
            <b><Money sm>{gap.alloc}</Money></b>
          </span>
          <span className="gpeek-op" aria-hidden="true">−</span>
          <span className="gpeek-c">
            <span className="sub">مجموع أبنائه</span>
            <b><Money sm>{gap.childSum}</Money></b>
          </span>
          <span className="gpeek-op" aria-hidden="true">=</span>
          <span className="gpeek-c">
            <span className="sub">الفرق</span>
            <Tag tone={over ? 'no' : 'warn'}>
              {over ? 'زيادة' : 'نقص'} <Money sm>{Math.abs(gap.gap)}</Money>
            </Tag>
          </span>
        </div>

        <p className="mut gpeek-w">
          {over
            ? 'الأبناء خُصِّص لهم أكثر من مخصص أبيهم، فالزيادة دي مصروفة من بند تاني بلا قيد.'
            : 'مخصص البند أكبر من مجموع أبنائه، فالفرق ده غير موزَّع ومش مربوط بهدف.'}
        </p>

        <div className="gpeek-b">
          <div className="gpeek-lb">
            <span>الأبناء</span>
            <span className="sub"><Num>{kids.length}</Num></span>
          </div>
          {kids.length === 0 ? (
            <p className="mut" style={{ margin: 0 }}>البند ده مالوش أبناء في الخطة.</p>
          ) : (
            <ul className="gpeek-l">
              {kids.map((k) => (
                <li key={k.id}>
                  <span className="gpeek-k" title={k.label}>{k.label}</span>
                  <span className="gpeek-t" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, Math.round((k.alloc / max) * 100))}%` }} />
                  </span>
                  <span className="gpeek-v"><Money sm>{k.alloc}</Money></span>
                </li>
              ))}
              <li className="gpeek-sum">
                <span className="gpeek-k">المجموع</span>
                <span className="gpeek-t empty" aria-hidden="true" />
                <span className="gpeek-v"><Money sm>{node ? childSum(node) : gap.childSum}</Money></span>
              </li>
            </ul>
          )}
        </div>

        {/* الفعل الأساسي هنا هو الانتقال للشجرة · «تمّ» مجرد
            مخرج، فمكانه بعده لا قبله */}
        <div className="gpeek-f">
          <button className="btn btn-p" onClick={onGoTree}>
            <Icon name={icons.chart} size={15} />
            افتحه في شجرة التخصيص
          </button>
          <button className="btn btn-2" onClick={onClose}>تمّ</button>
        </div>
      </div>
    </>,
    document.body,
  )
}
