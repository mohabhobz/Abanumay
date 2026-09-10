import { useMemo, useState } from 'react'
import { Empty, Glass, Head, Icon, icons, Mono, Segments } from '@/components/ui'
import { DocFile } from '@/components/docs'
import type { ActorKind, LogEvent } from '@/data/mock/log'

export interface LogTabProps {
  events: LogEvent[]
  entityName: string
}

/** فلاتر السجل — الأسئلة اللي بتتسأل عليه فعلًا */
const VIEWS = [
  { key: 'all', label: 'كل الأحداث' },
  { key: 'decision', label: 'القرارات' },
  { key: 'money', label: 'المال' },
  { key: 'entity', label: 'من الجهة' },
  { key: 'late', label: 'تجاوز الحدّ' },
] as const

const MONEY = /إذن صرف|صرف الدفعة|سند القبض|سند القيد/
const DECISION = /اعتماد|دعم|رفض|معتذر|توصية|إرجاع|رفع المشروع|قبول/

/** عدد الحقول اللي فيها قيمة فعلًا — «ملاحظات» فاضية مش حقلًا */
const fieldCount = (e: LogEvent) => e.fields.filter((f) => f.v).length

const ACTOR: Record<ActorKind, string> = {
  staff: 'موظف',
  entity: 'الجهة',
  committee: 'قرار جماعي',
  system: 'النظام',
}

/**
 * سجل المشروع.
 *
 * القيد **مصنَّف**: كل نوع إجراء له حقوله. «دراسة المشروع» فيه أربعة
 * عشر حقلًا ومعاها توصية الباحث كاملة، و«توصية» فيه حقل واحد فاضي.
 * فالصف بيعرض الترويسة، والتفصيل بينفتح بضغطة — عشان سجلّ من ستة
 * وعشرين قيدًا يفضل قابلًا للمسح بالعين.
 *
 * والفاعل أربعة أنواع (موظف · الجهة · كيان جماعي · النظام) وبيتفرّقوا
 * بصريًا: القيد اللي عاملته الجهة مش زي اللي عمله موظف، وده اللي
 * بيخلّي «مين واقف على مين» يتقري من غير قراءة.
 *
 * والمتابعات جوّه نفس التايم لاين، لأن النظام بيحطّها كده — والمتابعة
 * اللي بتقول «متطلب الدفعة الثانية» هي سبب إذن الصرف اللي بعدها.
 */
export function LogTab({ events, entityName }: LogTabProps) {
  const [view, setView] = useState<string>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const shown = useMemo(() => {
    if (view === 'all') return events
    if (view === 'decision') return events.filter((e) => !e.followUp && DECISION.test(e.action))
    if (view === 'money') return events.filter((e) => MONEY.test(e.action))
    if (view === 'entity') return events.filter((e) => e.actor === 'entity')
    return events.filter((e) => e.hours > e.limit)
  }, [events, view])

  const counts = useMemo(
    () => ({
      all: events.length,
      decision: events.filter((e) => !e.followUp && DECISION.test(e.action)).length,
      money: events.filter((e) => MONEY.test(e.action)).length,
      entity: events.filter((e) => e.actor === 'entity').length,
      late: events.filter((e) => e.hours > e.limit).length,
    }),
    [events],
  )

  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <Glass>
      <Head
        title="سجل المشروع"
        meta={`${events.length} حدثًا · الأحدث أولًا`}
      />

      <Segments
        active={view}
        onChange={(k) => setView(k ?? 'all')}
        items={VIEWS.map((v) => ({
          key: v.key,
          label: v.label,
          count: counts[v.key as keyof typeof counts],
        }))}
      />

      {shown.length === 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <Empty title="لا توجد أحداث بهذا التصنيف." />
        </div>
      ) : (
        <ol className="lg">
          {shown.map((e) => {
            const late = e.hours > e.limit
            const isOpen = open.has(e.id)
            const has = e.fields.some((f) => f.v) || Boolean(e.files?.length)

            return (
              <li className={`lgi a-${e.actor}${e.followUp ? ' fu' : ''}`} key={e.id}>
                <span className={`lgdot t-${e.tone}`} aria-hidden="true" />

                <div className="lgmain">
                  <div className="lghead">
                    {e.followUp ? (
                      <span className="itag">{e.followUp}</span>
                    ) : (
                      <b className="lgact">{e.action}</b>
                    )}
                    <span className="lgdept">{e.followUp ? 'متابعة' : e.dept}</span>
                    <span className="pc-sp" />
                    <Mono>{e.at}</Mono>
                    <span className="lgtime sub">{e.time}</span>
                  </div>

                  {e.followUp && <div className="lgbody">{e.action}</div>}

                  <div className="lgby">
                    <span className={`lgwho k-${e.actor}`}>
                      {e.actor === 'entity' ? entityName : e.by}
                    </span>
                    <span className="lgkind sub">{ACTOR[e.actor]}</span>
                    {!e.followUp && (
                      <span className={`lgdur${late ? ' late' : ''}`}>
                        <Mono>{e.days}</Mono> يومًا ·{' '}
                        <Mono>{e.hours}</Mono> من <Mono>{e.limit}</Mono> ساعة
                      </span>
                    )}
                  </div>

                  {has && (
                    <>
                      <button className="lgmore" onClick={() => toggle(e.id)} aria-expanded={isOpen}>
                        <Icon path={isOpen ? icons.chevronUp : icons.chevronDown} size={14} />
                        {isOpen
                          ? 'إخفاء التفاصيل'
                          : fieldCount(e) > 0
                            ? `تفاصيل الإجراء · ${fieldCount(e)} حقل`
                            : `المرفقات · ${e.files?.length ?? 0}`}
                      </button>

                      {isOpen && (
                        <div className="lgfields">
                          {e.fields
                            .filter((f) => f.v)
                            .map((f) => (
                              <div className={`lgf${f.strong ? ' s' : ''}`} key={f.k}>
                                <span className="lgf-k">{f.k}</span>
                                <span className="lgf-v">{f.v}</span>
                              </div>
                            ))}
                          {e.files?.map((n) => (
                            <div className="lgf" key={n}>
                              <span className="lgf-k">مرفق</span>
                              <span className="lgf-v"><DocFile name={n} /></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="sub" style={{ marginTop: '1rem' }}>
        كل إجراء يحمل: القسم · المنفّذ · الوقت · المدة مقابل حدّ القسم · وحقول خاصة بنوعه.
        الحدّ <Mono>900</Mono> ساعة مطبَّق على كل الأقسام في النظام الحالي — قيمة واحدة لا حدّ لكل قسم.
      </div>
    </Glass>
  )
}
