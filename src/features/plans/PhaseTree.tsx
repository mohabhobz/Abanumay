import { DateText, Icon, Money, Num, Tag, icons } from '@/components/ui'
import {
  ACTIVITY_SAY, ACTIVITY_TONE, TODAY, phaseDone,
} from '@/data/mock/plans'
import { isolate, pct } from '@/lib/format'
import type { PlanActivity, PlanPhase } from '@/types/domain'

/* ═══════════════════════════════════════════════════════════
   شجرة المراحل والأنشطة · قلب الخطة

   ⚠️ **المرحلة مطوية على أنشطتها والأنشطة ظاهرة.** ده عكس
   الافتراضي في جداولنا (التجميع بيبدأ مطويًّا)، والسبب إن السؤال
   هنا مش «فيه كام مرحلة» · هو «أنهي نشاط واقف». المرحلة اللي كل
   أنشطتها اتقبلت بتتطوي لوحدها، لأنها خلصت فعلًا.

   ⚠️ **والنشاط المتأخّر بيتوسم من تاريخه لا من حالته.** النشاط
   ممكن يكون «جارٍ» وموعده عدّى من شهر · وحالته بتقول إن في شغل،
   وتاريخه بيقول إن الشغل ده اتأخّر. الاتنين معلومة مختلفة.

   ⚠️ **وزرارا القبول والرفض على النشاط نفسه لا في رصيف الصفحة.**
   الرصيف بياخد قرارًا واحدًا للمستند كله، والمراجعة هنا **نشاطًا
   نشاطًا** · قرار في الرصيف كان هيقبل الشواهد كلها بضغطة، وده
   بالظبط اللي القاعدة 14 موجودة تمنعه.
   ═══════════════════════════════════════════════════════════ */

export interface PhaseTreeProps {
  phases: PlanPhase[]
  /** الخطة معتمدة · قبل كده مفيش مراجعة أنشطة أصلًا */
  live: boolean
  /** المستخدم الحالي مشرف المنح · هو وحده اللي بيقبل ويرفض */
  canReview: boolean
  /** الجهة بتقدر تحدّث نشاطها · بوّابة الجهة */
  canClaim?: boolean
  open: Set<string>
  onToggle: (id: string) => void
  onAccept?: (actId: string) => void
  onReject?: (actId: string) => void
  onClaim?: (actId: string) => void
  /** رفع شاهد · بوّابة الجهة وحدها */
  onUpload?: (actId: string, kind: string) => void
  /** النشاط اللي الصفحة بتودّي له · بيتوسم لحظة */
  focus?: string
}

const isLate = (a: PlanActivity) => a.state !== 'accepted' && a.to < TODAY

