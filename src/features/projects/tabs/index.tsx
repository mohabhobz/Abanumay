import type { CSSProperties } from 'react'
import {
  Glass, Head, Tag, Num, Mono, Empty, Icon, icons,
} from '@/components/ui'
import { nf } from '@/lib/format'
import type { Entity, FollowUp, FollowUpType } from '@/types/domain'
import type { ThreadMessage } from '@/data/mock/detail'
import { DocFile } from '@/components/docs'

export { DataTab } from './DataTab'
export { EntityTab } from './EntityTab'
export { AgreementTab, type AgreementTabProps } from './AgreementTab'
export { PaymentsTab, type PaymentsTabProps } from './PaymentsTab'
export { LogTab, type LogTabProps } from './LogTab'

/* ═══════════════ المشاريع السابقة ═══════════════ */

export function HistoryTab({ entity: E, currentId }: { entity: Entity; currentId: string }) {
  return (
    <>
      <Glass>
        <Head title="مؤشرات الجهة" meta="تراكمي" />
        <div className="imp" style={{ '--n': E.stats.length } as CSSProperties}>
          {E.stats.map((s) => (
            <div key={s.k}>
              <div className="v num">{nf.format(s.v)}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <Head title="مشاريع الجهة" meta={`${E.projects.length} مشاريع`} />
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>الرقم</th><th>المشروع</th><th>المنطقة</th><th>الحالة</th>
                <th className="n">الوزن</th>
              </tr>
            </thead>
            <tbody>
              {E.projects.map((p) => (
                <tr key={p.id} className={p.id === currentId ? 'lv0' : ''}>
                  <td><Mono>{p.id}</Mono></td>
                  <td>{p.name}</td>
                  <td>{p.region}</td>
                  <td><Tag tone={p.tone}>{p.status}</Tag></td>
                  <td className="n num">{p.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub" style={{ marginTop: '.8rem' }}>
          مشروع واحد اعتُذر عنه بوزن <Num>96</Num>، وهو أعلى وزن سُجّل للجهة. سبب الاعتذار غير
          مسجّل في النظام الحالي.
        </div>
      </Glass>
    </>
  )
}

/* ═══════════════ المتابعات ═══════════════ */

/**
 * المتابعات.
 *
 * في النظام العامل المتابعة **بتتوثّق فيها شروط الصرف**: الصف اللي
 * بيقول «متطلب الدفعة الثانية: إنجاز 50% من العمليات» هو اللي إذن
 * الصرف اتبنى عليه بعده بأيام. فمش سجل ملاحظات · ده الدليل اللي
 * القرار المالي بيستند له.
 *
 * وهي كمان **بتظهر جوّه سجل المشروع** بنفس الترتيب الزمني، لأن
 * النظام بيحطّها في نفس التايم لاين. التاب ده عرض مركَّز ليها.
 */
export function FollowUpsTab({
  followUps,
  types,
}: {
  followUps: FollowUp[]
  types: FollowUpType[]
}) {
  return (
    <Glass>
      <Head
        title="المتابعات"
        meta={followUps.length ? `${followUps.length} متابعة` : 'لا توجد'}
      />

      {followUps.length === 0 ? (
        <Empty
          title="لا توجد متابعات مسجّلة على هذا المشروع."
          note="المتابعة توثّق تواصلًا أو زيارة أو منتجًا معرفيًا أو شرط صرف، وتظهر في سجل المشروع بترتيبها الزمني."
        />
      ) : (
        <div className="col-s flush">
          {followUps.map((f, i) => (
            <div className="data" key={i} style={{ padding: '.95rem 0' }}>
              <div className="rowf" style={{ gap: '.5rem', marginBottom: '.45rem' }}>
                <span className="itag">{f.type}</span>
                <span className="pc-sp" />
                <span className="sub">{f.by}</span>
                <Mono>{f.at}</Mono>
              </div>
              <div style={{ fontSize: '.86rem', lineHeight: 1.7 }}>{f.body}</div>
              {f.attachment && (
                <div style={{ marginTop: '.55rem' }}>
                  <DocFile name={f.attachment} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="hd" style={{ marginTop: '1.3rem', marginBottom: '.6rem' }}>
        <h3 style={{ fontSize: '.9rem' }}>إضافة متابعة</h3>
        <span className="meta">النوع والوصف إلزاميان</span>
      </div>
      <div className="chips">
        {types.map((t) => (
          <button className="chip" key={t}>{t}</button>
        ))}
      </div>
      <div className="sub" style={{ marginTop: '.8rem' }}>
        المرفق أقل من 32 ميجابايت · pdf doc docx txt jpg jpeg gif png xls xlsx
      </div>
    </Glass>
  )
}

/* ═══════════════ المراسلات ═══════════════ */

/**
 * المراسلة مع الجهة.
 *
 * القناة دي في النظام العامل **شبه ميتة**: صفر رسائل في ٣٨ مشروعًا
 * فحصناه، والثريد الوحيد اللي لقيناه كان كله عن سند قبض اتعطّل.
 * يعني هي مش قناة تواصل عام · بتتفتح **لما إجراء يقف على الجهة**.
 *
 * فبنعرضها كده بالظبط: لو الإجراء واقف على الجهة، الثريد موجود
 * ومعاه سبب وقوفه. ولو لأ، بنقول إنها فاضية ونقول امتى بتُستخدم،
 * بدل ما نوري صندوق شات فاضي في كل مشروع.
 */
export function CorrespondenceTab({
  messages,
  entityName,
  why,
}: {
  messages: ThreadMessage[]
  entityName: string
  /** سبب فتح القناة · بيتقال فوق الثريد */
  why: string
}) {
  return (
    <Glass>
      <Head
        title="المراسلة مع الجهة"
        meta={messages.length ? `${messages.length} رسائل` : 'لا توجد'}
      />

      {messages.length > 0 ? (
        <>
          <div className="thread-why">
            <Icon name={icons.alert} size={15} style={{ color: 'var(--warn)', flex: 'none' }} />
            <span className="sub">{why}</span>
          </div>
          <div className="thread">
            {messages.map((m, i) => (
              <div className={`msg ${m.from}`} key={i}>
                <div className="msg-h">
                  <span className="msg-by">{m.from === 'entity' ? entityName : m.by}</span>
                  <span className="msg-role">{m.from === 'entity' ? 'الجهة' : 'المؤسسة'}</span>
                  <span className="pc-sp" />
                  <Mono>{m.at}</Mono>
                </div>
                <div className="msg-b">{m.body}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="لا توجد مراسلات على هذا المشروع."
          note="القناة تُستخدم عمليًا حين يقف إجراء على الجهة، طلب استكمال، أو سند لم يُرفع، أو تقرير متأخر. وما عدا ذلك يجري التواصل في المتابعات."
        />
      )}

      <div className="ask free" style={{ marginTop: '1rem' }}>
        <span className="ph">اكتب رسالة لـ{entityName}…</span>
        <button className="attach" aria-label="إرفاق"><Icon name={icons.clip} /></button>
        <button className="go" aria-label="إرسال"><Icon name={icons.send} /></button>
      </div>
    </Glass>
  )
}
