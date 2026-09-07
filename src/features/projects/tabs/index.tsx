import type { CSSProperties } from 'react'
import {
  Glass, Head, Tag, Num, Mono, Empty, Timeline, Icon, icons,
} from '@/components/ui'
import { nf } from '@/lib/format'
import type { Entity, FollowUpType, Project } from '@/types/domain'

export { DataTab } from './DataTab'
export { EntityTab } from './EntityTab'

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
          مشروع واحد اعتُذر عنه بوزن <Num>96</Num> — وهو أعلى وزن سُجّل للجهة. سبب الاعتذار غير
          مسجّل في النظام الحالي.
        </div>
      </Glass>
    </>
  )
}

/* ═══════════════ الاتفاقية ═══════════════
   بتتفتح بعد الاعتماد النهائي — الحالة الفاضية بتقول إيه اللي هيظهر
   هنا لما توصل، عشان المستخدم يعرف إن الشاشة مش ناقصة. */

export function AgreementTab() {
  return (
    <Glass>
      <Head title="اتفاقية المشروع" meta="تُفتح بعد الاعتماد النهائي" />
      <Empty
        title="لا توجد اتفاقية — المشروع لم يصل لمرحلة الاعتماد."
        note="عند التفعيل: اختيار القالب · استرجاع بيانات المشروع تلقائيًا · بنود الأحكام والشروط · جدول الدفعات · دورة التوقيع"
        actions={
          <>
            <button className="btn btn-off">طباعة الاتفاقية</button>
            <button className="btn btn-off">مسودة جديدة</button>
          </>
        }
      />
    </Glass>
  )
}

/* ═══════════════ الدفعات ═══════════════ */

export function PaymentsTab() {
  return (
    <Glass>
      <Head title="جدول الدفعات" meta="يُفتح بعد اعتماد الاتفاقية" />
      <Empty
        title="لا توجد دفعات — المشروع لم يصل لمرحلة الاتفاقية."
        note="الأعمدة عند التفعيل: الدفعة · المبلغ · تاريخ الدفعة · الحالة · إذن الصرف"
      />
    </Glass>
  )
}

/* ═══════════════ المتابعات ═══════════════ */

export function FollowUpsTab({
  project: P,
  types,
}: {
  project: Project
  types: FollowUpType[]
}) {
  return (
    <Glass>
      <Head title="المتابعات" meta={`${P.followUps.length} متابعة`} />
      <Empty title="لا توجد متابعات مسجّلة على هذا المشروع." />

      <div className="hd" style={{ marginTop: '1.2rem', marginBottom: '.6rem' }}>
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

/* ═══════════════ سجل المشروع ═══════════════ */

export function LogTab({ project: P }: { project: Project }) {
  return (
    <Glass>
      <Head title="سجل المشروع" meta={`${P.log.length} إجراءات`} />
      <Timeline
        events={P.log.map((l) => ({
          tone: l.tone,
          title: <><b>{l.action}</b> — {l.body}</>,
          by: (
            <>
              <span className="av" style={{ width: 20, height: 20, fontSize: '.6rem' }}>
                {l.by[0]}
              </span>
              <span>{l.by} · {l.dept}</span>
              <Mono>{l.at}</Mono>
            </>
          ),
          foot: (
            <>
              {l.days} يومًا · <Num>{l.hours}</Num> من <Num>{l.limit}</Num> ساعة
              {l.extra ? ` · ${l.extra}` : ''}
            </>
          ),
          footTone: l.hours > l.limit ? 'var(--no)' : undefined,
        }))}
      />
      <div className="sub" style={{ marginTop: '.9rem' }}>
        كل إجراء يحمل: القسم · المنفّذ · الوقت · المدة مقابل حدّ القسم · سبب التأخر إن وُجد.
      </div>
    </Glass>
  )
}

/* ═══════════════ المراسلات ═══════════════ */

export function CorrespondenceTab({
  project: P,
  entityName,
}: {
  project: Project
  entityName: string
}) {
  return (
    <Glass>
      <Head title="المراسلة مع الجهة" meta={`${P.messages.length} رسائل`} />
      <div className="sub" style={{ marginBottom: '.8rem' }}>
        القناة الرسمية داخل المشروع، مرتبطة بطلب الاستكمال الحالي.
      </div>
      <Empty title="لا توجد رسائل بعد." />

      <div className="ask free" style={{ marginTop: '1rem' }}>
        <span className="ph">اكتب رسالة لـ{entityName}…</span>
        <button className="attach" aria-label="إرفاق"><Icon path={icons.clip} /></button>
        <button className="go" aria-label="إرسال"><Icon path={icons.send} /></button>
      </div>
    </Glass>
  )
}