export function PhaseTree({
  phases, live, canReview, canClaim, open, onToggle, onAccept, onReject, onClaim,
  onUpload, focus,
}: PhaseTreeProps) {
  return (
    <div className="phtree">
      {phases.map((ph, i) => {
        const done = phaseDone(ph)
        const shut = !open.has(ph.id)
        const queue = ph.activities.filter((a) => a.state === 'claimed').length
        const late = ph.activities.filter(isLate).length

        return (
          <section className="phase" key={ph.id}>
            <button
              type="button"
              className="phase-h"
              aria-expanded={!shut}
              onClick={() => onToggle(ph.id)}
            >
              <Icon name={shut ? icons.chevronDown : icons.chevronUp} size={15} />
              <span className="phase-n num">{i + 1}</span>
              <span className="phase-t">{ph.name || 'مرحلة بلا اسم'}</span>

              <span className="phase-d sub">
                <DateText>{ph.from}</DateText> ← <DateText>{ph.to}</DateText>
              </span>

              <span className="phase-c"><Money sm>{ph.cost}</Money></span>

              {/* النسبة من المقبول وحده · قاعدة 14 */}
              <Tag tone={done === 100 ? 'ok' : done > 0 ? 'ret' : 'mute'}>
                {pct(done)}
              </Tag>
              {queue > 0 && <Tag tone="warn"><Num>{queue}</Num> مستنّي</Tag>}
              {late > 0 && <Tag tone="no"><Num>{late}</Num> متأخّر</Tag>}
            </button>

            {!shut && (
              <ul className="acts">
                {ph.activities.length === 0 && (
                  <li className="act">
                    <span className="sub">
                      المرحلة بلا أنشطة · المرحلة بتتقاس بأنشطتها، فمفيش حاجة تتراجع.
                    </span>
                  </li>
                )}
                {ph.activities.map((a) => (
                  <li
                    className={`act${a.id === focus ? ' on' : ''}${isLate(a) ? ' late' : ''}`}
                    key={a.id}
                    id={`act-${a.id}`}
                  >
                    <div className="act-h">
                      <span className="act-t">{a.name}</span>
                      <Tag tone={ACTIVITY_TONE[a.state]}>{ACTIVITY_SAY[a.state]}</Tag>
                      {/* ⚠️ التأخير وسم مستقلّ عن الحالة · «جارٍ»
                          وموعده عدّى من شهر معلومتان مختلفتان */}
                      {isLate(a) && <Tag tone="no">عدّى موعده</Tag>}
                      <span className="pc-sp" />
                      <span className="sub act-w">
                        الوزن <span className="num">{a.weight}</span>
                      </span>
                    </div>

                    <div className="act-m sub">
                      <DateText>{a.from}</DateText> ← <DateText>{a.to}</DateText>
                      {a.doneAt && <> · قُبِل <DateText>{a.doneAt}</DateText></>}
                    </div>

                    {/* الشواهد المطلوبة مقابل المرفوع · التحقّق
                        ظاهر في السطر لا مخبّى في فتح النشاط */}
                    <ul className="act-ev">
                      {a.needs.map((need) => {
                        const got = a.evidence.find((e) => e.kind === need)
                        return (
                          <li key={need} className={got ? 'ok' : 'no'}>
                            <Icon name={got ? icons.check : icons.alert} size={13} />
                            <span>{need}</span>
                            {got
                              ? <span className="sub act-f">{got.fileName}</span>
                              : <span className="sub act-f">لم يُرفع</span>}
                            {/* ⚠️ **الرفع جنب الشاهد الناقص نفسه، لا
                                في زرار واحد فوق.** زرار «ارفع مرفقًا»
                                عام بيخلّي الجهة ترفع ملفًا وتختار نوعه،
                                والاختيار الغلط بيرجّع النشاط · والزرار
                                هنا بيعرف نوعه أصلًا من السطر اللي هو
                                فيه، فمفيش اختيار يتغلط فيه. */}
                            {live && canClaim && !got && onUpload && (
                              <button
                                className="btn btn-ghost btn-sm act-up"
                                onClick={() => onUpload(a.id, need)}
                              >
                                <Icon name={icons.upload} size={13} />
                                ارفع
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {a.note && (
                      <div className="payq-note">
                        <Icon name={icons.chat} size={14} />
                        <span>{isolate(a.note)}</span>
                      </div>
                    )}

                    {/* ⚠️ القرار على النشاط · والقبول مقفول لو
                        شاهد مطلوب ناقص، والسبب مكتوب في التلميح */}
                    {live && canReview && a.state === 'claimed' && (
                      <div className="act-a">
                        {(() => {
                          const missing = a.needs.filter(
                            (n) => !a.evidence.some((e) => e.kind === n),
                          )
                          return (
                            <>
                              <button
                                className="btn btn-p btn-sm"
                                disabled={missing.length > 0}
                                title={missing.length > 0
                                  ? `ناقص: ${missing.join(' · ')}`
                                  : 'يُحتسب إنجازًا من لحظة القبول · قاعدة 14'}
                                onClick={() => onAccept?.(a.id)}
                              >
                                اقبل النشاط
                              </button>
                              <button
                                className="btn btn-2 btn-sm"
                                onClick={() => onReject?.(a.id)}
                              >
                                أعِده بملاحظة
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    )}

                    {/* بوّابة الجهة · «خلصت» بتقول claimed لا accepted */}
                    {live && canClaim
                      && (a.state === 'doing' || a.state === 'todo' || a.state === 'rejected') && (
                      <div className="act-a">
                        <button
                          className="btn btn-2 btn-sm"
                          disabled={a.needs.some((n) => !a.evidence.some((e) => e.kind === n))}
                          title={a.needs.some((n) => !a.evidence.some((e) => e.kind === n))
                            ? 'ارفع الشواهد المطلوبة الأول'
                            : 'المشرف هو اللي بيحتسبه إنجازًا بعد المراجعة'}
                          onClick={() => onClaim?.(a.id)}
                        >
                          خلّصت النشاط · للمراجعة
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
