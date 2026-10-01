import type { CSSProperties } from 'react'
import { DateText, Empty, Glass, Head, Mono, Num, Tag } from '@/components/ui'
import { countOf, isolate, nf, NOUN, projectCode } from '@/lib/format'
import { projectById } from '@/data/mock/projects'
import type { Entity, FollowUp, FollowUpType } from '@/types/domain'
import type { ThreadMessage } from '@/data/mock/detail'
import { Thread } from '@/components/thread'
import { DocFile } from '@/components/docs'

export { DataTab } from './DataTab'
export { EntityTab } from './EntityTab'
export { AgreementTab, type AgreementTabProps } from './AgreementTab'
export { PlanTab, type PlanTabProps } from './PlanTab'
export { CloseTab, type CloseTabProps } from './CloseTab'
export { PaymentsTab, type PaymentsTabProps } from './PaymentsTab'
export { LogTab, type LogTabProps } from './LogTab'
export { ActivitiesTab, type ActivitiesTabProps } from './ActivitiesTab'

/* Previous projects */

export function HistoryTab({
  entity: E, currentId, year,
}: { entity: Entity; currentId: string; year: string }) {
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
        <Head title="مشاريع الجهة" meta={`${countOf(E.projects.length, NOUN.project)}`} />
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
                  <td><Mono>{projectCode(p.id, projectById(p.id)?.year ?? year)}</Mono></td>
                  <td>{p.name}</td>
                  <td>{p.region}</td>
                  <td><Tag tone={p.tone}>{p.status}</Tag></td>
                  <td className="n">{p.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sub mt-3">
          مشروع واحد اعتُذر عنه بوزن <Num>96</Num>، وهو أعلى وزن سُجّل للجهة. سبب الاعتذار غير
          مسجّل في النظام الحالي.
        </div>
      </Glass>
    </>
  )
}

/* Follow-ups */

/**
 * Follow-ups.
 *
 * In the current system, a follow-up is where disbursement conditions get
 * documented: an entry stating "second payment requirement: 50% of
 * operations complete" is what the disbursement authorization issued days
 * later was based on. So it isn't a notes log — it's the evidence a
 * financial decision rests on.
 *
 * It also appears inside the project log in the same chronological order,
 * because the system places it in the same timeline. This tab is a
 * focused view of it.
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
            <div className="data" key={i} style={{ padding: 'var(--sp-5) 0' }}>
              <div className="rowf" style={{ gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)' }}>
                <span className="itag">{f.type}</span>
                <span className="pc-sp" />
                <span className="sub">{f.by}</span>
                <DateText>{f.at}</DateText>
              </div>
              <div className="prose">{isolate(f.body)}</div>
              {f.attachment && (
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <DocFile name={f.attachment} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="hd" style={{ marginTop: 'var(--sp-6)', marginBottom: 'var(--sp-3)' }}>
        <h3 style={{ fontSize: 'var(--fs-3)' }}>إضافة متابعة</h3>
        <span className="meta">النوع والوصف إلزاميان</span>
      </div>
      <div className="chips">
        {types.map((t) => (
          <button className="chip" key={t}>{t}</button>
        ))}
      </div>
      <div className="sub mt-3">
        حجم المرفق أقل من 32 ميجابايت · pdf doc docx txt jpg jpeg gif png xls xlsx
      </div>
    </Glass>
  )
}

/* Correspondence */

/**
 * Correspondence with the entity.
 *
 * This channel is nearly inactive in the current system: zero messages
 * across the 38 projects examined, and the one thread found was entirely
 * about a stalled receipt voucher. So it isn't a general communication
 * channel — it opens when an action is blocked on the entity.
 *
 * We show it exactly as that: if an action is blocked on the entity, the
 * thread exists with the reason it's blocked. Otherwise, we say it's empty
 * and state when it's used, instead of showing an empty chat box on every
 * project.
 */
export function CorrespondenceTab({
  messages,
  entityName,
  why,
}: {
  messages: ThreadMessage[]
  entityName: string
  /** Reason the channel is open — stated above the thread. */
  why: string
}) {
  return (
    <Glass>
      <Head
        title="المراسلة مع الجهة"
        meta={messages.length ? `${messages.length} رسائل` : 'لا توجد'}
      />

      <Thread
        messages={messages}
        entityName={entityName}
        me="staff"
        why={why}
        placeholder={`اكتب رسالة إلى ${entityName}…`}
        emptyTitle="لا توجد مراسلات على هذا المشروع."
        emptyNote="تُستخدم القناة عمليًا حين يتوقف إجراء على الجهة: طلب استكمال، أو سند لم يُرفع، أو تقرير متأخر. وفي غير ذلك يجري التواصل عبر المتابعات."
      />
    </Glass>
  )
}
